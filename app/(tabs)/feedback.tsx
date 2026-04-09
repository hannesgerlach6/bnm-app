import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  LayoutAnimation,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, SHADOWS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { EmptyState } from "../../components/EmptyState";
import { BNMPressable } from "../../components/BNMPressable";
import { QUESTIONNAIRE_SECTIONS, isConditionMet } from "../../lib/questionnaireConfig";
import type { Feedback, QuestionnaireAnswers } from "../../types";

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

// ─── Expandable Questionnaire Detail ─────────────────────────────────────────

function QuestionnaireDetail({ answers }: { answers: QuestionnaireAnswers }) {
  const themeColors = useThemeColors();
  const { t } = useLanguage();

  return (
    <View style={styles.detailContainer}>
      {QUESTIONNAIRE_SECTIONS.map((sec) => {
        const visibleQuestions = sec.questions.filter((q) => {
          if (!isConditionMet(q, answers as any)) return false;
          const val = (answers as any)[q.id];
          return val !== undefined && val !== null && val !== "" && !(Array.isArray(val) && val.length === 0);
        });
        if (visibleQuestions.length === 0) return null;

        return (
          <View key={sec.id} style={styles.detailSection}>
            <Text style={[styles.detailSectionTitle, { color: themeColors.primary }]}>
              {t(sec.titleKey)}
            </Text>
            {visibleQuestions.map((q) => {
              const val = (answers as any)[q.id];
              let display = "";
              if (q.type === "rating") {
                display = "★".repeat(val) + "☆".repeat(5 - val);
              } else if (q.type === "text") {
                display = String(val);
              } else if ((q.type === "multiselect" || q.type === "singleselect") && q.options) {
                const keys = Array.isArray(val) ? val : [val];
                display = keys.map((k: string) => {
                  const opt = q.options!.find((o) => o.key === k);
                  return opt ? t(opt.translationKey) : k;
                }).join(", ");
              }

              return (
                <View key={q.id} style={styles.detailRow}>
                  <Text style={[styles.detailQuestion, { color: themeColors.textTertiary }]}>
                    {t(q.translationKey)}
                  </Text>
                  <Text style={[styles.detailAnswer, { color: themeColors.text }]}>
                    {display}
                  </Text>
                </View>
              );
            })}
          </View>
        );
      })}
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

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
            <View style={[styles.warningBanner, { backgroundColor: sem(SEMANTIC.redBg, isDark), borderColor: sem(SEMANTIC.redBorder, isDark) }]}>
              <Text style={[styles.warningTitle, { color: sem(SEMANTIC.redTextDark, isDark) }]}>{t("feedbackOverview.warningTitle")}</Text>
              <Text style={[styles.warningText, { color: sem(SEMANTIC.redText, isDark) }]}>
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
                <BNMPressable
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    filter === opt.key
                      ? styles.filterChipActive
                      : [styles.filterChipInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                  ]}
                  onPress={() => setFilter(opt.key)}
                  accessibilityRole="radio"
                  accessibilityLabel={opt.label}
                  accessibilityState={{ checked: filter === opt.key }}
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
                </BNMPressable>
              ))}
            </View>
          </View>

          {/* Empty State */}
          {allFeedbacks.length === 0 && (
            <EmptyState
              icon="star-outline"
              title={t("feedbackOverview.noFeedbackYet") ?? "Kein Feedback vorhanden"}
            />
          )}

          {/* Feedback-Liste */}
          {filtered.length === 0 && allFeedbacks.length > 0 ? (
            <EmptyState
              icon="star-outline"
              title={t("feedbackOverview.noFeedbacks") ?? "Kein Feedback vorhanden"}
              description="Versuche andere Filter."
            />
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
                    isNegative ? { borderColor: sem(SEMANTIC.redBorder, isDark), backgroundColor: sem(SEMANTIC.redBg, isDark) } : {},
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
                    <View style={[styles.negativeBadge, { backgroundColor: sem(SEMANTIC.redBg, isDark) }]}>
                      <Text style={[styles.negativeBadgeText, { color: sem(SEMANTIC.redTextDark, isDark) }]}>{t("feedbackOverview.actionNeeded")}</Text>
                    </View>
                  )}

                  {/* Expandierbare Fragebogen-Details */}
                  {fb.answers && (
                    <>
                      <BNMPressable
                        style={styles.detailToggle}
                        onPress={() => {
                          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                          setExpandedIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(fb.id)) next.delete(fb.id); else next.add(fb.id);
                            return next;
                          });
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={expandedIds.has(fb.id) ? "Details ausblenden" : "Details anzeigen"}
                        accessibilityState={{ expanded: expandedIds.has(fb.id) }}
                      >
                        <Ionicons
                          name={expandedIds.has(fb.id) ? "chevron-up" : "chevron-down"}
                          size={16}
                          color={themeColors.textTertiary}
                        />
                        <Text style={[styles.detailToggleText, { color: themeColors.textTertiary }]}>
                          {expandedIds.has(fb.id) ? t("questionnaire.hideDetails") : t("questionnaire.showDetails")}
                        </Text>
                      </BNMPressable>
                      {expandedIds.has(fb.id) && <QuestionnaireDetail answers={fb.answers} />}
                    </>
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
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  warningTitle: { fontWeight: "800", fontSize: 14, marginBottom: 2 },
  warningText: { fontSize: 13 },

  filterCard: {
    borderRadius: RADIUS.lg,
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.lg,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 12,
  },
  emptyText: { fontSize: 14 },

  feedbackCard: {
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    ...SHADOWS.md,
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
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 8,
  },
  commentsText: { fontSize: 13, lineHeight: 18 },
  noComments: { fontSize: 12, fontStyle: "italic", marginBottom: 4 },

  negativeBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  negativeBadgeText: { fontSize: 11, fontWeight: "700" },

  // Detail toggle
  detailToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  detailToggleText: { fontSize: 12, fontWeight: "600" },

  // Questionnaire detail
  detailContainer: { marginTop: 8 },
  detailSection: { marginBottom: 12 },
  detailSectionTitle: { fontWeight: "700", fontSize: 13, marginBottom: 6 },
  detailRow: { marginBottom: 8 },
  detailQuestion: { fontSize: 11, marginBottom: 2 },
  detailAnswer: { fontSize: 13, fontWeight: "500" },
});
