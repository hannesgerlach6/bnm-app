import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";

interface MentorScore {
  mentorId: string;
  name: string;
  city: string;
  gender: "male" | "female";
  completedCount: number;
  sessionCount: number;
  score: number;
}

const MEDAL_COLORS = ["#EEA71B", "#9CA3AF", "#CD7F32"] as const;
const MEDAL_EMOJIS = ["🥇", "🥈", "🥉"] as const;

type GenderFilter = "all" | "male" | "female";

export default function LeaderboardScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { users, mentorships, sessions, mentorOfMonthVisible, refreshData } = useData();

  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const allScored: MentorScore[] = useMemo(() => {
    const mentors = users.filter((u) => u.role === "mentor");
    return mentors
      .map((mentor) => {
        const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
        const completedCount = myMentorships.filter((m) => m.status === "completed").length;
        const sessionCount = sessions.filter((s) =>
          myMentorships.some((m) => m.id === s.mentorship_id)
        ).length;
        const score = completedCount * 10 + sessionCount * 3;
        return {
          mentorId: mentor.id,
          name: mentor.name,
          city: mentor.city,
          gender: mentor.gender,
          completedCount,
          sessionCount,
          score,
        };
      })
      .sort((a, b) => b.score - a.score);
  }, [users, mentorships, sessions]);

  const ranked: MentorScore[] = useMemo(() => {
    let base: MentorScore[];
    if (user?.role === "mentor" || user?.role === "mentee") {
      base = allScored.filter((m) => m.gender === user.gender);
    } else if (genderFilter === "all") {
      base = allScored;
    } else {
      base = allScored.filter((m) => m.gender === genderFilter);
    }
    if (search) {
      const sl = search.toLowerCase();
      base = base.filter(
        (m) => m.name.toLowerCase().includes(sl) || m.city.toLowerCase().includes(sl)
      );
    }
    return base;
  }, [allScored, user, genderFilter, search]);

  const mentorOfMonthMale = useMemo(() => {
    const males = allScored.filter((m) => m.gender === "male" && m.score > 0);
    return males.length > 0 ? males[0] : null;
  }, [allScored]);

  const mentorOfMonthFemale = useMemo(() => {
    const females = allScored.filter((m) => m.gender === "female" && m.score > 0);
    return females.length > 0 ? females[0] : null;
  }, [allScored]);

  const mentorOfMonthForUser = useMemo(() => {
    if (user?.role === "mentor" || user?.role === "mentee") {
      return user.gender === "male" ? mentorOfMonthMale : mentorOfMonthFemale;
    }
    // Admin und Office sehen nach Filter
    if (genderFilter === "male") return mentorOfMonthMale;
    if (genderFilter === "female") return mentorOfMonthFemale;
    return ranked.length > 0 && ranked[0].score > 0 ? ranked[0] : null;
  }, [user, genderFilter, mentorOfMonthMale, mentorOfMonthFemale, ranked]);

  const myRankIndex = user?.role === "mentor"
    ? ranked.findIndex((r) => r.mentorId === user.id)
    : -1;

  const isAdmin = user?.role === "admin" || user?.role === "office";

  const listTitle = useMemo(() => {
    if (user?.role === "mentor" || user?.role === "mentee") {
      return user.gender === "male" ? t("leaderboard.brothersList") : t("leaderboard.sistersList");
    }
    if (genderFilter === "male") return t("leaderboard.brothersList");
    if (genderFilter === "female") return t("leaderboard.sistersList");
    return t("leaderboard.allMentors");
  }, [user, genderFilter, t]);

  return (
    <Container>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("leaderboard.title")}</Text>
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("leaderboard.subtitle")}
          </Text>

          {/* Suche nach Mentor-Name */}
          <TextInput
            style={[styles.searchInput, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder={t("leaderboard.searchPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />

          {/* Admin-Filter für Geschlecht */}
          {isAdmin && (
            <View style={[styles.filterCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.filterLabel, { color: themeColors.textTertiary }]}>{t("leaderboard.filter")}</Text>
              <View style={styles.filterRow}>
                {(
                  [
                    { key: "all", label: t("leaderboard.all") },
                    { key: "male", label: t("leaderboard.brothers") },
                    { key: "female", label: t("leaderboard.sisters") },
                  ] as const
                ).map((opt) => (
                  <TouchableOpacity
                    key={opt.key}
                    style={[
                      styles.filterChip,
                      genderFilter === opt.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.background, borderColor: themeColors.border }],
                    ]}
                    onPress={() => setGenderFilter(opt.key)}
                  >
                    <Text
                      style={
                        genderFilter === opt.key
                          ? styles.filterChipTextActive
                          : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                      }
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Hinweis für Mentor/Mentee */}
          {(user?.role === "mentor" || user?.role === "mentee") && (
            <View style={styles.genderHintBox}>
              <Text style={styles.genderHintText}>
                {user.gender === "male"
                  ? t("leaderboard.hintBrothers")
                  : t("leaderboard.hintSisters")}
              </Text>
            </View>
          )}

          {/* Mentor des Monats */}
          {mentorOfMonthVisible && mentorOfMonthForUser && (
            <View style={styles.momBanner}>
              <View style={styles.momHeader}>
                <Text style={styles.momStar}>★</Text>
                <Text style={[styles.momTitle, { color: themeColors.text }]}>{t("leaderboard.mentorOfMonth")}</Text>
              </View>
              <Text style={[styles.momName, { color: themeColors.text }]}>{mentorOfMonthForUser.name}</Text>
              <View style={styles.momStatsRow}>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.score}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.points")}</Text>
                </View>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.completedCount}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.completions")}</Text>
                </View>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.sessionCount}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.sessions")}</Text>
                </View>
              </View>
            </View>
          )}

          {/* Eigene Position (nur für Mentoren) */}
          {user?.role === "mentor" && myRankIndex >= 0 && (
            <View style={styles.myPositionCard}>
              <Text style={styles.myPositionLabel}>{t("leaderboard.yourPosition")}</Text>
              <Text style={styles.myPositionRank}>{t("leaderboard.place").replace("{0}", String(myRankIndex + 1))}</Text>
              <Text style={styles.myPositionScore}>
                {ranked[myRankIndex].score} {t("leaderboard.points")}
              </Text>
            </View>
          )}

          {/* Rangliste */}
          <View style={[styles.card, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>{listTitle}</Text>
            {ranked.length === 0 ? (
              <View style={styles.emptyStateContainer}>
                <Text style={[styles.emptyStateText, { color: themeColors.textTertiary }]}>{t("leaderboard.noMentorsYet")}</Text>
              </View>
            ) : (
              ranked.map((item, index) => {
                const isTop3 = index < 3;
                const isMe = user?.role === "mentor" && item.mentorId === user.id;
                const medalColor = isTop3 ? MEDAL_COLORS[index] : undefined;

                return (
                  <TouchableOpacity
                    key={item.mentorId}
                    style={[
                      styles.rankRow,
                      index < ranked.length - 1 ? [styles.rankRowBorder, { borderBottomColor: themeColors.border }] : {},
                      isMe ? [styles.rankRowHighlight, { backgroundColor: themeColors.background }] : {},
                    ]}
                    onPress={() =>
                      router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } })
                    }
                  >
                    <View
                      style={[
                        styles.rankBadge,
                        isTop3
                          ? { backgroundColor: medalColor }
                          : { backgroundColor: themeColors.background },
                      ]}
                    >
                      {isTop3 ? (
                        <Text style={styles.rankBadgeTextWhite}>
                          {MEDAL_EMOJIS[index]}
                        </Text>
                      ) : (
                        <Text style={[styles.rankBadgeTextDark, { color: themeColors.textSecondary }]}>{index + 1}</Text>
                      )}
                    </View>

                    <View style={styles.rankInfo}>
                      <View style={styles.rankNameRow}>
                        <Text style={[styles.rankName, { color: themeColors.text }]}>{item.name}</Text>
                        {isMe && (
                          <View style={styles.meChip}>
                            <Text style={styles.meChipText}>{t("leaderboard.you")}</Text>
                          </View>
                        )}
                        {isTop3 && (
                          <View style={[styles.medalChip, { backgroundColor: medalColor }]}>
                            <Text style={styles.medalChipText}>{[t("leaderboard.medalGold"), t("leaderboard.medalSilver"), t("leaderboard.medalBronze")][index]}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.rankSub, { color: themeColors.textTertiary }]}>
                        {item.city} · {item.gender === "male" ? t("leaderboard.brother") : t("leaderboard.sister")}
                      </Text>
                      <Text style={[styles.rankDetail, { color: themeColors.textSecondary }]}>
                        {item.completedCount} {t("leaderboard.completions")} · {item.sessionCount} {t("leaderboard.sessions")}
                      </Text>
                    </View>

                    <View style={styles.scoreBox}>
                      <Text
                        style={[
                          styles.scoreValue,
                          isTop3 ? { color: medalColor } : { color: themeColors.text },
                        ]}
                      >
                        {item.score}
                      </Text>
                      <Text style={[styles.scoreLabel, { color: themeColors.textTertiary }]}>{t("leaderboard.points_short")}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

          {/* Legende */}
          <View style={[styles.legendCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.legendTitle, { color: themeColors.text }]}>{t("leaderboard.legendTitle")}</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendDot} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>
                {t("leaderboard.legendCompleted")}
              </Text>
            </View>
            <View style={styles.legendRow}>
              <View style={styles.legendDot} />
              <Text style={[styles.legendText, { color: themeColors.textSecondary }]}>
                {t("leaderboard.legendSession")}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  pageTitle: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  pageSubtitle: { marginBottom: 24, fontSize: 13 },

  filterCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  filterLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 5, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: {},
  filterChipTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  filterChipTextInactive: { fontSize: 13 },

  genderHintBox: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  genderHintText: { color: COLORS.white, opacity: 0.9, fontSize: 13 },

  momBanner: {
    backgroundColor: "rgba(238,167,27,0.08)",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.4)",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    borderRadius: 8,
    padding: 20,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  momHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  momStar: { color: COLORS.gold, fontSize: 22, marginRight: 8 },
  momTitle: { fontWeight: "700", fontSize: 15 },
  momName: { fontSize: 22, fontWeight: "700", marginBottom: 16 },
  momStatsRow: { flexDirection: "row", gap: 12 },
  momStatPill: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
  },
  momStatValue: { fontSize: 20, fontWeight: "700", color: COLORS.gold },
  momStatLabel: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },

  myPositionCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  myPositionLabel: { color: COLORS.white, opacity: 0.75, fontSize: 13 },
  myPositionRank: { color: COLORS.gold, fontWeight: "700", fontSize: 20 },
  myPositionScore: { color: COLORS.white, fontWeight: "700", fontSize: 16 },

  card: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontWeight: "700", marginBottom: 16, fontSize: 15 },
  emptyText: { textAlign: "center", fontSize: 14, paddingVertical: 16 },
  emptyStateContainer: { paddingVertical: 24, alignItems: "center" },
  emptyStateText: { textAlign: "center", fontSize: 14, lineHeight: 20 },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  rankRowBorder: { borderBottomWidth: 1 },
  rankRowHighlight: {
    borderRadius: 6,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },

  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankBadgeTextWhite: { fontSize: 20 },
  rankBadgeTextDark: { fontWeight: "700", fontSize: 14 },

  rankInfo: { flex: 1 },
  rankNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  rankName: { fontWeight: "600", fontSize: 15 },
  meChip: {
    backgroundColor: "#dbeafe",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  meChipText: { color: "#1d4ed8", fontSize: 11, fontWeight: "600" },
  medalChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  medalChipText: { color: COLORS.white, fontSize: 11, fontWeight: "600" },
  rankSub: { fontSize: 12 },
  rankDetail: { fontSize: 12, marginTop: 2 },

  scoreBox: { alignItems: "center" },
  scoreValue: { fontSize: 22, fontWeight: "700" },
  scoreLabel: { fontSize: 11 },

  legendCard: {
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    padding: 16,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  legendTitle: { fontWeight: "700", marginBottom: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  legendText: { fontSize: 13 },
  legendBold: { fontWeight: "700" },
  searchInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 16,
  },
});
