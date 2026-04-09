import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  Platform,
  RefreshControl,
  StyleSheet,
  Share,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError } from "../../lib/errorHandler";
import { Ionicons } from "@expo/vector-icons";
import type { ReportData } from "../../lib/pdfGenerator";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

// MONTHS and QUARTERS are now built inside the component using t()
// to support translations
const QUARTER_MONTHS = [
  { months: [0, 1, 2] },
  { months: [3, 4, 5] },
  { months: [6, 7, 8] },
  { months: [9, 10, 11] },
] as const;

type PeriodMode = "month" | "quarter" | "year";
type QuickPeriod = "thisMonth" | "lastMonth" | "thisQuarter" | "thisYear" | "custom";

function getQuarterIndex(month: number): number {
  return Math.floor(month / 3);
}

export default function ReportsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { mentorships, sessions, sessionTypes, users, mentorOfMonthVisible, toggleMentorOfMonth, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // useFocusEffect refreshData entfernt — Realtime reicht, Pull-to-Refresh als Fallback

  // Translated month names
  const MONTHS = [
    t("reports.months.jan"), t("reports.months.feb"), t("reports.months.mar"),
    t("reports.months.apr"), t("reports.months.may"), t("reports.months.jun"),
    t("reports.months.jul"), t("reports.months.aug"), t("reports.months.sep"),
    t("reports.months.oct"), t("reports.months.nov"), t("reports.months.dec"),
  ];

  // Translated quarter labels
  const QUARTERS = [
    { label: `Q1 (${t("reports.months.jan").slice(0,3)}–${t("reports.months.mar").slice(0,3)})`, months: QUARTER_MONTHS[0].months },
    { label: `Q2 (${t("reports.months.apr").slice(0,3)}–${t("reports.months.jun").slice(0,3)})`, months: QUARTER_MONTHS[1].months },
    { label: `Q3 (${t("reports.months.jul").slice(0,3)}–${t("reports.months.sep").slice(0,3)})`, months: QUARTER_MONTHS[2].months },
    { label: `Q4 (${t("reports.months.oct").slice(0,3)}–${t("reports.months.dec").slice(0,3)})`, months: QUARTER_MONTHS[3].months },
  ];

  const now = new Date();
  const [quickPeriod, setQuickPeriod] = useState<QuickPeriod>("thisMonth");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("month");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(getQuarterIndex(now.getMonth()));
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const years = [2024, 2025, 2026];

  // Wenn Quick-Filter sich ändert, PeriodMode + Selektionen synchronisieren
  function applyQuickPeriod(qp: QuickPeriod) {
    setQuickPeriod(qp);
    const n = new Date();
    if (qp === "thisMonth") {
      setPeriodMode("month");
      setSelectedMonth(n.getMonth());
      setSelectedYear(n.getFullYear());
    } else if (qp === "lastMonth") {
      setPeriodMode("month");
      const lastMonth = n.getMonth() === 0 ? 11 : n.getMonth() - 1;
      const lastMonthYear = n.getMonth() === 0 ? n.getFullYear() - 1 : n.getFullYear();
      setSelectedMonth(lastMonth);
      setSelectedYear(lastMonthYear);
    } else if (qp === "thisQuarter") {
      setPeriodMode("quarter");
      setSelectedQuarter(getQuarterIndex(n.getMonth()));
      setSelectedYear(n.getFullYear());
    } else if (qp === "thisYear") {
      setPeriodMode("year");
      setSelectedYear(n.getFullYear());
    }
    // "custom" → nichts ändern, User wählt selbst
  }

  const inPeriod = useMemo(() => {
    return (dateStr: string): boolean => {
      const d = new Date(dateStr);
      const year = d.getFullYear();
      const month = d.getMonth();
      if (year !== selectedYear) return false;
      if (periodMode === "month") return month === selectedMonth;
      if (periodMode === "quarter") return (QUARTERS[selectedQuarter].months as readonly number[]).includes(month);
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

    // Wudu / Salah / Koran / Nachbetreuung
    const wuduSessions = sessions.filter((s) => s.session_type?.name === "Wudu-Session" && inPeriod(s.date)).length;
    const salahSessions = sessions.filter((s) => s.session_type?.name === "Salah-Session" && inPeriod(s.date)).length;
    const koranSessions = sessions.filter((s) => s.session_type?.name === "Koran-Session" && inPeriod(s.date)).length;
    const nachbetreuungSessions = sessions.filter((s) => s.session_type?.name === "Nachbetreuung" && inPeriod(s.date)).length;

    return { totalAssigned, firstContacts, firstMeetings, bnmBoxes, totalSessions, completions, cancellations, wuduSessions, salahSessions, koranSessions, nachbetreuungSessions };
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
    return `${t("reports.year")} ${selectedYear}`;
  }, [periodMode, selectedMonth, selectedQuarter, selectedYear]);

  async function handleDownloadPDF() {
    if (Platform.OS !== "web") return;

    // Vormonat berechnen (gleiche Logik wie Dashboard)
    const prevMonthDate = new Date();
    prevMonthDate.setDate(1);
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = prevMonthDate.getMonth();
    const prevMonthYear = prevMonthDate.getFullYear();
    const inPrevMonth = (dateStr: string): boolean => {
      const d = new Date(dateStr);
      return d.getFullYear() === prevMonthYear && d.getMonth() === prevMonth;
    };

    // Mentoren-Rangliste berechnen (für den gewählten Zeitraum)
    const rankedMentors = users
      .filter((u) => u.role === "mentor")
      .map((mentor) => {
        const myMs = mentorships.filter((m) => m.mentor_id === mentor.id);
        const completed = myMs.filter(
          (m) => m.status === "completed" && m.completed_at && inPeriod(m.completed_at)
        ).length;
        const sessionCount = sessions.filter(
          (s) => myMs.some((m) => m.id === s.mentorship_id) && inPeriod(s.date)
        ).length;
        const score = completed * 10 + sessionCount * 3;
        const mentorFeedback = myMs.flatMap((ms) =>
          (ms as any).feedback ? [(ms as any).feedback] : []
        );
        const rating = mentorFeedback.length > 0
          ? mentorFeedback.reduce((sum: number, f: any) => sum + (f.rating ?? 0), 0) / mentorFeedback.length
          : null;
        return { mentor, score, completed, sessionCount, rating };
      })
      .sort((a, b) => b.score - a.score);

    // Mentor des Monats aus dem VORMONAT berechnen
    const prevMonthMentors = users
      .filter((u) => u.role === "mentor")
      .map((mentor) => {
        const myMs = mentorships.filter((m) => m.mentor_id === mentor.id);
        const completed = myMs.filter(
          (m) => m.status === "completed" && m.completed_at && inPrevMonth(m.completed_at)
        ).length;
        const sessionCount = sessions.filter(
          (s) => myMs.some((m) => m.id === s.mentorship_id) && inPrevMonth(s.date)
        ).length;
        const score = completed * 10 + sessionCount * 3;
        return { mentor, score, completed, sessionCount };
      })
      .sort((a, b) => b.score - a.score);

    const topMentorForPdf = prevMonthMentors.length > 0 && prevMonthMentors[0].score > 0
      ? prevMonthMentors[0]
      : rankedMentors.length > 0 && rankedMentors[0].score > 0
      ? rankedMentors[0]
      : null;

    const data: ReportData = {
      period: `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}`,
      periodLabel,
      kpis: {
        activeBetreuungen: mentorships.filter((m) => m.status === "active").length,
        abgeschlossen: kpis.completions,
        mentoren: users.filter((u) => u.role === "mentor").length,
        mentees: users.filter((u) => u.role === "mentee").length,
        sessions: kpis.totalSessions,
        neueBetreuungen: kpis.totalAssigned,
        wuduSessions: kpis.wuduSessions,
        salahSessions: kpis.salahSessions,
        koranSessions: kpis.koranSessions,
        nachbetreuung: kpis.nachbetreuungSessions,
      },
      mentorOfMonth: topMentorForPdf
        ? {
            name: topMentorForPdf.mentor.name,
            score: topMentorForPdf.score,
            sessions: topMentorForPdf.sessionCount,
            completed: topMentorForPdf.completed,
          }
        : null,
      rankings: rankedMentors.map((m, idx) => ({
        rank: idx + 1,
        name: m.mentor.name,
        score: m.score,
        sessions: m.sessionCount,
        completed: m.completed,
        rating: m.rating,
      })),
      summaryText: `Im ${periodLabel} wurden ${kpis.totalSessions} Sessions durchgeführt. ${kpis.totalAssigned} neue Betreuungen wurden gestartet und ${kpis.completions} Betreuungen erfolgreich abgeschlossen.${topMentorForPdf ? ` Mentor des Monats: ${topMentorForPdf.mentor.name} mit ${topMentorForPdf.score} Punkten.` : ""}`,
    };
    try {
      const { downloadMonthlyReportPDF } = await import("../../lib/pdfGenerator");
      const ok = await downloadMonthlyReportPDF(data);
      if (!ok) showError("PDF konnte nicht erstellt werden");
    } catch {
      showError("PDF-Generator konnte nicht geladen werden");
    }
  }

  async function handleDownloadDonorPDF() {
    if (Platform.OS !== "web") return;
    try {
      const { downloadDonorReportPDF } = await import("../../lib/pdfGenerator");
      const ok = await downloadDonorReportPDF({
        periodLabel,
        kpis: {
          activeMentorships: mentorships.filter((m) => m.status === "active").length,
          newRegistrations: kpis.totalAssigned,
          completedInPeriod: kpis.completions,
          bnmBoxes: kpis.bnmBoxes,
          activeMentors: users.filter((u) => u.role === "mentor").length,
          wuduSessions: kpis.wuduSessions,
          salahSessions: kpis.salahSessions,
          koranSessions: kpis.koranSessions,
          nachbetreuungSessions: kpis.nachbetreuungSessions,
        },
        regionalData: [],
        sessionDistribution: { items: [] },
        summaryText: `Im ${periodLabel} wurden ${kpis.totalSessions} Sessions durchgeführt, ${kpis.completions} Betreuungen abgeschlossen und ${kpis.totalAssigned} neue Betreuungen gestartet. ${kpis.bnmBoxes} BNM-Boxen wurden verteilt.`,
      });
      if (!ok) showError("PDF konnte nicht erstellt werden");
    } catch {
      showError("PDF-Generator konnte nicht geladen werden");
    }
  }

  async function handleExport() {
    const header = t("reports.csvKpiHeader");
    const row = [
      `"${periodLabel}"`,
      kpis.totalAssigned,
      kpis.firstContacts,
      kpis.firstMeetings,
      kpis.bnmBoxes,
      kpis.totalSessions,
      kpis.completions,
      kpis.cancellations,
      kpis.wuduSessions,
      kpis.salahSessions,
      kpis.koranSessions,
      kpis.nachbetreuungSessions,
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
      try {
        await Share.share({ message: csvContent, title: `BNM-Bericht-${periodLabel}` });
      } catch {}
    }
  }

  async function handleSpendenReport() {
    const header = `${t("reports.csvMonthColumn")},${t("reports.csvSessionsColumn")}`;
    const rows = monthlyData.map((d) => `"${d.month} ${selectedYear}",${d.count}`).join("\n");
    const total = monthlyData.reduce((s, d) => s + d.count, 0);
    const sumRow = `"${t("reports.csvTotalRow").replace("{0}", String(selectedYear))}",${total}`;
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
      try {
        await Share.share({ message: csvContent, title: `BNM-Spenderbericht-${selectedYear}` });
      } catch {}
    }
  }

  const [reportTab, setReportTab] = useState<"monthly" | "donor">("monthly");

  // Spenderbericht KPIs (teilt dieselbe Zeitraumauswahl)
  const donorKpis = useMemo(() => {
    const activeMentorships = mentorships.filter((m) => m.status === "active").length;
    const newRegistrations = kpis.totalAssigned;
    const completedInPeriod = kpis.completions;
    const bnmBoxes = kpis.bnmBoxes;
    const activeMentors = users.filter((u) => u.role === "mentor").length;
    const religiousSessions = kpis.wuduSessions + kpis.salahSessions + kpis.koranSessions;
    return { activeMentorships, newRegistrations, completedInPeriod, bnmBoxes, activeMentors, religiousSessions };
  }, [kpis, mentorships, users]);

  const donorSummaryText = useMemo(() => {
    return `Im ${periodLabel} wurden ${kpis.totalSessions} Sessions durchgeführt, davon ${kpis.wuduSessions} Wudu-, ${kpis.salahSessions} Salah- und ${kpis.koranSessions} Koran-Sessions. ${donorKpis.newRegistrations} neue Betreuungen wurden gestartet, ${donorKpis.completedInPeriod} abgeschlossen. ${donorKpis.bnmBoxes} BNM-Boxen wurden verteilt. Aktuell betreuen ${donorKpis.activeMentors} aktive Mentoren insgesamt ${donorKpis.activeMentorships} Muslime.`;
  }, [periodLabel, kpis, donorKpis]);

  const isOffice = user?.role === "office";
  const isAdminOrOffice = user?.role === "admin" || isOffice;

  // Dark-Mode-angepasste Button-Styles
  // Im Dark Mode: COLORS.gradientStart (#0A3A5A) ist kaum sichtbar → Gold verwenden
  const dynamicPrimaryBg = isDark ? COLORS.gold : COLORS.gradientStart;
  const dynamicPrimaryText = isDark ? COLORS.primary : COLORS.white;
  const dynamicOutlineBorderColor = isDark ? COLORS.gold : COLORS.gradientStart;
  const dynamicOutlineTextColor = isDark ? COLORS.gold : COLORS.gradientStart;

  if (!isAdminOrOffice) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessDeniedText, { color: themeColors.text }]}>{t("reports.accessDenied")}</Text>
      </View>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <View style={styles.titleRow}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("reports.title")}</Text>
            <View style={styles.betaBadge}>
              <Text style={styles.betaBadgeText}>{t("reports.betaBadge")}</Text>
            </View>
          </View>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("reports.subtitle")}</Text>

          {/* PDF-Buttons – direkt oben, nebeneinander */}
          {Platform.OS === "web" && (
            <View style={{ flexDirection: "row", gap: 10, marginBottom: 16 }}>
              <BNMPressable
                style={{ flex: 1, backgroundColor: dynamicPrimaryBg, borderRadius: RADIUS.sm, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                onPress={handleDownloadPDF}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={16} color={dynamicPrimaryText} />
                <Text style={{ color: dynamicPrimaryText, fontWeight: "600", fontSize: 14 }}>Bericht PDF</Text>
              </BNMPressable>
              {user?.role === "admin" && (
                <BNMPressable
                  style={{ flex: 1, backgroundColor: COLORS.gold, borderRadius: RADIUS.sm, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
                  onPress={handleDownloadDonorPDF}
                  activeOpacity={0.8}
                >
                  <Ionicons name="download-outline" size={16} color="#0E0E14" />
                  <Text style={{ color: "#0E0E14", fontWeight: "600", fontSize: 14 }}>Spenderbericht PDF</Text>
                </BNMPressable>
              )}
            </View>
          )}

          {/* Tab-Switcher: Monatsbericht | Spenderbericht */}
          <View style={[styles.tabSwitcherRow, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <BNMPressable
              style={[styles.tabSwitcherBtn, reportTab === "monthly" && { backgroundColor: dynamicPrimaryBg }]}
              onPress={() => setReportTab("monthly")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabSwitcherText, { color: reportTab === "monthly" ? dynamicPrimaryText : themeColors.textSecondary }]}>
                Monatsbericht
              </Text>
            </BNMPressable>
            <BNMPressable
              style={[styles.tabSwitcherBtn, reportTab === "donor" && { backgroundColor: COLORS.gold }]}
              onPress={() => setReportTab("donor")}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabSwitcherText, { color: reportTab === "donor" ? "#0E0E14" : themeColors.textSecondary }]}>
                Spenderbericht
              </Text>
            </BNMPressable>
          </View>

          {/* Zeitraum-Auswahl */}
          <View style={[styles.card, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.cardSectionLabel, { color: themeColors.textTertiary }]}>{t("reports.periodLabel")}</Text>

            {/* Quick-Filter Buttons */}
            <View style={styles.quickFilterRow}>
              {(
                [
                  { key: "thisMonth" as QuickPeriod, label: t("reports.quickThisMonth") },
                  { key: "lastMonth" as QuickPeriod, label: t("reports.quickLastMonth") },
                  { key: "thisQuarter" as QuickPeriod, label: t("reports.quickThisQuarter") },
                  { key: "thisYear" as QuickPeriod, label: t("reports.quickThisYear") },
                  { key: "custom" as QuickPeriod, label: t("reports.quickCustom") },
                ]
              ).map((opt) => (
                <BNMPressable
                  key={opt.key}
                  style={[
                    styles.quickFilterBtn,
                    quickPeriod === opt.key
                      ? [styles.quickFilterBtnActive, { backgroundColor: dynamicPrimaryBg, borderColor: dynamicPrimaryBg }]
                      : [styles.quickFilterBtnInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                  ]}
                  onPress={() => applyQuickPeriod(opt.key)}
                >
                  <Text
                    style={
                      quickPeriod === opt.key
                        ? [styles.quickFilterTextActive, { color: dynamicPrimaryText }]
                        : [styles.quickFilterTextInactive, { color: themeColors.textSecondary }]
                    }
                  >
                    {opt.label}
                  </Text>
                </BNMPressable>
              ))}
            </View>

            {/* Custom-Picker: nur bei "Benutzerdefiniert" */}
            {quickPeriod === "custom" && (
              <>
                {/* Modus-Toggle */}
                <View style={[styles.modeRow, { marginTop: 12 }]}>
                  {(
                    [
                      { key: "month", label: t("reports.month") },
                      { key: "quarter", label: t("reports.quarter") },
                      { key: "year", label: t("reports.year") },
                    ] as const
                  ).map((opt) => (
                    <BNMPressable
                      key={opt.key}
                      style={[
                        styles.modeButton,
                        periodMode === opt.key
                          ? [styles.modeButtonActive, { backgroundColor: dynamicPrimaryBg, borderColor: dynamicPrimaryBg }]
                          : [styles.modeButtonInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                      ]}
                      onPress={() => setPeriodMode(opt.key)}
                    >
                      <Text
                        style={
                          periodMode === opt.key
                            ? [styles.modeTextActive, { color: dynamicPrimaryText }]
                            : [styles.modeTextInactive, { color: themeColors.textSecondary }]
                        }
                      >
                        {opt.label}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>

                {/* Jahr-Auswahl */}
                <View style={styles.yearRow}>
                  {years.map((year) => (
                    <BNMPressable
                      key={year}
                      style={[
                        styles.yearButton,
                        selectedYear === year
                          ? [styles.yearButtonActive, { backgroundColor: dynamicPrimaryBg, borderColor: dynamicPrimaryBg }]
                          : [styles.yearButtonInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                      ]}
                      onPress={() => setSelectedYear(year)}
                    >
                      <Text
                        style={
                          selectedYear === year
                            ? [styles.yearButtonTextActive, { color: dynamicPrimaryText }]
                            : [styles.yearButtonTextInactive, { color: themeColors.textSecondary }]
                        }
                      >
                        {year}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>

                {/* Monats-Auswahl */}
                {periodMode === "month" && (
                  <View style={styles.monthRow}>
                    {MONTHS.map((month, idx) => (
                      <BNMPressable
                        key={month}
                        style={[
                          styles.monthChip,
                          selectedMonth === idx ? styles.monthChipActive : [styles.monthChipInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                        ]}
                        onPress={() => setSelectedMonth(idx)}
                      >
                        <Text
                          style={
                            selectedMonth === idx ? styles.monthChipTextActive : [styles.monthChipTextInactive, { color: themeColors.textSecondary }]
                          }
                        >
                          {month.slice(0, 3)}
                        </Text>
                      </BNMPressable>
                    ))}
                  </View>
                )}

                {/* Quartals-Auswahl */}
                {periodMode === "quarter" && (
                  <View style={styles.quarterRow}>
                    {QUARTERS.map((q, idx) => (
                      <BNMPressable
                        key={q.label}
                        style={[
                          styles.quarterChip,
                          selectedQuarter === idx ? styles.monthChipActive : [styles.monthChipInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                        ]}
                        onPress={() => setSelectedQuarter(idx)}
                      >
                        <Text
                          style={
                            selectedQuarter === idx ? styles.monthChipTextActive : [styles.monthChipTextInactive, { color: themeColors.textSecondary }]
                          }
                        >
                          {q.label}
                        </Text>
                      </BNMPressable>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Ausgewählter Zeitraum */}
          <Text style={[styles.periodTitle, { color: themeColors.text }]}>{periodLabel}</Text>

          {/* Druckbarer Inhalt-Bereich */}
          <View nativeID="print-content">

          {reportTab === "monthly" ? (
            <>
              {/* Empty State: Noch keine Daten in diesem Zeitraum */}
              {kpis.totalSessions === 0 && kpis.totalAssigned === 0 && mentorships.length === 0 && (
                <View style={[styles.emptyDataBox, {
                  backgroundColor: isDark ? "#3a2e1a" : "#fffbeb",
                  borderColor: isDark ? "#6b4e1a" : "#fde68a",
                }]}>
                  <Text style={[styles.emptyDataText, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("reports.noData")}</Text>
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
              <View style={styles.kpiRow}>
                <KpiCard label={t("reports.bnmBoxes")} value={kpis.bnmBoxes} color={COLORS.secondary} />
                <KpiCard label={t("reports.completions")} value={kpis.completions} color={COLORS.cta} />
              </View>
              <View style={styles.kpiRow}>
                <KpiCard label={t("reports.wuduSessions")} value={kpis.wuduSessions} color={COLORS.gradientStart} />
                <KpiCard label={t("reports.salahSessions")} value={kpis.salahSessions} color={COLORS.gradientStart} />
              </View>
              <View style={[styles.kpiRow, { marginBottom: 16 }]}>
                <KpiCard label={t("reports.koranSessions")} value={kpis.koranSessions} color={COLORS.gold} />
                <KpiCard label={t("reports.nachbetreuungSessions")} value={kpis.nachbetreuungSessions} color={COLORS.gold} />
              </View>

              {/* Abbrüche */}
              {kpis.cancellations > 0 && (
                <View style={[styles.cancellationBox, {
                  backgroundColor: isDark ? "#3a1a1a" : "#fef2f2",
                  borderColor: isDark ? "#7a2a2a" : "#fecaca",
                }]}>
                  <Text style={[styles.cancellationLabel, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("reports.cancellations")}</Text>
                  <Text style={[styles.cancellationValue, { color: isDark ? "#f87171" : "#b91c1c" }]}>{kpis.cancellations}</Text>
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
            </>
          ) : (
            <>
              {/* Spenderbericht KPI-Karten */}
              <View style={styles.kpiRow}>
                <KpiCard label="Aktive Betreuungen" value={donorKpis.activeMentorships} color={COLORS.gradientStart} />
                <KpiCard label="Neue Registrierungen" value={donorKpis.newRegistrations} color={COLORS.gradientStart} />
              </View>
              <View style={styles.kpiRow}>
                <KpiCard label="Abgeschlossen" value={donorKpis.completedInPeriod} color={COLORS.cta} />
                <KpiCard label="BNM-Boxen verteilt" value={donorKpis.bnmBoxes} color={COLORS.secondary} />
              </View>
              <View style={[styles.kpiRow, { marginBottom: 16 }]}>
                <KpiCard label="Aktive Mentoren" value={donorKpis.activeMentors} color={COLORS.gold} />
                <KpiCard label="Religiöse Sessions" value={donorKpis.religiousSessions} color={COLORS.gold} />
              </View>

              {/* Session-Verteilung */}
              <View style={[styles.card, { backgroundColor: themeColors.card }]}>
                <Text style={[styles.cardSectionLabel, { color: themeColors.textTertiary }]}>SESSION-VERTEILUNG</Text>
                {[
                  { label: "Wudu", value: kpis.wuduSessions },
                  { label: "Salah", value: kpis.salahSessions },
                  { label: "Koran", value: kpis.koranSessions },
                  { label: "Nachbetreuung", value: kpis.nachbetreuungSessions },
                ].map((item) => (
                  <View key={item.label} style={[styles.sessionDistRow, { borderBottomColor: themeColors.border }]}>
                    <View style={[styles.sessionDot, { backgroundColor: COLORS.gold }]} />
                    <Text style={[styles.sessionDistLabel, { color: themeColors.text }]}>{item.label}</Text>
                    <Text style={[styles.sessionDistValue, { color: COLORS.gold }]}>{item.value}</Text>
                  </View>
                ))}
              </View>

              {/* Zusammenfassung */}
              <View style={[styles.summaryBox, {
                backgroundColor: isDark ? "rgba(238,167,27,0.07)" : "#fffbeb",
                borderColor: isDark ? "rgba(238,167,27,0.3)" : "#fde68a",
              }]}>
                <Text style={[styles.summaryTitle, { color: themeColors.text }]}>Zusammenfassung</Text>
                <Text style={[styles.summaryText, { color: themeColors.textSecondary }]}>{donorSummaryText}</Text>
              </View>
            </>
          )}

          </View>{/* Ende print-content */}

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
  const themeColors = useThemeColors();
  return (
    <View style={[styles.kpiCard, { backgroundColor: themeColors.card }]}>
      <Text style={[styles.kpiLabel, { color: themeColors.textSecondary }]} numberOfLines={2}>{label}</Text>
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessDeniedText: { fontWeight: "600" },
  page: { padding: 24 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  pageTitle: { fontSize: 24, fontWeight: "800" },
  betaBadge: {
    backgroundColor: COLORS.warning,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignSelf: "center",
  },
  betaBadgeText: { color: "#1c1400", fontSize: 10, fontWeight: "700" },
  pageSubtitle: { fontSize: 13, marginBottom: 16 },
  card: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  cardSectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  quickFilterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  quickFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  quickFilterBtnActive: {
    backgroundColor: COLORS.gradientStart,
    borderColor: COLORS.gradientStart,
  },
  quickFilterBtnInactive: {},
  quickFilterTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  quickFilterTextInactive: { fontSize: 13 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeButton: { flex: 1, paddingVertical: 9, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center" },
  modeButtonActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  modeButtonInactive: {},
  modeTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  modeTextInactive: { fontSize: 13 },
  yearRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  yearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.md, borderWidth: 1 },
  yearButtonActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  yearButtonInactive: {},
  yearButtonTextActive: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  yearButtonTextInactive: { fontSize: 14, fontWeight: "600" },
  monthRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1 },
  monthChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  monthChipInactive: {},
  monthChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  monthChipTextInactive: { fontSize: 12, fontWeight: "500" },
  quarterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  quarterChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.md, borderWidth: 1 },
  periodTitle: { fontWeight: "800", fontSize: 20, marginBottom: 16 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    ...SHADOWS.md,
  },
  kpiLabel: { fontSize: 12, marginBottom: 2 },
  kpiValue: { fontSize: 26, fontWeight: "800" },
  cancellationBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancellationLabel: { fontWeight: "600" },
  cancellationValue: { fontWeight: "800", fontSize: 22 },
  chartCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  chartTitle: { fontWeight: "800", color: COLORS.white, marginBottom: 16, fontSize: 15 },
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
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
  },
  goldBoxHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  goldStar: { color: COLORS.gold, fontSize: 24, marginRight: 8 },
  goldBoxTitle: { fontWeight: "800" },
  goldMentorName: { fontSize: 20, fontWeight: "800", marginBottom: 2 },
  goldMentorSub: { fontSize: 14 },
  emptyDataBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
  },
  emptyDataText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  emptyMonthBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
  },
  emptyMonthText: { fontSize: 14, textAlign: "center" },
  toggleMomButton: {
    borderWidth: 1,
    borderColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  toggleMomText: { color: COLORS.gradientStart, fontWeight: "600", fontSize: 14 },
  exportButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  exportButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  spendenButton: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  spendenButtonText: { color: COLORS.gold, fontWeight: "700" },
  tabSwitcherRow: {
    flexDirection: "row",
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  tabSwitcherBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSwitcherText: { fontWeight: "600", fontSize: 14 },
  sessionDistRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 10,
  },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionDistLabel: { flex: 1, fontSize: 14 },
  sessionDistValue: { fontSize: 16, fontWeight: "800" },
  summaryBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
  },
  summaryTitle: { fontWeight: "800", fontSize: 15, marginBottom: 8 },
  summaryText: { fontSize: 13, lineHeight: 20 },
  donorReportButton: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 10,
  },
  donorReportButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  donorDashboardButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 20,
  },
  printButtonText: { color: COLORS.secondary, fontWeight: "600", fontSize: 13 },
});
