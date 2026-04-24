import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, RADIUS } from "../../constants/Colors";
import { showError, showSuccess } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";
import { BNMInput } from "../../components/BNMInput";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { UserRole, Gender, ContactPreference } from "../../types";

const ROLES: { key: UserRole; label: string }[] = [
  { key: "office", label: "Office" },
  { key: "admin", label: "Admin" },
  { key: "mentor", label: "Mentor" },
  { key: "mentee", label: "Mentee" },
];

export default function CreateUserScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { addUser } = useData();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();

  const [role, setRole] = useState<UserRole>("office");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [gender, setGender] = useState<Gender | "">("");
  const [city, setCity] = useState("");
  const [plz, setPlz] = useState("");
  const [age, setAge] = useState("");
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Nur Admin darf User anlegen
  if (!authUser || authUser.role !== "admin") {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.center, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.denied, { color: COLORS.error }]}>Nur Admin darf User anlegen.</Text>
        </View>
      </Container>
    );
  }

  const isPersonRole = role === "mentor" || role === "mentee";

  async function handleSubmit() {
    // Validierung
    if (!name.trim()) return showError("Name ist Pflicht");
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) return showError("Ungültige E-Mail");
    if (password.length < 6) return showError("Passwort: mindestens 6 Zeichen");
    if (password !== passwordConfirm) return showError("Passwörter stimmen nicht überein");
    if (isPersonRole && !gender) return showError("Geschlecht ist Pflicht für Mentor/Mentee");

    setIsSubmitting(true);
    try {
      const result = await addUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
        role,
        gender: (gender || "male") as Gender,
        city: city.trim(),
        plz: plz.trim(),
        age: age ? parseInt(age, 10) : 0,
        phone: phone.trim() || undefined,
        contact_preference: "whatsapp" as ContactPreference,
        is_active: true,
      });
      if (result?.userId) {
        showSuccess(`${ROLES.find((r) => r.key === role)?.label} "${name}" wurde angelegt.`);
        router.back();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      showError(`Anlegen fehlgeschlagen: ${msg}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          style={[styles.scroll, { backgroundColor: themeColors.background }]}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
            <BNMPressable style={styles.backLink} onPress={() => router.back()}>
              <Text style={[styles.backLinkText, { color: themeColors.link }]}>‹ Zurück</Text>
            </BNMPressable>

            <Text style={[styles.pageTitle, { color: themeColors.text }]}>Neuen User anlegen</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              Direktes Anlegen ohne Bewerbung (z.B. Office-Mitarbeiter).
            </Text>

            {/* Rolle */}
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>ROLLE</Text>
            <View style={styles.pillRow}>
              {ROLES.map((r) => (
                <BNMPressable
                  key={r.key}
                  style={[
                    styles.pill,
                    role === r.key
                      ? { backgroundColor: COLORS.gradientStart }
                      : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
                  ]}
                  onPress={() => setRole(r.key)}
                >
                  <Text style={[styles.pillText, { color: role === r.key ? COLORS.white : themeColors.textSecondary }]}>
                    {r.label}
                  </Text>
                </BNMPressable>
              ))}
            </View>

            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary, marginTop: 16 }]}>DATEN</Text>

            <BNMInput
              label="Name *"
              icon="person-outline"
              value={name}
              onChangeText={setName}
            />

            <BNMInput
              label="E-Mail *"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            <BNMInput
              label="Passwort *"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />

            <BNMInput
              label="Passwort bestätigen *"
              icon="lock-closed-outline"
              value={passwordConfirm}
              onChangeText={setPasswordConfirm}
              secureTextEntry
            />

            {isPersonRole && (
              <>
                <Text style={[styles.sectionLabel, { color: themeColors.textTertiary, marginTop: 16 }]}>
                  GESCHLECHT *
                </Text>
                <View style={styles.pillRow}>
                  {[
                    { key: "male" as Gender, label: "Bruder" },
                    { key: "female" as Gender, label: "Schwester" },
                  ].map((g) => (
                    <BNMPressable
                      key={g.key}
                      style={[
                        styles.pill,
                        gender === g.key
                          ? { backgroundColor: COLORS.gradientStart }
                          : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
                      ]}
                      onPress={() => setGender(g.key)}
                    >
                      <Text style={[styles.pillText, { color: gender === g.key ? COLORS.white : themeColors.textSecondary }]}>
                        {g.label}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>
              </>
            )}

            <BNMInput label="Stadt" icon="location-outline" value={city} onChangeText={setCity} />
            <BNMInput label="PLZ" icon="pin-outline" value={plz} onChangeText={setPlz} keyboardType="number-pad" />
            <BNMInput label="Alter" icon="calendar-outline" value={age} onChangeText={setAge} keyboardType="number-pad" />
            <BNMInput label="Telefon" icon="call-outline" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <BNMPressable
              style={[styles.submitBtn, isSubmitting && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={isSubmitting}
              accessibilityRole="button"
              accessibilityLabel="User anlegen"
            >
              <Text style={styles.submitBtnText}>
                {isSubmitting ? "Lege an..." : "User anlegen"}
              </Text>
            </BNMPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scroll: { flex: 1 },
  page: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  denied: { fontWeight: "600", textAlign: "center" },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 14 },
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, marginBottom: 4 },
  pageSubtitle: { fontSize: 13, marginBottom: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },
  pillRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  pill: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.full },
  pillText: { fontSize: 13, fontWeight: "600" },
  submitBtn: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 24,
  },
  submitBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});
