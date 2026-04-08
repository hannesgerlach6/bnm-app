import React, { useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import type { TranslationKeys } from "../../lib/translations/de";
import { EmptyState } from "../../components/EmptyState";

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
  usePageTitle("Leaderboard");
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, mentorships, sessions, mentorOfMonthVisible, refreshData } = useData();

  // Aktuelles Datum einmalig speichern (für Monats-Picker-Limit)
  const now = useMemo(() => new Date(), []);
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Monat-/Jahres-Picker: Default = aktueller Monat
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth); // 1-12
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

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

  // Monatsnamen aus i18n
  const monthName = t(`datePicker.month.${selectedMonth}` as TranslationKeys);

  // Monat vor / zurück navigieren
  const goToPrevMonth = useCallback(() => {
    setSelectedMonth((m) => {
      if (m === 1) { setSelectedYear((y) => y - 1); return 12; }
      return m - 1;
    });
  }, []);
  const goToNextMonth = useCallback(() => {
    setSelectedMonth((m) => {
      const nextM = m === 12 ? 1 : m + 1;
      const nextY = m === 12 ? selectedYear + 1 : selectedYear;
      // Nicht in die Zukunft navigieren
      if (nextY > currentYear || (nextY === currentYear && nextM > currentMonth)) return m;
      if (m === 12) setSelectedYear((y) => y + 1);
      return nextM;
    });
  }, [selectedYear, currentMonth, currentYear]);

  // Prüft ob der ausgewählte Monat der aktuelle ist (kein Weiter-Button mehr zeigen)
  const isCurrentMonth = selectedMonth === currentMonth && selectedYear === currentYear;

  const allScored: MentorScore[] = useMemo(() => {
    const mentors = users.filter((u) => u.role === "mentor");

    // Beginn und Ende des ausgewählten Monats als ISO-Strings
    const monthStart = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
    const monthEnd = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999).toISOString();

    return mentors
      .map((mentor) => {
        const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);

        // Abgeschlossene Betreuungen im ausgewählten Monat
        const completedCount = myMentorships.filter((m) => {
          if (m.status !== "completed") return false;
          if (!m.completed_at) return false;
          return m.completed_at >= monthStart && m.completed_at <= monthEnd;
        }).length;

        // Sessions im ausgewählten Monat
        const sessionCount = sessions.filter((s) => {
          if (!myMentorships.some((m) => m.id === s.mentorship_id)) return false;
          // session.date ist ein DATE-String ("YYYY-MM-DD")
          const sessionDate = s.date + "T00:00:00.000Z";
          return sessionDate >= monthStart && sessionDate <= monthEnd;
        }).length;

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
  }, [users, mentorships, sessions, selectedMonth, selectedYear]);

  const ranked: MentorScore[] = useMemo(() => {
    let base: MentorScore[];
    if (user?.role === "mentor" || user?.role === "mentee") {
      base = allScored.filter((m) => m.gender === user.gender);
    } else if (genderFilter === "all") {
      base = allScored;
    } else {
      base = allScored.filter((m) => m.gender === genderFilter);
    }
    // Mentoren ohne Punkte (keine Abschlüsse, keine Sessions) ausblenden
    base = base.filter((m) => m.score > 0);
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

  const myEntry = user?.role === "mentor" ? ranked.find((r) => r.mentorId === user.id) : undefined;
  const top3 = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("leaderboard.title")}</Text>

          {/* ── Geschlechter-Hinweis direkt nach Titel ──────────────────── */}
          {(user?.role === "mentor" || user?.role === "mentee") && (
            <View style={styles.genderHintBox}>
              <Text style={styles.genderHintText}>
                {user.gender === "male"
                  ? t("leaderboard.hintBrothers")
                  : t("leaderboard.hintSisters")}
              </Text>
            </View>
          )}

          {/* Monats-Picker */}
          <View style={[styles.monthPickerRow, { backgroundColor: themeColors.card }]}>
            <TouchableOpacity
              onPress={goToPrevMonth}
              style={styles.monthPickerBtn}
              accessibilityRole="button"
              accessibilityLabel="Vorheriger Monat"
            >
              <Text style={[styles.monthPickerArrow, { color: themeColors.text }]}>
                {t("leaderboard.monthPicker.prev")}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.monthPickerLabel, { color: themeColors.text }]}>
              {monthName} {selectedYear}
            </Text>
            <TouchableOpacity
              onPress={goToNextMonth}
              style={[styles.monthPickerBtn, isCurrentMonth && styles.monthPickerBtnDisabled]}
              disabled={isCurrentMonth}
              accessibilityRole="button"
              accessibilityLabel="Nächster Monat"
              accessibilityState={{ disabled: isCurrentMonth }}
            >
              <Text style={[styles.monthPickerArrow, { color: isCurrentMonth ? themeColors.textTertiary : themeColors.text }]}>
                {t("leaderboard.monthPicker.next")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Suche — nur für Admin */}
          {isAdmin && (
            <TextInput
              style={[styles.searchInput, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
              placeholder={t("leaderboard.searchPlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
              value={search}
              onChangeText={setSearch}
              accessibilityLabel="Mentor suchen"
            />
          )}

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
                    accessibilityRole="radio"
                    accessibilityLabel={opt.label}
                    accessibilityState={{ checked: genderFilter === opt.key }}
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


          {/* ── Podium: Top 3 ───────────────────────────────────────────── */}
          {ranked.length > 0 && (
            <View style={styles.podiumContainer}>
              <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 0 }]}>{listTitle}</Text>

              {/* Hero-Podium mit Gradient-Hintergrund */}
              <View style={[styles.podiumHero, { backgroundColor: isDark ? "#1a1a3e" : COLORS.gradientStart }]}>
                {/* Platz 2 | Platz 1 | Platz 3 */}
                <View style={styles.podiumRow}>
                  {/* Platz 2 */}
                  {top3[1] ? (() => {
                    const item = top3[1];
                    return (
                      <TouchableOpacity
                        key={item.mentorId}
                        style={styles.podiumSlot}
                        onPress={() => { if (Platform.OS !== "web") router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } }); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Platz 2: ${item.name}, ${item.score} Punkte`}
                      >
                        <View style={[styles.podiumAvatar, styles.podiumAvatar2]}>
                          <Text style={styles.podiumAvatarText}>{item.name.charAt(0)}</Text>
                          <View style={[styles.podiumBadge, { backgroundColor: MEDAL_COLORS[1] }]}>
                            <Text style={styles.podiumBadgeText}>2</Text>
                          </View>
                        </View>
                        <Text style={styles.podiumNameWhite} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.podiumCityWhite} numberOfLines={1}>{item.city}</Text>
                        <View style={styles.podiumScorePill}>
                          <Text style={styles.podiumScoreText}>{item.score} {t("leaderboard.points_short")}</Text>
                        </View>
                        <View style={[styles.podiumBar, styles.podiumBar2]} />
                      </TouchableOpacity>
                    );
                  })() : <View style={styles.podiumSlot} />}

                  {/* Platz 1 */}
                  {top3[0] ? (() => {
                    const item = top3[0];
                    return (
                      <TouchableOpacity
                        key={item.mentorId}
                        style={styles.podiumSlot}
                        onPress={() => { if (Platform.OS !== "web") router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } }); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Platz 1: ${item.name}, ${item.score} Punkte`}
                      >
                        <Text style={styles.podiumCrown}>👑</Text>
                        <View style={[styles.podiumAvatar, styles.podiumAvatar1]}>
                          <Text style={styles.podiumAvatarText1}>{item.name.charAt(0)}</Text>
                          <View style={[styles.podiumBadge, { backgroundColor: MEDAL_COLORS[0] }]}>
                            <Text style={styles.podiumBadgeText}>1</Text>
                          </View>
                        </View>
                        <Text style={[styles.podiumNameWhite, { fontSize: 15, fontWeight: "800" }]} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.podiumCityWhite} numberOfLines={1}>{item.city}</Text>
                        <View style={[styles.podiumScorePill, styles.podiumScorePill1]}>
                          <Text style={[styles.podiumScoreText, { color: COLORS.gradientStart }]}>{item.score} {t("leaderboard.points_short")}</Text>
                        </View>
                        <View style={[styles.podiumBar, styles.podiumBar1]} />
                      </TouchableOpacity>
                    );
                  })() : null}

                  {/* Platz 3 */}
                  {top3[2] ? (() => {
                    const item = top3[2];
                    return (
                      <TouchableOpacity
                        key={item.mentorId}
                        style={styles.podiumSlot}
                        onPress={() => { if (Platform.OS !== "web") router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } }); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Platz 3: ${item.name}, ${item.score} Punkte`}
                      >
                        <View style={[styles.podiumAvatar, styles.podiumAvatar3]}>
                          <Text style={styles.podiumAvatarText}>{item.name.charAt(0)}</Text>
                          <View style={[styles.podiumBadge, { backgroundColor: MEDAL_COLORS[2] }]}>
                            <Text style={styles.podiumBadgeText}>3</Text>
                          </View>
                        </View>
                        <Text style={styles.podiumNameWhite} numberOfLines={1}>{item.name}</Text>
                        <Text style={styles.podiumCityWhite} numberOfLines={1}>{item.city}</Text>
                        <View style={styles.podiumScorePill}>
                          <Text style={styles.podiumScoreText}>{item.score} {t("leaderboard.points_short")}</Text>
                        </View>
                        <View style={[styles.podiumBar, styles.podiumBar3]} />
                      </TouchableOpacity>
                    );
                  })() : <View style={styles.podiumSlot} />}
                </View>
              </View>

              {/* ── Restliche Plätze (ab Platz 4) ──────────────────────── */}
              {rest.length > 0 && (
                <View style={[styles.restList, { backgroundColor: themeColors.card }]}>
                  {rest.map((item, idx) => {
                    const index = idx + 3;
                    const isMe = user?.role === "mentor" && item.mentorId === user.id;
                    return (
                      <TouchableOpacity
                        key={item.mentorId}
                        style={[
                          styles.rankRow,
                          idx < rest.length - 1 ? [styles.rankRowBorder, { borderBottomColor: themeColors.border }] : {},
                          isMe ? [styles.rankRowHighlight, { borderWidth: 2, borderColor: COLORS.gold, borderRadius: RADIUS.sm }] : {},
                        ]}
                        onPress={() => { if (Platform.OS !== "web") router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } }); }}
                        accessibilityRole="button"
                        accessibilityLabel={`Platz ${index + 1}: ${item.name}, ${item.score} Punkte`}
                      >
                        <View style={[styles.rankNumberCircle, { backgroundColor: themeColors.background }]}>
                          <Text style={[styles.rankNumberText, { color: isMe ? COLORS.gold : themeColors.textSecondary }]}>
                            {index + 1}
                          </Text>
                        </View>

                        <View style={[styles.rankAvatarSmall, { backgroundColor: isDark ? "#2a2a4e" : "#e8e0f0" }]}>
                          <Text style={[styles.rankAvatarLetter, { color: isDark ? "#a0a0d0" : COLORS.gradientStart }]}>{item.name.charAt(0)}</Text>
                        </View>

                        <View style={styles.rankInfo}>
                          <View style={styles.rankNameRow}>
                            <Text style={[styles.rankName, { color: themeColors.text }]}>{item.name}</Text>
                            {isMe && (
                              <View style={[styles.meChip, { backgroundColor: isDark ? "#1e2d4a" : "#dbeafe" }]}>
                                <Text style={[styles.meChipText, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>{t("leaderboard.you")}</Text>
                              </View>
                            )}
                          </View>
                          <Text style={[styles.rankSub, { color: themeColors.textTertiary }]}>
                            {item.completedCount} {t("leaderboard.completions")} · {item.sessionCount} {t("leaderboard.sessions")}
                          </Text>
                        </View>

                        <View style={styles.scoreBox}>
                          <Text style={[styles.scoreValue, { color: isMe ? COLORS.gold : themeColors.text }]}>
                            {item.score}
                          </Text>
                          <Text style={[styles.scoreLabel, { color: themeColors.textTertiary }]}>{t("leaderboard.points_short")}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

            </View>
          )}

          {/* Leere Rangliste */}
          {ranked.length === 0 && (
            <EmptyState
              icon="trophy-outline"
              title={t("leaderboard.noMentorsYet")}
              description="In diesem Monat wurden noch keine Punkte gesammelt."
              compact
            />
          )}

          {/* ── Mentor des Monats Banner ──────────────────────────────── */}
          {mentorOfMonthVisible && mentorOfMonthForUser && (
            <View style={[styles.momBanner, { borderLeftColor: COLORS.gold }]}>
              <View style={styles.momHeader}>
                <Text style={styles.momStar}>🏆</Text>
                <Text style={[styles.momTitle, { color: themeColors.text }]}>{t("leaderboard.mentorOfMonth")}</Text>
              </View>
              <Text style={[styles.momName, { color: themeColors.text }]}>{mentorOfMonthForUser.name}</Text>
              <View style={styles.momStatsRow}>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.completedCount}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.completions")}</Text>
                </View>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.sessionCount}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.sessions")}</Text>
                </View>
                <View style={[styles.momStatPill, { backgroundColor: themeColors.card }]}>
                  <Text style={styles.momStatValue}>{mentorOfMonthForUser.score}</Text>
                  <Text style={[styles.momStatLabel, { color: themeColors.textSecondary }]}>{t("leaderboard.points_short")}</Text>
                </View>
              </View>
            </View>
          )}

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
  pageTitle: { fontSize: 28, fontWeight: "800", marginBottom: 4, letterSpacing: -0.3, textAlign: "center" as const },
  pageSubtitle: { marginBottom: 24, fontSize: 13, textAlign: "center" as const },

  // Eigene Position (prominente Card ganz oben)
  myPositionCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.lg,
    borderWidth: 2,
    padding: 18,
    marginBottom: 16,
    gap: 12,
  },
  myPositionLeft: { alignItems: "center", minWidth: 70 },
  myPositionRank: { fontSize: 30, fontWeight: "800" },
  myPositionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 0.3, textAlign: "center", marginTop: 2 },
  myPositionStats: { flex: 1, flexDirection: "row", justifyContent: "space-around" },
  myPositionStat: { alignItems: "center" },
  myPositionStatVal: { fontSize: 20, fontWeight: "800" },
  myPositionStatLbl: { fontSize: 10, fontWeight: "500", marginTop: 2 },

  // Podium — Hero-Design mit farbigem Hintergrund
  podiumContainer: { marginBottom: 20 },
  podiumHero: {
    borderRadius: RADIUS.lg,
    paddingTop: 24,
    paddingBottom: 0,
    marginTop: 12,
    marginBottom: 16,
    overflow: "hidden",
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  podiumSlot: {
    flex: 1,
    alignItems: "center",
    minWidth: 0,
  },
  podiumCrown: { fontSize: 22, marginBottom: 4 },
  podiumAvatar: {
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.3)",
    marginBottom: 8,
  },
  podiumAvatar1: { width: 72, height: 72, backgroundColor: "rgba(255,255,255,0.2)" },
  podiumAvatar2: { width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.15)" },
  podiumAvatar3: { width: 56, height: 56, backgroundColor: "rgba(255,255,255,0.15)" },
  podiumAvatarText: { color: "#fff", fontSize: 20, fontWeight: "700" },
  podiumAvatarText1: { color: "#fff", fontSize: 26, fontWeight: "800" },
  podiumBadge: {
    position: "absolute",
    bottom: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  podiumBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  podiumNameWhite: { color: "#fff", fontSize: 13, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  podiumCityWhite: { color: "rgba(255,255,255,0.6)", fontSize: 11, textAlign: "center", marginBottom: 6 },
  podiumScorePill: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 12,
  },
  podiumScorePill1: {
    backgroundColor: "#fff",
  },
  podiumScoreText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  podiumBar: {
    width: "80%",
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
  },
  podiumBar1: { height: 60, backgroundColor: "rgba(255,255,255,0.25)" },
  podiumBar2: { height: 40, backgroundColor: "rgba(255,255,255,0.15)" },
  podiumBar3: { height: 28, backgroundColor: "rgba(255,255,255,0.12)" },

  // Rest-Liste (ab Platz 4)
  restList: {
    borderRadius: RADIUS.lg,
    padding: 8,
    ...SHADOWS.md,
  },

  filterCard: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  filterLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: {},
  filterChipTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  filterChipTextInactive: { fontSize: 13 },

  genderHintBox: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  momHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  momStar: { color: COLORS.gold, fontSize: 22, marginRight: 8 },
  momTitle: { fontWeight: "800", fontSize: 15 },
  momName: { fontSize: 22, fontWeight: "800", marginBottom: 16 },
  momStatsRow: { flexDirection: "row", gap: 12 },
  momStatPill: {
    flex: 1,
    borderRadius: RADIUS.md,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(238,167,27,0.3)",
  },
  momStatValue: { fontSize: 20, fontWeight: "700", color: COLORS.gold },
  momStatLabel: { color: COLORS.secondary, fontSize: 11, marginTop: 2 },

  myPositionScore: { color: COLORS.white, fontWeight: "700", fontSize: 16 },

  card: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  cardTitle: { fontWeight: "800", marginBottom: 16, fontSize: 15 },
  emptyText: { textAlign: "center", fontSize: 14, paddingVertical: 16 },
  emptyStateContainer: { paddingVertical: 24, alignItems: "center" },
  emptyStateText: { textAlign: "center", fontSize: 14, lineHeight: 20 },

  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    gap: 10,
  },
  rankRowBorder: { borderBottomWidth: 1 },
  rankRowHighlight: {
    borderRadius: RADIUS.xs,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },

  rankNumberCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankNumberText: { fontWeight: "700", fontSize: 14 },
  rankAvatarSmall: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  rankAvatarLetter: { fontSize: 16, fontWeight: "700" },

  rankInfo: { flex: 1 },
  rankNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  rankName: { fontWeight: "600", fontSize: 15 },
  meChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.sm,
  },
  meChipText: { fontSize: 11, fontWeight: "600" },
  medalChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.sm },
  medalChipText: { color: COLORS.white, fontSize: 11, fontWeight: "600" },
  rankSub: { fontSize: 12 },
  rankDetail: { fontSize: 12, marginTop: 2 },

  scoreBox: { alignItems: "center" },
  scoreValue: { fontSize: 22, fontWeight: "800" },
  scoreLabel: { fontSize: 11 },

  legendCard: {
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    padding: 20,
    marginBottom: 8,
    ...SHADOWS.md,
  },
  legendTitle: { fontWeight: "800", marginBottom: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  legendText: { fontSize: 13 },
  legendBold: { fontWeight: "700" },
  searchInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 16,
  },

  // Monats-Picker
  monthPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIUS.lg,
    paddingHorizontal: 8,
    paddingVertical: 10,
    marginBottom: 16,
  },
  monthPickerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  monthPickerBtnDisabled: {
    opacity: 0.3,
  },
  monthPickerArrow: {
    fontSize: 22,
    fontWeight: "300",
  },
  monthPickerLabel: {
    fontSize: 16,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
});
