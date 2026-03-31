import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Linking,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";
import { BNMLogo } from "../../components/BNMLogo";

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAs, isLoading } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t("login.errorEmpty"));
      return;
    }
    setErrorMsg("");
    const success = await login(email.trim(), password);
    if (!success) {
      setErrorMsg(t("login.errorInvalid"));
    }
  }

  async function handleQuickLogin(role: UserRole) {
    setErrorMsg("");
    const result = await loginAs(role);
    if (!result.success) {
      setErrorMsg(result.error ?? t("login.errorFailed"));
    }
  }

  async function handleQuickOffice() {
    setErrorMsg("");
    const result = await loginAs("office");
    if (!result.success) {
      setErrorMsg(result.error ?? t("login.errorFailed"));
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex1, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hero Header */}
        <View style={styles.header}>
          <BNMLogo size={72} showSubtitle={false} />
          <Text style={styles.logoTitle}>BNM</Text>
          <Text style={styles.logoSubtitle}>{t("login.appSubtitle")}</Text>
          <View style={styles.goldDivider} />
        </View>

        {/* Login-Formular */}
        <View style={styles.formContainer}>
          <Text style={[styles.welcomeTitle, { color: themeColors.text }]}>{t("login.title")}</Text>
          <Text style={[styles.welcomeSubtitle, { color: themeColors.textSecondary }]}>{t("login.subtitle")}</Text>

          {/* E-Mail */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("login.email")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
            placeholder="deine@email.de"
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            accessibilityLabel={t("login.email")}
          />

          {/* Passwort */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("login.password")}</Text>
          <View style={[styles.passwordRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <TextInput
              style={[styles.passwordInput, { color: themeColors.text }]}
              placeholder={t("login.password")}
              placeholderTextColor={themeColors.textTertiary}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
              accessibilityLabel={t("login.password")}
            />
            <BNMPressable
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Passwort verbergen" : "Passwort anzeigen"}
            >
              <Ionicons
                name={showPassword ? "eye-outline" : "eye-off-outline"}
                size={20}
                color={themeColors.textSecondary}
              />
            </BNMPressable>
          </View>

          {/* Fehlermeldung */}
          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}>
              <Text style={[styles.errorText, { color: isDark ? "#f87171" : "#dc2626" }]}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Passwort vergessen */}
          <BNMPressable
            style={styles.forgotPasswordRow}
            onPress={() => router.push("/(auth)/forgot-password")}
            accessibilityRole="link"
            accessibilityLabel={t("login.forgotPassword")}
          >
            <Text style={[styles.forgotPasswordText, { color: themeColors.link }]}>{t("login.forgotPassword")}</Text>
          </BNMPressable>

          {/* Login-Button */}
          <BNMPressable
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
            accessibilityRole="button"
            accessibilityLabel={t("login.submit")}
            accessibilityState={{ disabled: isLoading }}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>{t("login.submit")}</Text>
            )}
          </BNMPressable>

          {/* Registrierungs-CTA */}
          <BNMPressable
            style={styles.publicRegisterButton}
            onPress={() => router.push("/(auth)/register-public")}
            accessibilityRole="button"
            accessibilityLabel={t("login.publicRegister")}
          >
            <Text style={[styles.publicRegisterText, { color: themeColors.text }]}>{t("login.publicRegister")}</Text>
          </BNMPressable>

          {/* Mentor-Bewerbung */}
          <View style={styles.registerRow}>
            <BNMPressable
              onPress={() => router.push("/(auth)/register-mentor")}
              accessibilityRole="link"
              accessibilityLabel={t("login.registerMentor")}
            >
              <Text style={[styles.linkText, { color: themeColors.textTertiary }]}>{t("login.registerMentor")}</Text>
            </BNMPressable>
          </View>

          {/* Footer */}
          <View style={styles.loginFooter}>
            <Text style={[styles.loginFooterPartner, { color: themeColors.textTertiary }]}>
              Ein iERA Projekt in Kooperation mit IMAN
            </Text>
            <View style={styles.loginFooterLinks}>
              <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/datenschutzerklaerung/")} accessibilityRole="link" accessibilityLabel="Datenschutzerklärung">
                <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>Datenschutz</Text>
              </BNMPressable>
              <Text style={[styles.loginFooterSep, { color: themeColors.textTertiary }]}>·</Text>
              <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/impressum/")} accessibilityRole="link" accessibilityLabel="Impressum">
                <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>Impressum</Text>
              </BNMPressable>
              <Text style={[styles.loginFooterSep, { color: themeColors.textTertiary }]}>·</Text>
              <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/agb/")} accessibilityRole="link" accessibilityLabel="Allgemeine Geschäftsbedingungen">
                <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>AGB</Text>
              </BNMPressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  header: {
    backgroundColor: COLORS.gradientStart,
    paddingTop: 52,
    paddingBottom: 32,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoTitle: {
    color: COLORS.white,
    fontSize: 28,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 3,
  },
  logoSubtitle: {
    color: COLORS.white,
    opacity: 0.75,
    fontSize: 13,
    textAlign: "center",
  },
  goldDivider: {
    marginTop: 18,
    width: 48,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 32,
    // Auf Web: Formular auf max. 480px begrenzen und zentrieren
    ...(Platform.OS === "web" ? {
      maxWidth: 480,
      width: "100%",
      alignSelf: "center" as const,
    } : {}),
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 8 : 10,
    marginBottom: 10,
    fontSize: 14,
    minHeight: 44,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    overflow: "hidden",
    minHeight: 44,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  eyeText: { fontSize: 18 },
  errorBox: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  forgotPasswordText: {
    fontSize: 13,
  },
  loginButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 12,
    paddingVertical: Platform.OS === "web" ? 9 : 10,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 44,
    justifyContent: "center",
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  publicRegisterButton: {
    backgroundColor: "rgba(238,167,27,0.10)",
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
    minHeight: 44,
    justifyContent: "center",
  },
  publicRegisterText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  linkText: {
    color: COLORS.link,
    fontSize: 13,
  },
  divider: {
    color: COLORS.tertiary,
    fontSize: 13,
  },
  quickSection: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 16,
    marginBottom: 28,
  },
  quickLabel: {
    color: COLORS.tertiary,
    fontSize: 10,
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: 1,
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickButtonText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "500",
  },
  loginFooter: {
    alignItems: "center",
    marginTop: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  loginFooterPartner: { fontSize: 11, marginBottom: 8, textAlign: "center" },
  loginFooterLinks: { flexDirection: "row", alignItems: "center", gap: 6 },
  loginFooterLink: { fontSize: 11 },
  loginFooterSep: { fontSize: 11 },
});
