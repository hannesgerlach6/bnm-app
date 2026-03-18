import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

export default function ChangePasswordScreen() {
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function validate(): string | null {
    if (!oldPassword.trim()) return "Bitte aktuelles Passwort eingeben.";
    if (newPassword.length < 8) return "Das neue Passwort muss mindestens 8 Zeichen lang sein.";
    if (newPassword !== confirmPassword) return "Die Passwörter stimmen nicht überein.";
    if (oldPassword === newPassword) return "Das neue Passwort muss sich vom alten unterscheiden.";
    return null;
  }

  function handleSubmit() {
    const error = validate();
    if (error) {
      Alert.alert("Fehler", error);
      return;
    }

    setIsSaving(true);
    // Mock-Submit
    setTimeout(() => {
      setIsSaving(false);
      Alert.alert(
        "Passwort geändert",
        "Dein Passwort wurde erfolgreich geändert.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    }, 600);
  }

  const newPasswordStrength = (() => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 8) return { label: "Zu kurz", color: COLORS.error };
    if (newPassword.length < 12) return { label: "Mittel", color: COLORS.gold };
    return { label: "Stark", color: COLORS.cta };
  })();

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Passwort ändern</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Wähle ein sicheres Passwort mit mindestens 8 Zeichen.
            </Text>
          </View>

          {/* Aktuelles Passwort */}
          <Text style={styles.fieldLabel}>Aktuelles Passwort</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={oldPassword}
              onChangeText={setOldPassword}
              placeholder="Aktuelles Passwort"
              placeholderTextColor={COLORS.tertiary}
              secureTextEntry={!showOld}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowOld((v) => !v)}
            >
              <Text style={styles.eyeText}>{showOld ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Neues Passwort */}
          <Text style={styles.fieldLabel}>Neues Passwort</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="Mindestens 8 Zeichen"
              placeholderTextColor={COLORS.tertiary}
              secureTextEntry={!showNew}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowNew((v) => !v)}
            >
              <Text style={styles.eyeText}>{showNew ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Passwortstärke */}
          {newPasswordStrength && (
            <View style={styles.strengthRow}>
              <View style={styles.strengthTrack}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      backgroundColor: newPasswordStrength.color,
                      width:
                        newPasswordStrength.label === "Zu kurz"
                          ? "33%"
                          : newPasswordStrength.label === "Mittel"
                          ? "66%"
                          : "100%",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.strengthLabel, { color: newPasswordStrength.color }]}>
                {newPasswordStrength.label}
              </Text>
            </View>
          )}

          {/* Passwort bestätigen */}
          <Text style={[styles.fieldLabel, { marginTop: 8 }]}>Passwort bestätigen</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.inputFlex}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Passwort wiederholen"
              placeholderTextColor={COLORS.tertiary}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowConfirm((v) => !v)}
            >
              <Text style={styles.eyeText}>{showConfirm ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Match-Indikator */}
          {confirmPassword.length > 0 && (
            <Text
              style={[
                styles.matchText,
                { color: newPassword === confirmPassword ? COLORS.cta : COLORS.error },
              ]}
            >
              {newPassword === confirmPassword
                ? "✓ Passwörter stimmen überein"
                : "✗ Passwörter stimmen nicht überein"}
            </Text>
          )}

          {/* Sicherheitshinweis */}
          <View style={styles.tipCard}>
            <Text style={styles.tipTitle}>Tipps für ein sicheres Passwort</Text>
            <Text style={styles.tipText}>• Verwende Buchstaben, Zahlen und Sonderzeichen</Text>
            <Text style={styles.tipText}>• Vermeide Geburtsdatum oder Namen</Text>
            <Text style={styles.tipText}>• Nutze ein einzigartiges Passwort für diesen Dienst</Text>
          </View>

          {/* Speichern */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Wird geändert..." : "Passwort ändern"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { flex: 1 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  infoBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 6,
    padding: 12,
    marginBottom: 14,
  },
  infoText: { color: "#1e40af", fontSize: 13 },
  fieldLabel: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    marginBottom: 10,
    overflow: "hidden",
    height: 42,
  },
  inputFlex: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: COLORS.primary,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  eyeText: { fontSize: 18 },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 9999,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  strengthFill: { height: "100%", borderRadius: 9999 },
  strengthLabel: { fontSize: 12, fontWeight: "600", minWidth: 50 },
  matchText: { fontSize: 13, fontWeight: "500", marginBottom: 16 },
  tipCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 12,
    marginTop: 6,
    marginBottom: 16,
  },
  tipTitle: { fontWeight: "700", color: COLORS.primary, fontSize: 12, marginBottom: 6 },
  tipText: { color: COLORS.secondary, fontSize: 12, lineHeight: 18 },
  saveButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  cancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelButtonText: { color: COLORS.secondary, fontWeight: "500", fontSize: 14 },
});
