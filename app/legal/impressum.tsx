import React from "react";
import { View, Text, ScrollView, StyleSheet, Linking } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";

export default function ImpressumScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();
  const { t } = useLanguage();

  return (
    <Container>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("common.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>Impressum</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          {/* Anbieter */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Angaben gemäß § 25 MedienG</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              BNM – Betreuung neuer Muslime{"\n"}
              Ein Projekt des Verein IMAN{"\n"}
              {"\n"}
              Verein IMAN{"\n"}
              Simmeringer Hauptstraße 24{"\n"}
              1110 Wien{"\n"}
              Österreich
            </Text>
          </View>

          {/* Vertretung */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Vertreten durch</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              Vertreten durch die IT-Recht Kanzlei
            </Text>
          </View>

          {/* Kontakt */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Kontakt</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              E-Mail: office@neuemuslime.com{"\n"}
              Telefon: +43 664 99644265
            </Text>
          </View>

          {/* Haftung für Inhalte */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Haftung für Inhalte</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.{"\n\n"}
              Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
            </Text>
          </View>

          {/* Haftung für Links */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Haftung für Links</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              Unser Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.{"\n\n"}
              Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
            </Text>
          </View>

          {/* Urheberrecht */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Urheberrecht</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              Die durch die Seitenbetreiber erstellten Inhalte und Werke unterliegen dem Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers.
            </Text>
          </View>

          {/* Streitbeilegung */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Streitbeilegung</Text>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary }]}>
              Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            </Text>
            <BNMPressable onPress={() => Linking.openURL("https://ec.europa.eu/consumers/odr/")}>
              <Text style={[styles.link, { color: themeColors.link }]}>https://ec.europa.eu/consumers/odr/</Text>
            </BNMPressable>
            <Text style={[styles.paragraph, { color: themeColors.textSecondary, marginTop: 8 }]}>
              Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
            </Text>
          </View>

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
  card: {
    borderRadius: RADIUS.md,
    padding: 16,
    borderWidth: 1,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  paragraph: { fontSize: 14, lineHeight: 22 },
  link: { fontSize: 14, textDecorationLine: "underline" },
});
