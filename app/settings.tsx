import React, { useState, useCallback } from "react";

const PUSH_TOGGLES = [
  {
    key: "push_chat_messages",
    label: "Chat-Nachrichten",
    desc: "Push bei neuen Nachrichten in Mentoring-Chats und Admin-DMs",
  },
  {
    key: "push_assignments",
    label: "Zuweisungen",
    desc: "Push wenn ein Mentor einem Mentee zugewiesen wird",
  },
  {
    key: "push_calendar",
    label: "Kalender-Einladungen & Absagen",
    desc: "Push bei neuen Terminen und wenn jemand absagt",
  },
  {
    key: "push_reminders",
    label: "Erinnerungen",
    desc: "Tägliche Erinnerungen bei fehlenden Sessions",
  },
  {
    key: "push_system",
    label: "System-Benachrichtigungen",
    desc: "Alle sonstigen System-Meldungen (Feedback, Betreuungsabschluss etc.)",
  },
];
import {
  View,
  Text,
  ScrollView,
  Switch,
  StyleSheet,
  Linking,
  Platform,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { BNMPressable } from "../components/BNMPressable";
import { showSuccess, showConfirm, showError } from "../lib/errorHandler";
import { supabase } from "../lib/supabase";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLanguage, type Language } from "../contexts/LanguageContext";
import { COLORS, RADIUS } from "../constants/Colors";
import { Container } from "../components/Container";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import Constants from "expo-constants";

const LANGUAGES: { key: Language; label: string; native: string }[] = [
  { key: "de", label: "Deutsch", native: "Deutsch" },
  { key: "tr", label: "Türkçe", native: "Türkçe" },
  { key: "ar", label: "العربية", native: "العربية" },
  { key: "en", label: "English", native: "English" },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { mentorOfMonthVisible, toggleMentorOfMonth, getPushSetting, togglePushSetting, getSetting } = useData();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const isAdmin = user?.role === "admin";
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";

  // Sentry DSN — aus DB laden, lokal editierbar
  const [sentryDsn, setSentryDsn] = useState<string>(() => getSetting("sentry_dsn") ?? "");
  const [sentryDsnSaving, setSentryDsnSaving] = useState(false);
  const [sentryDsnSaved, setSentryDsnSaved] = useState(false);

  const handleSaveSentryDsn = useCallback(async () => {
    setSentryDsnSaving(true);
    try {
      const trimmed = sentryDsn.trim();
      await supabase
        .from("app_settings")
        .upsert({ key: "sentry_dsn", value: trimmed }, { onConflict: "key" });
      setSentryDsnSaved(true);
      setTimeout(() => setSentryDsnSaved(false), 2500);
    } catch {
      // ignorieren
    } finally {
      setSentryDsnSaving(false);
    }
  }, [sentryDsn]);
  const canDeleteAccount = user?.role === "mentor" || user?.role === "mentee";
  const [deleting, setDeleting] = useState(false);

  async function handleDeleteAccount() {
    const ok = await showConfirm(t("settings.deleteTitle"), t("settings.deleteConfirm"));
    if (!ok) return;

    setDeleting(true);
    try {
      // Intern: Soft-Delete (Deaktivierung), UI: "Konto löschen"
      const { data, error } = await supabase.rpc("deactivate_own_account");
      if (error) throw error;
      if (data === false) throw new Error("Nicht berechtigt");
      showSuccess(t("settings.accountDeleted"), logout);
    } catch (e: any) {
      console.error("deleteAccount error:", e?.message || e);
      showError(t("settings.deleteError"));
    } finally {
      setDeleting(false);
    }
  }

  function handleSupportMail() {
    Linking.openURL("mailto:support@neuemuslime.com");
  }

  function handleWebsite() {
    Linking.openURL("https://neuemuslime.com");
  }

  function handleLanguageSelect(lang: Language) {
    setLanguage(lang);
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="link" accessibilityLabel="Zurück">
            <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("common.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("settings.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

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

          {/* Sektion: Push-Benachrichtigungen (nur Admin) */}
          {isAdmin && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>
                PUSH-BENACHRICHTIGUNGEN
              </Text>
              <Text style={[styles.pushHint, { color: themeColors.textSecondary }]}>
                Hier steuerst du systemweit, welche Arten von Push-Benachrichtigungen an alle Nutzer gesendet werden.
              </Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                {PUSH_TOGGLES.map((pt, idx) => (
                  <React.Fragment key={pt.key}>
                    {idx > 0 && <View style={[styles.divider, { backgroundColor: themeColors.border }]} />}
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleInfo}>
                        <Text style={[styles.toggleTitle, { color: themeColors.text }]}>{pt.label}</Text>
                        <Text style={[styles.toggleSubtitle, { color: themeColors.textTertiary }]}>{pt.desc}</Text>
                      </View>
                      <Switch
                        value={getPushSetting(pt.key)}
                        onValueChange={() => togglePushSetting(pt.key)}
                        trackColor={{ false: themeColors.border, true: COLORS.gold }}
                        thumbColor={COLORS.white}
                      />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </>
          )}

          {/* Sektion: Sentry Crash-Reporting (nur Admin) */}
          {isAdmin && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>
                CRASH-REPORTING (SENTRY)
              </Text>
              <Text style={[styles.pushHint, { color: themeColors.textSecondary }]}>
                Sentry meldet automatisch Abstürze und Fehler. DSN leer lassen um Sentry zu deaktivieren — die App funktioniert in beiden Fällen normal.
              </Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.sentryRow}>
                  <Text style={[styles.toggleTitle, { color: themeColors.text, marginBottom: 6 }]}>
                    Sentry DSN
                  </Text>
                  <TextInput
                    value={sentryDsn}
                    onChangeText={(v) => { setSentryDsn(v); setSentryDsnSaved(false); }}
                    placeholder="https://xxx@oyyy.ingest.sentry.io/zzz"
                    placeholderTextColor={themeColors.textTertiary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.sentryInput, {
                      color: themeColors.text,
                      borderColor: themeColors.border,
                      backgroundColor: themeColors.background,
                    }]}
                  />
                  <BNMPressable
                    style={[
                      styles.sentryButton,
                      { backgroundColor: sentryDsnSaved ? COLORS.cta : COLORS.gradientStart },
                    ]}
                    onPress={handleSaveSentryDsn}
                    disabled={sentryDsnSaving}
                  >
                    {sentryDsnSaving ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <Text style={styles.sentryButtonText}>
                        {sentryDsnSaved ? "✓ Gespeichert" : "Speichern"}
                      </Text>
                    )}
                  </BNMPressable>
                  <Text style={[styles.sentryHint, { color: themeColors.textTertiary }]}>
                    Den DSN findest du in deinem Sentry-Projekt unter Settings → Client Keys.
                    Änderungen werden beim nächsten App-Start aktiv.
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Sektion: Sprache */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.language")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {LANGUAGES.map((lang, idx) => (
              <BNMPressable
                key={lang.key}
                style={[
                  styles.languageRow,
                  idx < LANGUAGES.length - 1 && [styles.languageRowBorder, { borderBottomColor: themeColors.border }],
                  language === lang.key && styles.languageRowActive,
                ]}
                onPress={() => handleLanguageSelect(lang.key)}
                accessibilityRole="button"
                accessibilityLabel={`Sprache ${lang.native} auswählen`}
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
              </BNMPressable>
            ))}
          </View>

          {/* Sektion: Über BNM */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.aboutBNM")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={[styles.infoRow, styles.rowBorder, { borderBottomColor: themeColors.border }]}>
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.version")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.text }]}>{Constants.expoConfig?.version ?? "1.0.0"}</Text>
            </View>
            <BNMPressable
              style={[styles.infoRow, styles.rowBorder, { borderBottomColor: themeColors.border }]}
              onPress={handleSupportMail}
              accessibilityRole="link"
              accessibilityLabel="Support kontaktieren"
            >
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.support")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.link }]}>
                support@neuemuslime.com
              </Text>
            </BNMPressable>
            <BNMPressable
              style={styles.infoRow}
              onPress={handleWebsite}
              accessibilityRole="link"
              accessibilityLabel="Webseite öffnen"
            >
              <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{t("settings.website")}</Text>
              <Text style={[styles.infoValue, { color: themeColors.link }]}>
                neuemuslime.com ↗
              </Text>
            </BNMPressable>
          </View>

          {/* Sektion: Datenschutz */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("settings.privacy")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>{t("settings.privacyText1")}</Text>
            <View style={[styles.privacyDivider, { backgroundColor: themeColors.border }]} />
            <Text style={[styles.privacyText, { color: themeColors.textSecondary }]}>{t("settings.privacyText2")}</Text>
          </View>

          {/* Sektion: Konto löschen (nur Mentor/Mentee) — intern Soft-Delete */}
          {canDeleteAccount && (
            <>
              <Text style={[styles.sectionLabel, { color: COLORS.error, marginTop: 20 }]}>{t("settings.dangerZone")}</Text>
              <BNMPressable
                style={[styles.deleteButton, { borderColor: COLORS.error }]}
                onPress={handleDeleteAccount}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel={t("settings.deleteAccount")}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={COLORS.error} />
                ) : (
                  <Text style={styles.deleteButtonText}>{t("settings.deleteAccount")}</Text>
                )}
              </BNMPressable>
            </>
          )}

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
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 6,
    marginTop: 4,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 14,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
  },
  toggleInfo: { flex: 1, marginRight: 12 },
  toggleTitle: { fontWeight: "600", fontSize: 14 },
  toggleSubtitle: { fontSize: 12, marginTop: 1 },
  divider: { height: 1 },
  pushHint: { fontSize: 12, lineHeight: 17, marginBottom: 10, marginTop: -2 },
  sentryRow: { padding: 16 },
  sentryInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    marginBottom: 10,
  },
  sentryButton: {
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  sentryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  sentryHint: { fontSize: 11, lineHeight: 16 },
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
  languageLabelSelected: { fontWeight: "600", color: COLORS.gold },
  rtlHint: {
    fontSize: 11,
    marginTop: 2,
  },
  checkMark: {
    width: 24,
    height: 24,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMarkText: { color: COLORS.white, fontWeight: "800", fontSize: 13 },
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
    borderRadius: RADIUS.md,
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
