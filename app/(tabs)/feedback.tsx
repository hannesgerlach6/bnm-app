import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

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

export default function FeedbackTabScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getFeedbacks, users, mentorships } = useData();
  const [filter, setFilter] = useState<FeedbackFilter>("all");

  const allFeedbacks = getFeedbacks();

  const filtered = useMemo(() => {
    if (filter === "positive") return allFeedbacks.filter((f) => f.rating >= 4);
    if (filter === "negative") return allFeedbacks.filter((f) => f.rating <= 3);
    return allFeedbacks;
  }, [filter, allFeedbacks]);

  const hasNegative = allFeedbacks.some((f) => f.rating <= 2);

  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("feedbackOverview.accessDenied")}</Text>
      </View>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("tabs.feedback")}</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("feedbackOverview.total").replace("{0}", String(allFeedbacks.length))}
          </Text>

          {/* Frühwarnung bei negativem Feedback */}
          {hasNegative && (
            <View style={[styles.warningBanner, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}>
              <Text style={[styles.warningTitle, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("feedbackOverview.warningTitle")}</Text>
              <Text style={[styles.warningText, { color: isDark ? "#fca5a5" : "#dc2626" }]}>
                {t("feedbackOverview.warningText")}
              </Text>
            </View>
          )}

          {/* Filter */}
          <View style={[styles.filterCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.filterLabel, { color: themeColors.textTertiary }]}>{t("feedbackOverview.filter")}</Text>
            <View style={styles.filterRow}>
              {(
                [
                  { key: "all" as FeedbackFilter, label: t("feedbackOverview.all") },
                  { key: "positive" as FeedbackFilter, label: t("feedbackOverview.positive") },
                  { key: "negative" as FeedbackFilter, label: t("feedbackOverview.negative") },
                ]
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

          {/* Empty State */}
          {allFeedbacks.length === 0 && (
            <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("feedbackOverview.noFeedbackYet")}</Text>
            </View>
          )}

          {/* Feedback-Liste */}
          {filtered.length === 0 && allFeedbacks.length > 0 ? (
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
                    isNegative ? { borderColor: isDark ? "#7a2a2a" : "#fca5a5", backgroundColor: isDark ? "#2a1a1a" : "#fff5f5" } : {},
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
                    <View style={[styles.negativeBadge, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                      <Text style={[styles.negativeBadgeText, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("feedbackOverview.actionNeeded")}</Text>
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
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, textAlign: "center", marginBottom: 4 },
  pageSubtitle: { textAlign: "center", marginBottom: 16 },

  warningBanner: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
  },
  warningTitle: { fontWeight: "800", fontSize: 14, marginBottom: 2 },
  warningText: { fontSize: 13 },

  filterCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  filterChipActive: {
    backgroundColor: COLORS.gradientStart,
    borderColor: COLORS.gradientStart,
  },
  filterChipInactive: {},
  filterChipTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  filterChipTextInactive: { fontSize: 13 },

  emptyCard: {
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14 },

  feedbackCard: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  feedbackHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  feedbackSubmitter: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  feedbackMeta: { fontSize: 12 },
  feedbackDate: { fontSize: 11, marginTop: 4 },

  commentsBox: {
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  commentsText: { fontSize: 13, lineHeight: 18 },
  noComments: { fontSize: 12, fontStyle: "italic", marginBottom: 4 },

  negativeBadge: {
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  negativeBadgeText: { fontSize: 11, fontWeight: "700" },
});
