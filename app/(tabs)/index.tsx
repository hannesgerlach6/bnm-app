import React, { useMemo } from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { Mentorship } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { MOCK_HADITHE } from "../../data/mockData";
import { BNMLogo } from "../../components/BNMLogo";

export default function DashboardScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "admin") return <Container><AdminDashboard /></Container>;
  if (user.role === "mentor") return <Container><MentorDashboard /></Container>;
  return <Container><MenteeDashboard /></Container>;
}

function AdminDashboard() {
  const router = useRouter();
  const {
    users,
    mentorships,
    sessionTypes,
    getCompletedStepIds,
    getUnassignedMentees,
    getPendingApplicationsCount,
  } = useData();

  const allMentors = users.filter((u) => u.role === "mentor");
  const allMentees = users.filter((u) => u.role === "mentee");
  const activeMentorships = mentorships.filter((m) => m.status === "active");
  const completedMentorships = mentorships.filter(
    (m) => m.status === "completed"
  );
  const unassignedMentees = getUnassignedMentees();
  const pendingAppsCount = getPendingApplicationsCount();

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <View style={styles.headerRow}>
          <BNMLogo size={36} showSubtitle={false} />
          <View style={styles.headerTextGroup}>
            <Text style={styles.pageTitle}>Admin Dashboard</Text>
            <Text style={styles.pageSubtitle}>Gesamtübersicht BNM-Programm</Text>
          </View>
        </View>

        {/* KPI Karten – Reihe 1 */}
        <View style={styles.row3}>
          <StatCard label="Aktive Betreuungen" value={activeMentorships.length} color={COLORS.gradientStart} />
          <StatCard label="Abgeschlossen" value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* KPI Karten – Reihe 2 */}
        <View style={[styles.row3, { marginBottom: 16 }]}>
          <StatCard label="Mentoren" value={allMentors.length} color={COLORS.gradientStart} />
          <StatCard label="Mentees gesamt" value={allMentees.length} color={COLORS.gold} />
        </View>

        {/* Nicht zugewiesene Mentees */}
        {unassignedMentees.length > 0 && (
          <View style={styles.amberBox}>
            <Text style={styles.amberTitle}>
              {unassignedMentees.length} Mentee
              {unassignedMentees.length > 1 ? "s" : ""} ohne Zuweisung
            </Text>
            {unassignedMentees.map((mentee) => (
              <View key={mentee.id} style={styles.amberRow}>
                <View>
                  <Text style={styles.menteeNameText}>{mentee.name}</Text>
                  <Text style={styles.menteeSubText}>
                    {mentee.city} · {mentee.gender === "male" ? "Bruder" : "Schwester"}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.assignButton}
                  onPress={() =>
                    router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                  }
                >
                  <Text style={styles.assignButtonText}>Zuweisen</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Admin-Aktionen */}
        <View style={styles.row3}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: COLORS.gradientStart }]}
            onPress={() => router.push("/admin/session-types")}
          >
            <Text style={styles.actionButtonText}>Session-Typen verwalten</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButtonGold}
            onPress={() => router.push("/(tabs)/reports")}
          >
            <Text style={styles.actionButtonTextDark}>Monatsberichte</Text>
          </TouchableOpacity>
        </View>

        {/* Schnellzugriff: Bewerbungen */}
        <TouchableOpacity
          style={styles.applicationsButton}
          onPress={() => router.push("/admin/applications")}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={styles.applicationsButtonText}>Mentor-Bewerbungen</Text>
            <Text style={styles.applicationsButtonSub}>Neue Mentoren prüfen</Text>
          </View>
          {pendingAppsCount > 0 && (
            <View style={styles.applicationsBadge}>
              <Text style={styles.applicationsBadgeText}>{pendingAppsCount}</Text>
            </View>
          )}
          <Text style={styles.applicationsArrow}>›</Text>
        </TouchableOpacity>

        {/* Feedback-Übersicht */}
        <TouchableOpacity
          style={styles.applicationsButton}
          onPress={() => router.push("/admin/feedback-overview")}
        >
          <View style={styles.applicationsButtonContent}>
            <Text style={styles.applicationsButtonText}>Feedback-Übersicht</Text>
            <Text style={styles.applicationsButtonSub}>Alle Feedbacks einsehen</Text>
          </View>
          <Text style={styles.applicationsArrow}>›</Text>
        </TouchableOpacity>

        {/* Balkendiagramm: Neue Betreuungen pro Monat */}
        <MonthlyChart mentorships={mentorships} />

        {/* Aktive Betreuungen Übersicht */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aktive Betreuungen</Text>
          {activeMentorships.length === 0 ? (
            <Text style={styles.emptyText}>Keine aktiven Betreuungen.</Text>
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
                  style={[styles.listItem, isLast ? {} : styles.listItemBorder]}
                  onPress={() =>
                    router.push({ pathname: "/mentorship/[id]", params: { id: m.id } })
                  }
                >
                  <View style={styles.rowBetweenMb2}>
                    <View>
                      <Text style={styles.semiboldPrimary}>{m.mentee?.name}</Text>
                      <Text style={styles.tertiaryXs}>Mentor: {m.mentor?.name}</Text>
                    </View>
                    <View style={styles.percentBadge}>
                      <Text style={styles.percentBadgeText}>{progress}%</Text>
                    </View>
                  </View>
                  <ProgressBar progress={progress} />
                </TouchableOpacity>
              );
            })
          )}
        </View>

        {/* Geschlechtertrennung Hinweis */}
        <View style={styles.blueBox}>
          <Text style={styles.blueTitle}>Geschlechtertrennung aktiv</Text>
          <Text style={styles.blueText}>
            Brüder werden nur Brüdern zugewiesen, Schwestern nur Schwestern.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MentorDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { getMentorshipsByMentorId, getCompletedStepIds, sessionTypes } = useData();

  if (!user) return null;

  const myMentorships = getMentorshipsByMentorId(user.id);
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Begrüssung – Hero mit dunklem Blau */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingSmall}>Salam Aleikum,</Text>
          <Text style={styles.greetingName}>{user.name}</Text>
          <Text style={styles.greetingMeta}>
            {user.city} · {user.gender === "male" ? "Bruder" : "Schwester"}
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.row3, { marginBottom: 16 }]}>
          <StatCard label="Aktive Mentees" value={activeMentorships.length} color={COLORS.gradientStart} />
          <StatCard label="Abgeschlossen" value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* Aktive Betreuungen */}
        <Text style={styles.sectionTitle}>Meine aktiven Betreuungen</Text>
        {activeMentorships.length === 0 ? (
          <View style={[styles.card, { padding: 24, alignItems: "center", marginBottom: 16 }]}>
            <Text style={styles.emptyText}>Dir sind aktuell keine Mentees zugewiesen.</Text>
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

            return (
              <TouchableOpacity
                key={m.id}
                style={styles.menteeCard}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: m.id } })
                }
              >
                <View style={styles.rowBetweenMb3}>
                  <View>
                    <Text style={styles.boldPrimary}>{m.mentee?.name}</Text>
                    <Text style={styles.tertiaryXs}>
                      {m.mentee?.city} · Seit{" "}
                      {new Date(m.assigned_at).toLocaleDateString("de-DE")}
                    </Text>
                  </View>
                  <View style={styles.stepsBadge}>
                    <Text style={styles.stepsBadgeText}>
                      {completedSteps.length}/{sessionTypes.length}
                    </Text>
                  </View>
                </View>
                <ProgressBar progress={progress} />
                {nextStep && (
                  <View style={styles.nextStepRow}>
                    <View style={styles.goldDot} />
                    <Text style={styles.nextStepText}>
                      Nächster Schritt: {nextStep.name}
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
                    <Text style={styles.docButtonText}>Session dokumentieren</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.chatButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: m.id } });
                    }}
                  >
                    <Text style={styles.chatButtonText}>Chat</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        {/* Mentor des Monats Platzhalter */}
        <View style={styles.goldBox}>
          <View style={styles.goldBoxHeader}>
            <Text style={styles.goldStar}>★</Text>
            <Text style={styles.goldBoxTitle}>Mentor des Monats</Text>
          </View>
          <Text style={styles.goldBoxText}>
            Dokumentiere deine Sessions regelmässig, um in die Auswahl zu kommen.
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

function MenteeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { getMentorshipByMenteeId, getCompletedStepIds, sessionTypes } = useData();

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Begrüssung – Hero */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingSmall}>Salam Aleikum,</Text>
          <Text style={styles.greetingName}>{user.name}</Text>
          {mentorship ? (
            <Text style={styles.greetingMeta}>Mentor: {mentorship.mentor?.name}</Text>
          ) : (
            <Text style={styles.greetingMeta}>Noch kein Mentor zugewiesen</Text>
          )}
        </View>

        {/* Fortschritts-Übersicht */}
        {mentorship ? (
          <>
            <View style={[styles.card, { marginBottom: 16 }]}>
              <View style={styles.rowBetweenMb3}>
                <Text style={styles.cardTitle}>Dein Fortschritt</Text>
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
                <Text style={styles.actionButtonText}>Betreuung ansehen</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={() =>
                  router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
                }
              >
                <Text style={styles.secondaryButtonText}>Chat öffnen</Text>
              </TouchableOpacity>
            </View>

            {/* 10-Schritte-Gamification */}
            <Text style={styles.sectionTitle}>Deine 10 Schritte</Text>
            <View style={[styles.card, { padding: 0, overflow: "hidden", marginBottom: 16 }]}>
              {sortedSessionTypes.map((step, idx) => {
                const isDone = completedStepIds.includes(step.id);
                const isCurrent = !isDone && idx === completedStepIds.length;

                return (
                  <View
                    key={step.id}
                    style={[
                      styles.stepRow,
                      idx < sessionTypes.length - 1 ? styles.stepRowBorder : {},
                      isCurrent ? { backgroundColor: "#f0fdf4" } : {},
                    ]}
                  >
                    {/* Schritt-Indikator */}
                    <View
                      style={[
                        styles.stepIndicator,
                        isDone
                          ? { backgroundColor: COLORS.cta }
                          : isCurrent
                          ? { backgroundColor: COLORS.gold }
                          : { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
                      ]}
                    >
                      {isDone ? (
                        <Text style={styles.stepIndicatorTextWhite}>✓</Text>
                      ) : (
                        <Text
                          style={isCurrent ? styles.stepIndicatorTextWhite : styles.stepIndicatorTextTertiary}
                        >
                          {idx + 1}
                        </Text>
                      )}
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text
                        style={[
                          styles.stepName,
                          isDone
                            ? { color: COLORS.cta }
                            : isCurrent
                            ? { color: COLORS.primary }
                            : { color: COLORS.tertiary },
                        ]}
                      >
                        {step.name}
                      </Text>
                      {isCurrent && (
                        <Text style={styles.currentStepLabel}>Aktuelle Session</Text>
                      )}
                    </View>

                    {isDone && (
                      <View style={styles.doneChip}>
                        <Text style={styles.doneChipText}>Erledigt</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Hadithe-Card */}
            {(() => {
              const today = new Date();
              const dayOfYear = Math.floor(
                (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
              );
              const hadith = MOCK_HADITHE[dayOfYear % MOCK_HADITHE.length];
              return (
                <TouchableOpacity
                  style={styles.hadithCard}
                  onPress={() => router.push("/hadithe")}
                >
                  <View style={styles.hadithCardHeader}>
                    <Text style={styles.hadithStar}>★</Text>
                    <Text style={styles.hadithCardLabel}>Hadith des Tages</Text>
                  </View>
                  <Text style={styles.hadithCardText} numberOfLines={3}>
                    "{hadith.text}"
                  </Text>
                  <Text style={styles.hadithCardQuelle}>— {hadith.quelle}</Text>
                  <Text style={styles.hadithCardLink}>Alle Hadithe ansehen →</Text>
                </TouchableOpacity>
              );
            })()}
          </>
        ) : (
          <View style={[styles.card, { padding: 32, alignItems: "center" }]}>
            <Text style={styles.boldPrimary}>Zuweisung ausstehend</Text>
            <Text style={[styles.emptyText, { marginTop: 8 }]}>
              Das BNM-Team weist dir bald einen passenden Mentor zu.
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
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

function ProgressBar({ progress }: { progress: number }) {
  return (
    <View style={styles.progressTrack}>
      <View
        style={[styles.progressFill, { width: progress + "%" }]}
      />
    </View>
  );
}

function MonthlyChart({ mentorships }: { mentorships: Mentorship[] }) {
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
    <View style={styles.chartCard}>
      <Text style={styles.cardTitle}>Neue Betreuungen (letzte 4 Monate)</Text>
      <View style={styles.chartArea}>
        {/* Y-Achse */}
        <View style={styles.yAxis}>
          {[maxCount, Math.ceil(maxCount / 2), 0].map((val, idx) => (
            <Text key={idx} style={styles.yLabel}>{val}</Text>
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
                  <Text style={styles.barValueLabel}>{month.count > 0 ? month.count : ""}</Text>
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
                <Text style={styles.xLabel}>{month.label}</Text>
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
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 20 },
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
  statLabel: { color: COLORS.secondary, fontSize: 12, marginBottom: 2 },
  statValue: { fontSize: 26, fontWeight: "700" },
  progressTrack: { height: 8, backgroundColor: COLORS.bg, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 4 },
  amberBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
  },
  amberTitle: { color: "#92400e", fontWeight: "600", marginBottom: 4 },
  amberRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#fef3c7",
  },
  menteeNameText: { color: COLORS.primary, fontWeight: "500" },
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
    marginBottom: 16,
  },
  actionButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "600", textAlign: "center" },
  actionButtonGold: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    marginBottom: 16,
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
  },
  chatButtonText: { color: COLORS.secondary, fontSize: 12, fontWeight: "600" },
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
  doneChip: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  doneChipText: { color: "#15803d", fontSize: 12 },
  chartCard: {
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
});
