import React from "react";
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";

export default function DashboardScreen() {
  const { user } = useAuth();

  if (!user) return null;

  if (user.role === "admin") return <AdminDashboard />;
  if (user.role === "mentor") return <MentorDashboard />;
  return <MenteeDashboard />;
}

function AdminDashboard() {
  const router = useRouter();
  const {
    users,
    mentorships,
    sessionTypes,
    getCompletedStepIds,
    getUnassignedMentees,
  } = useData();

  const allMentors = users.filter((u) => u.role === "mentor");
  const allMentees = users.filter((u) => u.role === "mentee");
  const activeMentorships = mentorships.filter((m) => m.status === "active");
  const completedMentorships = mentorships.filter(
    (m) => m.status === "completed"
  );
  const unassignedMentees = getUnassignedMentees();

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Admin Dashboard</Text>
        <Text style={styles.pageSubtitle}>Gesamtübersicht BNM-Programm</Text>

        {/* KPI Karten – Reihe 1 */}
        <View style={styles.row3}>
          <StatCard label="Aktive Betreuungen" value={activeMentorships.length} color={COLORS.primary} />
          <StatCard label="Abgeschlossen" value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* KPI Karten – Reihe 2 */}
        <View style={[styles.row3, { marginBottom: 24 }]}>
          <StatCard label="Mentoren" value={allMentors.length} color={COLORS.primary} />
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
            style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
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
        {/* Begrüssung */}
        <View style={styles.greetingCard}>
          <Text style={styles.greetingSmall}>Salam Aleikum,</Text>
          <Text style={styles.greetingName}>{user.name}</Text>
          <Text style={styles.greetingMeta}>
            {user.city} · {user.gender === "male" ? "Bruder" : "Schwester"}
          </Text>
        </View>

        {/* Stats */}
        <View style={[styles.row3, { marginBottom: 24 }]}>
          <StatCard label="Aktive Mentees" value={activeMentorships.length} color={COLORS.primary} />
          <StatCard label="Abgeschlossen" value={completedMentorships.length} color={COLORS.cta} />
        </View>

        {/* Aktive Betreuungen */}
        <Text style={styles.sectionTitle}>Meine aktiven Betreuungen</Text>
        {activeMentorships.length === 0 ? (
          <View style={[styles.card, { padding: 32, alignItems: "center", marginBottom: 24 }]}>
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
        {/* Begrüssung */}
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
            <View style={[styles.card, { marginBottom: 24 }]}>
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
            <View style={[styles.row3, { marginBottom: 24 }]}>
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
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
            <View style={[styles.card, { padding: 0, overflow: "hidden", marginBottom: 24 }]}>
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

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 24 },
  sectionTitle: { fontWeight: "bold", color: COLORS.primary, marginBottom: 12 },
  row3: { flexDirection: "row", gap: 12, marginBottom: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  cardTitle: { fontWeight: "bold", color: COLORS.primary, marginBottom: 12 },
  emptyText: { color: COLORS.tertiary, textAlign: "center", fontSize: 14, paddingVertical: 16 },
  listItem: { paddingVertical: 12 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  rowBetweenMb2: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  rowBetweenMb3: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  semiboldPrimary: { fontWeight: "600", color: COLORS.primary },
  boldPrimary: { fontWeight: "bold", color: COLORS.primary },
  tertiaryXs: { color: COLORS.tertiary, fontSize: 12 },
  percentBadge: { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  percentBadgeText: { color: COLORS.primary, fontSize: 12, fontWeight: "bold" },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: { color: COLORS.tertiary, fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 30, fontWeight: "bold" },
  progressTrack: { height: 8, backgroundColor: COLORS.bg, borderRadius: 9999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  amberBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
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
  assignButton: { backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 8 },
  assignButtonText: { color: COLORS.white, fontSize: 12, fontWeight: "600" },
  actionButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  actionButtonText: { color: COLORS.white, fontSize: 12, fontWeight: "600", textAlign: "center" },
  actionButtonGold: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginBottom: 24,
    backgroundColor: "rgba(238,167,27,0.2)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
  },
  actionButtonTextDark: { color: COLORS.primary, fontSize: 12, fontWeight: "600", textAlign: "center" },
  blueBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 12,
    padding: 16,
  },
  blueTitle: { color: "#1e40af", fontWeight: "600", fontSize: 14, marginBottom: 4 },
  blueText: { color: "#2563eb", fontSize: 12 },
  greetingCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  greetingSmall: { color: COLORS.white, fontSize: 14, opacity: 0.7, marginBottom: 4 },
  greetingName: { color: COLORS.white, fontSize: 20, fontWeight: "bold" },
  greetingMeta: { color: COLORS.white, opacity: 0.6, fontSize: 14, marginTop: 4 },
  menteeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  stepsBadge: {
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  stepsBadgeText: { color: COLORS.primary, fontSize: 14, fontWeight: "bold" },
  nextStepRow: { marginTop: 12, flexDirection: "row", alignItems: "center" },
  goldDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: COLORS.gold, marginRight: 8 },
  nextStepText: { color: COLORS.secondary, fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  docButton: {
    flex: 1,
    backgroundColor: "rgba(39,174,96,0.1)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  docButtonText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  chatButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  chatButtonText: { color: COLORS.secondary, fontSize: 12, fontWeight: "600" },
  goldBox: {
    backgroundColor: "rgba(238,167,27,0.1)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  goldBoxHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  goldStar: { color: COLORS.gold, fontSize: 18, marginRight: 8 },
  goldBoxTitle: { fontWeight: "bold", color: COLORS.primary },
  goldBoxText: { color: COLORS.secondary, fontSize: 14 },
  goldBold: { color: COLORS.gold, fontWeight: "bold" },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  secondaryButtonText: { color: COLORS.secondary, fontSize: 12, fontWeight: "600" },
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
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepIndicatorTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  stepIndicatorTextTertiary: { color: COLORS.tertiary, fontSize: 14, fontWeight: "bold" },
  stepName: { fontWeight: "500" },
  currentStepLabel: { color: COLORS.secondary, fontSize: 12, marginTop: 2 },
  doneChip: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  doneChipText: { color: "#15803d", fontSize: 12 },
});
