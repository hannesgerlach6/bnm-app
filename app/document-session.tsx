import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { showError, showSuccess, showConfirm } from "../lib/errorHandler";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { COLORS } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";

const ERSTKONTAKT_TYPE_NAME = "Erstkontakt";
const BNM_BOX_TYPE_NAME = "BNM-Box";
const NACHBETREUUNG_TYPE_NAME = "Nachbetreuung";

export default function DocumentSessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const {
    getMentorshipsByMentorId,
    getMentorshipById,
    getCompletedStepIds,
    getSessionsByMentorshipId,
    sessionTypes,
    addSession,
    updateSession,
    deleteSession,
    mentorships,
  } = useData();

  const params = useLocalSearchParams<{ mentorshipId?: string; editSessionId?: string }>();

  const isAdmin = user?.role === "admin" || user?.role === "office";

  const myMentorships = user
    ? isAdmin
      ? mentorships
      : getMentorshipsByMentorId(user.id).filter(
          (m) => m.status === "active" || m.status === "completed"
        )
    : [];

  const [selectedMentorshipId, setSelectedMentorshipId] = useState<string>(
    params.mentorshipId ?? (myMentorships[0]?.id ?? "")
  );

  // Datum im ISO-Format JJJJ-MM-TT (heute vorbelegt)
  const todayIso = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(todayIso);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [details, setDetails] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  // Edit-Mode: ID der Session die bearbeitet wird (null = neue Session)
  const [editingSessionId, setEditingSessionId] = useState<string | null>(
    params.editSessionId ?? null
  );

  // Wenn editSessionId per URL übergeben: Felder vorausfüllen
  useEffect(() => {
    if (!params.editSessionId) return;
    const allSessionsForMentorship = params.mentorshipId
      ? getSessionsByMentorshipId(params.mentorshipId)
      : [];
    const sessionToEdit = allSessionsForMentorship.find((s) => s.id === params.editSessionId);
    if (!sessionToEdit) return;
    const isoDateStr = sessionToEdit.date
      ? new Date(sessionToEdit.date).toISOString().split("T")[0]
      : todayIso;
    setDate(isoDateStr);
    setIsOnline(sessionToEdit.is_online);
    setDetails(sessionToEdit.details ?? "");
    setDurationMinutes(sessionToEdit.duration_minutes ? String(sessionToEdit.duration_minutes) : "");
    if (isAdmin) setAdminSelectedTypeId(sessionToEdit.session_type_id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.editSessionId]);

  const [adminSelectedTypeId, setAdminSelectedTypeId] = useState<string>("");
  const [attemptNumber, setAttemptNumber] = useState<string>("");
  const [bnmBoxDelivery, setBnmBoxDelivery] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<string>("");
  const [forceNewSession, setForceNewSession] = useState<boolean>(false);
  const [additionalStepId, setAdditionalStepId] = useState<string>("");
  const [showRepeatSection, setShowRepeatSection] = useState<boolean>(false);

  const BNM_BOX_DELIVERY_OPTIONS = [
    { key: "persoenlich", label: t("docSession.deliveryPersonal") },
    { key: "post", label: t("docSession.deliveryPost") },
    { key: "gutschein", label: t("docSession.deliveryVoucher") },
  ] as const;

  const selectedMentorship = selectedMentorshipId
    ? getMentorshipById(selectedMentorshipId)
    : undefined;

  const completedStepIds = selectedMentorshipId
    ? getCompletedStepIds(selectedMentorshipId)
    : [];

  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  const nextStep = sortedSessionTypes.find((st) => !completedStepIds.includes(st.id));

  const lastCompletedAllowsMultipleStep = forceNewSession
    ? sortedSessionTypes
        .filter((st) => completedStepIds.includes(st.id) && st.allows_multiple)
        .at(-1)
    : undefined;

  const isCompleted = selectedMentorship?.status === "completed";
  const nachbetreuungType = sessionTypes.find((st) => st.name === NACHBETREUUNG_TYPE_NAME);

  const activeSessionType = isAdmin
    ? sessionTypes.find((st) => st.id === adminSelectedTypeId)
    : isCompleted
    ? nachbetreuungType
    : forceNewSession && additionalStepId
    ? sessionTypes.find((st) => st.id === additionalStepId)
    : forceNewSession && lastCompletedAllowsMultipleStep
    ? lastCompletedAllowsMultipleStep
    : nextStep;

  const isErstkontaktStep =
    activeSessionType?.name === ERSTKONTAKT_TYPE_NAME;

  const isBnmBoxStep =
    activeSessionType?.name === BNM_BOX_TYPE_NAME;

  const allSessions = selectedMentorshipId
    ? getSessionsByMentorshipId(selectedMentorshipId)
    : [];
  const erstkontaktTypeId = sessionTypes.find((st) => st.name === ERSTKONTAKT_TYPE_NAME)?.id;
  const previousAttempts = erstkontaktTypeId
    ? allSessions.filter((s) => s.session_type_id === erstkontaktTypeId).length
    : 0;

  const activeStepSessionCount = activeSessionType
    ? allSessions.filter((s) => s.session_type_id === activeSessionType.id).length
    : 0;

  const completedAllowsMultipleSteps = sortedSessionTypes.filter(
    (st) => st.allows_multiple && completedStepIds.includes(st.id)
  );


  // Datum validieren: ISO-Format JJJJ-MM-TT, nicht in der Zukunft
  function validateAndParseDate(input: string): { ok: boolean; isoDate: string } {
    const trimmed = input.trim();
    if (!trimmed) return { ok: false, isoDate: "" };
    // ISO-Format: JJJJ-MM-TT
    const isoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoRegex.test(trimmed)) return { ok: false, isoDate: "" };
    const parsed = new Date(trimmed + "T00:00:00");
    if (isNaN(parsed.getTime())) return { ok: false, isoDate: "" };
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (parsed > today) return { ok: false, isoDate: "future" };
    return { ok: true, isoDate: parsed.toISOString() };
  }

  async function handleSave() {
    if (!selectedMentorshipId || !user) return;

    if (isAdmin && !adminSelectedTypeId && !editingSessionId) {
      showError(t("docSession.selectTypeError"));
      return;
    }

    if (!isAdmin && !isCompleted && !nextStep && !forceNewSession && !editingSessionId) {
      showSuccess(t("docSession.allDoneSuccess"));
      return;
    }

    if (!date.trim()) {
      showError(t("docSession.dateError"));
      return;
    }

    const { ok: dateOk, isoDate } = validateAndParseDate(date);
    if (!dateOk) {
      if (isoDate === "future") {
        showError(t("docSession.dateErrorFuture"));
      } else {
        showError(t("docSession.dateErrorFormat"));
      }
      return;
    }

    // Update-Modus: bestehende Session aktualisieren
    if (editingSessionId) {
      setIsSaving(true);
      let finalDetails = details.trim() || undefined;
      const durationNum = durationMinutes.trim()
        ? parseInt(durationMinutes.trim(), 10) || undefined
        : undefined;
      try {
        await updateSession(editingSessionId, {
          date: isoDate,
          is_online: isOnline,
          details: finalDetails,
          duration_minutes: durationNum,
        });
        const typeName = activeSessionType?.name ?? "Session";
        setEditingSessionId(null);
        setDate(todayIso);
        setDetails("");
        setDurationMinutes("");
        showSuccess(t("docSession.historyUpdateSuccess").replace("{0}", typeName));
      } catch (err) {
        const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
        showError(t("docSession.errorUpdate").replace("{0}", msg));
      } finally {
        setIsSaving(false);
      }
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
      showError(t("docSession.noTypeError"));
      return;
    }

    setIsSaving(true);

    let finalDetails = details.trim() || undefined;
    if (isBnmBoxStep && bnmBoxDelivery) {
      const deliveryLabel =
        BNM_BOX_DELIVERY_OPTIONS.find((o) => o.key === bnmBoxDelivery)?.label ?? bnmBoxDelivery;
      finalDetails = finalDetails
        ? t("docSession.handoverWithDetails").replace("{0}", deliveryLabel).replace("{1}", finalDetails)
        : t("docSession.handoverPrefix").replace("{0}", deliveryLabel);
    }

    const attemptNum = isErstkontaktStep && attemptNumber
      ? parseInt(attemptNumber, 10) || undefined
      : undefined;

    const durationNum = durationMinutes.trim()
      ? parseInt(durationMinutes.trim(), 10) || undefined
      : undefined;

    try {
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

      setForceNewSession(false);
      setAdditionalStepId("");
      setDurationMinutes("");

      const typeName = activeSessionType?.name ?? "Session";
      showSuccess(t("docSession.successMsg").replace("{0}", typeName), () => router.back());
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(t("docSession.errorSave").replace("{0}", msg));
    } finally {
      setIsSaving(false);
    }
  }

  if (!user || (user.role !== "mentor" && user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessText}>{t("docSession.accessDenied")}</Text>
      </View>
    );
  }

  if (myMentorships.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.boldTitle}>{t("docSession.noMentorships")}</Text>
        <Text style={styles.centerSubText}>
          {isAdmin ? t("docSession.noMentorshipsAdmin") : t("docSession.noMentorshipsText")}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("docSession.back")}</Text>
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
              {isAdmin ? t("docSession.chooseAll") : t("docSession.choose")}
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
                      {m.mentor?.name} · {m.status === "completed" ? t("docSession.completed") : t("docSession.active")}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        {selectedMentorship && (
          <>
            {isCompleted && (
              <View style={styles.nachbetreuungBox}>
                <Text style={styles.nachbetreuungLabel}>{t("docSession.aftercare")}</Text>
                <Text style={styles.nachbetreuungText}>
                  {t("docSession.aftercareText")}
                </Text>
              </View>
            )}

            {!isCompleted && (
              <View style={styles.progressCard}>
                <Text style={styles.progressCardLabel}>{t("docSession.menteeOf")}</Text>
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
                  {t("docSession.stepsCompleted")
                    .replace("{0}", String(completedStepIds.length))
                    .replace("{1}", String(sessionTypes.length))}
                </Text>
              </View>
            )}

            {isAdmin && !isCompleted && (
              <>
                <Text style={styles.sectionLabel}>{t("docSession.chooseType")}</Text>
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
                          <Text style={styles.doneChipText}>{t("docSession.done")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!isAdmin && !isCompleted && nextStep && (
              <View style={styles.amberBox}>
                <Text style={styles.amberLabel}>{t("docSession.nextStep")}</Text>
                <Text style={styles.amberStepName}>
                  {nextStep.sort_order}. {nextStep.name}
                </Text>
                <Text style={styles.amberDesc}>{nextStep.description}</Text>
              </View>
            )}

            {(isCompleted || nextStep || (isAdmin && adminSelectedTypeId) || forceNewSession) && (
              <>
                <Text style={styles.sectionLabel}>{t("docSession.document")}</Text>

                {isErstkontaktStep && (
                  <View style={styles.formCard}>
                    <Text style={styles.formLabel}>
                      {t("docSession.contactAttempt").replace("{0}", String(previousAttempts))}
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
                        {t("docSession.previousAttempts")
                          .replace("{0}", String(previousAttempts))
                          .replace("{1}", previousAttempts !== 1 ? "e" : "")}
                      </Text>
                    )}
                  </View>
                )}

                {isBnmBoxStep && (
                  <View style={styles.formCard}>
                    <Text style={styles.formLabel}>{t("docSession.deliveryType")}</Text>
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

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>{t("docSession.dateLabelNew")}</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      value={date}
                      max={todayIso}
                      onChange={(e) => setDate(e.target.value)}
                      style={{
                        borderWidth: 1,
                        borderColor: COLORS.border,
                        borderRadius: 6,
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 8,
                        paddingBottom: 8,
                        color: COLORS.primary,
                        fontSize: 14,
                        backgroundColor: COLORS.white,
                        width: "100%",
                        boxSizing: "border-box",
                        outline: "none",
                        fontFamily: "inherit",
                      } as React.CSSProperties}
                    />
                  ) : (
                    <TextInput
                      style={styles.textInput}
                      value={date}
                      onChangeText={setDate}
                      placeholder={t("docSession.datePlaceholder")}
                      placeholderTextColor="#98A2B3"
                      keyboardType="numbers-and-punctuation"
                      maxLength={10}
                    />
                  )}
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>{t("docSession.execution")}</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        !isOnline ? styles.toggleButtonActive : styles.toggleButtonInactive,
                      ]}
                      onPress={() => setIsOnline(false)}
                    >
                      <Text style={!isOnline ? styles.toggleTextActive : styles.toggleTextInactive}>
                        {t("docSession.inPerson")}
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
                        {t("docSession.online")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>{t("docSession.detailsLabel")}</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, minHeight: undefined }]}
                    value={details}
                    onChangeText={setDetails}
                    placeholder={t("docSession.detailsPlaceholder")}
                    placeholderTextColor="#98A2B3"
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>{t("docSession.durationLabel")}</Text>
                  <TextInput
                    style={styles.textInput}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    placeholder="z.B. 45"
                    placeholderTextColor="#98A2B3"
                    keyboardType="number-pad"
                  />
                  <Text style={styles.attemptHint}>{t("docSession.durationHint")}</Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.saveButton,
                    { backgroundColor: isSaving ? COLORS.border : COLORS.cta },
                  ]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={styles.saveButtonText}>
                    {isSaving
                      ? editingSessionId
                        ? t("docSession.historyUpdating")
                        : t("docSession.saving")
                      : editingSessionId
                      ? t("docSession.historyUpdateSave")
                      : t("docSession.save")}
                  </Text>
                </TouchableOpacity>

                {editingSessionId && (
                  <>
                    <TouchableOpacity
                      style={styles.cancelEditButton}
                      onPress={() => {
                        setEditingSessionId(null);
                        setDate(todayIso);
                        setDetails("");
                        setDurationMinutes("");
                        setIsOnline(false);
                        if (params.editSessionId) router.back();
                      }}
                    >
                      <Text style={styles.cancelEditButtonText}>{t("docSession.cancelMore")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteSessionButton}
                      onPress={async () => {
                        const ok = await showConfirm(t("sessionEdit.delete"), t("sessionEdit.confirmDelete"));
                        if (!ok) return;
                        try {
                          await deleteSession(editingSessionId);
                          showSuccess(t("sessionEdit.deleted"), () => router.back());
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
                          showError(t("docSession.errorDelete").replace("{0}", msg));
                        }
                      }}
                    >
                      <Text style={styles.deleteSessionButtonText}>{t("sessionEdit.delete")}</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* Session-History: letzte Sessions mit Edit-Möglichkeit */}
            {selectedMentorshipId && allSessions.length > 0 && !forceNewSession && !editingSessionId && (
              <View style={styles.historyBox}>
                <Text style={styles.historyTitle}>{t("docSession.historyTitle")}</Text>
                {allSessions.slice(-5).reverse().map((s) => {
                  const stName = sessionTypes.find((st) => st.id === s.session_type_id)?.name ?? "Session";
                  const displayDate = s.date
                    ? new Date(s.date).toLocaleDateString("de-DE")
                    : "–";
                  return (
                    <View key={s.id} style={styles.historyRow}>
                      <View style={styles.historyInfo}>
                        <Text style={styles.historyStepName}>{stName}</Text>
                        <Text style={styles.historyDate}>{displayDate} · {s.is_online ? t("docSession.online") : t("docSession.inPerson")}</Text>
                        {s.details ? (
                          <Text style={styles.historyDetails} numberOfLines={1}>{s.details}</Text>
                        ) : null}
                      </View>
                      <TouchableOpacity
                        style={styles.historyEditButton}
                        onPress={() => {
                          // Felder vorausfüllen
                          const isoDateStr = s.date
                            ? new Date(s.date).toISOString().split("T")[0]
                            : todayIso;
                          setDate(isoDateStr);
                          setIsOnline(s.is_online);
                          setDetails(s.details ?? "");
                          setDurationMinutes(s.duration_minutes ? String(s.duration_minutes) : "");
                          setEditingSessionId(s.id);
                          // AdminSelectedTypeId setzen falls admin
                          if (isAdmin) setAdminSelectedTypeId(s.session_type_id);
                        }}
                      >
                        <Text style={styles.historyEditText}>{t("docSession.historyEdit")} ✏️</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Alle Schritte abgeschlossen (10/10) */}
            {!isAdmin && !isCompleted && !nextStep && (
              <View style={styles.completedBox}>
                <Text style={styles.completedTitle}>{t("sessions.allComplete")}</Text>
                <Text style={styles.completedText}>
                  {t("docSession.allDoneText")}
                </Text>
                <TouchableOpacity
                  style={styles.backToMentorshipButton}
                  onPress={() => router.back()}
                >
                  <Text style={styles.backToMentorshipText}>{t("sessions.backToMentorship")}</Text>
                </TouchableOpacity>
                {completedAllowsMultipleSteps.length > 0 && (
                  <TouchableOpacity
                    style={styles.aftercareLink}
                    onPress={() => setShowRepeatSection(!showRepeatSection)}
                  >
                    <Text style={styles.aftercareLinkText}>{t("sessions.documentAftercare")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* "Bereits erledigten Schritt wiederholen?" Link (nur sichtbar wenn nextStep vorhanden) */}
            {!isAdmin && !isCompleted && nextStep && completedAllowsMultipleSteps.length > 0 && !forceNewSession && !showRepeatSection && (
              <TouchableOpacity
                style={styles.repeatStepLink}
                onPress={() => setShowRepeatSection(true)}
              >
                <Text style={styles.repeatStepLinkText}>{t("sessions.repeatStep")}</Text>
              </TouchableOpacity>
            )}

            {/* Wiederholbare Schritte — nur auf Anfrage sichtbar */}
            {!isAdmin && !isCompleted && showRepeatSection && !forceNewSession && (
              <View style={styles.moreSessionBox}>
                <View style={styles.moreSessionHeader}>
                  <Text style={styles.moreSessionTitle}>{t("docSession.moreSessionTitle")}</Text>
                  <TouchableOpacity onPress={() => { setShowRepeatSection(false); setAdditionalStepId(""); }}>
                    <Text style={styles.moreSessionClose}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.moreSessionSub}>
                  {t("docSession.moreSessionSub")}
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
                          <Text style={styles.itemSub}>
                            {count !== 1
                              ? t("docSession.sessionCountPlural").replace("{0}", String(count))
                              : t("docSession.sessionCount").replace("{0}", String(count))}
                          </Text>
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
                      {t("docSession.moreSessionButton")}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}

            {forceNewSession && (
              <>
                <View style={styles.amberBox}>
                  <Text style={styles.amberLabel}>{t("docSession.furtherSession")}</Text>
                  <Text style={styles.amberStepName}>
                    {additionalStepId
                      ? sortedSessionTypes.find((st) => st.id === additionalStepId)?.name ?? ""
                      : lastCompletedAllowsMultipleStep?.name ?? ""}
                  </Text>
                  <Text style={styles.amberDesc}>
                    {t("docSession.unlimited").replace("{0}", String(activeStepSessionCount + 1))}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelMoreButton}
                  onPress={() => { setForceNewSession(false); setAdditionalStepId(""); setShowRepeatSection(false); }}
                >
                  <Text style={styles.cancelMoreButtonText}>{t("docSession.cancelMore")}</Text>
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
  backToMentorshipButton: {
    marginTop: 12,
    backgroundColor: COLORS.primary,
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 20,
    alignItems: "center",
    width: "100%",
  },
  backToMentorshipText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  aftercareLink: { marginTop: 10 },
  aftercareLinkText: { color: COLORS.link, fontSize: 13, textDecorationLine: "underline", textAlign: "center" },
  repeatStepLink: { marginBottom: 16, alignItems: "center" },
  repeatStepLinkText: { color: COLORS.tertiary, fontSize: 13, textDecorationLine: "underline" },
  moreSessionBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  moreSessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  moreSessionTitle: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  moreSessionClose: { color: COLORS.tertiary, fontSize: 16, paddingHorizontal: 4 },
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

  cancelEditButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  cancelEditButtonText: { color: COLORS.secondary, fontWeight: "600", fontSize: 13 },
  deleteSessionButton: {
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 12,
  },
  deleteSessionButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 13 },

  historyBox: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 8,
  },
  historyInfo: { flex: 1 },
  historyStepName: { fontWeight: "600", color: COLORS.primary, fontSize: 13 },
  historyDate: { color: COLORS.secondary, fontSize: 12, marginTop: 1 },
  historyDetails: { color: COLORS.tertiary, fontSize: 12, marginTop: 1 },
  historyEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: COLORS.bg,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  historyEditText: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },
});
