import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import type { TranslationKeys } from "../lib/translations/de";
import { useData } from "../contexts/DataContext";
import { useConfirm, useAlert } from "../contexts/ModalContext";
import { showError } from "../lib/errorHandler";
import type { User } from "../types";
import { COLORS } from "../constants/Colors";
import { sendMenteeAssignedNotification } from "../lib/emailService";
import { useLanguage } from "../contexts/LanguageContext";

interface MatchScore {
  mentor: User;
  score: number;
  reasonKeys: string[];
}

function calculateMatchScore(mentee: User, mentor: User): MatchScore {
  let score = 0;
  const reasonKeys: string[] = [];

  if (mentor.gender !== mentee.gender) {
    return { mentor, score: -1, reasonKeys: ["assign.reasonGenderMismatch"] };
  }
  score += 40;
  reasonKeys.push("assign.reasonGenderMatch");

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

  const ageDiff = Math.abs(mentor.age - mentee.age);
  if (ageDiff <= 3) { score += 15; reasonKeys.push("assign.reasonAgeSimilar"); }
  else if (ageDiff <= 7) { score += 10; reasonKeys.push("assign.reasonAgeClose"); }
  else if (ageDiff <= 12) { score += 5; reasonKeys.push("assign.reasonAgeGroup"); }

  if (mentor.contact_preference === mentee.contact_preference) {
    score += 10;
    reasonKeys.push("assign.reasonSameContact");
  }

  return { mentor, score, reasonKeys };
}

export default function AssignScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { users, mentorships, assignMentorship, getUnassignedMentees } = useData();
  const params = useLocalSearchParams<{ menteeId?: string }>();
  const confirm = useConfirm();
  const alert = useAlert();

  const isMentor = user?.role === "mentor";
  const isAdmin = user?.role === "admin" || user?.role === "office";

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
    // FIX 5: Mentor ist sich selbst vorausgewählt
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

  const maxPossibleScore = 100;

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

    const confirmed = await confirm(confirmTitle, confirmText);
    if (!confirmed) return;

    setIsAssigning(true);
    try {
      if (isMentor) {
        // Mentor-Selbst-Zuweisung: Status "pending_approval" → Admin muss bestätigen
        await assignMentorship(selectedMenteeId, mentorId, user.id, "pending_approval");
        await alert(t("assign.pendingSuccessTitle"), t("assign.pendingSuccessText"), "success");
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

        await alert(t("assign.successTitle"), t("assign.successText"), "success");
        router.back();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(`Zuweisung fehlgeschlagen: ${msg}`);
    } finally {
      setIsAssigning(false);
    }
  }

  if (!isAdmin && !isMentor) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>{t("assign.accessDenied")}</Text>
      </View>
    );
  }

  if (unassignedMentees.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.boldTitle}>
          {isMentor ? t("assign.noMenteesMentorTitle") : t("assign.noMenteesTitle")}
        </Text>
        <Text style={styles.centerSubText}>
          {isMentor
            ? t("assign.noMenteesMentorText")
            : t("assign.noMenteesText")}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("common.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Mentor-Modus Banner */}
        {isMentor && (
          <View style={styles.mentorModeBox}>
            <Text style={styles.mentorModeTitle}>{t("assign.takeMenteeTitle")}</Text>
            <Text style={styles.mentorModeText}>
              {t("assign.takeMenteeText").replace("{0}", user?.gender === "male" ? t("assign.brother") : t("assign.sister"))}
            </Text>
          </View>
        )}

        {/* Mentee auswählen */}
        <Text style={styles.sectionLabel}>{t("assign.selectMentee")}</Text>
        <View style={styles.listCard}>
          {unassignedMentees.map((mentee, idx) => (
            <TouchableOpacity
              key={mentee.id}
              style={[
                styles.listItem,
                idx < unassignedMentees.length - 1 ? styles.listItemBorder : {},
                selectedMenteeId === mentee.id ? styles.listItemSelected : {},
              ]}
              onPress={() => {
                setSelectedMenteeId(mentee.id);
                if (!isMentor) setSelectedMentorId("");
              }}
            >
              <View
                style={[
                  styles.radioCircle,
                  selectedMenteeId === mentee.id
                    ? styles.radioCircleActive
                    : styles.radioCircleInactive,
                ]}
              >
                {selectedMenteeId === mentee.id && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{mentee.name}</Text>
                <Text style={styles.itemSub}>
                  {mentee.city} · {mentee.age} J. ·{" "}
                  {mentee.gender === "male" ? t("assign.brother") : t("assign.sister")}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Passende Mentoren (nur Admin-Modus) */}
        {isAdmin && selectedMentee && (
          <>
            <Text style={styles.sectionLabel}>{t("assign.matchedMentors")}</Text>
            <Text style={styles.sectionHint}>
              {t("assign.genderRule")}
            </Text>

            {matchedMentors.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>{t("assign.noMentorFound")}</Text>
                <Text style={styles.errorText}>
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
                    <TouchableOpacity
                      key={match.mentor.id}
                      style={[
                        styles.mentorCard,
                        isSelected ? styles.mentorCardSelected : styles.mentorCardDefault,
                      ]}
                      onPress={() => setSelectedMentorId(match.mentor.id)}
                    >
                      <View style={styles.mentorCardHeader}>
                        <View style={{ flex: 1 }}>
                          {idx === 0 && (
                            <View style={styles.bestChoiceBadge}>
                              <Text style={styles.bestChoiceText}>{t("assign.bestChoice")}</Text>
                            </View>
                          )}
                          <Text style={styles.mentorName}>{match.mentor.name}</Text>
                          <Text style={styles.mentorSub}>
                            {match.mentor.city} · {match.mentor.age} J. ·{" "}
                            {t("assign.activeMentorships")
                              .replace("{0}", String(activeMenteeCount))
                              .replace("{1}", activeMenteeCount === 1 ? t("assign.mentorship") : t("assign.mentorships"))}
                          </Text>
                        </View>
                        <View style={{ alignItems: "center" }}>
                          <Text style={[styles.scoreValue, { color: scoreColor }]}>
                            {percentage}%
                          </Text>
                          <Text style={styles.scoreLabel}>{t("assign.match")}</Text>
                        </View>
                      </View>

                      <View style={styles.scoreBar}>
                        <View
                          style={[
                            styles.scoreBarFill,
                            { width: `${Math.min(percentage, 100)}%` as any, backgroundColor: scoreColor },
                          ]}
                        />
                      </View>

                      <View style={styles.reasonsRow}>
                        {match.reasonKeys.map((reasonKey) => (
                          <View key={reasonKey} style={styles.reasonChip}>
                            <Text style={styles.reasonText}>✓ {t(reasonKey as TranslationKeys)}</Text>
                          </View>
                        ))}
                      </View>

                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Text style={styles.selectedIndicatorText}>{t("assign.selected")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Hinweis für Mentor: Zuweisung braucht Admin-Bestätigung */}
        {isMentor && (
          <View style={styles.pendingHintBox}>
            <Text style={styles.pendingHintText}>{t("assign.pendingApprovalNote")}</Text>
          </View>
        )}

        {/* Zuweisen / Übernehmen Button */}
        <TouchableOpacity
          style={[
            styles.assignButton,
            (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId) && !isAssigning
              ? { backgroundColor: COLORS.cta }
              : { backgroundColor: COLORS.border },
          ]}
          onPress={handleAssign}
          disabled={isAssigning || (isMentor ? !selectedMenteeId : !selectedMenteeId || !selectedMentorId)}
        >
          <Text
            style={[
              styles.assignButtonText,
              (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId) && !isAssigning
                ? { color: COLORS.white }
                : { color: COLORS.tertiary },
            ]}
          >
            {isAssigning ? "..." : isMentor ? t("assign.pendingApprovalButton") : t("assign.assignButton")}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { color: COLORS.primary, fontWeight: "600" },
  boldTitle: { color: COLORS.primary, fontWeight: "bold", fontSize: 18, marginBottom: 8 },
  centerSubText: { color: COLORS.secondary, textAlign: "center", fontSize: 14, marginBottom: 24 },
  backButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 9, borderRadius: 5 },
  backButtonText: { color: COLORS.white, fontWeight: "600" },
  page: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 10 },
  sectionHint: { color: COLORS.secondary, fontSize: 12, marginBottom: 10 },
  mentorModeBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  mentorModeTitle: { color: "#1e40af", fontWeight: "600", fontSize: 14, marginBottom: 4 },
  mentorModeText: { color: "#2563eb", fontSize: 13 },
  listCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemSelected: { backgroundColor: "#eff6ff" },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    borderWidth: 2,
    marginRight: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioCircleInactive: { borderColor: COLORS.border },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: COLORS.white },
  itemName: { fontWeight: "600", color: COLORS.primary },
  itemSub: { color: COLORS.tertiary, fontSize: 12 },
  errorBox: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  errorTitle: { color: "#b91c1c", fontWeight: "500" },
  errorText: { color: "#dc2626", fontSize: 14, marginTop: 4 },
  mentorCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  mentorCardDefault: { borderColor: COLORS.border, backgroundColor: COLORS.white },
  mentorCardSelected: { borderColor: COLORS.primary, backgroundColor: "#eff6ff" },
  mentorCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  bestChoiceBadge: {
    backgroundColor: "rgba(238,167,27,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  bestChoiceText: { fontSize: 12, fontWeight: "bold", color: COLORS.gold },
  mentorName: { fontWeight: "bold", color: COLORS.primary },
  mentorSub: { color: COLORS.tertiary, fontSize: 12 },
  scoreValue: { fontSize: 24, fontWeight: "bold" },
  scoreLabel: { color: COLORS.tertiary, fontSize: 12 },
  scoreBar: {
    height: 6,
    backgroundColor: COLORS.bg,
    borderRadius: 9999,
    overflow: "hidden",
    marginBottom: 8,
  },
  scoreBarFill: { height: "100%", borderRadius: 9999 },
  reasonsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  reasonChip: { backgroundColor: COLORS.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  reasonText: { color: COLORS.secondary, fontSize: 12 },
  selectedIndicator: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#bfdbfe",
    paddingTop: 8,
  },
  selectedIndicatorText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  assignButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center" },
  assignButtonText: { fontWeight: "600", fontSize: 14 },
  pendingHintBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  pendingHintText: { color: "#92400e", fontSize: 13 },
});
