import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";

const MONTHS = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

export default function ReportsScreen() {
  const { user } = useAuth();
  const { mentorships, sessions, sessionTypes, users } = useData();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const years = [2024, 2025, 2026];

  const kpis = useMemo(() => {
    const inMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    };

    const totalAssigned = mentorships.filter((m) => inMonth(m.assigned_at)).length;
    const firstContactTypeId = sessionTypes.find((st) => st.name === "Erstkontakt")?.id ?? "st-3";
    const firstContacts = sessions.filter((s) => s.session_type_id === firstContactTypeId && inMonth(s.date)).length;
    const firstMeetingTypeId = sessionTypes.find((st) => st.name === "Ersttreffen")?.id ?? "st-4";
    const firstMeetings = sessions.filter((s) => s.session_type_id === firstMeetingTypeId && inMonth(s.date)).length;
    const bnmBoxTypeId = sessionTypes.find((st) => st.name === "BNM-Box")?.id ?? "st-5";
    const bnmBoxes = sessions.filter((s) => s.session_type_id === bnmBoxTypeId && inMonth(s.date)).length;
    const totalSessions = sessions.filter((s) => inMonth(s.date)).length;
    const completions = mentorships.filter((m) => m.status === "completed" && m.completed_at && inMonth(m.completed_at)).length;
    const cancellations = mentorships.filter((m) => m.status === "cancelled" && m.completed_at && inMonth(m.completed_at)).length;

    return { totalAssigned, firstContacts, firstMeetings, bnmBoxes, totalSessions, completions, cancellations };
  }, [selectedMonth, selectedYear, mentorships, sessions, sessionTypes]);

  const mentorOfMonth = useMemo(() => {
    const inMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      return d.getMonth() === selectedMonth && d.getFullYear() === selectedYear;
    };
    const mentors = users.filter((u) => u.role === "mentor");
    let best: { mentor: typeof mentors[0]; count: number } | null = null;
    for (const mentor of mentors) {
      const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
      const mySessionCount = sessions.filter(
        (s) => myMentorships.some((m) => m.id === s.mentorship_id) && inMonth(s.date)
      ).length;
      if (!best || mySessionCount > best.count) {
        best = { mentor, count: mySessionCount };
      }
    }
    return best;
  }, [selectedMonth, selectedYear, users, mentorships, sessions]);

  const barChartData = useMemo(() => {
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
  }, [selectedMonth, selectedYear, sessions]);

  const maxBarValue = Math.max(...barChartData.map((w) => w.count), 1);

  if (user?.role !== "admin") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Nur für Admins zugänglich.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Monatsberichte</Text>
        <Text style={styles.pageSubtitle}>KPIs und Statistiken auf einen Blick</Text>

        {/* Monatsauswahl */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>{"ZEITRAUM WÄHLEN"}</Text>

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
        </View>

        {/* Ausgewählter Zeitraum */}
        <Text style={styles.periodTitle}>
          {MONTHS[selectedMonth]} {selectedYear}
        </Text>

        {/* KPI-Karten */}
        <View style={styles.kpiRow}>
          <KpiCard label="Neue Betreuungen" value={kpis.totalAssigned} color={COLORS.primary} />
          <KpiCard label="Sessions gesamt" value={kpis.totalSessions} color={COLORS.primary} />
        </View>
        <View style={styles.kpiRow}>
          <KpiCard label="Erstkontakte" value={kpis.firstContacts} color={COLORS.gold} />
          <KpiCard label="Ersttreffen" value={kpis.firstMeetings} color={COLORS.gold} />
        </View>
        <View style={[styles.kpiRow, { marginBottom: 24 }]}>
          <KpiCard label="BNM-Boxen übergeben" value={kpis.bnmBoxes} color={COLORS.secondary} />
          <KpiCard label="Abschlüsse" value={kpis.completions} color={COLORS.cta} />
        </View>

        {/* Abbrüche */}
        {kpis.cancellations > 0 && (
          <View style={styles.cancellationBox}>
            <Text style={styles.cancellationLabel}>Abbrüche</Text>
            <Text style={styles.cancellationValue}>{kpis.cancellations}</Text>
          </View>
        )}

        {/* Balkendiagramm */}
        <View style={styles.card}>
          <Text style={styles.chartTitle}>Sessions nach Woche</Text>
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
                        { height: Math.max(heightPercent, 4) + "%" },
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
        {mentorOfMonth && mentorOfMonth.count > 0 ? (
          <View style={styles.goldBox}>
            <View style={styles.goldBoxHeader}>
              <Text style={styles.goldStar}>★</Text>
              <Text style={styles.goldBoxTitle}>Mentor des Monats</Text>
            </View>
            <Text style={styles.goldMentorName}>{mentorOfMonth.mentor.name}</Text>
            <Text style={styles.goldMentorSub}>
              {mentorOfMonth.count} Session{mentorOfMonth.count !== 1 ? "s" : ""} dokumentiert
            </Text>
          </View>
        ) : (
          <View style={styles.emptyMonthBox}>
            <Text style={styles.emptyMonthText}>
              Noch keine Sessions in diesem Monat dokumentiert.
            </Text>
          </View>
        )}

        {/* Export-Button */}
        <TouchableOpacity
          style={styles.exportButton}
          onPress={() =>
            Alert.alert(
              "Export wird vorbereitet",
              `Der Bericht für ${MONTHS[selectedMonth]} ${selectedYear} wird generiert...`
            )
          }
        >
          <Text style={styles.exportButtonText}>Bericht exportieren</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
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
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 24 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  cardSectionLabel: { fontSize: 12, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 12 },
  yearRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  yearButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  yearButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  yearButtonInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  yearButtonTextActive: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  yearButtonTextInactive: { color: COLORS.secondary, fontSize: 14, fontWeight: "600" },
  monthRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  monthChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1 },
  monthChipActive: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  monthChipInactive: { backgroundColor: COLORS.bg, borderColor: COLORS.border },
  monthChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  monthChipTextInactive: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },
  periodTitle: { color: COLORS.primary, fontWeight: "bold", fontSize: 18, marginBottom: 16 },
  kpiRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  kpiCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  kpiLabel: { color: COLORS.tertiary, fontSize: 12, marginBottom: 4 },
  kpiValue: { fontSize: 30, fontWeight: "bold" },
  cancellationBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cancellationLabel: { color: "#b91c1c", fontWeight: "600" },
  cancellationValue: { color: "#b91c1c", fontWeight: "bold", fontSize: 24 },
  chartTitle: { fontWeight: "bold", color: COLORS.primary, marginBottom: 16 },
  barChartContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 16,
    height: 128,
    justifyContent: "space-around",
  },
  barColumn: { alignItems: "center", flex: 1 },
  barValueText: { color: COLORS.secondary, fontSize: 12, marginBottom: 4 },
  barTrack: {
    width: "100%",
    backgroundColor: COLORS.bg,
    borderRadius: 4,
    overflow: "hidden",
    height: 96,
    justifyContent: "flex-end",
  },
  barFill: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 4 },
  barLabel: { color: COLORS.tertiary, fontSize: 12, marginTop: 4 },
  goldBox: {
    backgroundColor: "rgba(238,167,27,0.1)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  goldBoxHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  goldStar: { color: COLORS.gold, fontSize: 24, marginRight: 8 },
  goldBoxTitle: { fontWeight: "bold", color: COLORS.primary },
  goldMentorName: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 2 },
  goldMentorSub: { color: COLORS.secondary, fontSize: 14 },
  emptyMonthBox: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  emptyMonthText: { color: COLORS.tertiary, fontSize: 14, textAlign: "center" },
  exportButton: { backgroundColor: COLORS.primary, borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  exportButtonText: { color: COLORS.white, fontWeight: "bold" },
});
