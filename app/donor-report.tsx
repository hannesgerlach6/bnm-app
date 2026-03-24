/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo } from "react";
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
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { COLORS } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const QUARTERS = [
  { label: "Q1 (Jan–Mrz)", short: "Q1", months: [0, 1, 2] },
  { label: "Q2 (Apr–Jun)", short: "Q2", months: [3, 4, 5] },
  { label: "Q3 (Jul–Sep)", short: "Q3", months: [6, 7, 8] },
  { label: "Q4 (Okt–Dez)", short: "Q4", months: [9, 10, 11] },
];

type PeriodMode = "quarter" | "year";

export default function DonorReportScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { mentorships, sessions, sessionTypes, users, mentorOfMonthVisible } = useData();

  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("quarter");
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const years = [2024, 2025, 2026];

  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";

  if (!isAdminOrOffice) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("donorReport.accessDenied")}</Text>
      </View>
    );
  }

  const inPeriod = useMemo(() => {
    return (dateStr: string): boolean => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth();
      if (year !== selectedYear) return false;
      if (periodMode === "quarter") return QUARTERS[selectedQuarter].months.includes(month);
      return true;
    };
  }, [periodMode, selectedQuarter, selectedYear]);

  const periodLabel = useMemo(() => {
    if (periodMode === "quarter") {
      return t("donorReport.periodLabelQuarter")
        .replace("{0}", QUARTERS[selectedQuarter].short)
        .replace("{1}", String(selectedYear));
    }
    return t("donorReport.periodLabelYear").replace("{0}", String(selectedYear));
  }, [periodMode, selectedQuarter, selectedYear, t]);

  const kpis = useMemo(() => {
    const totalMentorships = mentorships.filter((m) => inPeriod(m.assigned_at)).length;
    const completedMentorships = mentorships.filter(
      (m) => m.status === "completed" && m.completed_at && inPeriod(m.completed_at)
    ).length;
    const cancelledMentorships = mentorships.filter(
      (m) => m.status === "cancelled" && m.completed_at && inPeriod(m.completed_at)
    ).length;
    const activeMentorships = mentorships.filter((m) => m.status === "active").length;
    const mentorCount = users.filter((u) => u.role === "mentor").length;
    const menteeCount = users.filter((u) => u.role === "mentee").length;
    const totalSessions = sessions.filter((s) => inPeriod(s.date)).length;
    const bnmBoxTypeId = sessionTypes.find((st) => st.name === "BNM-Box")?.id ?? "st-5";
    const bnmBoxes = sessions.filter((s) => s.session_type_id === bnmBoxTypeId && inPeriod(s.date)).length;
    const completionRate = totalMentorships > 0
      ? Math.round((completedMentorships / totalMentorships) * 100)
      : 0;
    const wuduSessions = sessions.filter((s) => s.session_type?.name === "Wudu-Session" && inPeriod(s.date)).length;
    const salahSessions = sessions.filter((s) => s.session_type?.name === "Salah-Session" && inPeriod(s.date)).length;
    const koranSessions = sessions.filter((s) => s.session_type?.name === "Koran-Session" && inPeriod(s.date)).length;
    const nachbetreuungSessions = sessions.filter((s) => s.session_type?.name === "Nachbetreuung" && inPeriod(s.date)).length;
    return {
      totalMentorships,
      completedMentorships,
      cancelledMentorships,
      activeMentorships,
      mentorCount,
      menteeCount,
      totalSessions,
      bnmBoxes,
      completionRate,
      wuduSessions,
      salahSessions,
      koranSessions,
      nachbetreuungSessions,
    };
  }, [inPeriod, mentorships, sessions, sessionTypes, users]);

  // Statusverteilung: aktiv, abgeschlossen, abgebrochen
  const statusDistribution = useMemo(() => {
    const active = mentorships.filter((m) => m.status === "active").length;
    const completed = mentorships.filter((m) => m.status === "completed").length;
    const cancelled = mentorships.filter((m) => m.status === "cancelled").length;
    const total = active + completed + cancelled;
    return {
      active: { count: active, percent: total > 0 ? Math.round((active / total) * 100) : 0 },
      completed: { count: completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 },
      cancelled: { count: cancelled, percent: total > 0 ? Math.round((cancelled / total) * 100) : 0 },
      total,
    };
  }, [mentorships]);

  // Monatsbalken für den gewählten Zeitraum
  const monthlyBarData = useMemo(() => {
    const targetMonths =
      periodMode === "quarter"
        ? QUARTERS[selectedQuarter].months
        : Array.from({ length: 12 }, (_, i) => i);
    return targetMonths.map((mIdx) => {
      const count = sessions.filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === selectedYear && d.getMonth() === mIdx;
      }).length;
      return { label: MONTHS[mIdx].slice(0, 3), count };
    });
  }, [periodMode, selectedQuarter, selectedYear, sessions]);

  const maxBarValue = Math.max(...monthlyBarData.map((d) => d.count), 1);

  // Session-Verteilung nach Typ
  const sessionDistribution = useMemo(() => {
    return sessionTypes
      .map((st) => ({
        name: st.name,
        count: sessions.filter((s) => s.session_type_id === st.id && inPeriod(s.date)).length,
      }))
      .filter((d) => d.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [sessionTypes, sessions, inPeriod]);

  const maxSessionCount = Math.max(...sessionDistribution.map((d) => d.count), 1);

  // Mentor des Monats/Zeitraums
  const mentorOfPeriod = useMemo(() => {
    if (!mentorOfMonthVisible) return null;
    const mentors = users.filter((u) => u.role === "mentor");
    let best: { mentor: typeof mentors[0]; count: number } | null = null;
    for (const mentor of mentors) {
      const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
      const myCount = sessions.filter(
        (s) => myMentorships.some((m) => m.id === s.mentorship_id) && inPeriod(s.date)
      ).length;
      if (!best || myCount > best.count) {
        best = { mentor, count: myCount };
      }
    }
    return best && best.count > 0 ? best : null;
  }, [inPeriod, users, mentorships, sessions, mentorOfMonthVisible]);

  // Auto-generierter Zusammenfassungstext
  const summaryText = useMemo(() => {
    const pLabel =
      periodMode === "quarter"
        ? `${QUARTERS[selectedQuarter].short} ${selectedYear}`
        : `Jahr ${selectedYear}`;
    const completionStr =
      kpis.totalMentorships > 0
        ? ` ${kpis.completedMentorships} davon erfolgreich abgeschlossen (${kpis.completionRate}%).`
        : "";
    const boxStr =
      kpis.bnmBoxes > 0
        ? ` ${kpis.bnmBoxes} BNM-Box${kpis.bnmBoxes !== 1 ? "en" : ""} wurden übergeben.`
        : "";
    const sessionStr = ` Insgesamt wurden ${kpis.totalSessions} Session${kpis.totalSessions !== 1 ? "s" : ""} dokumentiert.`;
    return `Im ${pLabel} wurden ${kpis.totalMentorships} neue Betreuung${kpis.totalMentorships !== 1 ? "en" : ""} gestartet.${completionStr}${sessionStr}${boxStr} Aktuell betreuen ${kpis.mentorCount} Mentor${kpis.mentorCount !== 1 ? "en" : ""} insgesamt ${kpis.menteeCount} Mentee${kpis.menteeCount !== 1 ? "s" : ""}.`;
  }, [kpis, periodMode, selectedQuarter, selectedYear]);

  return (
    <View style={[styles.flex1, { backgroundColor: themeColors.background }]}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.reportHeader, { paddingTop: insets.top + 28 }]}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>{t("donorReport.backToReports")}</Text>
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>BNM</Text>
          </View>
          <Text style={styles.reportTitle}>{periodLabel}</Text>
          <Text style={styles.reportSubtitle}>{t("donorReport.subtitle")}</Text>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.page}>
          {/* Zeitraum-Auswahl */}
          <View style={[styles.card, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.cardLabel, { color: themeColors.textTertiary }]}>{t("donorReport.period")}</Text>
            <View style={styles.modeRow}>
              {(["quarter", "year"] as const).map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[styles.modeBtn, periodMode === m ? styles.modeBtnActive : [styles.modeBtnInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }]]}
                  onPress={() => setPeriodMode(m)}
                >
                  <Text style={periodMode === m ? styles.modeBtnTextActive : [styles.modeBtnTextInactive, { color: themeColors.textSecondary }]}>
                    {m === "quarter" ? t("donorReport.quarter") : t("donorReport.year")}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.yearRow}>
              {years.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.yearBtn, selectedYear === y ? styles.yearBtnActive : [styles.yearBtnInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }]]}
                  onPress={() => setSelectedYear(y)}
                >
                  <Text style={selectedYear === y ? styles.yearBtnTextActive : [styles.yearBtnTextInactive, { color: themeColors.textSecondary }]}>
                    {y}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {periodMode === "quarter" && (
              <View style={styles.quarterRow}>
                {QUARTERS.map((q, idx) => (
                  <TouchableOpacity
                    key={q.short}
                    style={[styles.quarterBtn, selectedQuarter === idx ? styles.quarterBtnActive : [styles.quarterBtnInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }]]}
                    onPress={() => setSelectedQuarter(idx)}
                  >
                    <Text style={selectedQuarter === idx ? styles.quarterBtnTextActive : [styles.quarterBtnTextInactive, { color: themeColors.textSecondary }]}>
                      {q.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Übersichts-KPIs */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{t("donorReport.overview")}</Text>
          </View>
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: themeColors.text }]}>{kpis.totalMentorships}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.newMentorships")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.cta }]}>{kpis.completedMentorships}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.completions")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gold }]}>{kpis.mentorCount}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.mentors")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gradientStart }]}>{kpis.menteeCount}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.mentees")}</Text>
            </View>
          </View>
          <View style={styles.kpiRow2}>
            <View style={[styles.kpiCard, { flex: 1, backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gradientStart }]}>{kpis.totalSessions}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.totalSessions")}</Text>
            </View>
            <View style={[styles.kpiCard, { flex: 1, backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gold }]}>{kpis.bnmBoxes}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.bnmBoxes")}</Text>
            </View>
            <View style={[styles.kpiCard, { flex: 1, backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: kpis.completionRate >= 50 ? COLORS.cta : COLORS.error }]}>
                {kpis.completionRate}%
              </Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("donorReport.completionRate")}</Text>
            </View>
          </View>

          {/* Wudu / Salah / Koran / Nachbetreuung KPIs */}
          <View style={styles.kpiGrid}>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gradientStart }]}>{kpis.wuduSessions}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("reports.wuduSessions")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gradientStart }]}>{kpis.salahSessions}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("reports.salahSessions")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gold }]}>{kpis.koranSessions}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("reports.koranSessions")}</Text>
            </View>
            <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.kpiValue, { color: COLORS.gold }]}>{kpis.nachbetreuungSessions}</Text>
              <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]}>{t("reports.nachbetreuungSessions")}</Text>
            </View>
          </View>

          {/* Statusverteilung (View-basiertes Balken-Diagramm) */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{t("donorReport.statusOverview")}</Text>
          </View>
          <View style={styles.chartCard}>
            <View style={styles.statusBarRow}>
              {/* Aktiv */}
              <View style={styles.statusBarItem}>
                <View style={styles.statusBarTrack}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        height: `${statusDistribution.active.percent}%` as any,
                        backgroundColor: COLORS.gold,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statusBarValue}>{statusDistribution.active.count}</Text>
                <Text style={styles.statusBarPercent}>{statusDistribution.active.percent}%</Text>
                <Text style={styles.statusBarLabel}>{t("donorReport.statusActive")}</Text>
              </View>
              {/* Abgeschlossen */}
              <View style={styles.statusBarItem}>
                <View style={styles.statusBarTrack}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        height: `${statusDistribution.completed.percent}%` as any,
                        backgroundColor: COLORS.cta,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statusBarValue}>{statusDistribution.completed.count}</Text>
                <Text style={styles.statusBarPercent}>{statusDistribution.completed.percent}%</Text>
                <Text style={styles.statusBarLabel}>{t("donorReport.statusCompleted")}</Text>
              </View>
              {/* Abgebrochen */}
              <View style={styles.statusBarItem}>
                <View style={styles.statusBarTrack}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        height: `${Math.max(statusDistribution.cancelled.percent, 4)}%` as any,
                        backgroundColor: COLORS.error,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statusBarValue}>{statusDistribution.cancelled.count}</Text>
                <Text style={styles.statusBarPercent}>{statusDistribution.cancelled.percent}%</Text>
                <Text style={styles.statusBarLabel}>{t("donorReport.statusCancelled")}</Text>
              </View>
            </View>
            <Text style={styles.chartSubNote}>{t("donorReport.total").replace("{0}", String(statusDistribution.total))}</Text>
          </View>

          {/* Monatsvergleich Balkendiagramm */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>
              {periodMode === "quarter" ? t("donorReport.sessionsPerMonth") : t("donorReport.sessionsPerYear")}
            </Text>
          </View>
          <View style={styles.chartCard}>
            <View style={styles.barChartContainer}>
              {monthlyBarData.map((bar) => {
                const heightPct = maxBarValue > 0 ? (bar.count / maxBarValue) * 100 : 0;
                return (
                  <View key={bar.label} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{bar.count}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: (Math.max(heightPct, 4) + "%") as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{bar.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Session-Verteilung (horizontale Balken) */}
          {sessionDistribution.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{t("donorReport.sessionDistribution")}</Text>
              </View>
              <View style={[styles.card, { backgroundColor: themeColors.card }]}>
                {sessionDistribution.map((item) => {
                  const widthPct = Math.max((item.count / maxSessionCount) * 100, 4);
                  return (
                    <View key={item.name} style={styles.hBarRow}>
                      <Text style={[styles.hBarLabel, { color: themeColors.text }]} numberOfLines={1}>{item.name}</Text>
                      <View style={[styles.hBarTrack, { backgroundColor: themeColors.background }]}>
                        <View
                          style={[styles.hBarFill, { width: `${widthPct}%` as any }]}
                        />
                      </View>
                      <Text style={[styles.hBarCount, { color: themeColors.text }]}>{item.count}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* Mentor des Zeitraums */}
          {mentorOfPeriod && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionHeaderText}>{t("donorReport.mentorOfPeriod")}</Text>
              </View>
              <View style={[styles.goldBox, { backgroundColor: themeColors.card }]}>
                <Text style={styles.goldStar}>★</Text>
                <Text style={[styles.goldMentorName, { color: themeColors.text }]}>{mentorOfPeriod.mentor.name}</Text>
                <Text style={[styles.goldMentorCity, { color: themeColors.textSecondary }]}>{mentorOfPeriod.mentor.city}</Text>
                <Text style={[styles.goldMentorSessions, { color: themeColors.textSecondary }]}>
                  {t("donorReport.mentorSessions")
                    .replace("{0}", String(mentorOfPeriod.count))
                    .replace("{1}", mentorOfPeriod.count !== 1 ? "s" : "")}
                </Text>
              </View>
            </>
          )}

          {/* Zusammenfassung */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{t("donorReport.summary")}</Text>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.summaryText, { color: themeColors.text }]}>{summaryText}</Text>
          </View>

          {/* Buttons */}
          {Platform.OS === "web" && (
            <TouchableOpacity
              style={styles.printButton}
              onPress={() => {
                if (typeof window !== "undefined") {
                  (window as Window).print();
                }
              }}
            >
              <Text style={styles.printButtonText}>🖨 {t("donorReport.print")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.backBtn, { borderColor: themeColors.border }]} onPress={() => router.back()}>
            <Text style={[styles.backBtnText, { color: themeColors.textSecondary }]}>{t("donorReport.backToReports")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },

  // Header
  reportHeader: {
    backgroundColor: COLORS.gradientStart,
    paddingTop: 48,
    paddingBottom: 28,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 16,
  },
  backButtonText: { color: "rgba(255,255,255,0.75)", fontSize: 14 },
  logoBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: COLORS.white, fontWeight: "800", fontSize: 18, letterSpacing: 2 },
  reportTitle: { color: COLORS.white, fontSize: 20, fontWeight: "700", textAlign: "center", marginBottom: 4 },
  reportSubtitle: { color: "rgba(255,255,255,0.65)", fontSize: 13, textAlign: "center" },
  goldLine: { marginTop: 16, width: 56, height: 3, backgroundColor: COLORS.gold, borderRadius: 2 },

  page: { padding: 16 },

  // Zeitraum
  card: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  cardLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  modeBtn: { flex: 1, paddingVertical: 8, borderRadius: 5, borderWidth: 1, alignItems: "center" },
  modeBtnActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  modeBtnInactive: {},
  modeBtnTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  modeBtnTextInactive: { fontSize: 13 },
  yearRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  yearBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 5, borderWidth: 1 },
  yearBtnActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  yearBtnInactive: {},
  yearBtnTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  yearBtnTextInactive: { fontSize: 13 },
  quarterRow: { flexDirection: "row", gap: 8 },
  quarterBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 5, borderWidth: 1 },
  quarterBtnActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  quarterBtnInactive: {},
  quarterBtnTextActive: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  quarterBtnTextInactive: { fontSize: 13 },

  // Sektion-Header
  sectionHeader: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  sectionHeaderText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },

  // KPI Grid
  kpiGrid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  kpiRow2: { flexDirection: "row", gap: 8, marginBottom: 16 },
  kpiCard: {
    flex: 1,
    borderRadius: 8,
    padding: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
    borderTopWidth: 3,
    borderTopColor: COLORS.gold,
  },
  kpiValue: { fontSize: 28, fontWeight: "800" },
  kpiLabel: { fontSize: 11, textAlign: "center", marginTop: 2 },

  // Chart Cards
  chartCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  chartSubNote: { color: "rgba(255,255,255,0.5)", fontSize: 12, textAlign: "center", marginTop: 8 },

  // Statusverteilung (3 vertikale Balken nebeneinander)
  statusBarRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "flex-end",
    gap: 16,
    height: 140,
  },
  statusBarItem: { alignItems: "center", flex: 1 },
  statusBarTrack: {
    width: "60%",
    height: 100,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  statusBarFill: { width: "100%", borderRadius: 4 },
  statusBarValue: { color: COLORS.white, fontWeight: "700", fontSize: 16 },
  statusBarPercent: { color: "rgba(255,255,255,0.7)", fontSize: 12 },
  statusBarLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, marginTop: 2 },

  // Monats-Balken
  barChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    height: 120,
    justifyContent: "space-around",
  },
  barColumn: { alignItems: "center", flex: 1 },
  barValueText: { color: "rgba(255,255,255,0.8)", fontSize: 10, marginBottom: 3 },
  barTrack: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
    height: 88,
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", backgroundColor: COLORS.gold, borderRadius: 3 },
  barLabel: { color: "rgba(255,255,255,0.6)", fontSize: 10, marginTop: 3 },

  // Horizontale Balken (Session-Verteilung)
  hBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  hBarLabel: { fontSize: 12, fontWeight: "500", width: 100, marginRight: 8 },
  hBarTrack: {
    flex: 1,
    height: 16,
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 8,
  },
  hBarFill: { height: "100%" as any, backgroundColor: COLORS.gradientStart, borderRadius: 3 },
  hBarCount: { fontWeight: "700", fontSize: 13, minWidth: 24, textAlign: "right" },

  // Gold Box (Mentor)
  goldBox: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  goldStar: { color: COLORS.gold, fontSize: 32, marginBottom: 6 },
  goldMentorName: { fontSize: 20, fontWeight: "700", marginBottom: 2 },
  goldMentorCity: { fontSize: 13, marginBottom: 4 },
  goldMentorSessions: { fontSize: 13 },

  // Zusammenfassung
  summaryCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  summaryText: { fontSize: 14, lineHeight: 22 },

  // Buttons
  printButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  printButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  backBtn: {
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 28,
  },
  backBtnText: { fontWeight: "600", fontSize: 13 },
});
