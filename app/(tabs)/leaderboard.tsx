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
              <Text style={[styles.cardTitle, { color: themeColors.text, marginBottom: 16 }]}>{listTitle}</Text>

              {/* Podium-Zeile: Platz 2 | Platz 1 | Platz 3 */}
              <View style={styles.podiumRow}>
                {/* Platz 2 */}
                {top3[1] ? (() => {
                  const item = top3[1];
                  const isMe = user?.role === "mentor" && item.mentorId === user.id;
                  return (
                    <TouchableOpacity
                      key={item.mentorId}
                      style={[
                        styles.podiumCard,
                        styles.podiumCard2,
                        { backgroundColor: themeColors.card, borderColor: isMe ? COLORS.gold : MEDAL_COLORS[1] },
                        isMe && styles.podiumCardMe,
                      ]}
                      onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Platz 2: ${item.name}, ${item.score} Punkte`}
                    >
                      <Text style={styles.podiumEmoji}>{MEDAL_EMOJIS[1]}</Text>
                      <Text style={[styles.podiumName, { color: themeColors.text }]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[styles.podiumCity, { color: themeColors.textTertiary }]} numberOfLines={1}>{item.city}</Text>
                      <Text style={[styles.podiumScore, { color: MEDAL_COLORS[1] }]}>{item.score}</Text>
                      <Text style={[styles.podiumPts, { color: themeColors.textTertiary }]}>{t("leaderboard.points_short")}</Text>
                      <Text style={[styles.podiumStat, { color: themeColors.textSecondary }]}>
                        {item.completedCount} {t("leaderboard.completions")}
                      </Text>
                    </TouchableOpacity>
                  );
                })() : top3.length > 1 ? <View style={styles.podiumCardEmpty} /> : null}

                {/* Platz 1 (größte Karte, mittig) */}
                {top3[0] ? (() => {
                  const item = top3[0];
                  const isMe = user?.role === "mentor" && item.mentorId === user.id;
                  return (
                    <TouchableOpacity
                      key={item.mentorId}
                      style={[
                        styles.podiumCard,
                        styles.podiumCard1,
                        { backgroundColor: isDark ? "#1A1A2E" : "#FFF8E1", borderColor: isMe ? COLORS.gold : MEDAL_COLORS[0] },
                        isMe && styles.podiumCardMe,
                      ]}
                      onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Platz 1: ${item.name}, ${item.score} Punkte`}
                    >
                      <Text style={styles.podiumCrown}>👑</Text>
                      <Text style={styles.podiumEmoji1}>{MEDAL_EMOJIS[0]}</Text>
                      <Text style={[styles.podiumName1, { color: themeColors.text }]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[styles.podiumCity, { color: themeColors.textTertiary }]} numberOfLines={1}>{item.city}</Text>
                      <Text style={[styles.podiumScore1, { color: MEDAL_COLORS[0] }]}>{item.score}</Text>
                      <Text style={[styles.podiumPts, { color: themeColors.textTertiary }]}>{t("leaderboard.points_short")}</Text>
                      <View style={styles.podiumStats1Row}>
                        <Text style={[styles.podiumStat, { color: themeColors.textSecondary }]}>
                          {item.completedCount} {t("leaderboard.completions")}
                        </Text>
                        <Text style={[styles.podiumStatSep, { color: themeColors.border }]}>·</Text>
                        <Text style={[styles.podiumStat, { color: themeColors.textSecondary }]}>
                          {item.sessionCount} {t("leaderboard.sessions")}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })() : null}

                {/* Platz 3 */}
                {top3[2] ? (() => {
                  const item = top3[2];
                  const isMe = user?.role === "mentor" && item.mentorId === user.id;
                  return (
                    <TouchableOpacity
                      key={item.mentorId}
                      style={[
                        styles.podiumCard,
                        styles.podiumCard3,
                        { backgroundColor: themeColors.card, borderColor: isMe ? COLORS.gold : MEDAL_COLORS[2] },
                        isMe && styles.podiumCardMe,
                      ]}
                      onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } })}
                      accessibilityRole="button"
                      accessibilityLabel={`Platz 3: ${item.name}, ${item.score} Punkte`}
                    >
                      <Text style={styles.podiumEmoji}>{MEDAL_EMOJIS[2]}</Text>
                      <Text style={[styles.podiumName, { color: themeColors.text }]} numberOfLines={2}>{item.name}</Text>
                      <Text style={[styles.podiumCity, { color: themeColors.textTertiary }]} numberOfLines={1}>{item.city}</Text>
                      <Text style={[styles.podiumScore, { color: MEDAL_COLORS[2] }]}>{item.score}</Text>
                      <Text style={[styles.podiumPts, { color: themeColors.textTertiary }]}>{t("leaderboard.points_short")}</Text>
                      <Text style={[styles.podiumStat, { color: themeColors.textSecondary }]}>
                        {item.completedCount} {t("leaderboard.completions")}
                      </Text>
                    </TouchableOpacity>
                  );
                })() : top3.length > 2 ? <View style={styles.podiumCardEmpty} /> : null}
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
                          isMe ? [styles.rankRowHighlight, { borderWidth: 2, borderColor: COLORS.gold, borderRadius: RADIUS.xs }] : {},
                        ]}
                        onPress={() =>
                          router.push({ pathname: "/mentor/[id]", params: { id: item.mentorId } })
                        }
                        accessibilityRole="button"
                        accessibilityLabel={`Platz ${index + 1}: ${item.name}, ${item.score} Punkte`}
                      >
                        <View style={[styles.rankBadge, { backgroundColor: themeColors.background }]}>
                          <Text style={[styles.rankBadgeTextDark, { color: isMe ? COLORS.gold : themeColors.textSecondary }]}>
                            {index + 1}
                          </Text>
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
                            {item.city} · {item.gender === "male" ? t("leaderboard.brother") : t("leaderboard.sister")}
                          </Text>
                          <Text style={[styles.rankDetail, { color: themeColors.textSecondary }]}>
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

  // Podium — echtes Podium-Design mit unterschiedlichen Höhen
  podiumContainer: { marginBottom: 20 },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "stretch",
    gap: 8,
    marginBottom: 16,
  },
  podiumCard: {
    borderRadius: RADIUS.md,
    borderWidth: 2,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    flex: 1,
    minWidth: 0,
  },
  podiumCard1: {
    // Platz 1: größte Karte — steht am höchsten, horizontal betont
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 0,
    shadowColor: "#EEA71B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.30,
    shadowRadius: 12,
    elevation: 8,
  },
  podiumCard2: {
    // Platz 2: mittel
    marginBottom: 16,
  },
  podiumCard3: {
    // Platz 3: etwas tiefer
    marginBottom: 24,
  },
  podiumCardEmpty: { flex: 1 },
  podiumCardMe: {
    borderWidth: 3,
    shadowColor: COLORS.gold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  podiumCrown: { fontSize: 20, marginBottom: 2 },
  podiumEmoji: { fontSize: 24, marginBottom: 4 },
  podiumEmoji1: { fontSize: 30, marginBottom: 6 },
  podiumName: { fontSize: 12, fontWeight: "600", textAlign: "center", marginBottom: 2 },
  podiumName1: { fontSize: 14, fontWeight: "800", textAlign: "center", marginBottom: 3 },
  podiumCity: { fontSize: 10, textAlign: "center", marginBottom: 6 },
  podiumScore: { fontSize: 22, fontWeight: "800" },
  podiumScore1: { fontSize: 28, fontWeight: "800", letterSpacing: -0.5 },
  podiumPts: { fontSize: 10, marginBottom: 4, fontWeight: "500" },
  podiumStats1Row: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap", justifyContent: "center" },
  podiumStatSep: { fontSize: 10 },
  podiumStat: { fontSize: 10, textAlign: "center" },

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
    gap: 12,
  },
  rankRowBorder: { borderBottomWidth: 1 },
  rankRowHighlight: {
    borderRadius: RADIUS.xs,
    marginHorizontal: -8,
    paddingHorizontal: 8,
  },

  rankBadge: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
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
