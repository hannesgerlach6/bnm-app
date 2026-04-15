import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { BNMPressable } from "../components/BNMPressable";
import { useRouter, useLocalSearchParams } from "expo-router";
import { supabase } from "../lib/supabase";
import { COLORS, RADIUS, SEMANTIC, sem } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";
import { showError, showSuccess } from "../lib/errorHandler";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const params = useLocalSearchParams<{ token?: string; email?: string }>();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState(false);

  // Token aus URL verifizieren und Session setzen
  useEffect(() => {
    async function verifyToken() {
      // Variante 1: Token + Email als Query-Parameter (von unserer Edge Function)
      if (params.token && params.email) {
        const { error } = await supabase.auth.verifyOtp({
          email: params.email,
          token: params.token,
          type: "recovery",
        });
        if (error) {
          setVerifyError(true);
          setIsVerifying(false);
          return;
        }
        // Session wurde gesetzt → force_password_change setzen damit
        // NavigationGuard zu /change-password weiterleitet (statt Dashboard)
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("profiles").update({ force_password_change: true }).eq("id", user.id);
        }
        // NavigationGuard übernimmt die Weiterleitung zu /change-password
        setIsVerifying(false);
        return;
      }

      // Variante 2: Supabase liest den Hash automatisch (#access_token=...)
      if (Platform.OS === "web" && window.location.hash.includes("access_token")) {
        // Supabase JS Client verarbeitet das automatisch
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
          if (event === "PASSWORD_RECOVERY") {
            setIsVerifying(false);
          }
        });
        // Timeout falls kein Event kommt
        setTimeout(() => setIsVerifying(false), 5000);
        return () => subscription.unsubscribe();
      }

      // Kein Token gefunden
      setIsVerifying(false);
    }
    verifyToken();
  }, [params.token, params.email]);

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
    let success = false;
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showError(t("resetPassword.errorFailed"));
        return;
      }
      success = true;
    } catch {
      showError(t("resetPassword.errorFailed"));
    } finally {
      setIsSubmitting(false);
    }
    if (success) {
      setIsDone(true);
      showSuccess(t("resetPassword.successTitle"));
      router.replace("/(auth)/login");
    }
  }

  return (
    <ScrollView style={[styles.scroll, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.container}>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.title, { color: themeColors.text }]}>{t("resetPassword.title")}</Text>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>{t("resetPassword.subtitle")}</Text>

        {isVerifying ? (
          <View style={{ alignItems: "center", padding: 32 }}>
            <ActivityIndicator size="large" color={COLORS.gold} />
            <Text style={{ color: themeColors.textSecondary, marginTop: 12 }}>{t("common.loading")}</Text>
          </View>
        ) : verifyError ? (
          <View style={[styles.successBox, { backgroundColor: sem(SEMANTIC.redBg, isDark) }]}>
            <Text style={[styles.successTitle, { color: sem(SEMANTIC.redText, isDark) }]}>{t("resetPassword.errorExpired")}</Text>
            <Text style={[styles.successText, { color: sem(SEMANTIC.redText, isDark) }]}>{t("resetPassword.errorExpiredText")}</Text>
            <BNMPressable style={[styles.submitBtn, { backgroundColor: COLORS.gradientStart, marginTop: 16 }]} onPress={() => router.replace("/(auth)/forgot-password")}>
              <Text style={styles.submitText}>{t("resetPassword.requestNewLink")}</Text>
            </BNMPressable>
            <BNMPressable style={[styles.submitBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: themeColors.border, marginTop: 8 }]} onPress={() => router.replace("/(auth)/login")}>
              <Text style={[styles.submitText, { color: themeColors.textSecondary }]}>{t("resetPassword.backToLogin")}</Text>
            </BNMPressable>
          </View>
        ) : isDone ? (
          <View style={[styles.successBox, {
            backgroundColor: sem(SEMANTIC.greenBg, isDark),
          }]}>
            <Text style={[styles.successTitle, { color: sem(SEMANTIC.greenText, isDark) }]}>{t("resetPassword.successTitle")}</Text>
            <Text style={[styles.successText, { color: isDark ? "#6ee7b7" : "#166534" }]}>{t("resetPassword.successText")}</Text>
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
              <BNMPressable
                style={styles.eyeButton}
                onPress={() => setShowNew((v) => !v)}
              >
                <Text style={[styles.eyeText, { color: themeColors.link }]}>
                  {showNew ? t("resetPassword.hide") : t("resetPassword.show")}
                </Text>
              </BNMPressable>
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
              <BNMPressable
                style={styles.eyeButton}
                onPress={() => setShowConfirm((v) => !v)}
              >
                <Text style={[styles.eyeText, { color: themeColors.link }]}>
                  {showConfirm ? t("resetPassword.hide") : t("resetPassword.show")}
                </Text>
              </BNMPressable>
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

            <BNMPressable
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
            </BNMPressable>
          </>
        )}

        <BNMPressable
          style={styles.backLink}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={[styles.backLinkText, { color: themeColors.link }]}>{t("resetPassword.backToLogin")}</Text>
        </BNMPressable>
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    width: "100%",
    maxWidth: 440,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
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
    fontWeight: "800",
    fontSize: 15,
  },
  successBox: {
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
    alignItems: "center",
  },
  successTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 8,
  },
  successText: {
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
