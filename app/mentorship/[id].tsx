import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Modal,
  Alert,
} from "react-native";
import { showError, showSuccess } from "../../lib/errorHandler";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";


export default function MentorshipDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const {
    getMentorshipById,
    getSessionsByMentorshipId,
    getCompletedStepIds,
    sessionTypes,
    updateMentorshipStatus,
    updateMentorshipNotes,
    cancelMentorship,
    deleteSession,
  } = useData();
  const [notesText, setNotesText] = useState<string | null>(null);
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  // Abbruch-Flow State
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  const { id } = useLocalSearchParams<{ id: string }>();

  const mentorship = id ? getMentorshipById(id) : undefined;
  const sessions = id ? getSessionsByMentorshipId(id) : [];
  const completedStepIds = id ? getCompletedStepIds(id) : [];
  const menteeConfirmedSteps = mentorship?.mentee_confirmed_steps ?? [];
  // Steps die der Mentee bestätigt hat, der Mentor aber noch nicht dokumentiert hat
  const discrepancyStepIds = menteeConfirmedSteps.filter((sid) => !completedStepIds.includes(sid));

  // Notizen initialisieren (einmalig bei erstem Laden)
  const currentNotes = mentorship?.notes ?? "";
  const displayNotes = notesText !== null ? notesText : currentNotes;

  const canWriteNotes = !!user && (
    (user.role === "mentor" && mentorship?.mentor_id === user.id)
    || user.role === "admin"
    || user.role === "office"
  );

  async function handleSaveNotes() {
    if (!mentorship) return;
    setIsSavingNotes(true);
    try {
      await updateMentorshipNotes(mentorship.id, displayNotes);
      showSuccess(t("notes.saved"));
    } catch {
      showError(t("common.error"));
    } finally {
      setIsSavingNotes(false);
    }
  }

  if (!mentorship) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.boldTitle, { color: themeColors.text }]}>{t("mentorship.notFound")}</Text>
        <TouchableOpacity
          style={[styles.primaryButton, { marginTop: 16 }]}
          onPress={() => router.back()}
        >
          <Text style={styles.primaryButtonText}>{t("mentorship.back")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const progress = Math.round((completedStepIds.length / sessionTypes.length) * 100);
  const mentorshipId = mentorship.id;

  const canDocumentSession =
    user &&
    (user.role === "admin" || user.id === mentorship.mentor_id) &&
    mentorship.status === "active";

  const canChangeStatus =
    user &&
    (user.role === "admin" || user.id === mentorship.mentor_id) &&
    mentorship.status === "active";

  async function handleComplete() {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(t("mentorship.completeTitle"), t("mentorship.completeText"), [
        { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
        { text: t("common.confirm"), onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    setIsUpdatingStatus(true);
    try {
      await updateMentorshipStatus(mentorshipId, "completed");
      // Notification an Mentee senden dass Feedback gewünscht wird
      if (mentorship?.mentee_id) {
        await supabase.from("notifications").insert({
          user_id: mentorship?.mentee_id,
          type: "feedback",
          title: t("mentorship.feedbackRequestTitle"),
          body: t("mentorship.feedbackRequestBody"),
          related_id: mentorshipId,
        });
      }
      showSuccess(t("mentorship.completeSuccess"), () => router.back());
    } catch {
      showError(t("mentorship.completeError"));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleCancel() {
    // Zeigt Modal mit Textarea für Abbruch-Grund
    setShowCancelModal(true);
  }

  async function handleCancelConfirm() {
    if (!cancelReason.trim()) {
      showError(t("cancel.reasonRequired"));
      return;
    }
    setIsCancelling(true);
    try {
      await cancelMentorship(mentorshipId, cancelReason.trim());
      if (mentorship?.mentee_id) {
        await supabase.from("notifications").insert({
          user_id: mentorship?.mentee_id,
          type: "feedback",
          title: t("mentorship.feedbackRequestTitle"),
          body: t("mentorship.feedbackRequestBody"),
          related_id: mentorshipId,
        });
      }
      setShowCancelModal(false);
      showSuccess(t("cancel.cancelled"), () =>
        router.replace({
          pathname: "/feedback",
          params: { mentorshipId: mentorshipId, type: "cancellation" },
        })
      );
    } catch {
      showError(t("mentorship.cancelError"));
    } finally {
      setIsCancelling(false);
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(t("sessionEdit.delete"), t("sessionEdit.confirmDelete"), [
        { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
        { text: t("common.confirm"), onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await deleteSession(sessionId);
      showSuccess(t("sessionEdit.deleted"));
    } catch {
      showError(t("common.error"));
    }
  }

  const statusBg =
    mentorship.status === "active"
      ? (isDark ? "#2A2D3A" : "#F5F5F7")
      : mentorship.status === "completed"
      ? (isDark ? "#1a3a2a" : "#dcfce7")
      : mentorship.status === "pending_approval"
      ? (isDark ? "#3a2e1a" : "#fef3c7")
      : (isDark ? "#3a1a1a" : "#fee2e2");
  const statusTextColor =
    mentorship.status === "active"
      ? (isDark ? "#A0A0B0" : "#475467")
      : mentorship.status === "completed"
      ? (isDark ? "#4ade80" : "#15803d")
      : mentorship.status === "pending_approval"
      ? (isDark ? "#fbbf24" : "#b45309")
      : (isDark ? "#f87171" : "#b91c1c");
  const statusLabel =
    mentorship.status === "active"
      ? t("mentorship.active")
      : mentorship.status === "completed"
      ? t("mentorship.completed")
      : mentorship.status === "pending_approval"
      ? t("mentees.pendingApproval")
      : t("mentorship.cancelled");

  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Status-Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusTextColor }]}>{statusLabel}</Text>
          </View>
          <Text style={[styles.dateSince, { color: themeColors.textTertiary }]}>
            {t("mentorship.since").replace("{0}", new Date(mentorship.assigned_at).toLocaleDateString("de-DE"))}
          </Text>
        </View>

        {/* Mentee-Info */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: themeColors.textTertiary }]}>{t("mentorship.mentee")}</Text>
          <Text style={[styles.bigName, { color: themeColors.text }]}>{mentorship.mentee?.name}</Text>
          <View style={styles.chipRow}>
            <InfoChip label={mentorship.mentee?.city ?? ""} themeColors={themeColors} />
            <InfoChip label={`${mentorship.mentee?.age} J.`} themeColors={themeColors} />
            <InfoChip label={mentorship.mentee?.gender === "male" ? t("mentorship.brother") : t("mentorship.sister")} themeColors={themeColors} />
          </View>
          {mentorship.mentee?.phone && (
            <Text style={[styles.phoneText, { color: themeColors.textSecondary }]}>{mentorship.mentee.phone}</Text>
          )}
        </View>

        {/* Mentor-Info */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.cardSectionLabel, { color: themeColors.textTertiary }]}>{t("mentorship.mentor")}</Text>
          <Text style={[styles.bigName, { fontSize: 18, color: themeColors.text }]}>{mentorship.mentor?.name}</Text>
          <View style={styles.chipRow}>
            <InfoChip label={mentorship.mentor?.city ?? ""} themeColors={themeColors} />
            <InfoChip label={`${mentorship.mentor?.age} J.`} themeColors={themeColors} />
          </View>
        </View>

        {/* Fortschrittsbalken */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <View style={styles.progressHeader}>
            <Text style={[styles.cardTitle, { color: themeColors.text }]}>{t("mentorship.progress")}</Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
            <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <Text style={[styles.progressSub, { color: themeColors.textTertiary }]}>
            {t("mentorship.stepsCompleted")
              .replace("{0}", String(completedStepIds.length))
              .replace("{1}", String(sessionTypes.length))}
          </Text>
        </View>

        {/* Diskrepanz-Warnung: Mentee hat bestätigt, Mentor noch nicht dokumentiert */}
        {(user?.role === "admin" || user?.role === "office" || user?.id === mentorship.mentor_id) && discrepancyStepIds.length > 0 && (
          <View style={[styles.discrepancyBanner, { backgroundColor: isDark ? "#3a2e1a" : "#fffbeb", borderColor: isDark ? "#6b4e1a" : "#fde68a" }]}>
            <Text style={[styles.discrepancyTitle, { color: isDark ? "#fbbf24" : "#92400e" }]}>⚠ {t("menteeProgress.discrepancy")}</Text>
            {discrepancyStepIds.map((sid) => {
              const step = sessionTypes.find((st) => st.id === sid);
              if (!step) return null;
              return (
                <Text key={sid} style={[styles.discrepancyItem, { color: isDark ? "#fbbf24" : "#b45309" }]}>· {step.name}</Text>
              );
            })}
          </View>
        )}

        {/* Session-Timeline */}
        <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("mentorship.sessionHistory")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, padding: 0, overflow: "hidden" }]}>
          {sortedSessionTypes.map((step, idx) => {
            const isDone = completedStepIds.includes(step.id);
            const isCurrent = !isDone && idx === completedStepIds.length;
            const session = sessions.find((s) => s.session_type_id === step.id);
            const isLast = idx === sortedSessionTypes.length - 1;

            return (
              <View
                key={step.id}
                style={[
                  styles.timelineItem,
                  !isLast ? [styles.timelineItemBorder, { borderBottomColor: themeColors.border }] : {},
                  isCurrent ? { backgroundColor: isDark ? "#2a2218" : "#fffbeb" } : {},
                ]}
              >
                <View style={styles.timelineDotCol}>
                  <View
                    style={[
                      styles.timelineDot,
                      isDone
                        ? { backgroundColor: COLORS.cta }
                        : isCurrent
                        ? { backgroundColor: COLORS.gold }
                        : { backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border },
                    ]}
                  >
                    {isDone ? (
                      <Text style={styles.dotTextWhite}>✓</Text>
                    ) : (
                      <Text
                        style={
                          isCurrent ? styles.dotTextWhite : [styles.dotTextTertiary, { color: themeColors.textTertiary }]
                        }
                      >
                        {idx + 1}
                      </Text>
                    )}
                  </View>
                  {!isLast && (
                    <View
                      style={[
                        styles.timelineLine,
                        { backgroundColor: isDone ? COLORS.cta : themeColors.border },
                      ]}
                    />
                  )}
                </View>

                {/* Content */}
                <View style={styles.timelineContent}>
                  <Text
                    style={[
                      styles.stepName,
                      isDone
                        ? { color: COLORS.cta }
                        : isCurrent
                        ? { color: themeColors.text }
                        : { color: themeColors.textTertiary },
                    ]}
                  >
                    {step.name}
                  </Text>

                  {isDone && session && (
                    <>
                      <Text style={[styles.sessionDate, { color: themeColors.textTertiary }]}>
                        {new Date(session.date).toLocaleDateString("de-DE")} ·{" "}
                        {session.is_online ? t("mentorship.online") : t("mentorship.inPerson")}
                        {session.duration_minutes ? ` · ${t("timeline.duration").replace("{0}", String(session.duration_minutes))}` : ""}
                        {session.attempt_number && session.attempt_number > 1
                          ? ` · ${t("timeline.attempt").replace("{0}", String(session.attempt_number))}`
                          : ""}
                      </Text>
                      {session.details && (
                        <Text style={[styles.sessionDetails, { color: themeColors.textSecondary }]}>"{session.details}"</Text>
                      )}
                      {user?.role === "admin" && (
                        <View style={styles.sessionActionRow}>
                          <TouchableOpacity
                            style={[styles.sessionDeleteButton, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}
                            onPress={() => handleDeleteSession(session.id)}
                          >
                            <Text style={[styles.sessionDeleteText, { color: isDark ? "#f87171" : "#dc2626" }]}>🗑 {t("sessionEdit.delete")}</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}

                  {isCurrent && (
                    <View style={[styles.currentBadge, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
                      <Text style={[styles.currentBadgeText, { color: isDark ? "#fbbf24" : "#b45309" }]}>{t("mentorship.nextStep")}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Abschluss-Banner wenn alle Steps erledigt */}
        {mentorship.status === "active" && completedStepIds.length === sessionTypes.length && canChangeStatus && (
          <View style={[styles.allDoneBanner, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7", borderColor: isDark ? "#2d6a4a" : "#86efac" }]}>
            <Text style={[styles.allDoneBannerTitle, { color: isDark ? "#4ade80" : "#15803d" }]}>✓ {t("mentorship.allStepsComplete")}</Text>
            <TouchableOpacity
              style={[styles.allDoneButton, { backgroundColor: isDark ? "#2d6a4a" : "#15803d" }]}
              onPress={handleComplete}
            >
              <Text style={styles.allDoneButtonText}>
                {t("mentorship.completeNow")}
              </Text>
            </TouchableOpacity>
            <Text style={[styles.allDoneBannerHint, { color: isDark ? "#4ade80" : "#16a34a" }]}>{t("mentorship.completeHint")}</Text>
          </View>
        )}

        {/* Aktions-Buttons */}
        {mentorship.status === "active" && (
          <View style={{ gap: 12, marginBottom: 16 }}>
            {canDocumentSession && (
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: COLORS.cta }]}
                onPress={() =>
                  router.push({ pathname: "/document-session", params: { mentorshipId: mentorship.id } })
                }
              >
                <Text style={styles.primaryButtonText}>{t("mentorship.documentSession")}</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
              onPress={() =>
                router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
              }
            >
              <Text style={styles.primaryButtonText}>{t("mentorship.openChat")}</Text>
            </TouchableOpacity>

            {canChangeStatus && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <TouchableOpacity
                  style={[styles.completeButton, { backgroundColor: isDark ? "#1a3a2a" : "#f0fdf4", borderColor: isDark ? "#2d6a4a" : "#bbf7d0" }, isUpdatingStatus ? { opacity: 0.5 } : {}]}
                  onPress={handleComplete}
                  disabled={isUpdatingStatus}
                >
                  <Text style={[styles.completeButtonText, { color: isDark ? "#4ade80" : "#15803d" }]}>
                    {isUpdatingStatus ? "..." : t("mentorship.complete")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }, isUpdatingStatus ? { opacity: 0.5 } : {}]}
                  onPress={handleCancel}
                  disabled={isUpdatingStatus}
                >
                  <Text style={[styles.cancelButtonText, { color: isDark ? "#f87171" : "#dc2626" }]}>
                    {isUpdatingStatus ? "..." : t("mentorship.cancel")}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {mentorship.status !== "active" && (
          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: COLORS.primary, marginBottom: 16 }]}
            onPress={() =>
              router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
            }
          >
            <Text style={styles.primaryButtonText}>{t("mentorship.openChat")}</Text>
          </TouchableOpacity>
        )}

        {mentorship.completed_at && (
          <Text style={[styles.completedAtText, { color: themeColors.textTertiary }]}>
            {t("mentorship.completedAt")
              .replace("{0}", mentorship.status === "completed" ? t("mentorship.completed") : t("mentorship.cancelled"))
              .replace("{1}", new Date(mentorship.completed_at).toLocaleDateString("de-DE"))}
          </Text>
        )}

        {/* Mentor-Notizen (nur für Mentor + Admin sichtbar) */}
        {canWriteNotes && (
          <View style={[styles.notesCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.notesTitle, { color: themeColors.text }]}>{t("notes.title")}</Text>
            <Text style={[styles.notesHint, { color: themeColors.textTertiary }]}>{t("notes.hint")}</Text>
            <TextInput
              style={[styles.notesInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
              value={displayNotes}
              onChangeText={setNotesText}
              placeholder={t("notes.placeholder")}
              placeholderTextColor={themeColors.textTertiary}
              multiline
              numberOfLines={4}
            />
            <TouchableOpacity
              style={[styles.notesSaveButton, isSavingNotes ? { opacity: 0.6 } : {}]}
              onPress={handleSaveNotes}
              disabled={isSavingNotes}
            >
              <Text style={styles.notesSaveButtonText}>
                {isSavingNotes ? t("notes.saving") : t("notes.save")}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>

    {/* Abbruch-Modal mit Pflichtfeld Grund */}
    <Modal
      visible={showCancelModal}
      transparent
      animationType="fade"
      onRequestClose={() => setShowCancelModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("cancel.title")}</Text>
          <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>{t("cancel.confirm")}</Text>
          <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>{t("cancel.reason")}</Text>
          <TextInput
            style={[styles.modalTextInput, { borderColor: themeColors.border, color: themeColors.text }]}
            value={cancelReason}
            onChangeText={setCancelReason}
            placeholder={t("cancel.reasonPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />
          <View style={styles.modalButtonRow}>
            <TouchableOpacity
              style={[styles.modalCancelButton, { borderColor: themeColors.border }]}
              onPress={() => { setShowCancelModal(false); setCancelReason(""); }}
              disabled={isCancelling}
            >
              <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>{t("common.back")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmButton, isCancelling ? { opacity: 0.6 } : {}]}
              onPress={handleCancelConfirm}
              disabled={isCancelling}
            >
              <Text style={styles.modalConfirmText}>
                {isCancelling ? "..." : t("cancel.title")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

function InfoChip({ label, themeColors }: { label: string; themeColors: any }) {
  return (
    <View style={[styles.infoChip, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.infoChipText, { color: themeColors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  boldTitle: { fontWeight: "bold" },
  page: { padding: 24 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 14, fontWeight: "600" },
  dateSince: { fontSize: 12 },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  cardSectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  cardTitle: { fontWeight: "bold" },
  bigName: { fontWeight: "bold", fontSize: 20, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 12 },
  phoneText: { fontSize: 14, marginTop: 8 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressPercent: { color: COLORS.gold, fontWeight: "bold", fontSize: 18 },
  progressTrack: { height: 12, borderRadius: 9999, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressSub: { fontSize: 12, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  timelineItemBorder: { borderBottomWidth: 1 },
  timelineDotCol: { alignItems: "center", marginRight: 12 },
  timelineDot: { width: 32, height: 32, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  dotTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  dotTextTertiary: { fontSize: 12, fontWeight: "bold" },
  timelineLine: { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 8 },
  stepName: { fontWeight: "600" },
  sessionDate: { fontSize: 12, marginTop: 2 },
  sessionDetails: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  currentBadge: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  currentBadgeText: { fontSize: 12, fontWeight: "500" },
  primaryButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center" },
  primaryButtonText: { color: COLORS.white, fontWeight: "bold" },
  completeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  completeButtonText: { fontWeight: "600", fontSize: 13 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelButtonText: { fontWeight: "600", fontSize: 14 },
  completedAtText: { fontSize: 12, textAlign: "center" },
  infoChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  infoChipText: { fontSize: 12, fontWeight: "500" },
  discrepancyBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  discrepancyTitle: { fontWeight: "700", fontSize: 14, marginBottom: 6 },
  discrepancyItem: { fontSize: 13, marginTop: 2 },
  allDoneBanner: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  allDoneBannerTitle: { fontWeight: "700", fontSize: 16, marginBottom: 12, textAlign: "center" },
  allDoneButton: {
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
  },
  allDoneButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  allDoneBannerHint: { fontSize: 12, textAlign: "center" },
  notesCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  notesTitle: { fontWeight: "700", fontSize: 15, marginBottom: 4 },
  notesHint: { fontSize: 12, marginBottom: 10 },
  notesInput: {
    borderWidth: 1,
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  notesSaveButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  notesSaveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },

  // Session-Bearbeiten/Löschen in Timeline
  sessionActionRow: { flexDirection: "row", gap: 8, marginTop: 6 },
  sessionEditButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  sessionEditText: { fontSize: 11, fontWeight: "500" },
  sessionDeleteButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  sessionDeleteText: { fontSize: 11, fontWeight: "500" },

  // Abbruch-Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 12,
    padding: 20,
    width: "100%",
    maxWidth: 400,
  },
  modalTitle: { fontWeight: "700", fontSize: 16, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, marginBottom: 14 },
  modalLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  modalButtonRow: { flexDirection: "row", gap: 10 },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "600" },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    borderRadius: 6,
    paddingVertical: 9,
    alignItems: "center",
  },
  modalConfirmText: { color: COLORS.white, fontWeight: "700" },
});
