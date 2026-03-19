import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { showSuccess } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { COLORS } from "../constants/Colors";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";

export default function HaditheScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { hadithe, isLoading } = useData();

  // "Hadith des Tages" basierend auf aktuellem Datum (modulo Anzahl)
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const todayHadithIndex = hadithe.length > 0 ? dayOfYear % hadithe.length : 0;
  const todayHadith = hadithe.length > 0 ? hadithe[todayHadithIndex] : null;

  // Alle anderen Hadithe (außer dem heutigen)
  const otherHadithe = useMemo(() => {
    return hadithe.filter((_, idx) => idx !== todayHadithIndex);
  }, [hadithe, todayHadithIndex]);

  function handleShare(text: string, quelle: string) {
    showSuccess(`"${text}"\n\n— ${quelle}\n\n(${t("hadithe.shareNotice")})`);
  }

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Header */}
        <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
          <Text style={[styles.backArrow, { color: themeColors.text }]}>‹</Text>
          <Text style={[styles.backText, { color: themeColors.text }]}>{t("hadithe.back")}</Text>
        </TouchableOpacity>

        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("hadithe.title")}</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
          {t("hadithe.subtitle")}
        </Text>

        {/* Ladezustand */}
        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        )}

        {/* Keine Daten */}
        {!isLoading && hadithe.length === 0 && (
          <View style={[styles.emptyContainer, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
              {t("hadithe.empty")}
            </Text>
          </View>
        )}

        {/* Hadith des Tages */}
        {!isLoading && todayHadith && (
          <View style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <Text style={styles.todayStar}>★</Text>
              <Text style={styles.todayLabel}>{t("hadithe.todayLabel")}</Text>
            </View>
            <Text style={styles.todayText}>"{todayHadith.text_de}"</Text>
            {todayHadith.source && (
              <Text style={styles.todayQuelle}>— {todayHadith.source}</Text>
            )}
            <TouchableOpacity
              style={styles.shareButton}
              onPress={() => handleShare(todayHadith.text_de, todayHadith.source ?? "")}
            >
              <Text style={styles.shareButtonText}>{t("hadithe.share")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Weitere Hadithe */}
        {!isLoading && otherHadithe.length > 0 && (
          <>
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("hadithe.moreHadithe")}</Text>
            {otherHadithe.map((hadith) => (
              <View key={hadith.id} style={[styles.hadithCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Text style={[styles.hadithText, { color: themeColors.text }]}>"{hadith.text_de}"</Text>
                <View style={[styles.hadithFooter, { borderTopColor: themeColors.border }]}>
                  <Text style={[styles.hadithQuelle, { color: themeColors.textTertiary }]}>
                    {hadith.source ? `— ${hadith.source}` : ""}
                  </Text>
                  <TouchableOpacity
                    style={[styles.hadithShareButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => handleShare(hadith.text_de, hadith.source ?? "")}
                  >
                    <Text style={[styles.hadithShareText, { color: themeColors.textSecondary }]}>{t("hadithe.share")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  backRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  backArrow: { fontSize: 24, marginRight: 4 },
  backText: { fontWeight: "600", fontSize: 16 },
  pageTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, marginBottom: 24 },

  loadingContainer: {
    alignItems: "center",
    paddingVertical: 48,
  },

  emptyContainer: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },

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
    letterSpacing: 1,
    marginBottom: 12,
  },

  hadithCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  hadithText: {
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
    paddingTop: 10,
  },
  hadithQuelle: { fontSize: 12, flex: 1 },
  hadithShareButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  hadithShareText: { fontSize: 12, fontWeight: "600" },
});
