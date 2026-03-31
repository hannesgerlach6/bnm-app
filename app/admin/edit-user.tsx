import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { sendCredentialsEmail } from "../../lib/emailService";
import type { UserRole, Gender } from "../../types";

const ROLES: { key: UserRole; labelKey: "editUser.roleMentor" | "editUser.roleMentee" | "editUser.roleAdmin" | "editUser.roleOffice" }[] = [
  { key: "mentor", labelKey: "editUser.roleMentor" },
  { key: "mentee", labelKey: "editUser.roleMentee" },
  { key: "admin", labelKey: "editUser.roleAdmin" },
  { key: "office", labelKey: "editUser.roleOffice" },
];

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { getUserById, updateUser, setUserActive } = useData();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const target = getUserById(id);

  // Nur Admin/Office darf bearbeiten
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "office")) {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.center, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.denied, { color: themeColors.error }]}>{t("editUser.accessDenied")}</Text>
        </View>
      </Container>
    );
  }

  if (!target) {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.center, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.denied, { color: themeColors.error }]}>{t("editUser.notFound")}</Text>
        </View>
      </Container>
    );
  }

  return <EditUserForm userId={id} />;
}

function EditUserForm({ userId }: { userId: string }) {
  const router = useRouter();
  const { getUserById, updateUser, setUserActive } = useData();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const target = getUserById(userId)!;

  const [name, setName] = useState(target.name);
  const [city, setCity] = useState(target.city);
  const [age, setAge] = useState(String(target.age));
  const [phone, setPhone] = useState(target.phone ?? "");
  const [role, setRole] = useState<UserRole>(target.role);
  const [gender, setGender] = useState<Gender>(target.gender);
  const [isSaving, setIsSaving] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetTempPw, setResetTempPw] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isBlocked = target.is_active === false;

  function validate(): boolean {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = t("editUser.errorName");
    if (!city.trim()) newErrors.city = t("editUser.errorCity");
    const ageNum = parseInt(age, 10);
    if (!age || isNaN(ageNum) || ageNum < 12 || ageNum > 120) {
      newErrors.age = t("editUser.errorAge");
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setIsSaving(true);
    try {
      await updateUser(userId, {
        name: name.trim(),
        city: city.trim(),
        age: parseInt(age, 10),
        phone: phone.trim() || undefined,
        role,
        gender,
      });
      showSuccess(t("editUser.successMsg"), () => router.back());
    } catch {
      showError(t("editUser.errorName"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleToggleBlock() {
    const confirmTitle = isBlocked ? t("editUser.unblockTitle") : t("editUser.blockTitle");
    const confirmText = isBlocked
      ? t("editUser.unblockText").replace("{0}", target.name)
      : t("editUser.blockText").replace("{0}", target.name);

    const ok = await showConfirm(confirmTitle, confirmText);
    if (!ok) return;

    setIsBlocking(true);
    try {
      await setUserActive(userId, isBlocked);
      showSuccess(isBlocked ? t("editUser.unblockSuccess") : t("editUser.blockSuccess"));
    } catch {
      showError(t("common.error"));
    } finally {
      setIsBlocking(false);
    }
  }

  async function handleResetPassword() {
    const ok = await showConfirm(
      t("editUser.resetPasswordTitle"),
      t("editUser.resetPasswordText").replace("{0}", target.name)
    );
    if (!ok) return;

    const tempPassword = "BNM-" + Math.floor(100000 + Math.random() * 900000);
    setIsResetting(true);
    try {
      const { error } = await supabase.rpc("admin_reset_user_password", {
        target_user_id: userId,
        new_password: tempPassword,
      });
      if (error) {
        showError(t("editUser.resetPasswordError") + ": " + error.message);
        return;
      }
      // E-Mail mit neuem Passwort senden (geht an Override-Adresse)
      await sendCredentialsEmail(target.email, target.name, tempPassword);
      // Temp-PW im Modal anzeigen (Fallback falls E-Mail fehlschlägt)
      setResetTempPw(tempPassword);
    } catch (e: any) {
      showError(t("editUser.resetPasswordError") + (e?.message ? ": " + e.message : ""));
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>{t("editUser.back")}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("editUser.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>

          {/* Gesperrt-Badge */}
          {isBlocked && (
            <View style={[styles.blockedBanner, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}>
              <Text style={[styles.blockedBannerText, { color: isDark ? "#f87171" : "#b91c1c" }]}>⚠ {t("editUser.blocked")}</Text>
            </View>
          )}

          {/* Profil-Avatar */}
          <View style={[styles.avatarRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>
                {target.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </Text>
            </View>
            <View>
              <Text style={[styles.avatarName, { color: themeColors.text }]}>{target.name}</Text>
              <Text style={[styles.avatarEmail, { color: themeColors.textSecondary }]}>{target.email}</Text>
            </View>
          </View>

          {/* Formular */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("editUser.profileDataLabel")}</Text>

          <FormField label={t("editUser.name")} error={errors.name}>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }, errors.name ? styles.inputError : {}]}
              value={name}
              onChangeText={setName}
              placeholder={t("editUser.namePlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
            />
          </FormField>

          <FormField label={t("editUser.city")} error={errors.city}>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }, errors.city ? styles.inputError : {}]}
              value={city}
              onChangeText={setCity}
              placeholder={t("editUser.cityPlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
            />
          </FormField>

          <FormField label={t("editUser.age")} error={errors.age}>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }, errors.age ? styles.inputError : {}]}
              value={age}
              onChangeText={setAge}
              placeholder={t("editUser.agePlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="numeric"
            />
          </FormField>

          <FormField label={t("editUser.phone")}>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
              value={phone}
              onChangeText={setPhone}
              placeholder="+49 ..."
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="phone-pad"
            />
          </FormField>

          {/* Geschlecht */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("editUser.gender").toUpperCase()}</Text>
          <View style={styles.pillRow}>
            {(["male", "female"] as Gender[]).map((g) => (
              <TouchableOpacity
                key={g}
                style={[
                  styles.pill,
                  gender === g
                    ? g === "male"
                      ? styles.pillActiveMale
                      : styles.pillActiveFemale
                    : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.pillText, gender === g ? styles.pillTextActive : [styles.pillTextInactive, { color: themeColors.textSecondary }]]}>
                  {g === "male" ? t("editUser.male") : t("editUser.female")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Rolle */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("editUser.role").toUpperCase()}</Text>
          <View style={styles.pillRow}>
            {ROLES.map(({ key, labelKey }) => (
              <TouchableOpacity
                key={key}
                style={[
                  styles.pill,
                  role === key ? styles.pillActiveRole : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setRole(key)}
              >
                <Text style={[styles.pillText, role === key ? styles.pillTextActive : [styles.pillTextInactive, { color: themeColors.textSecondary }]]}>
                  {t(labelKey)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Speichern */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving ? { opacity: 0.6 } : {}]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? t("editUser.saving") : t("editUser.save")}
            </Text>
          </TouchableOpacity>

          {/* User sperren / entsperren */}
          <TouchableOpacity
            style={[
              styles.blockButton,
              { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2", borderColor: isDark ? "#7a2a2a" : "#fecaca" },
              isBlocked ? { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7", borderColor: isDark ? "#2d6a4a" : "#86efac" } : {},
              isBlocking ? { opacity: 0.6 } : {},
            ]}
            onPress={handleToggleBlock}
            disabled={isBlocking}
          >
            <Text style={[styles.blockButtonText, { color: isDark ? "#f87171" : "#b91c1c" }, isBlocked ? { color: isDark ? "#4ade80" : "#15803d" } : {}]}>
              {isBlocking ? "..." : isBlocked ? t("editUser.unblockUser") : t("editUser.blockUser")}
            </Text>
          </TouchableOpacity>

          {/* Passwort zurücksetzen — nur Admin */}
          <TouchableOpacity
            style={[styles.resetPwButton, { borderColor: isDark ? "#2d4a7a" : "#bfdbfe", backgroundColor: isDark ? "#1e2d4a" : "#eff6ff" }, isResetting ? { opacity: 0.6 } : {}]}
            onPress={handleResetPassword}
            disabled={isResetting}
          >
            <Text style={[styles.resetPwButtonText, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>
              {isResetting ? t("editUser.resetting") : t("editUser.resetPassword")}
            </Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: Temp-PW anzeigen (Fallback falls E-Mail fehlschlägt) */}
      <Modal visible={resetTempPw !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("editUser.resetPasswordDoneTitle")}</Text>
            <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>
              {t("editUser.resetPasswordDoneText")}
            </Text>
            <View style={[styles.pwBox, { backgroundColor: isDark ? "#1a2a1a" : "#f0fdf4", borderColor: isDark ? "#2d6a4a" : "#86efac" }]}>
              <Text style={[styles.pwValue, { color: isDark ? "#4ade80" : "#15803d" }]}>{resetTempPw}</Text>
            </View>
            <Text style={[styles.modalHint, { color: themeColors.textTertiary }]}>
              {t("editUser.resetPasswordEmailHint").replace("{0}", target.email)}
            </Text>
            <TouchableOpacity style={styles.modalClose} onPress={() => setResetTempPw(null)}>
              <Text style={styles.modalCloseText}>{t("common.ok")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </Container>
  );
}

function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  const themeColors = useThemeColors();
  return (
    <View style={fieldStyles.container}>
      <Text style={[fieldStyles.label, { color: themeColors.textSecondary }]}>{label}</Text>
      {children}
      {error ? <Text style={fieldStyles.error}>{error}</Text> : null}
    </View>
  );
}

const fieldStyles = StyleSheet.create({
  container: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: "500", marginBottom: 4 },
  error: { color: COLORS.error, fontSize: 12, marginTop: 4 },
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  denied: { textAlign: "center", fontSize: 14 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backBtn: { flex: 1 },
  backBtnText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  blockedBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  blockedBannerText: { fontWeight: "700", fontSize: 14 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.white, fontWeight: "bold", fontSize: 18 },
  avatarName: { fontWeight: "700", fontSize: 16 },
  avatarEmail: { fontSize: 12, marginTop: 2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
  },
  inputError: { borderColor: COLORS.error },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillActiveMale: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  pillActiveFemale: { backgroundColor: "#7e22ce", borderColor: "#7e22ce" },
  pillActiveRole: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  pillInactive: {},
  pillText: { fontSize: 13, fontWeight: "500" },
  pillTextActive: { color: COLORS.white },
  pillTextInactive: {},
  saveButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  saveButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  blockButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
  },
  blockButtonText: { fontWeight: "600", fontSize: 14 },
  unblockButton: {},
  unblockButtonText: {},
  resetPwButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 10,
  },
  resetPwButtonText: { fontWeight: "600", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: { fontWeight: "800", fontSize: 17, marginBottom: 8 },
  modalBody: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  pwBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  pwValue: { fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  modalHint: { fontSize: 12, marginBottom: 20, lineHeight: 18 },
  modalClose: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
});
