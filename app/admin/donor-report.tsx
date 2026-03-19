/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { showSuccess } from "../../lib/errorHandler";

// ─── Konstanten ──────────────────────────────────────────────────────────────

// MONTHS_DE and MONTHS_SHORT are now built inside the component using t()

const QUARTERS = [
  { label: "Q1", months: [0, 1, 2] },
  { label: "Q2", months: [3, 4, 5] },
  { label: "Q3", months: [6, 7, 8] },
  { label: "Q4", months: [9, 10, 11] },
];

const YEARS = [2024, 2025, 2026];

const SESSION_COLORS = [
  COLORS.gradientStart,
  COLORS.gold,
  COLORS.cta,
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#d97706",
  "#65a30d",
  "#0284c7",
  "#c026d3",
];

type PeriodMode = "all" | "month" | "quarter" | "year";

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────
// formatPeriodLabel is defined inside the component to access t()

// ─── Diagramm-Komponenten ────────────────────────────────────────────────────

interface BarItem {
  label: string;
  value: number;
  color?: string;
  value2?: number;
  color2?: string;
  value3?: number;
  color3?: string;
}

function BarChart({
  data,
  height = 120,
  showValues = true,
  multiColor = false,
}: {
  data: BarItem[];
  height?: number;
  showValues?: boolean;
  multiColor?: boolean;
}) {
  const maxVal = Math.max(
    ...data.map((d) => (d.value || 0) + (d.value2 || 0) + (d.value3 || 0)),
    1
  );

  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height, gap: 4 }}>
      {data.map((item, idx) => {
        const total = (item.value || 0) + (item.value2 || 0) + (item.value3 || 0);
        const totalPct = (total / maxVal) * 100;
        const v1Pct = total > 0 ? ((item.value || 0) / total) * 100 : 0;
        const v2Pct = total > 0 ? ((item.value2 || 0) / total) * 100 : 0;
        const v3Pct = total > 0 ? ((item.value3 || 0) / total) * 100 : 0;
        const barColor = multiColor
          ? SESSION_COLORS[idx % SESSION_COLORS.length]
          : item.color ?? COLORS.gold;

        return (
          <View key={`${item.label}-${idx}`} style={{ flex: 1, alignItems: "center" }}>
            {showValues && (
              <Text style={barChartStyles.valueText}>{total > 0 ? total : ""}</Text>
            )}
            <View
              style={[
                barChartStyles.track,
                { height: Math.round(height * 0.75) },
              ]}
            >
              {item.value2 !== undefined ? (
                // Gestapelter Balken (3 Farben)
                <View
                  style={[
                    barChartStyles.fill,
                    { height: `${Math.max(totalPct, totalPct > 0 ? 4 : 0)}%` as any },
                    { overflow: "hidden" },
                  ]}
                >
                  {item.value3 !== undefined && item.value3 > 0 && (
                    <View
                      style={{
                        width: "100%",
                        height: `${v3Pct}%` as any,
                        backgroundColor: item.color3 ?? COLORS.error,
                      }}
                    />
                  )}
                  {(item.value2 || 0) > 0 && (
                    <View
                      style={{
                        width: "100%",
                        height: `${v2Pct}%` as any,
                        backgroundColor: item.color2 ?? COLORS.cta,
                      }}
                    />
                  )}
                  {(item.value || 0) > 0 && (
                    <View
                      style={{
                        width: "100%",
                        height: `${v1Pct}%` as any,
                        backgroundColor: item.color ?? COLORS.gold,
                      }}
                    />
                  )}
                </View>
              ) : (
                <View
                  style={[
                    barChartStyles.fill,
                    {
                      height: `${Math.max(totalPct > 0 ? totalPct : 0, totalPct > 0 ? 4 : 0)}%` as any,
                      backgroundColor: barColor,
                    },
                  ]}
                />
              )}
            </View>
            <Text style={barChartStyles.label} numberOfLines={1}>
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const barChartStyles = StyleSheet.create({
  track: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  fill: {
    width: "100%",
    borderRadius: 3,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  valueText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 10,
    marginBottom: 2,
    fontWeight: "600",
  },
  label: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 9,
    marginTop: 3,
    textAlign: "center",
  },
});

// Horizontaler Balken (für regionale Verteilung + Session-Verteilung)
function HorizontalBar({
  label,
  value,
  maxValue,
  color,
  total,
}: {
  label: string;
  value: number;
  maxValue: number;
  color: string;
  total: number;
}) {
  const pct = maxValue > 0 ? (value / maxValue) * 100 : 0;
  const shareStr = total > 0 ? `${Math.round((value / total) * 100)}%` : "0%";
  return (
    <View style={hBarStyles.row}>
      <Text style={hBarStyles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={hBarStyles.track}>
        <View
          style={[
            hBarStyles.fill,
            {
              width: `${Math.max(pct > 0 ? pct : 0, pct > 0 ? 3 : 0)}%` as any,
              backgroundColor: color,
            },
          ]}
        />
      </View>
      <Text style={hBarStyles.count}>{value}</Text>
      <Text style={hBarStyles.share}>{shareStr}</Text>
    </View>
  );
}

const hBarStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  label: {
    color: COLORS.primary,
    fontSize: 12,
    width: 90,
    marginRight: 6,
    fontWeight: "500",
  },
  track: {
    flex: 1,
    height: 14,
    backgroundColor: COLORS.bg,
    borderRadius: 3,
    overflow: "hidden",
    marginRight: 6,
  },
  fill: { height: "100%" as any, borderRadius: 3 },
  count: {
    color: COLORS.primary,
    fontWeight: "700",
    fontSize: 12,
    minWidth: 22,
    textAlign: "right",
  },
  share: {
    color: COLORS.tertiary,
    fontSize: 11,
    minWidth: 34,
    textAlign: "right",
  },
});

// Liniendiagramm (kumulativ) als Step-Chart
function LineChart({
  data,
  height = 110,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={{ height, flexDirection: "row", alignItems: "flex-end", gap: 2 }}>
      {data.map((item, idx) => {
        const pct = (item.value / maxVal) * 100;
        const isLast = idx === data.length - 1;
        return (
          <View key={`${item.label}-${idx}`} style={{ flex: 1, alignItems: "center" }}>
            <View
              style={{
                width: "80%",
                height: Math.round((height - 20) * (pct / 100)) || 2,
                backgroundColor: isLast ? COLORS.gold : `rgba(10,58,90,0.6)`,
                borderRadius: 2,
                borderTopWidth: 2,
                borderTopColor: COLORS.gold,
              }}
            />
            <Text
              style={{
                color: "rgba(255,255,255,0.55)",
                fontSize: 9,
                marginTop: 3,
                textAlign: "center",
              }}
              numberOfLines={1}
            >
              {item.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ─── Hauptkomponente ─────────────────────────────────────────────────────────

export default function AdminDonorReportScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { mentorships, sessions, sessionTypes, users } = useData();

  const now = new Date();
  const [periodMode, setPeriodMode] = useState<PeriodMode>("quarter");
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedQuarter, setSelectedQuarter] = useState(Math.floor(now.getMonth() / 3));

  // Translated short month names (Jan–Dec) — memoized so useMemo deps stay stable
  const MONTHS_SHORT = useMemo(() => [
    t("reports.months.jan.short"), t("reports.months.feb.short"), t("reports.months.mar.short"),
    t("reports.months.apr.short"), t("reports.months.may.short"), t("reports.months.jun.short"),
    t("reports.months.jul.short"), t("reports.months.aug.short"), t("reports.months.sep.short"),
    t("reports.months.oct.short"), t("reports.months.nov.short"), t("reports.months.dec.short"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  // Translated full month names (for period label in "month" mode)
  const MONTHS_LONG = useMemo(() => [
    t("reports.months.jan"), t("reports.months.feb"), t("reports.months.mar"),
    t("reports.months.apr"), t("reports.months.may"), t("reports.months.jun"),
    t("reports.months.jul"), t("reports.months.aug"), t("reports.months.sep"),
    t("reports.months.oct"), t("reports.months.nov"), t("reports.months.dec"),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [t]);

  function formatPeriodLabel(
    mode: PeriodMode,
    year: number,
    month: number,
    quarter: number
  ): string {
    if (mode === "all") return t("reports.allPeriods");
    if (mode === "month") return `${MONTHS_LONG[month]} ${year}`;
    if (mode === "quarter") return `${QUARTERS[quarter].label} ${year}`;
    return `${t("donorDashboard.periodYear")} ${year}`;
  }

  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";

  // Zeitraum-Filterfunktion
  const inPeriod = useCallback(
    (dateStr: string | null | undefined): boolean => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return false;
      if (periodMode === "all") return true;
      const yr = d.getFullYear();
      const mo = d.getMonth();
      if (yr !== selectedYear) return false;
      if (periodMode === "month") return mo === selectedMonth;
      if (periodMode === "quarter") return QUARTERS[selectedQuarter].months.includes(mo);
      return true; // year
    },
    [periodMode, selectedYear, selectedMonth, selectedQuarter]
  );

  // ── KPIs ──
  const kpis = useMemo(() => {
    const bnmBoxTypeId = sessionTypes.find((st) => st.name === "BNM-Box")?.id ?? "st-5";

    const activeMentorships = mentorships.filter((m) => m.status === "active").length;
    const newRegistrations = mentorships.filter((m) => inPeriod(m.assigned_at)).length;
    const completedInPeriod = mentorships.filter(
      (m) => m.status === "completed" && inPeriod(m.completed_at)
    ).length;
    const bnmBoxes = sessions.filter(
      (s) => s.session_type_id === bnmBoxTypeId && inPeriod(s.date)
    ).length;
    const activeMentors = users.filter(
      (u) =>
        u.role === "mentor" &&
        mentorships.some((m) => m.mentor_id === u.id && m.status === "active")
    ).length;
    const wuduSessions = sessions.filter((s) => s.session_type?.name === "Wudu-Session" && inPeriod(s.date)).length;
    const salahSessions = sessions.filter((s) => s.session_type?.name === "Salah-Session" && inPeriod(s.date)).length;
    const koranSessions = sessions.filter((s) => s.session_type?.name === "Koran-Session" && inPeriod(s.date)).length;
    const nachbetreuungSessions = sessions.filter((s) => s.session_type?.name === "Nachbetreuung" && inPeriod(s.date)).length;

    return { activeMentorships, newRegistrations, completedInPeriod, bnmBoxes, activeMentors, wuduSessions, salahSessions, koranSessions, nachbetreuungSessions };
  }, [inPeriod, mentorships, sessions, sessionTypes, users]);

  // ── Diagramm 1: Betreuungen pro Monat (gestapelt: aktiv / abgeschlossen / abgebrochen) ──
  const mentorshipsByMonth = useMemo(() => {
    const targetMonths =
      periodMode === "month"
        ? [selectedMonth]
        : periodMode === "quarter"
        ? QUARTERS[selectedQuarter].months
        : periodMode === "year"
        ? Array.from({ length: 12 }, (_, i) => i)
        : Array.from({ length: 12 }, (_, i) => i); // "all" → alle Monate des aktuellsten Jahres mit Daten

    const baseYear = periodMode === "all" ? now.getFullYear() : selectedYear;

    return targetMonths.map((mIdx) => {
      const started = mentorships.filter((m) => {
        const d = new Date(m.assigned_at);
        return d.getFullYear() === baseYear && d.getMonth() === mIdx;
      });
      return {
        label: MONTHS_SHORT[mIdx],
        value: started.filter((m) => m.status === "active").length,
        color: COLORS.gold,
        value2: started.filter((m) => m.status === "completed").length,
        color2: COLORS.cta,
        value3: started.filter((m) => m.status === "cancelled").length,
        color3: COLORS.error,
      };
    });
  }, [periodMode, selectedYear, selectedMonth, selectedQuarter, mentorships, MONTHS_SHORT]);

  // ── Diagramm 2: Session-Verteilung ──
  const sessionDistribution = useMemo(() => {
    const total = sessions.filter((s) => inPeriod(s.date)).length;
    const items = sessionTypes
      .map((st, idx) => ({
        label: st.name,
        value: sessions.filter((s) => s.session_type_id === st.id && inPeriod(s.date)).length,
        color: SESSION_COLORS[idx % SESSION_COLORS.length],
      }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
    return { items, total };
  }, [inPeriod, sessions, sessionTypes]);

  // ── Diagramm 3: Kumulatives Mentee-Wachstum ──
  const growthData = useMemo(() => {
    // Alle Mentorships sortiert nach assigned_at
    const sorted = [...mentorships]
      .filter((m) => m.assigned_at)
      .sort((a, b) => new Date(a.assigned_at).getTime() - new Date(b.assigned_at).getTime());

    const yearMonths =
      periodMode === "all"
        ? (() => {
            // Letzten 12 Monate
            const result: { label: string; year: number; month: number }[] = [];
            const ref = new Date();
            for (let i = 11; i >= 0; i--) {
              const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
              result.push({
                label: MONTHS_SHORT[d.getMonth()],
                year: d.getFullYear(),
                month: d.getMonth(),
              });
            }
            return result;
          })()
        : periodMode === "year"
        ? Array.from({ length: 12 }, (_, i) => ({
            label: MONTHS_SHORT[i],
            year: selectedYear,
            month: i,
          }))
        : periodMode === "quarter"
        ? QUARTERS[selectedQuarter].months.map((m) => ({
            label: MONTHS_SHORT[m],
            year: selectedYear,
            month: m,
          }))
        : [{ label: MONTHS_SHORT[selectedMonth], year: selectedYear, month: selectedMonth }];

    let cumulative = 0;
    return yearMonths.map(({ label, year, month }) => {
      const count = sorted.filter((m) => {
        const d = new Date(m.assigned_at);
        return d.getFullYear() < year || (d.getFullYear() === year && d.getMonth() <= month);
      }).length;
      cumulative = count;
      return { label, value: cumulative };
    });
  }, [periodMode, selectedYear, selectedMonth, selectedQuarter, mentorships, MONTHS_SHORT]);

  // ── Diagramm 4: Regionale Verteilung ──
  const regionalData = useMemo(() => {
    const cityMap = new Map<string, number>();
    for (const m of mentorships) {
      if (!inPeriod(m.assigned_at)) continue;
      const mentee = users.find((u) => u.id === m.mentee_id);
      const city = mentee?.city?.trim() || t("common.unknown");
      cityMap.set(city, (cityMap.get(city) ?? 0) + 1);
    }
    return [...cityMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([city, count]) => ({ label: city, value: count }));
  }, [inPeriod, mentorships, users]);

  const maxRegional = Math.max(...regionalData.map((d) => d.value), 1);
  const totalRegional = regionalData.reduce((s, d) => s + d.value, 0);

  // ── Zusammenfassungstext ──
  const summaryText = useMemo(() => {
    const pLabel = formatPeriodLabel(periodMode, selectedYear, selectedMonth, selectedQuarter);
    return t("donorDashboard.summaryText")
      .replace("{0}", pLabel)
      .replace("{1}", String(kpis.newRegistrations))
      .replace("{2}", String(kpis.bnmBoxes))
      .replace("{3}", String(kpis.completedInPeriod))
      .replace("{4}", String(kpis.activeMentorships))
      .replace("{5}", String(kpis.activeMentors));
  }, [kpis, periodMode, selectedYear, selectedMonth, selectedQuarter, t]);

  // ── Export: CSV ──
  function handleExportCSV() {
    const pLabel = formatPeriodLabel(periodMode, selectedYear, selectedMonth, selectedQuarter);
    const header = "Zeitraum,Aktive Betreuungen,Neue Registrierungen,Abgeschlossen,BNM-Boxen,Aktive Mentoren";
    const row = [
      `"${pLabel}"`,
      kpis.activeMentorships,
      kpis.newRegistrations,
      kpis.completedInPeriod,
      kpis.bnmBoxes,
      kpis.activeMentors,
    ].join(",");

    const regionalRows = regionalData.map((d) => `"${d.label}",${d.value}`).join("\n");
    const sessionRows = sessionDistribution.items.map((d) => `"${d.label}",${d.value}`).join("\n");

    const csvContent = [
      "BNM Spender-Bericht",
      `"${pLabel}"`,
      "",
      "KENNZAHLEN",
      header,
      row,
      "",
      "REGIONALE VERTEILUNG",
      "Stadt,Betreuungen",
      regionalRows,
      "",
      "SESSION-VERTEILUNG",
      "Session-Typ,Anzahl",
      sessionRows,
    ].join("\n");

    if (Platform.OS === "web") {
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `BNM-Spenderbericht-${pLabel.replace(/[\s/]/g, "-")}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      showSuccess(t("donorDashboard.exportCSV") + " ✓");
    } else {
      showSuccess(`CSV generiert (${pLabel})\n\nFür nativen Download: expo-sharing (Post-Launch).`);
    }
  }

  // ── Export: Text kopieren ──
  function handleCopyText() {
    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(summaryText).then(() => {
        showSuccess(t("donorDashboard.copied"));
      });
    } else {
      // Native: Text als Info anzeigen (expo-clipboard nicht installiert)
      showSuccess(`${t("donorDashboard.summary")}:\n\n${summaryText}`);
    }
  }

  if (!isAdminOrOffice) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>{t("donorDashboard.accessDenied")}</Text>
      </View>
    );
  }

  const periodLabel = formatPeriodLabel(periodMode, selectedYear, selectedMonth, selectedQuarter);

  return (
    <View style={styles.flex1}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{t("donorDashboard.backToReports")}</Text>
          </TouchableOpacity>
          <View style={styles.logoBadge}>
            <Text style={styles.logoText}>BNM</Text>
          </View>
          <Text style={styles.headerTitle}>{t("donorDashboard.title")}</Text>
          <Text style={styles.headerSubtitle}>{periodLabel}</Text>
          <View style={styles.goldLine} />
        </View>

        <View style={styles.page}>
          {/* ── Zeitraum-Filter ── */}
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>{t("donorDashboard.periodSection")}</Text>

            {/* Modi */}
            <View style={styles.modeRow}>
              {(
                [
                  { key: "all" as const, label: t("donorDashboard.periodAll") },
                  { key: "month" as const, label: t("donorDashboard.periodMonth") },
                  { key: "quarter" as const, label: t("donorDashboard.periodQuarter") },
                  { key: "year" as const, label: t("donorDashboard.periodYear") },
                ] as const
              ).map((opt) => (
                <TouchableOpacity
                  key={opt.key}
                  style={[
                    styles.modeBtn,
                    periodMode === opt.key ? styles.modeBtnActive : styles.modeBtnInactive,
                  ]}
                  onPress={() => setPeriodMode(opt.key)}
                >
                  <Text
                    style={
                      periodMode === opt.key ? styles.modeBtnTextActive : styles.modeBtnTextInactive
                    }
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Jahr */}
            {periodMode !== "all" && (
              <View style={styles.yearRow}>
                {YEARS.map((y) => (
                  <TouchableOpacity
                    key={y}
                    style={[
                      styles.yearBtn,
                      selectedYear === y ? styles.yearBtnActive : styles.yearBtnInactive,
                    ]}
                    onPress={() => setSelectedYear(y)}
                  >
                    <Text
                      style={
                        selectedYear === y ? styles.yearBtnTextActive : styles.yearBtnTextInactive
                      }
                    >
                      {y}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Quartal */}
            {periodMode === "quarter" && (
              <View style={styles.chipRow}>
                {QUARTERS.map((q, idx) => (
                  <TouchableOpacity
                    key={q.label}
                    style={[
                      styles.chip,
                      selectedQuarter === idx ? styles.chipActive : styles.chipInactive,
                    ]}
                    onPress={() => setSelectedQuarter(idx)}
                  >
                    <Text
                      style={
                        selectedQuarter === idx ? styles.chipTextActive : styles.chipTextInactive
                      }
                    >
                      {q.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Monat */}
            {periodMode === "month" && (
              <View style={styles.chipRow}>
                {MONTHS_SHORT.map((m, idx) => (
                  <TouchableOpacity
                    key={m}
                    style={[
                      styles.chip,
                      selectedMonth === idx ? styles.chipActive : styles.chipInactive,
                    ]}
                    onPress={() => setSelectedMonth(idx)}
                  >
                    <Text
                      style={
                        selectedMonth === idx ? styles.chipTextActive : styles.chipTextInactive
                      }
                    >
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* ── KPI Cards ── */}
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t("donorDashboard.activeMentorships")}
              value={kpis.activeMentorships}
              color={COLORS.gradientStart}
              accent={COLORS.gold}
            />
            <KpiCard
              label={t("donorDashboard.newRegistrations")}
              value={kpis.newRegistrations}
              color={COLORS.gradientStart}
              accent={COLORS.gradientStart}
            />
          </View>
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t("donorDashboard.completedMentorships")}
              value={kpis.completedInPeriod}
              color={COLORS.cta}
              accent={COLORS.cta}
            />
            <KpiCard
              label={t("donorDashboard.bnmBoxesDelivered")}
              value={kpis.bnmBoxes}
              color={COLORS.gold}
              accent={COLORS.gold}
            />
          </View>
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t("donorDashboard.activeMentors")}
              value={kpis.activeMentors}
              color={COLORS.link}
              accent={COLORS.link}
              fullWidth
            />
          </View>
          <View style={styles.kpiGrid}>
            <KpiCard
              label={t("reports.wuduSessions")}
              value={kpis.wuduSessions}
              color={COLORS.gradientStart}
              accent={COLORS.gradientStart}
            />
            <KpiCard
              label={t("reports.salahSessions")}
              value={kpis.salahSessions}
              color={COLORS.gradientStart}
              accent={COLORS.gradientStart}
            />
          </View>
          <View style={[styles.kpiGrid, { marginBottom: 20 }]}>
            <KpiCard
              label={t("reports.koranSessions")}
              value={kpis.koranSessions}
              color={COLORS.gold}
              accent={COLORS.gold}
            />
            <KpiCard
              label={t("reports.nachbetreuungSessions")}
              value={kpis.nachbetreuungSessions}
              color={COLORS.gold}
              accent={COLORS.gold}
            />
          </View>

          {/* ── Diagramm 1: Betreuungen pro Monat ── */}
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>{t("donorDashboard.chartMentorships")}</Text>
          </View>
          <View style={styles.chartCard}>
            {/* Legende */}
            <View style={styles.legendRow}>
              <LegendItem color={COLORS.gold} label={t("donorDashboard.active")} />
              <LegendItem color={COLORS.cta} label={t("donorDashboard.completed")} />
              <LegendItem color={COLORS.error} label={t("donorDashboard.cancelled")} />
            </View>
            {mentorshipsByMonth.every((d) => (d.value + (d.value2 ?? 0) + (d.value3 ?? 0)) === 0) ? (
              <Text style={styles.noDataText}>{t("donorDashboard.noDataPeriod")}</Text>
            ) : (
              <BarChart data={mentorshipsByMonth} height={130} showValues />
            )}
          </View>

          {/* ── Diagramm 2: Session-Verteilung ── */}
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>{t("donorDashboard.chartSessions")}</Text>
          </View>
          {sessionDistribution.items.length > 0 ? (
            <View style={styles.card}>
              {sessionDistribution.items.map((item) => (
                <HorizontalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  maxValue={sessionDistribution.items[0].value}
                  color={item.color}
                  total={sessionDistribution.total}
                />
              ))}
              <Text style={styles.totalNote}>
                {t("donorDashboard.totalLabel").replace("{0}", String(sessionDistribution.total))}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noDataTextDark}>{t("donorDashboard.noDataPeriod")}</Text>
            </View>
          )}

          {/* ── Diagramm 3: Wachstumskurve ── */}
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>{t("donorDashboard.chartGrowth")}</Text>
          </View>
          <View style={styles.chartCard}>
            {growthData.every((d) => d.value === 0) ? (
              <Text style={styles.noDataText}>{t("donorDashboard.noDataPeriod")}</Text>
            ) : (
              <>
                <LineChart data={growthData} height={120} />
                <Text style={styles.chartFootNote}>
                  {t("donorDashboard.totalMentees").replace("{0}", String(growthData[growthData.length - 1]?.value ?? 0))}
                </Text>
              </>
            )}
          </View>

          {/* ── Diagramm 4: Regionale Verteilung ── */}
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>{t("donorDashboard.chartRegions")}</Text>
          </View>
          {regionalData.length > 0 ? (
            <View style={styles.card}>
              {regionalData.map((item, idx) => (
                <HorizontalBar
                  key={item.label}
                  label={item.label}
                  value={item.value}
                  maxValue={maxRegional}
                  color={SESSION_COLORS[idx % SESSION_COLORS.length]}
                  total={totalRegional}
                />
              ))}
              <Text style={styles.totalNote}>
                {t("donorDashboard.totalLabel").replace("{0}", String(totalRegional))}
              </Text>
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.noDataTextDark}>{t("donorDashboard.noDataPeriod")}</Text>
            </View>
          )}

          {/* ── Zusammenfassung ── */}
          <View style={styles.chartSectionHeader}>
            <Text style={styles.chartSectionTitle}>{t("donorDashboard.summary")}</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryText}>{summaryText}</Text>
          </View>

          {/* ── Export-Buttons ── */}
          <TouchableOpacity style={styles.exportBtnPrimary} onPress={handleExportCSV}>
            <Text style={styles.exportBtnText}>
              {Platform.OS === "web" ? t("donorDashboard.exportCSV") : t("donorDashboard.export")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.exportBtnSecondary} onPress={handleCopyText}>
            <Text style={styles.exportBtnSecText}>{t("donorDashboard.copyText")}</Text>
          </TouchableOpacity>

          {Platform.OS === "web" && (
            <TouchableOpacity
              style={styles.printBtn}
              onPress={() => {
                if (typeof window !== "undefined") {
                  (window as Window).print();
                }
              }}
            >
              <Text style={styles.printBtnText}>🖨 {t("donorDashboard.printPdf")}</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={styles.backBtnBottom} onPress={() => router.back()}>
            <Text style={styles.backBtnBottomText}>{t("donorDashboard.backToReports")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  accent,
  fullWidth,
}: {
  label: string;
  value: number;
  color: string;
  accent: string;
  fullWidth?: boolean;
}) {
  return (
    <View
      style={[
        styles.kpiCard,
        { borderTopColor: accent },
        fullWidth && { flex: 1 },
      ]}
    >
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
      <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 11 }}>{label}</Text>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: COLORS.bg },
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  accessText: { color: COLORS.primary, fontWeight: "600" },

  // Header
  header: {
    backgroundColor: COLORS.gradientStart,
    paddingTop: 44,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  backBtn: { alignSelf: "flex-start", marginBottom: 12 },
  backBtnText: { color: "rgba(255,255,255,0.7)", fontSize: 13 },
  logoBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  logoText: { color: COLORS.white, fontWeight: "800", fontSize: 17, letterSpacing: 2 },
  headerTitle: { color: COLORS.white, fontSize: 20, fontWeight: "700", marginBottom: 2 },
  headerSubtitle: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
    textAlign: "center",
  },
  goldLine: {
    marginTop: 14,
    width: 48,
    height: 3,
    backgroundColor: COLORS.gold,
    borderRadius: 2,
  },

  page: { padding: 16 },

  // Zeitraum-Filter
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  modeRow: { flexDirection: "row", gap: 6, marginBottom: 10, flexWrap: "wrap" },
  modeBtn: {
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 5,
    borderWidth: 1,
    alignItems: "center",
  },
  modeBtnActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  modeBtnInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  modeBtnTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 12 },
  modeBtnTextInactive: { color: COLORS.secondary, fontSize: 12 },
  yearRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  yearBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 5, borderWidth: 1 },
  yearBtnActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  yearBtnInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  yearBtnTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  yearBtnTextInactive: { color: COLORS.secondary, fontSize: 13 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 1 },
  chipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  chipInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  chipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "600" },
  chipTextInactive: { color: COLORS.secondary, fontSize: 12 },

  // KPI
  kpiGrid: { flexDirection: "row", gap: 10, marginBottom: 10 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderTopWidth: 3,
    borderTopColor: COLORS.gold,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  kpiValue: { fontSize: 30, fontWeight: "800", color: COLORS.primary },
  kpiLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    textAlign: "center",
    marginTop: 2,
    lineHeight: 15,
  },

  // Chart Sections
  chartSectionHeader: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  chartSectionTitle: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  chartCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  noDataText: {
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
    fontSize: 13,
    paddingVertical: 20,
  },
  noDataTextDark: {
    color: COLORS.tertiary,
    textAlign: "center",
    fontSize: 13,
    paddingVertical: 12,
  },
  legendRow: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 12,
    flexWrap: "wrap",
  },
  totalNote: {
    color: COLORS.tertiary,
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },
  chartFootNote: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    marginTop: 8,
    textAlign: "right",
  },

  // Zusammenfassung
  summaryCard: {
    backgroundColor: COLORS.white,
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
  summaryText: { color: COLORS.primary, fontSize: 14, lineHeight: 22 },

  // Export-Buttons
  exportBtnPrimary: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  exportBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  exportBtnSecondary: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 10,
  },
  exportBtnSecText: { color: COLORS.gold, fontWeight: "700", fontSize: 14 },
  printBtn: {
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  printBtnText: { color: COLORS.secondary, fontWeight: "600", fontSize: 13 },
  backBtnBottom: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 32,
  },
  backBtnBottomText: { color: COLORS.tertiary, fontWeight: "600", fontSize: 13 },
});
