import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";

type FeedbackFilter = "all" | "positive" | "negative";

function StarRating({ rating }: { rating: number }) {
  const themeColors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ color: s <= rating ? COLORS.gold : themeColors.border, fontSize: 16 }}>
          ★
        </Text>
      ))}
    </View>
  );
}

export default function FeedbackOverviewScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { getFeedbacks, users, mentorships } = useData();
  const [filter, setFilter] = useState<FeedbackFilter>("all");
  const [search, setSearch] = useState("");

  const allFeedbacks = getFeedbacks(); // sortiert nach Datum (neueste zuerst)

  const hasNegative = allFeedbacks.some((f) => f.rating <= 2);

  const filtered = useMemo(() => {
    const searchLower = search.toLowerCase();
    let base = allFeedbacks;
    if (filter === "positive") base = base.filter((f) => f.rating >= 4);
    if (filter === "negative") base = base.filter((f) => f.rating <= 2);
    if (search) {
      base = base.filter((f) => {
        const submitter = users.find((u) => u.id === f.submitted_by);
        const mentorship = mentorships.find((m) => m.id === f.mentorship_id);
        return (
          submitter?.name.toLowerCase().includes(searchLower) ||
          mentorship?.mentee?.name.toLowerCase().includes(searchLower) ||
          mentorship?.mentor?.name.toLowerCase().includes(searchLower) ||
          f.comments?.toLowerCase().includes(searchLower)
        );
      });
    }
    return base;
  }, [filter, search, allFeedbacks, users, mentorships]);

  if (user?.role !== "admin") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("feedbackOverview.accessDenied")}</Text>
      </View>
    );
  }

  return (
    <Container>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("feedbackOverview.title")}</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("feedbackOverview.total").replace("{0}", String(allFeedbacks.length))}
          </Text>

          {/* Empty State: Noch kein Feedback */}
          {allFeedbacks.length === 0 && (
            <View style={[styles.emptyFeedbackBox, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyFeedbackText, { color: themeColors.textTertiary }]}>{t("feedbackOverview.noFeedbackYet")}</Text>
            </View>
          )}

          {/* Suche */}
          <TextInput
            style={[styles.searchInput, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
            placeholder={t("feedbackOverview.search")}
            placeholderTextColor={themeColors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />

          {/* FIX 11: Frühwarnsystem */}
          {hasNegative && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>!</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>{t("feedbackOverview.warningTitle")}</Text>
                <Text style={styles.warningText}>
                  {t("feedbackOverview.warningText")}
                </Text>
              </View>
            </View>
          )}

          {/* Filter */}
          <View style={[styles.filterCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.filterLabel, { color: themeColors.textTertiary }]}>{t("feedbackOverview.filter")}</Text>
            <View style={styles.filterRow}>
              {(
                [
                  { key: "all", label: t("feedbackOverview.all") },
                  { key: "positive", label: t("feedbackOverview.positive") },
                  { key: "negative", label: t("feedbackOverview.negative") },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    filter === opt.key
                      ? styles.filterChipActive
                      : [styles.filterChipInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                  ]}
                  onPress={() => setFilter(opt.key)}
                >
                  <Text
                    style={
                      filter === opt.key
                        ? styles.filterChipTextActive
                        : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                    }
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Feedback-Liste */}
          {filtered.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("feedbackOverview.noFeedbacks")}</Text>
            </View>
          ) : (
            filtered.map((fb) => {
              const submitter = users.find((u) => u.id === fb.submitted_by);
              const mentorship = mentorships.find((m) => m.id === fb.mentorship_id);
              const isNegative = fb.rating <= 2;

              return (
                <View
                  key={fb.id}
                  style={[
                    styles.feedbackCard,
                    { backgroundColor: themeColors.card, borderColor: themeColors.border },
                    isNegative ? styles.feedbackCardNegative : {},
                  ]}
                >
                  <View style={styles.feedbackHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.feedbackSubmitter, { color: themeColors.text }]}>
                        {submitter?.name ?? t("feedbackOverview.unknown")}
                      </Text>
                      <Text style={[styles.feedbackMeta, { color: themeColors.textTertiary }]}>
                        {mentorship
                          ? `${mentorship.mentee?.name ?? "?"} & ${mentorship.mentor?.name ?? "?"}`
                          : t("feedbackOverview.unknownMentorship")}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <StarRating rating={fb.rating} />
                      <Text style={[styles.feedbackDate, { color: themeColors.textTertiary }]}>
                        {new Date(fb.created_at).toLocaleDateString("de-DE")}
                      </Text>
                    </View>
                  </View>

                  {fb.comments ? (
                    <View style={[styles.commentsBox, { backgroundColor: themeColors.background }]}>
                      <Text style={[styles.commentsText, { color: themeColors.textSecondary }]}>{fb.comments}</Text>
                    </View>
                  ) : (
                    <Text style={[styles.noComments, { color: themeColors.textTertiary }]}>{t("feedbackOverview.noComment")}</Text>
                  )}

                  {isNegative && (
                    <View style={styles.negativeBadge}>
                      <Text style={styles.negativeBadgeText}>{t("feedbackOverview.actionNeeded")}</Text>
                    </View>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { marginBottom: 16 },

  warningBanner: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  warningIcon: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
    backgroundColor: COLORS.error,
    width: 28,
    height: 28,
    borderRadius: 14,
    textAlign: "center",
    lineHeight: 28,
    flexShrink: 0,
  },
  warningTitle: { color: "#b91c1c", fontWeight: "bold", fontSize: 14, marginBottom: 2 },
  warningText: { color: "#dc2626", fontSize: 13 },

  filterCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  filterLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: {},
  filterChipTextActive: { color: COLORS.white, fontSize: 13, fontWeight: "500" },
  filterChipTextInactive: { fontSize: 13 },

  emptyFeedbackBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  emptyFeedbackText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },

  feedbackCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  feedbackCardNegative: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
  },
  feedbackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  feedbackSubmitter: { fontWeight: "bold", fontSize: 15 },
  feedbackMeta: { fontSize: 12, marginTop: 2 },
  feedbackDate: { fontSize: 11, marginTop: 4 },

  commentsBox: {
    borderRadius: 8,
    padding: 10,
  },
  commentsText: { fontSize: 14, lineHeight: 20 },
  noComments: { fontSize: 13, fontStyle: "italic" },

  negativeBadge: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#fee2e2",
    borderRadius: 9999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  negativeBadgeText: { color: "#b91c1c", fontSize: 12, fontWeight: "600" },
});
