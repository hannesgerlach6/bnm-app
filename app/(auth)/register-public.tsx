import React, { useState } from "react";
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
import type { Gender, ContactPreference } from "../../types";
import { Container } from "../../components/Container";
import { supabase } from "../../lib/supabase";
import { sendNewMenteeRegistrationNotification } from "../../lib/emailService";

type Step = "form" | "success";

export default function RegisterPublicScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("form");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState<Gender | null>(null);
  const [city, setCity] = useState("");
  const [age, setAge] = useState("");
  const [contactPref, setContactPref] = useState<ContactPreference | null>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate(): boolean {
    const newErrors: Record<string, string> = {};

    if (!firstName.trim()) newErrors.firstName = "Vorname ist erforderlich.";
    if (!lastName.trim()) newErrors.lastName = "Nachname ist erforderlich.";
    if (!email.trim() || !email.includes("@"))
      newErrors.email = "Bitte eine gültige E-Mail-Adresse eingeben.";
    if (!gender) newErrors.gender = "Bitte Geschlecht auswählen.";
    if (!city.trim()) newErrors.city = "Stadt ist erforderlich.";
    const ageNum = parseInt(age, 10);
    if (!age.trim() || isNaN(ageNum) || ageNum < 12 || ageNum > 120)
      newErrors.age = "Bitte ein gültiges Alter eingeben (12–120).";
    if (!contactPref) newErrors.contactPref = "Bitte Kontaktpräferenz auswählen.";
    if (!password.trim() || password.length < 8)
      newErrors.password = "Mindestens 8 Zeichen.";
    if (password !== passwordConfirm)
      newErrors.passwordConfirm = "Passwörter stimmen nicht überein.";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const emailLower = email.trim().toLowerCase();
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      // Account direkt erstellen via Supabase Auth
      const { error } = await supabase.auth.signUp({
        email: emailLower,
        password: password,
        options: {
          data: {
            name: fullName,
            role: "mentee",
            gender: gender,
            city: city.trim(),
            age: parseInt(age, 10),
          },
        },
      });

      if (error) {
        if (error.message.includes("already registered") || error.message.includes("User already registered")) {
          setErrors((prev) => ({ ...prev, email: "Diese E-Mail ist bereits registriert." }));
        } else {
          showError(error.message);
        }
        setIsSubmitting(false);
        return;
      }

      // Profil mit zusätzlichen Daten updaten (Telefon, Kontaktpräferenz)
      const { data: { user: newUser } } = await supabase.auth.getUser();
      if (newUser) {
        await supabase.from("profiles").update({
          phone: phone.trim() || "",
          contact_preference: contactPref || "whatsapp",
        }).eq("id", newUser.id);
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
      showError("Ein unerwarteter Fehler ist aufgetreten.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (step === "success") {
    return (
      <Container>
        <View style={styles.successContainer}>
          <View style={styles.successIconBox}>
            <Text style={styles.successIcon}>✓</Text>
          </View>
          <Text style={styles.successTitle}>Willkommen bei BNM!</Text>
          <Text style={styles.successText}>
            Dein Account wurde erfolgreich erstellt. Du bist jetzt angemeldet.
          </Text>
          <Text style={styles.successSub}>
            Das BNM-Team wird dir bald einen passenden Mentor zuweisen.
            Du wirst benachrichtigt, sobald es soweit ist.
          </Text>
          <TouchableOpacity
            style={styles.backToLoginButton}
            onPress={() => router.replace("/(tabs)")}
          >
            <Text style={styles.backToLoginText}>Zum Dashboard</Text>
          </TouchableOpacity>
        </View>
      </Container>
    );
  }

  return (
    <Container>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.page}>
            {/* Titel */}
            <View style={styles.titleSection}>
              <Text style={styles.pageTitle}>Anmeldung als neuer Muslim</Text>
              <Text style={styles.pageSubtitle}>
                Erstelle deinen Account – wir weisen dir einen passenden Mentor zu.
              </Text>
            </View>

            {/* Vorname */}
            <FormField label="Vorname *" error={errors.firstName}>
              <TextInput
                style={[styles.input, errors.firstName ? styles.inputError : {}]}
                placeholder="Dein Vorname"
                placeholderTextColor={COLORS.tertiary}
                value={firstName}
                onChangeText={setFirstName}
              />
            </FormField>

            {/* Nachname */}
            <FormField label="Nachname *" error={errors.lastName}>
              <TextInput
                style={[styles.input, errors.lastName ? styles.inputError : {}]}
                placeholder="Dein Nachname"
                placeholderTextColor={COLORS.tertiary}
                value={lastName}
                onChangeText={setLastName}
              />
            </FormField>

            {/* E-Mail */}
            <FormField label="E-Mail-Adresse *" error={errors.email}>
              <TextInput
                style={[styles.input, errors.email ? styles.inputError : {}]}
                placeholder="deine@email.de"
                placeholderTextColor={COLORS.tertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </FormField>

            {/* Telefon */}
            <FormField label="Telefonnummer (optional)">
              <TextInput
                style={styles.input}
                placeholder="+49 ..."
                placeholderTextColor={COLORS.tertiary}
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </FormField>

            {/* Geschlecht */}
            <FormField label="Ich bin ein/e *" error={errors.gender}>
              <View style={styles.pillRow}>
                <TouchableOpacity
                  style={[styles.pill, gender === "male" ? styles.pillActive : styles.pillInactive]}
                  onPress={() => setGender("male")}
                >
                  <Text style={gender === "male" ? styles.pillTextActive : styles.pillTextInactive}>
                    Bruder
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.pill, gender === "female" ? styles.pillActiveFemale : styles.pillInactive]}
                  onPress={() => setGender("female")}
                >
                  <Text style={gender === "female" ? styles.pillTextActive : styles.pillTextInactive}>
                    Schwester
                  </Text>
                </TouchableOpacity>
              </View>
            </FormField>

            {/* Stadt */}
            <FormField label="Wohnort / Stadt *" error={errors.city}>
              <TextInput
                style={[styles.input, errors.city ? styles.inputError : {}]}
                placeholder="z.B. Berlin"
                placeholderTextColor={COLORS.tertiary}
                value={city}
                onChangeText={setCity}
              />
            </FormField>

            {/* Alter */}
            <FormField label="Alter *" error={errors.age}>
              <TextInput
                style={[styles.input, errors.age ? styles.inputError : {}]}
                placeholder="Dein Alter"
                placeholderTextColor={COLORS.tertiary}
                keyboardType="numeric"
                value={age}
                onChangeText={setAge}
              />
            </FormField>

            {/* Kontaktpräferenz */}
            <FormField label="Wie erreichst du dich am besten? *" error={errors.contactPref}>
              <View style={styles.pillRow}>
                {(
                  [
                    { key: "whatsapp", label: "WhatsApp" },
                    { key: "phone", label: "Telefon" },
                    { key: "email", label: "E-Mail" },
                    { key: "telegram", label: "Telegram" },
                  ] as const
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.pill,
                      contactPref === opt.key ? styles.pillActive : styles.pillInactive,
                    ]}
                    onPress={() => setContactPref(opt.key)}
                  >
                    <Text
                      style={
                        contactPref === opt.key
                          ? styles.pillTextActive
                          : styles.pillTextInactive
                      }
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </FormField>

            {/* Passwort */}
            <FormField label="Passwort wählen *" error={errors.password}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TextInput
                  style={[styles.input, { flex: 1 }, errors.password ? styles.inputError : {}]}
                  placeholder="Mindestens 8 Zeichen"
                  placeholderTextColor={COLORS.tertiary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={{ paddingHorizontal: 10 }}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Text style={{ color: COLORS.secondary, fontSize: 13 }}>
                    {showPassword ? "Verbergen" : "Zeigen"}
                  </Text>
                </TouchableOpacity>
              </View>
            </FormField>

            {/* Passwort bestätigen */}
            <FormField label="Passwort bestätigen *" error={errors.passwordConfirm}>
              <TextInput
                style={[styles.input, errors.passwordConfirm ? styles.inputError : {}]}
                placeholder="Passwort wiederholen"
                placeholderTextColor={COLORS.tertiary}
                secureTextEntry={!showPassword}
                value={passwordConfirm}
                onChangeText={setPasswordConfirm}
              />
            </FormField>

            {/* Hinweis */}
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>
                Nach dem Absenden prüft das BNM-Team deine Anfrage und weist dir einen geeigneten Mentor zu.
                Brüder werden nur Brüdern zugewiesen, Schwestern nur Schwestern.
              </Text>
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitButton, isSubmitting ? { opacity: 0.6 } : {}]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Wird gesendet..." : "Anmeldung absenden"}
              </Text>
            </TouchableOpacity>

            {/* Link zum Login */}
            <View style={styles.loginLinkRow}>
              <Text style={styles.loginLinkText}>Bereits registriert? </Text>
              <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
                <Text style={styles.loginLink}>Hier anmelden</Text>
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
  return (
    <View style={fieldStyles.container}>
      <Text style={fieldStyles.label}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { color: COLORS.secondary, fontSize: 13, fontWeight: "500", marginBottom: 4 },
  error: { color: COLORS.error, fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: COLORS.bg },
  scrollContent: { flexGrow: 1 },
  page: { padding: 20, paddingBottom: 40 },

  titleSection: { marginBottom: 16 },
  pageTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 13 },

  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
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
  pillInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  pillTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  pillTextInactive: { color: COLORS.secondary, fontSize: 13 },

  infoBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 6,
    padding: 12,
    marginBottom: 16,
    marginTop: 4,
  },
  infoBoxText: { color: "#1e40af", fontSize: 13, lineHeight: 19 },

  submitButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  submitButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },

  loginLinkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  loginLinkText: { color: COLORS.secondary, fontSize: 13 },
  loginLink: { color: COLORS.link, fontSize: 13, fontWeight: "600" },

  // Success Screen
  successContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
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
    color: COLORS.primary,
    marginBottom: 10,
    textAlign: "center",
  },
  successText: {
    color: COLORS.secondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 10,
  },
  successSub: {
    color: COLORS.tertiary,
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
