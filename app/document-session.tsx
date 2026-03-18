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

const ERSTKONTAKT_TYPE_NAME = "Erstkontakt";
const BNM_BOX_TYPE_NAME = "BNM-Box";
const NACHBETREUUNG_TYPE_NAME = "Nachbetreuung";

const BNM_BOX_DELIVERY_OPTIONS = [
  { key: "persoenlich", label: "Persönlich" },
  { key: "post", label: "Per Post" },
  { key: "gutschein", label: "Gutschein" },
] as const;

export default function DocumentSessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    getMentorshipsByMentorId,
    getMentorshipById,
    getCompletedStepIds,
    getSessionsByMentorshipId,
    sessionTypes,
    addSession,
    mentorships,
  } = useData();

  const params = useLocalSearchParams<{ mentorshipId?: string }>();

  // FIX 1: Auch "completed" Mentorships einbeziehen
  // FIX 3: Admin sieht ALLE Mentorships
  const isAdmin = user?.role === "admin";

  const myMentorships = user
    ? isAdmin
      ? mentorships // Admin sieht alle
      : getMentorshipsByMentorId(user.id).filter(
          (m) => m.status === "active" || m.status === "completed"
        )
    : [];

  const [selectedMentorshipId, setSelectedMentorshipId] = useState<string>(
    params.mentorshipId ?? (myMentorships[0]?.id ?? "")
  );
  const [date, setDate] = useState<string>(new Date().toLocaleDateString("de-DE"));
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [details, setDetails] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // FIX 3: Admin kann Session-Typ frei wählen
  const [adminSelectedTypeId, setAdminSelectedTypeId] = useState<string>("");

  // FIX 8: Kontakt-Versuche
  const [attemptNumber, setAttemptNumber] = useState<string>("");

  // FIX 9: BNM-Box Übergabe-Art
  const [bnmBoxDelivery, setBnmBoxDelivery] = useState<string>("");

  // Feature: Dauer in Minuten
  const [durationMinutes, setDurationMinutes] = useState<string>("");

  // Feature: Weitere Session für allows_multiple Steps
  const [forceNewSession, setForceNewSession] = useState<boolean>(false);

  // Welcher allows_multiple Step soll zusätzlich dokumentiert werden
  const [additionalStepId, setAdditionalStepId] = useState<string>("");

  const selectedMentorship = selectedMentorshipId
    ? getMentorshipById(selectedMentorshipId)
    : undefined;

  const completedStepIds = selectedMentorshipId
    ? getCompletedStepIds(selectedMentorshipId)
    : [];

  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  // Nächster sequenzieller Step (für Mentor-Modus)
  // Ein Step gilt als abgeschlossen wenn er mind. 1 Session hat (getCompletedStepIds gibt eindeutige IDs zurück)
  const nextStep = sortedSessionTypes.find((st) => !completedStepIds.includes(st.id));

  // Aktuell aktiver Step (auch für allows_multiple – wenn forceNewSession gesetzt)
  // Letzter abgeschlossener Step wenn allows_multiple und forceNewSession
  const lastCompletedAllowsMultipleStep = forceNewSession
    ? sortedSessionTypes
        .filter((st) => completedStepIds.includes(st.id) && st.allows_multiple)
        .at(-1)
    : undefined;

  // FIX 1: Nachbetreuungs-Modus wenn Mentorship completed
  const isCompleted = selectedMentorship?.status === "completed";
  const nachbetreuungType = sessionTypes.find((st) => st.name === NACHBETREUUNG_TYPE_NAME);

  // Aktiver Session-Typ (je nach Modus)
  const activeSessionType = isAdmin
    ? sessionTypes.find((st) => st.id === adminSelectedTypeId)
    : isCompleted
    ? nachbetreuungType
    : forceNewSession && additionalStepId
    ? sessionTypes.find((st) => st.id === additionalStepId)
    : forceNewSession && lastCompletedAllowsMultipleStep
    ? lastCompletedAllowsMultipleStep
    : nextStep;

  // Ist es ein Erstkontakt-Step?
  const isErstkontaktStep =
    activeSessionType?.name === ERSTKONTAKT_TYPE_NAME;

  // Ist es ein BNM-Box-Step?
  const isBnmBoxStep =
    activeSessionType?.name === BNM_BOX_TYPE_NAME;

  // FIX 8: Anzahl bisheriger Erstkontakt-Sessions für diese Mentorship
  const allSessions = selectedMentorshipId
    ? getSessionsByMentorshipId(selectedMentorshipId)
    : [];
  const erstkontaktTypeId = sessionTypes.find((st) => st.name === ERSTKONTAKT_TYPE_NAME)?.id;
  const previousAttempts = erstkontaktTypeId
    ? allSessions.filter((s) => s.session_type_id === erstkontaktTypeId).length
    : 0;

  // Anzahl bisheriger Sessions für den aktiven allows_multiple Step (Mentor-Modus)
  const activeStepSessionCount = activeSessionType
    ? allSessions.filter((s) => s.session_type_id === activeSessionType.id).length
    : 0;

  // Liste der abgeschlossenen allows_multiple Steps (für "Weitere Session" Button)
  const completedAllowsMultipleSteps = sortedSessionTypes.filter(
    (st) => st.allows_multiple && completedStepIds.includes(st.id)
  );

  // Zeige "Weitere Session hinzufügen"-Bereich nur für Mentor (nicht admin, nicht completed)
  const showAddMoreSession =
    !isAdmin &&
    !isCompleted &&
    completedAllowsMultipleSteps.length > 0 &&
    !forceNewSession;

  async function handleSave() {
    if (!selectedMentorshipId || !user) return;

    // Admin: muss Session-Typ gewählt haben
    if (isAdmin && !adminSelectedTypeId) {
      Alert.alert("Fehler", "Bitte wähle einen Session-Typ.");
      return;
    }

    // Mentor: kein nextStep bei aktiver Mentorship? Abbruch (außer bei weiterer Session)
    if (!isAdmin && !isCompleted && !nextStep && !forceNewSession) {
      Alert.alert("Info", "Alle Steps für diese Betreuung sind bereits abgeschlossen.");
      return;
    }

    if (!date.trim()) {
      Alert.alert("Fehler", "Bitte gib ein Datum ein.");
      return;
    }

    const sessionTypeId = isAdmin
      ? adminSelectedTypeId
      : isCompleted
      ? nachbetreuungType?.id ?? ""
      : forceNewSession && additionalStepId
      ? additionalStepId
      : forceNewSession && lastCompletedAllowsMultipleStep
      ? lastCompletedAllowsMultipleStep.id
      : nextStep?.id ?? "";

    if (!sessionTypeId) {
      Alert.alert("Fehler", "Kein gültiger Session-Typ gefunden.");
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

    // FIX 9: BNM-Box Details vorausfüllen
    let finalDetails = details.trim() || undefined;
    if (isBnmBoxStep && bnmBoxDelivery) {
      const deliveryLabel =
        BNM_BOX_DELIVERY_OPTIONS.find((o) => o.key === bnmBoxDelivery)?.label ?? bnmBoxDelivery;
      finalDetails = finalDetails
        ? `Übergabe: ${deliveryLabel} – ${finalDetails}`
        : `Übergabe: ${deliveryLabel}`;
    }

    // FIX 8: attempt_number für Erstkontakt
    const attemptNum = isErstkontaktStep && attemptNumber
      ? parseInt(attemptNumber, 10) || undefined
      : undefined;

    const durationNum = durationMinutes.trim()
      ? parseInt(durationMinutes.trim(), 10) || undefined
      : undefined;

    await addSession({
      mentorship_id: selectedMentorshipId,
      session_type_id: sessionTypeId,
      date: isoDate,
      is_online: isOnline,
      details: finalDetails,
      documented_by: user.id,
      attempt_number: attemptNum,
      duration_minutes: durationNum,
    });

    setIsSaving(false);
    setForceNewSession(false);
    setAdditionalStepId("");
    setDurationMinutes("");

    const typeName = activeSessionType?.name ?? "Session";
    Alert.alert(
      "Session dokumentiert",
      `"${typeName}" wurde erfolgreich dokumentiert.`,
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
        <Text style={styles.boldTitle}>Keine Betreuungen gefunden</Text>
        <Text style={styles.centerSubText}>
          {isAdmin ? "Es gibt noch keine Mentorships." : "Du hast keine aktiven oder abgeschlossenen Mentees."}
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
        {/* Mentee auswählen (wenn mehrere oder Admin) */}
        {(myMentorships.length > 1 || isAdmin) && (
          <>
            <Text style={styles.sectionLabel}>
              {isAdmin ? "BETREUUNG WÄHLEN (ALLE)" : "BETREUUNG WÄHLEN"}
            </Text>
            <View style={styles.listCard}>
              {myMentorships.map((m, idx) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.listItem,
                    idx < myMentorships.length - 1 ? styles.listItemBorder : {},
                    selectedMentorshipId === m.id ? styles.listItemSelected : {},
                  ]}
                  onPress={() => {
                    setSelectedMentorshipId(m.id);
                    setAdminSelectedTypeId("");
                  }}
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
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemName}>{m.mentee?.name}</Text>
                    <Text style={styles.itemSub}>
                      {m.mentor?.name} · {m.status === "completed" ? "Abgeschlossen" : "Aktiv"}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {/* Aktueller Step / Betreuungsinfo */}
        {selectedMentorship && (
          <>
            {/* FIX 1: Nachbetreuungs-Banner für completed */}
            {isCompleted && (
              <View style={styles.nachbetreuungBox}>
                <Text style={styles.nachbetreuungLabel}>{"NACHBETREUUNG"}</Text>
                <Text style={styles.nachbetreuungText}>
                  Diese Betreuung ist abgeschlossen. Du kannst eine Nachbetreuungs-Session dokumentieren.
                </Text>
              </View>
            )}

            {/* Step-Fortschritt (nur bei aktiven Mentorships) */}
            {!isCompleted && (
              <View style={styles.progressCard}>
                <Text style={styles.progressCardLabel}>Betreuung von</Text>
                <Text style={styles.progressCardName}>{selectedMentorship.mentee?.name}</Text>

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
            )}

            {/* FIX 3: Admin kann Session-Typ frei wählen */}
            {isAdmin && !isCompleted && (
              <>
                <Text style={styles.sectionLabel}>{"SESSION-TYP WÄHLEN"}</Text>
                <View style={styles.listCard}>
                  {sortedSessionTypes.map((st, idx) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.listItem,
                        idx < sortedSessionTypes.length - 1 ? styles.listItemBorder : {},
                        adminSelectedTypeId === st.id ? styles.listItemSelected : {},
                      ]}
                      onPress={() => setAdminSelectedTypeId(st.id)}
                    >
                      <View
                        style={[
                          styles.radioCircle,
                          adminSelectedTypeId === st.id
                            ? styles.radioCircleActive
                            : styles.radioCircleInactive,
                        ]}
                      >
                        {adminSelectedTypeId === st.id && <View style={styles.radioDot} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{st.sort_order}. {st.name}</Text>
                        <Text style={styles.itemSub}>{st.description}</Text>
                      </View>
                      {completedStepIds.includes(st.id) && (
                        <View style={styles.doneChip}>
                          <Text style={styles.doneChipText}>Erledigt</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Nächster Step Info (Mentor-Modus, aktive Betreuung) */}
            {!isAdmin && !isCompleted && nextStep && (
              <View style={styles.amberBox}>
                <Text style={styles.amberLabel}>{"NÄCHSTER SCHRITT"}</Text>
                <Text style={styles.amberStepName}>
                  {nextStep.sort_order}. {nextStep.name}
                </Text>
                <Text style={styles.amberDesc}>{nextStep.description}</Text>
              </View>
            )}

            {/* Formular anzeigen wenn: Nachbetreuung ODER aktiver NextStep ODER Admin hat Typ gewählt ODER weitere Session */}
            {(isCompleted || nextStep || (isAdmin && adminSelectedTypeId) || forceNewSession) && (
              <>
                <Text style={styles.sectionLabel}>{"SESSION DOKUMENTIEREN"}</Text>

                {/* FIX 8: Erstkontakt – Versuch-Nummer */}
                {isErstkontaktStep && (
                  <View style={styles.formCard}>
                    <Text style={styles.formLabel}>
                      Kontaktversuch Nr. (bisherige: {previousAttempts})
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={attemptNumber}
                      onChangeText={setAttemptNumber}
                      placeholder={`z.B. ${previousAttempts + 1}`}
                      placeholderTextColor="#98A2B3"
                      keyboardType="number-pad"
                    />
                    {previousAttempts > 0 && (
                      <Text style={styles.attemptHint}>
                        Es wurden bereits {previousAttempts} Kontaktversuch{previousAttempts !== 1 ? "e" : ""} dokumentiert.
                      </Text>
                    )}
                  </View>
                )}

                {/* FIX 9: BNM-Box Übergabe-Art */}
                {isBnmBoxStep && (
                  <View style={styles.formCard}>
                    <Text style={styles.formLabel}>Übergabe-Art</Text>
                    <View style={styles.toggleRow}>
                      {BNM_BOX_DELIVERY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.toggleButton,
                            bnmBoxDelivery === opt.key ? styles.toggleButtonActive : styles.toggleButtonInactive,
                          ]}
                          onPress={() => setBnmBoxDelivery(opt.key)}
                        >
                          <Text
                            style={
                              bnmBoxDelivery === opt.key ? styles.toggleTextActive : styles.toggleTextInactive
                            }
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

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
                      <Text style={!isOnline ? styles.toggleTextActive : styles.toggleTextInactive}>
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
                      <Text style={isOnline ? styles.toggleTextActive : styles.toggleTextInactive}>
                        Online
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Details (optional)</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, minHeight: undefined }]}
                    value={details}
                    onChangeText={setDetails}
                    placeholder="Notizen zur Session..."
                    placeholderTextColor="#98A2B3"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                {/* Dauer in Minuten */}
                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Dauer (optional)</Text>
                  <TextInput
                    style={styles.textInput}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    placeholder="z.B. 45"
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                  />
                  <Text style={styles.attemptHint}>Dauer der Session in Minuten</Text>
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
            )}

            {/* Alle Steps abgeschlossen (nur für Mentor-Modus, aktiv) */}
            {!isAdmin && !isCompleted && !nextStep && !forceNewSession && (
              <View style={styles.completedBox}>
                <Text style={styles.completedTitle}>Alle Steps abgeschlossen!</Text>
                <Text style={styles.completedText}>
                  Alle Schritte wurden dokumentiert. Die Betreuung kann abgeschlossen werden.
                </Text>
              </View>
            )}

            {/* Weitere Session hinzufügen (für allows_multiple Steps) */}
            {showAddMoreSession && (
              <View style={styles.moreSessionBox}>
                <Text style={styles.moreSessionTitle}>Weitere Session dokumentieren</Text>
                <Text style={styles.moreSessionSub}>
                  Für folgende Schritte können weitere Sessions dokumentiert werden:
                </Text>
                <View style={styles.listCard}>
                  {completedAllowsMultipleSteps.map((st, idx) => {
                    const count = allSessions.filter((s) => s.session_type_id === st.id).length;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.listItem,
                          idx < completedAllowsMultipleSteps.length - 1 ? styles.listItemBorder : {},
                          additionalStepId === st.id ? styles.listItemSelected : {},
                        ]}
                        onPress={() => setAdditionalStepId(st.id)}
                      >
                        <View
                          style={[
                            styles.radioCircle,
                            additionalStepId === st.id ? styles.radioCircleActive : styles.radioCircleInactive,
                          ]}
                        >
                          {additionalStepId === st.id && <View style={styles.radioDot} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemName}>{st.sort_order}. {st.name}</Text>
                          <Text style={styles.itemSub}>{count} Session{count !== 1 ? "s" : ""} bisher</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {additionalStepId ? (
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={() => setForceNewSession(true)}
                  >
                    <Text style={styles.addMoreButtonText}>
                      Weitere Session für diesen Schritt →
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {/* forceNewSession: Step wählen und Formular anzeigen */}
            {forceNewSession && (
              <>
                <View style={styles.amberBox}>
                  <Text style={styles.amberLabel}>{"WEITERE SESSION"}</Text>
                  <Text style={styles.amberStepName}>
                    {additionalStepId
                      ? sortedSessionTypes.find((st) => st.id === additionalStepId)?.name ?? ""
                      : lastCompletedAllowsMultipleStep?.name ?? ""}
                  </Text>
                  <Text style={styles.amberDesc}>
                    Session {activeStepSessionCount + 1} von unbegrenzt
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelMoreButton}
                  onPress={() => { setForceNewSession(false); setAdditionalStepId(""); }}
                >
                  <Text style={styles.cancelMoreButtonText}>Abbrechen</Text>
                </TouchableOpacity>
              </>
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
  backButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 9, borderRadius: 5 },
  backButtonText: { color: COLORS.white, fontWeight: "600" },
  page: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 10 },
  listCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
    marginBottom: 16,
  },
  listItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemSelected: { backgroundColor: "#eff6ff" },
  radioCircle: {
    width: 20, height: 20, borderRadius: 9999, borderWidth: 2, marginRight: 12,
    alignItems: "center", justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioCircleInactive: { borderColor: COLORS.border },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: COLORS.white },
  itemName: { fontWeight: "600", color: COLORS.primary },
  itemSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  doneChip: { backgroundColor: "#dcfce7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  doneChipText: { color: "#15803d", fontSize: 11, fontWeight: "500" },
  progressCard: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 16, marginBottom: 16 },
  progressCardLabel: { color: COLORS.white, opacity: 0.7, fontSize: 13, marginBottom: 2 },
  progressCardName: { color: COLORS.white, fontSize: 17, fontWeight: "bold", marginBottom: 10 },
  miniStepRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniStepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  miniStepText: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  progressCardSub: { color: COLORS.white, opacity: 0.6, fontSize: 12, marginTop: 12 },
  nachbetreuungBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  nachbetreuungLabel: { color: "#15803d", fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 4 },
  nachbetreuungText: { color: "#16a34a", fontSize: 14 },
  amberBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  amberLabel: { color: "#92400e", fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 2 },
  amberStepName: { color: "#78350f", fontWeight: "bold", fontSize: 15 },
  amberDesc: { color: "#b45309", fontSize: 13, marginTop: 2 },
  formCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  formLabel: { color: COLORS.secondary, fontSize: 13, fontWeight: "500", marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
    fontSize: 14,
  },
  attemptHint: { color: COLORS.tertiary, fontSize: 12, marginTop: 6 },
  toggleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  toggleButton: { flex: 1, paddingVertical: 9, borderRadius: 5, borderWidth: 1, alignItems: "center", minWidth: 80 },
  toggleButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleButtonInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  toggleTextActive: { color: COLORS.white, fontWeight: "600" },
  toggleTextInactive: { color: COLORS.secondary, fontWeight: "600" },
  saveButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center" },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  completedBox: {
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  completedTitle: { color: "#15803d", fontWeight: "bold", fontSize: 15, marginBottom: 6 },
  completedText: { color: "#16a34a", fontSize: 13, textAlign: "center" },
  moreSessionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  moreSessionTitle: { color: COLORS.primary, fontWeight: "700", fontSize: 14, marginBottom: 4 },
  moreSessionSub: { color: COLORS.secondary, fontSize: 13, marginBottom: 12 },
  addMoreButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginTop: 10,
  },
  addMoreButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  cancelMoreButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  cancelMoreButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 13 },
});
