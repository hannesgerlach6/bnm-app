import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Linking,
} from "react-native";
import { BNMInput } from "../../components/BNMInput";
import { showError } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { COLORS, RADIUS } from "../../constants/Colors";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import type { Gender, ContactPreference } from "../../types";
import { Container } from "../../components/Container";
import { supabase } from "../../lib/supabase";
import { sendNewMenteeRegistrationNotification } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";
import { geocodePLZ } from "../../lib/geocoding";

type Step = "form" | "success";

// Mindest-Ausfüllzeit in Millisekunden (5 Sekunden)
const MIN_FILL_TIME_MS = 5000;

type ConversionTime =
  | "under_6_months"
  | "under_12_months"
  | "over_12_months"
  | "not_yet"
  | "born_muslim"
  | "";

type Country = "AT" | "DE" | "CH" | "other" | "";

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

  // Sektion 1: Persönliche Daten
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [city, setCity] = useState("");
  const [plz, setPlz] = useState("");
  const [country, setCountry] = useState<Country>("");
  const [age, setAge] = useState("");

  // Sektion 2: Über dich
  const [conversionTime, setConversionTime] = useState<ConversionTime>("");
  const [contactPref, setContactPref] = useState<ContactPreference | null>(null);

  // Sektion 3: Bestätigungen
  const [confirm16, setConfirm16] = useState(false);
  const [confirmConverted, setConfirmConverted] = useState(false);
  const [confirmRegister, setConfirmRegister] = useState(false);
  const [confirmPrivacy, setConfirmPrivacy] = useState(false);
  const [additionalMessage, setAdditionalMessage] = useState("");

  // Sektion 4: Passwort
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});

  const activeColor = isDark ? themeColors.accent : themeColors.primary;
  const activeTextColor = isDark ? themeColors.black : themeColors.white;
  const femaleActiveColor = isDark ? "#c084fc" : "#7e22ce";

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
    if (!country) newErrors.country = t("register.errorRequired");
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 12 || ageNum > 120)
      newErrors.age = t("register.errorAge");
    if (!conversionTime) newErrors.conversionTime = t("register.errorRequired");
    if (!contactPref) newErrors.contactPref = t("register.errorContactPref");
    if (!confirm16) newErrors.confirm16 = t("register.errorConfirmRequired");
    if (!confirmConverted) newErrors.confirmConverted = t("register.errorConfirmRequired");
    if (!confirmRegister) newErrors.confirmRegister = t("register.errorConfirmRequired");
    if (!confirmPrivacy) newErrors.confirmPrivacy = t("register.errorConfirmRequired");
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
            country: country,
            conversion_time: conversionTime,
          },
        },
      });

      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.includes("User already registered")
        ) {
          setErrors((prev) => ({ ...prev, email: t("register.errorEmailTaken") }));
        } else {
          showError(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Profil mit zusätzlichen Daten updaten
      const newUserId = signUpData?.user?.id;
      if (newUserId) {
        const coords = await geocodePLZ(plz.trim(), country || undefined);
        await supabase
          .from("profiles")
          .update({
            phone: phone.trim() || "",
            contact_preference: contactPref || "whatsapp",
            plz: plz.trim(),
            ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
          })
          .eq("id", newUserId);
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
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.successContainer, { backgroundColor: themeColors.background }]}>
          <View style={styles.successIconBox}>
            <Text style={styles.successIconText}>✓</Text>
          </View>
          <Text style={[styles.successTitle, { color: themeColors.text }]}>
            {t("register.successTitle")}
          </Text>
          <Text style={[styles.successText, { color: themeColors.textSecondary }]}>
            {t("register.successText")}
          </Text>
          <Text style={[styles.successSub, { color: themeColors.textTertiary }]}>
            {t("register.successSub")}
          </Text>
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => router.replace("/(tabs)")}
            accessibilityRole="button"
            accessibilityLabel={t("register.toDashboard")}
          >
            <Text style={styles.backToLoginText}>{t("register.toDashboard")}</Text>
          </TouchableOpacity>
        </View>
      </Container>
    );
  }

  function PillGroup<T extends string,>({
    options,
    value,
    onSelect,
    error,
    femaleKey,
  }: {
    options: { value: T; label: string }[];
    value: T | null | "";
    onSelect: (v: T) => void;
    error?: string;
    femaleKey?: T;
  }) {
    return (
      <>
        <View style={styles.pillRow}>
          {options.map((opt) => {
            const active = value === opt.value;
            const isFemale = femaleKey !== undefined && opt.value === femaleKey;
            const bgColor = active
              ? isFemale
                ? femaleActiveColor
                : activeColor
              : themeColors.card;
            const borderColor = active
              ? isFemale
                ? femaleActiveColor
                : activeColor
              : themeColors.border;
            const textColor = active ? activeTextColor : themeColors.textSecondary;
            return (
              <TouchableOpacity
                key={opt.value}
                style={[styles.pill, { backgroundColor: bgColor, borderColor }]}
                onPress={() => onSelect(opt.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={opt.label}
              >
                <Text style={[styles.pillText, { color: textColor, fontWeight: active ? "600" : "500" }]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </>
    );
  }

  function CheckboxRow({
    checked,
    onToggle,
    label,
    error,
  }: {
    checked: boolean;
    onToggle: () => void;
    label: string;
    error?: string;
  }) {
    return (
      <View style={styles.checkboxWrapper}>
        <TouchableOpacity
          style={styles.checkboxRow}
          onPress={onToggle}
          activeOpacity={0.7}
          accessibilityRole="checkbox"
          accessibilityState={{ checked }}
          accessibilityLabel={label}
        >
          <View
            style={[
              styles.checkbox,
              {
                backgroundColor: checked ? activeColor : themeColors.card,
                borderColor: checked ? activeColor : (error ? "#ef4444" : themeColors.border),
              },
            ]}
          >
            {checked && (
              <Text style={[styles.checkboxTick, { color: activeTextColor }]}>✓</Text>
            )}
          </View>
          <Text style={[styles.checkboxLabel, { color: themeColors.textSecondary }]}>
            {label}
          </Text>
        </TouchableOpacity>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </View>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
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
            {/* INTRO */}
            <View style={styles.titleSection}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>
                {t("register.newTitle")}
              </Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                {t("register.newSubtitle")}
              </Text>
            </View>

            {/* Benefits-Liste */}
            <View style={[styles.benefitsBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              {[
                t("register.benefit1"),
                t("register.benefit2"),
                t("register.benefit3"),
                t("register.benefit4"),
              ].map((b, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={[styles.bullet, { color: activeColor }]}>•</Text>
                  <Text style={[styles.bulletText, { color: themeColors.textSecondary }]}>{b}</Text>
                </View>
              ))}
            </View>

            {/* SEKTION 1: Persönliche Daten */}
            <SectionHeader label={t("register.section1")} />

            {/* Vorname */}
            <BNMInput
              label={t("register.firstName")}
              icon="person-outline"
              value={firstName}
              onChangeText={setFirstName}
              error={errors.firstName}
              accessibilityLabel={t("register.firstName")}
            />

            {/* Nachname */}
            <BNMInput
              label={t("register.lastName")}
              icon="person-outline"
              value={lastName}
              onChangeText={setLastName}
              error={errors.lastName}
              accessibilityLabel={t("register.lastName")}
            />

            {/* E-Mail */}
            <BNMInput
              label={t("register.email")}
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              error={errors.email}
              accessibilityLabel={t("register.email")}
            />

            {/* Telefon */}
            <BNMInput
              label={t("register.phone")}
              icon="call-outline"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              accessibilityLabel={t("register.phone")}
            />

            {/* Geschlecht */}
            <FormField label={t("register.gender")} error={errors.gender}>
              <PillGroup
                options={[
                  { value: "male" as Gender, label: t("register.brother") },
                  { value: "female" as Gender, label: t("register.sister") },
                ]}
                value={gender}
                onSelect={setGender}
                error={errors.gender}
                femaleKey={"female" as Gender}
              />
            </FormField>

            {/* Alter */}
            <BNMInput
              label={t("register.age")}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              error={errors.age}
              accessibilityLabel={t("register.age")}
            />

            {/* PLZ + Stadt */}
            <View style={styles.rowInputs}>
              <BNMInput
                label="PLZ"
                icon="location-outline"
                value={plz}
                onChangeText={setPlz}
                keyboardType="numeric"
                maxLength={5}
                error={errors.plz}
                containerStyle={{ width: 120, flex: 0 }}
                accessibilityLabel="PLZ"
              />
              <BNMInput
                label={t("register.cityPlaceholder")}
                value={city}
                onChangeText={setCity}
                error={errors.city}
                containerStyle={{ flex: 1 }}
                accessibilityLabel={t("register.cityPlaceholder")}
              />
            </View>

            {/* Land */}
            <FormField label={t("register.country")} error={errors.country}>
              <PillGroup
                options={[
                  { value: "AT" as Country, label: "Österreich" },
                  { value: "DE" as Country, label: "Deutschland" },
                  { value: "CH" as Country, label: "Schweiz" },
                  { value: "other" as Country, label: t("register.countryOther") },
                ]}
                value={country}
                onSelect={setCountry}
                error={errors.country}
              />
            </FormField>

            {/* Telefon bereits oben — kein doppeltes Feld */}

            {/* SEKTION 2: Über dich */}
            <SectionHeader label={t("register.section2")} />

            {/* Wann Islam angenommen */}
            <FormField label={t("register.conversionTime")} error={errors.conversionTime}>
              <PillGroup
                options={[
                  { value: "under_6_months" as ConversionTime, label: t("register.convUnder6") },
                  { value: "under_12_months" as ConversionTime, label: t("register.convUnder12") },
                  { value: "over_12_months" as ConversionTime, label: t("register.convOver12") },
                  { value: "not_yet" as ConversionTime, label: t("register.convNotYet") },
                  { value: "born_muslim" as ConversionTime, label: t("register.convBornMuslim") },
                ]}
                value={conversionTime}
                onSelect={setConversionTime}
                error={errors.conversionTime}
              />
            </FormField>

            {/* Kontaktpräferenz */}
            <FormField label={t("register.contactPref")} error={errors.contactPref}>
              <PillGroup
                options={[
                  { value: "whatsapp" as ContactPreference, label: t("contactPref.whatsapp") },
                  { value: "telegram" as ContactPreference, label: t("contactPref.telegram") },
                  { value: "phone" as ContactPreference, label: t("contactPref.phone") },
                  { value: "email" as ContactPreference, label: t("contactPref.email") },
                ]}
                value={contactPref}
                onSelect={setContactPref}
                error={errors.contactPref}
              />
            </FormField>

            {/* SEKTION 3: Bestätigungen */}
            <SectionHeader label={t("register.section3")} />

            <CheckboxRow
              checked={confirm16}
              onToggle={() => setConfirm16((v) => !v)}
              label={t("register.confirm16")}
              error={errors.confirm16}
            />
            <CheckboxRow
              checked={confirmConverted}
              onToggle={() => setConfirmConverted((v) => !v)}
              label={t("register.confirmConverted")}
              error={errors.confirmConverted}
            />
            <CheckboxRow
              checked={confirmRegister}
              onToggle={() => setConfirmRegister((v) => !v)}
              label={t("register.confirmRegister")}
              error={errors.confirmRegister}
            />
            {/* Datenschutz-Checkbox mit klickbaren Links */}
            <View style={styles.checkboxWrapper}>
              <TouchableOpacity
                style={styles.checkboxRow}
                onPress={() => setConfirmPrivacy((v) => !v)}
                activeOpacity={0.7}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: confirmPrivacy }}
                accessibilityLabel={t("register.confirmPrivacyPrefix")}
              >
                <View
                  style={[
                    styles.checkbox,
                    {
                      backgroundColor: confirmPrivacy ? activeColor : themeColors.card,
                      borderColor: confirmPrivacy ? activeColor : (errors.confirmPrivacy ? "#ef4444" : themeColors.border),
                    },
                  ]}
                >
                  {confirmPrivacy && (
                    <Text style={[styles.checkboxTick, { color: activeTextColor }]}>✓</Text>
                  )}
                </View>
                <Text style={[styles.checkboxLabel, { color: themeColors.textSecondary }]}>
                  {t("register.confirmPrivacyPrefix")}{" "}
                  <Text
                    style={{ color: "#3b82f6", textDecorationLine: "underline" }}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Linking.openURL("https://iman.ngo/datenschutzerklaerung/");
                    }}
                  >
                    {t("register.confirmPrivacyLink1")}
                  </Text>
                  {" "}{t("register.confirmPrivacyAnd")}{" "}
                  <Text
                    style={{ color: "#3b82f6", textDecorationLine: "underline" }}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Linking.openURL("https://iman.ngo/agbs/");
                    }}
                  >
                    {t("register.confirmPrivacyLink2")}
                  </Text>
                  {", "}
                  <Text
                    style={{ color: "#3b82f6", textDecorationLine: "underline" }}
                    onPress={(e) => {
                      e.stopPropagation?.();
                      Linking.openURL("https://iman.ngo/alle/iman-anti-extremismus-erklaerung/");
                    }}
                  >
                    {t("register.confirmPrivacyLink3")}
                  </Text>
                  {" "}{t("register.confirmPrivacySuffix")}
                </Text>
              </TouchableOpacity>
              {errors.confirmPrivacy ? <Text style={styles.errorText}>{errors.confirmPrivacy}</Text> : null}
            </View>

            {/* Optionale Nachricht */}
            <BNMInput
              label={t("register.additionalMessage")}
              value={additionalMessage}
              onChangeText={setAdditionalMessage}
              multiline
              numberOfLines={3}
              accessibilityLabel={t("register.additionalMessage")}
            />

            {/* SEKTION 4: Passwort */}
            <SectionHeader label={t("register.section4")} />

            {/* Passwort */}
            <BNMInput
              label={t("register.password")}
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              rightIcon={showPassword ? "eye-outline" : "eye-off-outline"}
              onRightIconPress={() => setShowPassword(!showPassword)}
              error={errors.password}
              accessibilityLabel={t("register.password")}
            />
            {password.length > 0 && <PasswordStrengthBar password={password} />}

            {/* Passwort bestätigen */}
            <BNMInput
              label={t("register.passwordConfirm")}
              icon="lock-closed-outline"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry={!showPassword}
              error={errors.passwordConfirm}
              accessibilityLabel={t("register.passwordConfirm")}
            />

            {/* Honeypot – für Menschen unsichtbar, Bots füllen es aus */}
            <View
              style={styles.honeypotField}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
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
              accessibilityRole="button"
              accessibilityLabel={isSubmitting ? t("register.submitting") : t("register.submit")}
              accessibilityState={{ disabled: isSubmitting }}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? t("register.submitting") : t("register.submit")}
              </Text>
            </TouchableOpacity>

            {/* Link zum Login */}
            <View style={styles.loginLinkRow}>
              <Text style={[styles.loginLinkText, { color: themeColors.textSecondary }]}>
                {t("register.alreadyRegistered")}{" "}
              </Text>
              <TouchableOpacity
                onPress={() => router.replace("/(auth)/login")}
                accessibilityRole="link"
                accessibilityLabel={t("register.loginLink")}
              >
                <Text style={[styles.loginLink, { color: themeColors.link }]}>
                  {t("register.loginLink")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

function SectionHeader({ label }: { label: string }) {
  const themeColors = useThemeColors();
  return (
    <View style={sectionStyles.container}>
      <Text style={[sectionStyles.label, { color: themeColors.text }]}>{label}</Text>
    </View>
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
        <View
          style={[
            strengthStyles.fill,
            { width: `${fillPct}%` as any, backgroundColor: fillColor },
          ]}
        />
      </View>
      {strength > 0 && (
        <Text style={[strengthStyles.label, { color: fillColor }]}>{labels[strength]}</Text>
      )}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

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

  titleSection: { marginBottom: 12 },
  pageTitle: { fontSize: 20, fontWeight: "800", marginBottom: 6 },
  pageSubtitle: { fontSize: 13, lineHeight: 19 },

  benefitsBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },

  rowInputs: {
    flexDirection: "row",
    gap: 8,
  },

  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  pillText: { fontSize: 13 },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginBottom: 8,
  },

  // Checkboxen
  checkboxWrapper: { marginBottom: 10 },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxTick: {
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },

  submitButton: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
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
  successIconText: { color: COLORS.white, fontSize: 28, fontWeight: "800" },
  successTitle: {
    fontSize: 20,
    fontWeight: "800",
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
    borderRadius: RADIUS.md,
    paddingHorizontal: 28,
    paddingVertical: 10,
    alignItems: "center",
  },
  backToLoginText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
});
