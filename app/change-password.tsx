import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { BNMInput } from "../components/BNMInput";
import { BNMPressable } from "../components/BNMPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showError, showSuccess } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { COLORS, RADIUS } from "../constants/Colors";
import { Container } from "../components/Container";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import { supabase } from "../lib/supabase";
import { supabaseAnon } from "../lib/supabaseAnon";

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  function validate(): string | null {
    if (!oldPassword.trim()) return t("changePassword.errorCurrent");
    if (newPassword.length < 8) return t("changePassword.errorTooShort");
    if (newPassword !== confirmPassword) return t("changePassword.errorMatch");
    if (oldPassword === newPassword) return t("changePassword.errorSame");
    return null;
  }

  async function handleSubmit() {
    const err = validate();
    if (err) {
      showError(err);
      return;
    }

    setIsSaving(true);
    try {
      // SECURITY: Altes Passwort verifizieren bevor neues gesetzt wird.
      // supabaseAnon (ohne Session-Persistenz) damit kein Auth-State-Change getriggert wird.
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        showError(t("changePassword.errorFailed"));
        setIsSaving(false);
        return;
      }
      const { error: signInError } = await supabaseAnon.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      });
      if (signInError) {
        showError(t("changePassword.errorCurrent"));
        setIsSaving(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });

      if (updateError) {
        showError(updateError.message);
      } else {
        // force_password_change Flag zurücksetzen
        await supabase.from("profiles").update({ force_password_change: false }).eq("id", user.id);
        showSuccess(t("changePassword.successMsg"), () => router.replace("/(tabs)"));
      }
    } catch (e: unknown) {
      showError(t("changePassword.errorFailed"));
    } finally {
      setIsSaving(false);
    }
  }

  const newPasswordStrength = (() => {
    if (newPassword.length === 0) return null;
    if (newPassword.length < 8) return { label: t("changePassword.strengthTooShort"), color: themeColors.error, widthPct: "33%" as const };
    if (newPassword.length < 12) return { label: t("changePassword.strengthMedium"), color: themeColors.warning, widthPct: "66%" as const };
    return { label: t("changePassword.strengthStrong"), color: themeColors.success, widthPct: "100%" as const };
  })();

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: themeColors.background }]}
        behavior="padding"
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button">
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("changePassword.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("changePassword.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          <View style={[styles.infoBox, { backgroundColor: themeColors.infoLight, borderColor: themeColors.info + "40" }]}>
            <Text style={[styles.infoText, { color: themeColors.info }]}>
              {t("changePassword.info")}
            </Text>
          </View>

          {/* Aktuelles Passwort */}
          <BNMInput
            label={t("changePassword.currentPassword")}
            icon="lock-closed-outline"
            value={oldPassword}
            onChangeText={setOldPassword}
            secureTextEntry={!showOld}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showOld ? "eye-outline" : "eye-off-outline"}
            onRightIconPress={() => setShowOld((v) => !v)}
          />

          {/* Neues Passwort */}
          <BNMInput
            label={t("changePassword.newPassword")}
            icon="lock-open-outline"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry={!showNew}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showNew ? "eye-outline" : "eye-off-outline"}
            onRightIconPress={() => setShowNew((v) => !v)}
          />

          {/* Passwortstärke */}
          {newPasswordStrength && (
            <View style={styles.strengthRow}>
              <View style={[styles.strengthTrack, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                <View
                  style={[
                    styles.strengthFill,
                    {
                      backgroundColor: newPasswordStrength.color,
                      width: newPasswordStrength.widthPct,
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
          <BNMInput
            label={t("changePassword.confirmPassword")}
            icon="lock-closed-outline"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry={!showConfirm}
            autoCapitalize="none"
            autoCorrect={false}
            rightIcon={showConfirm ? "eye-outline" : "eye-off-outline"}
            onRightIconPress={() => setShowConfirm((v) => !v)}
            containerStyle={{ marginTop: 8 }}
          />

          {/* Match-Indikator */}
          {confirmPassword.length > 0 && (
            <Text
              style={[
                styles.matchText,
                { color: newPassword === confirmPassword ? themeColors.success : themeColors.error },
              ]}
            >
              {newPassword === confirmPassword
                ? t("changePassword.matchOk")
                : t("changePassword.matchError")}
            </Text>
          )}

          {/* Sicherheitshinweis */}
          <View style={[styles.tipCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.tipTitle, { color: themeColors.text }]}>{t("changePassword.tipsTitle")}</Text>
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t("changePassword.tip1")}</Text>
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t("changePassword.tip2")}</Text>
            <Text style={[styles.tipText, { color: themeColors.textSecondary }]}>{t("changePassword.tip3")}</Text>
          </View>

          {/* Speichern */}
          <BNMPressable
            style={[styles.saveButton, { backgroundColor: themeColors.success }, isSaving && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSaving}
            hapticStyle="success"
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? t("changePassword.submitting") : t("changePassword.submit")}
            </Text>
          </BNMPressable>

          <BNMPressable style={[styles.cancelButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} onPress={() => router.back()}>
            <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>{t("changePassword.cancel")}</Text>
          </BNMPressable>

        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    // paddingTop wird dynamisch via insets.top + 16 gesetzt
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "800", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  infoBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 14,
  },
  infoText: { fontSize: 13 },
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  strengthTrack: {
    flex: 1,
    height: 6,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    borderWidth: 1,
  },
  strengthFill: { height: "100%", borderRadius: RADIUS.full },
  strengthLabel: { fontSize: 12, fontWeight: "600", minWidth: 50 },
  matchText: { fontSize: 13, fontWeight: "500", marginBottom: 16 },
  tipCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginTop: 6,
    marginBottom: 16,
  },
  tipTitle: { fontWeight: "800", fontSize: 12, marginBottom: 6 },
  tipText: { fontSize: 12, lineHeight: 18 },
  saveButton: {
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  cancelButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelButtonText: { fontWeight: "500", fontSize: 14 },
});
