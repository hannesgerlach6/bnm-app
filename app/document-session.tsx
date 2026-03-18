import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { COLORS } from "../constants/Colors";

export default function DocumentSessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    getMentorshipsByMentorId,
    getMentorshipById,
    getCompletedStepIds,
    sessionTypes,
    addSession,
  } = useData();

  const params = useLocalSearchParams<{ mentorshipId?: string }>();

  const myMentorships = user
    ? getMentorshipsByMentorId(user.id).filter((m) => m.status === "active")
    : [];

  const [selectedMentorshipId, setSelectedMentorshipId] = useState<string>(
    params.mentorshipId ?? (myMentorships[0]?.id ?? "")
  );
  const [date, setDate] = useState<string>(new Date().toLocaleDateString("de-DE"));
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [details, setDetails] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const selectedMentorship = selectedMentorshipId
    ? getMentorshipById(selectedMentorshipId)
    : undefined;

  const completedStepIds = selectedMentorshipId
    ? getCompletedStepIds(selectedMentorshipId)
    : [];

  const nextStep = sessionTypes.find((st) => !completedStepIds.includes(st.id));
  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  async function handleSave() {
    if (!nextStep || !selectedMentorshipId || !user) return;
    if (!date.trim()) {
      Alert.alert("Fehler", "Bitte gib ein Datum ein.");
      return;
    }

    setIsSaving(true);

    let isoDate: string;
    try {
      const parts = date.split(".");
      if (parts.length === 3) {
        const [day, month, year] = parts;
        isoDate = new Date(Number(year), Number(month) - 1, Number(day)).toISOString();
      } else {
        isoDate = new Date().toISOString();
      }
    } catch {
      isoDate = new Date().toISOString();
    }

    addSession({
      mentorship_id: selectedMentorshipId,
      session_type_id: nextStep.id,
      date: isoDate,
      is_online: isOnline,
      details: details.trim() || undefined,
      documented_by: user.id,
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    setIsSaving(false);

    Alert.alert(
      "Session dokumentiert",
      `"${nextStep.name}" wurde erfolgreich dokumentiert.`,
      [{ text: "OK", onPress: () => router.back() }]
    );
  }

  if (!user || (user.role !== "mentor" && user.role !== "admin")) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>Nur für Mentoren und Admins.</Text>
      </View>
    );
  }

  if (myMentorships.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.boldTitle}>Keine aktiven Betreuungen</Text>
        <Text style={styles.centerSubText}>Du hast keine aktiven Mentees.</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Mentee auswählen (wenn mehrere) */}
        {myMentorships.length > 1 && (
          <>
            <Text style={styles.sectionLabel}>{"BETREUUNG WÄHLEN"}</Text>
            <View style={styles.listCard}>
              {myMentorships.map((m, idx) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.listItem,
                    idx < myMentorships.length - 1 ? styles.listItemBorder : {},
                    selectedMentorshipId === m.id ? styles.listItemSelected : {},
                  ]}
                  onPress={() => setSelectedMentorshipId(m.id)}
                >
                  <View
                    style={[
                      styles.radioCircle,
                      selectedMentorshipId === m.id
                        ? styles.radioCircleActive
                        : styles.radioCircleInactive,
                    ]}
                  >
                    {selectedMentorshipId === m.id && (
                      <View style={styles.radioDot} />
                    )}
                  </View>
                  <Text style={styles.itemName}>{m.mentee?.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Aktueller Step */}
        {selectedMentorship && (
          <>
            {/* Step-Fortschritt */}
            <View style={styles.progressCard}>
              <Text style={styles.progressCardLabel}>Betreuung von</Text>
              <Text style={styles.progressCardName}>{selectedMentorship.mentee?.name}</Text>

              {/* Mini-Step-Übersicht */}
              <View style={styles.miniStepRow}>
                {sortedSessionTypes.map((st, idx) => {
                  const isDone = completedStepIds.includes(st.id);
                  const isCurrent = !isDone && idx === completedStepIds.length;
                  const chipBg = isDone
                    ? "rgba(39,174,96,0.8)"
                    : isCurrent
                    ? COLORS.gold
                    : "rgba(255,255,255,0.1)";
                  return (
                    <View key={st.id} style={[styles.miniStepChip, { backgroundColor: chipBg }]}>
                      <Text style={styles.miniStepText}>{isDone ? "✓" : idx + 1}</Text>
                    </View>
                  );
                })}
              </View>

              <Text style={styles.progressCardSub}>
                {completedStepIds.length} von {sessionTypes.length} Steps abgeschlossen
              </Text>
            </View>

            {/* Nächster Step Info */}
            {nextStep ? (
              <>
                <View style={styles.amberBox}>
                  <Text style={styles.amberLabel}>{"NÄCHSTER SCHRITT"}</Text>
                  <Text style={styles.amberStepName}>
                    {nextStep.sort_order}. {nextStep.name}
                  </Text>
                  <Text style={styles.amberDesc}>{nextStep.description}</Text>
                </View>

                {/* Session-Formular */}
                <Text style={styles.sectionLabel}>{"SESSION DOKUMENTIEREN"}</Text>

                {/* Datum */}
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Datum (TT.MM.JJJJ)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={date}
                    onChangeText={setDate}
                    placeholder="z.B. 18.03.2026"
                    placeholderTextColor="#98A2B3"
                    keyboardType="numbers-and-punctuation"
                  />
                </View>

                {/* Online / Offline Toggle */}
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Durchführung</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        !isOnline ? styles.toggleButtonActive : styles.toggleButtonInactive,
                      ]}
                      onPress={() => setIsOnline(false)}
                    >
                      <Text
                        style={
                          !isOnline ? styles.toggleTextActive : styles.toggleTextInactive
                        }
                      >
                        Vor Ort
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        isOnline ? styles.toggleButtonActive : styles.toggleButtonInactive,
                      ]}
                      onPress={() => setIsOnline(true)}
                    >
                      <Text
                        style={
                          isOnline ? styles.toggleTextActive : styles.toggleTextInactive
                        }
                      >
                        Online
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Details (optional)</Text>
                  <TextInput
                    style={[styles.textInput, { minHeight: 100 }]}
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Notizen zur Session..."
                    placeholderTextColor="#98A2B3"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Speichern */}
                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: isSaving ? COLORS.border : COLORS.cta },
                  ]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving ? "Wird gespeichert..." : "Session dokumentieren"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.completedBox}>
                <Text style={styles.completedTitle}>Alle Steps abgeschlossen! 🎉</Text>
                <Text style={styles.completedText}>
                  Alle 10 Schritte wurden dokumentiert. Die Betreuung kann abgeschlossen werden.
                </Text>
              </View>
            )}
          </>
        )}
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
  page: { padding: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 12 },
  listCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 24,
  },
  listItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 16 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemSelected: { backgroundColor: "#eff6ff" },
  radioCircle: {
    width: 20, height: 20, borderRadius: 9999, borderWidth: 2, marginRight: 12,
    alignItems: "center", justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioCircleInactive: { borderColor: COLORS.border },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: COLORS.white },
  itemName: { fontWeight: "600", color: COLORS.primary, flex: 1 },
  progressCard: { backgroundColor: COLORS.primary, borderRadius: 16, padding: 20, marginBottom: 24 },
  progressCardLabel: { color: COLORS.white, opacity: 0.7, fontSize: 14, marginBottom: 4 },
  progressCardName: { color: COLORS.white, fontSize: 20, fontWeight: "bold", marginBottom: 12 },
  miniStepRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniStepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  miniStepText: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  progressCardSub: { color: COLORS.white, opacity: 0.6, fontSize: 12, marginTop: 12 },
  amberBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  amberLabel: { color: "#92400e", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 4 },
  amberStepName: { color: "#78350f", fontWeight: "bold", fontSize: 18 },
  amberDesc: { color: "#b45309", fontSize: 14, marginTop: 4 },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  formLabel: { color: COLORS.secondary, fontSize: 14, fontWeight: "500", marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.primary,
  },
  toggleRow: { flexDirection: "row", gap: 12 },
  toggleButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, alignItems: "center" },
  toggleButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleButtonInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  toggleTextActive: { color: COLORS.white, fontWeight: "600" },
  toggleTextInactive: { color: COLORS.secondary, fontWeight: "600" },
  saveButton: { borderRadius: 12, paddingVertical: 16, alignItems: "center" },
  saveButtonText: { color: COLORS.white, fontWeight: "bold", fontSize: 16 },
  completedBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 12,
    padding: 24,
    alignItems: "center",
  },
  completedTitle: { color: "#15803d", fontWeight: "bold", fontSize: 18, marginBottom: 8 },
  completedText: { color: "#16a34a", fontSize: 14, textAlign: "center" },
});
