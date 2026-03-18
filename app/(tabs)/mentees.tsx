import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { Mentorship } from "../../types";
import { COLORS } from "../../constants/Colors";

export default function MenteesScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "admin") return <AdminMenteesView />;
  if (user.role === "mentor") return <MentorMenteesView />;
  return <MenteeProgressView />;
}

function AdminMenteesView() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "assigned" | "unassigned">("all");
  const { users, mentorships, sessionTypes, getCompletedStepIds } = useData();

  const allMentees = users.filter((u) => u.role === "mentee");

  const filteredMentees = allMentees.filter((mentee) => {
    const hasMentorship = mentorships.find((m) => m.mentee_id === mentee.id);
    const matchesSearch =
      mentee.name.toLowerCase().includes(search.toLowerCase()) ||
      mentee.city.toLowerCase().includes(search.toLowerCase());
    const matchesFilter =
      filter === "all" ? true : filter === "assigned" ? !!hasMentorship : !hasMentorship;
    return matchesSearch && matchesFilter;
  });

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Alle Mentees</Text>
        <Text style={styles.pageSubtitle}>{allMentees.length} Mentees registriert</Text>

        {/* Suche */}
        <TextInput
          style={styles.searchInput}
          placeholder="Suchen nach Name oder Stadt..."
          placeholderTextColor="#98A2B3"
          value={search}
          onChangeText={setSearch}
        />

        {/* Filter-Tabs */}
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: "Alle" },
              { key: "assigned", label: "Zugewiesen" },
              { key: "unassigned", label: "Offen" },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                filter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setFilter(tab.key)}
            >
              <Text
                style={
                  filter === tab.key ? styles.filterChipTextActive : styles.filterChipTextInactive
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mentee-Liste */}
        {filteredMentees.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Keine Mentees gefunden.</Text>
          </View>
        ) : (
          filteredMentees.map((mentee) => {
            const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
            const completedSteps = mentorship ? getCompletedStepIds(mentorship.id) : [];
            const progress = mentorship
              ? Math.round((completedSteps.length / sessionTypes.length) * 100)
              : 0;

            const statusBg =
              mentorship
                ? mentorship.status === "active"
                  ? "#dcfce7"
                  : mentorship.status === "completed"
                  ? "#dbeafe"
                  : "#fee2e2"
                : "#fef3c7";
            const statusColor =
              mentorship
                ? mentorship.status === "active"
                  ? "#15803d"
                  : mentorship.status === "completed"
                  ? "#1d4ed8"
                  : "#b91c1c"
                : "#b45309";
            const statusLabel =
              mentorship
                ? mentorship.status === "active"
                  ? "Aktiv"
                  : mentorship.status === "completed"
                  ? "Abgeschlossen"
                  : "Abgebrochen"
                : "Offen";

            return (
              <TouchableOpacity
                key={mentee.id}
                style={styles.menteeCard}
                onPress={() => {
                  if (mentorship) {
                    router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } });
                  }
                }}
                disabled={!mentorship}
              >
                <View style={styles.menteeCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.meneeName}>{mentee.name}</Text>
                    <Text style={styles.menteeSubText}>
                      {mentee.city} · {mentee.age} J. ·{" "}
                      {mentee.gender === "male" ? "Bruder" : "Schwester"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {mentorship ? (
                  <>
                    <Text style={styles.mentorLabel}>Mentor: {mentorship.mentor?.name}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[styles.progressFill, { width: progress + "%" }]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {completedSteps.length}/{sessionTypes.length}
                      </Text>
                    </View>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={() =>
                      router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                    }
                  >
                    <Text style={styles.assignButtonText}>Mentor zuweisen</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function MentorMenteesView() {
  const { user } = useAuth();
  const { getMentorshipsByMentorId } = useData();

  if (!user) return null;

  const myMentorships = getMentorshipsByMentorId(user.id);

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Meine Mentees</Text>
        <Text style={styles.pageSubtitle}>
          {myMentorships.filter((m) => m.status === "active").length} aktive Betreuungen
        </Text>

        {myMentorships.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Dir sind noch keine Mentees zugewiesen.</Text>
          </View>
        ) : (
          myMentorships.map((mentorship) => (
            <MentorMenteeCard key={mentorship.id} mentorship={mentorship} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MentorMenteeCard({ mentorship }: { mentorship: Mentorship }) {
  const router = useRouter();
  const { getCompletedStepIds, getSessionsByMentorshipId, sessionTypes } = useData();

  const completedStepIds = getCompletedStepIds(mentorship.id);
  const sessions = getSessionsByMentorshipId(mentorship.id);
  const progress = Math.round((completedStepIds.length / sessionTypes.length) * 100);
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <TouchableOpacity
      style={styles.menteeCard}
      onPress={() =>
        router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
      }
    >
      {/* Mentee-Header */}
      <View style={styles.menteeCardHeader}>
        <View>
          <Text style={styles.meneeName}>{mentorship.mentee?.name}</Text>
          <Text style={styles.menteeSubText}>
            {mentorship.mentee?.city} · {mentorship.mentee?.age} J. ·{" "}
            {mentorship.mentee?.gender === "male" ? "Bruder" : "Schwester"}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: mentorship.status === "active" ? "#dcfce7" : "#f3f4f6" },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: mentorship.status === "active" ? "#15803d" : "#4b5563" },
            ]}
          >
            {mentorship.status === "active" ? "Aktiv" : "Abgeschlossen"}
          </Text>
        </View>
      </View>

      {/* Fortschrittsbalken */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: progress + "%" }]} />
        </View>
        <Text style={styles.progressText}>
          {completedStepIds.length}/{sessionTypes.length} Steps
        </Text>
      </View>

      {/* Step-Liste */}
      <Text style={styles.stepSectionLabel}>{"FORTSCHRITT"}</Text>
      <View style={styles.stepChipRow}>
        {sortedTypes.map((step, idx) => {
          const isDone = completedStepIds.includes(step.id);
          const isCurrent = !isDone && idx === completedStepIds.length;
          const chipBg = isDone ? "#dcfce7" : isCurrent ? "#fef3c7" : COLORS.bg;
          const chipColor = isDone ? "#15803d" : isCurrent ? "#b45309" : COLORS.tertiary;
          const chipWeight: "normal" | "500" = isDone || isCurrent ? "500" : "normal";
          return (
            <View key={step.id} style={[styles.stepChip, { backgroundColor: chipBg }]}>
              <Text style={[styles.stepChipText, { color: chipColor, fontWeight: chipWeight }]}>
                {idx + 1}. {step.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Session-Anzahl + Aktionen */}
      <View style={styles.cardFooter}>
        <Text style={styles.sessionCount}>
          {sessions.length} Session{sessions.length !== 1 ? "s" : ""} dokumentiert
        </Text>
        {mentorship.status === "active" && (
          <TouchableOpacity
            style={styles.docChipButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/document-session",
                params: { mentorshipId: mentorship.id },
              });
            }}
          >
            <Text style={styles.docChipText}>Session dokumentieren</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MenteeProgressView() {
  const { user } = useAuth();
  const router = useRouter();
  const {
    getMentorshipByMenteeId,
    getCompletedStepIds,
    getSessionsByMentorshipId,
    sessionTypes,
  } = useData();

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sessions = mentorship ? getSessionsByMentorshipId(mentorship.id) : [];
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  if (!mentorship) {
    return (
      <ScrollView style={styles.scrollView}>
        <View style={styles.page}>
          <Text style={styles.pageTitle}>Mein Fortschritt</Text>
          <View style={styles.emptyCard}>
            <Text style={[styles.meneeName, { textAlign: "center", marginBottom: 8 }]}>
              Noch keine Zuweisung
            </Text>
            <Text style={[styles.emptyText, { marginTop: 0 }]}>
              Das BNM-Team weist dir bald einen Mentor zu.
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const totalProgress = Math.round((completedStepIds.length / sessionTypes.length) * 100);

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Mein Fortschritt</Text>
        <Text style={styles.pageSubtitle}>Mentor: {mentorship.mentor?.name}</Text>

        {/* Gesamtfortschritt */}
        <View style={styles.progressHeaderCard}>
          <Text style={styles.progressHeaderLabel}>Gesamtfortschritt</Text>
          <Text style={styles.progressHeaderValue}>{totalProgress}%</Text>
          <View style={styles.progressTrackWhite}>
            <View
              style={[styles.progressFillGold, { width: totalProgress + "%" }]}
            />
          </View>
          <Text style={styles.progressHeaderSub}>
            {completedStepIds.length} von {sessionTypes.length} Schritten abgeschlossen
          </Text>
        </View>

        {/* Betreuungsdetails */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() =>
            router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
          }
        >
          <Text style={styles.detailsButtonText}>Betreuungsdetails ansehen</Text>
          <Text style={styles.detailsArrow}>›</Text>
        </TouchableOpacity>

        {/* Detaillierte Schritt-Liste */}
        <Text style={styles.sectionTitle}>Deine 10 Schritte im Detail</Text>
        <View style={[styles.emptyCard, { padding: 0, overflow: "hidden", marginBottom: 24 }]}>
          {sortedTypes.map((step, idx) => {
            const isDone = completedStepIds.includes(step.id);
            const isCurrent = !isDone && idx === completedStepIds.length;
            const isLocked = !isDone && idx > completedStepIds.length;
            const session = sessions.find((s) => s.session_type_id === step.id);

            return (
              <View
                key={step.id}
                style={[
                  styles.stepDetailRow,
                  idx < sessionTypes.length - 1 ? styles.stepDetailBorder : {},
                  isCurrent ? { backgroundColor: "#fffbeb" } : {},
                ]}
              >
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
                      style={
                        isCurrent ? styles.stepIndicatorTextWhite : styles.stepIndicatorTextTertiary
                      }
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <Text
                      style={[
                        styles.stepDetailName,
                        isDone
                          ? { color: COLORS.cta }
                          : isCurrent
                          ? { color: COLORS.primary }
                          : { color: COLORS.tertiary },
                      ]}
                    >
                      {step.name}
                    </Text>
                    {isLocked && (
                      <Text style={{ color: COLORS.tertiary, fontSize: 12 }}>Gesperrt</Text>
                    )}
                    {isCurrent && (
                      <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                        <Text style={{ color: "#b45309", fontSize: 12, fontWeight: "500" }}>Aktuell</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.stepDetailDesc}>{step.description}</Text>
                  {isDone && session && (
                    <Text style={{ color: "#16a34a", fontSize: 12, marginTop: 4 }}>
                      Abgeschlossen am{" "}
                      {new Date(session.date).toLocaleDateString("de-DE")}
                      {session.is_online ? " (Online)" : " (Vor Ort)"}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 24 },
  sectionTitle: { fontWeight: "bold", color: COLORS.primary, marginBottom: 12 },
  searchInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.primary,
    marginBottom: 16,
  },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  filterChipTextActive: { color: COLORS.white, fontSize: 14, fontWeight: "500" },
  filterChipTextInactive: { color: COLORS.secondary, fontSize: 14, fontWeight: "500" },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
  },
  emptyText: { color: COLORS.tertiary, textAlign: "center", fontSize: 14, marginTop: 8 },
  menteeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  menteeCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  meneeName: { fontWeight: "bold", color: COLORS.primary },
  menteeSubText: { color: COLORS.tertiary, fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  statusText: { fontSize: 12, fontWeight: "500" },
  mentorLabel: { color: COLORS.tertiary, fontSize: 12, marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.bg, borderRadius: 9999, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressText: { color: COLORS.secondary, fontSize: 12 },
  assignButton: {
    marginTop: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  assignButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  stepSectionLabel: {
    color: COLORS.tertiary,
    fontSize: 12,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 1,
  },
  stepChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  stepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  stepChipText: { fontSize: 12 },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionCount: { color: COLORS.tertiary, fontSize: 12 },
  docChipButton: {
    backgroundColor: "rgba(39,174,96,0.1)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  docChipText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  progressHeaderCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  progressHeaderLabel: { color: COLORS.white, opacity: 0.7, fontSize: 14, marginBottom: 4 },
  progressHeaderValue: { color: COLORS.white, fontSize: 36, fontWeight: "bold", marginBottom: 12 },
  progressTrackWhite: { height: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 9999, overflow: "hidden" },
  progressFillGold: { height: "100%", backgroundColor: COLORS.gold, borderRadius: 9999 },
  progressHeaderSub: { color: COLORS.white, opacity: 0.6, fontSize: 12, marginTop: 8 },
  detailsButton: {
    backgroundColor: "rgba(39,174,96,0.1)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsButtonText: { color: COLORS.cta, fontWeight: "600" },
  detailsArrow: { color: COLORS.cta },
  stepDetailRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 16 },
  stepDetailBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  stepIndicatorTextWhite: { color: COLORS.white, fontWeight: "bold" },
  stepIndicatorTextTertiary: { color: COLORS.tertiary, fontSize: 14, fontWeight: "bold" },
  stepDetailName: { fontWeight: "600" },
  stepDetailDesc: { color: COLORS.tertiary, fontSize: 12 },
});
