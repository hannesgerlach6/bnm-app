/**
 * Manueller Urkunden-Generator
 * Admin wählt beliebigen Mentor, Zeitraum → PDF / PNG Download oder E-Mail-Versand
 */
import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  ActivityIndicator,
  Modal,
  FlatList,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, SHADOWS } from "../../constants/Colors";
import { showError, showSuccess } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { BNMLogo } from "../../components/BNMLogo";

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

export default function CertificateGeneratorScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const { user: authUser } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, mentorships, sessions } = useData();

  const now = new Date();
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [emailTo, setEmailTo] = useState("");
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingPNG, setIsGeneratingPNG] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [mentorPickerOpen, setMentorPickerOpen] = useState(false);

  const mentors = useMemo(() => users.filter((u) => u.role === "mentor"), [users]);
  const selectedMentor = useMemo(
    () => mentors.find((m) => m.id === selectedMentorId) ?? null,
    [mentors, selectedMentorId]
  );

  const mentorStats = useMemo(() => {
    if (!selectedMentor) return { score: 0, completedCount: 0, sessionCount: 0 };
    const myMs = mentorships.filter((m) => m.mentor_id === selectedMentor.id);

    // Nur Abschlüsse im gewählten Monat/Jahr
    const completedCount = myMs.filter((m) => {
      if (m.status !== "completed" || !m.completed_at) return false;
      const d = new Date(m.completed_at);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    }).length;

    // Nur Sessions im gewählten Monat/Jahr
    const sessionCount = sessions.filter((s) => {
      if (!myMs.some((m) => m.id === s.mentorship_id)) return false;
      if (!s.date) return false;
      const d = new Date(s.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    }).length;

    return { score: completedCount * 10 + sessionCount * 3, completedCount, sessionCount };
  }, [selectedMentor, selectedMonth, selectedYear, mentorships, sessions]);

  const awardData = useMemo(() => ({
    mentorName: selectedMentor?.name ?? "–",
    period: `${getMonthName(selectedMonth, "de")} ${selectedYear}`,
    score: mentorStats.score,
    sessions: mentorStats.sessionCount,
    completed: mentorStats.completedCount,
  }), [selectedMentor, selectedMonth, selectedYear, mentorStats]);

  // E-Mail-Adresse des Mentors als Standard
  useEffect(() => {
    if (selectedMentor?.email) setEmailTo(selectedMentor.email);
  }, [selectedMentor?.email]);

  if (!authUser || (authUser.role !== "admin" && authUser.role !== "office")) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: themeColors.background }}>
        <Text style={{ color: themeColors.error }}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  async function handleDownloadPDF() {
    if (!selectedMentor) { showError(t("certGen.noMentorSelected")); return; }
    setIsGeneratingPDF(true);
    try {
      const { downloadMentorAwardPDF } = await import("../../lib/pdfGenerator");
      await downloadMentorAwardPDF(awardData);
    } catch { showError("PDF-Fehler"); }
    finally { setIsGeneratingPDF(false); }
  }

  async function handleDownloadPNG() {
    if (!selectedMentor) { showError(t("certGen.noMentorSelected")); return; }
    setIsGeneratingPNG(true);
    try {
      const { downloadMentorAwardPNG } = await import("../../lib/pdfGenerator");
      const ok = await downloadMentorAwardPNG(awardData);
      if (!ok) showError("PNG-Fehler");
    } catch { showError("PNG-Fehler"); }
    finally { setIsGeneratingPNG(false); }
  }

  async function handleSendEmail() {
    if (!selectedMentor) { showError(t("certGen.noMentorSelected")); return; }
    const recipient = emailTo.trim();
    if (!recipient) { showError(t("certGen.noEmailEntered")); return; }
    setIsSendingEmail(true);
    try {
      const { generateMentorAwardPDFBytes } = await import("../../lib/pdfGenerator");
      const bytes = await generateMentorAwardPDFBytes(awardData);
      if (!bytes) throw new Error("PDF-Generierung fehlgeschlagen");
      const { sendCertificateEmail } = await import("../../lib/emailService");
      const ok = await sendCertificateEmail(recipient, awardData.mentorName, awardData.period, bytes);
      if (ok) showSuccess(t("certGen.emailSent"));
      else showError(t("certGen.emailError"));
    } catch { showError(t("certGen.emailError")); }
    finally { setIsSendingEmail(false); }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={[styles.page, { paddingTop: insets.top + 16 }]}>

          {/* Header */}
          <View style={styles.header}>
            <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="link" accessibilityLabel="Zurueck">
              <Ionicons name="arrow-back" size={22} color={themeColors.text} />
            </BNMPressable>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("certGen.title")}</Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("certGen.subtitle")}</Text>
            </View>
          </View>

          {/* Mentor-Auswahl */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.cardLabel, { color: themeColors.textSecondary }]}>{t("certGen.selectMentor")}</Text>
            <BNMPressable
              style={[styles.pickerBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setMentorPickerOpen(true)}
              accessibilityRole="button"
              accessibilityLabel="Mentor auswaehlen"
            >
              <Text style={[styles.pickerBtnText, { color: selectedMentor ? themeColors.text : themeColors.textTertiary }]}>
                {selectedMentor?.name ?? t("certGen.noMentorSelected")}
              </Text>
              <Ionicons name="chevron-down" size={16} color={themeColors.textSecondary} />
            </BNMPressable>

            {/* Stats des gewählten Mentors */}
            {selectedMentor && (
              <View style={styles.statsRow}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.gold }]}>{mentorStats.score}</Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.points")}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.gold }]}>{mentorStats.completedCount}</Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.completions")}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: COLORS.gold }]}>{mentorStats.sessionCount}</Text>
                  <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.sessions")}</Text>
                </View>
              </View>
            )}
          </View>

          {/* Zeitraum-Auswahl */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.cardLabel, { color: themeColors.textSecondary }]}>{t("mentorAward.selectPeriod")}</Text>
            <View style={styles.periodRow}>
              <View style={styles.periodGroup}>
                <Text style={[styles.periodLabel, { color: themeColors.textTertiary }]}>{t("mentorAward.month")}</Text>
                <View style={styles.monthGrid}>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <BNMPressable
                      key={m}
                      style={[
                        styles.monthBtn,
                        selectedMonth === m
                          ? { backgroundColor: COLORS.gold }
                          : { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      ]}
                      onPress={() => setSelectedMonth(m)}
                      accessibilityRole="button"
                      accessibilityLabel={`Monat ${m}`}
                      accessibilityState={{ selected: selectedMonth === m }}
                    >
                      <Text style={[styles.monthBtnText, { color: selectedMonth === m ? "#0E0E14" : themeColors.textSecondary }]}>
                        {String(m).padStart(2, "0")}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>
              </View>
              <View style={styles.periodGroup}>
                <Text style={[styles.periodLabel, { color: themeColors.textTertiary }]}>{t("mentorAward.year")}</Text>
                <View style={styles.yearRow}>
                  {[now.getFullYear() - 1, now.getFullYear()].map((y) => (
                    <BNMPressable
                      key={y}
                      style={[
                        styles.yearBtn,
                        selectedYear === y
                          ? { backgroundColor: COLORS.gold }
                          : { backgroundColor: themeColors.background, borderColor: themeColors.border },
                      ]}
                      onPress={() => setSelectedYear(y)}
                      accessibilityRole="button"
                      accessibilityLabel={`Jahr ${y}`}
                      accessibilityState={{ selected: selectedYear === y }}
                    >
                      <Text style={[styles.yearBtnText, { color: selectedYear === y ? "#0E0E14" : themeColors.textSecondary }]}>{y}</Text>
                    </BNMPressable>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Award-Vorschau */}
          <View style={[styles.awardCard, { borderColor: COLORS.gold }]}>
            <View style={styles.awardHeader}>
              <BNMLogo size={64} showSubtitle={false} />
              <Text style={styles.awardHeaderTitle}>{t("mentorAward.awardTitle")}</Text>
              <Text style={styles.awardHeaderSub}>{t("mentorAward.awardSub")}</Text>
            </View>
            <View style={styles.awardTopAccent} />
            <View style={styles.starsRow}>
              {["★","★","★","★","★"].map((s, i) => <Text key={i} style={styles.starChar}>{s}</Text>)}
            </View>
            <Text style={styles.awardCertLabel}>AUSZEICHNUNG</Text>
            <View style={styles.awardNameRow}>
              <View style={styles.awardNameLine} />
              <Text style={styles.awardMentorName}>{awardData.mentorName}</Text>
              <View style={styles.awardNameLine} />
            </View>
            <Text style={styles.awardPeriod}>{awardData.period}</Text>
            <View style={styles.awardDividerWrapper}>
              <View style={styles.awardDivider} />
              <View style={styles.awardDividerThin} />
            </View>
            <View style={styles.awardStatsRow}>
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{awardData.score}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.points")}</Text>
              </View>
              <View style={styles.awardStatDivider} />
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{awardData.completed}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.completions")}</Text>
              </View>
              <View style={styles.awardStatDivider} />
              <View style={styles.awardStatItem}>
                <Text style={styles.awardStatValue}>{awardData.sessions}</Text>
                <Text style={styles.awardStatLabel}>{t("leaderboard.sessions")}</Text>
              </View>
            </View>
            <View style={styles.awardFooterWrapper}>
              <View style={styles.awardFooterLine} />
              <Text style={styles.awardFooter}>{t("mentorAward.awardFooter")}</Text>
              <Text style={styles.awardFooterOrg}>Become a New Muslim (BNM)</Text>
            </View>
          </View>

          {/* Download-Aktionen (nur Web) */}
          {Platform.OS === "web" && (
            <View style={styles.downloadRow}>
              <BNMPressable
                style={[styles.dlBtn, styles.dlBtnPDF, isGeneratingPDF && { opacity: 0.5 }]}
                onPress={handleDownloadPDF}
                disabled={isGeneratingPDF || !selectedMentor}
                accessibilityRole="button"
                accessibilityLabel="PDF herunterladen"
              >
                {isGeneratingPDF ? <ActivityIndicator size="small" color="#0E0E14" /> : <Ionicons name="document-outline" size={16} color="#0E0E14" />}
                <Text style={styles.dlBtnPDFText}>PDF</Text>
              </BNMPressable>
              <BNMPressable
                style={[styles.dlBtn, styles.dlBtnPNG, isGeneratingPNG && { opacity: 0.5 }]}
                onPress={handleDownloadPNG}
                disabled={isGeneratingPNG || !selectedMentor}
                accessibilityRole="button"
                accessibilityLabel="PNG herunterladen"
              >
                {isGeneratingPNG ? <ActivityIndicator size="small" color="#0E0E14" /> : <Ionicons name="image-outline" size={16} color="#0E0E14" />}
                <Text style={styles.dlBtnPNGText}>PNG</Text>
              </BNMPressable>
            </View>
          )}

          {/* E-Mail-Versand */}
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginTop: 0 }]}>
            <Text style={[styles.cardLabel, { color: themeColors.textSecondary }]}>{t("certGen.sendEmail")}</Text>
            <View style={[styles.emailRow, { borderColor: themeColors.border }]}>
              <Ionicons name="mail-outline" size={16} color={themeColors.textSecondary} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.emailInput, { color: themeColors.text }]}
                value={emailTo}
                onChangeText={setEmailTo}
                placeholder={t("certGen.emailPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
            <BNMPressable
              style={[styles.sendBtn, (isSendingEmail || !selectedMentor || !emailTo.trim()) && { opacity: 0.4 }]}
              onPress={handleSendEmail}
              disabled={isSendingEmail || !selectedMentor || !emailTo.trim()}
              accessibilityRole="button"
              accessibilityLabel="E-Mail senden"
            >
              {isSendingEmail
                ? <ActivityIndicator size="small" color={COLORS.white} />
                : <><Ionicons name="send-outline" size={16} color={COLORS.white} /><Text style={styles.sendBtnText}>{t("certGen.sendEmailBtn")}</Text></>
              }
            </BNMPressable>
          </View>

        </View>
      </ScrollView>

      {/* Mentor-Picker Modal */}
      <Modal visible={mentorPickerOpen} transparent animationType="slide" onRequestClose={() => setMentorPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: themeColors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("certGen.selectMentor")}</Text>
              <BNMPressable onPress={() => setMentorPickerOpen(false)} accessibilityRole="button" accessibilityLabel="Schliessen">
                <Ionicons name="close" size={22} color={themeColors.textSecondary} />
              </BNMPressable>
            </View>
            <FlatList
              data={mentors}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <BNMPressable
                  style={[
                    styles.mentorRow,
                    { borderBottomColor: themeColors.border },
                    item.id === selectedMentorId && { backgroundColor: isDark ? "#2A2A18" : "#fffbeb" },
                  ]}
                  onPress={() => { setSelectedMentorId(item.id); setMentorPickerOpen(false); }}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name} auswaehlen`}
                >
                  <Text style={[styles.mentorRowName, { color: themeColors.text }]}>{item.name}</Text>
                  {item.id === selectedMentorId && <Ionicons name="checkmark" size={18} color={COLORS.gold} />}
                </BNMPressable>
              )}
            />
          </View>
        </View>
      </Modal>
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

  card: { borderRadius: RADIUS.sm, borderWidth: 1, padding: 16, marginBottom: 16 },
  cardLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },

  // Mentor-Picker
  pickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerBtnText: { fontSize: 15, fontWeight: "500" },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 14, justifyContent: "space-around" },
  statItem: { alignItems: "center" },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2 },

  // Periode
  periodRow: { gap: 16 },
  periodGroup: { gap: 8 },
  periodLabel: { fontSize: 12, fontWeight: "500" },
  monthGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  monthBtn: { width: 42, height: 36, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthBtnText: { fontSize: 13, fontWeight: "600" },
  yearRow: { flexDirection: "row", gap: 8 },
  yearBtn: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: RADIUS.sm, borderWidth: 1 },
  yearBtnText: { fontSize: 14, fontWeight: "600" },

  // Award-Card
  awardCard: {
    borderWidth: 3, borderRadius: RADIUS.lg, overflow: "hidden", marginBottom: 16,
    backgroundColor: "#FFFDF5",  // Award-Card off-white, kein COLORS-Mapping
    ...SHADOWS.goldMedium,
  },
  awardHeader: { backgroundColor: COLORS.primary, alignItems: "center", paddingVertical: 28, paddingHorizontal: 24, gap: 8 },
  awardHeaderTitle: { color: COLORS.gold, fontSize: 18, fontWeight: "800", letterSpacing: 3, textAlign: "center", textTransform: "uppercase" as const },
  awardHeaderSub: { color: "rgba(255,255,255,0.45)", fontSize: 11, textAlign: "center", letterSpacing: 1.5 },
  awardTopAccent: { height: 4, backgroundColor: COLORS.gold, opacity: 0.85 },
  starsRow: { flexDirection: "row", justifyContent: "center", paddingTop: 20, gap: 8 },
  starChar: { fontSize: 20, color: COLORS.gold },
  awardCertLabel: { textAlign: "center", fontSize: 10, fontWeight: "700", color: COLORS.tertiary, letterSpacing: 4, marginTop: 8, marginBottom: 14 },
  awardNameRow: { flexDirection: "row", alignItems: "center", marginHorizontal: 24, gap: 12 },
  awardNameLine: { flex: 1, height: 1, backgroundColor: COLORS.gold, opacity: 0.4 },
  awardMentorName: { textAlign: "center", fontSize: 26, fontWeight: "900", color: COLORS.primary, letterSpacing: 0.5, flexShrink: 1 },
  awardPeriod: { textAlign: "center", fontSize: 13, color: COLORS.grayMuted, marginTop: 6, letterSpacing: 2, marginBottom: 18, fontStyle: "italic" as const },
  awardDividerWrapper: { marginHorizontal: 40, gap: 3, marginBottom: 4 },
  awardDivider: { height: 2, backgroundColor: COLORS.gold, opacity: 0.6 },
  awardDividerThin: { height: 1, backgroundColor: COLORS.gold, opacity: 0.25 },
  awardStatsRow: { flexDirection: "row", justifyContent: "space-around", alignItems: "center", paddingVertical: 20, paddingHorizontal: 16 },
  awardStatItem: { alignItems: "center", flex: 1 },
  awardStatValue: { fontSize: 28, fontWeight: "800", color: COLORS.primary },
  awardStatLabel: { fontSize: 10, color: COLORS.tertiary, marginTop: 4, textAlign: "center", letterSpacing: 0.5, fontWeight: "600" as const },
  awardStatDivider: { width: 1, height: 40, backgroundColor: COLORS.divider },
  awardFooterWrapper: { alignItems: "center", paddingHorizontal: 24, paddingBottom: 18, gap: 5 },
  awardFooterLine: { width: 64, height: 2, backgroundColor: COLORS.gold, opacity: 0.35, marginBottom: 5 },
  awardFooter: { textAlign: "center", fontSize: 11, color: COLORS.tertiary, letterSpacing: 1.2, fontStyle: "italic" as const },
  awardFooterOrg: { textAlign: "center", fontSize: 10, color: COLORS.grayBorder, letterSpacing: 0.8, fontWeight: "600" as const },

  // Downloads
  downloadRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  dlBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: RADIUS.sm, gap: 6 },
  dlBtnPDF: { backgroundColor: COLORS.gold },
  dlBtnPDFText: { color: "#0E0E14", fontWeight: "700", fontSize: 14 },
  dlBtnPNG: { backgroundColor: "#10B981" },
  dlBtnPNGText: { color: "#0E0E14", fontWeight: "700", fontSize: 14 },

  // E-Mail
  emailRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  emailInput: { flex: 1, fontSize: 14 },
  sendBtn: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.sm,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 12, gap: 8,
  },
  sendBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, maxHeight: "70%", paddingBottom: 32 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1, borderBottomColor: "rgba(128,128,128,0.2)" },
  modalTitle: { fontSize: 16, fontWeight: "700" },
  mentorRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1 },
  mentorRowName: { fontSize: 15 },
});
