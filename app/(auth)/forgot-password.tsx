import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { COLORS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../../lib/supabase";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleReset() {
    if (!email.trim()) {
      setErrorMsg(t("forgotPassword.errorEmpty"));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(email.trim())) {
      setErrorMsg(t("forgotPassword.errorInvalid"));
      return;
    }

    setErrorMsg("");
    setIsLoading(true);
    try {
      // Reset-E-Mail über eigene Edge Function senden (statt Supabase Built-in Mailer,
      // der auf 3 E-Mails/Stunde limitiert ist im Free Plan).
      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email: email.trim() }),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setErrorMsg(data.error ?? t("forgotPassword.errorUnexpected"));
      } else {
        setSent(true);
      }
    } catch {
      setErrorMsg(t("forgotPassword.errorUnexpected"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex1, { backgroundColor: themeColors.background }]}
      behavior="padding"
    >
      <ScrollView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          {/* Icon */}
          <View style={styles.iconBox}>
            <Text style={styles.iconText}>🔑</Text>
          </View>

          <Text style={[styles.title, { color: themeColors.text }]}>{t("forgotPassword.title")}</Text>
          <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
            {t("forgotPassword.subtitle")}
          </Text>

          {sent ? (
            /* Erfolgs-State */
            <View style={[styles.successBox, {
              backgroundColor: sem(SEMANTIC.greenBg, isDark),
              borderColor: isDark ? "#2d6a4a" : "#bbf7d0",
            }]}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={[styles.successTitle, { color: sem(SEMANTIC.greenText, isDark) }]}>{t("forgotPassword.successTitle")}</Text>
              <Text style={[styles.successText, { color: isDark ? "#6ee7b7" : "#166534" }]}>
                {t("forgotPassword.successText").replace("{0}", email.trim())}
              </Text>
              <BNMPressable
                style={styles.backButton}
                onPress={() => router.replace("/(auth)/login")}
              >
                <Text style={styles.backButtonText}>{t("forgotPassword.backToLogin")}</Text>
              </BNMPressable>
            </View>
          ) : (
            /* Formular */
            <>
              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("forgotPassword.emailLabel")}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errorMsg ? styles.inputError : { borderColor: themeColors.border }]}
                placeholder="deine@email.de"
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  if (errorMsg) setErrorMsg("");
                }}
              />

              {errorMsg ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{errorMsg}</Text>
                </View>
              ) : null}

              <BNMPressable
                style={[styles.submitButton, isLoading && { opacity: 0.6 }]}
                onPress={handleReset}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitButtonText}>{t("forgotPassword.submit")}</Text>
                )}
              </BNMPressable>

              <BNMPressable
                style={[styles.cancelButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                onPress={() => router.back()}
              >
                <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>{t("forgotPassword.backToLogin")}</Text>
              </BNMPressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  iconBox: {
    alignItems: "center",
    marginBottom: 20,
  },
  iconText: { fontSize: 48 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.primary,
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    color: COLORS.secondary,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 28,
  },
  fieldLabel: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  inputError: { borderColor: COLORS.errorBorder },
  errorBox: {
    backgroundColor: COLORS.errorBg,
    borderWidth: 1,
    borderColor: COLORS.errorBorderLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: { color: COLORS.error, fontSize: 13 },
  submitButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  submitButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  cancelButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelButtonText: { fontWeight: "500", fontSize: 14 },
  successBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: "center",
  },
  successIcon: {
    fontSize: 36,
    color: COLORS.cta,
    fontWeight: "800",
    marginBottom: 12,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  backButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
});
