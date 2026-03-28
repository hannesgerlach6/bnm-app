import React from "react";
import { Platform } from "react-native";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";

// ============================================================
// PDF-Generator für BNM-Berichte
// Nutzt @react-pdf/renderer — NUR auf Web verfügbar.
// Auf Mobile: Fallback auf Share/Alert.
// ============================================================

const COLORS = {
  primary: "#0A3A5A",
  gold: "#EEA71B",
  text: "#101828",
  textSecondary: "#475467",
  textTertiary: "#98A2B3",
  border: "#e5e7eb",
  bg: "#F9FAFB",
  green: "#15803d",
  red: "#dc2626",
  white: "#FFFFFF",
};

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: COLORS.text, position: "relative" },
  // Cover
  coverPage: { padding: 40, fontFamily: "Helvetica", justifyContent: "center", alignItems: "center", height: "100%" },
  coverLogo: { fontSize: 36, fontWeight: "bold", color: COLORS.gold, marginBottom: 4 },
  coverLogoSub: { fontSize: 10, color: COLORS.textSecondary, letterSpacing: 3, marginBottom: 40 },
  coverTitle: { fontSize: 32, fontWeight: "bold", color: COLORS.primary, marginBottom: 8 },
  coverSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  coverLine: { width: 60, height: 3, backgroundColor: COLORS.gold, marginVertical: 24 },
  coverInfo: { fontSize: 10, color: COLORS.textTertiary, marginBottom: 4 },
  // Header
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  headerLeft: {},
  headerRight: { textAlign: "right" as any },
  headerTitle: { fontSize: 12, fontWeight: "bold", color: COLORS.primary },
  headerSub: { fontSize: 9, color: COLORS.textSecondary, marginTop: 2 },
  // Section
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.primary, marginBottom: 12, marginTop: 8 },
  sectionLine: { width: 40, height: 2, backgroundColor: COLORS.gold, marginBottom: 16 },
  // KPI Grid
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", marginBottom: 16 },
  kpiCard: { width: "30%", border: `1 solid ${COLORS.border}`, borderRadius: 6, padding: 10, marginRight: "3%", marginBottom: 10 },
  kpiValue: { fontSize: 22, fontWeight: "bold", color: COLORS.primary },
  kpiLabel: { fontSize: 8, color: COLORS.textSecondary, marginTop: 4, textTransform: "uppercase" as any, letterSpacing: 0.5 },
  kpiSub: { fontSize: 7, color: COLORS.textTertiary, marginTop: 2 },
  // Highlight Card
  highlightCard: { backgroundColor: "#FEF3C7", borderRadius: 8, padding: 14, marginBottom: 16, borderLeftWidth: 3, borderLeftColor: COLORS.gold },
  highlightLabel: { fontSize: 9, color: "#92400E", fontWeight: "bold", marginBottom: 4 },
  highlightValue: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  highlightSub: { fontSize: 9, color: COLORS.textSecondary, marginTop: 4 },
  // Table
  table: { width: "100%", marginBottom: 16 },
  tableHeader: { flexDirection: "row", backgroundColor: COLORS.bg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 6, paddingHorizontal: 8 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 5, paddingHorizontal: 8 },
  tableRowAlt: { backgroundColor: "#FAFAFA" },
  tableCell: { fontSize: 9, color: COLORS.text },
  tableCellHeader: { fontSize: 8, fontWeight: "bold", color: COLORS.textSecondary, textTransform: "uppercase" as any },
  cellRank: { width: "8%" },
  cellName: { width: "28%" },
  cellScore: { width: "16%" },
  cellSessions: { width: "16%" },
  cellCompleted: { width: "16%" },
  cellRating: { width: "16%" },
  // Summary
  summaryBox: { backgroundColor: COLORS.bg, borderRadius: 8, padding: 16, marginBottom: 16, border: `1 solid ${COLORS.border}` },
  summaryText: { fontSize: 10, lineHeight: 1.6, color: COLORS.text },
  // Steps
  stepRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 10 },
  stepNumber: { width: 20, height: 20, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center", marginRight: 10 },
  stepNumberText: { fontSize: 9, fontWeight: "bold", color: COLORS.white },
  stepText: { flex: 1, fontSize: 10, color: COLORS.text, lineHeight: 1.5 },
  stepTime: { fontSize: 8, color: COLORS.gold, fontWeight: "bold" },
  // Footer
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8 },
  footerText: { fontSize: 7, color: COLORS.textTertiary },
  footerCenter: { fontSize: 7, color: COLORS.textTertiary },
  footerRight: { fontSize: 7, color: COLORS.textTertiary },
  // Award
  awardPage: { padding: 40, fontFamily: "Helvetica", alignItems: "center", justifyContent: "center", border: `2 solid ${COLORS.gold}`, margin: 20, borderRadius: 12 },
  awardAccent: { width: 60, height: 3, backgroundColor: COLORS.gold, marginVertical: 16 },
  awardLabel: { fontSize: 10, color: COLORS.textSecondary, letterSpacing: 4, textTransform: "uppercase" as any, marginBottom: 8 },
  awardTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  awardPeriod: { fontSize: 12, color: COLORS.textSecondary, fontStyle: "italic", marginBottom: 20 },
  awardName: { fontSize: 28, fontWeight: "bold", color: COLORS.gold, marginBottom: 20 },
  awardStatsRow: { flexDirection: "row", marginBottom: 20, gap: 16 },
  awardStat: { alignItems: "center", padding: 10, border: `1 solid ${COLORS.border}`, borderRadius: 6, minWidth: 80 },
  awardStatValue: { fontSize: 20, fontWeight: "bold", color: COLORS.primary },
  awardStatLabel: { fontSize: 8, color: COLORS.textSecondary, marginTop: 2 },
  awardFooter: { fontSize: 8, color: COLORS.textTertiary, marginTop: 20 },
});

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface ReportKPIs {
  activeBetreuungen: number;
  abgeschlossen: number;
  mentoren: number;
  mentees: number;
  sessions: number;
  neueBetreuungen: number;
  wuduSessions: number;
  salahSessions: number;
  koranSessions: number;
  nachbetreuung: number;
}

export interface MentorRanking {
  rank: number;
  name: string;
  score: number;
  sessions: number;
  completed: number;
  rating: number | null;
}

export interface ReportData {
  period: string;
  periodLabel: string;
  kpis: ReportKPIs;
  mentorOfMonth: { name: string; score: number; sessions: number; completed: number } | null;
  rankings: MentorRanking[];
  summaryText: string;
}

export interface AwardData {
  mentorName: string;
  period: string;
  score: number;
  sessions: number;
  completed: number;
}

// ─── Monatsbericht Document ──────────────────────────────────────────────────

function PageFooter({ page, total }: { page: number; total: number }) {
  return (
    <View style={s.footer} fixed>
      <Text style={s.footerText}>BNM · Vertraulich</Text>
      <Text style={s.footerCenter}>iman.ngo</Text>
      <Text style={s.footerRight}>Seite {page} von {total}</Text>
    </View>
  );
}

function MonthlyReportDocument({ period, periodLabel, kpis, mentorOfMonth, rankings, summaryText }: ReportData) {
  const totalPages = 4;
  return (
    <Document>
      {/* Seite 1: Deckblatt */}
      <Page size="A4" style={s.coverPage}>
        <Text style={s.coverLogo}>BNM</Text>
        <Text style={s.coverLogoSub}>BETREUUNG NEUER MUSLIME</Text>
        <View style={s.coverLine} />
        <Text style={s.coverTitle}>Monatsbericht</Text>
        <Text style={s.coverSubtitle}>{periodLabel}</Text>
        <View style={s.coverLine} />
        <Text style={s.coverInfo}>Erstellt am: {new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "long", year: "numeric" })}</Text>
        <Text style={s.coverInfo}>BNM – Ein iERA Projekt in Kooperation mit IMAN</Text>
        <PageFooter page={1} total={totalPages} />
      </Page>

      {/* Seite 2: KPI-Übersicht */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>Monatsbericht</Text>
            <Text style={s.headerSub}>Betreuung neuer Muslime</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>{periodLabel}</Text>
            <Text style={s.headerSub}>BNM-Programm</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Kennzahlen-Übersicht</Text>
        <View style={s.sectionLine} />

        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.activeBetreuungen}</Text>
            <Text style={s.kpiLabel}>Aktive Betreuungen</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={[s.kpiValue, { color: COLORS.green }]}>{kpis.abgeschlossen}</Text>
            <Text style={s.kpiLabel}>Abgeschlossen</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.mentoren}</Text>
            <Text style={s.kpiLabel}>Mentoren</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={[s.kpiValue, { color: COLORS.gold }]}>{kpis.mentees}</Text>
            <Text style={s.kpiLabel}>Mentees gesamt</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.sessions}</Text>
            <Text style={s.kpiLabel}>Sessions gesamt</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.neueBetreuungen}</Text>
            <Text style={s.kpiLabel}>Neue Betreuungen</Text>
          </View>
        </View>

        {/* Session-Aufschlüsselung */}
        <View style={s.kpiGrid}>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.wuduSessions}</Text>
            <Text style={s.kpiLabel}>Wudu-Sessions</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.salahSessions}</Text>
            <Text style={s.kpiLabel}>Salah-Sessions</Text>
          </View>
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{kpis.koranSessions}</Text>
            <Text style={s.kpiLabel}>Koran-Sessions</Text>
          </View>
        </View>

        {mentorOfMonth && (
          <View style={s.highlightCard}>
            <Text style={s.highlightLabel}>★ MENTOR DES MONATS</Text>
            <Text style={s.highlightValue}>{mentorOfMonth.name}</Text>
            <Text style={s.highlightSub}>
              {mentorOfMonth.score} Punkte · {mentorOfMonth.completed} Abschlüsse · {mentorOfMonth.sessions} Sessions
            </Text>
          </View>
        )}

        <PageFooter page={2} total={totalPages} />
      </Page>

      {/* Seite 3: Mentor-Rangliste */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>Monatsbericht</Text>
            <Text style={s.headerSub}>Betreuung neuer Muslime</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>{periodLabel}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Mentor-Rangliste</Text>
        <View style={s.sectionLine} />

        <View style={s.table}>
          <View style={s.tableHeader}>
            <Text style={[s.tableCellHeader, s.cellRank]}>#</Text>
            <Text style={[s.tableCellHeader, s.cellName]}>Name</Text>
            <Text style={[s.tableCellHeader, s.cellScore]}>Score</Text>
            <Text style={[s.tableCellHeader, s.cellSessions]}>Sessions</Text>
            <Text style={[s.tableCellHeader, s.cellCompleted]}>Abschlüsse</Text>
            <Text style={[s.tableCellHeader, s.cellRating]}>Bewertung</Text>
          </View>
          {rankings.slice(0, 20).map((m, idx) => (
            <View key={idx} style={[s.tableRow, idx % 2 === 1 ? s.tableRowAlt : {}]}>
              <Text style={[s.tableCell, s.cellRank, idx < 3 ? { fontWeight: "bold", color: COLORS.gold } : {}]}>{m.rank}</Text>
              <Text style={[s.tableCell, s.cellName, { fontWeight: idx < 3 ? "bold" : "normal" }]}>{m.name}</Text>
              <Text style={[s.tableCell, s.cellScore]}>{m.score}</Text>
              <Text style={[s.tableCell, s.cellSessions]}>{m.sessions}</Text>
              <Text style={[s.tableCell, s.cellCompleted]}>{m.completed}</Text>
              <Text style={[s.tableCell, s.cellRating]}>{m.rating !== null ? `${m.rating.toFixed(1)} ★` : "–"}</Text>
            </View>
          ))}
        </View>

        <PageFooter page={3} total={totalPages} />
      </Page>

      {/* Seite 4: Zusammenfassung */}
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View style={s.headerLeft}>
            <Text style={s.headerTitle}>Monatsbericht</Text>
            <Text style={s.headerSub}>Betreuung neuer Muslime</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerTitle}>{periodLabel}</Text>
          </View>
        </View>

        <Text style={s.sectionTitle}>Zusammenfassung</Text>
        <View style={s.sectionLine} />

        <View style={s.summaryBox}>
          <Text style={s.summaryText}>{summaryText}</Text>
        </View>

        <Text style={[s.sectionTitle, { marginTop: 16 }]}>Hinweis</Text>
        <View style={s.summaryBox}>
          <Text style={[s.summaryText, { color: COLORS.textTertiary }]}>
            Dieser Bericht wurde automatisch generiert und dient der internen Dokumentation des BNM-Programms. Alle Daten basieren auf den dokumentierten Sessions und Betreuungen im angegebenen Zeitraum. BNM – Ein iERA Projekt in Kooperation mit IMAN (iman.ngo).
          </Text>
        </View>

        <PageFooter page={4} total={totalPages} />
      </Page>
    </Document>
  );
}

// ─── Mentor Award Document ───────────────────────────────────────────────────

function MentorAwardDocument({ mentorName, period, score, sessions, completed }: AwardData) {
  return (
    <Document>
      <Page size="A4" style={{ padding: 0 }}>
        <View style={s.awardPage}>
          <Text style={s.coverLogo}>BNM</Text>
          <Text style={s.coverLogoSub}>BETREUUNG NEUER MUSLIME</Text>
          <View style={s.awardAccent} />
          <Text style={s.awardLabel}>AUSZEICHNUNG</Text>
          <Text style={s.awardTitle}>Mentor des Monats</Text>
          <Text style={s.awardPeriod}>{period}</Text>
          <View style={s.awardAccent} />
          <Text style={s.awardName}>{mentorName}</Text>
          <View style={s.awardStatsRow}>
            <View style={s.awardStat}>
              <Text style={s.awardStatValue}>{score}</Text>
              <Text style={s.awardStatLabel}>Punkte</Text>
            </View>
            <View style={s.awardStat}>
              <Text style={s.awardStatValue}>{completed}</Text>
              <Text style={s.awardStatLabel}>Abschlüsse</Text>
            </View>
            <View style={s.awardStat}>
              <Text style={s.awardStatValue}>{sessions}</Text>
              <Text style={s.awardStatLabel}>Sessions</Text>
            </View>
          </View>
          <View style={s.awardAccent} />
          <Text style={s.awardFooter}>BNM – Betreuung neuer Muslime · iman.ngo</Text>
          <Text style={[s.awardFooter, { marginTop: 4 }]}>Ein iERA Projekt in Kooperation mit IMAN</Text>
        </View>
      </Page>
    </Document>
  );
}

// ─── Download-Funktionen ─────────────────────────────────────────────────────

export async function downloadMonthlyReportPDF(data: ReportData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const blob = await pdf(<MonthlyReportDocument {...data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BNM-Monatsbericht-${data.period}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}

export async function downloadMentorAwardPDF(data: AwardData): Promise<boolean> {
  if (Platform.OS !== "web") return false;
  try {
    const blob = await pdf(<MentorAwardDocument {...data} />).toBlob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `BNM-Mentor-des-Monats-${data.period}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch {
    return false;
  }
}
