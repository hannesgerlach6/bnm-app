import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  RefreshControl,
  Share,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors, useTheme } from "../../contexts/ThemeContext";
import { COLORS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";

const CATEGORIES = ["Grundlagen", "Gebet", "Alltag", "Persönliches"];

async function shareAnswer(question: string, answer: string, suffix: string) {
  try {
    await Share.share({ message: `${question}\n\n${answer}\n\n${suffix}` });
  } catch {
    // Teilen abgebrochen — ignorieren
  }
}

export default function FAQScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { qaEntries, hadithe, loadQAEntries, refreshData } = useData();
  const { width } = useWindowDimensions();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [hadithOffset, setHadithOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    await loadQAEntries();
    setRefreshing(false);
  }, [refreshData, loadQAEntries]);

  // Nur veröffentlichte Einträge
  const publishedEntries = useMemo(
    () => qaEntries.filter((e) => e.is_published),
    [qaEntries]
  );

  const filtered = useMemo(() => {
    let list = publishedEntries;
    if (activeCategory) {
      list = list.filter((e) => e.category === activeCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.question.toLowerCase().includes(q) ||
          e.answer.toLowerCase().includes(q) ||
          e.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list;
  }, [publishedEntries, activeCategory, searchQuery]);

  // Hadith des Tages
  const todayHadith = useMemo(() => {
    if (hadithe.length === 0) return null;
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const baseIdx = dayOfYear % hadithe.length;
    const idx = (baseIdx + hadithOffset) % hadithe.length;
    return hadithe[idx];
  }, [hadithe, hadithOffset]);

  const isWide = Platform.OS === "web" && width > 768;

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.page, isWide && styles.pageWide]}>

          {/* ── Hadith des Tages ──────────────────────────────────────────── */}
          {todayHadith && (
            <View style={[styles.hadithCard, { backgroundColor: isDark ? "#1A1A2C" : "#f0f4ff" }]}>
              <View style={styles.hadithHeader}>
                <Text style={styles.hadithStar}>★</Text>
                <Text style={[styles.hadithTitle, { color: isDark ? COLORS.gold : "#1a237e" }]}>
                  {t("faq.hadithSection")}
                </Text>
              </View>
              {todayHadith.text_ar ? (
                <Text style={[styles.hadithArabic, { color: isDark ? "#E8D5A3" : "#3949ab" }]}>
                  {todayHadith.text_ar}
                </Text>
              ) : null}
              <Text style={[styles.hadithText, { color: isDark ? "#D4C5A0" : "#283593" }]}>
                "{todayHadith.text_de}"
              </Text>
              {todayHadith.source ? (
                <Text style={[styles.hadithSource, { color: isDark ? COLORS.gold : "#5c6bc0" }]}>
                  — {todayHadith.source}
                </Text>
              ) : null}
              <View style={styles.hadithActions}>
                <View style={styles.hadithActionsLeft}>
                  <BNMPressable
                    style={[styles.hadithNextBtn, { backgroundColor: isDark ? themeColors.elevated : "#e8eaf6", borderColor: isDark ? themeColors.border : "#c5cae9" }]}
                    onPress={() => setHadithOffset((prev) => prev + 1)}
                    accessibilityRole="button"
                    accessibilityLabel="Nächster Hadith"
                  >
                    <Ionicons name="arrow-forward-outline" size={14} color={isDark ? COLORS.gold : "#3949ab"} />
                    <Text style={[styles.hadithNextText, { color: isDark ? COLORS.gold : "#3949ab" }]}>
                      {t("motivation.next")}
                    </Text>
                  </BNMPressable>
                  <BNMPressable
                    style={[styles.hadithShareBtn, { backgroundColor: isDark ? themeColors.elevated : "#e8eaf6" }]}
                    accessibilityRole="button"
                    accessibilityLabel="Hadith teilen"
                    onPress={() => {
                      const shareText = todayHadith.text_ar
                        ? `${todayHadith.text_ar}\n\n${todayHadith.text_de}`
                        : todayHadith.text_de;
                      Share.share({ message: `${shareText}\n\n${t("share.suffix")}` }).catch(() => {});
                    }}
                  >
                    <Ionicons name="share-outline" size={16} color={COLORS.gold} />
                  </BNMPressable>
                </View>
                <BNMPressable
                  style={[styles.hadithAllBtn, { borderColor: isDark ? "#3A3A5C" : "#c5cae9" }]}
                  onPress={() => router.push("/hadithe")}
                  accessibilityRole="button"
                  accessibilityLabel="Alle Hadithe anzeigen"
                >
                  <Text style={[styles.hadithAllText, { color: isDark ? COLORS.gold : "#3949ab" }]}>
                    {t("faq.viewAllHadithe")}
                  </Text>
                </BNMPressable>
              </View>
            </View>
          )}

          {/* ── Q&A Abschnitt ─────────────────────────────────────────────── */}
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>
              {t("faq.qaSection")}
            </Text>
          </View>

          {/* Suchfeld */}
          <View style={[styles.searchRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Ionicons name="search-outline" size={16} color={themeColors.textSecondary} />
            <TextInput
              style={[styles.searchInput, { color: themeColors.text }]}
              placeholder={t("qa.searchPlaceholder")}
              placeholderTextColor={themeColors.textSecondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              accessibilityLabel="FAQ durchsuchen"
            />
            {searchQuery.length > 0 && (
              <BNMPressable
                onPress={() => setSearchQuery("")}
                accessibilityRole="button"
                accessibilityLabel="Suche löschen"
              >
                <Ionicons name="close-circle" size={16} color={themeColors.textSecondary} />
              </BNMPressable>
            )}
          </View>

          {/* Kategorie-Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            <BNMPressable
              style={[
                styles.chip,
                activeCategory === null
                  ? { backgroundColor: COLORS.gradientStart }
                  : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
              ]}
              onPress={() => setActiveCategory(null)}
              accessibilityRole="radio"
              accessibilityLabel={t("qa.allCategories")}
              accessibilityState={{ checked: activeCategory === null }}
            >
              <Text style={[styles.chipText, activeCategory === null ? { color: COLORS.white } : { color: themeColors.text }]}>
                {t("qa.allCategories")}
              </Text>
            </BNMPressable>
            {CATEGORIES.map((cat) => (
              <BNMPressable
                key={cat}
                style={[
                  styles.chip,
                  activeCategory === cat
                    ? { backgroundColor: COLORS.gradientStart }
                    : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
                ]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
                accessibilityRole="radio"
                accessibilityLabel={cat}
                accessibilityState={{ checked: activeCategory === cat }}
              >
                <Text style={[styles.chipText, activeCategory === cat ? { color: COLORS.white } : { color: themeColors.text }]}>
                  {cat}
                </Text>
              </BNMPressable>
            ))}
          </ScrollView>

          {/* Akkordeon-Liste */}
          {filtered.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t("qa.noResults")}
              </Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {filtered.map((entry, idx) => {
                const isExpanded = expandedId === entry.id;
                const isLast = idx === filtered.length - 1;
                return (
                  <View
                    key={entry.id}
                    style={[
                      styles.accordionItem,
                      { backgroundColor: themeColors.card, borderColor: themeColors.border },
                      isExpanded && { borderColor: COLORS.gradientStart },
                      !isLast && styles.accordionItemMargin,
                    ]}
                  >
                    <BNMPressable
                      style={styles.accordionHeader}
                      onPress={() => setExpandedId(isExpanded ? null : entry.id)}
                                           accessibilityRole="button"
                      accessibilityLabel={entry.question}
                      accessibilityState={{ expanded: isExpanded }}
                    >
                      <View style={styles.accordionHeaderLeft}>
                        <View style={[styles.categoryPill, { backgroundColor: themeColors.background }]}>
                          <Text style={[styles.categoryPillText, { color: themeColors.textSecondary }]}>
                            {entry.category}
                          </Text>
                        </View>
                        <Text
                          style={[styles.questionText, { color: themeColors.text }]}
                          numberOfLines={isExpanded ? undefined : 2}
                        >
                          {entry.question}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, { color: isExpanded ? COLORS.gradientStart : themeColors.textSecondary }]}>
                        {isExpanded ? "▲" : "▼"}
                      </Text>
                    </BNMPressable>

                    {isExpanded && (
                      <View style={[styles.accordionBody, { borderTopColor: themeColors.border }]}>
                        <Text style={[styles.answerText, { color: themeColors.textSecondary }]}>
                          {entry.answer}
                        </Text>
                        <BNMPressable
                          style={[styles.shareBtn, { backgroundColor: themeColors.background }]}
                          onPress={() => shareAnswer(entry.question, entry.answer, t("share.suffix"))}
                                                   accessibilityRole="button"
                          accessibilityLabel="Antwort teilen"
                        >
                          <Ionicons name="share-outline" size={15} color={themeColors.textSecondary} />
                          <Text style={[styles.shareBtnText, { color: themeColors.textSecondary }]}>
                            {t("share.answer")}
                          </Text>
                        </BNMPressable>
                        {entry.tags.length > 0 && (
                          <View style={styles.tagsRow}>
                            {entry.tags.map((tag) => (
                              <View key={tag} style={[styles.tagBadge, { backgroundColor: themeColors.background }]}>
                                <Text style={[styles.tagText, { color: themeColors.textSecondary }]}>#{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20, paddingBottom: 40 },
  pageWide: { width: "100%", padding: 24 },

  // Hadith Card
  hadithCard: {
    borderRadius: RADIUS.md,
    padding: 18,
    marginBottom: 24,
  },
  hadithHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 },
  hadithStar: { fontSize: 18, color: COLORS.gold },
  hadithTitle: { fontSize: 15, fontWeight: "700", letterSpacing: 0.3 },
  hadithArabic: { fontSize: 20, textAlign: "center", marginBottom: 10, fontStyle: "italic", lineHeight: 32 },
  hadithText: { fontSize: 14, lineHeight: 22, marginBottom: 8, fontStyle: "italic", textAlign: "center" },
  hadithSource: { fontSize: 12, marginBottom: 12, textAlign: "center" },
  hadithActions: { flexDirection: "column", alignItems: "center", gap: 12, marginTop: 4 },
  hadithActionsLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  hadithNextBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  hadithNextText: { fontSize: 14, fontWeight: "600" },
  hadithShareBtn: { padding: 9, borderRadius: RADIUS.sm },
  hadithAllBtn: { paddingVertical: 2, paddingHorizontal: 4 },
  hadithAllText: { fontSize: 13, fontWeight: "500", textDecorationLine: "underline", opacity: 0.8 },

  // Sektion
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: "700" },

  // Suchfeld
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 14 },

  // Kategorie-Chips
  categoryScroll: { marginBottom: 16 },
  categoryContent: { gap: 8, paddingRight: 20 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.xl,
  },
  chipText: { fontSize: 13, fontWeight: "500" },

  // Leer
  emptyBox: { padding: 24, borderRadius: RADIUS.md, alignItems: "center" },
  emptyText: { fontSize: 14 },

  // Akkordeon
  listContainer: { gap: 0 },
  accordionItem: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  accordionItemMargin: { marginBottom: 8 },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 8,
  },
  accordionHeaderLeft: { flex: 1, gap: 4 },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
    marginBottom: 2,
  },
  categoryPillText: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  questionText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  chevron: { fontSize: 12, marginTop: 2 },
  accordionBody: { padding: 14, paddingTop: 12, borderTopWidth: 1 },
  answerText: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    marginBottom: 10,
  },
  shareBtnText: { fontSize: 13 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs },
  tagText: { fontSize: 12 },
});
