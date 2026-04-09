import React from "react";
import {
  View,
  Text,
  StyleSheet,
} from "react-native";
import { BNMPressable } from "./BNMPressable";

// Hilfsfunktion: Sterne-Anzeige (1-5, mit halben Sternen)
function StarDisplay({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = rating >= i;
        const half = !filled && rating >= i - 0.5;
        return (
          <Text key={i} style={{ fontSize: 14, color: filled || half ? "#FFCA28" : "#D1D5DB" }}>
            {filled ? "★" : half ? "⯨" : "☆"}
          </Text>
        );
      })}
    </View>
  );
}
import { useRouter } from "expo-router";
import { useData } from "../contexts/DataContext";
import { useAuth } from "../contexts/AuthContext";
import { COLORS, RADIUS } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";

interface MentorDetailPanelProps {
  id: string | null;
}

export function MentorDetailPanel({ id }: MentorDetailPanelProps) {
  const router = useRouter();
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
    feedback,
  } = useData();

  if (!id) return null;

  const mentor = getUserById(id);
  const myMentorships = getMentorshipsByMentorId(id);

  // Mentee-Feedback-Durchschnitt berechnen
  const mentorFeedback = feedback.filter((f) =>
    myMentorships.some((m) => m.id === f.mentorship_id)
  );
  const avgFeedbackRating = mentorFeedback.length > 0
    ? mentorFeedback.reduce((sum, f) => sum + f.rating, 0) / mentorFeedback.length
    : null;
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
      <View style={styles.emptyBox}>
        <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("mentorDetail.notFound")}</Text>
      </View>
    );
  }

  const initials = mentor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <View style={styles.content}>

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

        {/* Bewertungen — Mentee-Feedback-Durchschnitt */}
        {avgFeedbackRating !== null && (
          <View style={styles.ratingsBlock}>
            <View style={styles.ratingRow}>
              <Text style={[styles.ratingLabel, { color: themeColors.textSecondary }]}>{t("mentorDetail.menteeRating")}</Text>
              <StarDisplay rating={avgFeedbackRating} />
              <Text style={[styles.ratingValue, { color: themeColors.textTertiary }]}>
                ({avgFeedbackRating.toFixed(1)} · {mentorFeedback.length}x)
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Statistiken */}
      <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.stats")}</Text>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.statValue, { color: themeColors.text }]}>{activeMentorships.length}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.activeMentorships")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.statValue, { color: COLORS.cta }]}>{completedMentorships.length}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.completed")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.statValue, { color: COLORS.gold }]}>{totalSessions}</Text>
          <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("mentorDetail.totalSessions")}</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.statValue, { color: COLORS.link }]}>#{rank}</Text>
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
                <BNMPressable
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
                        <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                      </View>
                      <Text style={[styles.progressText, { color: themeColors.textTertiary }]}>
                        {completedStepIds.length}/{sessionTypes.length}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.arrowText, { color: themeColors.textTertiary }]}>›</Text>
                </BNMPressable>
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
        <BNMPressable
          style={styles.editProfileButton}
          onPress={() =>
            router.push({ pathname: "/admin/edit-user", params: { id: mentor.id } })
          }
        >
          <Text style={styles.editProfileButtonText}>{t("editUser.editProfile")}</Text>
        </BNMPressable>
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { fontSize: 16 },
  profileCard: {
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.full,
  },
  rankBadgeText: { color: COLORS.goldText, fontSize: 13, fontWeight: "700" },
  ratingsBlock: { marginTop: 12, gap: 6, alignSelf: "stretch", paddingHorizontal: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" },
  ratingLabel: { fontSize: 12, fontWeight: "500" },
  ratingValue: { fontSize: 11 },
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
    borderRadius: RADIUS.sm,
    padding: 14,
    alignItems: "center",
  },
  statValue: { fontSize: 26, fontWeight: "bold" },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  card: {
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.full,
    overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: RADIUS.full },
  progressText: { fontSize: 11 },
  arrowText: { fontSize: 20 },
  completedBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.successBg,
    alignItems: "center",
    justifyContent: "center",
  },
  completedBadgeText: { color: COLORS.successDark, fontWeight: "bold" },
  emptyCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
  },
  emptyCardText: { fontSize: 14 },
  editProfileButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.xs,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 20,
  },
  editProfileButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
