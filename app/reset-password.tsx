import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";
import { showError, showSuccess } from "../lib/errorHandler";
import { useThemeColors } from "../contexts/ThemeContext";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  // Supabase sendet den Token per URL-Fragment: #access_token=...&type=recovery
  // Auf Web liest Supabase JS Client das automatisch aus dem Hash.
  // Auf Native muss der Deep-Link via expo-linking geparst werden.
  // Da dieser Screen primär über den Browser-Link aufgerufen wird (Web-App),
  // hört der Supabase-Client automatisch auf den onAuthStateChange-Event.
  useEffect(() => {
    if (Platform.OS !== "web") return;

    // Supabase JS Client liest auf Web automatisch den Hash aus der URL
    // und setzt die Session. Wir müssen nur warten.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        // Session wurde gesetzt — Formular ist bereit
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  function validate(): string | null {
    if (newPassword.length < 8) return t("resetPassword.errorTooShort");
    if (newPassword !== confirmPassword) return t("resetPassword.errorMatch");
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showError(t("resetPassword.errorFailed"));
        return;
      }

      setIsDone(true);
      showSuccess(t("resetPassword.successTitle"), () => {
        router.replace("/(auth)/login");
      });
    } catch {
      showError(t("resetPassword.errorFailed"));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>{t("resetPassword.title")}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t("resetPassword.subtitle")}</Text>

        {isDone ? (
          <View style={styles.successBox}>
            <Text style={styles.successTitle}>{t("resetPassword.successTitle")}</Text>
            <Text style={styles.successText}>{t("resetPassword.successText")}</Text>
          </View>
        ) : (
          <>
            {/* Neues Passwort */}
            <Text style={[styles.label, { color: themeColors.text }]}>{t("resetPassword.newPassword")}</Text>
            <View style={[styles.inputRow, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder={t("resetPassword.passwordPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                secureTextEntry={!showNew}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowNew((v) => !v)}
              >
                <Text style={[styles.eyeText, { color: themeColors.link }]}>
                  {showNew ? t("resetPassword.hide") : t("resetPassword.show")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Passwort bestätigen */}
            <Text style={[styles.label, { color: themeColors.text }]}>{t("resetPassword.confirmPassword")}</Text>
            <View style={[styles.inputRow, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}>
              <TextInput
                style={[styles.input, { color: themeColors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder={t("resetPassword.confirmPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowConfirm((v) => !v)}
              >
                <Text style={[styles.eyeText, { color: themeColors.link }]}>
                  {showConfirm ? t("resetPassword.hide") : t("resetPassword.show")}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Passwort-Match-Indikator */}
            {confirmPassword.length > 0 && (
              <Text
                style={[
                  styles.matchHint,
                  newPassword === confirmPassword
                    ? { color: COLORS.cta }
                    : { color: COLORS.error },
                ]}
              >
                {newPassword === confirmPassword
                  ? "✓ Passwörter stimmen überein"
                  : "✗ Passwörter stimmen nicht überein"}
              </Text>
            )}

            <TouchableOpacity
              style={[
                styles.submitButton,
                isSubmitting ? styles.submitButtonDisabled : {},
              ]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              <Text style={styles.submitButtonText}>
                {isSubmitting
                  ? t("resetPassword.submitting")
                  : t("resetPassword.submit")}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          style={styles.backLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[styles.backLinkText, { color: themeColors.link }]}>{t("resetPassword.backToLogin")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 24,
    width: "100%",
    maxWidth: 440,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
  },
  input: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: {
    fontSize: 13,
    fontWeight: "500",
  },
  matchHint: {
    fontSize: 13,
    marginBottom: 16,
    marginTop: -8,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 15,
  },
  successBox: {
    backgroundColor: "#dcfce7",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  successTitle: {
    color: "#15803d",
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 8,
  },
  successText: {
    color: "#166534",
    fontSize: 14,
    textAlign: "center",
  },
  backLink: {
    alignItems: "center",
    paddingVertical: 8,
  },
  backLinkText: {
    fontSize: 14,
  },
});
