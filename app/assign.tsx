import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import type { User } from "../types";
import { COLORS } from "../constants/Colors";

interface MatchScore {
  mentor: User;
  score: number;
  reasons: string[];
}

function calculateMatchScore(mentee: User, mentor: User): MatchScore {
  let score = 0;
  const reasons: string[] = [];

  if (mentor.gender !== mentee.gender) {
    return { mentor, score: -1, reasons: ["Geschlecht stimmt nicht überein"] };
  }
  score += 40;
  reasons.push("Geschlecht passt");

  if (mentor.city.toLowerCase() === mentee.city.toLowerCase()) {
    score += 35;
    reasons.push("Gleiche Stadt");
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
      reasons.push("Gleiche Region");
    }
  }

  const ageDiff = Math.abs(mentor.age - mentee.age);
  if (ageDiff <= 3) { score += 15; reasons.push("Sehr ähnliches Alter"); }
  else if (ageDiff <= 7) { score += 10; reasons.push("Ähnliches Alter"); }
  else if (ageDiff <= 12) { score += 5; reasons.push("Passende Altersgruppe"); }

  if (mentor.contact_preference === mentee.contact_preference) {
    score += 10;
    reasons.push("Gleiche Kontaktpräferenz");
  }

  return { mentor, score, reasons };
}

export default function AssignScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { users, mentorships, assignMentorship, getUnassignedMentees } = useData();
  const params = useLocalSearchParams<{ menteeId?: string }>();

  const isMentor = user?.role === "mentor";
  const isAdmin = user?.role === "admin";

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

  function handleAssign() {
    if (!user) return;

    const mentorId = isMentor ? user.id : selectedMentorId;
    if (!selectedMenteeId || !mentorId) return;

    const mentor = users.find((u) => u.id === mentorId);
    const mentee = users.find((u) => u.id === selectedMenteeId);
    if (!mentor || !mentee) return;

    const confirmText = isMentor
      ? `Möchtest du ${mentee.name} als Mentee übernehmen?`
      : `${mentee.name} wird ${mentor.name} zugewiesen. Fortfahren?`;

    const buttonText = isMentor ? "Übernehmen" : "Zuweisen";

    Alert.alert(
      isMentor ? "Mentee übernehmen" : "Zuweisung bestätigen",
      confirmText,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: buttonText,
          onPress: () => {
            assignMentorship(selectedMenteeId, mentorId, user.id);
            Alert.alert("Erfolg", "Zuweisung erfolgreich!", [
              { text: "OK", onPress: () => router.back() },
            ]);
          },
        },
      ]
    );
  }

  if (!isAdmin && !isMentor) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>Kein Zugriff. Nur für Admins und Mentoren.</Text>
      </View>
    );
  }

  if (unassignedMentees.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.boldTitle}>
          {isMentor ? "Keine passenden Mentees" : "Alle Mentees zugewiesen"}
        </Text>
        <Text style={styles.centerSubText}>
          {isMentor
            ? "Es gibt aktuell keine nicht zugewiesenen Mentees deines Geschlechts."
            : "Aktuell gibt es keine nicht zugewiesenen Mentees."}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* FIX 5: Mentor-Modus Banner */}
        {isMentor && (
          <View style={styles.mentorModeBox}>
            <Text style={styles.mentorModeTitle}>Mentee selbst übernehmen</Text>
            <Text style={styles.mentorModeText}>
              Wähle einen nicht zugewiesenen{" "}
              {user?.gender === "male" ? "Bruder" : "eine nicht zugewiesene Schwester"} aus
              und übernimm die Betreuung direkt.
            </Text>
          </View>
        )}

        {/* Mentee auswählen */}
        <Text style={styles.sectionLabel}>{"MENTEE AUSWÄHLEN"}</Text>
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
                  {mentee.gender === "male" ? "Bruder" : "Schwester"}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Passende Mentoren (nur Admin-Modus) */}
        {isAdmin && selectedMentee && (
          <>
            <Text style={styles.sectionLabel}>{"PASSENDE MENTOREN"}</Text>
            <Text style={styles.sectionHint}>
              Brüder werden nur Brüdern, Schwestern nur Schwestern zugewiesen.
            </Text>

            {matchedMentors.length === 0 ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Kein passender Mentor gefunden</Text>
                <Text style={styles.errorText}>
                  Es gibt keine Mentoren des gleichen Geschlechts.
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
                              <Text style={styles.bestChoiceText}>Beste Wahl</Text>
                            </View>
                          )}
                          <Text style={styles.mentorName}>{match.mentor.name}</Text>
                          <Text style={styles.mentorSub}>
                            {match.mentor.city} · {match.mentor.age} J. ·{" "}
                            {activeMenteeCount} aktive{" "}
                            {activeMenteeCount === 1 ? "Betreuung" : "Betreuungen"}
                          </Text>
                        </View>
                        <View style={{ alignItems: "center" }}>
                          <Text style={[styles.scoreValue, { color: scoreColor }]}>
                            {percentage}%
                          </Text>
                          <Text style={styles.scoreLabel}>Match</Text>
                        </View>
                      </View>

                      <View style={styles.scoreBar}>
                        <View
                          style={[
                            styles.scoreBarFill,
                            { width: Math.min(percentage, 100) + "%", backgroundColor: scoreColor },
                          ]}
                        />
                      </View>

                      <View style={styles.reasonsRow}>
                        {match.reasons.map((reason) => (
                          <View key={reason} style={styles.reasonChip}>
                            <Text style={styles.reasonText}>✓ {reason}</Text>
                          </View>
                        ))}
                      </View>

                      {isSelected && (
                        <View style={styles.selectedIndicator}>
                          <Text style={styles.selectedIndicatorText}>✓ Ausgewählt</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </>
        )}

        {/* Zuweisen / Übernehmen Button */}
        <TouchableOpacity
          style={[
            styles.assignButton,
            (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId)
              ? { backgroundColor: COLORS.cta }
              : { backgroundColor: COLORS.border },
          ]}
          onPress={handleAssign}
          disabled={isMentor ? !selectedMenteeId : !selectedMenteeId || !selectedMentorId}
        >
          <Text
            style={[
              styles.assignButtonText,
              (isMentor ? selectedMenteeId : selectedMenteeId && selectedMentorId)
                ? { color: COLORS.white }
                : { color: COLORS.tertiary },
            ]}
          >
            {isMentor ? "Mentee übernehmen" : "Mentor zuweisen"}
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
  backButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
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
  assignButton: { borderRadius: 6, paddingVertical: 10, alignItems: "center" },
  assignButtonText: { fontWeight: "600", fontSize: 14 },
});
