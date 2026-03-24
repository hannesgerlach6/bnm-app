import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Linking,
  Alert,
} from "react-native";
import { showSuccess } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLanguage, type Language } from "../contexts/LanguageContext";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

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
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const [pushEnabled, setPushEnabled] = useState(true);
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";

  async function handleDeleteAccount() {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(t("settings.deleteTitle"), t("settings.deleteConfirm"), [
        { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
        { text: t("common.confirm"), onPress: () => resolve(true) },
      ]);
    });
    if (ok) {
      showSuccess(t("settings.accountDeleted"), logout);
    }
  }

  function handleSupportMail() {
    Linking.openURL("mailto:support@iman.ngo");
  }

  function handleWebsite() {
    Linking.openURL("https://iman.ngo");
  }

  function handleLanguageSelect(lang: Language) {
    setLanguage(lang);
  }

  return (
    <Container>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("common.back")}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("settings.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Sektion: Benachrichtigungen */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.notifications")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={[styles.toggleTitle, { color: themeColors.text }]}>{t("settings.pushNotifications")}</Text>
                <Text style={[styles.toggleSubtitle, { color: themeColors.textTertiary }]}>{t("settings.pushSubtitle")}</Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: themeColors.border, true: COLORS.cta }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>

          {/* Sektion: Admin-Einstellungen */}
          {isAdminOrOffice && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.title")}</Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Text style={[styles.toggleTitle, { color: themeColors.text }]}>{t("settings.showMentorOfMonth")}</Text>
                    <Text style={[styles.toggleSubtitle, { color: themeColors.textTertiary }]}>{t("settings.mentorOfMonthDesc")}</Text>
                  </View>
                  <Switch
                    value={mentorOfMonthVisible}
                    onValueChange={toggleMentorOfMonth}
                    trackColor={{ false: themeColors.border, true: COLORS.gold }}
                    thumbColor={COLORS.white}
                  />
                </View>
              </View>
            </>
          )}

          {/* Sektion: Sprache */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.language")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {LANGUAGES.map((lang, idx) => (
              <TouchableOpacity
                key={lang.key}
                style={[
                  styles.languageRow,
                  idx < LANGUAGES.length - 1 && [styles.languageRowBorder, { borderBottomColor: themeColors.border }],
                  language === lang.key && styles.languageRowActive,
                ]}
                onPress={() => handleLanguageSelect(lang.key)}
                activeOpacity={0.7}
              >
                <View style={styles.languageLabelGroup}>
                  <Text style={[
                    styles.languageLabel,
                    { color: themeColors.text },
                    language === lang.key && styles.languageLabelSelected,
                  ]}>
                    {lang.native}
                  </Text>
                  {/* RTL-Hinweis für Arabisch */}
                  {lang.key === "ar" && language !== "ar" && (
                    <Text style={[styles.rtlHint, { color: themeColors.textTertiary }]}>{t("settings.rtlHint")}</Text>
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
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.aboutBNM")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.infoRow, styles.rowBorder, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.version")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.text }]}>1.0.0</Text>
            </View>
            <TouchableOpacity
              style={[styles.infoRow, styles.rowBorder, { borderBottomColor: themeColors.border }]}
              onPress={handleSupportMail}
            >
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.support")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.link }]}>
                support@iman.ngo
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleWebsite}
            >
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.website")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.link }]}>
                iman.ngo ↗
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sektion: Datenschutz */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.privacy")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>{t("settings.privacyText1")}</Text>
            <View style={[styles.privacyDivider, { backgroundColor: themeColors.border }]} />
            <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>{t("settings.privacyText2")}</Text>
          </View>

          <Text style={[styles.footerText, { color: themeColors.textTertiary }]}>{t("settings.footer")}</Text>
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
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
  toggleTitle: { fontWeight: "600", fontSize: 14 },
  toggleSubtitle: { fontSize: 12, marginTop: 1 },
  languageRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  languageRowBorder: {
    borderBottomWidth: 1,
  },
  languageRowActive: {
    backgroundColor: "rgba(238,167,27,0.06)",
  },
  languageLabelGroup: { flex: 1 },
  languageLabel: { fontSize: 14 },
  languageLabelSelected: { fontWeight: "600", color: COLORS.gradientStart },
  rtlHint: {
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
  },
  infoLabel: { fontSize: 13 },
  infoValue: { fontSize: 13, fontWeight: "500" },
  privacyText: {
    fontSize: 13,
    lineHeight: 19,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  privacyDivider: {
    height: 1,
    marginHorizontal: 16,
  },
  deleteButton: {
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 20,
  },
  deleteButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 14 },
  footerText: {
    fontSize: 12,
    textAlign: "center",
  },
});
