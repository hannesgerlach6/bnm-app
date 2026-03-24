import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function MentorDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { user: authUser } = useAuth();
  const isAdminOrOffice = authUser?.role === "admin" || authUser?.role === "office";
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
        <View style={[styles.root, { backgroundColor: themeColors.background }]}>
          <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: themeColors.text }]}>{t("mentorDetail.back")}</Text>
            </TouchableOpacity>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("mentorDetail.title")}</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("mentorDetail.notFound")}</Text>
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
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("mentorDetail.back")}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("mentorDetail.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Profil-Card */}
          <View style={[styles.profileCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={[styles.profileName, { color: themeColors.text }]}>{mentor.name}</Text>
            <Text style={[styles.profileSub, { color: themeColors.textSecondary }]}>
              {mentor.city} · {mentor.age} {t("common.yearsOld")} ·{" "}
              {mentor.gender === "male" ? t("mentorDetail.brother") : t("mentorDetail.sister")}
            </Text>
            {rank > 0 && (
              <View style={styles.rankBadge}>
                <Text style={styles.rankBadgeText}>{t("mentorDetail.rankingLabel").replace("{0}", String(rank))}</Text>
              </View>
            )}
          </View>

          {/* Statistiken */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.stats")}</Text>
          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statValue, { color: themeColors.text }]}>
                {activeMentorships.length}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.activeMentorships")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statValue, { color: COLORS.cta }]}>
                {completedMentorships.length}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.completed")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statValue, { color: COLORS.gold }]}>
                {totalSessions}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.totalSessions")}</Text>
            </View>
            <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.statValue, { color: COLORS.link }]}>
                #{rank}
              </Text>
              <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.rankingPosition")}</Text>
            </View>
          </View>

          {/* Aktuelle Mentees */}
          {activeMentorships.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.activeMentees")}</Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                {activeMentorships.map((mentorship, idx) => {
                  const completedStepIds = getCompletedStepIds(mentorship.id);
                  const progress = sessionTypes.length > 0
                    ? Math.round((completedStepIds.length / sessionTypes.length) * 100)
                    : 0;
                  const isLast = idx === activeMentorships.length - 1;

                  return (
                    <TouchableOpacity
                      key={mentorship.id}
                      style={[styles.menteeRow, !isLast && [styles.menteeRowBorder, { borderBottomColor: themeColors.border }]]}
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
                        <Text style={[styles.menteeName, { color: themeColors.text }]}>
                          {mentorship.mentee?.name ?? t("feedbackOverview.unknown")}
                        </Text>
                        <Text style={[styles.menteeSub, { color: themeColors.textTertiary }]}>
                          {mentorship.mentee?.city} ·{" "}
                          {mentorship.mentee?.gender === "male" ? t("mentorDetail.brother") : t("mentorDetail.sister")}
                        </Text>
                        <View style={styles.progressRow}>
                          <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
                            <View
                              style={[styles.progressFill, { width: `${progress}%` as any }]}
                            />
                          </View>
                          <Text style={[styles.progressText, { color: themeColors.textTertiary }]}>
                            {completedStepIds.length}/{sessionTypes.length}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.arrowText, { color: themeColors.textTertiary }]}>›</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Abgeschlossene Betreuungen */}
          {completedMentorships.length > 0 && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.completedMentorships")}</Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                {completedMentorships.map((mentorship, idx) => {
                  const isLast = idx === completedMentorships.length - 1;
                  return (
                    <View
                      key={mentorship.id}
                      style={[styles.completedRow, !isLast && [styles.menteeRowBorder, { borderBottomColor: themeColors.border }]]}
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
                        <Text style={[styles.menteeName, { color: themeColors.text }]}>
                          {mentorship.mentee?.name ?? t("feedbackOverview.unknown")}
                        </Text>
                        {mentorship.completed_at && (
                          <Text style={[styles.menteeSub, { color: themeColors.textTertiary }]}>
                            {t("mentorDetail.completedOn").replace("{0}", new Date(mentorship.completed_at).toLocaleDateString("de-DE"))}
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
            <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyCardText, { color: themeColors.textTertiary }]}>
                {t("mentorDetail.noMentorships")}
              </Text>
            </View>
          )}

          {/* Admin-Aktionen */}
          {isAdminOrOffice && (
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={() =>
                router.push({ pathname: "/admin/edit-user", params: { id: mentor.id } })
              }
            >
              <Text style={styles.editProfileButtonText}>{t("editUser.editProfile")}</Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { fontSize: 16 },
  profileCard: {
    borderRadius: 8,
    borderWidth: 1,
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
  profileName: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  profileSub: { fontSize: 14, marginBottom: 10 },
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
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: "bold" },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  menteeRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  menteeRowBorder: { borderBottomWidth: 1 },
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
  menteeName: { fontWeight: "700", fontSize: 14 },
  menteeSub: { fontSize: 12, marginTop: 2 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressText: { fontSize: 11 },
  arrowText: { fontSize: 20 },
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
  emptyCardText: { fontSize: 14 },
  editProfileButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  editProfileButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
