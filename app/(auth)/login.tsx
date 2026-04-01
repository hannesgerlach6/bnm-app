import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Linking,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { BNMInput } from "../../components/BNMInput";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS } from "../../constants/Colors";
import { BNMLogo } from "../../components/BNMLogo";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password.trim()) {
      setErrorMsg(t("login.errorEmpty"));
      return;
    }
    setErrorMsg("");
    setLoggingIn(true);
    const result = await login(email.trim(), password);
    setLoggingIn(false);
    if (result === "banned") {
      setErrorMsg(t("login.errorBanned"));
    } else if (result !== "ok") {
      setErrorMsg(t("login.errorInvalid"));
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
          <BNMInput
            label={t("login.email")}
            icon="mail-outline"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel={t("login.email")}
          />

          {/* Passwort */}
          <BNMInput
            label={t("login.password")}
            icon="lock-closed-outline"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            rightIcon={showPassword ? "eye-outline" : "eye-off-outline"}
            onRightIconPress={() => setShowPassword((v) => !v)}
            accessibilityLabel={t("login.password")}
          />

          {/* Fehlermeldung */}
          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: isDark ? "#2D0808" : "#FEF2F2", borderColor: isDark ? "#7a2a2a" : "#FECACA" }]}>
              <Ionicons name="alert-circle-outline" size={16} color={isDark ? "#F87171" : "#DC2626"} />
              <Text style={[styles.errorText, { color: isDark ? "#F87171" : "#DC2626" }]}>{errorMsg}</Text>
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
            disabled={loggingIn}
            accessibilityRole="button"
            accessibilityLabel={t("login.submit")}
            accessibilityState={{ disabled: loggingIn }}
          >
            {loggingIn ? (
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
    paddingTop: 60,
    paddingBottom: 40,
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
    marginTop: 20,
    width: 64,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },
  formContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 32,
    ...(Platform.OS === "web" ? {
      maxWidth: 480,
      width: "100%",
      alignSelf: "center" as const,
    } : {}),
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    marginBottom: 24,
    lineHeight: 20,
  },
  // Legacy — unused after BNMInput migration (kept for reference)
  eyeText: { fontSize: 18 },
  errorBox: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  forgotPasswordRow: {
    alignItems: "flex-end",
    marginBottom: 12,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 52,
    justifyContent: "center",
    // Blauer Schatten für mehr Tiefe
    shadowColor: COLORS.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  loginButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  registerRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 12,
  },
  publicRegisterButton: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
    minHeight: 50,
    justifyContent: "center",
  },
  publicRegisterText: {
    color: COLORS.primary,
    fontSize: 14,
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
    borderRadius: RADIUS.md,
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
