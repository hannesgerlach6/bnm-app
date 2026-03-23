import React, { useState, useEffect, useCallback } from "react";
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
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

const ERSTKONTAKT_TYPE_NAME = "Erstkontakt";
const BNM_BOX_TYPE_NAME = "BNM-Box";
const NACHBETREUUNG_TYPE_NAME = "Nachbetreuung";

export default function DocumentSessionScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
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

  // Mobile DatePicker State
  const todayObj = new Date();
  const currentYear = todayObj.getFullYear();
  const YEAR_OPTIONS = [currentYear, currentYear - 1, currentYear - 2];

  // Hilfsfunktion: ISO-String in Tag/Monat/Jahr aufteilen
  function parseDateParts(iso: string): { day: number; month: number; year: number } {
    const parts = iso.split("-");
    if (parts.length === 3) {
      return {
        year: parseInt(parts[0], 10),
        month: parseInt(parts[1], 10),
        day: parseInt(parts[2], 10),
      };
    }
    return { year: currentYear, month: todayObj.getMonth() + 1, day: todayObj.getDate() };
  }

  const [pickerDay, setPickerDay] = useState<number>(() => parseDateParts(todayIso).day);
  const [pickerMonth, setPickerMonth] = useState<number>(() => parseDateParts(todayIso).month);
  const [pickerYear, setPickerYear] = useState<number>(() => parseDateParts(todayIso).year);
  // Welche Spalte ist gerade offen: "day" | "month" | "year" | null
  const [openPickerCol, setOpenPickerCol] = useState<"day" | "month" | "year" | null>(null);

  // Maximale Tageszahl für gewählten Monat/Jahr
  function maxDayForMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
  }

  // Prüfen ob das gewählte Datum in der Zukunft liegt
  function isPickerDateFuture(day: number, month: number, year: number): boolean {
    const chosen = new Date(year, month - 1, day);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    return chosen > today;
  }

  // ISO-String aus Picker-Werten zusammenbauen und in den date-State schreiben
  const applyPickerDate = useCallback((day: number, month: number, year: number) => {
    const clampedDay = Math.min(day, maxDayForMonth(month, year));
    const mm = String(month).padStart(2, "0");
    const dd = String(clampedDay).padStart(2, "0");
    setDate(`${year}-${mm}-${dd}`);
  }, []);

  // Picker-State mit date-State synchronisieren (z.B. wenn Edit-Mode befüllt)
  useEffect(() => {
    if (Platform.OS !== "web" && date) {
      const parts = parseDateParts(date);
      setPickerDay(parts.day);
      setPickerMonth(parts.month);
      setPickerYear(parts.year);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);
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
    return { ok: true, isoDate: trimmed };
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
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("docSession.accessDenied")}</Text>
      </View>
    );
  }

  if (myMentorships.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.boldTitle, { color: themeColors.text }]}>{t("docSession.noMentorships")}</Text>
        <Text style={[styles.centerSubText, { color: themeColors.textSecondary }]}>
          {isAdmin ? t("docSession.noMentorshipsAdmin") : t("docSession.noMentorshipsText")}
        </Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>{t("docSession.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Mentee auswählen (wenn mehrere oder Admin) */}
        {(myMentorships.length > 1 || isAdmin) && (
          <>
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>
              {isAdmin ? t("docSession.chooseAll") : t("docSession.choose")}
            </Text>
            <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              {myMentorships.map((m, idx) => (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.listItem,
                    idx < myMentorships.length - 1 ? styles.listItemBorder : {},
                    selectedMentorshipId === m.id ? [styles.listItemSelected, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff" }] : {},
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
                    <Text style={[styles.itemName, { color: themeColors.text }]}>{m.mentee?.name}</Text>
                    <Text style={[styles.itemSub, { color: themeColors.textTertiary }]}>
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
              <View style={[styles.nachbetreuungBox, { backgroundColor: isDark ? "#1a3a2a" : "#f0fdf4", borderColor: isDark ? "#2a6a4a" : "#bbf7d0" }]}>
                <Text style={[styles.nachbetreuungLabel, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("docSession.aftercare")}</Text>
                <Text style={[styles.nachbetreuungText, { color: isDark ? "#4ade80" : "#16a34a" }]}>
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
                <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("docSession.chooseType")}</Text>
                <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  {sortedSessionTypes.map((st, idx) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.listItem,
                        idx < sortedSessionTypes.length - 1 ? styles.listItemBorder : {},
                        adminSelectedTypeId === st.id ? [styles.listItemSelected, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff" }] : {},
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
                        <Text style={[styles.itemName, { color: themeColors.text }]}>{st.sort_order}. {st.name}</Text>
                        <Text style={[styles.itemSub, { color: themeColors.textTertiary }]}>{st.description}</Text>
                      </View>
                      {completedStepIds.includes(st.id) && (
                        <View style={[styles.doneChip, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
                          <Text style={[styles.doneChipText, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("docSession.done")}</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {!isAdmin && !isCompleted && nextStep && (
              <View style={[styles.amberBox, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#7a5c1a" : "#fde68a" }]}>
                <Text style={[styles.amberLabel, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("docSession.nextStep")}</Text>
                <Text style={[styles.amberStepName, { color: isDark ? "#fde68a" : "#78350f" }]}>
                  {nextStep.sort_order}. {nextStep.name}
                </Text>
                <Text style={[styles.amberDesc, { color: isDark ? "#fbbf24" : "#b45309" }]}>{nextStep.description}</Text>
              </View>
            )}

            {(isCompleted || nextStep || (isAdmin && adminSelectedTypeId) || forceNewSession) && (
              <>
                <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("docSession.document")}</Text>

                {isErstkontaktStep && (
                  <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                    <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>
                      {t("docSession.contactAttempt").replace("{0}", String(previousAttempts))}
                    </Text>
                    <TextInput
                      style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.text }]}
                      value={attemptNumber}
                      onChangeText={setAttemptNumber}
                      placeholder={`z.B. ${previousAttempts + 1}`}
                      placeholderTextColor={themeColors.textTertiary}
                      keyboardType="number-pad"
                    />
                    {previousAttempts > 0 && (
                      <Text style={[styles.attemptHint, { color: themeColors.textTertiary }]}>
                        {t("docSession.previousAttempts")
                          .replace("{0}", String(previousAttempts))
                          .replace("{1}", previousAttempts !== 1 ? "e" : "")}
                      </Text>
                    )}
                  </View>
                )}

                {isBnmBoxStep && (
                  <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                    <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("docSession.deliveryType")}</Text>
                    <View style={styles.toggleRow}>
                      {BNM_BOX_DELIVERY_OPTIONS.map((opt) => (
                        <TouchableOpacity
                          key={opt.key}
                          style={[
                            styles.toggleButton,
                            bnmBoxDelivery === opt.key
                              ? styles.toggleButtonActive
                              : [styles.toggleButtonInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                          ]}
                          onPress={() => setBnmBoxDelivery(opt.key)}
                        >
                          <Text
                            style={
                              bnmBoxDelivery === opt.key ? styles.toggleTextActive : [styles.toggleTextInactive, { color: themeColors.textSecondary }]
                            }
                          >
                            {opt.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("docSession.dateLabelNew")}</Text>
                  {Platform.OS === "web" ? (
                    <input
                      type="date"
                      value={date}
                      max={todayIso}
                      onChange={(e) => setDate(e.target.value)}
                      style={{
                        borderWidth: 1,
                        borderColor: themeColors.border,
                        borderRadius: 6,
                        paddingLeft: 12,
                        paddingRight: 12,
                        paddingTop: 8,
                        paddingBottom: 8,
                        color: themeColors.text,
                        fontSize: 14,
                        backgroundColor: themeColors.background,
                        width: "100%",
                        boxSizing: "border-box",
                        outline: "none",
                        fontFamily: "inherit",
                      } as React.CSSProperties}
                    />
                  ) : (
                    <>
                      {/* 3-Spalten Mobile DatePicker */}
                      <View style={styles.datePickerRow}>
                        {/* Tag */}
                        <TouchableOpacity
                          style={[styles.datePickerCol, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}
                          onPress={() => setOpenPickerCol(openPickerCol === "day" ? null : "day")}
                        >
                          <Text style={[styles.datePickerColLabel, { color: themeColors.textTertiary }]}>
                            {t("datePicker.labelDay")}
                          </Text>
                          <Text style={[styles.datePickerColValue, { color: themeColors.text }]}>
                            {String(pickerDay).padStart(2, "0")}
                          </Text>
                        </TouchableOpacity>

                        {/* Monat */}
                        <TouchableOpacity
                          style={[styles.datePickerCol, styles.datePickerColMiddle, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}
                          onPress={() => setOpenPickerCol(openPickerCol === "month" ? null : "month")}
                        >
                          <Text style={[styles.datePickerColLabel, { color: themeColors.textTertiary }]}>
                            {t("datePicker.labelMonth")}
                          </Text>
                          <Text style={[styles.datePickerColValue, { color: themeColors.text }]}>
                            {t(`datePicker.month.${pickerMonth}` as Parameters<typeof t>[0])}
                          </Text>
                        </TouchableOpacity>

                        {/* Jahr */}
                        <TouchableOpacity
                          style={[styles.datePickerCol, { borderColor: themeColors.border, backgroundColor: themeColors.background }]}
                          onPress={() => setOpenPickerCol(openPickerCol === "year" ? null : "year")}
                        >
                          <Text style={[styles.datePickerColLabel, { color: themeColors.textTertiary }]}>
                            {t("datePicker.labelYear")}
                          </Text>
                          <Text style={[styles.datePickerColValue, { color: themeColors.text }]}>
                            {pickerYear}
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {/* Dropdown für Tag */}
                      {openPickerCol === "day" && (
                        <View style={[styles.datePickerDropdown, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                          <ScrollView style={styles.datePickerList} nestedScrollEnabled>
                            {Array.from({ length: maxDayForMonth(pickerMonth, pickerYear) }, (_, i) => i + 1).map((item) => {
                              const isFuture = isPickerDateFuture(item, pickerMonth, pickerYear);
                              const isSelected = item === pickerDay;
                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[
                                    styles.datePickerItem,
                                    isSelected && styles.datePickerItemSelected,
                                    { borderBottomColor: themeColors.border },
                                  ]}
                                  onPress={() => {
                                    if (isFuture) return;
                                    setPickerDay(item);
                                    applyPickerDate(item, pickerMonth, pickerYear);
                                    setOpenPickerCol(null);
                                  }}
                                  disabled={isFuture}
                                >
                                  <Text style={[
                                    styles.datePickerItemText,
                                    { color: isFuture ? themeColors.textTertiary : isSelected ? COLORS.primary : themeColors.text },
                                    isSelected && styles.datePickerItemTextSelected,
                                  ]}>
                                    {String(item).padStart(2, "0")}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      {/* Dropdown für Monat */}
                      {openPickerCol === "month" && (
                        <View style={[styles.datePickerDropdown, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                          <ScrollView style={styles.datePickerList} nestedScrollEnabled>
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((item) => {
                              const isFuture = isPickerDateFuture(pickerDay, item, pickerYear);
                              const isSelected = item === pickerMonth;
                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[
                                    styles.datePickerItem,
                                    isSelected && styles.datePickerItemSelected,
                                    { borderBottomColor: themeColors.border },
                                  ]}
                                  onPress={() => {
                                    if (isFuture) return;
                                    const clampedDay = Math.min(pickerDay, maxDayForMonth(item, pickerYear));
                                    setPickerMonth(item);
                                    setPickerDay(clampedDay);
                                    applyPickerDate(clampedDay, item, pickerYear);
                                    setOpenPickerCol(null);
                                  }}
                                  disabled={isFuture}
                                >
                                  <Text style={[
                                    styles.datePickerItemText,
                                    { color: isFuture ? themeColors.textTertiary : isSelected ? COLORS.primary : themeColors.text },
                                    isSelected && styles.datePickerItemTextSelected,
                                  ]}>
                                    {t(`datePicker.month.${item}` as Parameters<typeof t>[0])}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}

                      {/* Dropdown für Jahr */}
                      {openPickerCol === "year" && (
                        <View style={[styles.datePickerDropdown, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                          <ScrollView style={styles.datePickerList} nestedScrollEnabled>
                            {YEAR_OPTIONS.map((item) => {
                              const isFuture = isPickerDateFuture(pickerDay, pickerMonth, item);
                              const isSelected = item === pickerYear;
                              return (
                                <TouchableOpacity
                                  key={item}
                                  style={[
                                    styles.datePickerItem,
                                    isSelected && styles.datePickerItemSelected,
                                    { borderBottomColor: themeColors.border },
                                  ]}
                                  onPress={() => {
                                    if (isFuture) return;
                                    const clampedDay = Math.min(pickerDay, maxDayForMonth(pickerMonth, item));
                                    setPickerYear(item);
                                    setPickerDay(clampedDay);
                                    applyPickerDate(clampedDay, pickerMonth, item);
                                    setOpenPickerCol(null);
                                  }}
                                  disabled={isFuture}
                                >
                                  <Text style={[
                                    styles.datePickerItemText,
                                    { color: isFuture ? themeColors.textTertiary : isSelected ? COLORS.primary : themeColors.text },
                                    isSelected && styles.datePickerItemTextSelected,
                                  ]}>
                                    {item}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                      )}
                    </>
                  )}
                </View>

                <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("docSession.execution")}</Text>
                  <View style={styles.toggleRow}>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        !isOnline
                          ? styles.toggleButtonActive
                          : [styles.toggleButtonInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                      ]}
                      onPress={() => setIsOnline(false)}
                    >
                      <Text style={!isOnline ? styles.toggleTextActive : [styles.toggleTextInactive, { color: themeColors.textSecondary }]}>
                        {t("docSession.inPerson")}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.toggleButton,
                        isOnline
                          ? styles.toggleButtonActive
                          : [styles.toggleButtonInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                      ]}
                      onPress={() => setIsOnline(true)}
                    >
                      <Text style={isOnline ? styles.toggleTextActive : [styles.toggleTextInactive, { color: themeColors.textSecondary }]}>
                        {t("docSession.online")}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("docSession.detailsLabel")}</Text>
                  <TextInput
                    style={[styles.textInput, { height: 80, minHeight: undefined, borderColor: themeColors.border, color: themeColors.text }]}
                    value={details}
                    onChangeText={setDetails}
                    placeholder={t("docSession.detailsPlaceholder")}
                    placeholderTextColor={themeColors.textTertiary}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                </View>

                <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("docSession.durationLabel")}</Text>
                  <TextInput
                    style={[styles.textInput, { borderColor: themeColors.border, color: themeColors.text }]}
                    value={durationMinutes}
                    onChangeText={setDurationMinutes}
                    placeholder="z.B. 45"
                    placeholderTextColor={themeColors.textTertiary}
                    keyboardType="number-pad"
                  />
                  <Text style={[styles.attemptHint, { color: themeColors.textTertiary }]}>{t("docSession.durationHint")}</Text>
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
                    {isAdmin && (
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
                    )}
                  </>
                )}
              </>
            )}

            {/* Session-History: letzte Sessions mit Edit-Möglichkeit */}
            {selectedMentorshipId && allSessions.length > 0 && !forceNewSession && !editingSessionId && (
              <View style={[styles.historyBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Text style={[styles.historyTitle, { color: themeColors.textTertiary }]}>{t("docSession.historyTitle")}</Text>
                {allSessions.slice(-5).reverse().map((s) => {
                  const stName = sessionTypes.find((st) => st.id === s.session_type_id)?.name ?? "Session";
                  const displayDate = s.date
                    ? new Date(s.date).toLocaleDateString("de-DE")
                    : "–";
                  return (
                    <View key={s.id} style={[styles.historyRow, { borderBottomColor: themeColors.border }]}>
                      <View style={styles.historyInfo}>
                        <Text style={[styles.historyStepName, { color: themeColors.text }]}>{stName}</Text>
                        <Text style={[styles.historyDate, { color: themeColors.textSecondary }]}>{displayDate} · {s.is_online ? t("docSession.online") : t("docSession.inPerson")}</Text>
                        {s.details ? (
                          <Text style={[styles.historyDetails, { color: themeColors.textTertiary }]} numberOfLines={1}>{s.details}</Text>
                        ) : null}
                      </View>
                      {isAdmin && (
                        <TouchableOpacity
                          style={[styles.historyEditButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
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
                            setAdminSelectedTypeId(s.session_type_id);
                          }}
                        >
                          <Text style={[styles.historyEditText, { color: themeColors.textSecondary }]}>{t("docSession.historyEdit")} ✏️</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Alle Schritte abgeschlossen (10/10) */}
            {!isAdmin && !isCompleted && !nextStep && (
              <View style={[styles.completedBox, { backgroundColor: isDark ? "#1a3a2a" : "#f0fdf4", borderColor: isDark ? "#2a6a4a" : "#bbf7d0" }]}>
                <Text style={[styles.completedTitle, { color: isDark ? "#4ade80" : "#15803d" }]}>{t("sessions.allComplete")}</Text>
                <Text style={[styles.completedText, { color: isDark ? "#4ade80" : "#16a34a" }]}>
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
              <View style={[styles.moreSessionBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.moreSessionHeader}>
                  <Text style={[styles.moreSessionTitle, { color: themeColors.text }]}>{t("docSession.moreSessionTitle")}</Text>
                  <TouchableOpacity onPress={() => { setShowRepeatSection(false); setAdditionalStepId(""); }}>
                    <Text style={[styles.moreSessionClose, { color: themeColors.textTertiary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
                <Text style={[styles.moreSessionSub, { color: themeColors.textSecondary }]}>
                  {t("docSession.moreSessionSub")}
                </Text>
                <View style={[styles.listCard, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                  {completedAllowsMultipleSteps.map((st, idx) => {
                    const count = allSessions.filter((s) => s.session_type_id === st.id).length;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        style={[
                          styles.listItem,
                          idx < completedAllowsMultipleSteps.length - 1 ? styles.listItemBorder : {},
                          additionalStepId === st.id ? [styles.listItemSelected, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff" }] : {},
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
                          <Text style={[styles.itemName, { color: themeColors.text }]}>{st.sort_order}. {st.name}</Text>
                          <Text style={[styles.itemSub, { color: themeColors.textTertiary }]}>
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
                <View style={[styles.amberBox, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#7a5c1a" : "#fde68a" }]}>
                  <Text style={[styles.amberLabel, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("docSession.furtherSession")}</Text>
                  <Text style={[styles.amberStepName, { color: isDark ? "#fde68a" : "#78350f" }]}>
                    {additionalStepId
                      ? sortedSessionTypes.find((st) => st.id === additionalStepId)?.name ?? ""
                      : lastCompletedAllowsMultipleStep?.name ?? ""}
                  </Text>
                  <Text style={[styles.amberDesc, { color: isDark ? "#fbbf24" : "#b45309" }]}>
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
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },
  boldTitle: { fontWeight: "bold", fontSize: 18, marginBottom: 8 },
  centerSubText: { textAlign: "center", fontSize: 14, marginBottom: 24 },
  backButton: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 9, borderRadius: 5 },
  backButtonText: { color: COLORS.white, fontWeight: "600" },
  page: { padding: 20 },
  sectionLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 10 },
  listCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
  },
  listItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12 },
  listItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listItemSelected: {},
  radioCircle: {
    width: 20, height: 20, borderRadius: 9999, borderWidth: 2, marginRight: 12,
    alignItems: "center", justifyContent: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  radioCircleInactive: { borderColor: COLORS.border },
  radioDot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: COLORS.white },
  itemName: { fontWeight: "600" },
  itemSub: { fontSize: 12, marginTop: 2 },
  doneChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  doneChipText: { fontSize: 11, fontWeight: "500" },
  progressCard: { backgroundColor: COLORS.primary, borderRadius: 8, padding: 16, marginBottom: 16 },
  progressCardLabel: { color: COLORS.white, opacity: 0.7, fontSize: 13, marginBottom: 2 },
  progressCardName: { color: COLORS.white, fontSize: 17, fontWeight: "bold", marginBottom: 10 },
  miniStepRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  miniStepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  miniStepText: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  progressCardSub: { color: COLORS.white, opacity: 0.6, fontSize: 12, marginTop: 12 },
  nachbetreuungBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  nachbetreuungLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 4 },
  nachbetreuungText: { fontSize: 14 },
  amberBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  amberLabel: { fontSize: 11, fontWeight: "600", letterSpacing: 1, marginBottom: 2 },
  amberStepName: { fontWeight: "bold", fontSize: 15 },
  amberDesc: { fontSize: 13, marginTop: 2 },
  formCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  formLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  attemptHint: { fontSize: 12, marginTop: 6 },
  toggleRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  toggleButton: { flex: 1, paddingVertical: 9, borderRadius: 5, borderWidth: 1, alignItems: "center", minWidth: 80 },
  toggleButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  toggleButtonInactive: {},
  toggleTextActive: { color: COLORS.white, fontWeight: "600" },
  toggleTextInactive: { fontWeight: "600" },
  saveButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center" },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  completedBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
  },
  completedTitle: { fontWeight: "bold", fontSize: 15, marginBottom: 6 },
  completedText: { fontSize: 13, textAlign: "center" },
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  moreSessionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  moreSessionTitle: { fontWeight: "700", fontSize: 14 },
  moreSessionClose: { fontSize: 16, paddingHorizontal: 4 },
  moreSessionSub: { fontSize: 13, marginBottom: 12 },
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
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginTop: 16,
    marginBottom: 12,
  },
  historyTitle: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    gap: 8,
  },
  historyInfo: { flex: 1 },
  historyStepName: { fontWeight: "600", fontSize: 13 },
  historyDate: { fontSize: 12, marginTop: 1 },
  historyDetails: { fontSize: 12, marginTop: 1 },
  historyEditButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    borderWidth: 1,
  },
  historyEditText: { fontSize: 12, fontWeight: "500" },

  // Mobile DatePicker
  datePickerRow: {
    flexDirection: "row",
    gap: 0,
  },
  datePickerCol: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  datePickerColMiddle: {
    marginHorizontal: 6,
    flex: 2,
  },
  datePickerColLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  datePickerColValue: {
    fontSize: 15,
    fontWeight: "600",
  },
  datePickerDropdown: {
    marginTop: 6,
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    maxHeight: 200,
  },
  datePickerList: {
    maxHeight: 200,
  },
  datePickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  datePickerItemSelected: {
    backgroundColor: "rgba(10, 58, 90, 0.08)",
  },
  datePickerItemText: {
    fontSize: 14,
  },
  datePickerItemTextSelected: {
    fontWeight: "700",
  },
});
