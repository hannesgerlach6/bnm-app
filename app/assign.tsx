import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { BNMPressable } from "../components/BNMPressable";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import type { TranslationKeys } from "../lib/translations/de";
import { useData } from "../contexts/DataContext";
import { showSuccess, showError, showConfirm } from "../lib/errorHandler";
import type { User } from "../types";
import { COLORS, RADIUS, SEMANTIC, sem } from "../constants/Colors";
import { sendMenteeAssignedNotification } from "../lib/emailService";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import { getCoordinatesForPLZ, haversineDistance } from "../lib/plzCoordinates";
import { Container } from "../components/Container";
import { SkeletonList } from "../components/Skeleton";

interface MatchScore {
  mentor: User;
  score: number;
  reasonKeys: string[];
  distanceKm: number | null;
}

function calculateMatchScore(mentee: User, mentor: User): MatchScore {
  let score = 0;
  const reasonKeys: string[] = [];
  let distanceKm: number | null = null;

  if (mentor.gender !== mentee.gender) {
    return { mentor, score: -1, reasonKeys: ["assign.reasonGenderMismatch"], distanceKm: null };
  }
  // Geschlecht ist Pflichtvoraussetzung — wird nicht als Bonus-Chip angezeigt

  // Distanz-Matching: Priorität 1 = gespeicherte DB-Koordinaten, Priorität 2 = PLZ-Lookup
  let distance: number | null = null;

  if (mentor.lat && mentor.lng && mentee.lat && mentee.lng) {
    // Priorität 1: Koordinaten aus DB
    distance = haversineDistance(mentee.lat, mentee.lng, mentor.lat, mentor.lng);
  } else {
    // Priorität 2: PLZ-Lookup-Tabelle als Fallback
    const mentorCoords = getCoordinatesForPLZ(mentor.plz);
    const menteeCoords = getCoordinatesForPLZ(mentee.plz);
    if (mentorCoords && menteeCoords) {
      distance = haversineDistance(mentorCoords.lat, mentorCoords.lng, menteeCoords.lat, menteeCoords.lng);
    }
  }

  if (distance !== null) {
    distanceKm = Math.round(distance);
    if (distance <= 5) {
      score += 40;
      reasonKeys.push("assign.veryClose");
    } else if (distance <= 15) {
      score += 30;
      reasonKeys.push("assign.close");
    } else if (distance <= 25) {
      score += 20;
      reasonKeys.push("assign.inRadius");
    } else if (distance <= 50) {
      score += 10;
    }
    // Über 50km: kein Bonus
  } else {
    // Fallback: Stadt-Vergleich
    if (mentor.city.toLowerCase() === mentee.city.toLowerCase()) {
      score += 35;
      reasonKeys.push("assign.reasonSameCity");
    } else {
      const regionMap: Record<string, string> = {
        berlin: "nordost", hamburg: "nordwest", bremen: "nordwest", hannover: "nordwest",
        köln: "west", düsseldorf: "west", dortmund: "west", essen: "west",
        frankfurt: "mitte", wiesbaden: "mitte", münchen: "süd", nürnberg: "süd",
        stuttgart: "süd", leipzig: "nordost", dresden: "nordost",
      };
      const mentorRegion = regionMap[mentor.city.toLowerCase()];
      const menteeRegion = regionMap[mentee.city.toLowerCase()];
      if (mentorRegion && menteeRegion && mentorRegion === menteeRegion) {
        score += 15;
        reasonKeys.push("assign.reasonSameRegion");
      }
    }
  }

  const ageDiff = Math.abs(mentor.age - mentee.age);
  if (ageDiff <= 3) { score += 15; reasonKeys.push("assign.reasonAgeSimilar"); }
  else if (ageDiff <= 7) { score += 10; reasonKeys.push("assign.reasonAgeClose"); }
  else if (ageDiff <= 12) { score += 5; reasonKeys.push("assign.reasonAgeGroup"); }

  return { mentor, score, reasonKeys, distanceKm };
}

export default function AssignScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, mentorships, assignMentorship, getUnassignedMentees, refreshData, isLoading } = useData();
  const params = useLocalSearchParams<{ menteeId?: string }>();

  const isMentor = user?.role === "mentor";
  const isAdmin = user?.role === "admin" || user?.role === "office";

  // Nutzt die globale showConfirm (Platform-aware: Web + Native)

  // FIX 5: Mentor sieht nur nicht zugewiesene Mentees des GLEICHEN Geschlechts
  const unassignedMentees = useMemo(() => {
    const all = getUnassignedMentees();
    if (isMentor && user) {
      return all.filter((m) => m.gender === user.gender);
    }
    return all;
  }, [getUnassignedMentees, isMentor, user]);

  const [selectedMenteeId, setSelectedMenteeId] = useState<string>(
    params.menteeId ?? (unassignedMentees[0]?.id ?? "")
  );
  const [selectedMentorId, setSelectedMentorId] = useState<string>(
    isMentor && user ? user.id : ""
  );
  const [isAssigning, setIsAssigning] = useState(false);

  const selectedMentee = users.find((u) => u.id === selectedMenteeId);


  const matchedMentors: MatchScore[] = useMemo(() => {
    if (!selectedMentee || isMentor) return [];
    const mentors = users.filter((u) => u.role === "mentor");
    return mentors
      .map((mentor) => calculateMatchScore(selectedMentee, mentor))
      .filter((m) => m.score >= 0)
      .sort((a, b) => b.score - a.score);
  }, [selectedMentee, users, isMentor]);

  const maxPossibleScore = 55; // Entfernung (max 40) + Alter (max 15)

  // Automatisch den besten Mentor vorauswählen wenn noch keiner gewählt
  React.useEffect(() => {
    if (!isMentor && !selectedMentorId && matchedMentors.length > 0) {
      setSelectedMentorId(matchedMentors[0].mentor.id);
    }
  }, [matchedMentors, selectedMentorId, isMentor]);

  async function handleAssign() {
    if (!user) return;

    const mentorId = isMentor ? user.id : selectedMentorId;
    if (!selectedMenteeId || !mentorId) return;

    const mentor = users.find((u) => u.id === mentorId);
    const mentee = users.find((u) => u.id === selectedMenteeId);
    if (!mentor || !mentee) return;

    const confirmTitle = isMentor ? t("assign.confirmTakeMenteeTitle") : t("assign.confirmAssignTitle");
    const confirmText = isMentor
      ? t("assign.confirmTakeMenteeText").replace("{0}", mentee.name)
      : t("assign.confirmAssignText").replace("{0}", mentee.name).replace("{1}", mentor.name);

    const confirmed = await showConfirm(confirmTitle, confirmText);
    if (!confirmed) return;

    setIsAssigning(true);
    try {
      if (isMentor) {
        // Mentor-Selbst-Zuweisung: Status "pending_approval" → Admin muss bestätigen
        await assignMentorship(selectedMenteeId, mentorId, user.id, "pending_approval");
        await refreshData();
        showSuccess(t("assign.pendingSuccessText"));
        router.back();
      } else {
        // Admin/Office-Zuweisung: direkt "active"
        await assignMentorship(selectedMenteeId, mentorId, user.id, "active");

        if (mentor.email) {
          await sendMenteeAssignedNotification(
            mentor.name,
            mentor.email,
            mentee.name,
            mentee.city
          );
        }

        await refreshData();
        showSuccess(t("assign.successText"));
        router.back();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(t("assign.errorAssignment").replace("{0}", msg));
    } finally {
      setIsAssigning(false);
    }
  }

  if (isLoading) {
    return (
      <Container>
        <View style={{ padding: 20 }}>
          <SkeletonList count={5} />
        </View>
      </Container>
    );
  }

  if (!isAdmin && !isMentor) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("assign.accessDenied")}</Text>
      </View>
    );
  }

  if (unassignedMentees.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.boldTitle, { color: themeColors.text }]}>
          {isMentor ? t("assign.noMenteesMentorTitle") : t("assign.noMenteesTitle")}
        </Text>
        <Text style={[styles.centerSubText, { color: themeColors.textSecondary }]}>
          {isMentor
            ? t("assign.noMenteesMentorText")
            : t("assign.noMenteesText")}
        </Text>
        <BNMPressable style={styles.backButton} onPress={() => router.back()} accessibilityRole="link" accessibilityLabel="Zurück">
          <Text style={styles.backButtonText}>{t("common.back")}</Text>
        </BNMPressable>
      </View>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Mentor-Modus Banner */}
        {isMentor && (
          <View style={[styles.mentorModeBox, { backgroundColor: sem(SEMANTIC.blueBg, isDark), borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
            <Text style={[styles.mentorModeTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{t("assign.takeMenteeTitle")}</Text>
            <Text style={[styles.mentorModeText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
              {t("assign.takeMenteeText").replace("{0}", user?.gender === "male" ? t("assign.brother") : t("assign.sister"))}
            </Text>
          </View>
        )}

        {/* Mentee auswählen */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("assign.selectMentee")}</Text>
        <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          {unassignedMentees.map((mentee, idx) => (
            <BNMPressable
              key={mentee.id}
              style={[
                styles.listItem,
                idx < unassignedMentees.length - 1 ? [styles.listItemBorder, { borderBottomColor: themeColors.border }] : {},
                selectedMenteeId === mentee.id ? [styles.listItemSelected, { backgroundColor: themeColors.background }] : {},
              ]}
              onPress={() => {
                setSelectedMenteeId(mentee.id);
                if (!isMentor) setSelectedMentorId("");
              }}
              accessibilityRole="button"
              accessibilityLabel={`Mentee ${mentee.name} auswählen`}
            >
              <View
                style={[
                  styles.radioCircle,
                  selectedMenteeId === mentee.id
                    ? styles.radioCircleActive
                    : [styles.radioCircleInactive, { borderColor: themeColors.border }],
                ]}
              >
                {selectedMenteeId === mentee.id && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, { color: themeColors.text }]}>{mentee.name}</Text>
                <Text style={[styles.itemSub, { color: themeColors.textTertiary }]}>
                  {mentee.city} · {mentee.age} J. ·{" "}
                  {mentee.gender === "male" ? t("assign.brother") : t("assign.sister")}
                </Text>
              </View>
            </BNMPressable>
          ))}
        </View>

        {/* Passende Mentoren (nur Admin-Modus) */}
        {isAdmin && selectedMentee && (
          <>
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("assign.matchedMentors")}</Text>
            <Text style={[styles.sectionHint, { color: themeColors.textSecondary }]}>
              {t("assign.genderRule")}
            </Text>

            {matchedMentors.length === 0 ? (
              <View style={[styles.errorBox, { backgroundColor: sem(SEMANTIC.redBg, isDark), borderColor: sem(SEMANTIC.redBorder, isDark) }]}>
                <Text style={[styles.errorTitle, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("assign.noMentorFound")}</Text>
                <Text style={[styles.errorText, { color: isDark ? "#f87171" : "#dc2626" }]}>
                  {t("assign.noMentorFoundText")}
                </Text>
              </View>
            ) : (
              <View style={{ marginBottom: 24 }}>
                {matchedMentors.map((match, idx) => {
                  const percentage = Math.round((match.score / maxPossibleScore) * 100);
                  const isSelected = selectedMentorId === match.mentor.id;
                  const activeMenteeCount = mentorships.filter(
                    (m) => m.mentor_id === match.mentor.id && m.status === "active"
                  ).length;
                  const scoreColor =
                    percentage >= 80
                      ? COLORS.cta
                      : percentage >= 60
                      ? COLORS.gold
                      : COLORS.secondary;

                  return (
                    <BNMPressable
                      key={match.mentor.id}
                      style={[
                        styles.mentorCard,
                        isSelected
                          ? [styles.mentorCardSelected, { borderColor: COLORS.primary, backgroundColor: themeColors.background }]
                          : [styles.mentorCardDefault, { borderColor: themeColors.border, backgroundColor: themeColors.card }],
                      ]}
                      onPress={() => setSelectedMentorId(match.mentor.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Mentor ${match.mentor.name} auswählen, ${percentage}% Übereinstimmung`}
                    >
                      <View style={styles.mentorCardHeader}>
                        <View style={{ flex: 1 }}>
                          {idx === 0 && (
                            <View style={styles.bestChoiceBadge}>
                              <Text style={styles.bestChoiceText}>{t("assign.bestChoice")}</Text>
                            </View>
                          )}
                          <Text style={[styles.mentorName, { color: themeColors.text }]}>{match.mentor.name}</Text>
                          <Text style={[styles.mentorSub, { color: themeColors.textTertiary }]}>
                            {match.mentor.city}
                            {match.distanceKm !== null ? ` · ${t("assign.distanceAway").replace("{0}", String(match.distanceKm))}` : ""}
                            {" · "}{match.mentor.age} J. ·{" "}
                            {t("assign.activeMentorships")
                              .replace("{0}", String(activeMenteeCount))
                              .replace("{1}", activeMenteeCount === 1 ? t("assign.mentorship") : t("assign.mentorships"))}
                          </Text>
                        </View>
                        <View style={{ alignItems: "center" }}>
                          <Text style={[styles.scoreValue, { color: scoreColor }]}>
                            {percentage}%
                          </Text>
                          <Text style={[styles.scoreLabel, { color: themeColors.textTertiary }]}>{t("assign.match")}</Text>
                        </View>
                      </View>

                      <View style={[styles.scoreBar, { backgroundColor: themeColors.background }]}>
                        <View
                          style={[
                            styles.scoreBarFill,
                            { width: `${Math.min(percentage, 100)}%` as any, backgroundColor: scoreColor },
                          ]}
                        />
                      </View>

                      <View style={styles.reasonsRow}>
                        {match.reasonKeys.map((reasonKey) => (
                          <View key={reasonKey} style={[styles.reasonChip, { backgroundColor: themeColors.background }]}>
                            <Text style={[styles.reasonText, { color: themeColors.textSecondary }]}>✓ {t(reasonKey as TranslationKeys)}</Text>
                          </View>
                        ))}
                      </View>

                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Text style={[styles.selectedIndicatorText, { color: themeColors.text }]}>{t("assign.selected")}</Text>
                        </View>
                      )}
                    </BNMPressable>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Hinweis für Mentor: Zuweisung braucht Admin-Bestätigung */}
        {isMentor && (
          <View style={[styles.pendingHintBox, { backgroundColor: sem(SEMANTIC.amberBg, isDark), borderColor: isDark ? "#7a5c1a" : "#fde68a" }]}>
            <Text style={[styles.pendingHintText, { color: sem(SEMANTIC.amberText, isDark) }]}>{t("assign.pendingApprovalNote")}</Text>
          </View>
        )}

        {/* Zuweisen / Übernehmen Button */}
        <BNMPressable
          style={[
            styles.assignButton,
            (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId) && !isAssigning
              ? { backgroundColor: COLORS.cta }
              : { backgroundColor: themeColors.border },
          ]}
          onPress={handleAssign}
          disabled={isAssigning || (isMentor ? !selectedMenteeId : !selectedMenteeId || !selectedMentorId)}
          accessibilityRole="button"
          accessibilityLabel={isMentor ? "Mentee übernehmen" : "Zuweisung bestätigen"}
        >
          <Text
            style={[
              styles.assignButtonText,
              (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId) && !isAssigning
                ? { color: COLORS.white }
                : { color: themeColors.textTertiary },
            ]}
          >
            {isAssigning ? "..." : isMentor ? t("assign.pendingApprovalButton") : t("assign.assignButton")}
          </Text>
        </BNMPressable>
      </View>
    </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },
  boldTitle: { fontWeight: "800", fontSize: 18, marginBottom: 8 },
  centerSubText: { textAlign: "center", fontSize: 14, marginBottom: 24 },
  backButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 9, borderRadius: RADIUS.md },
  backButtonText: { color: COLORS.white, fontWeight: "600" },
  page: { padding: 24 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  sectionHint: { fontSize: 12, marginBottom: 10 },
  mentorModeBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  mentorModeTitle: { fontWeight: "600", fontSize: 14, marginBottom: 4 },
  mentorModeText: { fontSize: 13 },
  listCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listItemBorder: { borderBottomWidth: 1 },
  listItemSelected: {},
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.full,
    borderWidth: 2,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioCircleInactive: {},
  radioDot: { width: 8, height: 8, borderRadius: RADIUS.full, backgroundColor: COLORS.white },
  itemName: { fontWeight: "600" },
  itemSub: { fontSize: 12 },
  errorBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  errorTitle: { fontWeight: "500" },
  errorText: { fontSize: 14, marginTop: 4 },
  mentorCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 10,
  },
  mentorCardDefault: {},
  mentorCardSelected: {},
  mentorCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  bestChoiceBadge: {
    backgroundColor: "rgba(238,167,27,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  bestChoiceText: { fontSize: 12, fontWeight: "800", color: COLORS.gold },
  mentorName: { fontWeight: "800" },
  mentorSub: { fontSize: 12 },
  scoreValue: { fontSize: 24, fontWeight: "800" },
  scoreLabel: { fontSize: 12 },
  scoreBar: {
    height: 6,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    marginBottom: 8,
  },
  scoreBarFill: { height: "100%", borderRadius: RADIUS.full },
  reasonsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  reasonChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  reasonText: { fontSize: 12 },
  selectedIndicator: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.blueBorder,
    paddingTop: 8,
  },
  selectedIndicatorText: { fontSize: 12, fontWeight: "600" },
  assignButton: { borderRadius: RADIUS.md, paddingVertical: 9, alignItems: "center" },
  assignButtonText: { fontWeight: "600", fontSize: 14 },
  pendingHintBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 12,
  },
  pendingHintText: { fontSize: 13 },
});
