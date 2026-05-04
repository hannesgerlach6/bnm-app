import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { BNMInput } from "../../components/BNMInput";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, SHADOWS, SEMANTIC, sem } from "../../constants/Colors";
import { BNMLogo } from "../../components/BNMLogo";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const isDesktop = isWeb && width >= 768;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  // ── DEBUG: Keyboard-Diagnose (TEMPORÄR – nach Fix entfernen) ──────────────
  const [dbgKbHeight, setDbgKbHeight] = useState(0);
  const [dbgKbVisible, setDbgKbVisible] = useState(false);
  const [dbgScrollH, setDbgScrollH] = useState(0);
  const [dbgKavH, setDbgKavH] = useState(0);
  const { height: winHeight } = useWindowDimensions();
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", (e) => {
      setDbgKbHeight(Math.round(e.endCoordinates.height));
      setDbgKbVisible(true);
    });
    const hide = Keyboard.addListener("keyboardDidHide", () => {
      setDbgKbHeight(0);
      setDbgKbVisible(false);
    });
    return () => { show.remove(); hide.remove(); };
  }, []);
  // ── END DEBUG ─────────────────────────────────────────────────────────────

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
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      onLayout={(e) => setDbgKavH(Math.round(e.nativeEvent.layout.height))}
    >
      {/* ── DEBUG OVERLAY (TEMPORÄR) ── */}
      {Platform.OS !== "web" && (
        <View style={styles.dbgOverlay} pointerEvents="none">
          <Text style={styles.dbgText}>win:{Math.round(winHeight)} kav:{dbgKavH}</Text>
          <Text style={styles.dbgText}>insets t:{Math.round(insets.top)} b:{Math.round(insets.bottom)}</Text>
          <Text style={styles.dbgText}>kvOffset:{Math.round(insets.top)}</Text>
          <Text style={[styles.dbgText, dbgKbVisible && styles.dbgHighlight]}>
            kb:{dbgKbHeight}px {dbgKbVisible ? "▲OPEN" : "▼closed"}
          </Text>
          <Text style={styles.dbgText}>scroll:{dbgScrollH}</Text>
        </View>
      )}
      {/* ── END DEBUG ── */}
      <ScrollView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        contentContainerStyle={[{ flexGrow: 1, paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }, isDesktop && styles.desktopCenter]}
        keyboardShouldPersistTaps="handled"
        onLayout={(e) => setDbgScrollH(Math.round(e.nativeEvent.layout.height))}
      >
        {/* Desktop: Card-Wrapper */}
        <View style={isDesktop ? [styles.desktopCard, { backgroundColor: themeColors.card }, SHADOWS.lg] : undefined}>
          {/* Header mit Logo */}
          <View style={[styles.header, isDesktop && styles.headerDesktop]}>
            <BNMLogo size={isDesktop ? 120 : 100} showSubtitle={false} />
            <View style={styles.goldDivider} />
          </View>

          {/* Formular */}
          <View style={[styles.formContainer, isDesktop && styles.formContainerDesktop]}>
            <Text style={[styles.welcomeTitle, { color: themeColors.text }]}>{t("login.title")}</Text>
            <Text style={[styles.welcomeSubtitle, { color: themeColors.textSecondary }]}>{t("login.subtitle")}</Text>

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

            {errorMsg ? (
              <View style={[styles.errorBox, { backgroundColor: sem(SEMANTIC.redBg, isDark), borderColor: sem(SEMANTIC.redBorder, isDark) }]}>
                <Ionicons name="alert-circle-outline" size={16} color={sem(SEMANTIC.redText, isDark)} />
                <Text style={[styles.errorText, { color: sem(SEMANTIC.redText, isDark) }]}>{errorMsg}</Text>
              </View>
            ) : null}

            <BNMPressable
              style={styles.forgotPasswordRow}
              onPress={() => router.push("/(auth)/forgot-password")}
              accessibilityRole="link"
              accessibilityLabel={t("login.forgotPassword")}
            >
              <Text style={[styles.forgotPasswordText, { color: themeColors.link }]}>{t("login.forgotPassword")}</Text>
            </BNMPressable>

            <BNMPressable
              style={styles.loginButton}
              onPress={handleLogin}
              disabled={loggingIn}
              accessibilityRole="button"
              accessibilityLabel={t("login.submit")}
              accessibilityState={{ disabled: loggingIn }}
            >
              {loggingIn ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.loginButtonText}>{t("login.submit")}</Text>
              )}
            </BNMPressable>

            <BNMPressable
              style={[styles.publicRegisterButton, { borderColor: themeColors.border }]}
              onPress={() => router.push("/(auth)/register-public")}
              accessibilityRole="button"
              accessibilityLabel={t("login.publicRegister")}
            >
              <Text style={[styles.publicRegisterText, { color: themeColors.text }]}>{t("login.publicRegister")}</Text>
            </BNMPressable>

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
                <BNMPressable onPress={() => router.push("/legal/datenschutz")} accessibilityRole="link" accessibilityLabel="Datenschutzerklärung">
                  <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>Datenschutz</Text>
                </BNMPressable>
                <Text style={[styles.loginFooterSep, { color: themeColors.textTertiary }]}>·</Text>
                <BNMPressable onPress={() => router.push("/legal/impressum")} accessibilityRole="link" accessibilityLabel="Impressum">
                  <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>Impressum</Text>
                </BNMPressable>
                <Text style={[styles.loginFooterSep, { color: themeColors.textTertiary }]}>·</Text>
                <BNMPressable onPress={() => router.push("/legal/agb")} accessibilityRole="link" accessibilityLabel="Allgemeine Geschäftsbedingungen">
                  <Text style={[styles.loginFooterLink, { color: themeColors.link }]}>AGB</Text>
                </BNMPressable>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  // DEBUG (TEMPORÄR)
  dbgOverlay: {
    position: "absolute", top: 50, right: 8, zIndex: 9999,
    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 6, padding: 6, gap: 2,
  },
  dbgText: { color: "#00FF88", fontSize: 11, fontFamily: "monospace" },
  dbgHighlight: { color: "#FFD700" },
  // END DEBUG

  // ─── Desktop ───
  desktopCenter: {
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
    paddingHorizontal: 32,
  },
  desktopCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  headerDesktop: {
    paddingTop: 40,
  },
  formContainerDesktop: {
    paddingHorizontal: 36,
    paddingBottom: 36,
  },

  // ─── Header ───
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  logoTitle: {
    fontSize: 28,
    fontWeight: "800",
    marginTop: 10,
    marginBottom: 4,
    letterSpacing: 3,
  },
  logoSubtitle: {
    fontSize: 13,
    textAlign: "center",
  },
  goldDivider: {
    marginTop: 16,
    width: 48,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },

  // ─── Form ───
  formContainer: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 32,
    ...(Platform.OS === "web" ? {
      maxWidth: 460,
      width: "100%",
      alignSelf: "center" as const,
    } : {}),
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 14,
    marginBottom: 28,
    lineHeight: 20,
  },
  errorBox: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
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
    marginBottom: 16,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "500",
  },
  loginButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
    minHeight: 52,
    justifyContent: "center",
    shadowColor: COLORS.gradientStart,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
    borderWidth: 1.5,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
    minHeight: 50,
    justifyContent: "center",
  },
  publicRegisterText: {
    fontSize: 14,
    fontWeight: "600",
  },
  linkText: {
    fontSize: 13,
  },
  loginFooter: {
    alignItems: "center",
    marginTop: 32,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.08)",
  },
  loginFooterPartner: { fontSize: 11, marginBottom: 8, textAlign: "center" },
  loginFooterLinks: { flexDirection: "row", alignItems: "center", gap: 6 },
  loginFooterLink: { fontSize: 11 },
  loginFooterSep: { fontSize: 11 },
});
