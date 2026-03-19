import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";

export default function StatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { users, mentorships, sessions, feedback, sessionTypes } = useData();

  // Nur Admin
  if (!user || user.role !== "admin") {
    return (
      <View style={styles.center}>
        <Text style={styles.denied}>{t("statistics.accessDenied")}</Text>
      </View>
    );
  }

  return <StatisticsContent />;
}

function StatisticsContent() {
  const router = useRouter();
  const { t } = useLanguage();
  const { users, mentorships, sessions, feedback, sessionTypes } = useData();

  const stats = useMemo(() => {
    const allMentors = users.filter((u) => u.role === "mentor");
    const allMentees = users.filter((u) => u.role === "mentee");
    const completed = mentorships.filter((m) => m.status === "completed");
    const cancelled = mentorships.filter((m) => m.status === "cancelled");
    const total = mentorships.length;

    // Abschlussquote
    const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0;

    // Durchschnittliche Betreuungsdauer (Wochen) für abgeschlossene
    let avgDurationWeeks = 0;
    const withDates = completed.filter((m) => m.completed_at && m.assigned_at);
    if (withDates.length > 0) {
      const totalMs = withDates.reduce((sum, m) => {
        const start = new Date(m.assigned_at).getTime();
        const end = new Date(m.completed_at!).getTime();
        return sum + (end - start);
      }, 0);
      const avgMs = totalMs / withDates.length;
      avgDurationWeeks = Math.round(avgMs / (1000 * 60 * 60 * 24 * 7));
    }

    // Durchschnittliche Sessions pro Betreuung
    let avgSessions = 0;
    if (mentorships.length > 0) {
      const totalSessions = sessions.length;
      avgSessions = Math.round((totalSessions / mentorships.length) * 10) / 10;
    }

    // Häufigster Abbruchgrund: aus Feedback-Kommentaren der abgebrochenen Betreuungen
    const cancelledIds = new Set(cancelled.map((m) => m.id));
    const cancelFeedbacks = feedback.filter((f) => cancelledIds.has(f.mentorship_id) && f.comments);
    let topCancellationReason = t("statistics.noCancellationReason");
    if (cancelFeedbacks.length > 0) {
      // Erster vorhandener Kommentar als grober Hinweis
      topCancellationReason = cancelFeedbacks[0].comments ?? t("statistics.noCancellationReason");
      if (topCancellationReason.length > 80) {
        topCancellationReason = topCancellationReason.slice(0, 80) + "…";
      }
    }

    // Mentoren mit meisten Betreuungen (Top 5)
    const mentorCounts = allMentors
      .map((m) => ({
        name: m.name,
        city: m.city,
        total: mentorships.filter((ms) => ms.mentor_id === m.id).length,
        completed: mentorships.filter((ms) => ms.mentor_id === m.id && ms.status === "completed").length,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);

    // Städte-Verteilung (Top 5) – alle User
    const cityMap: Record<string, number> = {};
    allMentees.forEach((u) => {
      const c = u.city || t("common.unknown");
      cityMap[c] = (cityMap[c] ?? 0) + 1;
    });
    const topCities = Object.entries(cityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return {
      completionRate,
      avgDurationWeeks,
      avgSessions,
      topCancellationReason,
      mentorCounts,
      topCities,
      totalMentorships: total,
      completedCount: completed.length,
      cancelledCount: cancelled.length,
    };
  }, [users, mentorships, sessions, feedback, t]);

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>{t("statistics.back")}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{t("statistics.title")}</Text>
          </View>
        </View>

        {/* Gesamtstatistiken */}
        <Text style={styles.sectionLabel}>{t("statistics.overallStats")}</Text>

        <View style={styles.kpiGrid}>
          <KPICard
            label={t("statistics.completionRate")}
            value={`${stats.completionRate}%`}
            color={COLORS.cta}
          />
          <KPICard
            label={t("statistics.avgDuration")}
            value={`${stats.avgDurationWeeks} ${t("statistics.avgDurationUnit")}`}
            color={COLORS.gradientStart}
          />
          <KPICard
            label={t("statistics.avgSessions")}
            value={String(stats.avgSessions)}
            color={COLORS.gold}
          />
          <KPICard
            label={t("statistics.completed")}
            value={String(stats.completedCount)}
            color={COLORS.cta}
          />
        </View>

        {/* Betreuungsstatus */}
        <View style={styles.card}>
          <StatusRow
            label={t("statistics.completed")}
            count={stats.completedCount}
            total={stats.totalMentorships}
            color="#15803d"
            bg="#dcfce7"
          />
          <StatusRow
            label={t("statistics.cancelled")}
            count={stats.cancelledCount}
            total={stats.totalMentorships}
            color="#b91c1c"
            bg="#fee2e2"
          />
          <View style={[styles.statusRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.statusLabel}>{t("statistics.total")}</Text>
            <Text style={[styles.statusCount, { color: COLORS.primary }]}>
              {stats.totalMentorships}
            </Text>
          </View>
        </View>

        {/* Häufigster Abbruchgrund */}
        <Text style={styles.sectionLabel}>{t("statistics.topCancellationReason").toUpperCase()}</Text>
        <View style={styles.card}>
          <Text style={styles.reasonText}>{stats.topCancellationReason}</Text>
        </View>

        {/* Top-Mentoren */}
        <Text style={styles.sectionLabel}>{t("statistics.mentorRanking")}</Text>
        {stats.mentorCounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("statistics.noData")}</Text>
          </View>
        ) : (
          <View style={styles.card}>
            {stats.mentorCounts.map((m, idx) => (
              <View
                key={idx}
                style={[styles.mentorRow, idx < stats.mentorCounts.length - 1 ? styles.rowBorder : {}]}
              >
                <View style={styles.rankCircle}>
                  <Text style={styles.rankNumber}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.mentorName}>{m.name}</Text>
                  <Text style={styles.mentorSub}>{m.city}</Text>
                </View>
                <View style={styles.mentorStats}>
                  <Text style={styles.mentorStatValue}>{m.total}</Text>
                  <Text style={styles.mentorStatLabel}>{t("statistics.mentorships")}</Text>
                </View>
                <View style={styles.mentorStats}>
                  <Text style={[styles.mentorStatValue, { color: COLORS.cta }]}>{m.completed}</Text>
                  <Text style={styles.mentorStatLabel}>{t("statistics.completed")}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Städte-Verteilung */}
        <Text style={styles.sectionLabel}>{t("statistics.cityDistribution").toUpperCase()}</Text>
        {stats.topCities.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("statistics.noData")}</Text>
          </View>
        ) : (
          <View style={[styles.card, { marginBottom: 40 }]}>
            {stats.topCities.map(([city, count], idx) => {
              const maxCount = stats.topCities[0][1];
              const pct = Math.round((count / maxCount) * 100);
              return (
                <View
                  key={city}
                  style={[styles.cityRow, idx < stats.topCities.length - 1 ? styles.rowBorder : {}]}
                >
                  <Text style={styles.cityName}>{city}</Text>
                  <View style={styles.cityBarWrap}>
                    <View style={[styles.cityBar, { width: `${pct}%` as any }]} />
                  </View>
                  <Text style={styles.cityCount}>{count}</Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={kpiStyles.card}>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={kpiStyles.label}>{label}</Text>
    </View>
  );
}

function StatusRow({
  label,
  count,
  total,
  color,
  bg,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
  bg: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={styles.statusRow}>
      <View style={[styles.statusDot, { backgroundColor: bg }]}>
        <Text style={[styles.statusDotText, { color }]}>{count}</Text>
      </View>
      <Text style={styles.statusLabel}>{label}</Text>
      <Text style={[styles.statusPct, { color }]}>{pct}%</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  value: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  label: { color: COLORS.tertiary, fontSize: 11, textAlign: "center" },
});

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  denied: { color: COLORS.error, textAlign: "center", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backBtn: { paddingRight: 8 },
  backBtnText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  pageTitle: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },
  kpiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: { color: COLORS.tertiary, fontSize: 14 },
  reasonText: { color: COLORS.secondary, fontSize: 14, padding: 14, lineHeight: 20 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotText: { fontWeight: "700", fontSize: 14 },
  statusLabel: { flex: 1, color: COLORS.secondary, fontSize: 14 },
  statusCount: { fontWeight: "700", fontSize: 16 },
  statusPct: { fontWeight: "600", fontSize: 14 },
  mentorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: { color: COLORS.secondary, fontWeight: "700", fontSize: 13 },
  mentorName: { fontWeight: "600", color: COLORS.primary, fontSize: 14 },
  mentorSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  mentorStats: { alignItems: "center", minWidth: 44 },
  mentorStatValue: { fontWeight: "700", fontSize: 16, color: COLORS.primary },
  mentorStatLabel: { color: COLORS.tertiary, fontSize: 10 },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  cityName: { color: COLORS.primary, fontWeight: "500", fontSize: 13, width: 90 },
  cityBarWrap: {
    flex: 1,
    height: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 4,
    overflow: "hidden",
  },
  cityBar: { height: "100%", backgroundColor: COLORS.gradientStart, borderRadius: 4 },
  cityCount: { color: COLORS.secondary, fontSize: 13, fontWeight: "600", minWidth: 24, textAlign: "right" },
});
