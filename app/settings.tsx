import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Linking,
} from "react-native";
import { showSuccess, showConfirm } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLanguage, type Language } from "../contexts/LanguageContext";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "de", label: "Deutsch", native: "Deutsch" },
  { key: "tr", label: "Türkçe", native: "Türkçe" },
  { key: "ar", label: "العربية", native: "العربية" },
  { key: "en", label: "English", native: "English" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { mentorOfMonthVisible, toggleMentorOfMonth } = useData();

  const [pushEnabled, setPushEnabled] = useState(true);
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";

  async function handleDeleteAccount() {
    const ok = await showConfirm(t("settings.deleteTitle"), t("settings.deleteConfirm"));
    if (ok) {
      showSuccess(t("settings.accountDeleted"), logout);
    }
  }

  function handleSupportMail() {
    Linking.openURL("mailto:support@bnm-program.de");
  }

  function handleWebsite() {
    Linking.openURL("https://bnm-program.de");
  }

  function handleLanguageSelect(lang: Language) {
    setLanguage(lang);
  }

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ {t("common.back")}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t("settings.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Sektion: Benachrichtigungen */}
          <Text style={styles.sectionLabel}>{t("settings.notifications")}</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>{t("settings.pushNotifications")}</Text>
                <Text style={styles.toggleSubtitle}>{t("settings.pushSubtitle")}</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.cta }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>

          {/* Sektion: Admin-Einstellungen */}
          {isAdminOrOffice && (
            <>
              <Text style={styles.sectionLabel}>{t("settings.title")}</Text>
              <View style={styles.card}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={styles.toggleTitle}>{t("settings.showMentorOfMonth")}</Text>
                    <Text style={styles.toggleSubtitle}>{t("settings.mentorOfMonthDesc")}</Text>
                  </View>
                  <Switch
                    value={mentorOfMonthVisible}
                    onValueChange={toggleMentorOfMonth}
                    trackColor={{ false: COLORS.border, true: COLORS.gold }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </View>
            </>
          )}

          {/* Sektion: Sprache */}
          <Text style={styles.sectionLabel}>{t("settings.language")}</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, idx) => (
              <TouchableOpacity
                key={lang.key}
                style={[
                  styles.languageRow,
                  idx < LANGUAGES.length - 1 && styles.languageRowBorder,
                  language === lang.key && styles.languageRowActive,
                ]}
                onPress={() => handleLanguageSelect(lang.key)}
                activeOpacity={0.7}
              >
                <View style={styles.languageLabelGroup}>
                  <Text style={[
                    styles.languageLabel,
                    language === lang.key && styles.languageLabelSelected,
                  ]}>
                    {lang.native}
                  </Text>
                  {/* RTL-Hinweis für Arabisch */}
                  {lang.key === "ar" && language !== "ar" && (
                    <Text style={styles.rtlHint}>{t("settings.rtlHint")}</Text>
                  )}
                </View>
                {language === lang.key && (
                  <View style={styles.checkMark}>
                    <Text style={styles.checkMarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Sektion: Über BNM */}
          <Text style={styles.sectionLabel}>{t("settings.aboutBNM")}</Text>
          <View style={styles.card}>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>{t("settings.version")}</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <TouchableOpacity
              style={[styles.infoRow, styles.rowBorder]}
              onPress={handleSupportMail}
            >
              <Text style={styles.infoLabel}>{t("settings.support")}</Text>
              <Text style={[styles.infoValue, { color: COLORS.link }]}>
                support@bnm-program.de
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleWebsite}
            >
              <Text style={styles.infoLabel}>{t("settings.website")}</Text>
              <Text style={[styles.infoValue, { color: COLORS.link }]}>
                bnm-program.de ↗
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sektion: Datenschutz */}
          <Text style={styles.sectionLabel}>{t("settings.privacy")}</Text>
          <View style={styles.card}>
            <Text style={styles.privacyText}>{t("settings.privacyText1")}</Text>
            <View style={styles.privacyDivider} />
            <Text style={styles.privacyText}>{t("settings.privacyText2")}</Text>
          </View>

          {/* Konto löschen */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>{t("settings.deleteAccount")}</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>{t("settings.footer")}</Text>
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { flex: 1 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
  },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleTitle: { fontWeight: "600", color: COLORS.primary, fontSize: 14 },
  toggleSubtitle: { color: COLORS.tertiary, fontSize: 12, marginTop: 1 },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  languageRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  languageRowActive: {
    backgroundColor: "rgba(238,167,27,0.06)",
  },
  languageLabelGroup: { flex: 1 },
  languageLabel: { color: COLORS.primary, fontSize: 14 },
  languageLabelSelected: { fontWeight: "600", color: COLORS.gradientStart },
  rtlHint: {
    color: COLORS.tertiary,
    fontSize: 11,
    marginTop: 2,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMarkText: { color: COLORS.white, fontWeight: "bold", fontSize: 13 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  infoLabel: { color: COLORS.secondary, fontSize: 13 },
  infoValue: { color: COLORS.primary, fontSize: 13, fontWeight: "500" },
  privacyText: {
    color: COLORS.secondary,
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyDivider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 16,
  },
  deleteButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 20,
  },
  deleteButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 14 },
  footerText: {
    color: COLORS.tertiary,
    fontSize: 12,
    textAlign: "center",
  },
});
