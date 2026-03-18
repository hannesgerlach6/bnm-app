import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";

export default function MentorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const {
    getUserById,
    getMentorshipsByMentorId,
    getCompletedStepIds,
    sessionTypes,
    sessions,
    users,
  } = useData();

  const mentor = getUserById(id);
  const myMentorships = getMentorshipsByMentorId(id);
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");
  const totalSessions = sessions.filter((s) =>
    myMentorships.some((m) => m.id === s.mentorship_id)
  ).length;

  // Ranking berechnen
  const allMentors = users.filter((u) => u.role === "mentor");
  const scores = allMentors.map((m) => {
    const ms = getMentorshipsByMentorId(m.id);
    const completed = ms.filter((x) => x.status === "completed").length;
    const sessionsCnt = sessions.filter((s) =>
      ms.some((x) => x.id === s.mentorship_id)
    ).length;
    return { mentorId: m.id, score: completed * 10 + sessionsCnt * 3 };
  });
  scores.sort((a, b) => b.score - a.score);
  const rank = scores.findIndex((s) => s.mentorId === id) + 1;

  if (!mentor) {
    return (
      <Container>
        <View style={styles.root}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹ Zurück</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mentor-Profil</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Mentor nicht gefunden.</Text>
          </View>
        </View>
      </Container>
    );
  }

  const initials = mentor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mentor-Profil</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Profil-Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.profileName}>{mentor.name}</Text>
            <Text style={styles.profileSub}>
              {mentor.city} · {mentor.age} Jahre ·{" "}
              {mentor.gender === "male" ? "Bruder" : "Schwester"}
            </Text>
            {rank > 0 && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>#{rank} im Ranking</Text>
              </View>
            )}
          </View>

          {/* Statistiken */}
          <Text style={styles.sectionLabel}>STATISTIKEN</Text>
          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.primary }]}>
                {activeMentorships.length}
              </Text>
              <Text style={styles.statLabel}>Aktive Betreuungen</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.cta }]}>
                {completedMentorships.length}
              </Text>
              <Text style={styles.statLabel}>Abgeschlossen</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>
                {totalSessions}
              </Text>
              <Text style={styles.statLabel}>Sessions gesamt</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={[styles.statValue, { color: COLORS.link }]}>
                #{rank}
              </Text>
              <Text style={styles.statLabel}>Ranking-Position</Text>
            </View>
          </View>

          {/* Aktuelle Mentees */}
          {activeMentorships.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>AKTUELLE MENTEES</Text>
              <View style={styles.card}>
                {activeMentorships.map((mentorship, idx) => {
                  const completedStepIds = getCompletedStepIds(mentorship.id);
                  const progress = sessionTypes.length > 0
                    ? Math.round((completedStepIds.length / sessionTypes.length) * 100)
                    : 0;
                  const isLast = idx === activeMentorships.length - 1;

                  return (
                    <TouchableOpacity
                      key={mentorship.id}
                      style={[styles.menteeRow, !isLast && styles.menteeRowBorder]}
                      onPress={() =>
                        router.push({ pathname: "/mentee/[id]", params: { id: mentorship.mentee_id } })
                      }
                    >
                      <View style={styles.menteeAvatar}>
                        <Text style={styles.menteeAvatarText}>
                          {(mentorship.mentee?.name ?? "?")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </Text>
                      </View>
                      <View style={styles.menteeInfo}>
                        <Text style={styles.menteeName}>
                          {mentorship.mentee?.name ?? "Unbekannt"}
                        </Text>
                        <Text style={styles.menteeSub}>
                          {mentorship.mentee?.city} ·{" "}
                          {mentorship.mentee?.gender === "male" ? "Bruder" : "Schwester"}
                        </Text>
                        <View style={styles.progressRow}>
                          <View style={styles.progressTrack}>
                            <View
                              style={[styles.progressFill, { width: progress + "%" }]}
                            />
                          </View>
                          <Text style={styles.progressText}>
                            {completedStepIds.length}/{sessionTypes.length}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.arrowText}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Abgeschlossene Betreuungen */}
          {completedMentorships.length > 0 && (
            <>
              <Text style={styles.sectionLabel}>ABGESCHLOSSENE BETREUUNGEN</Text>
              <View style={styles.card}>
                {completedMentorships.map((mentorship, idx) => {
                  const isLast = idx === completedMentorships.length - 1;
                  return (
                    <View
                      key={mentorship.id}
                      style={[styles.completedRow, !isLast && styles.menteeRowBorder]}
                    >
                      <View style={[styles.menteeAvatar, { backgroundColor: "#dcfce7" }]}>
                        <Text style={[styles.menteeAvatarText, { color: "#15803d" }]}>
                          {(mentorship.mentee?.name ?? "?")
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                        </Text>
                      </View>
                      <View style={styles.menteeInfo}>
                        <Text style={styles.menteeName}>
                          {mentorship.mentee?.name ?? "Unbekannt"}
                        </Text>
                        {mentorship.completed_at && (
                          <Text style={styles.menteeSub}>
                            Abgeschlossen am{" "}
                            {new Date(mentorship.completed_at).toLocaleDateString("de-DE")}
                          </Text>
                        )}
                      </View>
                      <View style={styles.completedBadge}>
                        <Text style={styles.completedBadgeText}>✓</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {myMentorships.length === 0 && (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyCardText}>
                Noch keine Betreuungen.
              </Text>
            </View>
          )}

        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { flex: 1 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { color: COLORS.tertiary, fontSize: 16 },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: COLORS.white, fontSize: 22, fontWeight: "bold" },
  profileName: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  profileSub: { color: COLORS.secondary, fontSize: 14, marginBottom: 10 },
  rankBadge: {
    backgroundColor: "rgba(238,167,27,0.15)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  rankBadgeText: { color: "#92600a", fontSize: 13, fontWeight: "700" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: "44%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: "bold" },
  statLabel: { color: COLORS.tertiary, fontSize: 11, marginTop: 2, textAlign: "center" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 20,
  },
  menteeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menteeRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  completedRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menteeAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  menteeAvatarText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
  menteeInfo: { flex: 1 },
  menteeName: { fontWeight: "700", color: COLORS.primary, fontSize: 14 },
  menteeSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressText: { color: COLORS.tertiary, fontSize: 11 },
  arrowText: { color: COLORS.tertiary, fontSize: 20 },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  completedBadgeText: { color: "#15803d", fontWeight: "bold" },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
  },
  emptyCardText: { color: COLORS.tertiary, fontSize: 14 },
});
