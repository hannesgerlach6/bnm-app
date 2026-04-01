/**
 * Mentor des Monats — Urkunde/Award-Screen
 * - Zeigt schöne Award-Card mit Mentor-Details
 * - "Herunterladen" → window.print() mit @media print Styles
 * - "Speichern" → INSERT in mentor_awards Tabelle
 * - Dropdown für vergangene Awards
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS } from "../../constants/Colors";
import { supabase } from "../../lib/supabase";
import { showError, showSuccess } from "../../lib/errorHandler";
// PDF wird dynamisch importiert um ESM-Kompatibilitätsprobleme zu vermeiden
import { Container } from "../../components/Container";
import { BNMLogo } from "../../components/BNMLogo";

interface MentorAward {
  id: string;
  mentor_id: string;
  month: number;
  year: number;
  score: number;
  completions: number;
  sessions_count: number;
  created_at: string;
  mentor_name?: string;
}

const MONTH_NAMES_DE = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const MONTH_NAMES_TR = ["Ocak","Şubat","Mart","Nisan","Mayıs","Haziran","Temmuz","Ağustos","Eylül","Ekim","Kasım","Aralık"];
const MONTH_NAMES_AR = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
const MONTH_NAMES_EN = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getMonthName(month: number, lang: string): string {
  const idx = month - 1;
  if (lang === "tr") return MONTH_NAMES_TR[idx] ?? "";
  if (lang === "ar") return MONTH_NAMES_AR[idx] ?? "";
  if (lang === "en") return MONTH_NAMES_EN[idx] ?? "";
  return MONTH_NAMES_DE[idx] ?? "";
}

export default function MentorAwardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ mentorId?: string }>();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, mentorships, sessions, getUserById } = useData();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isSaving, setIsSaving] = useState(false);
  const [pastAwards, setPastAwards] = useState<MentorAward[]>([]);
  const [loadingPast, setLoadingPast] = useState(true);
  const [viewingPastAward, setViewingPastAward] = useState<MentorAward | null>(null);

  // Mentor des Monats berechnen (höchster Score) — MUSS vor Early-Return stehen (Hooks-Regel)
  const topMentor = useMemo(() => {
    const mentors = users.filter((u) => u.role === "mentor");
    if (mentors.length === 0) return null;
    const scored = mentors.map((mentor) => {
      const myMs = mentorships.filter((m) => m.mentor_id === mentor.id);
      const completedCount = myMs.filter((m) => m.status === "completed").length;
      const sessionCount = sessions.filter((s) => myMs.some((m) => m.id === s.mentorship_id)).length;
      const score = completedCount * 10 + sessionCount * 3;
      return { mentor, score, completedCount, sessionCount };
    }).sort((a, b) => b.score - a.score);
    return scored[0].score > 0 ? scored[0] : null;
  }, [users, mentorships, sessions]);

  // Vergangene Awards laden — MUSS vor Early-Return stehen (Hooks-Regel)
  useEffect(() => {
    loadPastAwards();
  }, []);

  // Vergangener Monat?
  const isMonthEnded =
    selectedYear < now.getFullYear() ||
    (selectedYear === now.getFullYear() && selectedMonth < now.getMonth() + 1);

  // Auto-Match: Gespeicherten Award für den gewählten Monat finden
  const autoAward = useMemo(
    () => pastAwards.find((a) => a.month === selectedMonth && a.year === selectedYear) ?? null,
    [pastAwards, selectedMonth, selectedYear]
  );

  // Aktiv anzuzeigender Award: explizit via Liste > auto-match aus Monatswahl > null
  const effectiveAward = viewingPastAward ?? (isMonthEnded ? autoAward : null);

  // Vergangener Monat ohne gespeicherten Award
  const noAwardForPeriod = isMonthEnded && effectiveAward === null;

  // Erstellen nur erlaubt wenn echte Daten vorhanden (topMentor bereits oben deklariert)
  const canCreateCertificate = !noAwardForPeriod && (effectiveAward !== null || (!isMonthEnded && topMentor !== null));

  // Wenn mentorId per params übergeben, diesen Mentor verwenden
  const paramMentor = params.mentorId ? getUserById(params.mentorId) : null;
  // Display-Werte: aus gespeichertem Award ODER aktuellem Top-Mentor (nur laufender Monat)
  const displayScore = effectiveAward?.score ?? (noAwardForPeriod ? 0 : topMentor?.score ?? 0);
  const displayCompletions = effectiveAward?.completions ?? (noAwardForPeriod ? 0 : topMentor?.completedCount ?? 0);
  const displaySessions = effectiveAward?.sessions_count ?? (noAwardForPeriod ? 0 : topMentor?.sessionCount ?? 0);
  const displayMentorName = effectiveAward?.mentor_name
    ?? (noAwardForPeriod ? "–" : (paramMentor?.name ?? topMentor?.mentor?.name ?? "–"));
  const displayMonth = effectiveAward?.month ?? selectedMonth;
  const displayYear = effectiveAward?.year ?? selectedYear;

  // Zugriff nur für Admin — Early-Return NACH allen Hooks
  if (!authUser || (authUser.role !== "admin" && authUser.role !== "office")) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.background }}>
        <Text style={{ color: themeColors.error }}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  async function loadPastAwards() {
    setLoadingPast(true);
    try {
      const { data, error } = await supabase
        .from("mentor_awards")
        .select("*")
        .order("year", { ascending: false })
        .order("month", { ascending: false })
        .limit(24);
      if (error) {
        console.warn("[MentorAward] load error:", error.message);
      } else if (data) {
        // Mentor-Namen auflösen
        const withNames: MentorAward[] = await Promise.all(
          data.map(async (row: any) => {
            const mentor = getUserById(row.mentor_id);
            return {
              id: row.id,
              mentor_id: row.mentor_id,
              month: row.month,
              year: row.year,
              score: row.score,
              completions: row.completions,
              sessions_count: row.sessions_count,
              created_at: row.created_at,
              mentor_name: mentor?.name ?? "–",
            };
          })
        );
        setPastAwards(withNames);
      }
    } finally {
      setLoadingPast(false);
    }
  }

  async function handleSave() {
    if (!effectiveAward && !topMentor) {
      showError(t("mentorAward.noMentorError"));
      return;
    }
    setIsSaving(true);
    try {
      const mentorId = effectiveAward?.mentor_id ?? paramMentor?.id ?? topMentor?.mentor?.id;
      const { error } = await supabase.from("mentor_awards").upsert(
        {
          mentor_id: mentorId,
          month: selectedMonth,
          year: selectedYear,
          score: displayScore,
          completions: displayCompletions,
          sessions_count: displaySessions,
        },
        { onConflict: "month,year" }
      );
      if (error) {
        showError(t("mentorAward.saveError"));
        console.warn("[MentorAward] save error:", error.message);
      } else {
        showSuccess(t("mentorAward.saveSuccess"));
        await loadPastAwards();
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDownloadPDF() {
    if (Platform.OS !== "web") return;
    try {
      const { downloadMentorAwardPDF } = await import("../../lib/pdfGenerator");
      await downloadMentorAwardPDF({
        mentorName: displayMentorName,
        period: `${getMonthName(displayMonth, "de")} ${displayYear}`,
        score: displayScore,
        sessions: displaySessions,
        completed: displayCompletions,
      });
    } catch {
      showError("PDF-Generator konnte nicht geladen werden");
    }
  }

  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  async function handleDownloadPastPDF(award: MentorAward) {
    if (Platform.OS !== "web") return;
    setDownloadingId(award.id);
    try {
      const { downloadMentorAwardPDF } = await import("../../lib/pdfGenerator");
      await downloadMentorAwardPDF({
        mentorName: award.mentor_name,
        period: `${getMonthName(award.month, "de")} ${award.year}`,
        score: award.score,
        sessions: award.sessions_count,
        completed: award.completions,
      });
    } catch {
      showError("PDF-Generator konnte nicht geladen werden");
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>

          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={themeColors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentorAward.title")}</Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("mentorAward.subtitle")}</Text>
            </View>
          </View>

          {/* Monat/Jahr Auswahl */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.cardLabel, { color: themeColors.textSecondary }]}>{t("mentorAward.selectPeriod")}</Text>
            <View style={styles.periodRow}>
              {/* Monat */}
              <View style={styles.periodGroup}>
                <Text style={[styles.periodLabel, { color: themeColors.textTertiary }]}>{t("mentorAward.month")}</Text>
                <View style={styles.monthGrid}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.monthBtn,
                        selectedMonth === m
                          ? { backgroundColor: COLORS.gold }
                          : { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      ]}
                      onPress={() => { setSelectedMonth(m); setViewingPastAward(null); }}
                    >
                      <Text style={[styles.monthBtnText, { color: selectedMonth === m ? "#0E0E14" : themeColors.textSecondary }]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              {/* Jahr */}
              <View style={styles.periodGroup}>
                <Text style={[styles.periodLabel, { color: themeColors.textTertiary }]}>{t("mentorAward.year")}</Text>
                <View style={styles.yearRow}>
                  {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearBtn,
                        selectedYear === y
                          ? { backgroundColor: COLORS.gold }
                          : { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      ]}
                      onPress={() => { setSelectedYear(y); setViewingPastAward(null); }}
                    >
                      <Text style={[styles.yearBtnText, { color: selectedYear === y ? "#0E0E14" : themeColors.textSecondary }]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Award-Card */}
          <View style={[styles.awardCard, { borderColor: COLORS.gold }]}>
            {/* Goldener Header-Streifen */}
            <View style={styles.awardHeader}>
              <BNMLogo size={72} showSubtitle={false} />
              <Text style={styles.awardHeaderTitle}>{t("mentorAward.awardTitle")}</Text>
              <Text style={styles.awardHeaderSub}>{t("mentorAward.awardSub")}</Text>
            </View>

            {/* Dekorativer Goldstreifen */}
            <View style={styles.awardTopAccent} />

            {/* Sterne */}
            <View style={styles.starsRow}>
              {["★","★","★","★","★"].map((s, i) => (
                <Text key={i} style={styles.starChar}>{s}</Text>
              ))}
            </View>

            {/* Auszeichnungs-Label */}
            <Text style={styles.awardCertLabel}>AUSZEICHNUNG</Text>

            {/* Mentor-Name mit Deko-Linien */}
            <View style={styles.awardNameRow}>
              <View style={styles.awardNameLine} />
              <Text style={styles.awardMentorName}>{displayMentorName}</Text>
              <View style={styles.awardNameLine} />
            </View>

            {/* Monat / Jahr */}
            <Text style={styles.awardPeriod}>
              {getMonthName(displayMonth, "de")} {displayYear}
            </Text>

            {/* Doppel-Trennlinie */}
            <View style={styles.awardDividerWrapper}>
              <View style={styles.awardDivider} />
              <View style={styles.awardDividerThin} />
            </View>

            {/* Stats */}
            <View style={styles.awardStatsRow}>
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{displayScore}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.points")}</Text>
              </View>
              <View style={styles.awardStatDivider} />
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{displayCompletions}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.completions")}</Text>
              </View>
              <View style={styles.awardStatDivider} />
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{displaySessions}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.sessions")}</Text>
              </View>
            </View>

            {/* Footer mit Unterschrift-Deko */}
            <View style={styles.awardFooterWrapper}>
              <View style={styles.awardFooterLine} />
              <Text style={styles.awardFooter}>{t("mentorAward.awardFooter")}</Text>
              <Text style={styles.awardFooterOrg}>Become a New Muslim (BNM)</Text>
            </View>
          </View>

          {/* Aktions-Buttons */}
          <View style={styles.actionsRow}>
            {Platform.OS === "web" && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnPrint, !canCreateCertificate && { opacity: 0.35 }]}
                onPress={handleDownloadPDF}
                disabled={!canCreateCertificate}
                activeOpacity={0.8}
              >
                <Ionicons name="download-outline" size={18} color="#0E0E14" />
                <Text style={styles.actionBtnPrintText}>{t("mentorAward.download")}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnSave, (isSaving || !canCreateCertificate) && { opacity: 0.35 }]}
              onPress={handleSave}
              disabled={isSaving || !canCreateCertificate}
              activeOpacity={0.8}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="save-outline" size={18} color={COLORS.white} />
                  <Text style={styles.actionBtnSaveText}>{t("mentorAward.save")}</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {noAwardForPeriod && (
            <Text style={[styles.monthNotEndedHint, { color: themeColors.textTertiary }]}>
              {t("mentorAward.noAwardForPeriod")}
            </Text>
          )}
          {!canCreateCertificate && !noAwardForPeriod && (
            <Text style={[styles.monthNotEndedHint, { color: themeColors.textTertiary }]}>
              {t("mentorAward.monthNotEnded")}
            </Text>
          )}

          {/* Vergangene Awards */}
          {!loadingPast && pastAwards.length > 0 && (
            <View style={[styles.pastCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.pastTitle, { color: themeColors.text }]}>{t("mentorAward.pastAwards")}</Text>
              {pastAwards.map((award, idx) => (
                <TouchableOpacity
                  key={award.id}
                  style={[
                    styles.pastRow,
                    idx < pastAwards.length - 1 && [styles.pastRowBorder, { borderBottomColor: themeColors.border }],
                    viewingPastAward?.id === award.id && { backgroundColor: isDark ? "#2A2A18" : "#fffbeb" },
                  ]}
                  onPress={() => setViewingPastAward(viewingPastAward?.id === award.id ? null : award)}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pastRowName, { color: themeColors.text }]}>{award.mentor_name}</Text>
                    <Text style={[styles.pastRowPeriod, { color: themeColors.textSecondary }]}>
                      {getMonthName(award.month, "de")} {award.year}
                    </Text>
                  </View>
                  <Text style={[styles.pastRowScore, { color: COLORS.gold }]}>{award.score} {t("leaderboard.points")}</Text>
                  <Ionicons
                    name={viewingPastAward?.id === award.id ? "eye" : "eye-outline"}
                    size={18}
                    color={themeColors.textSecondary}
                    style={{ marginLeft: 8 }}
                  />
                  {Platform.OS === "web" && (
                    <TouchableOpacity
                      onPress={(e) => { e.stopPropagation?.(); handleDownloadPastPDF(award); }}
                      style={[styles.pastPdfBtn, downloadingId === award.id && { opacity: 0.5 }]}
                      disabled={downloadingId === award.id}
                      accessibilityRole="button"
                      accessibilityLabel="PDF herunterladen"
                    >
                      <Ionicons
                        name={downloadingId === award.id ? "hourglass-outline" : "download-outline"}
                        size={16}
                        color={COLORS.gradientStart}
                      />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20, maxWidth: 720, alignSelf: "center", width: "100%" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
  backButton: { padding: 6 },
  pageTitle: { fontSize: 22, fontWeight: "800" },
  pageSubtitle: { fontSize: 13, marginTop: 2 },

  // Periode Auswahl
  card: { borderRadius: 12, borderWidth: 1, padding: 16, marginBottom: 20 },
  cardLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  periodRow: { gap: 16 },
  periodGroup: { gap: 8 },
  periodLabel: { fontSize: 12, fontWeight: "500" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  monthBtn: { width: 42, height: 36, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 13, fontWeight: "600" },
  yearRow: { flexDirection: "row", gap: 8 },
  yearBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  yearBtnText: { fontSize: 14, fontWeight: "600" },

  // Award Card
  awardCard: {
    borderWidth: 3,
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    backgroundColor: "#FFFDF5",
    // Dezenter Schatten
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  awardHeader: {
    backgroundColor: "#101828",
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 10,
  },
  awardHeaderTitle: {
    color: COLORS.gold,
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 3,
    textAlign: "center",
    textTransform: "uppercase" as const,
  },
  awardHeaderSub: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    textAlign: "center",
    letterSpacing: 1.5,
  },
  awardTopAccent: {
    height: 4,
    backgroundColor: COLORS.gold,
    opacity: 0.85,
  },
  starsRow: { flexDirection: "row", justifyContent: "center", paddingTop: 24, gap: 8 },
  starChar: { fontSize: 22, color: COLORS.gold },
  awardCertLabel: {
    textAlign: "center",
    fontSize: 10,
    fontWeight: "700",
    color: "#9CA3AF",
    letterSpacing: 4,
    marginTop: 10,
    marginBottom: 16,
  },
  awardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 24,
    gap: 12,
  },
  awardNameLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.gold,
    opacity: 0.4,
  },
  awardMentorName: {
    textAlign: "center",
    fontSize: 28,
    fontWeight: "900",
    color: "#101828",
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  awardPeriod: {
    textAlign: "center",
    fontSize: 14,
    color: "#6B7280",
    marginTop: 8,
    letterSpacing: 2.5,
    marginBottom: 20,
    fontStyle: "italic" as const,
  },
  awardDividerWrapper: {
    marginHorizontal: 40,
    gap: 3,
    marginBottom: 4,
  },
  awardDivider: { height: 2, backgroundColor: COLORS.gold, opacity: 0.6 },
  awardDividerThin: { height: 1, backgroundColor: COLORS.gold, opacity: 0.25 },
  awardStatsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  awardStatItem: { alignItems: "center", flex: 1 },
  awardStatValue: { fontSize: 30, fontWeight: "800", color: "#101828" },
  awardStatLabel: { fontSize: 10, color: "#9CA3AF", marginTop: 4, textAlign: "center", letterSpacing: 0.5, fontWeight: "600" as const },
  awardStatDivider: { width: 1, height: 44, backgroundColor: "#E5E7EB" },
  awardFooterWrapper: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 20,
    gap: 6,
  },
  awardFooterLine: {
    width: 64,
    height: 2,
    backgroundColor: COLORS.gold,
    opacity: 0.35,
    marginBottom: 6,
  },
  awardFooter: {
    textAlign: "center",
    fontSize: 11,
    color: "#9CA3AF",
    letterSpacing: 1.2,
    fontStyle: "italic" as const,
  },
  awardFooterOrg: {
    textAlign: "center",
    fontSize: 10,
    color: "#D1D5DB",
    letterSpacing: 0.8,
    fontWeight: "600" as const,
  },

  // Aktionen
  actionsRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  monthNotEndedHint: { fontSize: 12, textAlign: "center", marginBottom: 20, fontStyle: "italic" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 10,
    gap: 8,
  },
  actionBtnPrint: { backgroundColor: COLORS.gold },
  actionBtnPrintText: { color: "#0E0E14", fontWeight: "700", fontSize: 14 },
  actionBtnSave: { backgroundColor: COLORS.primary },
  actionBtnSaveText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  // Vergangene Awards
  pastCard: { borderRadius: 12, borderWidth: 1, marginBottom: 20, overflow: "hidden" },
  pastTitle: { fontSize: 14, fontWeight: "700", padding: 14, paddingBottom: 10 },
  pastRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 8,
  },
  pastRowBorder: { borderBottomWidth: 1 },
  pastRowName: { fontWeight: "600", fontSize: 14 },
  pastRowPeriod: { fontSize: 12, marginTop: 2 },
  pastRowScore: { fontSize: 13, fontWeight: "700" },
  pastPdfBtn: {
    marginLeft: 10,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.gradientStart + "40",
    backgroundColor: COLORS.gradientStart + "10",
  },
});
