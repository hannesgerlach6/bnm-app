import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  Share,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

async function shareAnswer(question: string, answer: string, suffix: string) {
  try {
    await Share.share({ message: `${question}\n\n${answer}\n\n${suffix}` });
  } catch {
    // Teilen abgebrochen — ignorieren
  }
}

const CATEGORIES = ["Grundlagen", "Gebet", "Alltag", "Persönliches"];

export default function QAScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { qaEntries, loadQAEntries } = useData();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQAEntries();
    setRefreshing(false);
  }, [loadQAEntries]);

  // Nur veröffentlichte Einträge für Nicht-Admin
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

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
          {/* Header */}
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Text style={[styles.backText, { color: themeColors.textSecondary }]}>
              {t("qa.back")}
            </Text>
          </TouchableOpacity>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("qa.title")}</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("qa.subtitle")}
          </Text>

          {/* Suchfeld */}
          <TextInput
            style={[
              styles.searchInput,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
                color: themeColors.text,
              },
            ]}
            placeholder={t("qa.searchPlaceholder")}
            placeholderTextColor={themeColors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />

          {/* Kategorie-Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryScroll}
            contentContainerStyle={styles.categoryContent}
          >
            <TouchableOpacity
              style={[
                styles.chip,
                activeCategory === null
                  ? { backgroundColor: COLORS.gradientStart }
                  : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text
                style={[
                  styles.chipText,
                  activeCategory === null ? { color: COLORS.white } : { color: themeColors.text },
                ]}
              >
                {t("qa.allCategories")}
              </Text>
            </TouchableOpacity>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.chip,
                  activeCategory === cat
                    ? { backgroundColor: COLORS.gradientStart }
                    : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
                ]}
                onPress={() => setActiveCategory(activeCategory === cat ? null : cat)}
              >
                <Text
                  style={[
                    styles.chipText,
                    activeCategory === cat ? { color: COLORS.white } : { color: themeColors.text },
                  ]}
                >
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Ergebnis-Count */}
          {(searchQuery.trim() || activeCategory) && (
            <Text style={[styles.resultCount, { color: themeColors.textSecondary }]}>
              {t("qa.totalEntries").replace("{0}", String(filtered.length))}
              {activeCategory ? ` ${t("qa.for")} "${activeCategory}"` : ""}
            </Text>
          )}

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
                      {
                        backgroundColor: themeColors.card,
                        borderColor: themeColors.border,
                      },
                      isExpanded && { borderColor: COLORS.gradientStart },
                      !isLast && styles.accordionItemMargin,
                    ]}
                  >
                    <TouchableOpacity
                      style={styles.accordionHeader}
                      onPress={() => setExpandedId(isExpanded ? null : entry.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.accordionHeaderLeft}>
                        <View
                          style={[
                            styles.categoryPill,
                            { backgroundColor: themeColors.background },
                          ]}
                        >
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
                      <Text
                        style={[
                          styles.chevron,
                          { color: isExpanded ? COLORS.gradientStart : themeColors.textSecondary },
                        ]}
                      >
                        {isExpanded ? "▲" : "▼"}
                      </Text>
                    </TouchableOpacity>

                    {isExpanded && (
                      <View
                        style={[
                          styles.accordionBody,
                          { borderTopColor: themeColors.border },
                        ]}
                      >
                        <Text style={[styles.answerText, { color: themeColors.textSecondary }]}>
                          {entry.answer}
                        </Text>
                        {/* Share-Button */}
                        <TouchableOpacity
                          style={[styles.shareBtn, { backgroundColor: themeColors.background }]}
                          onPress={() => shareAnswer(entry.question, entry.answer, t("share.suffix"))}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="share-outline" size={15} color={themeColors.textSecondary} />
                          <Text style={[styles.shareBtnText, { color: themeColors.textSecondary }]}>
                            {t("share.answer")}
                          </Text>
                        </TouchableOpacity>
                        {entry.tags.length > 0 && (
                          <View style={styles.tagsRow}>
                            {entry.tags.map((tag) => (
                              <View
                                key={tag}
                                style={[styles.tagBadge, { backgroundColor: themeColors.background }]}
                              >
                                <Text style={[styles.tagText, { color: themeColors.textSecondary }]}>
                                  #{tag}
                                </Text>
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
  backRow: { marginBottom: 8 },
  backText: { fontSize: 14 },
  pageTitle: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, marginBottom: 16 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  categoryScroll: { marginBottom: 12 },
  categoryContent: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  chipText: { fontSize: 13, fontWeight: "500" },
  resultCount: { fontSize: 12, marginBottom: 8 },
  emptyBox: {
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  listContainer: { gap: 0 },
  accordionItem: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: "hidden",
  },
  accordionItemMargin: { marginBottom: 10 },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
  },
  accordionHeaderLeft: { flex: 1, gap: 6 },
  categoryPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  categoryPillText: { fontSize: 10, fontWeight: "600", letterSpacing: 0.5 },
  questionText: { fontSize: 14, fontWeight: "600", lineHeight: 20 },
  chevron: { fontSize: 12, marginTop: 2 },
  accordionBody: {
    borderTopWidth: 1,
    padding: 14,
    gap: 10,
  },
  answerText: { fontSize: 14, lineHeight: 22 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tagBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  tagText: { fontSize: 12 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  shareBtnText: { fontSize: 12 },
});
