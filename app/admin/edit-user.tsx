import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS, RADIUS } from "../../constants/Colors";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";
import { BNMInput } from "../../components/BNMInput";
import { useThemeColors } from "../../contexts/ThemeContext";
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
  const [showResetModal, setShowResetModal] = useState(false);
  const [customPassword, setCustomPassword] = useState("");
  const [forceChange, setForceChange] = useState(true);
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
      showError(t("common.error"));
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

  function handleResetPassword() {
    setCustomPassword("BNM-" + Math.floor(100000 + Math.random() * 900000));
    setShowResetModal(true);
  }

  async function confirmResetPassword() {
    if (customPassword.length < 6) {
      showError(t("editUser.resetPasswordTooShort"));
      return;
    }
    setShowResetModal(false);
    setIsResetting(true);
    try {
      const { error } = await supabase.rpc("admin_reset_user_password", {
        target_user_id: userId,
        new_password: customPassword,
      });
      if (error) {
        showError(t("editUser.resetPasswordError") + ": " + error.message);
        return;
      }
      // Flag setzen damit User nach Login zum PW-Ändern aufgefordert wird (nur wenn Häkchen gesetzt)
      await supabase.from("profiles").update({ force_password_change: forceChange }).eq("id", userId);
      // E-Mail mit neuem Passwort senden
      await sendCredentialsEmail(target.email, target.name, customPassword);
      // PW im Modal anzeigen (Fallback falls E-Mail fehlschlägt)
      setResetTempPw(customPassword);
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
        behavior="padding"
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="link" accessibilityLabel="Zurueck">
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>{t("editUser.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("editUser.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>

          {/* Gesperrt-Badge */}
          {isBlocked && (
            <View style={[styles.blockedBanner, { backgroundColor: themeColors.errorLight, borderColor: themeColors.error + "40" }]}>
              <Text style={[styles.blockedBannerText, { color: themeColors.error }]}>⚠ {t("editUser.blocked")}</Text>
            </View>
          )}

          {/* Profil-Avatar */}
          <View style={[styles.avatarRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.avatarCircle, { backgroundColor: themeColors.primary }]}>
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

          <BNMInput label={t("editUser.name")} value={name} onChangeText={setName} error={errors.name} />

          <BNMInput label={t("editUser.city")} value={city} onChangeText={setCity} error={errors.city} />

          <BNMInput label={t("editUser.age")} value={age} onChangeText={setAge} keyboardType="numeric" error={errors.age} />

          <BNMInput label={t("editUser.phone")} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

          {/* Geschlecht */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("editUser.gender").toUpperCase()}</Text>
          <View style={styles.pillRow}>
            {(["male", "female"] as Gender[]).map((g) => (
              <BNMPressable
                key={g}
                accessibilityRole="radio"
                accessibilityLabel={g === "male" ? "Maennlich" : "Weiblich"}
                accessibilityState={{ checked: gender === g }}
                style={[
                  styles.pill,
                  gender === g
                    ? g === "male"
                      ? { backgroundColor: themeColors.primary, borderColor: themeColors.primary }
                      : { backgroundColor: "#7e22ce", borderColor: "#7e22ce" }
                    : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setGender(g)}
              >
                <Text style={[styles.pillText, gender === g ? { color: COLORS.white } : [styles.pillTextInactive, { color: themeColors.textSecondary }]]}>
                  {g === "male" ? t("editUser.male") : t("editUser.female")}
                </Text>
              </BNMPressable>
            ))}
          </View>

          {/* Rolle */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("editUser.role").toUpperCase()}</Text>
          <View style={styles.pillRow}>
            {ROLES.map(({ key, labelKey }) => (
              <BNMPressable
                key={key}
                accessibilityRole="radio"
                accessibilityLabel={t(labelKey)}
                accessibilityState={{ checked: role === key }}
                style={[
                  styles.pill,
                  role === key ? { backgroundColor: themeColors.primary, borderColor: themeColors.primary } : [styles.pillInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setRole(key)}
              >
                <Text style={[styles.pillText, role === key ? { color: COLORS.white } : [styles.pillTextInactive, { color: themeColors.textSecondary }]]}>
                  {t(labelKey)}
                </Text>
              </BNMPressable>
            ))}
          </View>

          {/* Speichern */}
          <BNMPressable
            hapticStyle="success"
            style={[styles.saveButton, { backgroundColor: themeColors.success }, isSaving ? { opacity: 0.6 } : {}]}
            onPress={handleSave}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel="Speichern"
          >
            <Text style={[styles.saveButtonText, { color: COLORS.white }]}>
              {isSaving ? t("editUser.saving") : t("editUser.save")}
            </Text>
          </BNMPressable>

          {/* User sperren / entsperren */}
          <BNMPressable
            hapticStyle="warning"
            accessibilityRole="button"
            accessibilityLabel={isBlocked ? "Entsperren" : "Sperren"}
            style={[
              styles.blockButton,
              { backgroundColor: themeColors.errorLight, borderColor: themeColors.error + "40" },
              isBlocked ? { backgroundColor: themeColors.successLight, borderColor: themeColors.success + "40" } : {},
              isBlocking ? { opacity: 0.6 } : {},
            ]}
            onPress={handleToggleBlock}
            disabled={isBlocking}
          >
            <Text style={[styles.blockButtonText, { color: themeColors.error }, isBlocked ? { color: themeColors.success } : {}]}>
              {isBlocking ? "..." : isBlocked ? t("editUser.unblockUser") : t("editUser.blockUser")}
            </Text>
          </BNMPressable>

          {/* Passwort zurücksetzen — nur Admin */}
          <BNMPressable
            style={[styles.resetPwButton, { borderColor: themeColors.info + "40", backgroundColor: themeColors.infoLight }, isResetting ? { opacity: 0.6 } : {}]}
            onPress={handleResetPassword}
            disabled={isResetting}
            accessibilityRole="button"
            accessibilityLabel="Passwort zuruecksetzen"
          >
            <Text style={[styles.resetPwButtonText, { color: themeColors.info }]}>
              {isResetting ? t("editUser.resetting") : t("editUser.resetPassword")}
            </Text>
          </BNMPressable>

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Modal: PW wählen */}
      <Modal visible={showResetModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("editUser.resetPasswordTitle")}</Text>
            <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>
              {t("editUser.resetPasswordChoose")}
            </Text>
            <TextInput
              style={[styles.pwInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.elevated }]}
              value={customPassword}
              onChangeText={setCustomPassword}
              placeholder="Neues Passwort"
              placeholderTextColor={themeColors.textTertiary}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <BNMPressable
              style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 14 }}
              onPress={() => setForceChange((v) => !v)}
              disableHover
              accessibilityRole="checkbox"
              accessibilityLabel="Passwortaenderung erzwingen"
              accessibilityState={{ checked: forceChange }}
            >
              <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: forceChange ? themeColors.primary : themeColors.border, backgroundColor: forceChange ? themeColors.primary : "transparent", alignItems: "center", justifyContent: "center" }}>
                {forceChange && <Text style={{ color: COLORS.white, fontSize: 14, fontWeight: "700" }}>✓</Text>}
              </View>
              <Text style={{ color: themeColors.text, fontSize: 13, flex: 1 }}>{t("editUser.forcePasswordChange")}</Text>
            </BNMPressable>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 16 }}>
              <BNMPressable style={[styles.modalClose, { flex: 1, backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border }]} onPress={() => setShowResetModal(false)} accessibilityRole="button" accessibilityLabel="Abbrechen">
                <Text style={[styles.modalCloseText, { color: themeColors.textSecondary }]}>{t("common.cancel")}</Text>
              </BNMPressable>
              <BNMPressable style={[styles.modalClose, { flex: 1, backgroundColor: themeColors.primary }]} onPress={confirmResetPassword} accessibilityRole="button" accessibilityLabel="Passwort zuruecksetzen bestaetigen">
                <Text style={[styles.modalCloseText, { color: COLORS.white }]}>{t("editUser.resetPasswordConfirm")}</Text>
              </BNMPressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal: Temp-PW anzeigen (Fallback falls E-Mail fehlschlägt) */}
      <Modal visible={resetTempPw !== null} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("editUser.resetPasswordDoneTitle")}</Text>
            <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>
              {t("editUser.resetPasswordDoneText")}
            </Text>
            <View style={[styles.pwBox, { backgroundColor: themeColors.successLight, borderColor: themeColors.success + "40" }]}>
              <Text style={[styles.pwValue, { color: themeColors.success }]}>{resetTempPw}</Text>
            </View>
            <Text style={[styles.modalHint, { color: themeColors.textTertiary }]}>
              {t("editUser.resetPasswordEmailHint").replace("{0}", target.email)}
            </Text>
            <BNMPressable style={[styles.modalClose, { backgroundColor: themeColors.primary }]} onPress={() => setResetTempPw(null)} accessibilityRole="button" accessibilityLabel="OK">
              <Text style={[styles.modalCloseText, { color: COLORS.white }]}>{t("common.ok")}</Text>
            </BNMPressable>
          </View>
        </View>
      </Modal>

    </Container>
  );
}


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
    borderRadius: RADIUS.sm,
    padding: 12,
    marginBottom: 16,
    alignItems: "center",
  },
  blockedBannerText: { fontWeight: "700", fontSize: 14 },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
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
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  pillInactive: {},
  pillText: { fontSize: 13, fontWeight: "500" },
  pillTextInactive: {},
  saveButton: {
    borderRadius: RADIUS.xs,
    paddingVertical: 11,
    alignItems: "center",
    marginBottom: 12,
    marginTop: 8,
  },
  saveButtonText: { fontWeight: "700", fontSize: 15 },
  blockButton: {
    borderWidth: 1,
    borderRadius: RADIUS.xs,
    paddingVertical: 11,
    alignItems: "center",
  },
  blockButtonText: { fontWeight: "600", fontSize: 14 },
  resetPwButton: {
    borderWidth: 1,
    borderRadius: RADIUS.xs,
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
    borderRadius: RADIUS.lg,
    padding: 24,
    width: "100%",
    maxWidth: 420,
  },
  modalTitle: { fontWeight: "800", fontSize: 17, marginBottom: 8 },
  modalBody: { fontSize: 14, marginBottom: 16, lineHeight: 20 },
  pwBox: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  pwValue: { fontSize: 22, fontWeight: "800", letterSpacing: 2 },
  pwInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 12,
    fontSize: 16,
    fontWeight: "600",
    marginTop: 8,
  },
  modalHint: { fontSize: 12, marginBottom: 20, lineHeight: 18 },
  modalClose: {
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseText: { fontWeight: "600", fontSize: 14 },
});
