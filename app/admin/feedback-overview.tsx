import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";

type FeedbackFilter = "all" | "positive" | "negative";

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Text key={s} style={{ color: s <= rating ? COLORS.gold : COLORS.border, fontSize: 16 }}>
          ★
        </Text>
      ))}
    </View>
  );
}

export default function FeedbackOverviewScreen() {
  const { user } = useAuth();
  const { getFeedbacks, users, mentorships } = useData();
  const [filter, setFilter] = useState<FeedbackFilter>("all");

  const allFeedbacks = getFeedbacks(); // sortiert nach Datum (neueste zuerst)

  const hasNegative = allFeedbacks.some((f) => f.rating <= 2);

  const filtered = useMemo(() => {
    if (filter === "positive") return allFeedbacks.filter((f) => f.rating >= 4);
    if (filter === "negative") return allFeedbacks.filter((f) => f.rating <= 2);
    return allFeedbacks;
  }, [filter, allFeedbacks]);

  if (user?.role !== "admin") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>Nur für Admins zugänglich.</Text>
      </View>
    );
  }

  return (
    <Container>
      <ScrollView style={styles.scrollView}>
        <View style={styles.page}>
          <Text style={styles.pageTitle}>Feedback-Übersicht</Text>
          <Text style={styles.pageSubtitle}>
            {allFeedbacks.length} Feedbacks insgesamt
          </Text>

          {/* FIX 11: Frühwarnsystem */}
          {hasNegative && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningIcon}>!</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.warningTitle}>Achtung: Negative Feedbacks vorhanden</Text>
                <Text style={styles.warningText}>
                  Es gibt Feedbacks mit 1–2 Sternen. Bitte zeitnah prüfen.
                </Text>
              </View>
            </View>
          )}

          {/* Filter */}
          <View style={styles.filterCard}>
            <Text style={styles.filterLabel}>{"FILTER"}</Text>
            <View style={styles.filterRow}>
              {(
                [
                  { key: "all", label: "Alle" },
                  { key: "positive", label: "Positiv (4-5 ★)" },
                  { key: "negative", label: "Negativ (1-2 ★)" },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.filterChip,
                    filter === opt.key ? styles.filterChipActive : styles.filterChipInactive,
                  ]}
                  onPress={() => setFilter(opt.key)}
                >
                  <Text
                    style={
                      filter === opt.key
                        ? styles.filterChipTextActive
                        : styles.filterChipTextInactive
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
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>Keine Feedbacks in dieser Kategorie.</Text>
            </View>
          ) : (
            filtered.map((fb) => {
              const submitter = users.find((u) => u.id === fb.submitted_by);
              const mentorship = mentorships.find((m) => m.id === fb.mentorship_id);
              const isNegative = fb.rating <= 2;

              return (
                <View
                  key={fb.id}
                  style={[styles.feedbackCard, isNegative ? styles.feedbackCardNegative : {}]}
                >
                  <View style={styles.feedbackHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.feedbackSubmitter}>
                        {submitter?.name ?? "Unbekannt"}
                      </Text>
                      <Text style={styles.feedbackMeta}>
                        {mentorship
                          ? `${mentorship.mentee?.name ?? "?"} & ${mentorship.mentor?.name ?? "?"}`
                          : "Betreuung unbekannt"}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <StarRating rating={fb.rating} />
                      <Text style={styles.feedbackDate}>
                        {new Date(fb.created_at).toLocaleDateString("de-DE")}
                      </Text>
                    </View>
                  </View>

                  {fb.comments ? (
                    <View style={styles.commentsBox}>
                      <Text style={styles.commentsText}>{fb.comments}</Text>
                    </View>
                  ) : (
                    <Text style={styles.noComments}>Kein Kommentar</Text>
                  )}

                  {isNegative && (
                    <View style={styles.negativeBadge}>
                      <Text style={styles.negativeBadgeText}>Handlungsbedarf</Text>
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
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { color: COLORS.primary, fontWeight: "600" },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 16 },

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
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 20,
  },
  filterLabel: { fontSize: 11, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 10 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  filterChipTextActive: { color: COLORS.white, fontSize: 13, fontWeight: "500" },
  filterChipTextInactive: { color: COLORS.secondary, fontSize: 13 },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
  },
  emptyText: { color: COLORS.tertiary, fontSize: 14 },

  feedbackCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  feedbackCardNegative: {
    borderColor: "#fca5a5",
    backgroundColor: "#fff5f5",
  },
  feedbackHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  feedbackSubmitter: { fontWeight: "bold", color: COLORS.primary, fontSize: 15 },
  feedbackMeta: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  feedbackDate: { color: COLORS.tertiary, fontSize: 11, marginTop: 4 },

  commentsBox: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10,
  },
  commentsText: { color: COLORS.secondary, fontSize: 14, lineHeight: 20 },
  noComments: { color: COLORS.tertiary, fontSize: 13, fontStyle: "italic" },

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
