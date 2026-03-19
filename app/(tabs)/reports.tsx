import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Platform,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { showSuccess } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

const QUARTERS = [
  { label: "Q1 (Jan–Mrz)", months: [0, 1, 2] },
  { label: "Q2 (Apr–Jun)", months: [3, 4, 5] },
  { label: "Q3 (Jul–Sep)", months: [6, 7, 8] },
  { label: "Q4 (Okt–Dez)", months: [9, 10, 11] },
];

type PeriodMode = "month" | "quarter" | "year";

function getQuarterIndex(month: number): number {
  return Math.floor(month / 3);
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { mentorships, sessions, sessionTypes, users, mentorOfMonthVisible, toggleMentorOfMonth, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(getQuarterIndex(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const years = [2024, 2025, 2026];

  const inPeriod = useMemo(() => {
    return (dateStr: string): boolean => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth();
      if (year !== selectedYear) return false;
      if (periodMode === "month") return month === selectedMonth;
      if (periodMode === "quarter") return QUARTERS[selectedQuarter].months.includes(month);
      return true;
    };
  }, [periodMode, selectedMonth, selectedQuarter, selectedYear]);

  const kpis = useMemo(() => {
    const totalAssigned = mentorships.filter((m) => inPeriod(m.assigned_at)).length;
    const firstContactTypeId = sessionTypes.find((st) => st.name === "Erstkontakt")?.id ?? "st-3";
    const firstContacts = sessions.filter((s) => s.session_type_id === firstContactTypeId && inPeriod(s.date)).length;
    const firstMeetingTypeId = sessionTypes.find((st) => st.name === "Ersttreffen")?.id ?? "st-4";
    const firstMeetings = sessions.filter((s) => s.session_type_id === firstMeetingTypeId && inPeriod(s.date)).length;
    const bnmBoxTypeId = sessionTypes.find((st) => st.name === "BNM-Box")?.id ?? "st-5";
    const bnmBoxes = sessions.filter((s) => s.session_type_id === bnmBoxTypeId && inPeriod(s.date)).length;
    const totalSessions = sessions.filter((s) => inPeriod(s.date)).length;
    const completions = mentorships.filter((m) => m.status === "completed" && m.completed_at && inPeriod(m.completed_at)).length;
    const cancellations = mentorships.filter((m) => m.status === "cancelled" && m.completed_at && inPeriod(m.completed_at)).length;

    return { totalAssigned, firstContacts, firstMeetings, bnmBoxes, totalSessions, completions, cancellations };
  }, [inPeriod, mentorships, sessions, sessionTypes]);

  const mentorOfMonth = useMemo(() => {
    if (!mentorOfMonthVisible) return null;
    const mentors = users.filter((u) => u.role === "mentor");
    let best: { mentor: typeof mentors[0]; count: number } | null = null;
    for (const mentor of mentors) {
      const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
      const mySessionCount = sessions.filter(
        (s) => myMentorships.some((m) => m.id === s.mentorship_id) && inPeriod(s.date)
      ).length;
      if (!best || mySessionCount > best.count) {
        best = { mentor, count: mySessionCount };
      }
    }
    return best && best.count > 0 ? best : null;
  }, [inPeriod, users, mentorships, sessions, mentorOfMonthVisible]);

  const barChartData = useMemo(() => {
    if (periodMode === "month") {
      const weeks: { label: string; count: number }[] = [
        { label: "W1", count: 0 },
        { label: "W2", count: 0 },
        { label: "W3", count: 0 },
        { label: "W4", count: 0 },
      ];
      sessions.forEach((s) => {
        const d = new Date(s.date);
        if (d.getMonth() === selectedMonth && d.getFullYear() === selectedYear) {
          const week = Math.min(Math.floor((d.getDate() - 1) / 7), 3);
          weeks[week].count += 1;
        }
      });
      return weeks;
    } else if (periodMode === "quarter") {
      return QUARTERS[selectedQuarter].months.map((mIdx) => {
        const count = sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === selectedYear && d.getMonth() === mIdx;
        }).length;
        return { label: MONTHS[mIdx].slice(0, 3), count };
      });
    } else {
      return MONTHS.map((m, idx) => {
        const count = sessions.filter((s) => {
          const d = new Date(s.date);
          return d.getFullYear() === selectedYear && d.getMonth() === idx;
        }).length;
        return { label: m.slice(0, 3), count };
      });
    }
  }, [periodMode, selectedMonth, selectedQuarter, selectedYear, sessions]);

  const maxBarValue = Math.max(...barChartData.map((w) => w.count), 1);

  const monthlyData = useMemo(() => {
    return MONTHS.map((m, idx) => {
      const count = sessions.filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === selectedYear && d.getMonth() === idx;
      }).length;
      return { month: m, count };
    });
  }, [selectedYear, sessions]);

  const periodLabel = useMemo(() => {
    if (periodMode === "month") return `${MONTHS[selectedMonth]} ${selectedYear}`;
    if (periodMode === "quarter") return `${QUARTERS[selectedQuarter].label} ${selectedYear}`;
    return `Jahr ${selectedYear}`;
  }, [periodMode, selectedMonth, selectedQuarter, selectedYear]);

  function handleExport() {
    const header = "Zeitraum,Neue Betreuungen,Erstkontakte,Ersttreffen,BNM-Boxen,Sessions,Abschlüsse,Abbrüche";
    const row = [
      `"${periodLabel}"`,
      kpis.totalAssigned,
      kpis.firstContacts,
      kpis.firstMeetings,
      kpis.bnmBoxes,
      kpis.totalSessions,
      kpis.completions,
      kpis.cancellations,
    ].join(",");
    const csvContent = `${header}\n${row}`;

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BNM-Bericht-${periodLabel.replace(/\s/g, "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      showSuccess(`Der Bericht für "${periodLabel}" wurde als CSV generiert.\n\nFür nativen Download wird expo-sharing benötigt (Post-Launch).`);
    }
  }

  function handleSpendenReport() {
    const header = "Monat,Sessions";
    const rows = monthlyData.map((d) => `"${d.month} ${selectedYear}",${d.count}`).join("\n");
    const total = monthlyData.reduce((s, d) => s + d.count, 0);
    const sumRow = `"GESAMT ${selectedYear}",${total}`;
    const csvContent = `${header}\n${rows}\n${sumRow}`;

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BNM-Spenderbericht-${selectedYear}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const report = monthlyData
        .map((d) => `${d.month}: ${d.count} Sessions`)
        .join("\n");
      showSuccess(`${report}\n\nGesamt: ${total} Sessions`);
    }
  }

  const isOffice = user?.role === "office";
  const isAdminOrOffice = user?.role === "admin" || isOffice;

  if (!isAdminOrOffice) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>{t("reports.accessDenied")}</Text>
      </View>
    );
  }

  return (
    <Container>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <Text style={styles.pageTitle}>{t("reports.title")}</Text>
          <Text style={styles.pageSubtitle}>{t("reports.subtitle")}</Text>

          {/* Zeitraum-Auswahl */}
          <View style={styles.card}>
            <Text style={styles.cardSectionLabel}>{t("reports.periodLabel")}</Text>

            {/* Modus-Toggle */}
            <View style={styles.modeRow}>
              {(
                [
                  { key: "month", label: t("reports.month") },
                  { key: "quarter", label: t("reports.quarter") },
                  { key: "year", label: t("reports.year") },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.modeButton,
                    periodMode === opt.key ? styles.modeButtonActive : styles.modeButtonInactive,
                  ]}
                  onPress={() => setPeriodMode(opt.key)}
                >
                  <Text
                    style={
                      periodMode === opt.key ? styles.modeTextActive : styles.modeTextInactive
                    }
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Jahr-Auswahl */}
            <View style={styles.yearRow}>
              {years.map((year) => (
                <TouchableOpacity
                  key={year}
                  style={[
                    styles.yearButton,
                    selectedYear === year ? styles.yearButtonActive : styles.yearButtonInactive,
                  ]}
                  onPress={() => setSelectedYear(year)}
                >
                  <Text
                    style={
                      selectedYear === year ? styles.yearButtonTextActive : styles.yearButtonTextInactive
                    }
                  >
                    {year}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Monats-Auswahl */}
            {periodMode === "month" && (
              <View style={styles.monthRow}>
                {MONTHS.map((month, idx) => (
                  <TouchableOpacity
                    key={month}
                    style={[
                      styles.monthChip,
                      selectedMonth === idx ? styles.monthChipActive : styles.monthChipInactive,
                    ]}
                    onPress={() => setSelectedMonth(idx)}
                  >
                    <Text
                      style={
                        selectedMonth === idx ? styles.monthChipTextActive : styles.monthChipTextInactive
                      }
                    >
                      {month.slice(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quartals-Auswahl */}
            {periodMode === "quarter" && (
              <View style={styles.quarterRow}>
                {QUARTERS.map((q, idx) => (
                  <TouchableOpacity
                    key={q.label}
                    style={[
                      styles.quarterChip,
                      selectedQuarter === idx ? styles.monthChipActive : styles.monthChipInactive,
                    ]}
                    onPress={() => setSelectedQuarter(idx)}
                  >
                    <Text
                      style={
                        selectedQuarter === idx ? styles.monthChipTextActive : styles.monthChipTextInactive
                      }
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Ausgewählter Zeitraum */}
          <Text style={styles.periodTitle}>{periodLabel}</Text>

          {/* Empty State: Noch keine Daten in diesem Zeitraum */}
          {kpis.totalSessions === 0 && kpis.totalAssigned === 0 && mentorships.length === 0 && (
            <View style={styles.emptyDataBox}>
              <Text style={styles.emptyDataText}>{t("reports.noData")}</Text>
            </View>
          )}

          {/* KPI-Karten mit Gold-Border links */}
          <View style={styles.kpiRow}>
            <KpiCard label={t("reports.newMentorships")} value={kpis.totalAssigned} color={COLORS.gradientStart} />
            <KpiCard label={t("reports.totalSessions")} value={kpis.totalSessions} color={COLORS.gradientStart} />
          </View>
          <View style={styles.kpiRow}>
            <KpiCard label={t("reports.firstContacts")} value={kpis.firstContacts} color={COLORS.gold} />
            <KpiCard label={t("reports.firstMeetings")} value={kpis.firstMeetings} color={COLORS.gold} />
          </View>
          <View style={[styles.kpiRow, { marginBottom: 16 }]}>
            <KpiCard label={t("reports.bnmBoxes")} value={kpis.bnmBoxes} color={COLORS.secondary} />
            <KpiCard label={t("reports.completions")} value={kpis.completions} color={COLORS.cta} />
          </View>

          {/* Abbrüche */}
          {kpis.cancellations > 0 && (
            <View style={styles.cancellationBox}>
              <Text style={styles.cancellationLabel}>{t("reports.cancellations")}</Text>
              <Text style={styles.cancellationValue}>{kpis.cancellations}</Text>
            </View>
          )}

          {/* Balkendiagramm – dunkler Hintergrund */}
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>
              {periodMode === "month" ? t("reports.sessionsPerWeek") : periodMode === "quarter" ? t("reports.sessionsPerMonth") : t("reports.sessionsPerYear")}
            </Text>
            <View style={styles.barChartContainer}>
              {barChartData.map((bar) => {
                const heightPercent = maxBarValue > 0 ? (bar.count / maxBarValue) * 100 : 0;
                return (
                  <View key={bar.label} style={styles.barColumn}>
                    <Text style={styles.barValueText}>{bar.count}</Text>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          { height: (Math.max(heightPercent, 4) + "%") as any },
                        ]}
                      />
                    </View>
                    <Text style={styles.barLabel}>{bar.label}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Mentor des Monats */}
          {mentorOfMonth ? (
            <View style={styles.goldBox}>
              <View style={styles.goldBoxHeader}>
                <Text style={styles.goldStar}>★</Text>
                <Text style={styles.goldBoxTitle}>{t("reports.mentorOfPeriod")}</Text>
              </View>
              <Text style={styles.goldMentorName}>{mentorOfMonth.mentor.name}</Text>
              <Text style={styles.goldMentorSub}>
                {t("reports.sessionsDocumented").replace("{0}", String(mentorOfMonth.count)).replace("{1}", mentorOfMonth.count !== 1 ? "s" : "")}
              </Text>
            </View>
          ) : (
            !mentorOfMonthVisible ? null : (
              <View style={styles.emptyMonthBox}>
                <Text style={styles.emptyMonthText}>
                  {t("reports.noSessionsYet")}
                </Text>
              </View>
            )
          )}

          {/* Mentor des Monats Toggle – nur für Admin */}
          {!isOffice && (
            <TouchableOpacity
              style={styles.toggleMomButton}
              onPress={toggleMentorOfMonth}
            >
              <Text style={styles.toggleMomText}>
                {mentorOfMonthVisible
                  ? t("reports.hideMentorOfMonth")
                  : t("reports.showMentorOfMonth")}
              </Text>
            </TouchableOpacity>
          )}

          {/* Export-Button – Primär */}
          <TouchableOpacity
            style={styles.exportButton}
            onPress={handleExport}
          >
            <Text style={styles.exportButtonText}>
              {Platform.OS === "web" ? t("reports.csvDownload") : t("reports.export")}
            </Text>
          </TouchableOpacity>

          {/* Spender-Bericht CSV – Sekundär (Outline) */}
          <TouchableOpacity
            style={styles.spendenButton}
            onPress={handleSpendenReport}
          >
            <Text style={styles.spendenButtonText}>
              {t("reports.donorReportCsv").replace("{0}", String(selectedYear))}
            </Text>
          </TouchableOpacity>

          {/* Spenderbericht visuell erstellen (einfache Version) */}
          <TouchableOpacity
            style={styles.donorReportButton}
            onPress={() => router.push("/donor-report" as never)}
          >
            <Text style={styles.donorReportButtonText}>
              {t("reports.donorReportVisual")}
            </Text>
          </TouchableOpacity>

          {/* Erweitertes Spender-Bericht Dashboard (nur Admin) */}
          {user?.role === "admin" && (
            <TouchableOpacity
              style={styles.donorDashboardButton}
              onPress={() => router.push("/admin/donor-report" as never)}
            >
              <Text style={styles.donorDashboardButtonText}>
                Spender-Bericht Dashboard →
              </Text>
            </TouchableOpacity>
          )}

          {/* Bericht drucken (nur Web) */}
          {Platform.OS === "web" && (
            <TouchableOpacity
              style={styles.printButton}
              onPress={() => {
                if (typeof window !== "undefined") {
                  (window as Window).print();
                }
              }}
            >
              <Text style={styles.printButtonText}>🖨 {t("reports.print")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

function KpiCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <View style={styles.kpiCard}>
      <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  accessDeniedText: { color: COLORS.primary, fontWeight: "600" },
  page: { padding: 20 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 13, marginBottom: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardSectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 12 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeButton: { flex: 1, paddingVertical: 9, borderRadius: 5, borderWidth: 1, alignItems: "center" },
  modeButtonActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  modeButtonInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  modeTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  modeTextInactive: { color: COLORS.secondary, fontSize: 13 },
  yearRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  yearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 5, borderWidth: 1 },
  yearButtonActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  yearButtonInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  yearButtonTextActive: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  yearButtonTextInactive: { color: COLORS.secondary, fontSize: 14, fontWeight: "600" },
  monthRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 4, borderWidth: 1 },
  monthChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  monthChipInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  monthChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  monthChipTextInactive: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },
  quarterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quarterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 4, borderWidth: 1 },
  periodTitle: { color: COLORS.primary, fontWeight: "700", fontSize: 20, marginBottom: 16 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  kpiLabel: { color: COLORS.secondary, fontSize: 12, marginBottom: 2 },
  kpiValue: { fontSize: 26, fontWeight: "700" },
  cancellationBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancellationLabel: { color: "#b91c1c", fontWeight: "600" },
  cancellationValue: { color: "#b91c1c", fontWeight: "700", fontSize: 22 },
  chartCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  chartTitle: { fontWeight: "700", color: COLORS.white, marginBottom: 16, fontSize: 15 },
  barChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 128,
    justifyContent: "space-around",
  },
  barColumn: { alignItems: "center", flex: 1 },
  barValueText: { color: "rgba(255,255,255,0.8)", fontSize: 11, marginBottom: 4 },
  barTrack: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 4,
    overflow: "hidden",
    height: 96,
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", backgroundColor: COLORS.gold, borderRadius: 4 },
  barLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, marginTop: 4 },
  goldBox: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  goldBoxHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  goldStar: { color: COLORS.gold, fontSize: 24, marginRight: 8 },
  goldBoxTitle: { fontWeight: "700", color: COLORS.primary },
  goldMentorName: { fontSize: 20, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  goldMentorSub: { color: COLORS.secondary, fontSize: 14 },
  emptyDataBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  emptyDataText: { color: "#92400e", fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyMonthBox: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  emptyMonthText: { color: COLORS.tertiary, fontSize: 14, textAlign: "center" },
  toggleMomButton: {
    borderWidth: 1,
    borderColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  toggleMomText: { color: COLORS.gradientStart, fontWeight: "600", fontSize: 14 },
  exportButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  exportButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  spendenButton: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  spendenButtonText: { color: COLORS.gold, fontWeight: "700" },
  donorReportButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  donorReportButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  donorDashboardButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  donorDashboardButtonText: { color: COLORS.gold, fontWeight: "700", fontSize: 14 },
  printButton: {
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  printButtonText: { color: COLORS.secondary, fontWeight: "600", fontSize: 13 },
});
