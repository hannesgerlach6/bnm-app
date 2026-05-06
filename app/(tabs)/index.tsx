import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, StyleSheet, RefreshControl, Platform, Share, useWindowDimensions, Modal, TextInput, Linking } from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useGamification } from "../../contexts/GamificationContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { showError, showSuccess } from "../../lib/errorHandler";
import type { Mentorship, Feedback } from "../../types";
import { COLORS, SHADOWS, RADIUS, TYPOGRAPHY, SEMANTIC, sem } from "../../constants/Colors";
import { Confetti } from "../../components/Confetti";
import { Container } from "../../components/Container";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { navigateToChat } from "../../lib/chatNavigation";
import { SlideOverPanel } from "../../components/SlideOverPanel";
import { SkeletonDashboard } from "../../components/Skeleton";
import { usePageTitle } from "../../hooks/usePageTitle";
import { MentorDetailPanel } from "../../components/MentorDetailPanel";
import { MenteeDetailPanel } from "../../components/MenteeDetailPanel";
import { getLevelForXP, getNextLevel, getLevelProgress, ACHIEVEMENTS, XP_VALUES, LEVELS } from "../../lib/gamification";

export default function DashboardScreen() {
  usePageTitle("Dashboard");
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "admin") return <Container fullWidth={Platform.OS === "web"}><AdminDashboard showSystemSettings /></Container>;
  if (user.role === "office") return <Container fullWidth={Platform.OS === "web"}><AdminDashboard showSystemSettings={false} /></Container>;
  if (user.role === "mentor") return <Container fullWidth={Platform.OS === "web"}><MentorDashboard /></Container>;
  return <Container fullWidth={Platform.OS === "web"}><MenteeDashboard /></Container>;
}

function AdminDashboard({ showSystemSettings = true }: { showSystemSettings?: boolean }) {
  const insets = useSafeAreaInsets();
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
    applications,
    mentorOfMonthVisible,
    getUnassignedMentees,
    getPendingApprovalsCount,
    sendAdminDirectMessage,
    adminMessages,
    refreshData,
    isLoading,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [activePeriod, setActivePeriod] = useState<"thisMonth" | "lastMonth" | "thisQuarter" | "thisYear">("thisMonth");
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);
  const [activityFilter, setActivityFilter] = useState<"all" | "sessions" | "assignments" | "completions" | "feedback">("all");
  const [activityDateRange, setActivityDateRange] = useState<"7d" | "30d" | "all">("30d");
  const [activityLimit, setActivityLimit] = useState(20);
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

  // Kein auto-refresh bei Tab-Focus — Realtime-Subscriptions halten Daten aktuell.
  // Pull-to-Refresh (onRefresh) bleibt für manuelles Aktualisieren.

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
  // Offene Mentor-Bewerbungen (nicht Mentee-Anmeldungen)
  const pendingMentorAppsCount = applications.filter(
    (a) => a.motivation !== "Anmeldung als neuer Muslim (öffentliches Formular)" && a.status === "pending"
  ).length;

  // ─── Unified Activity Log ──────────────────────────────────────────────────
  type ActivityItem = {
    id: string;
    timestamp: Date;
    type: "session" | "assignment" | "completion" | "cancellation" | "feedback";
    description: string;
    icon: keyof typeof Ionicons.glyphMap;
    color: string;
  };

  const allActivities = useMemo(() => {
    const items: ActivityItem[] = [];

    // Sessions
    for (const s of sessions) {
      const ms = mentorships.find((m) => m.id === s.mentorship_id);
      const stepName = s.session_type?.name ?? "Session";
      const mentorName = ms?.mentor?.name ?? "–";
      const menteeName = ms?.mentee?.name ?? "–";
      items.push({
        id: `s-${s.id}`,
        timestamp: new Date(s.date),
        type: "session",
        description: `${mentorName} hat Session '${stepName}' mit ${menteeName} dokumentiert`,
        icon: "document-text",
        color: COLORS.blue,
      });
    }

    // Assignments
    for (const m of mentorships) {
      if (m.assigned_at) {
        items.push({
          id: `a-${m.id}`,
          timestamp: new Date(m.assigned_at),
          type: "assignment",
          description: `${m.mentee?.name ?? "Mentee"} wurde ${m.mentor?.name ?? "Mentor"} zugewiesen`,
          icon: "people",
          color: COLORS.gold,
        });
      }
    }

    // Completions & Cancellations
    for (const m of mentorships) {
      if (m.status === "completed" && m.completed_at) {
        items.push({
          id: `c-${m.id}`,
          timestamp: new Date(m.completed_at),
          type: "completion",
          description: `Betreuung ${m.mentor?.name ?? "Mentor"} → ${m.mentee?.name ?? "Mentee"} wurde abgeschlossen`,
          icon: "checkmark-circle",
          color: COLORS.cta,
        });
      }
      if (m.status === "cancelled" && m.cancelled_at) {
        items.push({
          id: `x-${m.id}`,
          timestamp: new Date(m.cancelled_at),
          type: "cancellation",
          description: `Betreuung ${m.mentor?.name ?? "Mentor"} → ${m.mentee?.name ?? "Mentee"} wurde abgebrochen`,
          icon: "close-circle",
          color: COLORS.error,
        });
      }
    }

    // Feedback
    for (const f of feedback) {
      const ms = mentorships.find((m) => m.id === f.mentorship_id);
      const submitterName = users.find((u) => u.id === f.submitted_by)?.name ?? "Jemand";
      items.push({
        id: `f-${f.id}`,
        timestamp: new Date(f.created_at),
        type: "feedback",
        description: `${submitterName} hat Feedback gegeben (${f.rating}★)`,
        icon: "star",
        color: COLORS.warning,
      });
    }

    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [sessions, mentorships, feedback, users]);

  const filteredActivities = useMemo(() => {
    let items = allActivities;

    // Date range filter
    if (activityDateRange !== "all") {
      const now = Date.now();
      const days = activityDateRange === "7d" ? 7 : 30;
      const cutoff = now - days * 24 * 60 * 60 * 1000;
      items = items.filter((a) => a.timestamp.getTime() >= cutoff);
    }

    // Type filter
    if (activityFilter !== "all") {
      if (activityFilter === "completions") {
        items = items.filter((a) => a.type === "completion" || a.type === "cancellation");
      } else if (activityFilter === "sessions") {
        items = items.filter((a) => a.type === "session");
      } else if (activityFilter === "assignments") {
        items = items.filter((a) => a.type === "assignment");
      } else if (activityFilter === "feedback") {
        items = items.filter((a) => a.type === "feedback");
      }
    }

    return items;
  }, [allActivities, activityFilter, activityDateRange]);

  const visibleActivities = useMemo(() => {
    return filteredActivities.slice(0, activityLimit);
  }, [filteredActivities, activityLimit]);

  // Betreuungs-Warnungen: Alle Typen in einer vereinten Liste
  const allWarnings = useMemo(() => {
    const warnings: { type: "feedback" | "discrepancy" | "inactive"; label: string; mentorName: string; menteeName: string; mentorshipId: string; mentorId?: string; mentorGender?: string; daysSince?: number; date?: Date }[] = [];

    // Negatives Feedback (Rating ≤ 2)
    for (const f of feedback) {
      if (f.rating <= 2) {
        const ms = mentorships.find((m) => m.id === f.mentorship_id);
        if (!ms) continue;
        warnings.push({
          type: "feedback",
          label: `${ms.mentee?.name ?? "?"} → ${ms.mentor?.name ?? "?"}`,
          mentorName: ms.mentor?.name ?? "?",
          menteeName: ms.mentee?.name ?? "?",
          mentorshipId: f.mentorship_id,
          mentorId: ms.mentor_id,
          date: new Date(f.created_at),
          daysSince: Math.floor((Date.now() - new Date(f.created_at).getTime()) / 86400000),
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
          mentorName: m.mentor?.name ?? "?",
          menteeName: m.mentee?.name ?? "?",
          mentorshipId: m.id,
          mentorId: m.mentor_id,
        });
      }
    }

    // Inaktive Mentoren: ≥5 Tage keine Session bei aktiver Betreuung
    const now = Date.now();
    const fiveDays = 5 * 24 * 60 * 60 * 1000;
    for (const m of mentorships) {
      if (m.status !== "active") continue;
      const mentorSessions = sessions.filter((s) => s.mentorship_id === m.id);
      let lastTime: number;
      if (mentorSessions.length === 0) {
        lastTime = new Date(m.assigned_at).getTime();
      } else {
        lastTime = Math.max(...mentorSessions.map((s) => new Date(s.date).getTime()));
      }
      const daysSince = Math.floor((now - lastTime) / 86400000);
      if (now - lastTime >= fiveDays) {
        warnings.push({
          type: "inactive",
          label: `${m.mentor?.name ?? "?"} → ${m.mentee?.name ?? "?"}`,
          mentorName: m.mentor?.name ?? "?",
          menteeName: m.mentee?.name ?? "?",
          mentorshipId: m.id,
          mentorId: m.mentor_id,
          mentorGender: m.mentor?.gender,
          daysSince,
          date: new Date(lastTime),
        });
      }
    }

    // Sortieren: Inaktive nach Tagen absteigend, dann Feedback, dann Diskrepanz
    return warnings.sort((a, b) => (b.daysSince ?? 0) - (a.daysSince ?? 0));
  }, [feedback, mentorships, sessions]);

  // Überfällige Betreuungen (>12 Wochen aktiv)
  const overdueMentorships = useMemo(() => {
    const twelveWeeksMs = 12 * 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return mentorships
      .filter((m) => m.status === "active" && (now - new Date(m.assigned_at).getTime()) > twelveWeeksMs)
      .map((m) => {
        const weeks = Math.floor((now - new Date(m.assigned_at).getTime()) / (7 * 24 * 60 * 60 * 1000));
        return { mentorship: m, weeks };
      })
      .sort((a, b) => b.weeks - a.weeks);
  }, [mentorships]);

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

  if (isLoading) return <SkeletonDashboard />;

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
          <BNMPressable
            style={[styles.refreshButton, { backgroundColor: "transparent", borderColor: isDark ? themeColors.accent : themeColors.border }]}
            onPress={() => refreshData()}
            accessibilityRole="button"
            accessibilityLabel="Daten aktualisieren"
                     >
            <Ionicons name="reload-outline" size={16} color={isDark ? themeColors.accent : themeColors.textSecondary} />
            <Text style={[styles.refreshButtonText, { color: isDark ? themeColors.accent : themeColors.textSecondary }]}>{t("dashboard.refresh")}</Text>
          </BNMPressable>
        </View>

        {/* ── Zeitraum-Bar ────────────────────────────────────────────────── */}
        <View style={[styles.periodBar, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View style={styles.periodBarLeft}>
            <Ionicons name="calendar-outline" size={15} color={isDark ? themeColors.accent : themeColors.textSecondary} />
            <Text style={[styles.periodBarLabel, { color: isDark ? themeColors.accent : themeColors.textSecondary }]}>{t("dashboard.periodBar")}</Text>
          </View>
          <View style={styles.periodBarButtons}>
            {(["thisMonth", "lastMonth", "thisQuarter", "thisYear"] as const).map((p) => (
              <BNMPressable
                key={p}
                style={[
                  styles.periodBtn,
                  activePeriod === p
                    ? { backgroundColor: themeColors.accent, borderColor: themeColors.accent }
                    : { backgroundColor: "transparent", borderColor: themeColors.border },
                ]}
                onPress={() => setActivePeriod(p)}
                accessibilityRole="button"
                accessibilityLabel={t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}` as any)}
                accessibilityState={{ selected: activePeriod === p }}
              >
                <Text style={[
                  styles.periodBtnText,
                  { color: activePeriod === p ? themeColors.black : themeColors.textSecondary },
                ]}>
                  {t(`dashboard.period${p.charAt(0).toUpperCase() + p.slice(1)}` as any)}
                </Text>
              </BNMPressable>
            ))}
          </View>
        </View>

        {/* ── ÜBERSICHT + VERWALTUNG + TOOLS ────────────────── */}
        <>
            {/* KPI Karten – responsiv: 4 pro Reihe auf Desktop, 2 auf Mobile */}
            <KpiGrid style={{ marginBottom: 16 }}>
              <StatCard
                label={t("dashboard.activeMentorships")}
                value={activeMentorships.length}
                color={COLORS.gradientStart}
                iconName="people-outline"
                highlight
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
                color={SEMANTIC.indigo}
                iconName="school-outline"
              />
            </KpiGrid>

            {/* ── Neue Mentees (volle Breite) ── */}
            {unassignedMentees.length > 0 && (
              <View style={[styles.amberBox, { backgroundColor: sem(SEMANTIC.amberBg, isDark), borderColor: sem(SEMANTIC.amberBorder, isDark) }]}>
                <Text style={[styles.amberTitle, { color: sem(SEMANTIC.amberText, isDark) }]}>
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
                    <BNMPressable style={styles.assignButton} onPress={() => router.push({ pathname: "/assign", params: { menteeId: mentee.id } })} accessibilityRole="button" accessibilityLabel={`${mentee.name} zuweisen`}>
                      <Text style={styles.assignButtonText}>{t("dashboard.assign")}</Text>
                    </BNMPressable>
                  </View>
                ))}
              </View>
            )}

            {/* ── Pending Approvals (volle Breite) ── */}
            {pendingApprovalsCount > 0 && (
              <BNMPressable
                style={[styles.pendingApprovalsButton, { backgroundColor: sem(SEMANTIC.amberBg, isDark), borderColor: sem(SEMANTIC.amberBorder, isDark) }]}
                onPress={() => router.push("/admin/pending-approvals")}
                accessibilityRole="link"
                accessibilityLabel="Ausstehende Genehmigungen anzeigen"
              >
                <View style={styles.applicationsButtonContent}>
                  <Text style={[styles.pendingApprovalsText, { color: sem(SEMANTIC.amberTextAlt, isDark) }]}>{t("dashboard.pendingApprovals")}</Text>
                  <Text style={[styles.pendingApprovalsSub, { color: sem(SEMANTIC.amberText, isDark) }]}>
                    {t("dashboard.pendingApprovalsCount").replace("{0}", String(pendingApprovalsCount)).replace("{1}", pendingApprovalsCount === 1 ? "" : "en")}
                  </Text>
                </View>
                <View style={styles.applicationsBadge}><Text style={styles.applicationsBadgeText}>{pendingApprovalsCount}</Text></View>
                <Text style={[styles.applicationsArrow, { color: sem(SEMANTIC.amberTextAlt, isDark) }]}>›</Text>
              </BNMPressable>
            )}

            {/* ── Offene Mentor-Bewerbungen ── */}
            {pendingMentorAppsCount > 0 && (
              <BNMPressable
                style={[styles.pendingApprovalsButton, { backgroundColor: sem(SEMANTIC.blueBg, isDark), borderColor: sem(SEMANTIC.blueBorder, isDark) }]}
                onPress={() => router.push("/(tabs)/applications")}
                accessibilityRole="link"
                accessibilityLabel="Offene Mentor-Bewerbungen anzeigen"
              >
                <View style={styles.applicationsButtonContent}>
                  <Text style={[styles.pendingApprovalsText, { color: sem(SEMANTIC.blueText, isDark) }]}>{t("dashboard.pendingMentorApps")}</Text>
                  <Text style={[styles.pendingApprovalsSub, { color: sem(SEMANTIC.blueText, isDark) }]}>
                    {pendingMentorAppsCount === 1
                      ? t("dashboard.pendingMentorAppsCount1")
                      : t("dashboard.pendingMentorAppsCountN").replace("{0}", String(pendingMentorAppsCount))}
                  </Text>
                </View>
                <View style={[styles.applicationsBadge, { backgroundColor: sem(SEMANTIC.blueBadgeBg, isDark) }]}>
                  <Text style={styles.applicationsBadgeText}>{pendingMentorAppsCount}</Text>
                </View>
                <Text style={[styles.applicationsArrow, { color: sem(SEMANTIC.blueText, isDark) }]}>›</Text>
              </BNMPressable>
            )}

            {/* ── Mentor des Monats (volle Breite) ── */}
            {mentorOfMonthVisible && !topMentor && (
              <View style={[styles.momAdminCard, { opacity: 0.85 }]}>
                <View style={styles.momAdminHeader}>
                  <Text style={styles.momAdminStar}>★</Text>
                  <Text style={[styles.momAdminTitle, { color: themeColors.textSecondary }]}>{t("dashboard.currentMentorOfMonth")}</Text>
                </View>
                {currentMonthLeader ? (
                  <>
                    <Text style={[styles.momAdminName, { color: themeColors.text }]}>{t("dashboard.currentCandidate").replace("{0}", currentMonthLeader.mentor.name ?? "")}</Text>
                    <Text style={[styles.momAdminSub, { color: themeColors.textSecondary, fontSize: 11, marginTop: 2 }]}>{t("dashboard.candidateNote")}</Text>
                  </>
                ) : (
                  <Text style={[styles.momAdminName, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("dashboard.noSessionsThisMonth")}</Text>
                )}
              </View>
            )}
            {mentorOfMonthVisible && topMentor && (
              <BNMPressable style={styles.momAdminCard} onPress={() => { if (Platform.OS === "web") { setSelectedMentorId(topMentor.mentor.id); } else { router.push({ pathname: "/mentor/[id]", params: { id: topMentor.mentor.id } }); } }} accessibilityRole="button" accessibilityLabel={`Mentor des Monats: ${topMentor.mentor.name}`}>
                <View style={styles.momAdminHeader}>
                  <Text style={styles.momAdminStar}>★</Text>
                  <Text style={[styles.momAdminTitle, { color: themeColors.textSecondary }]}>
                    {`${t("dashboard.currentMentorOfMonth")}: ${["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"][topMentor.prevMonth]} ${topMentor.prevMonthYear}`}
                  </Text>
                </View>
                <Text style={[styles.momAdminName, { color: themeColors.text }]}>{topMentor.mentor.name}</Text>
                <View style={styles.momAdminStatsRow}>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}><Text style={styles.momAdminStatValue}>{topMentor.score}</Text><Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.points")}</Text></View>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}><Text style={styles.momAdminStatValue}>{topMentor.completedCount}</Text><Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.completions")}</Text></View>
                  <View style={[styles.momAdminStat, { backgroundColor: themeColors.card }]}><Text style={styles.momAdminStatValue}>{topMentor.sessionCount}</Text><Text style={[styles.momAdminStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.sessions")}</Text></View>
                </View>
                <Text style={styles.momAdminArrow}>{t("dashboard.viewProfile")} ›</Text>
                <BNMPressable style={[styles.momAwardButton, { marginTop: 10 }]} onPress={(e) => { e.stopPropagation && e.stopPropagation(); router.push({ pathname: "/admin/mentor-award" as any, params: { mentorId: topMentor.mentor.id } }); }} activeOpacity={0.8} accessibilityRole="link" accessibilityLabel="Auszeichnung erstellen">
                  <Text style={styles.momAwardButtonText}>{t("dashboard.createAward")} ›</Text>
                </BNMPressable>
              </BNMPressable>
            )}

            {/* ── Überfällige Betreuungen (>12 Wochen) ── */}
            {overdueMentorships.length > 0 && (
              <View style={[styles.warningBox, { backgroundColor: isDark ? "#2a1a1a" : COLORS.errorBg, borderColor: isDark ? "#4a2a2a" : COLORS.errorBorderLight, borderLeftColor: COLORS.error }]}>
                <View style={styles.warningHeader}>
                  <Text style={[styles.warningTitle, { color: isDark ? "#fca5a5" : COLORS.error }]}>Überfällige Betreuungen</Text>
                  <View style={[styles.warningBadge, { backgroundColor: COLORS.error }]}><Text style={[styles.warningBadgeText, { color: COLORS.white }]}>{overdueMentorships.length}</Text></View>
                </View>
                {overdueMentorships.map((item, idx) => {
                  const isLast = idx === overdueMentorships.length - 1;
                  return (
                    <BNMPressable key={item.mentorship.id} style={[styles.warningRow, !isLast && [styles.warningRowBorder, { borderBottomColor: isDark ? "#4a2a2a" : COLORS.errorBorderLight }]]} onPress={() => router.push({ pathname: "/mentorship/[id]", params: { id: item.mentorship.id } })} accessibilityRole="link" accessibilityLabel={`Überfällig: ${item.mentorship.mentor?.name} → ${item.mentorship.mentee?.name}`}>
                      <View style={[styles.warningDot, { backgroundColor: COLORS.error }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.warningName, { color: themeColors.text }]}>{item.mentorship.mentor?.name ?? "?"} → {item.mentorship.mentee?.name ?? "?"}</Text>
                      </View>
                      <Text style={[styles.warningDays, { color: COLORS.error }]}>{item.weeks} Wo.</Text>
                      <Text style={[styles.warningArrow, { color: themeColors.textSecondary }]}>›</Text>
                    </BNMPressable>
                  );
                })}
              </View>
            )}

            {/* ── Betreuungs-Warnungen (volle Breite) ── */}
            {allWarnings.length > 0 && (
              <View style={[styles.warningBox, { backgroundColor: isDark ? "#1a1a2a" : "#fff8f0", borderColor: isDark ? "#2a2a3a" : "#fed7aa", borderLeftColor: isDark ? "#FFCA28" : "#f59e0b" }]}>
                <View style={styles.warningHeader}>
                  <Text style={[styles.warningTitle, { color: isDark ? "#FFCA28" : "#92400e" }]}>{t("earlyWarning.title")}</Text>
                  <View style={[styles.warningBadge, { backgroundColor: isDark ? "#FFCA28" : "#f59e0b" }]}><Text style={[styles.warningBadgeText, { color: "#0E0E14" }]}>{allWarnings.length}</Text></View>
                </View>
                {allWarnings.map((w, idx) => {
                  const typeLabel = w.type === "feedback" ? t("earlyWarning.negativeFeedback") : w.type === "discrepancy" ? t("earlyWarning.discrepancy") : (w.mentorGender === "female" ? t("earlyWarning.inactiveFemale") : t("earlyWarning.inactive"));
                  const dotColor = w.type === "feedback" ? COLORS.error : w.type === "discrepancy" ? "#f59e0b" : "#3b82f6";
                  const isInactive = w.type === "inactive";
                  const isSending = sendingReminderFor === w.mentorshipId;
                  const isSent = hasSentReminder(w.mentorshipId);
                  const isLast = idx === allWarnings.length - 1;
                  return (
                    <BNMPressable key={`${w.type}-${w.mentorshipId}-${idx}`} style={[styles.warningRow, !isLast && [styles.warningRowBorder, { borderBottomColor: isDark ? "#2a2a3a" : "#fed7aa" }]]} onPress={() => { if (w.mentorshipId) router.push({ pathname: "/mentorship/[id]", params: { id: w.mentorshipId } }); }} accessibilityRole="link" accessibilityLabel={`Warnung: ${w.label}`}>
                      <View style={[styles.warningDot, { backgroundColor: dotColor }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.warningLabel, { color: isDark ? (dotColor === "#3b82f6" ? "#93c5fd" : dotColor === COLORS.error ? "#fca5a5" : "#fcd34d") : dotColor }]}>{typeLabel}</Text>
                        <Text style={[styles.warningName, { color: themeColors.text }]}>{w.label}</Text>
                      </View>
                      {w.daysSince !== undefined && <Text style={[styles.warningDays, { color: themeColors.textSecondary }]}>{t("earlyWarning.daysAgo").replace("{0}", String(w.daysSince))}</Text>}
                      {isInactive && (
                        <BNMPressable style={[styles.reminderBtn, (isSending || isSent) ? { opacity: 0.5, backgroundColor: "#6B7280" } : {}]} onPress={(e) => { e.stopPropagation && e.stopPropagation(); if (!isSent) handleSendReminder(w.mentorshipId, w.mentorName, w.menteeName); }} disabled={isSending || isSent} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Erinnerung senden">
                          <Ionicons name={isSent ? "checkmark-outline" : "notifications-outline"} size={13} color={COLORS.white} />
                        </BNMPressable>
                      )}
                      {!isInactive && <Text style={[styles.warningArrow, { color: themeColors.textSecondary }]}>›</Text>}
                    </BNMPressable>
                  );
                })}
              </View>
            )}

            {/* ── Row 2: Aktivitäten-Log (links) + XP-Übersicht (rechts) ── */}
            <DashboardRow>
            <View style={[styles.card, styles.dashCol, { backgroundColor: themeColors.card, marginBottom: 0 }]}>
              <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 4 }]}>{t("dashboard.recentActivity")}</Text>
              <Text style={[styles.tertiaryXs, { color: themeColors.textTertiary, marginBottom: 10 }]}>{t("dashboard.recentActivitySub")}</Text>

              {/* Filter Chips: Typ */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }}>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  {([
                    { key: "all" as const, label: "Alle" },
                    { key: "sessions" as const, label: "Sessions" },
                    { key: "assignments" as const, label: "Zuweisungen" },
                    { key: "completions" as const, label: "Abschlüsse" },
                    { key: "feedback" as const, label: "Feedback" },
                  ]).map((chip) => {
                    const isActive = activityFilter === chip.key;
                    return (
                      <BNMPressable
                        key={chip.key}
                        onPress={() => { setActivityFilter(chip.key); setActivityLimit(20); }}
                        style={[
                          styles.activityChip,
                          { backgroundColor: isActive ? COLORS.gold + "20" : themeColors.card, borderColor: isActive ? COLORS.gold : themeColors.border },
                        ]}
                        accessibilityRole="button"
                        accessibilityLabel={chip.label}
                      >
                        <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "500", color: isActive ? COLORS.gold : themeColors.textSecondary }}>
                          {chip.label}
                        </Text>
                      </BNMPressable>
                    );
                  })}
                </View>
              </ScrollView>

              {/* Filter Chips: Zeitraum */}
              <View style={{ flexDirection: "row", gap: 6, marginBottom: 10 }}>
                {([
                  { key: "7d" as const, label: "7 Tage" },
                  { key: "30d" as const, label: "30 Tage" },
                  { key: "all" as const, label: "Alles" },
                ]).map((chip) => {
                  const isActive = activityDateRange === chip.key;
                  return (
                    <BNMPressable
                      key={chip.key}
                      onPress={() => { setActivityDateRange(chip.key); setActivityLimit(20); }}
                      style={[
                        styles.activityChip,
                        { backgroundColor: isActive ? COLORS.gradientStart + "18" : themeColors.card, borderColor: isActive ? COLORS.gradientStart : themeColors.border },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={chip.label}
                    >
                      <Text style={{ fontSize: 12, fontWeight: isActive ? "700" : "500", color: isActive ? COLORS.gradientStart : themeColors.textSecondary }}>
                        {chip.label}
                      </Text>
                    </BNMPressable>
                  );
                })}
              </View>

              {/* Activity List */}
              {visibleActivities.length === 0 ? (
                <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("dashboard.noRecentActivity")}</Text>
              ) : (
                visibleActivities.map((activity, idx) => {
                  const isLast = idx === visibleActivities.length - 1;
                  return (
                    <View key={activity.id} style={[styles.activityRow, isLast ? {} : [styles.activityRowBorder, { borderBottomColor: themeColors.border }]]}>
                      <View style={[styles.activityIconCircle, { backgroundColor: activity.color + "18" }]}>
                        <Ionicons name={activity.icon} size={14} color={activity.color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.activityTitle, { color: themeColors.text }]} numberOfLines={2}>{activity.description}</Text>
                      </View>
                      <Text style={[styles.activityDate, { color: themeColors.textTertiary }]}>
                        {activity.timestamp.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
                      </Text>
                    </View>
                  );
                })
              )}

              {/* Show More / Show Less */}
              {filteredActivities.length > activityLimit && (
                <BNMPressable onPress={() => setActivityLimit((v) => v + 20)} style={{ paddingTop: 10, alignItems: "center" }} accessibilityRole="button" accessibilityLabel="Mehr anzeigen">
                  <Text style={{ color: themeColors.accent, fontSize: 13, fontWeight: "600" }}>
                    Mehr anzeigen ({filteredActivities.length - activityLimit} weitere)
                  </Text>
                </BNMPressable>
              )}
              {activityLimit > 20 && (
                <BNMPressable onPress={() => setActivityLimit(20)} style={{ paddingTop: 6, alignItems: "center" }} accessibilityRole="button" accessibilityLabel="Weniger anzeigen">
                  <Text style={{ color: themeColors.textTertiary, fontSize: 12, fontWeight: "500" }}>
                    Weniger anzeigen
                  </Text>
                </BNMPressable>
              )}
            </View>

            {/* XP-System Übersicht (Admin) */}
            <View style={[styles.card, styles.dashCol, { backgroundColor: themeColors.card, marginBottom: 0 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.gold + "18", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="trophy" size={18} color={COLORS.gold} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 0 }]}>{t("xpOverview.title")}</Text>
                  <Text style={{ color: themeColors.textTertiary, fontSize: 11, marginTop: 1 }}>{t("xpOverview.levels")}</Text>
                </View>
              </View>

              {/* Level-Leiter — Gradient-Style Badges */}
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 20 }}>
                {LEVELS.map((lvl, i) => (
                  <View key={lvl.key} style={{
                    flex: 1,
                    backgroundColor: isDark ? lvl.color + "10" : lvl.color + "08",
                    borderRadius: RADIUS.md,
                    padding: 12,
                    alignItems: "center",
                    borderWidth: 1.5,
                    borderColor: lvl.color + "30",
                  }}>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 20,
                      backgroundColor: lvl.color + "20",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 8,
                      shadowColor: lvl.color,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.3,
                      shadowRadius: 8,
                    }}>
                      <Text style={{ fontSize: 18 }}>{i === 0 ? "🥉" : i === 1 ? "🥈" : i === 2 ? "🥇" : "💎"}</Text>
                    </View>
                    <Text style={{ color: lvl.color, fontSize: 12, fontWeight: "800" }}>{lvl.label.replace("-Mentor", "")}</Text>
                    <Text style={{ color: themeColors.textTertiary, fontSize: 10, marginTop: 3, fontWeight: "600" }}>{lvl.minXP}+ XP</Text>
                  </View>
                ))}
              </View>

              {/* Trennlinie */}
              <View style={{ height: 1, backgroundColor: themeColors.border, marginBottom: 16 }} />

              {/* XP-Aktionen Tabelle */}
              <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: "700", marginBottom: 10, letterSpacing: 0.3 }}>{t("xpOverview.actions")}</Text>
              {[
                { label: t("xpOverview.sessionDoc"), xp: XP_VALUES.SESSION_DOCUMENTED, icon: "document-text-outline" as const },
                { label: t("xpOverview.completion"), xp: XP_VALUES.MENTORSHIP_COMPLETED, icon: "checkmark-done-outline" as const },
                { label: t("xpOverview.feedback5"), xp: XP_VALUES.FEEDBACK_5STAR, icon: "star-outline" as const },
                { label: t("xpOverview.feedback4"), xp: XP_VALUES.FEEDBACK_4STAR, icon: "star-half-outline" as const },
                { label: t("xpOverview.streak"), xp: XP_VALUES.STREAK_DAY, icon: "flame-outline" as const },
                { label: t("xpOverview.thanks"), xp: XP_VALUES.THANK_RECEIVED, icon: "heart-outline" as const },
              ].map((item, i) => (
                <View key={i} style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  borderBottomWidth: i < 5 ? 1 : 0,
                  borderBottomColor: themeColors.border,
                  gap: 12,
                }}>
                  <View style={{
                    width: 30,
                    height: 30,
                    borderRadius: RADIUS.sm,
                    backgroundColor: isDark ? themeColors.surface : themeColors.statItem,
                    alignItems: "center",
                    justifyContent: "center",
                  }}>
                    <Ionicons name={item.icon} size={15} color={themeColors.textSecondary} />
                  </View>
                  <Text style={{ flex: 1, color: themeColors.text, fontSize: 13, fontWeight: "500" }}>{item.label}</Text>
                  <View style={{
                    backgroundColor: item.xp >= 100 ? COLORS.gold + "25" : COLORS.gold + "15",
                    borderRadius: RADIUS.sm,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                  }}>
                    <Text style={{
                      color: COLORS.gold,
                      fontSize: 12,
                      fontWeight: "800",
                    }}>+{item.xp} XP</Text>
                  </View>
                </View>
              ))}
            </View>
            </DashboardRow>

            {/* Balkendiagramm + Matching-Info (Row) */}
            <DashboardRow>
            <View style={[styles.dashCol, { marginBottom: 0 }]}>
              <MonthlyChart mentorships={mentorships} />
            </View>
            <View style={[styles.card, styles.dashCol, { backgroundColor: themeColors.card, marginBottom: 0 }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <View style={{ width: 36, height: 36, borderRadius: RADIUS.md, backgroundColor: COLORS.gradientStart + "18", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="git-compare-outline" size={18} color={COLORS.gradientStart} />
                </View>
                <View>
                  <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 0 }]}>{t("matchingOverview.title")}</Text>
                  <Text style={{ color: themeColors.textTertiary, fontSize: 11, marginTop: 1 }}>{t("matchingOverview.subtitle")}</Text>
                </View>
              </View>

              {/* Scoring-Tabelle */}
              {[
                { label: t("matchingOverview.distance"), max: "40", icon: "location-outline" as const, desc: "≤5km=40 · ≤15km=30 · ≤25km=20 · ≤50km=10" },
                { label: t("matchingOverview.age"), max: "15", icon: "people-outline" as const, desc: "±3J=15 · ±7J=10 · ±12J=5" },
                { label: t("matchingOverview.gender"), max: "—", icon: "male-female-outline" as const, desc: t("matchingOverview.genderMust") },
              ].map((item, i) => (
                <View key={i} style={{
                  flexDirection: "row", alignItems: "center", paddingVertical: 10,
                  borderBottomWidth: i < 2 ? 1 : 0, borderBottomColor: themeColors.border, gap: 12,
                }}>
                  <View style={{ width: 30, height: 30, borderRadius: RADIUS.sm, backgroundColor: isDark ? themeColors.surface : themeColors.statItem, alignItems: "center", justifyContent: "center" }}>
                    <Ionicons name={item.icon} size={15} color={themeColors.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: themeColors.text, fontSize: 13, fontWeight: "600" }}>{item.label}</Text>
                    <Text style={{ color: themeColors.textTertiary, fontSize: 10, marginTop: 2 }}>{item.desc}</Text>
                  </View>
                  {item.max !== "—" && (
                    <View style={{ backgroundColor: COLORS.gradientStart + "15", borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 4 }}>
                      <Text style={{ color: isDark ? "#42A5F5" : COLORS.gradientStart, fontSize: 12, fontWeight: "800" }}>max {item.max}</Text>
                    </View>
                  )}
                </View>
              ))}

              {/* Formel */}
              <View style={{ marginTop: 12, backgroundColor: isDark ? themeColors.surface : themeColors.statItem, borderRadius: RADIUS.sm, padding: 12 }}>
                <Text style={{ color: themeColors.textSecondary, fontSize: 11, fontWeight: "600", textAlign: "center" }}>
                  {t("matchingOverview.formula")}
                </Text>
                <Text style={{ color: themeColors.accent, fontSize: 13, fontWeight: "800", textAlign: "center", marginTop: 4 }}>
                  Match% = Punkte / 55 × 100
                </Text>
              </View>
            </View>
            </DashboardRow>

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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipsByMentorId, sessions, users, hadithe, feedback, refreshData, sessionTypes, isLoading, resources, eventParticipations, toggleEventParticipation, getEventParticipationsByResourceId, getMyEventParticipation, isResourceCompleted, toggleResourceCompletion, calendarEvents, eventAttendees, respondToEvent } = useData();
  const { xpLog, userAchievements, thanks, streak } = useGamification();
  const [refreshing, setRefreshing] = useState(false);
  const [hadithOffset, setHadithOffset] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Kein auto-refresh bei Tab-Focus — Realtime-Subscriptions halten Daten aktuell.
  // Pull-to-Refresh (onRefresh) bleibt für manuelles Aktualisieren.

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

  // XP-basiertes Level-System — frische Daten aus DataContext (nicht Auth-Cache)
  const freshUser = users.find((u) => u.id === user?.id);
  const myXP = (freshUser?.total_xp ?? user?.total_xp ?? 0) as number;
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

  // Nächste 3 Kalender-Termine (sichtbar für Mentor-Rolle + Geschlecht)
  const upcomingEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((e) => {
        if (!e.is_active) return false;
        if (new Date(e.start_at) <= now) return false;
        // Sichtbarkeits-Filter
        if (e.visible_to === "mentees") return false;
        if (e.visible_to === "male" && user?.gender !== "male") return false;
        if (e.visible_to === "female" && user?.gender !== "female") return false;
        return true;
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 3);
  }, [calendarEvents, user]);

  if (isLoading) return <SkeletonDashboard />;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* ── Greeting (zentriert wie Mentee) ────────────────────────── */}
        <View style={[styles.mentorGreetingRow, { justifyContent: "center", alignItems: "center" }]}>
          <View style={{ alignItems: "center" }}>
            <Text style={[styles.mentorGreetingLabel, { color: isDark ? COLORS.gold : COLORS.gradientStart, textAlign: "center" }]}>
              WILLKOMMEN
            </Text>
            <Text style={[styles.mentorGreetingName, { color: themeColors.text, textAlign: "center" }]}>{user.name}</Text>
            <Text style={[styles.mentorGreetingMeta, { color: themeColors.textSecondary, textAlign: "center" }]}>
              {user.city} · {user.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
            </Text>
          </View>
        </View>

        {/* ── Motivation des Tages (direkt unter Namen) ── */}
        {todayHadith && (
          <View style={[styles.mentorHadithCard, { borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
            <View style={styles.hadithCardHeader}>
              <Ionicons name="star" size={16} color={COLORS.gold} />
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
              <BNMPressable style={styles.motivationNextBtn} onPress={() => setHadithOffset((prev) => prev + 1)} accessibilityRole="button" accessibilityLabel="Naechster Hadith">
                <Text style={styles.motivationNextText} numberOfLines={1}>{t("motivation.next")}</Text>
              </BNMPressable>
              <BNMPressable style={[styles.motivationShareBtn, { backgroundColor: isDark ? themeColors.elevated : "#e8eaf6", padding: 9, borderRadius: RADIUS.sm }]} onPress={() => { const shareText = todayHadith.text_ar ? `${todayHadith.text_ar}\n\n${todayHadith.text_de}` : todayHadith.text_de; const shareSuffix = todayHadith.source ? `— ${t("motivation.source")}: ${todayHadith.source} | BNM` : t("share.suffix"); shareHadith(shareText, shareSuffix); }} accessibilityRole="button" accessibilityLabel="Hadith teilen">
                <Ionicons name="share-outline" size={16} color={COLORS.gold} />
              </BNMPressable>
            </View>
          </View>
        )}

        {/* ── 4 KPI-Cards ── */}
        {mentorStats && (
          <>
            <KpiGrid style={{ marginBottom: 16 }}>
              <StatCard label={t("dashboard.statsActive")} value={mentorStats.active} color={COLORS.gradientStart} iconName="people-outline" highlight />
              <StatCard label={t("dashboard.statsCompleted")} value={mentorStats.completed} color={COLORS.cta} iconName="checkmark-circle-outline" />
              <StatCard label={t("dashboard.statsSessions")} value={mentorStats.totalSessions} color={COLORS.gold} iconName="document-text-outline" />
              <StatCard label={t("dashboard.statsRank")} value={mentorStats.rank} color={SEMANTIC.indigo} iconName="trophy-outline" sublabel={`/ ${mentorStats.totalMentors}`} />
            </KpiGrid>

            {/* ── Vernachlässigte Mentees (volle Breite) ─────── */}
            {neglectedMentees.length > 0 && (
              <View style={{ marginBottom: 16 }}>
                <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary }]}>
                  {t("mentor.neglectedSection")}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {neglectedMentees.map((item) => {
                  const menteeName = item.mentorship.mentee?.name ?? "?";
                  const isUrgent = item.daysSince > 10;
                  const bgColor = isUrgent
                    ? (sem(SEMANTIC.redBg, isDark))
                    : (isDark ? "#3a2e0a" : "#fffbeb");
                  const borderColor = isUrgent
                    ? (sem(SEMANTIC.redBorder, isDark))
                    : (sem(SEMANTIC.amberBorder, isDark));
                  const borderLeftColor = isUrgent
                    ? (sem(SEMANTIC.redText, isDark))
                    : (isDark ? "#fbbf24" : "#f59e0b");
                  const textColor = isUrgent
                    ? (sem(SEMANTIC.redTextDark, isDark))
                    : (sem(SEMANTIC.amberText, isDark));
                  const message = isUrgent
                    ? t("mentor.neglectedUrgent").replace("{0}", menteeName).replace("{1}", String(item.daysSince))
                    : t("mentor.neglectedWarning").replace("{0}", menteeName).replace("{1}", String(item.daysSince));
                  return (
                    <BNMPressable
                      key={item.mentorship.id}
                      style={[
                        styles.neglectedRow,
                        { backgroundColor: bgColor, borderColor, borderLeftColor, flex: 1, minWidth: 280 },
                      ]}
                      onPress={() => router.push({ pathname: "/mentorship/[id]", params: { id: item.mentorship.id } })}
                      activeOpacity={0.8}
                      accessibilityRole="link"
                      accessibilityLabel={`Betreuung von ${item.mentorship.mentee?.name ?? "Mentee"} anzeigen`}
                    >
                      <Ionicons
                        name={isUrgent ? "warning-outline" : "time-outline"}
                        size={16}
                        color={borderLeftColor}
                        style={{ marginRight: 8 }}
                      />
                      <Text style={[styles.neglectedText, { color: textColor, flex: 1, fontSize: 12 }]}>{message}</Text>
                      <Text style={[styles.neglectedArrow, { color: textColor }]}>›</Text>
                    </BNMPressable>
                  );
                })}
                </View>
              </View>
            )}

            {/* ── Row: Gamification + Achievements ──────────────────── */}
            <DashboardRow>
            <View style={[styles.levelCard, styles.dashCol, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark), marginBottom: 0 }]}>
              {/* Level-Badge + XP-Zähler */}
              <View style={styles.levelHeaderRow}>
                <View style={styles.levelBadgeRow}>
                  <View style={[styles.levelBadge, { backgroundColor: currentLevel.color + "22", borderColor: currentLevel.color }]}>
                    <Text style={[styles.levelBadgeText, { color: currentLevel.color }]}>
                      {t(`level.${currentLevel.key}` as any)}
                    </Text>
                  </View>
                </View>
                <View style={[styles.levelScoreBadge, { backgroundColor: sem(SEMANTIC.goldBg, isDark) }]}>
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

            {/* ── Achievements (Grid 2x4) ── */}
            <View style={[styles.dashCol, styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark), marginBottom: 0 }]}>
              <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 10 }]}>
                {t("gamification.achievementsTitle")}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-start" }}>
                {ACHIEVEMENTS.map((ach) => {
                  const isUnlocked = userAchievements.some((a) => a.achievement_key === ach.key);
                  const isMystery = (ach as any).mystery === true;
                  return (
                    <BNMPressable
                      key={ach.key}
                      style={[
                        styles.achievementChip,
                        {
                          width: "22%",
                          minWidth: 60,
                          backgroundColor: isMystery
                            ? (isDark ? "#1a1a2e" : "#f0f0f8")
                            : isUnlocked
                              ? (sem(SEMANTIC.goldBg, isDark))
                              : (isDark ? "#1A1A24" : themeColors.border + "66"),
                          borderColor: isMystery
                            ? (isDark ? "#6366f1" : "#a5b4fc")
                            : isUnlocked ? COLORS.gold : (sem(SEMANTIC.goldBorder, isDark)),
                          borderStyle: isMystery ? "dashed" : "solid",
                          opacity: isUnlocked ? 1 : isMystery ? 0.8 : 0.5,
                        },
                      ]}
                      onPress={() => setShowAchievementTooltip(showAchievementTooltip === ach.key ? null : ach.key)}
                      accessibilityRole="button"
                      accessibilityLabel={isMystery ? "Geheime Auszeichnung" : `Auszeichnung: ${ach.label}`}
                    >
                      <Text style={[styles.achievementIcon, isMystery && { fontSize: 20 }]}>{ach.icon}</Text>
                      <Text style={{ fontSize: 9, fontWeight: "600", color: isMystery ? (isDark ? "#818cf8" : "#6366f1") : isUnlocked ? (isDark ? COLORS.gold : COLORS.goldText) : themeColors.textTertiary, marginTop: 4, textAlign: "center" }} numberOfLines={1}>{ach.label}</Text>
                      {showAchievementTooltip === ach.key && (
                        <View style={[styles.achievementTooltip, { backgroundColor: isDark ? "#1C1C28" : "#FFFFFF", borderColor: isMystery ? "#6366f1" : COLORS.gold }]}>
                          <Text style={[styles.achievementTooltipTitle, { color: isMystery ? (isDark ? "#818cf8" : "#6366f1") : themeColors.text }]}>{ach.label}</Text>
                          <Text style={[styles.achievementTooltipDesc, { color: themeColors.textSecondary }]}>{ach.desc}</Text>
                          {!isUnlocked && (
                            <Text style={[styles.achievementTooltipLocked, { color: themeColors.textTertiary }]}>
                              {isMystery ? "Dieses Geheimnis wartet noch..." : t("gamification.achievementLocked")}
                            </Text>
                          )}
                        </View>
                      )}
                    </BNMPressable>
                  );
                })}
              </View>
            </View>
            </DashboardRow>

          </>
        )}

        {/* ── Row: Wirkung + Bewertungen ────────────────────────── */}
        <DashboardRow>
        <View style={styles.dashCol}>
          {/* Deine Wirkung */}
          {impactStats.total > 0 && (
            <View style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
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
          {/* Bewertungen */}
          <MentorRatingsSection
            feedbacks={myFeedbacks}
            avgRating={avgRating}
            myMentorships={myMentorships}
            router={router}
            t={t}
            themeColors={themeColors}
          isDark={isDark}
        />
        </View>
        </DashboardRow>

        {/* ── Meine Statistiken ── */}
        {mentorStats && (
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 10 }]}>
              Meine Statistiken
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {[
                { label: "Abgeschlossene\nBetreuungen", value: String(mentorStats.completed), color: COLORS.cta },
                { label: "Aktive\nBetreuungen", value: String(mentorStats.active), color: COLORS.gradientStart },
                { label: "Dokumentierte\nSessions", value: String(mentorStats.totalSessions), color: COLORS.gold },
                { label: "Durchschnittliche\nBewertung", value: avgRating !== null ? `${avgRating.toFixed(1)} ★` : "–", color: "#FFCA28" },
                { label: "Ranking-\nPosition", value: `#${mentorStats.rank}`, color: COLORS.link ?? COLORS.gradientStart },
                { label: "Gesamt-\nMentoren", value: String(mentorStats.totalMentors), color: themeColors.textSecondary },
              ].map((item, idx) => (
                <View
                  key={idx}
                  style={{
                    flex: 1,
                    minWidth: "30%",
                    backgroundColor: themeColors.card,
                    borderWidth: 1,
                    borderColor: themeColors.border,
                    borderRadius: RADIUS.sm,
                    padding: 12,
                    alignItems: "center",
                  }}
                >
                  <Text style={{ fontSize: 22, fontWeight: "bold", color: item.color }}>{item.value}</Text>
                  <Text style={{ fontSize: 10, color: themeColors.textTertiary, marginTop: 4, textAlign: "center" }}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Nächste Termine ── */}
        {upcomingEvents.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 10 }]}>
              Nächste Termine
            </Text>
            <View style={{ gap: 10 }}>
              {upcomingEvents.map((evt) => {
                const startDate = new Date(evt.start_at);
                const dateStr = startDate.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                const timeStr = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")} Uhr`;
                const typeMap: Record<string, { label: string; color: string }> = {
                  webinar: { label: "Webinar", color: COLORS.gradientStart },
                  retreat: { label: "Retreat", color: COLORS.cta },
                  kurs: { label: "Kurs", color: COLORS.gold },
                  meeting: { label: "Meeting", color: COLORS.blue },
                  custom: { label: "Termin", color: COLORS.secondary },
                };
                const typeInfo = typeMap[evt.type] ?? typeMap.custom;
                const myAttendee = eventAttendees.find((a) => a.event_id === evt.id && a.user_id === user?.id);
                const isAccepted = myAttendee?.status === "accepted";
                return (
                  <View
                    key={evt.id}
                    style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark), marginBottom: 0 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: typeInfo.color + "18" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: typeInfo.color }}>{typeInfo.label}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.text, marginBottom: 4 }}>{evt.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Ionicons name="calendar-outline" size={13} color={themeColors.textTertiary} />
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>{dateStr}, {timeStr}</Text>
                    </View>
                    {evt.location ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>{evt.location}</Text>
                      </View>
                    ) : null}
                    <BNMPressable
                      style={{
                        marginTop: 8,
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: RADIUS.sm,
                        backgroundColor: isAccepted ? COLORS.cta + "15" : COLORS.gold + "15",
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onPress={() => respondToEvent(evt.id, isAccepted ? "declined" : "accepted")}
                      accessibilityRole="button"
                      accessibilityLabel={isAccepted ? "Zusage zurücknehmen" : "Zusagen"}
                    >
                      <Ionicons name={isAccepted ? "checkmark-circle" : "checkmark-circle-outline"} size={16} color={isAccepted ? COLORS.cta : COLORS.gold} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: isAccepted ? COLORS.cta : COLORS.gold }}>
                        {isAccepted ? "Zugesagt \u2713" : "Zusagen"}
                      </Text>
                    </BNMPressable>
                  </View>
                );
              })}
            </View>
            <BNMPressable
              style={{ marginTop: 10, alignSelf: "flex-start" }}
              onPress={() => router.push("/(tabs)/calendar" as never)}
              accessibilityRole="link"
              accessibilityLabel="Alle Termine anzeigen"
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? COLORS.gold : COLORS.gradientStart }}>
                Alle Termine →
              </Text>
            </BNMPressable>
          </View>
        )}

        {/* ── Ressourcen ── */}
        {(() => {
          const now = new Date();
          const myMentorshipIds = new Set(myMentorships.map((m) => m.id));
          const mySessions = sessions.filter((s) => myMentorshipIds.has(s.mentorship_id));
          const myCompletedSessionTypeIds = new Set(mySessions.map((s) => s.session_type_id));

          const visibleResources = resources.filter((r) => {
            if (!r.is_active) return false;
            // Zeitsteuerung
            if (r.visible_until && new Date(r.visible_until) < now) return false;
            // Zielgruppe
            if (r.visible_to !== "all") {
              if (r.visible_to === "mentors" && user?.role !== "mentor") return false;
              if (r.visible_to === "mentees" && user?.role !== "mentee") return false;
              if (r.visible_to === "male" && user?.gender !== "male") return false;
              if (r.visible_to === "female" && user?.gender !== "female") return false;
            }
            // Session-Phase: nur sichtbar wenn diese Phase bereits dokumentiert wurde
            if (r.visible_after_session_type_id) {
              if (!myCompletedSessionTypeIds.has(r.visible_after_session_type_id)) return false;
            }
            return true;
          });
          return visibleResources.length > 0 ? (
          <View style={{ marginTop: 8 }}>
            <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 10 }]}>
              Ressourcen
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
              {visibleResources
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((res) => {
                  const isEvent = res.category === "event";
                  const myParticipation = isEvent ? getMyEventParticipation(res.id) : undefined;
                  const confirmedCount = isEvent
                    ? getEventParticipationsByResourceId(res.id).filter((ep) => ep.status === "confirmed").length
                    : 0;
                  const isConfirmed = myParticipation?.status === "confirmed";

                  const completed = isResourceCompleted(res.id);

                  return (
                    <BNMPressable
                      key={res.id}
                      style={[
                        styles.resourceCard,
                        { backgroundColor: themeColors.card, borderColor: completed ? COLORS.cta + "60" : sem(SEMANTIC.goldBorder, isDark) },
                        completed && { opacity: 0.75 },
                      ]}
                      onPress={() => {
                        if (isEvent) return;
                        if (Platform.OS === "web") { (window as any).open(res.url, "_blank"); }
                        else { Linking.openURL(res.url); }
                      }}
                      accessibilityRole={isEvent ? "button" : "link"}
                      accessibilityLabel={res.title}
                    >
                      <View style={[styles.resourceIconBg, { backgroundColor: completed ? COLORS.cta + "15" : COLORS.gold + "15" }]}>
                        <Ionicons name={completed ? "checkmark-circle" : (res.icon as any)} size={22} color={completed ? COLORS.cta : COLORS.gold} />
                      </View>
                      <Text style={[styles.resourceTitle, { color: themeColors.text }]} numberOfLines={2}>{res.title}</Text>
                      {res.description ? (
                        <Text style={[styles.resourceDesc, { color: themeColors.textTertiary }]} numberOfLines={2}>{res.description}</Text>
                      ) : null}

                      {/* Abhaken-Button (nicht für Events) */}
                      {!isEvent && (
                        <BNMPressable
                          style={{
                            marginTop: 8,
                            paddingVertical: 6,
                            paddingHorizontal: 12,
                            borderRadius: RADIUS.sm,
                            backgroundColor: completed ? COLORS.cta + "15" : themeColors.background,
                            borderWidth: 1,
                            borderColor: completed ? COLORS.cta + "40" : themeColors.border,
                            alignItems: "center",
                            flexDirection: "row",
                            justifyContent: "center",
                            gap: 6,
                          }}
                          onPress={() => toggleResourceCompletion(res.id)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: completed }}
                          accessibilityLabel={completed ? "Als nicht erledigt markieren" : "Als erledigt markieren"}
                        >
                          <Ionicons name={completed ? "checkmark-circle" : "ellipse-outline"} size={16} color={completed ? COLORS.cta : themeColors.textTertiary} />
                          <Text style={{ fontSize: 12, fontWeight: "600", color: completed ? COLORS.cta : themeColors.textSecondary }}>
                            {completed ? "Erledigt" : "Abhaken"}
                          </Text>
                        </BNMPressable>
                      )}

                      {isEvent && (
                        <View style={{ marginTop: 8 }}>
                          <Text style={{ fontSize: 11, color: themeColors.textTertiary, marginBottom: 6 }}>
                            {confirmedCount} Teilnehmer
                          </Text>
                          <BNMPressable
                            style={{
                              paddingVertical: 6,
                              paddingHorizontal: 12,
                              borderRadius: RADIUS.sm,
                              backgroundColor: isConfirmed ? COLORS.error + "15" : COLORS.gold + "15",
                              alignItems: "center",
                            }}
                            onPress={() => toggleEventParticipation(res.id, "confirmed")}
                            accessibilityRole="button"
                            accessibilityLabel={isConfirmed ? "Nicht teilnehmen" : "Teilnehmen"}
                          >
                            <Text style={{ fontSize: 12, fontWeight: "600", color: isConfirmed ? COLORS.error : COLORS.gold }}>
                              {isConfirmed ? "Nicht teilnehmen" : "Teilnehmen"}
                            </Text>
                          </BNMPressable>
                        </View>
                      )}
                    </BNMPressable>
                  );
                })}
            </View>
          </View>
          ) : null;
        })()}

      </View>
    </ScrollView>
    </View>
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
    <View style={[styles.ratingsCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
      {/* Header */}
      <View style={styles.ratingsSectionHeader}>
        <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 0 }]}>{t("mentor.myRatings")}</Text>
        {avgRating !== null && (
          <View style={[styles.avgRatingBadge, { backgroundColor: sem(SEMANTIC.goldBg, isDark) }]}>
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
              <BNMPressable
                key={f.id}
                style={[
                  styles.feedbackRow,
                  !isLast && [styles.feedbackRowBorder, { borderBottomColor: sem(SEMANTIC.goldBorder, isDark) }],
                ]}
                onPress={() => ms && router.push({ pathname: "/mentorship/[id]", params: { id: ms.id } })}
                accessibilityRole="link"
                accessibilityLabel={`Feedback von ${ms?.mentee?.name ?? "Mentee"} anzeigen`}
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
              </BNMPressable>
            );
          })}
          {feedbacks.length > 3 && (
            <BNMPressable
              style={styles.showMoreBtn}
              onPress={() => setShowAll((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showAll ? "Weniger Bewertungen anzeigen" : "Mehr Bewertungen anzeigen"}
                         >
              <Text style={[styles.showMoreText, { color: isDark ? COLORS.gold : COLORS.gradientStart }]}>
                {showAll ? "Weniger anzeigen" : t("mentor.showMoreFeedback")}
              </Text>
            </BNMPressable>
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
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipByMenteeId, getCompletedStepIds, sessionTypes, hadithe, refreshData, isLoading, calendarEvents, eventAttendees, respondToEvent, feedback, updateMenteeNotes, resources } = useData();
  const { sendThanks } = useGamification();
  const [refreshing, setRefreshing] = useState(false);
  const [hadithOffset, setHadithOffset] = useState(0);
  const [showThanksModal, setShowThanksModal] = useState(false);
  const [thanksMessage, setThanksMessage] = useState("");
  const [sendingThanks, setSendingThanks] = useState(false);
  const [showMentorContact, setShowMentorContact] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Mentorship für den eingeloggten Mentee (null wenn kein user)
  const mentorship = user ? getMentorshipByMenteeId(user.id) : undefined;

  // Hadith für heute — VOR early return (Hook-Regel)
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

  // Nächste 3 Kalender-Termine — VOR early return (Hook-Regel)
  const upcomingMenteeEvents = useMemo(() => {
    const now = new Date();
    return calendarEvents
      .filter((e) => {
        if (!e.is_active) return false;
        if (new Date(e.start_at) <= now) return false;
        if (e.visible_to === "mentors") return false;
        if (e.visible_to === "male" && user?.gender !== "male") return false;
        if (e.visible_to === "female" && user?.gender !== "female") return false;
        return true;
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
      .slice(0, 3);
  }, [calendarEvents, user]);

  // Einführungsvideos: Ressourcen mit category="video" die für diesen User sichtbar sind
  const introVideos = useMemo(() => {
    return resources.filter((r) => {
      if (!r.is_active || r.category !== "video") return false;
      if (r.visible_to === "mentors") return false;
      if (r.visible_to === "male" && user?.gender !== "male") return false;
      if (r.visible_to === "female" && user?.gender !== "female") return false;
      return true;
    }).sort((a, b) => a.sort_order - b.sort_order);
  }, [resources, user]);

  // ── Ab hier: kein Hook mehr ──────────────────────────────────────────────────

  if (!user) return null;
  if (isLoading) return <SkeletonDashboard />;

  // Anzahl Tage seit Start der Betreuung
  const daysSinceStart = mentorship?.assigned_at
    ? Math.max(0, Math.floor((Date.now() - new Date(mentorship.assigned_at).getTime()) / 86400000))
    : null;

  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);
  const allDone = sessionTypes.length > 0 && completedStepIds.length === sessionTypes.length;
  const progressPercent = sessionTypes.length > 0
    ? Math.round((completedStepIds.length / sessionTypes.length) * 100)
    : 0;

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
              HALLO
            </Text>
            <Text style={[styles.mentorGreetingName, { color: themeColors.text, textAlign: "center" }]}>{user.name}</Text>
          </View>
        </View>

        {/* ── Motivation des Tages (direkt unter Greeting) ── */}
        {todayHadith && (
          <View style={[styles.menteeHadithBigCard, { backgroundColor: isDark ? "#1A1A2E" : "#f0f4ff", borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
            <View style={styles.hadithCardHeader}>
              <Ionicons name="star" size={18} color={COLORS.gold} />
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
              <BNMPressable style={[styles.motivationNextBtn, { paddingHorizontal: 20, paddingVertical: 10 }]} onPress={() => setHadithOffset((prev) => prev + 1)} accessibilityRole="button" accessibilityLabel="Naechster Hadith">
                <Text style={[styles.motivationNextText, { fontSize: 14 }]} numberOfLines={1}>{t("motivation.next")}</Text>
              </BNMPressable>
              <BNMPressable style={{ padding: 9, borderRadius: RADIUS.sm, backgroundColor: isDark ? themeColors.elevated : "#e8eaf6" }} onPress={() => { const shareText = todayHadith.text_ar ? `${todayHadith.text_ar}\n\n${todayHadith.text_de}` : todayHadith.text_de; const shareSuffix = todayHadith.source ? `— ${t("motivation.source")}: ${todayHadith.source} | BNM` : t("share.suffix"); shareHadith(shareText, shareSuffix); }} accessibilityRole="button" accessibilityLabel="Hadith teilen">
                <Ionicons name="share-outline" size={16} color={COLORS.gold} />
              </BNMPressable>
            </View>
          </View>
        )}

        {/* ── Einführungsvideos (immer sichtbar für Mentees) ── */}
        {introVideos.length > 0 && (
          <View style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Ionicons name="play-circle-outline" size={20} color={COLORS.gold} />
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textTertiary, letterSpacing: 0.8, textTransform: "uppercase" }}>
                Einführungsvideos
              </Text>
            </View>
            <View style={{ gap: 10 }}>
              {introVideos.map((video) => (
                <BNMPressable
                  key={video.id}
                  style={{ flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: isDark ? "#1A1A24" : themeColors.background, borderRadius: RADIUS.sm, padding: 12, borderWidth: 1, borderColor: sem(SEMANTIC.darkBorder, isDark) }}
                  onPress={() => {
                    if (Platform.OS === "web") { (window as any).open(video.url, "_blank"); }
                    else { Linking.openURL(video.url); }
                  }}
                  accessibilityRole="link"
                  accessibilityLabel={video.title}
                >
                  <View style={{ width: 44, height: 44, borderRadius: RADIUS.sm, backgroundColor: COLORS.gradientStart + "18", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Ionicons name="play-circle" size={26} color={COLORS.gradientStart} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, fontWeight: "600", color: themeColors.text }} numberOfLines={2}>{video.title}</Text>
                    {video.description ? (
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }} numberOfLines={2}>{video.description}</Text>
                    ) : null}
                  </View>
                  <Ionicons name="chevron-forward-outline" size={16} color={themeColors.textTertiary} />
                </BNMPressable>
              ))}
            </View>
          </View>
        )}

        {mentorship ? (
          <>
            {/* ── KPI-Cards (zentriert) ── */}
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
                  color={SEMANTIC.indigo}
                  iconName="calendar-outline"
                />
              )}
            </KpiGrid>

            {/* ── Schritte-Fortschritt (volle Breite) ── */}
            <View style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textTertiary, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 10 }}>
                {t("menteeProgress.title")}
              </Text>
              <View style={{ height: 8, borderRadius: 4, backgroundColor: isDark ? themeColors.surface : themeColors.border, overflow: "hidden", marginBottom: 12 }}>
                <View style={{ height: "100%", width: `${progressPercent}%` as any, backgroundColor: allDone ? COLORS.cta : COLORS.gold, borderRadius: 4 }} />
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {sortedSessionTypes.map((st) => {
                  const done = completedStepIds.includes(st.id);
                  return (
                    <View key={st.id} style={{
                      paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.sm,
                      backgroundColor: done ? (isDark ? COLORS.cta + "20" : "#dcfce7") : (isDark ? "#1A1A24" : "#f5f5f7"),
                      borderWidth: 1,
                      borderColor: done ? (isDark ? COLORS.cta + "40" : "#86efac") : sem(SEMANTIC.darkBorder, isDark),
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: "600", color: done ? sem(SEMANTIC.greenText, isDark) : themeColors.textTertiary }}>
                        {done ? "✓ " : ""}{st.name}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* ── Danke sagen ── */}
            {mentorship.status === "active" && mentorship.mentor_id && (
              <BNMPressable
                style={[styles.thankButton, { backgroundColor: sem(SEMANTIC.greenBg, isDark), borderColor: sem(SEMANTIC.greenBorder, isDark) }]}
                onPress={() => setShowThanksModal(true)}
                accessibilityRole="button"
                accessibilityLabel="Danke sagen"
                             >
                <Text style={styles.thankButtonText}>{t("gamification.thankButton")}</Text>
              </BNMPressable>
            )}

            {/* ── Mentor-Kontakt-Karte (immer sichtbar wenn Mentorship existiert) ── */}
            {mentorship.mentor && (
              <BNMPressable
                style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark), flexDirection: "row", alignItems: "center", gap: 12 }]}
                onPress={() => setShowMentorContact(true)}
                accessibilityRole="button"
                accessibilityLabel="Mentor Kontaktdaten anzeigen"
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gradientStart + "18", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="person-outline" size={20} color={COLORS.gradientStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: themeColors.textTertiary, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>{mentorship.mentor?.gender === "female" ? "Meine Mentorin" : "Mein Mentor"}</Text>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.text }}>{mentorship.mentor.name}</Text>
                  {mentorship.mentor.city ? <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>{mentorship.mentor.city}</Text> : null}
                </View>
                <Ionicons name="chevron-forward-outline" size={18} color={themeColors.textTertiary} />
              </BNMPressable>
            )}

            {/* ── Feedback-Button (bei abgeschlossener/abgebrochener Betreuung ohne Feedback) ── */}
            {(mentorship.status === "completed" || mentorship.status === "cancelled") &&
              !feedback.some((f) => f.mentorship_id === mentorship.id && f.submitted_by === user.id) && (
              <BNMPressable
                style={[styles.levelCard, { backgroundColor: COLORS.gold + "12", borderColor: COLORS.gold + "50", flexDirection: "row", alignItems: "center", gap: 12 }]}
                onPress={() => router.push({ pathname: "/feedback", params: { mentorshipId: mentorship.id } } as never)}
                accessibilityRole="button"
                accessibilityLabel="Feedback zur Betreuung geben"
              >
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.gold + "20", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="star-outline" size={20} color={COLORS.gold} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.gold, letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 2 }}>Feedback ausstehend</Text>
                  <Text style={{ fontSize: 14, fontWeight: "600", color: themeColors.text }}>Jetzt Feedback geben →</Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Hilf uns das Programm zu verbessern</Text>
                </View>
              </BNMPressable>
            )}

            {/* ── Glückwunsch-Banner + Confetti (ganz unten) ── */}
            {(mentorship.status === "active" || mentorship.status === "completed") && allDone && (
              <>
                <Confetti />
                <View style={[styles.congratsBanner, { backgroundColor: isDark ? themeColors.successLight : "#dcfce7", borderColor: sem(SEMANTIC.greenBorder, isDark) }]}>
                  <Ionicons name="ribbon-outline" size={28} color={isDark ? themeColors.success : "#15803d"} style={{ marginBottom: 4 }} />
                  <Text style={[styles.congratsTitle, { color: isDark ? themeColors.success : "#15803d" }]}>{t("mentorship.congratulations")}</Text>
                  <Text style={[styles.congratsText, { color: isDark ? themeColors.success : "#16a34a" }]}>{t("mentorship.allStepsDone")}</Text>
                </View>
              </>
            )}

            {/* Mentor-Kontakt-Modal */}
            <Modal visible={showMentorContact} transparent animationType="fade" onRequestClose={() => setShowMentorContact(false)}>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <Text style={[styles.modalTitle, { color: themeColors.text, marginBottom: 0 }]}>Mein Mentor</Text>
                    <BNMPressable onPress={() => setShowMentorContact(false)} accessibilityRole="button" accessibilityLabel="Schließen">
                      <Ionicons name="close-outline" size={24} color={themeColors.textTertiary} />
                    </BNMPressable>
                  </View>
                  {mentorship?.mentor && (
                    <View style={{ gap: 10 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.gradientStart + "18", alignItems: "center", justifyContent: "center" }}>
                          <Ionicons name="person-outline" size={24} color={COLORS.gradientStart} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 17, fontWeight: "700", color: themeColors.text }}>{mentorship.mentor.name}</Text>
                          {mentorship.mentor.city ? <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>{mentorship.mentor.city}</Text> : null}
                        </View>
                      </View>
                      <View style={{ height: 1, backgroundColor: sem(SEMANTIC.darkBorder, isDark), marginVertical: 4 }} />
                      {mentorship.mentor.email ? (
                        <BNMPressable style={{ flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => Linking.openURL(`mailto:${mentorship.mentor!.email}`)} accessibilityRole="link" accessibilityLabel="E-Mail schreiben">
                          <Ionicons name="mail-outline" size={18} color={COLORS.gradientStart} />
                          <Text style={{ fontSize: 14, color: COLORS.gradientStart }}>{mentorship.mentor.email}</Text>
                        </BNMPressable>
                      ) : null}
                      {mentorship.mentor.phone ? (
                        <BNMPressable style={{ flexDirection: "row", alignItems: "center", gap: 10 }} onPress={() => Linking.openURL(`tel:${mentorship.mentor!.phone}`)} accessibilityRole="link" accessibilityLabel="Anrufen">
                          <Ionicons name="call-outline" size={18} color={COLORS.gradientStart} />
                          <Text style={{ fontSize: 14, color: COLORS.gradientStart }}>{mentorship.mentor.phone}</Text>
                        </BNMPressable>
                      ) : null}
                      {mentorship.mentor.contact_preference && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                          <Ionicons name="chatbubble-outline" size={18} color={themeColors.textTertiary} />
                          <Text style={{ fontSize: 13, color: themeColors.textSecondary }}>
                            Bevorzugter Kontakt:{" "}
                            <Text style={{ fontWeight: "600", color: themeColors.text }}>
                              {{ phone: "Telefon", whatsapp: "WhatsApp", telegram: "Telegram", email: "E-Mail" }[mentorship.mentor.contact_preference] ?? mentorship.mentor.contact_preference}
                            </Text>
                          </Text>
                        </View>
                      )}
                    </View>
                  )}
                  <BNMPressable style={[styles.modalConfirmBtn, { marginTop: 16 }]} onPress={() => setShowMentorContact(false)} accessibilityRole="button" accessibilityLabel="Schließen">
                    <Text style={styles.modalConfirmText}>Schließen</Text>
                  </BNMPressable>
                </View>
              </View>
            </Modal>

            {/* Danke-Modal (Overlay) */}
            <Modal visible={showThanksModal} transparent animationType="fade" onRequestClose={() => setShowThanksModal(false)}>
              <View style={styles.modalOverlay}>
                <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
                  <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("gamification.thankTitle")}</Text>
                  <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>{t("gamification.thankMessage")}</Text>
                  <TextInput style={[styles.thankInput, { color: themeColors.text, borderColor: sem(SEMANTIC.goldBorder, isDark), backgroundColor: isDark ? "#1A1A24" : themeColors.background }]} placeholder={t("gamification.thankMessagePlaceholder")} placeholderTextColor={themeColors.textTertiary} value={thanksMessage} onChangeText={setThanksMessage} multiline numberOfLines={3} />
                  <View style={styles.modalButtonRow}>
                    <BNMPressable style={[styles.modalCancelBtn, { borderColor: sem(SEMANTIC.goldBorder, isDark) }]} onPress={() => { setShowThanksModal(false); setThanksMessage(""); }} accessibilityRole="button" accessibilityLabel="Abbrechen">
                      <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>{t("gamification.thankCancel")}</Text>
                    </BNMPressable>
                    <BNMPressable style={[styles.modalConfirmBtn, { opacity: sendingThanks ? 0.6 : 1 }]} onPress={handleSendThanks} disabled={sendingThanks} accessibilityRole="button" accessibilityLabel="Danke senden">
                      <Text style={styles.modalConfirmText}>{t("gamification.thankSend")}</Text>
                    </BNMPressable>
                  </View>
                </View>
              </View>
            </Modal>

          </>
        ) : (
          <View style={[styles.card, { backgroundColor: themeColors.card, padding: 32, alignItems: "center", marginBottom: 16 }]}>
            <Text style={[styles.boldPrimary, { color: themeColors.text }]}>{t("dashboard.pendingAssignment")}</Text>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary, marginTop: 8 }]}>
              {t("dashboard.pendingAssignmentText")}
            </Text>
          </View>
        )}

        {/* ── Nächste Termine (Mentee) ── */}
        {upcomingMenteeEvents.length > 0 && (
          <View style={{ marginTop: 8, marginBottom: 16 }}>
            <Text style={[styles.mentorSectionTitle, { color: themeColors.textSecondary, marginBottom: 10 }]}>
              Nächste Termine
            </Text>
            <View style={{ gap: 10 }}>
              {upcomingMenteeEvents.map((evt) => {
                const startDate = new Date(evt.start_at);
                const dateStr = startDate.toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
                const timeStr = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")} Uhr`;
                const typeMap: Record<string, { label: string; color: string }> = {
                  webinar: { label: "Webinar", color: COLORS.gradientStart },
                  retreat: { label: "Retreat", color: COLORS.cta },
                  kurs: { label: "Kurs", color: COLORS.gold },
                  meeting: { label: "Meeting", color: COLORS.blue },
                  custom: { label: "Termin", color: COLORS.secondary },
                };
                const typeInfo = typeMap[evt.type] ?? typeMap.custom;
                const myAttendee = eventAttendees.find((a) => a.event_id === evt.id && a.user_id === user?.id);
                const isAccepted = myAttendee?.status === "accepted";
                return (
                  <View
                    key={evt.id}
                    style={[styles.levelCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark), marginBottom: 0 }]}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.sm, backgroundColor: typeInfo.color + "18" }}>
                        <Text style={{ fontSize: 10, fontWeight: "700", color: typeInfo.color }}>{typeInfo.label}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.text, marginBottom: 4 }}>{evt.title}</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <Ionicons name="calendar-outline" size={13} color={themeColors.textTertiary} />
                      <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>{dateStr}, {timeStr}</Text>
                    </View>
                    {evt.location ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 }}>
                        <Ionicons name="location-outline" size={13} color={themeColors.textTertiary} />
                        <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>{evt.location}</Text>
                      </View>
                    ) : null}
                    <BNMPressable
                      style={{
                        marginTop: 8,
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: RADIUS.sm,
                        backgroundColor: isAccepted ? COLORS.cta + "15" : COLORS.gold + "15",
                        alignSelf: "flex-start",
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 6,
                      }}
                      onPress={() => respondToEvent(evt.id, isAccepted ? "declined" : "accepted")}
                      accessibilityRole="button"
                      accessibilityLabel={isAccepted ? "Zusage zurücknehmen" : "Zusagen"}
                    >
                      <Ionicons name={isAccepted ? "checkmark-circle" : "checkmark-circle-outline"} size={16} color={isAccepted ? COLORS.cta : COLORS.gold} />
                      <Text style={{ fontSize: 12, fontWeight: "600", color: isAccepted ? COLORS.cta : COLORS.gold }}>
                        {isAccepted ? "Zugesagt \u2713" : "Zusagen"}
                      </Text>
                    </BNMPressable>
                  </View>
                );
              })}
            </View>
            <BNMPressable
              style={{ marginTop: 10, alignSelf: "flex-start" }}
              onPress={() => router.push("/(tabs)/calendar" as never)}
              accessibilityRole="link"
              accessibilityLabel="Alle Termine anzeigen"
            >
              <Text style={{ fontSize: 13, fontWeight: "600", color: isDark ? COLORS.gold : COLORS.gradientStart }}>
                Alle Termine →
              </Text>
            </BNMPressable>
          </View>
        )}

      </View>
    </ScrollView>
  );
}

/** 2-Spalten Row auf Desktop, single column auf Mobile */
function DashboardRow({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 900;
  const childArray = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: isDesktop ? "row" : "column", gap: 16, marginBottom: 16, alignItems: "stretch" }}>
      {childArray.map((child, idx) => (
        <View key={idx} style={isDesktop ? { flex: 1, minWidth: 0 } : undefined}>
          {child}
        </View>
      ))}
    </View>
  );
}

function KpiGrid({ children, style }: { children: React.ReactNode; style?: object }) {
  const { width } = useWindowDimensions();
  const isDesktop = Platform.OS === "web" && width > 900;
  const childArray = React.Children.toArray(children);

  if (isDesktop) {
    return (
      <View style={[{ flexDirection: "row", gap: 12 }, style]}>
        {childArray.map((child, idx) => (
          <View key={idx} style={{ flex: 1 }}>{child}</View>
        ))}
      </View>
    );
  }

  // Mobile/Tablet: explizite 2-Spalten-Reihen (zuverlässiger als flexWrap + %)
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += 2) {
    rows.push(childArray.slice(i, i + 2));
  }
  return (
    <View style={[{ gap: 12 }, style]}>
      {rows.map((row, rowIdx) => (
        <View key={rowIdx} style={{ flexDirection: "row", gap: 12 }}>
          {row.map((child, colIdx) => (
            <View key={colIdx} style={{ flex: 1 }}>{child}</View>
          ))}
        </View>
      ))}
    </View>
  );
}

// Hex-Farbe + Opacity → rgba() (konsistent auf iOS + Android)
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
  const valueColor = highlight
    ? (isDark ? themeColors.accent : COLORS.gradientStart)
    : (isDark ? themeColors.text : themeColors.text);

  const cardStyle = {
    backgroundColor: highlight
      ? hexToRgba(color, isDark ? 0.07 : 0.03)
      : (isDark ? themeColors.card : "#FFFFFF"),
    borderColor: highlight
      ? hexToRgba(color, isDark ? 0.25 : 0.18)
      : (isDark ? hexToRgba(color, 0.15) : themeColors.border),
  };

  return (
    <View style={[styles.statCard, highlight && {
      ...SHADOWS.md,
      shadowColor: color,
      shadowOpacity: 0.15,
      ...(Platform.OS === "android" ? { elevation: 0 } : {}),
    }]}>
      <View style={[styles.statCardClip, cardStyle]}>
        {/* Linker Akzent-Balken */}
        <View style={[styles.statAccentBar, { backgroundColor: color }]} />
        <View style={styles.statCardInner}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.statValue, highlight && styles.statValueHighlight, { color: valueColor }]}>{value}</Text>
            <Text style={[styles.statLabel, { color: highlight ? color : themeColors.textSecondary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{label}</Text>
            {sublabel && (
              <Text style={[styles.statSublabel, { color: themeColors.textTertiary }]}>{sublabel}</Text>
            )}
          </View>
          {iconName && (
            <View style={[styles.statIconCircle, {
              backgroundColor: hexToRgba(color, isDark ? 0.13 : 0.08),
              ...(highlight ? { borderWidth: 1.5, borderColor: hexToRgba(color, 0.18) } : {}),
            }]}>
              <Ionicons name={iconName as any} size={highlight ? 22 : 20} color={color} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

function ProgressBar({ progress, color }: { progress: number; color?: string }) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const barColor = color ?? COLORS.cta;
  return (
    <View style={[styles.progressTrack, { backgroundColor: isDark ? themeColors.surface : themeColors.border }]}>
      <View
        style={[styles.progressFill, {
          width: `${progress}%` as any,
          backgroundColor: barColor,
          shadowColor: barColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
        }]}
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
  page: { padding: 24 },
  dashCol: { flex: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },

  // Admin Header
  adminHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 16,
  },
  adminHeaderLeft: {
    flex: 1,
  },
  refreshButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  refreshButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Zeitraum-Bar
  periodBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 16,
    gap: 12,
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
    flex: 1,
    justifyContent: "flex-end",
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  periodBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Admin Dashboard Tabs
  adminTabRow: {
    flexDirection: "row",
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 8,
  },
  searchResultsBox: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
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
  pageTitle: { ...TYPOGRAPHY.styles.h1, color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { ...TYPOGRAPHY.styles.bodySmall, color: COLORS.secondary },
  sectionTitle: { ...TYPOGRAPHY.styles.h3, color: COLORS.primary, marginBottom: 12 },
  row3: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    overflow: "hidden",
    ...SHADOWS.md,
  },
  cardTitle: { ...TYPOGRAPHY.styles.h4, color: COLORS.primary, marginBottom: 12 },
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
    borderRadius: RADIUS.lg,
    ...SHADOWS.sm,
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
    minHeight: 110,
  },
  statCardClip: {
    flex: 1,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    flexDirection: "row" as const,
    overflow: "hidden" as const,
  },
  statAccentBar: {
    width: 4,
    alignSelf: "stretch",
    borderTopLeftRadius: RADIUS.lg,
    borderBottomLeftRadius: RADIUS.lg,
  },
  statCardInner: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    padding: 16,
    paddingLeft: 14,
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
    flexShrink: 0,
  },
  statLabel: { fontSize: TYPOGRAPHY.size.xs, marginTop: 4, fontWeight: TYPOGRAPHY.weight.medium, textTransform: "uppercase", letterSpacing: 0.3 },
  statSublabel: { fontSize: TYPOGRAPHY.size.xs, marginTop: 2 },
  statValue: { fontSize: TYPOGRAPHY.size.display, fontWeight: TYPOGRAPHY.weight.extrabold, letterSpacing: TYPOGRAPHY.letterSpacing.tight },
  statValueHighlight: { fontSize: TYPOGRAPHY.size.hero },
  rankHintText: { fontSize: 11, textAlign: "center", marginTop: -4 },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  amberBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  amberTitle: { fontWeight: "700", marginBottom: 6, fontSize: 14 },
  amberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  menteeNameText: { fontWeight: "600", fontSize: 14 },
  menteeSubText: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  assignButton: {
    backgroundColor: COLORS.gradientStart,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  assignButtonText: { color: COLORS.white, fontSize: 12, fontWeight: "700" },
  actionButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700", textAlign: "center" },
  actionButtonGold: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.gold,
    backgroundColor: "rgba(238,167,27,0.08)",
  },
  actionButtonTextDark: { color: COLORS.primary, fontSize: 13, fontWeight: "700", textAlign: "center" },
  applicationsButton: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    ...SHADOWS.sm,
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
    borderRadius: RADIUS.sm,
    padding: 16,
  },
  blueTitle: { color: COLORS.white, fontWeight: "600", fontSize: 14, marginBottom: 4 },
  blueText: { color: COLORS.white, opacity: 0.8, fontSize: 13 },
  greetingCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.sm,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  greetingSmall: { color: COLORS.white, fontSize: 13, opacity: 0.75, marginBottom: 2 },
  greetingName: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  greetingMeta: { color: COLORS.white, opacity: 0.65, fontSize: 13, marginTop: 2 },
  menteeCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    ...SHADOWS.md,
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
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: "center",
  },
  docButtonText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  chatButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.full,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
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
    borderRadius: RADIUS.xs,
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
    borderRadius: RADIUS.sm,
    paddingVertical: 8,
    alignItems: "center",
  },
  completeNowButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  congratsBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  congratsEmoji: { fontSize: 32, marginBottom: 8 },
  congratsTitle: { ...TYPOGRAPHY.styles.h3, fontWeight: TYPOGRAPHY.weight.extrabold, marginBottom: 6 },
  congratsText: { ...TYPOGRAPHY.styles.body, textAlign: "center" },
  feedbackBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  feedbackBannerText: { fontWeight: "600", fontSize: 13, flex: 1 },
  feedbackBannerButton: {
    backgroundColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexShrink: 0,
  },
  feedbackBannerButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 12 },
  hadithCard: {
    backgroundColor: "rgba(238,167,27,0.05)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.25)",
    borderRadius: RADIUS.lg,
    padding: 20,
    marginTop: 8,
    marginBottom: 8,
  },
  hadithCardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10, gap: 8 },

  hadithCardLabel: { fontWeight: "700", color: COLORS.primary, fontSize: 14 },
  hadithCardText: { color: COLORS.secondary, fontSize: 13, lineHeight: 21, fontStyle: "italic", marginBottom: 8, textAlign: "center" },
  hadithCardQuelle: { color: COLORS.tertiary, fontSize: 11, marginBottom: 8, fontWeight: "500", textAlign: "center" },
  hadithCardLink: { color: COLORS.link, fontSize: 13, fontWeight: "600" },
  pendingApprovalsButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  pendingApprovalsText: { fontWeight: "700", fontSize: 14 },
  pendingApprovalsSub: { fontSize: 12, marginTop: 2, fontWeight: "400" },
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
  // Aktivitäten-Log
  activityRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  activityIconCircle: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  activityTitle: { color: COLORS.primary, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  activityDate: { color: COLORS.tertiary, fontSize: 11, flexShrink: 0, fontWeight: "500" },
  activityChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: RADIUS.sm, borderWidth: 1 },

  // Betreuungs-Warnungen Widget
  warningBox: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  warningHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 10 },
  warningTitle: { fontWeight: "700", fontSize: 15, flex: 1 },
  warningBadge: {
    borderRadius: RADIUS.sm,
    minWidth: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 7,
  },
  warningBadgeText: { fontSize: 12, fontWeight: "800" },
  warningRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 },
  warningRowBorder: { borderBottomWidth: 1 },
  warningDot: { width: 10, height: 10, borderRadius: 5, flexShrink: 0 },
  warningLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },
  warningName: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  warningDays: { fontSize: 11, flexShrink: 0, fontWeight: "500" },
  warningArrow: { fontSize: 18, marginLeft: 4 },

  reminderBtn: {
    backgroundColor: SEMANTIC.blueBadgeBg.light,
    borderRadius: RADIUS.sm,
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  reminderBtnText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },

  // Mentor des Monats Card (Admin)
  momAdminCard: {
    backgroundColor: "rgba(238,167,27,0.06)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.25)",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    width: "100%",
    ...SHADOWS.goldSubtle,
  },
  momAdminHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  momAdminStar: { color: COLORS.gold, fontSize: 18, marginRight: 6 },
  momAdminTitle: { fontWeight: "700", color: COLORS.secondary, fontSize: 11, letterSpacing: 0.8 },
  momAdminName: { ...TYPOGRAPHY.styles.h3, fontWeight: TYPOGRAPHY.weight.extrabold, color: COLORS.primary, marginBottom: 10 },
  momAdminSub: { fontSize: 11, color: COLORS.tertiary },
  momAdminStatsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  momAdminStat: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.sm,
    padding: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.2)",
  },
  momAdminStatValue: { fontSize: TYPOGRAPHY.size.xxl, fontWeight: TYPOGRAPHY.weight.extrabold, color: COLORS.gold },
  momAdminStatLabel: { color: COLORS.secondary, fontSize: 10, marginTop: 3, fontWeight: TYPOGRAPHY.weight.medium },
  momAdminArrow: { color: COLORS.link, fontSize: 13, fontWeight: "600" },
  momAwardButton: {
    backgroundColor: "rgba(238,167,27,0.12)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.35)",
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center" as const,
    alignSelf: "stretch" as const,
  },
  momAwardButtonText: { color: SEMANTIC.amberText.light, fontSize: 13, fontWeight: "700" as const },

  // Offene Zuweisungen
  openAssignmentsCard: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: RADIUS.sm,
    padding: 14,
    marginBottom: 14,
  },
  openAssignmentsTitle: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  openAssignmentsRow: { fontSize: 13, marginBottom: 3 },

  // Motivationscard (Mentee)
  motivationCard: {
    backgroundColor: COLORS.gradientStart,
    borderWidth: 2,
    borderColor: COLORS.gold,
    borderRadius: RADIUS.sm,
    padding: 16,
    marginBottom: 16,
  },
  motivationHeader: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  motivationStar: { color: COLORS.gold, fontSize: 18, marginRight: 8 },
  motivationTitle: { fontWeight: "700", color: COLORS.gold, fontSize: 14 },
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
    justifyContent: "center",
    gap: 12,
    marginTop: 8,
  },
  motivationShareBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(238,167,27,0.12)",
    borderRadius: RADIUS.sm,
  },
  motivationNextBtn: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(238,167,27,0.12)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.35)",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  motivationNextText: { color: COLORS.gold, fontSize: 12, fontWeight: "700" },

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
    borderRadius: RADIUS.sm,
    padding: 12,
    alignItems: "center",
    gap: 6,
    ...SHADOWS.sm,
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
    marginBottom: 24,
  },
  mentorGreetingLabel: {
    ...TYPOGRAPHY.styles.label,
    letterSpacing: 1.8,
    marginBottom: 4,
  },
  mentorGreetingName: {
    ...TYPOGRAPHY.styles.h1,
    lineHeight: 32,
    marginBottom: 4,
  },
  mentorGreetingMeta: {
    ...TYPOGRAPHY.styles.bodySmall,
  },
  mentorLogoBadge: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  levelHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
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
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  levelScoreText: {
    fontSize: 14,
    fontWeight: "800",
  },
  levelTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  levelFill: {
    height: "100%",
    backgroundColor: COLORS.gold,
    borderRadius: 3,
  },
  levelHint: {
    fontSize: 11,
    marginTop: 6,
    fontWeight: "500",
  },
  levelBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadge: {
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  levelBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  streakThanksRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 14,
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  streakEmoji: {
    fontSize: 16,
  },
  streakText: {
    fontSize: 12,
    fontWeight: "600",
  },
  achievementChip: {
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    padding: 12,
    marginHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 52,
    position: "relative",
  },
  achievementIcon: {
    fontSize: 26,
  },
  achievementTooltip: {
    position: "absolute",
    top: 58,
    left: -20,
    width: 170,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 10,
    zIndex: 100,
    ...SHADOWS.lg,
  },
  achievementTooltipTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 3,
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
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.08)",
  },
  impactLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  impactCount: {
    fontSize: 13,
    fontWeight: "800",
  },
  // Danke-Button (Mentee)
  thankButton: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  thankButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: SEMANTIC.greenText.light,
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
    borderRadius: RADIUS.lg,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...SHADOWS.lg,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
    padding: 12,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: RADIUS.sm,
    padding: 12,
    alignItems: "center",
    backgroundColor: COLORS.gold,
  },
  modalConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
  // Kompakte Mentees-Card im Mentor-Dashboard
  compactMenteesCard: {
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.sm,
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
    backgroundColor: "rgba(238,167,27,0.05)",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 8,
    ...SHADOWS.goldSubtle,
    ...(Platform.OS === "android" ? { elevation: 0 } : {}),
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
    borderRadius: RADIUS.lg,
    padding: 22,
    marginBottom: 16,
  },

  // ── Mentee Dashboard Redesign ──────────────────────────────────────────
  menteeInfoCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  menteeInfoCardTitle: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 3,
  },
  menteeInfoCardName: {
    fontSize: 15,
    fontWeight: "700",
  },
  menteeProgressCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 20,
    ...SHADOWS.md,
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
    borderRadius: RADIUS.sm,
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
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  neglectedRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderLeftWidth: 4,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  neglectedText: {
    fontSize: 13,
    fontWeight: "500",
    lineHeight: 18,
  },
  neglectedArrow: {
    fontSize: 18,
    marginLeft: 8,
  },

  // Mentor Dashboard – Bewertungen
  ratingsCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  ratingsSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  avgRatingBadge: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  avgRatingValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  ratingsCountText: {
    fontSize: 12,
    marginBottom: 12,
    fontWeight: "500",
  },
  feedbackRow: {
    paddingVertical: 12,
    gap: 4,
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
    fontSize: 15,
    letterSpacing: 1.5,
  },
  feedbackDate: {
    fontSize: 11,
    fontWeight: "500",
  },
  feedbackComment: {
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
    marginTop: 3,
  },
  feedbackMentee: {
    fontSize: 11,
    marginTop: 3,
    fontWeight: "500",
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

  // Resources
  resourceCard: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 14,
    alignItems: "center",
    flex: 1,
    minWidth: 140,
    maxWidth: Platform.OS === "web" ? 200 : "48%" as any,
  },
  resourceIconBg: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  resourceTitle: {
    fontSize: 13,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 4,
  },
  resourceDesc: {
    fontSize: 11,
    textAlign: "center",
    lineHeight: 15,
  },
});
