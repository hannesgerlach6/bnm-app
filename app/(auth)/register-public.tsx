import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { showError } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { COLORS } from "../../constants/Colors";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import type { Gender, ContactPreference } from "../../types";
import { Container } from "../../components/Container";
import { supabase } from "../../lib/supabase";
import { sendNewMenteeRegistrationNotification } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";

type Step = "form" | "success";

// Mindest-Ausfüllzeit in Millisekunden (5 Sekunden)
const MIN_FILL_TIME_MS = 5000;

// Passwort-Stärke berechnen (0–3)
function getPasswordStrength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw || pw.length < 8) return 0;
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return 1;
  if (score === 2 || score === 3) return 2;
  return 3;
}

export default function RegisterPublicScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [step, setStep] = useState<Step>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Spam-Schutz: Timestamp beim Laden des Formulars
  const formLoadTime = useRef<number>(Date.now());

  // Spam-Schutz: Honeypot-Feld (muss leer bleiben)
  const [honeypot, setHoneypot] = useState("");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [city, setCity] = useState("");
  const [plz, setPlz] = useState("");
  const [age, setAge] = useState("");
  const [contactPref, setContactPref] = useState<ContactPreference | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = t("register.errorFirstName");
    if (!lastName.trim()) newErrors.lastName = t("register.errorLastName");
    if (!email.trim() || !email.includes("@"))
      newErrors.email = t("register.errorEmail");
    if (!gender) newErrors.gender = t("register.errorGender");
    if (!city.trim()) newErrors.city = t("register.errorCity");
    if (!plz.trim() || !/^\d{4,5}$/.test(plz.trim()))
      newErrors.plz = t("register.errorPlz");
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 12 || ageNum > 120)
      newErrors.age = t("register.errorAge");
    if (!contactPref) newErrors.contactPref = t("register.errorContactPref");
    if (!password.trim() || password.length < 8)
      newErrors.password = t("register.errorPassword");
    if (password !== passwordConfirm)
      newErrors.passwordConfirm = t("register.errorPasswordMatch");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    // Honeypot-Prüfung: Wenn das versteckte Feld ausgefüllt ist → Bot
    if (honeypot.length > 0) {
      showError(t("register.botDetected"));
      return;
    }

    // Zeitprüfung: Formular in unter 5 Sekunden abgeschickt → wahrscheinlich Bot
    const elapsed = Date.now() - formLoadTime.current;
    if (elapsed < MIN_FILL_TIME_MS) {
      showError(t("register.tooFast"));
      return;
    }

    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const phoneClean = phone.trim();
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Duplikats-Check via DB-Funktion (E-Mail + Telefon)
      const { data: dupCheck } = await supabase.rpc("check_duplicate_registration", {
        check_email: emailLower,
        check_phone: phoneClean,
      });

      if (dupCheck) {
        const dup = dupCheck as { email_exists: boolean; phone_exists: boolean };
        if (dup.email_exists) {
          setErrors((prev) => ({ ...prev, email: t("register.errorEmailTaken") }));
          setIsSubmitting(false);
          return;
        }
        if (dup.phone_exists) {
          setErrors((prev) => ({ ...prev, phone: t("register.errorPhoneTaken") }));
          setIsSubmitting(false);
          return;
        }
      }

      // Account erstellen via Supabase Auth
      const { data: signUpData, error } = await supabase.auth.signUp({
        email: emailLower,
        password: password,
        options: {
          data: {
            name: fullName,
            role: "mentee",
            gender: gender,
            city: city.trim(),
            plz: plz.trim(),
            age: parseInt(age, 10),
            phone: phone.trim() || "",
            contact_preference: contactPref || "whatsapp",
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          setErrors((prev) => ({ ...prev, email: t("register.errorEmailTaken") }));
        } else {
          showError(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Profil mit zusätzlichen Daten updaten (Telefon, Kontaktpräferenz)
      // Direkt die user.id aus dem signUp-Response nutzen — nicht getUser() aufrufen,
      // da das bei E-Mail-Bestätigung null zurückgeben kann
      const newUserId = signUpData?.user?.id;
      if (newUserId) {
        await supabase.from("profiles").update({
          phone: phone.trim() || "",
          contact_preference: contactPref || "whatsapp",
          plz: plz.trim(),
        }).eq("id", newUserId);
      }

      // E-Mail-Benachrichtigung an Admin
      await sendNewMenteeRegistrationNotification(
        fullName,
        emailLower,
        city.trim(),
        gender ?? "male"
      );

      setStep("success");
    } catch {
      showError(t("register.errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <Container>
        <View style={[styles.successContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.successIconBox}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={[styles.successTitle, { color: themeColors.text }]}>{t("register.successTitle")}</Text>
          <Text style={[styles.successText, { color: themeColors.textSecondary }]}>
            {t("register.successText")}
          </Text>
          <Text style={[styles.successSub, { color: themeColors.textTertiary }]}>
            {t("register.successSub")}
          </Text>
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.backToLoginText}>{t("register.toDashboard")}</Text>
          </TouchableOpacity>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={[styles.flex1, { backgroundColor: themeColors.background }]}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.page}>
            {/* Titel */}
            <View style={styles.titleSection}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("register.title")}</Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                {t("register.subtitle")}
              </Text>
            </View>

            {/* Vorname */}
            <FormField label={t("register.firstName")} error={errors.firstName}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.firstName ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.firstNamePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                value={firstName}
                onChangeText={setFirstName}
              />
            </FormField>

            {/* Nachname */}
            <FormField label={t("register.lastName")} error={errors.lastName}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.lastName ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.lastNamePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                value={lastName}
                onChangeText={setLastName}
              />
            </FormField>

            {/* E-Mail */}
            <FormField label={t("register.email")} error={errors.email}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.email ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder="deine@email.de"
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </FormField>

            {/* Telefon */}
            <FormField label={t("register.phone")}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder="+49 ..."
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </FormField>

            {/* Geschlecht */}
            <FormField label={t("register.gender")} error={errors.gender}>
              <View style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.pill, gender === "male" ? { backgroundColor: isDark ? "#FFCA28" : COLORS.primary, borderColor: isDark ? "#FFCA28" : COLORS.primary } : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }]]}
                  onPress={() => setGender("male")}
                >
                  <Text style={gender === "male" ? { color: isDark ? "#0E0E14" : COLORS.white, fontWeight: "600", fontSize: 13 } : [styles.pillTextInactive, { color: themeColors.textSecondary }]}>
                    {t("register.brother")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, gender === "female" ? { backgroundColor: isDark ? "#c084fc" : "#7e22ce", borderColor: isDark ? "#c084fc" : "#7e22ce" } : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }]]}
                  onPress={() => setGender("female")}
                >
                  <Text style={gender === "female" ? { color: isDark ? "#0E0E14" : COLORS.white, fontWeight: "600", fontSize: 13 } : [styles.pillTextInactive, { color: themeColors.textSecondary }]}>
                    {t("register.sister")}
                  </Text>
                </TouchableOpacity>
              </View>
            </FormField>

            {/* Stadt */}
            <FormField label={t("register.city")} error={errors.city}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.city ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.cityPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                value={city}
                onChangeText={setCity}
              />
            </FormField>

            {/* Postleitzahl */}
            <FormField label={t("register.plz")} error={errors.plz}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.plz ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.plzPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="numeric"
                maxLength={5}
                value={plz}
                onChangeText={setPlz}
              />
            </FormField>

            {/* Alter */}
            <FormField label={t("register.age")} error={errors.age}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.age ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.agePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
              />
            </FormField>

            {/* Kontaktpräferenz */}
            <FormField label={t("register.contactPref")} error={errors.contactPref}>
              <View style={styles.pillRow}>
                {(
                  [
                    { key: "whatsapp", label: t("contactPref.whatsapp") },
                    { key: "phone", label: t("contactPref.phone") },
                    { key: "email", label: t("contactPref.email") },
                    { key: "telegram", label: t("contactPref.telegram") },
                  ] as const
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.pill,
                      contactPref === opt.key ? { backgroundColor: isDark ? "#FFCA28" : COLORS.primary, borderColor: isDark ? "#FFCA28" : COLORS.primary } : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                    ]}
                    onPress={() => setContactPref(opt.key)}
                  >
                    <Text
                      style={
                        contactPref === opt.key
                          ? { color: isDark ? "#0E0E14" : COLORS.white, fontWeight: "600" as const, fontSize: 13 }
                          : [styles.pillTextInactive, { color: themeColors.textSecondary }]
                      }
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

            {/* Passwort */}
            <FormField label={t("register.password")} error={errors.password}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TextInput
                  style={[styles.input, { flex: 1, backgroundColor: themeColors.card, color: themeColors.text }, errors.password ? styles.inputError : { borderColor: themeColors.border }]}
                  placeholder={t("register.passwordPlaceholder")}
                  placeholderTextColor={themeColors.textTertiary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={{ paddingHorizontal: 10 }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={{ color: themeColors.textSecondary, fontSize: 13 }}>
                    {showPassword ? t("register.hidePassword") : t("register.showPassword")}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Passwort-Stärke-Anzeige */}
              {password.length > 0 && (
                <PasswordStrengthBar password={password} />
              )}
            </FormField>

            {/* Passwort bestätigen */}
            <FormField label={t("register.passwordConfirm")} error={errors.passwordConfirm}>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.passwordConfirm ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder={t("register.passwordConfirmPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                secureTextEntry={!showPassword}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
              />
            </FormField>

            {/* Hinweis */}
            <View style={[styles.infoBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
              <Text style={[styles.infoBoxText, { color: isDark ? "#93c5fd" : "#1e40af" }]}>
                {t("register.infoBox")}
              </Text>
            </View>

            {/* Honeypot – für Menschen unsichtbar, Bots füllen es aus */}
            <View style={styles.honeypotField} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <TextInput
                style={styles.honeypotInput}
                value={honeypot}
                onChangeText={setHoneypot}
                autoComplete="off"
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting ? { opacity: 0.6 } : {}]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? t("register.submitting") : t("register.submit")}
              </Text>
            </TouchableOpacity>

            {/* Link zum Login */}
            <View style={styles.loginLinkRow}>
              <Text style={[styles.loginLinkText, { color: themeColors.textSecondary }]}>{t("register.alreadyRegistered")} </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={[styles.loginLink, { color: themeColors.link }]}>{t("register.loginLink")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const themeColors = useThemeColors();
  return (
    <View style={fieldStyles.container}>
      <Text style={[fieldStyles.label, { color: themeColors.textSecondary }]}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

function PasswordStrengthBar({ password }: { password: string }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const strength = getPasswordStrength(password);

  const colors: Record<number, string> = {
    0: themeColors.border,
    1: COLORS.error,
    2: COLORS.gold,
    3: COLORS.cta,
  };

  const labels: Record<number, string> = {
    0: "",
    1: t("passwordStrength.weak"),
    2: t("passwordStrength.medium"),
    3: t("passwordStrength.strong"),
  };

  const fillColor = colors[strength];
  const fillPct = strength === 0 ? 0 : (strength / 3) * 100;

  return (
    <View style={strengthStyles.container}>
      <View style={[strengthStyles.track, { backgroundColor: themeColors.border }]}>
        <View style={[strengthStyles.fill, { width: `${fillPct}%` as any, backgroundColor: fillColor }]} />
      </View>
      {strength > 0 && (
        <Text style={[strengthStyles.label, { color: fillColor }]}>{labels[strength]}</Text>
      )}
    </View>
  );
}

const strengthStyles = StyleSheet.create({
  container: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  track: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  fill: { height: "100%", borderRadius: 3 },
  label: { fontSize: 12, fontWeight: "600", minWidth: 50 },
});

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  error: { color: COLORS.error, fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  page: { padding: 20, paddingBottom: 40 },

  titleSection: { marginBottom: 16 },
  pageTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { fontSize: 13 },

  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  inputError: { borderColor: COLORS.error },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  pillActiveFemale: { backgroundColor: "#7e22ce", borderColor: "#7e22ce" },
  pillInactive: {},
  pillTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  pillTextInactive: { fontSize: 13 },

  infoBox: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  infoBoxText: { fontSize: 13, lineHeight: 19 },

  submitButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  submitButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },

  // Honeypot-Feld (unsichtbar für echte Nutzer)
  honeypotField: {
    position: "absolute",
    width: 0,
    height: 0,
    overflow: "hidden",
    opacity: 0,
  },
  honeypotInput: {
    width: 0,
    height: 0,
  },

  loginLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: { fontSize: 13 },
  loginLink: { fontSize: 13, fontWeight: "600" },

  // Success Screen
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  successIconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successIcon: { color: COLORS.white, fontSize: 28, fontWeight: "bold" },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  successText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  successSub: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
    marginBottom: 28,
  },
  backToLoginButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingHorizontal: 28,
    paddingVertical: 10,
    alignItems: "center",
  },
  backToLoginText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
});
