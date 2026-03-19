import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";
import { BNMLogo } from "../../components/BNMLogo";

export default function LoginScreen() {
  const router = useRouter();
  const { login, loginAs, isLoading } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();

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
            />
            <TouchableOpacity
              style={styles.eyeButton}
              onPress={() => setShowPassword((v) => !v)}
            >
              <Text style={styles.eyeText}>{showPassword ? "🙈" : "👁"}</Text>
            </TouchableOpacity>
          </View>

          {/* Fehlermeldung */}
          {errorMsg ? (
            <View style={[styles.errorBox, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Passwort vergessen */}
          <TouchableOpacity
            style={styles.forgotPasswordRow}
            onPress={() => router.push("/(auth)/forgot-password")}
          >
            <Text style={[styles.forgotPasswordText, { color: themeColors.link }]}>{t("login.forgotPassword")}</Text>
          </TouchableOpacity>

          {/* Login-Button */}
          <TouchableOpacity
            style={styles.loginButton}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.loginButtonText}>{t("login.submit")}</Text>
            )}
          </TouchableOpacity>

          {/* Registrierungs-CTA */}
          <TouchableOpacity
            style={styles.publicRegisterButton}
            onPress={() => router.push("/(auth)/register-public")}
          >
            <Text style={styles.publicRegisterText}>{t("login.publicRegister")}</Text>
          </TouchableOpacity>

          {/* Mentor-Bewerbung */}
          <View style={styles.registerRow}>
            <TouchableOpacity
              onPress={() => router.push("/(auth)/register-mentor")}
            >
              <Text style={[styles.linkText, { color: themeColors.textTertiary }]}>{t("login.registerMentor")}</Text>
            </TouchableOpacity>
          </View>

          {/* Test-Schnellzugang — nur in Development */}
          {__DEV__ && (
            <View style={[styles.quickSection, { borderTopColor: themeColors.border }]}>
              <Text style={[styles.quickLabel, { color: themeColors.textTertiary }]}>{t("login.quickAccess")}</Text>
              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                  onPress={() => handleQuickLogin("admin")}
                >
                  <Text style={[styles.quickButtonText, { color: themeColors.textSecondary }]}>Admin</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                  onPress={() => handleQuickLogin("mentor")}
                >
                  <Text style={[styles.quickButtonText, { color: themeColors.textSecondary }]}>Mentor</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                  onPress={() => handleQuickLogin("mentee")}
                >
                  <Text style={[styles.quickButtonText, { color: themeColors.textSecondary }]}>Mentee</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                  onPress={handleQuickOffice}
                >
                  <Text style={[styles.quickButtonText, { color: themeColors.textSecondary }]}>Office</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
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
    fontWeight: "700",
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
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
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
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 8 : 10,
    marginBottom: 10,
    fontSize: 14,
  },
  passwordRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 6,
    marginBottom: 10,
    overflow: "hidden",
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "web" ? 8 : 10,
    fontSize: 14,
  },
  eyeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  eyeText: { fontSize: 18 },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: "#dc2626",
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
    borderRadius: 5,
    paddingVertical: Platform.OS === "web" ? 9 : 10,
    alignItems: "center",
    marginBottom: 12,
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
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
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
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickButtonText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: "500",
  },
});
