import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StyleSheet,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

const LANGUAGES = [
  { key: "de", label: "Deutsch" },
  { key: "tr", label: "Türkçe" },
  { key: "ar", label: "العربية" },
  { key: "en", label: "English" },
] as const;

type LanguageKey = (typeof LANGUAGES)[number]["key"];

export default function SettingsScreen() {
  const router = useRouter();
  const { logout } = useAuth();

  const [pushEnabled, setPushEnabled] = useState(true);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageKey>("de");

  function handleDeleteAccount() {
    Alert.alert(
      "Konto löschen",
      "Bist du sicher? Diese Aktion kann nicht rückgängig gemacht werden. Alle deine Daten werden permanent gelöscht.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Konto löschen",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Konto gelöscht",
              "Dein Konto wurde erfolgreich gelöscht.",
              [{ text: "OK", onPress: logout }]
            );
          },
        },
      ]
    );
  }

  function handleSupportMail() {
    Linking.openURL("mailto:support@bnm-program.de");
  }

  function handleWebsite() {
    Linking.openURL("https://bnm-program.de");
  }

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Einstellungen</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Sektion: Benachrichtigungen */}
          <Text style={styles.sectionLabel}>BENACHRICHTIGUNGEN</Text>
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleInfo}>
                <Text style={styles.toggleTitle}>Push-Benachrichtigungen</Text>
                <Text style={styles.toggleSubtitle}>
                  Erhalte Erinnerungen und Neuigkeiten
                </Text>
              </View>
              <Switch
                value={pushEnabled}
                onValueChange={setPushEnabled}
                trackColor={{ false: COLORS.border, true: COLORS.cta }}
                thumbColor={COLORS.white}
              />
            </View>
          </View>

          {/* Sektion: Sprache */}
          <Text style={styles.sectionLabel}>SPRACHE</Text>
          <View style={styles.card}>
            {LANGUAGES.map((lang, idx) => (
              <TouchableOpacity
                key={lang.key}
                style={[
                  styles.languageRow,
                  idx < LANGUAGES.length - 1 && styles.languageRowBorder,
                ]}
                onPress={() => setSelectedLanguage(lang.key)}
              >
                <Text style={styles.languageLabel}>{lang.label}</Text>
                {selectedLanguage === lang.key && (
                  <View style={styles.checkMark}>
                    <Text style={styles.checkMarkText}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Sektion: Über BNM */}
          <Text style={styles.sectionLabel}>ÜBER BNM</Text>
          <View style={styles.card}>
            <View style={[styles.infoRow, styles.rowBorder]}>
              <Text style={styles.infoLabel}>Version</Text>
              <Text style={styles.infoValue}>1.0.0</Text>
            </View>
            <TouchableOpacity
              style={[styles.infoRow, styles.rowBorder]}
              onPress={handleSupportMail}
            >
              <Text style={styles.infoLabel}>Support</Text>
              <Text style={[styles.infoValue, { color: COLORS.link }]}>
                support@bnm-program.de
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.infoRow}
              onPress={handleWebsite}
            >
              <Text style={styles.infoLabel}>Website</Text>
              <Text style={[styles.infoValue, { color: COLORS.link }]}>
                bnm-program.de ↗
              </Text>
            </TouchableOpacity>
          </View>

          {/* Sektion: Datenschutz */}
          <Text style={styles.sectionLabel}>DATENSCHUTZ</Text>
          <View style={styles.card}>
            <Text style={styles.privacyText}>
              BNM verarbeitet deine Daten ausschließlich zur Verwaltung des
              Mentoring-Programms. Deine Daten werden nicht an Dritte
              weitergegeben und nach Beendigung der Betreuung entsprechend
              der gesetzlichen Aufbewahrungsfristen gelöscht.
            </Text>
            <View style={styles.privacyDivider} />
            <Text style={styles.privacyText}>
              Du hast das Recht auf Auskunft, Berichtigung und Löschung
              deiner gespeicherten Daten. Wende dich bei Fragen an
              datenschutz@bnm-program.de.
            </Text>
          </View>

          {/* Konto löschen */}
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteAccount}
          >
            <Text style={styles.deleteButtonText}>Konto löschen</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>
            BNM – Betreuung neuer Muslime · Version 1.0.0
          </Text>
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
  languageLabel: { color: COLORS.primary, fontSize: 14 },
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
    borderRadius: 6,
    paddingVertical: 10,
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
