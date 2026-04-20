import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";

function Section({ title, children, themeColors }: { title: string; children: React.ReactNode; themeColors: any }) {
  return (
    <View style={[sectionStyles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <Text style={[sectionStyles.title, { color: themeColors.text }]}>{title}</Text>
      {children}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  card: { borderRadius: RADIUS.md, padding: 16, borderWidth: 1 },
  title: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
});

export default function DatenschutzScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { t } = useLanguage();

  const P = ({ children, style }: { children: React.ReactNode; style?: any }) => (
    <Text style={[styles.paragraph, { color: themeColors.textSecondary }, style]}>{children}</Text>
  );

  return (
    <Container>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("common.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Datenschutz</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          <Section title="1. Verantwortliche Stelle" themeColors={themeColors}>
            <P>
              Verantwortlicher für die Datenverarbeitung in dieser App im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:{"\n\n"}
              Verein IMAN{"\n"}
              Simmeringer Hauptstraße 24{"\n"}
              1110 Wien, Österreich{"\n"}
              E-Mail: office@neuemuslime.com{"\n"}
              Telefon: +43 664 99644265
            </P>
          </Section>

          <Section title="2. Welche Daten wir erheben" themeColors={themeColors}>
            <P>Im Rahmen der BNM-App verarbeiten wir folgende personenbezogene Daten:</P>
            <P style={{ marginTop: 8 }}>
              • Registrierungsdaten: Name, E-Mail-Adresse, Geschlecht{"\n"}
              • Profildaten: Profilbild, bevorzugte Sprache, Kontaktpräferenz{"\n"}
              • Mentoring-Daten: Zuweisungen, Sitzungsprotokolle, Fortschrittsdaten{"\n"}
              • Kommunikation: Chat-Nachrichten zwischen Mentor und Mentee{"\n"}
              • Feedback: Antworten auf Feedback-Fragebögen{"\n"}
              • Technische Daten: Gerätetyp, App-Version, Push-Token (für Benachrichtigungen)
            </P>
          </Section>

          <Section title="3. Rechtsgrundlagen (Art. 6 DSGVO)" themeColors={themeColors}>
            <P>
              • Vertragserfüllung (Art. 6 Abs. 1 lit. b): Bereitstellung des Mentoring-Programms, Kontoverwaltung{"\n"}
              • Einwilligung (Art. 6 Abs. 1 lit. a): Push-Benachrichtigungen, optionale Profilangaben{"\n"}
              • Berechtigtes Interesse (Art. 6 Abs. 1 lit. f): Sicherheit der App, Missbrauchsprävention, anonymisierte Statistiken
            </P>
          </Section>

          <Section title="4. Zwecke der Verarbeitung" themeColors={themeColors}>
            <P>
              • Bereitstellung und Verwaltung des Mentoring-Programms{"\n"}
              • Kommunikation zwischen Mentoren und Mentees{"\n"}
              • Fortschrittsdokumentation und Qualitätssicherung{"\n"}
              • Benachrichtigungen über relevante Ereignisse{"\n"}
              • Verbesserung des Angebots und anonyme Auswertungen
            </P>
          </Section>

          <Section title="5. Auftragsverarbeiter und Dienste" themeColors={themeColors}>
            <P>Wir setzen folgende Drittanbieter ein:</P>
            <P style={{ marginTop: 8, fontWeight: "600", color: themeColors.text }}>Supabase Inc.</P>
            <P>
              Hosting der Datenbank, Authentifizierung, Echtzeit-Kommunikation und Dateispeicherung.{"\n"}
              Serverstandort: EU (Frankfurt){"\n"}
              Rechtsgrundlage für Drittlandtransfer: EU-Standardvertragsklauseln (SCCs)
            </P>
            <P style={{ marginTop: 8, fontWeight: "600", color: themeColors.text }}>Resend Inc.</P>
            <P>
              Versand von System-E-Mails (z.B. Passwort zurücksetzen).{"\n"}
              Sitz: USA{"\n"}
              Rechtsgrundlage für Drittlandtransfer: EU-Standardvertragsklauseln (SCCs)
            </P>
            <P style={{ marginTop: 8, fontWeight: "600", color: themeColors.text }}>Expo (EAS)</P>
            <P>
              Push-Benachrichtigungen und App-Bereitstellung.{"\n"}
              Sitz: USA{"\n"}
              Rechtsgrundlage für Drittlandtransfer: EU-Standardvertragsklauseln (SCCs)
            </P>
          </Section>

          <Section title="6. Speicherdauer" themeColors={themeColors}>
            <P>
              • Kontodaten: Für die Dauer der Teilnahme am Mentoring-Programm, danach Löschung innerhalb von 30 Tagen nach Kontolöschung{"\n"}
              • Chat-Nachrichten: Für die Dauer der Betreuung, danach 6 Monate Aufbewahrung{"\n"}
              • Sitzungsprotokolle: Bis 12 Monate nach Abschluss der Betreuung{"\n"}
              • Feedback-Daten: Anonymisiert nach Programmende, personenbezogene Daten werden gelöscht{"\n"}
              • Technische Logs: Maximal 90 Tage
            </P>
          </Section>

          <Section title="7. Deine Rechte" themeColors={themeColors}>
            <P>Du hast folgende Rechte bezüglich deiner personenbezogenen Daten:</P>
            <P style={{ marginTop: 8 }}>
              • Auskunft (Art. 15 DSGVO): Welche Daten wir über dich speichern{"\n"}
              • Berichtigung (Art. 16 DSGVO): Korrektur unrichtiger Daten{"\n"}
              • Löschung (Art. 17 DSGVO): Löschung deiner Daten (z.B. über die Konto-löschen-Funktion in der App){"\n"}
              • Einschränkung (Art. 18 DSGVO): Einschränkung der Verarbeitung{"\n"}
              • Datenübertragbarkeit (Art. 20 DSGVO): Erhalt deiner Daten in maschinenlesbarem Format{"\n"}
              • Widerspruch (Art. 21 DSGVO): Widerspruch gegen die Verarbeitung{"\n"}
              • Widerruf der Einwilligung: Jederzeit möglich, ohne dass die Rechtmäßigkeit der vorherigen Verarbeitung berührt wird
            </P>
            <P style={{ marginTop: 8 }}>
              Kontakt: datenschutz@neuemuslime.com
            </P>
          </Section>

          <Section title="8. Beschwerderecht" themeColors={themeColors}>
            <P>
              Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren, wenn du der Meinung bist, dass die Verarbeitung deiner Daten gegen die DSGVO verstößt.
            </P>
            <P style={{ marginTop: 8 }}>
              Zuständige Behörde:{"\n"}
              Österreichische Datenschutzbehörde{"\n"}
              Barichgasse 40-42{"\n"}
              1030 Wien{"\n"}
              dsb@dsb.gv.at
            </P>
            <P style={{ marginTop: 8 }}>
              Webseite: https://www.dsb.gv.at
            </P>
          </Section>

          <Section title="9. Datensicherheit" themeColors={themeColors}>
            <P>
              Wir setzen technische und organisatorische Maßnahmen ein, um deine Daten zu schützen:{"\n\n"}
              • Verschlüsselte Datenübertragung (TLS/SSL){"\n"}
              • Row Level Security (RLS) in der Datenbank – Nutzer sehen nur ihre eigenen Daten{"\n"}
              • Geschlechtertrennung: Mentoren sehen nur Mentees des gleichen Geschlechts{"\n"}
              • Regelmäßige Sicherheitsüberprüfungen
            </P>
          </Section>

          <Section title="10. Änderungen dieser Erklärung" themeColors={themeColors}>
            <P>
              Wir behalten uns vor, diese Datenschutzerklärung zu aktualisieren. Die aktuelle Version ist stets in der App abrufbar. Bei wesentlichen Änderungen informieren wir dich über die App.
            </P>
            <P style={{ marginTop: 8, fontStyle: "italic" }}>
              Stand: April 2026
            </P>
          </Section>

          <View style={{ height: 40 }} />
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
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 18, fontWeight: "700", textAlign: "center", flex: 2 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 16 },
  paragraph: { fontSize: 14, lineHeight: 22 },
});
