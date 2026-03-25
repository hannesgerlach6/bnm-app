import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { Container } from "../../components/Container";

export default function StatisticsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { users, mentorships, sessions, feedback, sessionTypes } = useData();

  // Nur Admin oder Office
  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.denied, { color: themeColors.error }]}>{t("statistics.accessDenied")}</Text>
      </View>
    );
  }

  return <StatisticsContent />;
}

function StatisticsContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
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
    <Container fullWidth={Platform.OS === "web"}>
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>{t("statistics.back")}</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("statistics.title")}</Text>
          </View>
        </View>

        {/* Gesamtstatistiken */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("statistics.overallStats")}</Text>

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
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <StatusRow
            label={t("statistics.completed")}
            count={stats.completedCount}
            total={stats.totalMentorships}
            colorLight="#15803d"
            colorDark="#4ade80"
            bgLight="#dcfce7"
            bgDark="#1a3a2a"
          />
          <StatusRow
            label={t("statistics.cancelled")}
            count={stats.cancelledCount}
            total={stats.totalMentorships}
            colorLight="#b91c1c"
            colorDark="#f87171"
            bgLight="#fee2e2"
            bgDark="#3a1a1a"
          />
          <View style={[styles.statusRow, { borderBottomWidth: 0, borderBottomColor: themeColors.border }]}>
            <Text style={[styles.statusLabel, { color: themeColors.textSecondary }]}>{t("statistics.total")}</Text>
            <Text style={[styles.statusCount, { color: themeColors.text }]}>
              {stats.totalMentorships}
            </Text>
          </View>
        </View>

        {/* Häufigster Abbruchgrund */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("statistics.topCancellationReason").toUpperCase()}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.reasonText, { color: themeColors.textSecondary }]}>{stats.topCancellationReason}</Text>
        </View>

        {/* Top-Mentoren */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("statistics.mentorRanking")}</Text>
        {stats.mentorCounts.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("statistics.noData")}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {stats.mentorCounts.map((m, idx) => (
              <View
                key={idx}
                style={[styles.mentorRow, idx < stats.mentorCounts.length - 1 ? [styles.rowBorder, { borderBottomColor: themeColors.border }] : {}]}
              >
                <View style={[styles.rankCircle, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                  <Text style={[styles.rankNumber, { color: themeColors.textSecondary }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mentorName, { color: themeColors.text }]}>{m.name}</Text>
                  <Text style={[styles.mentorSub, { color: themeColors.textTertiary }]}>{m.city}</Text>
                </View>
                <View style={styles.mentorStats}>
                  <Text style={[styles.mentorStatValue, { color: themeColors.text }]}>{m.total}</Text>
                  <Text style={[styles.mentorStatLabel, { color: themeColors.textTertiary }]}>{t("statistics.mentorships")}</Text>
                </View>
                <View style={styles.mentorStats}>
                  <Text style={[styles.mentorStatValue, { color: COLORS.cta }]}>{m.completed}</Text>
                  <Text style={[styles.mentorStatLabel, { color: themeColors.textTertiary }]}>{t("statistics.completed")}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Städte-Verteilung */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("statistics.cityDistribution").toUpperCase()}</Text>
        {stats.topCities.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("statistics.noData")}</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginBottom: 40 }]}>
            {stats.topCities.map(([city, count], idx) => {
              const maxCount = stats.topCities[0][1];
              const pct = Math.round((count / maxCount) * 100);
              return (
                <View
                  key={city}
                  style={[styles.cityRow, idx < stats.topCities.length - 1 ? [styles.rowBorder, { borderBottomColor: themeColors.border }] : {}]}
                >
                  <Text style={[styles.cityName, { color: themeColors.text }]}>{city}</Text>
                  <View style={[styles.cityBarWrap, { backgroundColor: themeColors.background }]}>
                    <View style={[styles.cityBar, { width: `${pct}%` as any }]} />
                  </View>
                  <Text style={[styles.cityCount, { color: themeColors.textSecondary }]}>{count}</Text>
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

function KPICard({ label, value, color }: { label: string; value: string; color: string }) {
  const themeColors = useThemeColors();
  return (
    <View style={[kpiStyles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <Text style={[kpiStyles.value, { color }]}>{value}</Text>
      <Text style={[kpiStyles.label, { color: themeColors.textTertiary }]}>{label}</Text>
    </View>
  );
}

function StatusRow({
  label,
  count,
  total,
  colorLight,
  colorDark,
  bgLight,
  bgDark,
}: {
  label: string;
  count: number;
  total: number;
  colorLight: string;
  colorDark: string;
  bgLight: string;
  bgDark: string;
}) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const color = isDark ? colorDark : colorLight;
  const bg = isDark ? bgDark : bgLight;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <View style={[styles.statusRow, { borderBottomColor: themeColors.border }]}>
      <View style={[styles.statusDot, { backgroundColor: bg }]}>
        <Text style={[styles.statusDotText, { color }]}>{count}</Text>
      </View>
      <Text style={[styles.statusLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statusPct, { color }]}>{pct}%</Text>
    </View>
  );
}

const kpiStyles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: "44%",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
    marginBottom: 10,
  },
  value: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  label: { fontSize: 11, textAlign: "center" },
});

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  denied: { textAlign: "center", fontSize: 14 },
  header: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 20 },
  backBtn: { paddingRight: 8 },
  backBtnText: { fontSize: 16, fontWeight: "500" },
  pageTitle: { fontSize: 20, fontWeight: "700" },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
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
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  emptyCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: { fontSize: 14 },
  reasonText: { fontSize: 14, padding: 14, lineHeight: 20 },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  statusDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDotText: { fontWeight: "700", fontSize: 14 },
  statusLabel: { flex: 1, fontSize: 14 },
  statusCount: { fontWeight: "700", fontSize: 16 },
  statusPct: { fontWeight: "600", fontSize: 14 },
  mentorRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  rowBorder: { borderBottomWidth: 1 },
  rankCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankNumber: { fontWeight: "700", fontSize: 13 },
  mentorName: { fontWeight: "600", fontSize: 14 },
  mentorSub: { fontSize: 12, marginTop: 2 },
  mentorStats: { alignItems: "center", minWidth: 44 },
  mentorStatValue: { fontWeight: "700", fontSize: 16 },
  mentorStatLabel: { fontSize: 10 },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  cityName: { fontWeight: "500", fontSize: 13, width: 90 },
  cityBarWrap: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  cityBar: { height: "100%", backgroundColor: COLORS.gradientStart, borderRadius: 4 },
  cityCount: { fontSize: 13, fontWeight: "600", minWidth: 24, textAlign: "right" },
});
