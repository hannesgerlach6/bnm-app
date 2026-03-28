import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Platform, Share, useWindowDimensions, Modal, TextInput } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { showError, showSuccess } from "../../lib/errorHandler";
import type { Mentorship, Feedback } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { navigateToChat } from "../../lib/chatNavigation";
import { SlideOverPanel } from "../../components/SlideOverPanel";
import { MentorDetailPanel } from "../../components/MentorDetailPanel";
import { MenteeDetailPanel } from "../../components/MenteeDetailPanel";
import { getLevelForXP, getNextLevel, getLevelProgress, ACHIEVEMENTS } from "../../lib/gamification";

export default function DashboardScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "admin") return <Container fullWidth={Platform.OS === "web"}><AdminDashboard showSystemSettings /></Container>;
  if (user.role === "office") return <Container fullWidth={Platform.OS === "web"}><AdminDashboard showSystemSettings={false} /></Container>;
  if (user.role === "mentor") return <Container fullWidth={Platform.OS === "web"}><MentorDashboard /></Container>;
  return <Container fullWidth={Platform.OS === "web"}><MenteeDashboard /></Container>;
}

function AdminDashboard({ showSystemSettings = true }: { showSystemSettings?: boolean }) {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const {
    users,
    mentorships,
    sessions,
    feedback,
    hadithe,
    mentorOfMonthVisible,
    getUnassignedMentees,
    getPendingApprovalsCount,
    sendAdminDirectMessage,
    adminMessages,
    refreshData,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [activePeriod, setActivePeriod] = useState<"thisMonth" | "lastMonth" | "thisQuarter" | "thisYear">("thisMonth");
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [sendingReminderFor, setSendingReminderFor] = useState<string | null>(null);

  // Prüft ob für eine Mentorship bereits ein Reminder gesendet wurde (via adminMessages in DB)
  const hasSentReminder = useCallback((mentorshipId: string) => {
    const mentorship = mentorships.find((m) => m.id === mentorshipId);
    if (!mentorship) return false;
    const menteeName = mentorship.mentee?.name ?? "";
    return adminMessages.some(
      (msg) => msg.user_id === mentorship.mentor_id && msg.content.includes(menteeName)
    );
  }, [mentorships, adminMessages]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const allMentors = users.filter((u) => u.role === "mentor");
  const allMentees = users.filter((u) => u.role === "mentee");

  // Zeitraum-Filter für KPIs
  const periodRange = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    if (activePeriod === "lastMonth") {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    } else if (activePeriod === "thisQuarter") {
      const q = Math.floor(now.getMonth() / 3) * 3;
      start = new Date(now.getFullYear(), q, 1);
    } else if (activePeriod === "thisYear") {
      start = new Date(now.getFullYear(), 0, 1);
    } else {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    return { start, end };
  }, [activePeriod]);

  const inPeriod = (dateStr?: string) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    return d >= periodRange.start && d <= periodRange.end;
  };

  const activeMentorships = mentorships.filter((m) => m.status === "active");
  const completedMentorships = mentorships.filter(
    (m) => m.status === "completed" && inPeriod(m.completed_at ?? m.assigned_at)
  );
  const newMentorshipsInPeriod = mentorships.filter((m) => inPeriod(m.assigned_at));
  const unassignedMentees = getUnassignedMentees();
  const pendingApprovalsCount = getPendingApprovalsCount();

  // Aktivitäten: Sessions sortiert nach Datum absteigend (5 oder alle)
  const allSortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sessions]);
  const recentSessions = useMemo(() => {
    return showAllActivities ? allSortedSessions : allSortedSessions.slice(0, 5);
  }, [allSortedSessions, showAllActivities]);

  // Frühwarnungen berechnen
  const earlyWarnings = useMemo(() => {
    const warnings: { type: "feedback" | "discrepancy" | "inactive"; label: string; mentorshipId?: string; date?: Date }[] = [];

    // Negatives Feedback (Rating ≤ 2)
    for (const f of feedback) {
      if (f.rating <= 2) {
        const ms = mentorships.find((m) => m.id === f.mentorship_id);
        warnings.push({
          type: "feedback",
          label: ms ? `${ms.mentee?.name ?? "?"} → ${ms.mentor?.name ?? "?"}` : f.mentorship_id,
          mentorshipId: f.mentorship_id,
          date: new Date(f.created_at),
        });
      }
    }

    // Diskrepanzen: Mentee bestätigt, Mentor nicht dokumentiert
    for (const m of mentorships) {
      if (m.status !== "active") continue;
      const confirmed = m.mentee_confirmed_steps ?? [];
      const documented = sessions.filter((s) => s.mentorship_id === m.id).map((s) => s.session_type_id);
      const hasDiscrepancy = confirmed.some((stepId) => !documented.includes(stepId));
      if (hasDiscrepancy) {
        warnings.push({
          type: "discrepancy",
          label: `${m.mentee?.name ?? "?"} → ${m.mentor?.name ?? "?"}`,
          mentorshipId: m.id,
        });
      }
    }

    // Inaktive Mentoren: >7 Tage keine Session bei aktiver Betreuung
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    for (const m of mentorships) {
      if (m.status !== "active") continue;
      const mentorSessions = sessions.filter((s) => s.mentorship_id === m.id);
      let isInactive = false;
      let lastDate: Date | undefined;
      if (mentorSessions.length === 0) {
        isInactive = now - new Date(m.assigned_at).getTime() > sevenDays;
        lastDate = new Date(m.assigned_at);
      } else {
        const last = [...mentorSessions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
        isInactive = now - new Date(last.date).getTime() > sevenDays;
        lastDate = new Date(last.date);
      }
      if (isInactive) {
        warnings.push({
          type: "inactive",
          label: `${m.mentor?.name ?? "?"} → ${m.mentee?.name ?? "?"}`,
          mentorshipId: m.id,
          date: lastDate,
        });
      }
    }

    return warnings;
  }, [feedback, mentorships, sessions]);

  // Stagnante Betreuungen: >5 Tage keine Session (separater Block für Admin-Aktionen)
  const stagnantMentorships = useMemo(() => {
    const now = Date.now();
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    return mentorships
      .filter((m) => m.status === "active")
      .map((m) => {
        const ms = sessions.filter((s) => s.mentorship_id === m.id);
        const lastTime = ms.length > 0
          ? Math.max(...ms.map((s) => new Date(s.date).getTime()))
          : new Date(m.assigned_at).getTime();
        const daysSince = Math.floor((now - lastTime) / 86400000);
        return { mentorship: m, daysSince, lastDate: new Date(lastTime) };
      })
      .filter((x) => x.daysSince >= 5)
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [mentorships, sessions]);

  async function handleSendReminder(mentorshipId: string, mentorName: string, menteeName: string) {
    const mentorship = mentorships.find((m) => m.id === mentorshipId);
    const mentorId = mentorship?.mentor_id;
    if (!mentorId) return;
    setSendingReminderFor(mentorshipId);
    try {
      const msg = t("adminReminder.reminderBody").replace("{0}", menteeName);
      await sendAdminDirectMessage(mentorId, msg);
      showSuccess(t("adminReminder.sent").replace("{0}", mentorName));
      await refreshData();
    } catch {
      showError(t("common.error"));
    } finally {
      setSendingReminderFor(null);
    }
  }

  // Mentor des Monats — NUR aus dem vorherigen Monat berechnen
  const topMentorPrevMonth = useMemo(() => {
    const now = new Date();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const inPrevMonth = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear;
    };
    const mentors = users.filter((u) => u.role === "mentor");
    if (mentors.length === 0) return null;
    const scored = mentors.map((mentor) => {
      const myMs = mentorships.filter((m) => m.mentor_id === mentor.id);
      const completedCount = myMs.filter(
        (m) => m.status === "completed" && inPrevMonth(m.completed_at ?? m.assigned_at)
      ).length;
      const sessionCount = sessions.filter(
        (s) => myMs.some((m) => m.id === s.mentorship_id) && inPrevMonth(s.date)
      ).length;
      const score = completedCount * 10 + sessionCount * 3;
      return { mentor, score, completedCount, sessionCount, prevMonth, prevMonthYear };
    }).sort((a, b) => b.score - a.score);
    return scored[0].score > 0 ? scored[0] : null;
  }, [users, mentorships, sessions]);
  const topMentor = topMentorPrevMonth;

  // Aktueller Führender im laufenden Monat (Anwärter)
  const currentMonthLeader = useMemo(() => {
    const now = new Date();
    const curMonth = now.getMonth();
    const curYear = now.getFullYear();
    const inCurMonth = (dateStr?: string) => {
      if (!dateStr) return false;
      const d = new Date(dateStr);
      return d.getMonth() === curMonth && d.getFullYear() === curYear;
    };
    const mentors = users.filter((u) => u.role === "mentor");
    if (mentors.length === 0) return null;
    const scored = mentors.map((mentor) => {
      const myMs = mentorships.filter((m) => m.mentor_id === mentor.id);
      const completedCount = myMs.filter(
        (m) => m.status === "completed" && inCurMonth(m.completed_at ?? m.assigned_at)
      ).length;
      const sessionCount = sessions.filter(
        (s) => myMs.some((m) => m.id === s.mentorship_id) && inCurMonth(s.date)
      ).length;
      const score = completedCount * 10 + sessionCount * 3;
      return { mentor, score, completedCount, sessionCount };
    }).sort((a, b) => b.score - a.score);
    return scored[0].score > 0 ? scored[0] : null;
  }, [users, mentorships, sessions]);

  return (
    <>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <View style={styles.adminHeader}>
          <View style={styles.adminHeaderLeft}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("dashboard.admin")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("dashboard.subtitle")}</Text>
          </View>
          <TouchableOpacity
            style={[styles.refreshButton, { backgroundColor: "transparent", borderColor: isDark ? "#FFCA28" : themeColors.border }]}
            onPress={() => refreshData(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="reload-outline" size={16} color={isDark ? "#FFCA28" : themeColors.textSecondary} />
            <Text style={[styles.refreshButtonText, { color: isDark ? "#FFCA28" : themeColors.textSecondary }]}>{t("dashboard.refresh")}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Zeitraum-Bar ────────────────────────────────────────────────── */}
        <View style={[styles.periodBar, { backgroundColor: themeColors.card, borderColor: isDark ? "#3A3520" : themeColors.border }]}>
          <View style={styles.periodBarLeft}>
            <Ionicons name="calendar-outline" size={15} color={isDark ? "#FFCA28" : themeColors.textSecondary} />
            <Text style={[styles.periodBarLabel, { color: isDark ? "#FFCA28" : themeColors.textSecondary }]}>{t("dashboard.periodBar")}</Text>
          </View>
          <View style={styles.periodBarButtons}>
            {(["thisMonth", "lastMonth", "thisQuarter", "thisYear"] as const).map((p) => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.periodBtn,
                  activePeriod === p
                    ? { backgroundColor: isDark ? "#FFCA28" : COLORS.gold, borderColor: isDark ? "#FFCA28" : COLORS.gold }
                    : { backgroundColor: "transparent", borderColor: isDark ? "#3A3520" : themeColors.border },
                ]}
                onPress={() => setActivePeriod(p)}
              >
                <Text style={[
                  styles.periodBtnText,
                  { color: activePeriod === p ? "#0E0E14" : themeColors.textSecondary },
                ]}>
                  {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}` as any)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── ÜBERSICHT + VERWALTUNG + TOOLS (linear) ────────────────── */}
        <>
            {/* KPI Karten – responsiv: 4 pro Reihe auf Desktop, 2 auf Mobile */}
            <KpiGrid style={{ marginBottom: 16 }}>
              <StatCard
                label={t("dashboard.activeMentorships")}
                value={activeMentorships.length}
                color={COLORS.gradientStart}
                iconName="people-outline"
              />
              <StatCard
                label={t("dashboard.completed")}
                value={completedMentorships.length}
                color={COLORS.cta}
                iconName="checkmark-circle-outline"
              />
              <StatCard
                label={t("dashboard.mentors")}
                value={allMentors.length}
                color={COLORS.gold}
                iconName="person-outline"
              />
              <StatCard
                label={t("dashboard.totalMentees")}
                value={allMentees.length}
                color="#6366f1"
                iconName="school-outline"
              />
            </KpiGrid>

            {/* ── Neue Mentees warten auf Zuweisung (wichtigste Admin-Aktion) ── */}
            {unassignedMentees.length > 0 && (
              <View style={[styles.amberBox, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}>
                <Text style={[styles.amberTitle, { color: isDark ? "#fbbf24" : "#92400e" }]}>
                  {t("dashboard.newMenteesWaiting").replace("{0}", String(unassignedMentees.length))}
                </Text>
                {unassignedMentees.map((mentee) => (
                  <View key={mentee.id} style={[styles.amberRow, { borderBottomColor: isDark ? "#6b4e1a" : "#fef3c7" }]}>
                    <View>
                      <Text style={[styles.menteeNameText, { color: themeColors.text }]}>{mentee.name}</Text>
                      <Text style={[styles.menteeSubText, { color: themeColors.textTertiary }]}>
                        {mentee.city} · {mentee.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.assignButton}
                      onPress={() =>
                        router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                      }
                    >
                      <Text style={styles.assignButtonText}>{t("dashboard.assign")}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* Mentor des Monats (Admin-Sicht) */}
            {mentorOfMonthVisible && !topMentor && (
              <View style={[styles.momAdminCard, { opacity: 0.85 }]}>
                <View style={styles.momAdminHeader}>
                  <Text style={styles.momAdminStar}>★</Text>
                  <Text style={[styles.momAdminTitle, { color: themeColors.textSecondary }]}>{t("dashboard.currentMentorOfMonth")}</Text>
                </View>
                {currentMonthLeader ? (
                  <>
                    <Text style={[styles.momAdminName, { color: themeColors.text }]}>
                      {t("dashboard.currentCandidate").replace("{0}", currentMonthLeader.mentor.name ?? "")}
                    </Text>
                    <Text style={[styles.momAdminSub, { color: themeColors.textSecondary, fontSize: 11, marginTop: 2 }]}>
                      {t("dashboard.candidateNote")}
                    </Text>
                  </>
                ) : (
                  <Text style={[styles.momAdminName, { color: themeColors.textSecondary, fontSize: 15 }]}>
                    {t("dashboard.noSessionsThisMonth")}
                  </Text>
                )}
              </View>
            )}
            {mentorOfMonthVisible && topMentor && (
              <TouchableOpacity
                style={styles.momAdminCard}
                onPress={() => {
                  if (Platform.OS === "web") {
                    setSelectedMentorId(topMentor.mentor.id);
                  } else {
                    router.push({ pathname: "/mentor/[id]", params: { id: topMentor.mentor.id } });
                  }
                }}
              >
                <View style={styles.momAdminHeader}>
                  <Text style={styles.momAdminStar}>★</Text>
                  <Text style={[styles.momAdminTitle, { color: themeColors.textSecondary }]}>
                    {`${t("dashboard.currentMentorOfMonth")}: ${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][topMentor.prevMonth]} ${topMentor.prevMonthYear}`}
                  </Text>
                </View>
                <Text style={[styles.momAdminName, { color: themeColors.text }]}>{topMentor.mentor.name}</Text>
                <View style={styles.momAdminStatsRow}>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}>
                    <Text style={styles.momAdminStatValue}>{topMentor.score}</Text>
                    <Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.points")}</Text>
                  </View>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}>
                    <Text style={styles.momAdminStatValue}>{topMentor.completedCount}</Text>
                    <Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.completions")}</Text>
                  </View>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}>
                    <Text style={styles.momAdminStatValue}>{topMentor.sessionCount}</Text>
                    <Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.sessions")}</Text>
                  </View>
                </View>
                <Text style={styles.momAdminArrow}>{t("dashboard.viewProfile")} ›</Text>
                <TouchableOpacity
                  style={[styles.momAwardButton, { marginTop: 10 }]}
                  onPress={(e) => {
                    e.stopPropagation && e.stopPropagation();
                    router.push({ pathname: "/admin/mentor-award" as any, params: { mentorId: topMentor.mentor.id } });
                  }}
                  activeOpacity={0.8}
                >
                  <Text style={styles.momAwardButtonText}>{t("dashboard.createAward")} ›</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            )}


            {/* Frühwarnungen */}
            {earlyWarnings.length > 0 && (
              <View style={[styles.warningBox, { backgroundColor: isDark ? "#3a1a1a" : "#fff1f2", borderColor: isDark ? "#7a2a2a" : "#fecdd3", borderLeftColor: isDark ? "#f87171" : "#ef4444" }]}>
                <View style={styles.warningHeader}>
                  <Text style={[styles.warningTitle, { color: isDark ? "#f87171" : "#991b1b" }]}>{t("earlyWarning.title")}</Text>
                  <View style={styles.warningBadge}>
                    <Text style={styles.warningBadgeText}>{earlyWarnings.length}</Text>
                  </View>
                </View>
                {earlyWarnings.slice(0, 5).map((w, idx) => {
                  const daysDiff = w.date ? Math.floor((Date.now() - w.date.getTime()) / 86400000) : undefined;
                  const typeLabel = w.type === "feedback"
                    ? t("earlyWarning.negativeFeedback")
                    : w.type === "discrepancy"
                    ? t("earlyWarning.discrepancy")
                    : t("earlyWarning.inactive");
                  return (
                    <TouchableOpacity
                      key={idx}
                      style={[styles.warningRow, idx < Math.min(earlyWarnings.length, 5) - 1 && [styles.warningRowBorder, { borderBottomColor: isDark ? "#7a2a2a" : "#fecdd3" }]]}
                      onPress={() => {
                        if (w.mentorshipId) {
                          router.push({ pathname: "/mentorship/[id]", params: { id: w.mentorshipId } });
                        }
                      }}
                    >
                      <View style={[styles.warningDot, { backgroundColor: isDark ? "#f87171" : "#ef4444" }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.warningLabel, { color: isDark ? "#f87171" : "#ef4444" }]}>{typeLabel}</Text>
                        <Text style={[styles.warningName, { color: isDark ? "#fca5a5" : "#7f1d1d" }]}>{w.label}</Text>
                      </View>
                      {daysDiff !== undefined && (
                        <Text style={[styles.warningDays, { color: isDark ? "#f87171" : "#b91c1c" }]}>
                          {t("earlyWarning.daysAgo").replace("{0}", String(daysDiff))}
                        </Text>
                      )}
                      <Text style={[styles.warningArrow, { color: isDark ? "#f87171" : "#b91c1c" }]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Stagnante Betreuungen (>5 Tage keine Session) */}
            {stagnantMentorships.length > 0 && (
              <View style={[styles.stagnantBox, { backgroundColor: isDark ? "#1a2a3a" : "#eff6ff", borderColor: isDark ? "#1e3a5f" : "#bfdbfe" }]}>
                <View style={[styles.warningHeader, { marginBottom: 8 }]}>
                  <Text style={[styles.warningTitle, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>
                    {t("adminReminder.title")} ({stagnantMentorships.length})
                  </Text>
                </View>
                {stagnantMentorships.map((item, idx) => {
                  const mentorName = item.mentorship.mentor?.name ?? "?";
                  const menteeName = item.mentorship.mentee?.name ?? "?";
                  const isSending = sendingReminderFor === item.mentorship.id;
                  const isSent = hasSentReminder(item.mentorship.id);
                  const isLast = idx === stagnantMentorships.length - 1;
                  return (
                    <View
                      key={item.mentorship.id}
                      style={[
                        styles.stagnantRow,
                        !isLast && [styles.stagnantRowBorder, { borderBottomColor: isDark ? "#1e3a5f" : "#bfdbfe" }],
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.stagnantMentorName, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>
                          {mentorName}
                        </Text>
                        <Text style={[styles.stagnantSub, { color: isDark ? "#60a5fa" : "#3b82f6" }]}>
                          → {menteeName} · {t("earlyWarning.daysAgo").replace("{0}", String(item.daysSince))}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.reminderBtn,
                          (isSending || isSent) ? { opacity: 0.5, backgroundColor: "#6B7280" } : {},
                        ]}
                        onPress={() => !isSent && handleSendReminder(item.mentorship.id, mentorName, menteeName)}
                        disabled={isSending || isSent}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.reminderBtnText}>
                          {isSending ? "..." : isSent ? t("adminReminder.sentConfirm") : t("adminReminder.sendButton")}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Ausstehende Mentor-Zuweisungen (pending_approval) */}
            {pendingApprovalsCount > 0 && (
              <TouchableOpacity
                style={[styles.pendingApprovalsButton, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}
                onPress={() => router.push("/admin/pending-approvals")}
              >
                <View style={styles.applicationsButtonContent}>
                  <Text style={[styles.pendingApprovalsText, { color: isDark ? "#fbbf24" : "#78350f" }]}>{t("dashboard.pendingApprovals")}</Text>
                  <Text style={[styles.pendingApprovalsSub, { color: isDark ? "#fbbf24" : "#92400e" }]}>
                    {t("dashboard.pendingApprovalsCount")
                      .replace("{0}", String(pendingApprovalsCount))
                      .replace("{1}", pendingApprovalsCount === 1 ? "" : "en")}
                  </Text>
                </View>
                <View style={styles.applicationsBadge}>
                  <Text style={styles.applicationsBadgeText}>{pendingApprovalsCount}</Text>
                </View>
                <Text style={[styles.applicationsArrow, { color: isDark ? "#fbbf24" : "#78350f" }]}>›</Text>
              </TouchableOpacity>
            )}

            {/* Letzte Aktivitäten */}
            <View style={[styles.card, { backgroundColor: themeColors.card }]}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                <Text style={[styles.cardTitle, { color: themeColors.text }]}>{t("dashboard.recentActivity")}</Text>
                {allSortedSessions.length > 5 && (
                  <TouchableOpacity onPress={() => setShowAllActivities((v) => !v)} activeOpacity={0.7}>
                    <Text style={{ color: isDark ? "#FFCA28" : COLORS.gold, fontSize: 13, fontWeight: "600" }}>
                      {showAllActivities ? t("dashboard.showLessActivities") : t("dashboard.showAllActivities").replace("{0}", String(allSortedSessions.length))}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
              <Text style={[styles.tertiaryXs, { color: themeColors.textTertiary, marginBottom: 8 }]}>{t("dashboard.recentActivitySub")}</Text>
              {recentSessions.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("dashboard.noRecentActivity")}</Text>
              ) : (
                recentSessions.map((s, idx) => {
                  const mentorship = mentorships.find((m) => m.id === s.mentorship_id);
                  const stepName = s.session_type?.name ?? `${t("dashboard.activityStep")} ${idx + 1}`;
                  const mentorName = mentorship?.mentor?.name ?? "–";
                  const menteeName = mentorship?.mentee?.name ?? "–";
                  const isLast = idx === recentSessions.length - 1;
                  return (
                    <View key={s.id} style={[styles.activityRow, isLast ? {} : [styles.activityRowBorder, { borderBottomColor: themeColors.border }]]}>
                      <View style={styles.activityDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.activityTitle, { color: themeColors.text }]}>{stepName}</Text>
                        <Text style={[styles.activitySub, { color: themeColors.textTertiary }]}>
                          {menteeName} · {t("dashboard.activityBy")} {mentorName}
                        </Text>
                      </View>
                      <Text style={[styles.activityDate, { color: themeColors.textTertiary }]}>
                        {new Date(s.date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </Text>
                    </View>
                  );
                })
              )}
            </View>

            {/* Balkendiagramm: Neue Betreuungen pro Monat */}
            <MonthlyChart mentorships={mentorships} />

        </>

      </View>
    </ScrollView>

    <SlideOverPanel
      visible={!!selectedMentorId}
      onClose={() => setSelectedMentorId(null)}
    >
      <MentorDetailPanel id={selectedMentorId} />
    </SlideOverPanel>

    <SlideOverPanel
      visible={!!selectedMenteeId}
      onClose={() => setSelectedMenteeId(null)}
    >
      <MenteeDetailPanel id={selectedMenteeId} />
    </SlideOverPanel>
    </>
  );
}


function MentorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipsByMentorId, sessions, users, hadithe, feedback, refreshData, xpLog, userAchievements, thanks, streak, sessionTypes } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [hadithOffset, setHadithOffset] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const myMentorships = user ? getMentorshipsByMentorId(user.id) : [];
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");

  // Mentor-Statistiken
  const mentorStats = useMemo(() => {
    if (!user) return null;
    const totalSessions = sessions.filter((s) =>
      myMentorships.some((m) => m.id === s.mentorship_id)
    ).length;
    const allMentors = users.filter((u) => u.role === "mentor");
    const scores = allMentors.map((mentor) => {
      const ms = getMentorshipsByMentorId(mentor.id);
      const completed = ms.filter((m) => m.status === "completed").length;
      const sessionsCnt = sessions.filter((s) =>
        ms.some((m) => m.id === s.mentorship_id)
      ).length;
      return { mentorId: mentor.id, score: completed * 10 + sessionsCnt * 3 };
    });
    scores.sort((a, b) => b.score - a.score);
    const myRank = scores.findIndex((s) => s.mentorId === user.id) + 1;
    const myScore = scores.find((s) => s.mentorId === user.id)?.score ?? 0;
    const maxScore = scores[0]?.score ?? 1;
    return {
      active: activeMentorships.length,
      completed: completedMentorships.length,
      totalSessions,
      rank: myRank,
      totalMentors: allMentors.length,
      myScore,
      maxScore,
    };
  }, [user, myMentorships, activeMentorships.length, completedMentorships.length, sessions, users, getMentorshipsByMentorId]);

  // Meine Feedback-Bewertungen (nur Feedbacks zu Mentorships wo ich Mentor bin)
  const myFeedbacks = useMemo(() => {
    if (!user) return [];
    const myMentorshipIds = new Set(myMentorships.map((m) => m.id));
    return [...feedback]
      .filter((f) => myMentorshipIds.has(f.mentorship_id))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [user, myMentorships, feedback]);

  const avgRating = useMemo(() => {
    if (myFeedbacks.length === 0) return null;
    const sum = myFeedbacks.reduce((acc, f) => acc + f.rating, 0);
    return Math.round((sum / myFeedbacks.length) * 10) / 10;
  }, [myFeedbacks]);

  // Vernachlässigte Mentees (>5 Tage keine Session)
  const neglectedMentees = useMemo(() => {
    const now = Date.now();
    return activeMentorships
      .map((m) => {
        const ms = sessions.filter((s) => s.mentorship_id === m.id);
        const lastTime = ms.length > 0
          ? Math.max(...ms.map((s) => new Date(s.date).getTime()))
          : new Date(m.assigned_at).getTime();
        const daysSince = Math.floor((now - lastTime) / 86400000);
        return { mentorship: m, daysSince };
      })
      .filter((x) => x.daysSince >= 5)
      .sort((a, b) => b.daysSince - a.daysSince);
  }, [activeMentorships, sessions]);

  // Auto-Show Onboarding — NUR auf Mobile (Native), NICHT auf Web
  useEffect(() => {
    if (!user) return;
    if (Platform.OS === "web") return; // Kein Onboarding auf Web
    if (activeMentorships.length > 0) return;
    const key = `bnm_onboarding_seen_${user.id}`;
    async function checkOnboarding() {
      try {
        // @ts-ignore
        const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
        const seen = (await AsyncStorage.getItem(key)) === "1";
        if (!seen) {
          router.push("/onboarding");
        }
      } catch { /* ignorieren */ }
    }
    checkOnboarding();
  }, [user?.id, activeMentorships.length]);

  if (!user) return null;

  // Hadith für heute
  const todayHadith = useMemo(() => {
    if (hadithe.length === 0) return null;
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const baseIdx = dayOfYear % hadithe.length;
    const idx = (baseIdx + hadithOffset) % hadithe.length;
    return hadithe[idx];
  }, [hadithe, hadithOffset]);

  // XP-basiertes Level-System
  const myXP = (user?.total_xp ?? 0) as number;
  const currentLevel = getLevelForXP(myXP);
  const nextLevel = getNextLevel(myXP);
  const xpProgress = getLevelProgress(myXP);
  const thanksCount = thanks.length;

  // "Deine Wirkung" — abgeschlossene Sessions nach Typ für alle Mentees dieses Mentors
  const impactStats = useMemo(() => {
    if (!user) return { wudu: 0, salah: 0, quran: 0, community: 0, total: 0 };
    const myMentorshipIds = new Set(myMentorships.map((m) => m.id));
    const mentorSessions = sessions.filter((s) => myMentorshipIds.has(s.mentorship_id));

    const wuduTypes = sessionTypes.filter((st) =>
      st.name.toLowerCase().includes("wudu") || st.name.toLowerCase().includes("waschung")
    ).map((st) => st.id);
    const salahTypes = sessionTypes.filter((st) =>
      st.name.toLowerCase().includes("gebet") || st.name.toLowerCase().includes("salah") || st.name.toLowerCase().includes("salat")
    ).map((st) => st.id);
    const quranTypes = sessionTypes.filter((st) =>
      st.name.toLowerCase().includes("koran") || st.name.toLowerCase().includes("quran")
    ).map((st) => st.id);
    const communityTypes = sessionTypes.filter((st) =>
      st.name.toLowerCase().includes("community") || st.name.toLowerCase().includes("gemeinschaft") || st.name.toLowerCase().includes("integration")
    ).map((st) => st.id);

    const countUnique = (typeIds: string[]) => {
      const menteeIds = new Set(
        mentorSessions
          .filter((s) => typeIds.includes(s.session_type_id))
          .map((s) => myMentorships.find((m) => m.id === s.mentorship_id)?.mentee_id)
          .filter(Boolean)
      );
      return menteeIds.size;
    };

    const uniqueMenteeIds = new Set(
      mentorSessions.map((s) => myMentorships.find((m) => m.id === s.mentorship_id)?.mentee_id).filter(Boolean)
    );

    return {
      wudu: countUnique(wuduTypes),
      salah: countUnique(salahTypes),
      quran: countUnique(quranTypes),
      community: completedMentorships.length,
      total: uniqueMenteeIds.size,
    };
  }, [user, myMentorships, sessions, sessionTypes, completedMentorships]);

  const [showAchievementTooltip, setShowAchievementTooltip] = useState<string | null>(null);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* ── Greeting ────────────────────────────────────────────────── */}
        <View style={styles.mentorGreetingRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.mentorGreetingLabel, { color: isDark ? COLORS.gold : COLORS.gradientStart }]}>
              WILLKOMMEN
            </Text>
            <Text style={[styles.mentorGreetingName, { color: themeColors.text }]}>{user.name}</Text>
            <Text style={[styles.mentorGreetingMeta, { color: themeColors.textSecondary }]}>
              {user.city} · {user.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
            </Text>
          </View>
        </View>

        {/* ── 4 KPI-Cards ─────────────────────────────────────────────── */}
        {mentorStats && (
          <>
            <KpiGrid style={{ marginBottom: 12 }}>
              <StatCard label={t("dashboard.statsActive")} value={mentorStats.active} color={COLORS.gradientStart} iconName="people-outline" />
              <StatCard label={t("dashboard.statsCompleted")} value={mentorStats.completed} color={COLORS.cta} iconName="checkmark-circle-outline" />
              <StatCard label={t("dashboard.statsSessions")} value={mentorStats.totalSessions} color={COLORS.gold} iconName="document-text-outline" />
              <StatCard label={t("dashboard.statsRank")} value={mentorStats.rank} color="#6366f1" iconName="trophy-outline" sublabel={`/ ${mentorStats.totalMentors}`} />
            </KpiGrid>

            {/* ── Vernachlässigte Mentees (>5 Tage keine Session) ─────── */}
            {neglectedMentees.length > 0 && (
              <View style={{ marginBottom: 12 }}>
                <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary }]}>
                  {t("mentor.neglectedSection")}
                </Text>
                {neglectedMentees.map((item) => {
                  const menteeName = item.mentorship.mentee?.name ?? "?";
                  const isUrgent = item.daysSince > 10;
                  const bgColor = isUrgent
                    ? (isDark ? "#3a1a1a" : "#fff1f2")
                    : (isDark ? "#3a2e0a" : "#fffbeb");
                  const borderColor = isUrgent
                    ? (isDark ? "#7a2a2a" : "#fecdd3")
                    : (isDark ? "#6b4e1a" : "#fde68a");
                  const borderLeftColor = isUrgent
                    ? (isDark ? "#f87171" : "#ef4444")
                    : (isDark ? "#fbbf24" : "#f59e0b");
                  const textColor = isUrgent
                    ? (isDark ? "#f87171" : "#991b1b")
                    : (isDark ? "#fbbf24" : "#92400e");
                  const message = isUrgent
                    ? t("mentor.neglectedUrgent").replace("{0}", menteeName).replace("{1}", String(item.daysSince))
                    : t("mentor.neglectedWarning").replace("{0}", menteeName).replace("{1}", String(item.daysSince));
                  return (
                    <TouchableOpacity
                      key={item.mentorship.id}
                      style={[
                        styles.neglectedRow,
                        { backgroundColor: bgColor, borderColor, borderLeftColor },
                      ]}
                      onPress={() => router.push({ pathname: "/mentorship/[id]", params: { id: item.mentorship.id } })}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={isUrgent ? "warning-outline" : "time-outline"}
                        size={18}
                        color={borderLeftColor}
                        style={{ marginRight: 10 }}
                      />
                      <Text style={[styles.neglectedText, { color: textColor, flex: 1 }]}>{message}</Text>
                      <Text style={[styles.neglectedArrow, { color: textColor }]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* ── Gamification Widget ──────────────────────────────────── */}
            <View style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#3A3520" : themeColors.border }]}>
              {/* Level-Badge + XP-Zähler */}
              <View style={styles.levelHeaderRow}>
                <View style={styles.levelBadgeRow}>
                  <View style={[styles.levelBadge, { backgroundColor: currentLevel.color + "22", borderColor: currentLevel.color }]}>
                    <Text style={[styles.levelBadgeText, { color: currentLevel.color }]}>
                      {t(`level.${currentLevel.key}` as any)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.levelScoreBadge, { backgroundColor: isDark ? "#2A2518" : "#FFF8E1" }]}>
                  <Text style={[styles.levelScoreText, { color: COLORS.gold }]}>{myXP} {t("gamification.xpLabel")}</Text>
                </View>
              </View>

              {/* Fortschrittsbalken */}
              <View style={[styles.levelTrack, { backgroundColor: isDark ? "#2A2520" : themeColors.border, marginTop: 10 }]}>
                <View style={[styles.levelFill, { width: `${xpProgress}%` as any, backgroundColor: currentLevel.color }]} />
              </View>

              {/* Nächstes Level Hint */}
              <Text style={[styles.levelHint, { color: themeColors.textTertiary, marginTop: 4 }]}>
                {nextLevel
                  ? t("gamification.nextLevel")
                      .replace("{0}", String(nextLevel.minXP - myXP))
                      .replace("{1}", t(`level.${nextLevel.key}` as any))
                  : t("gamification.maxLevel")}
              </Text>

              {/* Streak + Danke-Zähler */}
              <View style={styles.streakThanksRow}>
                <View style={styles.streakPill}>
                  <Text style={styles.streakEmoji}>🔥</Text>
                  <Text style={[styles.streakText, { color: themeColors.textSecondary }]}>
                    {streak && streak.current_streak > 0
                      ? t("gamification.streakLabel").replace("{0}", String(streak.current_streak))
                      : t("gamification.streakNone")}
                  </Text>
                </View>
                <View style={styles.streakPill}>
                  <Text style={styles.streakEmoji}>♥</Text>
                  <Text style={[styles.streakText, { color: themeColors.textSecondary }]}>
                    {t("gamification.thanksCount").replace("{0}", String(thanksCount))}
                  </Text>
                </View>
              </View>
            </View>

            {/* ── Achievements ────────────────────────────────────────────── */}
            <View style={{ marginBottom: 12 }}>
              <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 8 }]}>
                {t("gamification.achievementsTitle")}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -4 }}>
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = userAchievements.some((a) => a.achievement_key === ach.key);
                  return (
                    <TouchableOpacity
                      key={ach.key}
                      style={[
                        styles.achievementChip,
                        {
                          backgroundColor: isUnlocked
                            ? (isDark ? "#2A2518" : "#FFF8E1")
                            : (isDark ? "#1A1A24" : themeColors.border + "66"),
                          borderColor: isUnlocked ? COLORS.gold : (isDark ? "#3A3520" : themeColors.border),
                          opacity: isUnlocked ? 1 : 0.5,
                        },
                      ]}
                      onPress={() => setShowAchievementTooltip(showAchievementTooltip === ach.key ? null : ach.key)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.achievementIcon}>{ach.icon}</Text>
                      {showAchievementTooltip === ach.key && (
                        <View style={[styles.achievementTooltip, { backgroundColor: isDark ? "#2A2518" : "#FFF8E1", borderColor: COLORS.gold }]}>
                          <Text style={[styles.achievementTooltipTitle, { color: themeColors.text }]}>{ach.label}</Text>
                          <Text style={[styles.achievementTooltipDesc, { color: themeColors.textSecondary }]}>{ach.desc}</Text>
                          {!isUnlocked && (
                            <Text style={[styles.achievementTooltipLocked, { color: themeColors.textTertiary }]}>
                              {t("gamification.achievementLocked")}
                            </Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* ── Deine Wirkung ────────────────────────────────────────────── */}
            {impactStats.total > 0 && (
              <View style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#3A3520" : themeColors.border, marginBottom: 12 }]}>
                <Text style={[styles.levelTitle, { color: themeColors.text, marginBottom: 8 }]}>
                  {t("gamification.impactTitle").replace("{0}", String(impactStats.total))}
                </Text>
                {[
                  { label: t("gamification.impactWudu"), count: impactStats.wudu },
                  { label: t("gamification.impactSalah"), count: impactStats.salah },
                  { label: t("gamification.impactQuran"), count: impactStats.quran },
                  { label: t("gamification.impactCommunity"), count: impactStats.community },
                ]
                  .filter((item) => item.count > 0)
                  .map((item) => (
                    <View key={item.label} style={styles.impactRow}>
                      <Text style={[styles.impactLabel, { color: themeColors.textSecondary }]}>{item.label}</Text>
                      <Text style={[styles.impactCount, { color: COLORS.gold }]}>
                        {t("gamification.impactMentees").replace("{0}", String(item.count))}
                      </Text>
                    </View>
                  ))}
              </View>
            )}
          </>
        )}

        {/* ── Meine Bewertungen ────────────────────────────────────────── */}
        <MentorRatingsSection
          feedbacks={myFeedbacks}
          avgRating={avgRating}
          myMentorships={myMentorships}
          router={router}
          t={t}
          themeColors={themeColors}
          isDark={isDark}
        />

        {/* ── Motivations-Hadith ───────────────────────────────────────── */}
        {todayHadith && (
          <View style={[styles.mentorHadithCard, { borderColor: isDark ? "#3A3520" : "rgba(238,167,27,0.3)" }]}>
            <View style={styles.hadithCardHeader}>
              <Text style={styles.hadithStar}>★</Text>
              <Text style={[styles.hadithCardLabel, { color: themeColors.text }]}>{t("motivation.title")}</Text>
            </View>
            {todayHadith.text_ar ? (
              <Text style={[styles.mentorHadithArabic, { color: themeColors.text }]}>{todayHadith.text_ar}</Text>
            ) : null}
            <Text style={[styles.hadithCardText, { color: themeColors.textSecondary }]}>"{todayHadith.text_de}"</Text>
            {todayHadith.source ? (
              <Text style={[styles.hadithCardQuelle, { color: themeColors.textTertiary }]}>{t("motivation.source")}: {todayHadith.source}</Text>
            ) : null}
            <View style={styles.motivationActionsRow}>
              <TouchableOpacity
                style={styles.motivationNextBtn}
                onPress={() => setHadithOffset((prev) => prev + 1)}
              >
                <Text style={styles.motivationNextText}>{t("motivation.next")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.motivationShareBtn}
                onPress={() => {
                  const shareText = todayHadith.text_ar
                    ? `${todayHadith.text_ar}\n\n${todayHadith.text_de}`
                    : todayHadith.text_de;
                  shareHadith(shareText, t("share.suffix"));
                }}
              >
                <Ionicons name="share-outline" size={18} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          </View>
        )}


      </View>
    </ScrollView>
  );
}

function MentorRatingsSection({
  feedbacks,
  avgRating,
  myMentorships,
  router,
  t,
  themeColors,
  isDark,
}: {
  feedbacks: Feedback[];
  avgRating: number | null;
  myMentorships: Mentorship[];
  router: ReturnType<typeof useRouter>;
  t: (key: any) => string;
  themeColors: ReturnType<typeof useThemeColors>;
  isDark: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const displayed = showAll ? feedbacks : feedbacks.slice(0, 3);

  return (
    <View style={[styles.ratingsCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#3A3520" : themeColors.border }]}>
      {/* Header */}
      <View style={styles.ratingsSectionHeader}>
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 0 }]}>{t("mentor.myRatings")}</Text>
        {avgRating !== null && (
          <View style={[styles.avgRatingBadge, { backgroundColor: isDark ? "#2A2518" : "#FFF8E1" }]}>
            <Text style={[styles.avgRatingValue, { color: COLORS.gold }]}>{avgRating.toFixed(1)} ★</Text>
          </View>
        )}
      </View>

      {/* Durchschnitt + Anzahl */}
      {avgRating !== null ? (
        <Text style={[styles.ratingsCountText, { color: themeColors.textSecondary }]}>
          {t("mentor.ratingsCount").replace("{0}", String(feedbacks.length))}
        </Text>
      ) : null}

      {/* Liste der letzten Feedbacks */}
      {feedbacks.length === 0 ? (
        <Text style={[styles.emptyText, { color: themeColors.textTertiary, paddingVertical: 12 }]}>
          {t("mentor.noRatings")}
        </Text>
      ) : (
        <>
          {displayed.map((f, idx) => {
            const ms = myMentorships.find((m) => m.id === f.mentorship_id);
            const menteeName = ms?.mentee?.name ?? "?";
            const dateStr = new Date(f.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" });
            const stars = "★".repeat(f.rating) + "☆".repeat(5 - f.rating);
            const isLast = idx === displayed.length - 1;
            return (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.feedbackRow,
                  !isLast && [styles.feedbackRowBorder, { borderBottomColor: isDark ? "#3A3520" : themeColors.border }],
                ]}
                onPress={() => ms && router.push({ pathname: "/mentorship/[id]", params: { id: ms.id } })}
                activeOpacity={0.7}
              >
                <View style={styles.feedbackStarsRow}>
                  <Text style={[styles.feedbackStars, { color: COLORS.gold }]}>{stars}</Text>
                  <Text style={[styles.feedbackDate, { color: themeColors.textTertiary }]}>{dateStr}</Text>
                </View>
                {f.comments ? (
                  <Text style={[styles.feedbackComment, { color: themeColors.textSecondary }]} numberOfLines={2}>
                    "{f.comments}"
                  </Text>
                ) : null}
                <Text style={[styles.feedbackMentee, { color: themeColors.textTertiary }]}>{menteeName}</Text>
              </TouchableOpacity>
            );
          })}
          {feedbacks.length > 3 && (
            <TouchableOpacity
              style={styles.showMoreBtn}
              onPress={() => setShowAll((v) => !v)}
              activeOpacity={0.7}
            >
              <Text style={[styles.showMoreText, { color: isDark ? COLORS.gold : COLORS.gradientStart }]}>
                {showAll ? "Weniger anzeigen" : t("mentor.showMoreFeedback")}
              </Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  );
}

async function shareHadith(text: string, suffix: string) {
  try {
    await Share.share({ message: `${text}\n\n${suffix}` });
  } catch {
    // Teilen abgebrochen — ignorieren
  }
}

function MenteeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipByMenteeId, getCompletedStepIds, sessionTypes, hadithe, refreshData, sendThanks } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [hadithOffset, setHadithOffset] = useState(0);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [sendingThanks, setSendingThanks] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);

  async function handleSendThanks() {
    if (!mentorship?.mentor_id) return;
    setSendingThanks(true);
    try {
      await sendThanks(mentorship.id, mentorship.mentor_id, thanksMessage || undefined);
      showSuccess(t("gamification.thankSuccess"));
      setShowThanksModal(false);
      setThanksMessage("");
    } catch {
      showError(t("common.error"));
    } finally {
      setSendingThanks(false);
    }
  }
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);
  const allDone = sessionTypes.length > 0 && completedStepIds.length === sessionTypes.length;
  const progressPercent = sessionTypes.length > 0
    ? Math.round((completedStepIds.length / sessionTypes.length) * 100)
    : 0;

  // Hadith für heute
  const todayHadith = useMemo(() => {
    if (hadithe.length === 0) return null;
    const today = new Date();
    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
    );
    const baseIdx = dayOfYear % hadithe.length;
    const idx = (baseIdx + hadithOffset) % hadithe.length;
    return hadithe[idx];
  }, [hadithe, hadithOffset]);

  // Anzahl Tage seit Start der Betreuung
  const daysSinceStart = mentorship?.assigned_at
    ? Math.max(0, Math.floor((Date.now() - new Date(mentorship.assigned_at).getTime()) / 86400000))
    : null;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>

        {/* ── Greeting ──────────────────────────────────────────────── */}
        <View style={[styles.mentorGreetingRow, { justifyContent: "center", alignItems: "center" }]}>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.mentorGreetingLabel, { color: isDark ? COLORS.gold : COLORS.gradientStart, textAlign: "center" }]}>
              SALAM ALEIKUM
            </Text>
            <Text style={[styles.mentorGreetingName, { color: themeColors.text, textAlign: "center" }]}>{user.name}</Text>
          </View>
        </View>

        {/* ── Glückwunsch-Banner ────────────────────────────────────── */}
        {mentorship && (mentorship.status === "active" || mentorship.status === "completed") && allDone && (
          <View style={[styles.congratsBanner, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7", borderColor: isDark ? "#2d6a4a" : "#86efac" }]}>
            <Ionicons name="ribbon-outline" size={28} color={isDark ? "#4ade80" : "#15803d"} style={{ marginBottom: 4 }} />
            <Text style={[styles.congratsTitle, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("mentorship.congratulations")}</Text>
            <Text style={[styles.congratsText, { color: isDark ? "#4ade80" : "#16a34a" }]}>{t("mentorship.allStepsDone")}</Text>
          </View>
        )}

        {mentorship ? (
          <>
            {/* ── KPI-Cards ──────────────────────────────────────────── */}
            <KpiGrid style={{ marginBottom: 16, justifyContent: "center" }}>
              <StatCard
                label={t("dashboard.yourProgress")}
                value={progressPercent}
                color={allDone ? COLORS.cta : COLORS.gold}
                iconName="trending-up-outline"
                sublabel="%"
              />
              <StatCard
                label={t("menteeProgress.title")}
                value={completedStepIds.length}
                color={COLORS.gradientStart}
                iconName="checkmark-done-outline"
                sublabel={`/ ${sessionTypes.length}`}
              />
              {daysSinceStart !== null && (
                <StatCard
                  label="Tage dabei"
                  value={daysSinceStart}
                  color="#6366f1"
                  iconName="calendar-outline"
                />
              )}
            </KpiGrid>

            {/* ── Danke sagen Button ───────────────────────────────────── */}
            {mentorship.status === "active" && mentorship.mentor_id && (
              <TouchableOpacity
                style={[styles.thankButton, { backgroundColor: isDark ? "#1A2A1A" : "#dcfce7", borderColor: isDark ? "#2d6a4a" : "#86efac" }]}
                onPress={() => setShowThanksModal(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.thankButtonText}>{t("gamification.thankButton")}</Text>
              </TouchableOpacity>
            )}

            {/* ── Danke-Modal ───────────────────────────────────────────── */}
            <Modal
              visible={showThanksModal}
              transparent
              animationType="fade"
              onRequestClose={() => setShowThanksModal(false)}
            >
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
                  <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("gamification.thankTitle")}</Text>
                  <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>{t("gamification.thankMessage")}</Text>
                  <TextInput
                    style={[styles.thankInput, { color: themeColors.text, borderColor: isDark ? "#3A3520" : themeColors.border, backgroundColor: isDark ? "#1A1A24" : themeColors.background }]}
                    placeholder={t("gamification.thankMessagePlaceholder")}
                    placeholderTextColor={themeColors.textTertiary}
                    value={thanksMessage}
                    onChangeText={setThanksMessage}
                    multiline
                    numberOfLines={3}
                  />
                  <View style={styles.modalButtonRow}>
                    <TouchableOpacity
                      style={[styles.modalCancelBtn, { borderColor: isDark ? "#3A3520" : themeColors.border }]}
                      onPress={() => { setShowThanksModal(false); setThanksMessage(""); }}
                    >
                      <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>{t("gamification.thankCancel")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.modalConfirmBtn, { opacity: sendingThanks ? 0.6 : 1 }]}
                      onPress={handleSendThanks}
                      disabled={sendingThanks}
                    >
                      <Text style={styles.modalConfirmText}>{t("gamification.thankSend")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </Modal>

            {/* ── Hadith — prominente große Card ───────────────────────── */}
            {todayHadith && (
              <View style={[styles.menteeHadithBigCard, { backgroundColor: isDark ? "#1A1A2E" : "#f0f4ff", borderColor: isDark ? "#3A3520" : "rgba(238,167,27,0.3)" }]}>
                <View style={styles.hadithCardHeader}>
                  <Text style={styles.hadithStar}>★</Text>
                  <Text style={[styles.hadithCardLabel, { color: themeColors.text, fontSize: 16 }]}>{t("motivation.title")}</Text>
                </View>
                {todayHadith.text_ar ? (
                  <Text style={[styles.mentorHadithArabic, { color: themeColors.text, fontSize: 22, marginBottom: 12 }]}>{todayHadith.text_ar}</Text>
                ) : null}
                <Text style={[styles.hadithCardText, { color: themeColors.textSecondary, fontSize: 16, lineHeight: 26 }]}>"{todayHadith.text_de}"</Text>
                {todayHadith.source ? (
                  <Text style={[styles.hadithCardQuelle, { color: COLORS.gold, marginTop: 10 }]}>{t("motivation.source")}: {todayHadith.source}</Text>
                ) : null}
                <View style={[styles.motivationActionsRow, { marginTop: 16 }]}>
                  <TouchableOpacity
                    style={[styles.motivationNextBtn, { paddingHorizontal: 20, paddingVertical: 10 }]}
                    onPress={() => setHadithOffset((prev) => prev + 1)}
                  >
                    <Text style={[styles.motivationNextText, { fontSize: 14 }]}>{t("motivation.next")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.motivationShareBtn, { backgroundColor: isDark ? "#2A2A3C" : "#e8eaf6", padding: 12, borderRadius: 10 }]}
                    onPress={() => {
                      const shareText = todayHadith.text_ar
                        ? `${todayHadith.text_ar}\n\n${todayHadith.text_de}`
                        : todayHadith.text_de;
                      shareHadith(shareText, t("share.suffix"));
                    }}
                  >
                    <Ionicons name="share-outline" size={20} color={COLORS.gold} />
                  </TouchableOpacity>
                </View>
              </View>
            )}

          </>
        ) : (
          <View style={[styles.card, { backgroundColor: themeColors.card, padding: 32, alignItems: "center", marginBottom: 16 }]}>
            <Text style={[styles.boldPrimary, { color: themeColors.text }]}>{t("dashboard.pendingAssignment")}</Text>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary, marginTop: 8 }]}>
              {t("dashboard.pendingAssignmentText")}
            </Text>
          </View>
        )}

      </View>
    </ScrollView>
  );
}

function KpiGrid({ children, style }: { children: React.ReactNode; style?: object }) {
  const { width } = useWindowDimensions();
  const isDesktop = width > 768;
  const childArray = React.Children.toArray(children);
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", gap: 10 }, style]}>
      {childArray.map((child, idx) => (
        <View
          key={idx}
          style={{
            width: isDesktop ? "23.5%" : "48%",
            marginBottom: isDesktop ? 0 : 0,
          }}
        >
          {child}
        </View>
      ))}
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  iconName,
  sublabel,
  highlight,
}: {
  label: string;
  value: number;
  color: string;
  iconName?: string;
  sublabel?: string;
  highlight?: boolean;
}) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const valueColor = isDark ? (highlight ? "#FFCA28" : themeColors.text) : themeColors.text;
  return (
    <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#3A3520" : themeColors.border }]}>
      {iconName && (
        <View style={[styles.statIconCircle, { backgroundColor: color + "33" }]}>
          <Ionicons name={iconName as any} size={18} color={color} />
        </View>
      )}
      <Text style={[styles.statValue, { color: valueColor }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      {sublabel && (
        <Text style={[styles.statSublabel, { color: themeColors.textTertiary }]}>{sublabel}</Text>
      )}
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  const themeColors = useThemeColors();
  return (
    <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
      <View
        style={[styles.progressFill, { width: `${progress}%` as any }]}
      />
    </View>
  );
}

function MonthlyChart({ mentorships }: { mentorships: Mentorship[] }) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const monthData = useMemo(() => {
    const now = new Date();
    const months: { label: string; count: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleDateString("de-DE", { month: "short" });
      const count = mentorships.filter((m) => {
        const assigned = new Date(m.assigned_at);
        return (
          assigned.getFullYear() === d.getFullYear() &&
          assigned.getMonth() === d.getMonth()
        );
      }).length;
      months.push({ label, count });
    }
    return months;
  }, [mentorships]);

  const maxCount = Math.max(...monthData.map((m) => m.count), 1);
  const BAR_MAX_HEIGHT = 80;

  return (
    <View style={[styles.chartCard, { backgroundColor: themeColors.card }]}>
      <Text style={[styles.cardTitle, { color: themeColors.text }]}>{t("dashboard.newMentorships")}</Text>
      <View style={styles.chartArea}>
        {/* Y-Achse */}
        <View style={styles.yAxis}>
          {[maxCount, Math.ceil(maxCount / 2), 0].map((val, idx) => (
            <Text key={idx} style={[styles.yLabel, { color: themeColors.textTertiary }]}>{val}</Text>
          ))}
        </View>
        {/* Balken */}
        <View style={styles.barsContainer}>
          {monthData.map((month, idx) => {
            const barHeight = maxCount > 0
              ? Math.max((month.count / maxCount) * BAR_MAX_HEIGHT, month.count > 0 ? 8 : 0)
              : 0;
            return (
              <View key={idx} style={styles.barColumn}>
                <View style={styles.barWrapper}>
                  <Text style={[styles.barValueLabel, { color: themeColors.textSecondary }]}>{month.count > 0 ? month.count : ""}</Text>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: COLORS.gradientStart,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.xLabel, { color: themeColors.textTertiary }]}>{month.label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },

  // Admin Header (neu)
  adminHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  adminHeaderLeft: {
    flex: 1,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Zeitraum-Bar (neu)
  periodBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    flexWrap: "wrap",
    gap: 8,
  },
  periodBarLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  periodBarLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  periodBarButtons: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Admin Dashboard Tabs
  adminTabRow: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  adminTabBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  adminTabBtnActive: {
    backgroundColor: COLORS.gradientStart,
  },
  adminTabBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  adminTabBtnTextActive: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },

  // Mentor Dashboard: Link zu abgeschlossenen Betreuungen
  completedLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingVertical: 12,
    marginTop: 4,
  },
  completedLinkText: {
    fontSize: 13,
    flex: 1,
  },
  completedLinkArrow: {
    fontSize: 16,
    marginLeft: 8,
  },

  searchInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 8,
  },
  searchResultsBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 16,
    overflow: "hidden",
  },
  searchNoResults: { color: COLORS.tertiary, fontSize: 14, padding: 16, textAlign: "center" },
  searchSection: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  searchSectionLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 4,
  },
  searchResultRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  searchResultName: { color: COLORS.primary, fontWeight: "500", fontSize: 14 },
  searchResultSub: { color: COLORS.tertiary, fontSize: 12 },
  headerTextGroup: { flex: 1 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: COLORS.primary, marginBottom: 10 },
  row3: { flexDirection: "row", gap: 10, marginBottom: 10 },
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
  cardTitle: { fontWeight: "600", fontSize: 15, color: COLORS.primary, marginBottom: 12 },
  emptyText: { color: COLORS.tertiary, textAlign: "center", fontSize: 14, paddingVertical: 16 },
  listItem: { paddingVertical: 12 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowBetweenMb2: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  rowBetweenMb3: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  semiboldPrimary: { fontWeight: "600", color: COLORS.primary },
  boldPrimary: { fontWeight: "700", color: COLORS.primary },
  tertiaryXs: { color: COLORS.tertiary, fontSize: 12 },
  percentBadge: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  percentBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 100,
  },
  statIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  statLabel: { fontSize: 13, marginTop: 4 },
  statSublabel: { fontSize: 11, marginTop: 2 },
  statValue: { fontSize: 32, fontWeight: "800" },
  rankHintText: { fontSize: 11, textAlign: "center", marginTop: -4 },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 4 },
  amberBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  amberTitle: { fontWeight: "600", marginBottom: 4 },
  amberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  menteeNameText: { fontWeight: "500" },
  menteeSubText: { color: COLORS.tertiary, fontSize: 12 },
  assignButton: {
    backgroundColor: COLORS.gradientStart,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  assignButtonText: { color: COLORS.white, fontSize: 12, fontWeight: "600" },
  actionButton: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "600", textAlign: "center" },
  actionButtonGold: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: "rgba(238,167,27,0.08)",
  },
  actionButtonTextDark: { color: COLORS.primary, fontSize: 13, fontWeight: "600", textAlign: "center" },
  applicationsButton: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  applicationsButtonContent: { flex: 1 },
  applicationsButtonText: { fontWeight: "600", color: COLORS.primary, fontSize: 14 },
  applicationsButtonSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  applicationsBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 4,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  applicationsBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  applicationsArrow: { color: COLORS.tertiary, fontSize: 18 },
  blueBox: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 16,
  },
  blueTitle: { color: COLORS.white, fontWeight: "600", fontSize: 14, marginBottom: 4 },
  blueText: { color: COLORS.white, opacity: 0.8, fontSize: 13 },
  greetingCard: {
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
  greetingSmall: { color: COLORS.white, fontSize: 13, opacity: 0.75, marginBottom: 2 },
  greetingName: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  greetingMeta: { color: COLORS.white, opacity: 0.65, fontSize: 13, marginTop: 2 },
  menteeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  stepsBadge: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  stepsBadgeText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  nextStepRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  goldDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, marginRight: 8 },
  nextStepText: { color: COLORS.secondary, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  docButton: {
    flex: 1,
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  docButtonText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  chatButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
    position: "relative",
    overflow: "visible",
  },
  chatButtonText: { color: COLORS.secondary, fontSize: 12, fontWeight: "600" },
  unreadBadge: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 9999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  goldBox: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
  },
  goldBoxHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  goldStar: { color: COLORS.gold, fontSize: 18, marginRight: 8 },
  goldBoxTitle: { fontWeight: "700", color: COLORS.primary, fontSize: 15 },
  goldBoxText: { color: COLORS.secondary, fontSize: 14 },
  goldBold: { color: COLORS.gold, fontWeight: "700" },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "visible",
  },
  secondaryButtonText: { color: COLORS.gradientStart, fontSize: 13, fontWeight: "600" },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepIndicator: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepIndicatorTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  stepIndicatorTextTertiary: { color: COLORS.tertiary, fontSize: 14, fontWeight: "700" },
  stepName: { fontWeight: "500", fontSize: 15 },
  currentStepLabel: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  stepWaitingLabel: { fontSize: 12, marginTop: 2 },
  doneChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  doneChipText: { fontSize: 12 },
  waitingChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  waitingChipText: { fontSize: 12, fontWeight: "600" },
  checkboxOuter: { width: 28, alignItems: "center", justifyContent: "center" },
  checkboxIcon: { fontSize: 22, color: COLORS.tertiary },
  checkboxLoading: { fontSize: 14, color: COLORS.tertiary },
  progressMotivation: {
    color: COLORS.secondary,
    fontSize: 13,
    marginBottom: 10,
    fontStyle: "italic",
  },
  chartCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  chartArea: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 12,
    height: 110,
  },
  yAxis: {
    width: 24,
    height: 90,
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginRight: 8,
    paddingBottom: 2,
  },
  yLabel: { color: COLORS.tertiary, fontSize: 10 },
  barsContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
  },
  barWrapper: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 90,
  },
  barValueLabel: {
    color: COLORS.secondary,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
  },
  bar: {
    width: "100%",
    borderRadius: 4,
    minWidth: 20,
  },
  xLabel: {
    color: COLORS.tertiary,
    fontSize: 11,
    marginTop: 6,
    textAlign: "center",
  },
  allDoneRow: { marginTop: 12, gap: 8 },
  allDoneLabel: { color: COLORS.cta, fontWeight: "700", fontSize: 13, textAlign: "center" },
  completeNowButton: {
    backgroundColor: COLORS.gold,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  completeNowButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  congratsBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  congratsEmoji: { fontSize: 32, marginBottom: 6 },
  congratsTitle: { fontWeight: "700", fontSize: 18, marginBottom: 4 },
  congratsText: { fontSize: 14, textAlign: "center" },
  feedbackBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  feedbackBannerText: { fontWeight: "600", fontSize: 13, flex: 1 },
  feedbackBannerButton: {
    backgroundColor: "#f59e0b",
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  feedbackBannerButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 12 },
  hadithCard: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
    borderRadius: 8,
    padding: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  hadithCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  hadithStar: { color: COLORS.gold, fontSize: 16, marginRight: 6 },
  hadithCardLabel: { fontWeight: "700", color: COLORS.primary, fontSize: 13 },
  hadithCardText: { color: COLORS.secondary, fontSize: 13, lineHeight: 20, fontStyle: "italic", marginBottom: 6 },
  hadithCardQuelle: { color: COLORS.tertiary, fontSize: 11, marginBottom: 8 },
  hadithCardLink: { color: COLORS.link, fontSize: 13, fontWeight: "600" },
  pendingApprovalsButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  pendingApprovalsText: { fontWeight: "600", fontSize: 14 },
  pendingApprovalsSub: { fontSize: 12, marginTop: 2 },
  // Mein Mentor Karte
  mentorInfoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  mentorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  mentorAvatarText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  mentorDetailRows: { gap: 4 },
  mentorDetailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  mentorDetailLabel: { color: COLORS.secondary, fontSize: 12 },
  mentorDetailValue: { color: COLORS.primary, fontSize: 12, fontWeight: "500" },
  // Letzte Aktivitäten
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold, flexShrink: 0 },
  activityTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "500" },
  activitySub: { color: COLORS.tertiary, fontSize: 11, marginTop: 1 },
  activityDate: { color: COLORS.tertiary, fontSize: 11, flexShrink: 0 },

  // Frühwarnungen Widget
  warningBox: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  warningHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10, gap: 8 },
  warningTitle: { fontWeight: "700", fontSize: 14, flex: 1 },
  warningBadge: {
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  warningBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  warningRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 8 },
  warningRowBorder: { borderBottomWidth: 1 },
  warningDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  warningLabel: { fontSize: 11, fontWeight: "600" },
  warningName: { fontSize: 13, fontWeight: "500", marginTop: 1 },
  warningDays: { fontSize: 11, flexShrink: 0 },
  warningArrow: { fontSize: 16, marginLeft: 4 },

  // Stagnante Betreuungen
  stagnantBox: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
    borderRadius: 8,
    padding: 14,
    marginBottom: 14,
  },
  stagnantRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    gap: 8,
  },
  stagnantRowBorder: { borderBottomWidth: 1 },
  stagnantMentorName: { fontSize: 13, fontWeight: "700" },
  stagnantSub: { fontSize: 12, marginTop: 1 },
  reminderBtn: {
    backgroundColor: "#3b82f6",
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  reminderBtnText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },

  // Mentor des Monats Card (Admin)
  momAdminCard: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  momAdminHeader: { flexDirection: "row", alignItems: "center", marginBottom: 6 },
  momAdminStar: { color: COLORS.gold, fontSize: 18, marginRight: 8 },
  momAdminTitle: { fontWeight: "700", color: COLORS.secondary, fontSize: 12, letterSpacing: 0.5 },
  momAdminName: { fontSize: 20, fontWeight: "700", color: COLORS.primary, marginBottom: 12 },
  momAdminSub: { fontSize: 11, color: "#6B7280" },
  momAdminStatsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  momAdminStat: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
  },
  momAdminStatValue: { fontSize: 18, fontWeight: "700", color: COLORS.gold },
  momAdminStatLabel: { color: COLORS.secondary, fontSize: 10, marginTop: 2 },
  momAdminArrow: { color: COLORS.link, fontSize: 13, fontWeight: "600" },
  momAwardButton: {
    backgroundColor: "rgba(238,167,27,0.15)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
  },
  momAwardButtonText: { color: "#92600a", fontSize: 13, fontWeight: "700" as const },

  // Offene Zuweisungen
  openAssignmentsCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 10,
    padding: 14,
    marginBottom: 14,
  },
  openAssignmentsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  openAssignmentsRow: { fontSize: 13, marginBottom: 3 },

  // Motivationscard (Mentee)
  motivationCard: {
    backgroundColor: "#0A3A5A",
    borderWidth: 2,
    borderColor: "#EEA71B",
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  motivationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  motivationStar: { color: "#EEA71B", fontSize: 18, marginRight: 8 },
  motivationTitle: { fontWeight: "700", color: "#EEA71B", fontSize: 14 },
  motivationArabic: {
    color: COLORS.white,
    fontSize: 18,
    textAlign: "right",
    lineHeight: 28,
    marginBottom: 10,
    fontWeight: "500",
  },
  motivationText: {
    color: COLORS.white,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: "italic",
    marginBottom: 8,
  },
  motivationSource: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 11,
    marginBottom: 12,
  },
  motivationActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  motivationShareBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(238,167,27,0.15)",
    borderRadius: 8,
  },
  motivationNextBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(238,167,27,0.15)",
    borderWidth: 1,
    borderColor: "#EEA71B",
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  motivationNextText: { color: "#EEA71B", fontSize: 12, fontWeight: "600" },

  // Quick-Tool Grid
  quickToolGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  quickToolItem: {
    width: "22%",
    minWidth: 72,
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  quickToolLabel: {
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 14,
  },

  // ── Mentor Dashboard Redesign ──────────────────────────────────────────
  mentorGreetingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 20,
  },
  mentorGreetingLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.5,
    marginBottom: 2,
  },
  mentorGreetingName: {
    fontSize: 26,
    fontWeight: "800",
    lineHeight: 30,
    marginBottom: 2,
  },
  mentorGreetingMeta: {
    fontSize: 13,
  },
  mentorLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
    marginTop: 4,
  },
  mentorLogoText: {
    fontSize: 12,
    fontWeight: "900",
    color: COLORS.gold,
    letterSpacing: 1,
  },
  levelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  levelHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  levelTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  levelSubtitle: {
    fontSize: 12,
  },
  levelScoreBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  levelScoreText: {
    fontSize: 14,
    fontWeight: "700",
  },
  levelTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 4,
  },
  levelHint: {
    fontSize: 11,
    marginTop: 6,
  },
  levelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  levelBadge: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  streakThanksRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  streakEmoji: {
    fontSize: 15,
  },
  streakText: {
    fontSize: 12,
    fontWeight: "500",
  },
  achievementChip: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 48,
    position: "relative",
  },
  achievementIcon: {
    fontSize: 24,
  },
  achievementTooltip: {
    position: "absolute",
    top: 54,
    left: -20,
    width: 160,
    borderRadius: 8,
    borderWidth: 1,
    padding: 8,
    zIndex: 100,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  achievementTooltipTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  achievementTooltipDesc: {
    fontSize: 11,
    lineHeight: 16,
  },
  achievementTooltipLocked: {
    fontSize: 10,
    marginTop: 4,
    fontStyle: "italic",
  },
  impactRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  impactLabel: {
    fontSize: 13,
  },
  impactCount: {
    fontSize: 13,
    fontWeight: "700",
  },
  // Danke-Button (Mentee)
  thankButton: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  thankButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#15803d",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    borderRadius: 16,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalBody: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  thankInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
    marginBottom: 16,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    backgroundColor: COLORS.gold,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0E0E14",
  },
  // Kompakte Mentees-Card im Mentor-Dashboard
  compactMenteesCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  compactMenteesHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  compactMenteesTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  compactMenteesCompleted: {
    fontSize: 12,
    marginTop: 2,
  },
  compactMenteesAllLink: {
    fontSize: 13,
    fontWeight: "600",
  },
  compactMenteeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 8,
  },
  compactMenteeName: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  // Quick Actions
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  quickActionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    gap: 8,
  },
  quickActionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  menteeCardNew: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  menteeCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  menteeCardNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  menteeCardName: {
    fontSize: 16,
    fontWeight: "700",
  },
  menteeCardCity: {
    fontSize: 12,
    marginTop: 2,
  },
  stepsBadgeNew: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  stepsBadgeNewText: {
    fontSize: 13,
    fontWeight: "700",
  },
  menteeProgressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    marginBottom: 4,
  },
  menteeProgressFill: {
    height: "100%",
    borderRadius: 3,
  },
  menteeNextStep: {
    fontSize: 12,
    marginBottom: 4,
  },
  menteeCardTap: {
    fontSize: 11,
    marginTop: 6,
    textAlign: "right",
  },
  mentorHadithCard: {
    backgroundColor: "rgba(238,167,27,0.06)",
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  mentorHadithArabic: {
    fontSize: 16,
    textAlign: "right",
    lineHeight: 26,
    marginBottom: 8,
    fontWeight: "500",
  },

  // Timeline Steps
  timelineDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  timelineConnector: {
    width: 24,
    height: 3,
    borderRadius: 2,
    alignSelf: "flex-start",
  },

  // Große Hadith-Card für Mentee Dashboard
  menteeHadithBigCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 22,
    marginBottom: 16,
  },

  // ── Mentee Dashboard Redesign ──────────────────────────────────────────
  menteeInfoCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 14,
  },
  menteeInfoCardTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 2,
  },
  menteeInfoCardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  menteeProgressCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  menteeProgressHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  menteeProgressTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  menteeProgressSub: {
    fontSize: 12,
    maxWidth: 180,
  },
  menteeProgressBig: {
    alignItems: "flex-end",
  },
  menteeProgressBigNum: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
  },
  menteeProgressBigSteps: {
    fontSize: 12,
    marginTop: 2,
  },
  stepsChipGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  stepChip: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
    width: "30%",
    flexGrow: 1,
  },
  stepChipNum: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },
  stepChipName: {
    fontSize: 10,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 13,
  },

  // Mentor Dashboard – Vernachlässigte Mentees
  mentorSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 6,
  },
  neglectedRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  neglectedText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  neglectedArrow: {
    fontSize: 16,
    marginLeft: 6,
  },

  // Mentor Dashboard – Bewertungen
  ratingsCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  ratingsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  avgRatingBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  avgRatingValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  ratingsCountText: {
    fontSize: 12,
    marginBottom: 10,
  },
  feedbackRow: {
    paddingVertical: 10,
    gap: 3,
  },
  feedbackRowBorder: {
    borderBottomWidth: 1,
  },
  feedbackStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feedbackStars: {
    fontSize: 14,
    letterSpacing: 1,
  },
  feedbackDate: {
    fontSize: 11,
  },
  feedbackComment: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 18,
    marginTop: 2,
  },
  feedbackMentee: {
    fontSize: 11,
    marginTop: 2,
  },
  showMoreBtn: {
    marginTop: 8,
    alignItems: "center",
    paddingVertical: 6,
  },
  showMoreText: {
    fontSize: 13,
    fontWeight: "600",
  },
});
