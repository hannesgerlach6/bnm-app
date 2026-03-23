import React, { useMemo, useState, useCallback, useEffect } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Platform, TextInput } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Mentorship } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMLogo } from "../../components/BNMLogo";
import { showConfirm } from "../../lib/errorHandler";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

export default function DashboardScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "admin") return <Container><AdminDashboard showSystemSettings /></Container>;
  if (user.role === "office") return <Container><AdminDashboard showSystemSettings={false} /></Container>;
  if (user.role === "mentor") return <Container><MentorDashboard /></Container>;
  return <Container><MenteeDashboard /></Container>;
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
    sessionTypes,
    feedback,
    hadithe,
    mentorOfMonthVisible,
    getCompletedStepIds,
    getUnassignedMentees,
    getPendingApplicationsCount,
    getPendingApprovalsCount,
    refreshData,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const allMentors = users.filter((u) => u.role === "mentor");
  const allMentees = users.filter((u) => u.role === "mentee");
  const activeMentorships = mentorships.filter((m) => m.status === "active");
  const completedMentorships = mentorships.filter(
    (m) => m.status === "completed"
  );
  const unassignedMentees = getUnassignedMentees();
  const pendingAppsCount = getPendingApplicationsCount();
  const pendingApprovalsCount = getPendingApprovalsCount();

  // Globale Suche
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return null;
    const foundMentees = allMentees.filter(
      (u) => u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q)
    );
    const foundMentors = allMentors.filter(
      (u) => u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q)
    );
    const foundMentorships = mentorships.filter((m) => {
      const menteeName = m.mentee?.name?.toLowerCase() ?? "";
      const mentorName = m.mentor?.name?.toLowerCase() ?? "";
      return menteeName.includes(q) || mentorName.includes(q);
    });
    return { mentees: foundMentees, mentors: foundMentors, mentorships: foundMentorships };
  }, [searchQuery, allMentees, allMentors, mentorships]);

  // Letzte 5 Aktivitäten: Sessions sortiert nach Datum absteigend
  const recentSessions = useMemo(() => {
    return [...sessions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5);
  }, [sessions]);

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

  // Mentor des Monats (höchster Score aller aktiven Mentoren)
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

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <BNMLogo size={36} showSubtitle={false} />
          <View style={styles.headerTextGroup}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("dashboard.admin")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("dashboard.overview")}</Text>
          </View>
        </View>

        {/* Globale Suche */}
        <TextInput
          style={[styles.searchInput, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
          placeholder={t("search.placeholder")}
          placeholderTextColor={themeColors.textTertiary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />

        {/* Suchergebnisse */}
        {searchResults && (
          <View style={[styles.searchResultsBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            {searchResults.mentees.length === 0 && searchResults.mentors.length === 0 && searchResults.mentorships.length === 0 ? (
              <Text style={[styles.searchNoResults, { color: themeColors.textTertiary }]}>{t("search.noResults")}</Text>
            ) : (
              <>
                {searchResults.mentees.length > 0 && (
                  <View style={[styles.searchSection, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.searchSectionLabel, { color: themeColors.textTertiary }]}>{t("search.mentees")}</Text>
                    {searchResults.mentees.slice(0, 3).map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.searchResultRow, { borderTopColor: themeColors.border }]}
                        onPress={() => { setSearchQuery(""); router.push({ pathname: "/mentee/[id]", params: { id: u.id } }); }}
                      >
                        <Text style={[styles.searchResultName, { color: themeColors.text }]}>{u.name}</Text>
                        <Text style={[styles.searchResultSub, { color: themeColors.textTertiary }]}>{u.city}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {searchResults.mentors.length > 0 && (
                  <View style={[styles.searchSection, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.searchSectionLabel, { color: themeColors.textTertiary }]}>{t("search.mentors")}</Text>
                    {searchResults.mentors.slice(0, 3).map((u) => (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.searchResultRow, { borderTopColor: themeColors.border }]}
                        onPress={() => { setSearchQuery(""); router.push({ pathname: "/mentor/[id]", params: { id: u.id } }); }}
                      >
                        <Text style={[styles.searchResultName, { color: themeColors.text }]}>{u.name}</Text>
                        <Text style={[styles.searchResultSub, { color: themeColors.textTertiary }]}>{u.city}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {searchResults.mentorships.length > 0 && (
                  <View style={[styles.searchSection, { borderBottomColor: themeColors.border }]}>
                    <Text style={[styles.searchSectionLabel, { color: themeColors.textTertiary }]}>{t("search.mentorships")}</Text>
                    {searchResults.mentorships.slice(0, 3).map((m) => (
                      <TouchableOpacity
                        key={m.id}
                        style={[styles.searchResultRow, { borderTopColor: themeColors.border }]}
                        onPress={() => { setSearchQuery(""); router.push({ pathname: "/mentorship/[id]", params: { id: m.id } }); }}
                      >
                        <Text style={[styles.searchResultName, { color: themeColors.text }]}>{m.mentee?.name} → {m.mentor?.name}</Text>
                        <Text style={[styles.searchResultSub, { color: themeColors.textTertiary }]}>
                          {m.status === "active" ? t("search.active") : t("search.completed")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* KPI Karten – Reihe 1 */}
        <View style={styles.row3}>
          <StatCard label={t("dashboard.activeMentorships")} value={activeMentorships.length} color={COLORS.gradientStart} />
          <StatCard label={t("dashboard.completed")} value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* KPI Karten – Reihe 2 */}
        <View style={[styles.row3, { marginBottom: 16 }]}>
          <StatCard label={t("dashboard.mentors")} value={allMentors.length} color={COLORS.gradientStart} />
          <StatCard label={t("dashboard.totalMentees")} value={allMentees.length} color={COLORS.gold} />
        </View>

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

        {/* Mentor des Monats (Admin-Sicht) */}
        {mentorOfMonthVisible && topMentor && (
          <TouchableOpacity
            style={styles.momAdminCard}
            onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: topMentor.mentor.id } })}
          >
            <View style={styles.momAdminHeader}>
              <Text style={styles.momAdminStar}>★</Text>
              <Text style={[styles.momAdminTitle, { color: themeColors.textSecondary }]}>{t("dashboard.currentMentorOfMonth")}</Text>
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
          </TouchableOpacity>
        )}

        {/* Nicht zugewiesene Mentees */}
        {unassignedMentees.length > 0 && (
          <View style={[styles.amberBox, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}>
            <Text style={[styles.amberTitle, { color: isDark ? "#fbbf24" : "#92400e" }]}>
              {unassignedMentees.length} Mentee
              {unassignedMentees.length > 1 ? "s" : ""} {t("dashboard.withoutAssignment")}
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

        {/* Admin-Aktionen */}
        <View style={styles.row3}>
          {showSystemSettings && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: COLORS.gradientStart }]}
              onPress={() => router.push("/admin/session-types")}
            >
              <Text style={styles.actionButtonText}>{t("dashboard.sessionTypes")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.actionButtonGold, !showSystemSettings ? { flex: 1 } : {}]}
            onPress={() => router.push("/(tabs)/reports")}
          >
            <Text style={styles.actionButtonTextDark}>{t("dashboard.reports")}</Text>
          </TouchableOpacity>
        </View>

        {/* Schnellzugriff: Bewerbungen */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
          onPress={() => router.push("/admin/applications")}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("dashboard.applications")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("dashboard.checkApplications")}</Text>
          </View>
          {pendingAppsCount > 0 && (
            <View style={styles.applicationsBadge}>
              <Text style={styles.applicationsBadgeText}>{pendingAppsCount}</Text>
            </View>
          )}
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>

        {/* Feedback-Übersicht (nur Admin) */}
        {showSystemSettings && (
          <TouchableOpacity
            style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
            onPress={() => router.push("/admin/feedback-overview")}
          >
            <View style={styles.applicationsButtonContent}>
              <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("dashboard.feedbackOverview")}</Text>
              <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("dashboard.viewAllFeedbacks")}</Text>
            </View>
            <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        )}

        {/* Mentoren-Übersicht */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
          onPress={() => router.push("/admin/mentors")}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("adminMentors.title")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{allMentors.length} {t("adminMentors.mentors")}</Text>
          </View>
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>

        {/* Erweiterte Statistiken */}
        {showSystemSettings && (
          <TouchableOpacity
            style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
            onPress={() => router.push("/admin/statistics")}
          >
            <View style={styles.applicationsButtonContent}>
              <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("statistics.title")}</Text>
              <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("statistics.completionRate")} · {t("statistics.cityDistribution")}</Text>
            </View>
            <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        )}

        {/* Spender-Bericht Dashboard */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
          onPress={() => router.push("/admin/donor-report" as never)}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("donorDashboard.title")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("donorDashboard.subtitle")}</Text>
          </View>
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>

        {/* CSV Import */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
          onPress={() => router.push("/admin/csv-import")}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("csvImport.title")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("csvImport.tabMentees")} · {t("csvImport.tabMentors")}</Text>
          </View>
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>

        {/* Q&A verwalten */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
          onPress={() => router.push("/admin/qa-management" as never)}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("qa.manage")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("qa.subtitle")}</Text>
          </View>
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>

        {/* Hadithe verwalten (nur Admin) */}
        {showSystemSettings && (
          <TouchableOpacity
            style={[styles.applicationsButton, { backgroundColor: themeColors.card }]}
            onPress={() => router.push("/admin/hadithe-management" as never)}
          >
            <View style={styles.applicationsButtonContent}>
              <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("haditheMgmt.title")}</Text>
              <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>
                {hadithe.length} {hadithe.length === 1 ? t("haditheMgmt.singular") : t("haditheMgmt.plural")}
              </Text>
            </View>
            <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        )}

        {/* Letzte Aktivitäten */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>{t("dashboard.recentActivity")}</Text>
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

        {/* Aktive Betreuungen Übersicht */}
        <View style={[styles.card, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.cardTitle, { color: themeColors.text }]}>{t("dashboard.activeMentorships")}</Text>
          {activeMentorships.length === 0 ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Ionicons name="people-outline" size={28} color={themeColors.textTertiary} style={{ marginBottom: 8 }} />
              <Text style={[styles.emptyText, { color: themeColors.textTertiary, marginBottom: 8 }]}>
                {t("dashboard.noActiveMentorships")}
              </Text>
              <Text style={{ color: COLORS.link, fontSize: 13 }}>
                {t("dashboard.assignMenteePrompt")}
              </Text>
            </View>
          ) : (
            activeMentorships.map((m, index) => {
              const completedSteps = getCompletedStepIds(m.id);
              const progress = Math.round(
                (completedSteps.length / sessionTypes.length) * 100
              );
              const isLast = index === activeMentorships.length - 1;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.listItem, isLast ? {} : [styles.listItemBorder, { borderBottomColor: themeColors.border }]]}
                  onPress={() =>
                    router.push({ pathname: "/mentorship/[id]", params: { id: m.id } })
                  }
                >
                  <View style={styles.rowBetweenMb2}>
                    <View>
                      <Text style={[styles.semiboldPrimary, { color: themeColors.text }]}>{m.mentee?.name}</Text>
                      <Text style={[styles.tertiaryXs, { color: themeColors.textTertiary }]}>{t("dashboard.mentor")} {m.mentor?.name}</Text>
                    </View>
                    <View style={[styles.percentBadge, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                      <Text style={[styles.percentBadgeText, { color: themeColors.text }]}>{progress}%</Text>
                    </View>
                  </View>
                  <ProgressBar progress={progress} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

      </View>
    </ScrollView>
  );
}

function MentorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipsByMentorId, getCompletedStepIds, sessionTypes, refreshData, getUnreadMessagesCount } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const myMentorships = user ? getMentorshipsByMentorId(user.id) : [];
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");

  // Auto-Show Onboarding für neue Mentoren ohne Mentees (einmalig)
  // Hook muss VOR dem early return stehen (React Hooks Rules)
  useEffect(() => {
    if (!user) return;
    if (activeMentorships.length > 0) return; // Hat schon Mentees → kein Onboarding nötig
    const key = "bnm_onboarding_seen";
    async function checkOnboarding() {
      try {
        let seen = false;
        if (Platform.OS === "web") {
          seen = localStorage.getItem(key) === "1";
        } else {
          try {
            // @ts-ignore
            const AsyncStorage = (await import("@react-native-async-storage/async-storage")).default;
            seen = (await AsyncStorage.getItem(key)) === "1";
          } catch { seen = false; }
        }
        if (!seen) {
          router.push("/onboarding");
        }
      } catch { /* ignorieren */ }
    }
    checkOnboarding();
  }, [user?.id, activeMentorships.length]);

  if (!user) return null;

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* Begrüssung – Hero mit dunklem Blau */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingSmall}>{t("dashboard.salam")}</Text>
          <Text style={styles.greetingName}>{user.name}</Text>
          <Text style={styles.greetingMeta}>
            {user.city} · {user.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.row3, { marginBottom: 16 }]}>
          <StatCard label={t("dashboard.activeMentees")} value={activeMentorships.length} color={COLORS.gradientStart} />
          <StatCard label={t("dashboard.completed")} value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* Aktive Betreuungen */}
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t("dashboard.myActiveMentorships")}</Text>
        {activeMentorships.length === 0 ? (
          <View style={[styles.card, { backgroundColor: themeColors.card, padding: 24, alignItems: "center", marginBottom: 16 }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("dashboard.noMenteesAssigned")}</Text>
          </View>
        ) : (
          activeMentorships.map((m) => {
            const completedSteps = getCompletedStepIds(m.id);
            const nextStepIdx = completedSteps.length;
            const nextStep =
              nextStepIdx < sessionTypes.length
                ? [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order)[nextStepIdx]
                : null;
            const progress = Math.round(
              (completedSteps.length / sessionTypes.length) * 100
            );

            const allDone = completedSteps.length === sessionTypes.length;

            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.menteeCard, { backgroundColor: themeColors.card }]}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: m.id } })
                }
              >
                <View style={styles.rowBetweenMb3}>
                  <View>
                    <Text style={[styles.boldPrimary, { color: themeColors.text }]}>{m.mentee?.name}</Text>
                    <Text style={[styles.tertiaryXs, { color: themeColors.textTertiary }]}>
                      {m.mentee?.city} · {t("dashboard.since")}{" "}
                      {new Date(m.assigned_at).toLocaleDateString("de-DE")}
                    </Text>
                  </View>
                  <View style={[styles.stepsBadge, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                    <Text style={[styles.stepsBadgeText, { color: themeColors.text }]}>
                      {completedSteps.length}/{sessionTypes.length}
                    </Text>
                  </View>
                </View>
                <ProgressBar progress={progress} />
                {allDone ? (
                  <View style={styles.allDoneRow}>
                    <Text style={styles.allDoneLabel}>{t("dashboard.allStepsDone")}</Text>
                    <TouchableOpacity
                      style={styles.completeNowButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: "/mentorship/[id]", params: { id: m.id } });
                      }}
                    >
                      <Text style={styles.completeNowButtonText}>{t("dashboard.completeNow")}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {nextStep && (
                      <View style={styles.nextStepRow}>
                        <View style={styles.goldDot} />
                        <Text style={[styles.nextStepText, { color: themeColors.textSecondary }]}>
                          {t("dashboard.nextStep")} {nextStep.name}
                        </Text>
                      </View>
                    )}
                    <View style={styles.actionRow}>
                      <TouchableOpacity
                        style={styles.docButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({ pathname: "/document-session", params: { mentorshipId: m.id } });
                        }}
                      >
                        <Text style={styles.docButtonText}>{t("dashboard.documentSession")}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.chatButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                        onPress={(e) => {
                          e.stopPropagation();
                          router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: m.id } });
                        }}
                      >
                        <Text style={[styles.chatButtonText, { color: themeColors.textSecondary }]}>{t("dashboard.openChat")}</Text>
                        {getUnreadMessagesCount(m.id) > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadBadgeText}>
                              {getUnreadMessagesCount(m.id)}
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </TouchableOpacity>
            );
          })
        )}

        {/* Mentor des Monats Platzhalter */}
        <View style={styles.goldBox}>
          <View style={styles.goldBoxHeader}>
            <Text style={styles.goldStar}>★</Text>
            <Text style={[styles.goldBoxTitle, { color: themeColors.text }]}>{t("dashboard.mentorOfMonth")}</Text>
          </View>
          <Text style={[styles.goldBoxText, { color: themeColors.textSecondary }]}>{t("dashboard.mentorOfMonthText")}</Text>
        </View>

        {/* Q&A für Mentees */}
        <TouchableOpacity
          style={[styles.applicationsButton, { backgroundColor: themeColors.card, marginTop: 4 }]}
          onPress={() => router.push("/qa" as never)}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("qa.forMentees")}</Text>
            <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("qa.subtitle")}</Text>
          </View>
          <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function MenteeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipByMenteeId, getCompletedStepIds, sessionTypes, hadithe, refreshData, getUnreadMessagesCount, confirmStepAsMentee, unconfirmStepAsMentee, mentorships, feedback } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [confirmingStep, setConfirmingStep] = useState<string | null>(null);
  const [hadithOffset, setHadithOffset] = useState(0);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const menteeConfirmedSteps = mentorship?.mentee_confirmed_steps ?? [];
  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  // Prüfe ob es abgeschlossene Betreuungen ohne Feedback gibt
  const completedMentorshipsWithoutFeedback = mentorships.filter(
    (m) => m.mentee_id === user.id && m.status === "completed" && !feedback.some((f) => f.mentorship_id === m.id && f.submitted_by === user.id)
  );

  async function handleToggleStep(step: { id: string; name: string }) {
    if (!mentorship) return;
    const isConfirmed = menteeConfirmedSteps.includes(step.id);
    const title = isConfirmed ? t("menteeProgress.unconfirmTitle") : t("menteeProgress.confirmTitle");
    const text = (isConfirmed ? t("menteeProgress.unconfirmText") : t("menteeProgress.confirmText")).replace("{0}", step.name);
    const ok = await showConfirm(title, text);
    if (!ok) return;
    setConfirmingStep(step.id);
    try {
      if (isConfirmed) {
        await unconfirmStepAsMentee(mentorship.id, step.id);
      } else {
        await confirmStepAsMentee(mentorship.id, step.id);
      }
    } finally {
      setConfirmingStep(null);
    }
  }

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* Motivation des Tages */}
        {(() => {
          const source = hadithe.length > 0 ? hadithe : null;
          if (!source) return null;
          const today = new Date();
          const dayOfYear = Math.floor(
            (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
          );
          const baseIdx = dayOfYear % source.length;
          const idx = (baseIdx + hadithOffset) % source.length;
          const hadith = source[idx];
          return (
            <View style={styles.motivationCard}>
              <View style={styles.motivationHeader}>
                <Text style={styles.motivationStar}>★</Text>
                <Text style={styles.motivationTitle}>{t("motivation.title")}</Text>
              </View>
              {hadith.text_ar ? (
                <Text style={styles.motivationArabic}>{hadith.text_ar}</Text>
              ) : null}
              <Text style={styles.motivationText}>"{hadith.text_de}"</Text>
              {hadith.source ? (
                <Text style={styles.motivationSource}>{t("motivation.source")}: {hadith.source}</Text>
              ) : null}
              <TouchableOpacity
                style={styles.motivationNextBtn}
                onPress={() => setHadithOffset((prev) => prev + 1)}
              >
                <Text style={styles.motivationNextText}>{t("motivation.next")}</Text>
              </TouchableOpacity>
            </View>
          );
        })()}

        {/* Begrüssung – Hero */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingSmall}>{t("dashboard.salam")}</Text>
          <Text style={styles.greetingName}>{user.name}</Text>
          {mentorship ? (
            <Text style={styles.greetingMeta}>{t("dashboard.mentor")} {mentorship.mentor?.name}</Text>
          ) : (
            <Text style={styles.greetingMeta}>{t("dashboard.noMentorYet")}</Text>
          )}
        </View>

        {/* Feedback-Banner für abgeschlossene Betreuungen ohne Feedback */}
        {completedMentorshipsWithoutFeedback.length > 0 && (
          <View style={[styles.feedbackBanner, { backgroundColor: isDark ? "#3a2e1a" : "#fefce8", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}>
            <Text style={[styles.feedbackBannerText, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("feedbackBanner.title")}</Text>
            <TouchableOpacity
              style={styles.feedbackBannerButton}
              onPress={() =>
                router.push({
                  pathname: "/feedback",
                  params: { mentorshipId: completedMentorshipsWithoutFeedback[0].id },
                })
              }
            >
              <Text style={styles.feedbackBannerButtonText}>{t("feedbackBanner.button")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Fortschritts-Übersicht */}
        {mentorship ? (
          <>
            {/* Mein Mentor Karte */}
            {mentorship.mentor && (
              <View style={[styles.card, { marginBottom: 16 }]}>
                <Text style={styles.cardTitle}>{t("dashboard.myMentor")}</Text>
                <View style={styles.mentorInfoRow}>
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorAvatarText}>
                      {mentorship.mentor.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.boldPrimary}>{mentorship.mentor.name}</Text>
                    <Text style={styles.tertiaryXs}>{mentorship.mentor.city}</Text>
                  </View>
                </View>
                <View style={styles.mentorDetailRows}>
                  <View style={styles.mentorDetailRow}>
                    <Text style={styles.mentorDetailLabel}>{t("dashboard.mentorContact")}</Text>
                    <Text style={styles.mentorDetailValue}>{mentorship.mentor.contact_preference}</Text>
                  </View>
                  {mentorship.mentor.phone && (
                    <View style={styles.mentorDetailRow}>
                      <Text style={styles.mentorDetailLabel}>{t("dashboard.mentorPhone")}</Text>
                      <Text style={styles.mentorDetailValue}>{mentorship.mentor.phone}</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity
                  style={[styles.actionButton, { backgroundColor: COLORS.gradientStart, marginTop: 10 }]}
                  onPress={() =>
                    router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
                  }
                >
                  <Text style={styles.actionButtonText}>{t("dashboard.sendMessage")}</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={[styles.card, { marginBottom: 16 }]}>
              <View style={styles.rowBetweenMb3}>
                <Text style={styles.cardTitle}>{t("dashboard.yourProgress")}</Text>
                <Text style={styles.goldBold}>
                  {completedStepIds.length}/{sessionTypes.length}
                </Text>
              </View>
              <ProgressBar
                progress={Math.round(
                  (completedStepIds.length / sessionTypes.length) * 100
                )}
              />
            </View>

            {/* Betreuungsdetails + Chat */}
            <View style={[styles.row3, { marginBottom: 16 }]}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.gradientStart }]}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
                }
              >
                <Text style={styles.actionButtonText}>{t("dashboard.viewMentorship")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
                }
              >
                <Text style={styles.secondaryButtonText}>{t("dashboard.openChat")}</Text>
                {getUnreadMessagesCount(mentorship.id) > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadBadgeText}>
                      {getUnreadMessagesCount(mentorship.id)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Glückwunsch-Banner wenn alle Steps erledigt */}
            {completedStepIds.length === sessionTypes.length && (
              <View style={[styles.congratsBanner, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7", borderColor: isDark ? "#2d6a4a" : "#86efac" }]}>
                <Ionicons name="ribbon-outline" size={32} color={isDark ? "#4ade80" : "#15803d"} style={{ marginBottom: 6 }} />
                <Text style={[styles.congratsTitle, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("mentorship.congratulations")}</Text>
                <Text style={[styles.congratsText, { color: isDark ? "#4ade80" : "#16a34a" }]}>{t("mentorship.allStepsDone")}</Text>
              </View>
            )}

            {/* 10-Schritte-Gamification mit Mentee-Abhak-System */}
            <Text style={styles.sectionTitle}>{t("menteeProgress.title")}</Text>
            {/* Fortschritts-Motivationstext */}
            <Text style={styles.progressMotivation}>
              {menteeConfirmedSteps.length === sessionTypes.length
                ? t("menteeProgress.allDone")
                : t("menteeProgress.progress")
                    .replace("{0}", String(menteeConfirmedSteps.length))
                    .replace("{1}", String(sessionTypes.length))}
            </Text>
            <View style={[styles.card, { padding: 0, overflow: "hidden", marginBottom: 16 }]}>
              {sortedSessionTypes.map((step, idx) => {
                // Mentor hat dokumentiert (offiziell erledigt)
                const mentorDone = completedStepIds.includes(step.id);
                // Mentee hat selbst bestätigt
                const menteeDone = menteeConfirmedSteps.includes(step.id);
                // Mentee bestätigt, Mentor noch nicht → gelb/orange
                const pendingMentor = menteeDone && !mentorDone;
                const isConfirming = confirmingStep === step.id;

                return (
                  <TouchableOpacity
                    key={step.id}
                    style={[
                      styles.stepRow,
                      idx < sessionTypes.length - 1 ? styles.stepRowBorder : {},
                      mentorDone ? { backgroundColor: isDark ? "#1a3a2a" : "#f0fdf4" } : pendingMentor ? { backgroundColor: isDark ? "#2a2218" : "#fffbeb" } : {},
                    ]}
                    onPress={() => !mentorDone && handleToggleStep(step)}
                    disabled={isConfirming}
                    activeOpacity={mentorDone ? 1 : 0.7}
                  >
                    {/* Schritt-Indikator */}
                    <View
                      style={[
                        styles.stepIndicator,
                        mentorDone
                          ? { backgroundColor: COLORS.cta }
                          : pendingMentor
                          ? { backgroundColor: "#f59e0b" }
                          : menteeDone
                          ? { backgroundColor: "#f59e0b" }
                          : { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
                      ]}
                    >
                      {mentorDone ? (
                        <Text style={styles.stepIndicatorTextWhite}>✓</Text>
                      ) : menteeDone ? (
                        <Text style={styles.stepIndicatorTextWhite}>✓</Text>
                      ) : (
                        <Text style={styles.stepIndicatorTextTertiary}>{idx + 1}</Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.stepName,
                          mentorDone
                            ? { color: COLORS.cta }
                            : pendingMentor
                            ? { color: isDark ? "#fbbf24" : "#92400e" }
                            : { color: COLORS.tertiary },
                        ]}
                      >
                        {step.name}
                      </Text>
                      {pendingMentor && (
                        <Text style={[styles.stepWaitingLabel, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("menteeProgress.waiting")}</Text>
                      )}
                    </View>

                    {/* Status-Chip rechts */}
                    {mentorDone ? (
                      <View style={[styles.doneChip, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
                        <Text style={[styles.doneChipText, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("menteeProgress.completed")}</Text>
                      </View>
                    ) : pendingMentor ? (
                      <View style={[styles.waitingChip, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}>
                        <Text style={[styles.waitingChipText, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("menteeProgress.discrepancyBadge")}</Text>
                      </View>
                    ) : (
                      <View style={styles.checkboxOuter}>
                        {isConfirming ? (
                          <Text style={styles.checkboxLoading}>...</Text>
                        ) : (
                          <Text style={styles.checkboxIcon}>{menteeDone ? "☑" : "☐"}</Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Hadithe-Link */}
            <TouchableOpacity
              style={styles.hadithCard}
              onPress={() => router.push("/hadithe")}
            >
              <View style={styles.hadithCardHeader}>
                <Text style={styles.hadithStar}>★</Text>
                <Text style={styles.hadithCardLabel}>{t("dashboard.hadithOfDay")}</Text>
              </View>
              <Text style={styles.hadithCardLink}>{t("dashboard.viewAllHadithe")}</Text>
            </TouchableOpacity>

            {/* Häufige Fragen */}
            <TouchableOpacity
              style={[styles.applicationsButton, { backgroundColor: themeColors.card, marginTop: 4 }]}
              onPress={() => router.push("/qa" as never)}
            >
              <View style={styles.applicationsButtonContent}>
                <Text style={[styles.applicationsButtonText, { color: themeColors.text }]}>{t("qa.frequentQuestions")}</Text>
                <Text style={[styles.applicationsButtonSub, { color: themeColors.textTertiary }]}>{t("qa.subtitle")}</Text>
              </View>
              <Text style={[styles.applicationsArrow, { color: themeColors.textTertiary }]}>›</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={[styles.card, { padding: 32, alignItems: "center" }]}>
            <Text style={styles.boldPrimary}>{t("dashboard.pendingAssignment")}</Text>
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              {t("dashboard.pendingAssignmentText")}
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function StatCard({
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
    <View style={[styles.statCard, { backgroundColor: themeColors.card }]}>
      <Text style={[styles.statLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
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
  statLabel: { fontSize: 12, marginBottom: 2 },
  statValue: { fontSize: 26, fontWeight: "700" },
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
});
