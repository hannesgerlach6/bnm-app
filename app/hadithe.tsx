import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/Colors";
import { MOCK_HADITHE } from "../data/mockData";

export default function HaditheScreen() {
  const router = useRouter();

  // "Hadith des Tages" basierend auf aktuellem Datum (modulo Anzahl)
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const todayHadithIndex = dayOfYear % MOCK_HADITHE.length;
  const todayHadith = MOCK_HADITHE[todayHadithIndex];

  // Alle anderen Hadithe (außer dem heutigen)
  const otherHadithe = useMemo(() => {
    return MOCK_HADITHE.filter((_, idx) => idx !== todayHadithIndex);
  }, [todayHadithIndex]);

  function handleShare(text: string, quelle: string) {
    Alert.alert(
      "Teilen",
      `"${text}"\n\n— ${quelle}\n\n(Teilen-Funktion wird in einer späteren Version verfügbar sein)`,
      [{ text: "OK" }]
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Header */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={styles.backArrow}>‹</Text>
          <Text style={styles.backText}>Zurück</Text>
        </TouchableOpacity>

        <Text style={styles.pageTitle}>Hadithe & Motivationstexte</Text>
        <Text style={styles.pageSubtitle}>
          Tägliche Inspiration für deinen Weg
        </Text>

        {/* Hadith des Tages */}
        <View style={styles.todayCard}>
          <View style={styles.todayHeader}>
            <Text style={styles.todayStar}>★</Text>
            <Text style={styles.todayLabel}>Hadith des Tages</Text>
          </View>
          <Text style={styles.todayText}>"{todayHadith.text}"</Text>
          <Text style={styles.todayQuelle}>— {todayHadith.quelle}</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={() => handleShare(todayHadith.text, todayHadith.quelle)}
          >
            <Text style={styles.shareButtonText}>Teilen</Text>
          </TouchableOpacity>
        </View>

        {/* Weitere Hadithe */}
        <Text style={styles.sectionLabel}>{"WEITERE HADITHE"}</Text>
        {otherHadithe.map((hadith, idx) => (
          <View key={idx} style={styles.hadithCard}>
            <Text style={styles.hadithText}>"{hadith.text}"</Text>
            <View style={styles.hadithFooter}>
              <Text style={styles.hadithQuelle}>— {hadith.quelle}</Text>
              <TouchableOpacity
                style={styles.hadithShareButton}
                onPress={() => handleShare(hadith.text, hadith.quelle)}
              >
                <Text style={styles.hadithShareText}>Teilen</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 24 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backArrow: { color: COLORS.primary, fontSize: 24, marginRight: 4 },
  backText: { color: COLORS.primary, fontWeight: "600", fontSize: 16 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 14, marginBottom: 24 },

  todayCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
  },
  todayHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  todayStar: { color: COLORS.gold, fontSize: 20, marginRight: 8 },
  todayLabel: { color: COLORS.white, fontWeight: "bold", fontSize: 14, opacity: 0.9 },
  todayText: {
    color: COLORS.white,
    fontSize: 17,
    lineHeight: 26,
    fontStyle: "italic",
    marginBottom: 16,
  },
  todayQuelle: { color: COLORS.white, opacity: 0.7, fontSize: 13, marginBottom: 20 },
  shareButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  shareButtonText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },

  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },

  hadithCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  hadithText: {
    color: COLORS.primary,
    fontSize: 14,
    lineHeight: 22,
    fontStyle: "italic",
    marginBottom: 12,
  },
  hadithFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
  },
  hadithQuelle: { color: COLORS.tertiary, fontSize: 12 },
  hadithShareButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hadithShareText: { color: COLORS.secondary, fontSize: 12, fontWeight: "600" },
});
