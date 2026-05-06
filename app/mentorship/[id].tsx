import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Modal,
  Platform,
  Dimensions,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { Ionicons } from "@expo/vector-icons";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { navigateToChat } from "../../lib/chatNavigation";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, SHADOWS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { Container } from "../../components/Container";
import { StatusBadge } from "../../components/StatusBadge";
import { QUESTIONNAIRE_SECTIONS } from "../../lib/questionnaireConfig";


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
  const [expandedSessions, setExpandedSessions] = useState<Set<string>>(new Set());

  // Fragebogen-Vorschau State
  const [showFeedbackPreview, setShowFeedbackPreview] = useState(false);

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
        <BNMPressable
          style={[styles.primaryButton, { marginTop: 16 }]}
          onPress={() => router.back()}
          accessibilityRole="link"
          accessibilityLabel="Zurück"
        >
          <Text style={styles.primaryButtonText}>{t("mentorship.back")}</Text>
        </BNMPressable>
      </View>
    );
  }

  const NACHBETREUUNG_TYPE_NAME = "Nachbetreuung";
  const requiredStepIds = sessionTypes
    .filter((st) => st.name !== NACHBETREUUNG_TYPE_NAME)
    .map((st) => st.id);
  const allRequiredStepsDone = requiredStepIds.every((sid) => completedStepIds.includes(sid));

  const progress = sessionTypes.length > 0 ? Math.round((completedStepIds.length / sessionTypes.length) * 100) : 0;
  const mentorshipId = mentorship.id;

  const canDocumentSession =
    user &&
    (user.role === "admin" || user.id === mentorship.mentor_id) &&
    mentorship.status === "active";

  const canChangeStatus =
    user &&
    (user.role === "admin" || user.id === mentorship.mentor_id) &&
    mentorship.status === "active";

  async function handleReactivate() {
    const ok = await showConfirm("Betreuung reaktivieren?", "Die Betreuung wird wieder auf 'Aktiv' gesetzt. Nur bei versehentlichem Abschluss verwenden.");
    if (!ok) return;
    setIsUpdatingStatus(true);
    try {
      await updateMentorshipStatus(mentorshipId, "active");
      showSuccess("Betreuung wurde reaktiviert.");
      router.back();
    } catch {
      showError(t("common.error"));
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleComplete() {
    // Nachbetreuung ist optional vor dem Abschluss — nur Pflicht-Schritte prüfen
    if (!allRequiredStepsDone && user?.role === "mentor") {
      showError(t("mentorship.stepsIncomplete"));
      return;
    }
    const ok = await showConfirm(t("mentorship.completeTitle"), t("mentorship.completeText"));
    if (!ok) return;
    setIsUpdatingStatus(true);
    let success = false;
    try {
      await updateMentorshipStatus(mentorshipId, "completed");
      // Notification wird bereits in DataContext.updateMentorshipStatus() erstellt
      success = true;
    } catch {
      showError(t("mentorship.completeError"));
    } finally {
      setIsUpdatingStatus(false);
    }
    if (success) {
      showSuccess(t("mentorship.completeSuccess"));
      router.back();
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
    let success = false;
    try {
      await cancelMentorship(mentorshipId, cancelReason.trim());
      // Notifications werden bereits in DataContext.cancelMentorship() erstellt
      setShowCancelModal(false);
      success = true;
    } catch {
      showError(t("mentorship.cancelError"));
    } finally {
      setIsCancelling(false);
    }
    if (success) {
      showSuccess(t("cancel.cancelled"));
      router.back();
    }
  }

  async function handleDeleteSession(sessionId: string) {
    const ok = await showConfirm(t("sessionEdit.delete"), t("sessionEdit.confirmDelete"));
    if (!ok) return;
    try {
      await deleteSession(sessionId);
      showSuccess(t("sessionEdit.deleted"));
    } catch {
      showError(t("common.error"));
    }
  }

  const badgeStatus = mentorship.status === "active" ? "active" as const
    : mentorship.status === "completed" ? "completed" as const
    : mentorship.status === "pending_approval" ? "pending" as const
    : "cancelled" as const;
  const statusLabel =
    mentorship.status === "active"
      ? t("mentorship.active")
      : mentorship.status === "completed"
      ? t("mentorship.completed")
      : mentorship.status === "pending_approval"
      ? t("mentees.pendingApproval")
      : t("mentorship.cancelled");

  // Duration calculation for admin/office
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const mentorshipDuration = (() => {
    const start = new Date(mentorship.assigned_at);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const weeks = Math.floor(days / 7);
    const label = weeks >= 1 ? `${weeks} Wochen` : `${days} Tage`;
    const color = weeks <= 8 ? COLORS.cta : weeks <= 12 ? COLORS.gold : COLORS.error;
    return { weeks, days, label, color };
  })();

  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <Container fullWidth={Platform.OS === "web"}>
    <>
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Status-Badge */}
        <View style={styles.statusRow}>
          <StatusBadge status={badgeStatus} label={statusLabel} />
          <Text style={[styles.dateSince, { color: themeColors.textTertiary }]}>
            {t("mentorship.since").replace("{0}", new Date(mentorship.assigned_at).toLocaleDateString("de-DE"))}
          </Text>
        </View>

        {/* Dauer-Anzeige (nur Admin/Office) */}
        {isAdminOrOffice && (mentorship.status === "active" || mentorship.status === "completed") && (
          <View style={[styles.durationRow, { backgroundColor: mentorshipDuration.color + "18" }]}>
            <Ionicons name="time-outline" size={15} color={mentorshipDuration.color} />
            <Text style={[styles.durationText, { color: mentorshipDuration.color }]}>
              {mentorship.status === "completed"
                ? `Dauer: ${mentorshipDuration.label} (abgeschlossen am ${mentorship.completed_at ? new Date(mentorship.completed_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "?"})`
                : `Dauer: ${mentorshipDuration.label} (seit ${new Date(mentorship.assigned_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })})`
              }
            </Text>
          </View>
        )}

        {/* Abbruch-Info-Box */}
        {mentorship.status === "cancelled" && (
          <View style={[styles.cancelledInfoBox, { backgroundColor: isDark ? "#3a1a1a" : COLORS.errorBg, borderColor: isDark ? "#7a2a2a" : COLORS.errorBorderLight }]}>
            <Text style={[styles.cancelledInfoTitle, { color: isDark ? "#f87171" : COLORS.error }]}>
              Abgebrochen am: {mentorship.cancelled_at
                ? new Date(mentorship.cancelled_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
                : t("common.unknown")}
            </Text>
            {mentorship.cancel_reason ? (
              <Text style={[styles.cancelledInfoReason, { color: isDark ? "#fca5a5" : COLORS.errorDark }]}>
                Grund: {mentorship.cancel_reason}
              </Text>
            ) : null}
          </View>
        )}

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
          <View style={[styles.discrepancyBanner, { backgroundColor: sem(SEMANTIC.amberBg, isDark), borderColor: sem(SEMANTIC.amberBorder, isDark) }]}>
            <Text style={[styles.discrepancyTitle, { color: sem(SEMANTIC.amberText, isDark) }]}>⚠ {t("menteeProgress.discrepancy")}</Text>
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
            const isSessionExpanded = expandedSessions.has(step.id);

            const timelineContent = (
              <>
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
                  <View style={styles.stepNameRow}>
                    <Text
                      style={[
                        styles.stepName,
                        { flex: 1 },
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
                      <Text style={[styles.expandArrow, { color: themeColors.textTertiary }]}>
                        {isSessionExpanded ? "▲" : "▼"}
                      </Text>
                    )}
                  </View>

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
                      {isSessionExpanded && (
                        <View style={[styles.sessionNotesBox, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                          <Text style={[styles.sessionNotesText, { color: session.details ? themeColors.textSecondary : themeColors.textTertiary }]}>
                            {session.details || t("mentorship.noNotes")}
                          </Text>
                        </View>
                      )}
                      {user?.role === "admin" && isSessionExpanded && (
                        <View style={styles.sessionActionRow}>
                          <BNMPressable
                            style={[styles.sessionDeleteButton, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}
                            onPress={() => handleDeleteSession(session.id)}
                            accessibilityRole="button"
                            accessibilityLabel="Sitzung löschen"
                          >
                            <Text style={[styles.sessionDeleteText, { color: isDark ? "#f87171" : "#dc2626" }]}>🗑 {t("sessionEdit.delete")}</Text>
                          </BNMPressable>
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
              </>
            );

            return isDone && session ? (
              <BNMPressable
                key={step.id}
                style={[
                  styles.timelineItem,
                  !isLast ? [styles.timelineItemBorder, { borderBottomColor: themeColors.border }] : {},
                ]}
                onPress={() => {
                  setExpandedSessions((prev) => {
                    const next = new Set(prev);
                    if (next.has(step.id)) next.delete(step.id);
                    else next.add(step.id);
                    return next;
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${step.name} ${isSessionExpanded ? "einklappen" : "aufklappen"}`}
              >
                {timelineContent}
              </BNMPressable>
            ) : (
              <View
                key={step.id}
                style={[
                  styles.timelineItem,
                  !isLast ? [styles.timelineItemBorder, { borderBottomColor: themeColors.border }] : {},
                  isCurrent ? { backgroundColor: isDark ? "#2a2218" : "#fffbeb" } : {},
                ]}
              >
                {timelineContent}
              </View>
            );
          })}
        </View>

        {/* Abschluss-Banner wenn alle Steps erledigt */}
        {mentorship.status === "active" && allRequiredStepsDone && canChangeStatus && (
          <View style={[styles.allDoneBanner, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7", borderColor: sem(SEMANTIC.greenBorder, isDark) }]}>
            <Text style={[styles.allDoneBannerTitle, { color: sem(SEMANTIC.greenText, isDark) }]}>✓ {t("mentorship.allStepsComplete")}</Text>
            <BNMPressable
              style={[styles.allDoneButton, { backgroundColor: isDark ? "#2d6a4a" : "#15803d" }]}
              onPress={handleComplete}
              accessibilityRole="button"
              accessibilityLabel="Betreuung abschliessen"
            >
              <Text style={styles.allDoneButtonText}>
                {t("mentorship.completeNow")}
              </Text>
            </BNMPressable>
            <Text style={[styles.allDoneBannerHint, { color: isDark ? "#4ade80" : "#16a34a" }]}>{t("mentorship.completeHint")}</Text>
          </View>
        )}

        {/* Aktions-Buttons */}
        {mentorship.status === "active" && (
          <View style={{ gap: 12, marginBottom: 16 }}>
            {canDocumentSession && (
              <BNMPressable
                style={[styles.primaryButton, { backgroundColor: COLORS.cta }]}
                onPress={() =>
                  router.push({ pathname: "/document-session", params: { mentorshipId: mentorship.id } })
                }
                accessibilityRole="button"
                accessibilityLabel="Sitzung dokumentieren"
              >
                <Text style={styles.primaryButtonText}>{t("mentorship.documentSession")}</Text>
              </BNMPressable>
            )}

            <BNMPressable
              style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
              onPress={() =>
                navigateToChat(router, mentorship.id)
              }
              accessibilityRole="button"
              accessibilityLabel="Chat oeffnen"
            >
              <Text style={styles.primaryButtonText}>{t("mentorship.openChat")}</Text>
            </BNMPressable>

            {canChangeStatus && (
              <View style={{ flexDirection: "row", gap: 12 }}>
                <BNMPressable
                  style={[
                    styles.completeButton,
                    { backgroundColor: isDark ? "#1a3a2a" : "#f0fdf4", borderColor: isDark ? "#2d6a4a" : "#bbf7d0" },
                    (isUpdatingStatus || (user?.role === "mentor" && !allRequiredStepsDone)) ? { opacity: 0.4 } : {},
                  ]}
                  onPress={handleComplete}
                  disabled={isUpdatingStatus}
                  accessibilityRole="button"
                  accessibilityLabel="Betreuung abschliessen"
                >
                  <Text style={[styles.completeButtonText, { color: sem(SEMANTIC.greenText, isDark) }]}>
                    {isUpdatingStatus ? "..." : t("mentorship.complete")}
                  </Text>
                </BNMPressable>
                <BNMPressable
                  style={[styles.cancelButton, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }, isUpdatingStatus ? { opacity: 0.5 } : {}]}
                  onPress={handleCancel}
                  disabled={isUpdatingStatus}
                  accessibilityRole="button"
                  accessibilityLabel="Betreuung abbrechen"
                >
                  <Text style={[styles.cancelButtonText, { color: isDark ? "#f87171" : "#dc2626" }]}>
                    {isUpdatingStatus ? "..." : t("mentorship.cancel")}
                  </Text>
                </BNMPressable>
              </View>
            )}
          </View>
        )}

        {mentorship.status !== "active" && (
          <View style={{ gap: 12, marginBottom: 16 }}>
            <BNMPressable
              style={[styles.primaryButton, { backgroundColor: COLORS.primary }]}
              onPress={() => navigateToChat(router, mentorship.id)}
              accessibilityRole="button"
              accessibilityLabel="Chat oeffnen"
            >
              <Text style={styles.primaryButtonText}>{t("mentorship.openChat")}</Text>
            </BNMPressable>
            {mentorship.status === "completed" && user && (user.role === "mentor" || user.role === "admin" || user.role === "office") && (
              <BNMPressable
                style={[styles.primaryButton, { backgroundColor: COLORS.cta }]}
                onPress={() => router.push({ pathname: "/document-session", params: { mentorshipId: mentorship.id } })}
                accessibilityRole="button"
                accessibilityLabel="Nachbetreuung dokumentieren"
              >
                <Text style={styles.primaryButtonText}>Nachbetreuung dokumentieren</Text>
              </BNMPressable>
            )}
          </View>
        )}

        {mentorship.completed_at && (
          <Text style={[styles.completedAtText, { color: themeColors.textTertiary }]}>
            {t("mentorship.completedAt")
              .replace("{0}", mentorship.status === "completed" ? t("mentorship.completed") : t("mentorship.cancelled"))
              .replace("{1}", new Date(mentorship.completed_at).toLocaleDateString("de-DE"))}
          </Text>
        )}

        {/* Reaktivieren (Admin/Office oder eigener Mentor, nur bei abgeschlossenen Betreuungen) */}
        {mentorship.status === "completed" && (user?.role === "admin" || user?.role === "office" || user?.id === mentorship.mentor_id) && (
          <BNMPressable
            style={[styles.cancelButton, { backgroundColor: isDark ? "#1a2a3a" : "#eff6ff", borderColor: isDark ? "#1e3a5a" : "#bfdbfe", marginBottom: 12 }, isUpdatingStatus ? { opacity: 0.5 } : {}]}
            onPress={handleReactivate}
            disabled={isUpdatingStatus}
            accessibilityRole="button"
            accessibilityLabel="Betreuung reaktivieren"
          >
            <Text style={[styles.cancelButtonText, { color: isDark ? "#60a5fa" : "#2563eb" }]}>
              {isUpdatingStatus ? "..." : "↩ Abschluss rückgängig machen"}
            </Text>
          </BNMPressable>
        )}

        {/* Mentor-Notizen (nur für Mentor + Admin sichtbar) */}
        {/* Feedback-Fragebogen Vorschau (für Mentoren) */}
        {user?.role === "mentor" && (
          <BNMPressable
            style={[styles.feedbackPreviewButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
            onPress={() => setShowFeedbackPreview(true)}
            accessibilityRole="button"
            accessibilityLabel="Feedback-Fragebogen ansehen"
          >
            <Ionicons name="help-circle-outline" size={18} color={COLORS.gold} />
            <Text style={[styles.feedbackPreviewText, { color: themeColors.text }]}>Feedback-Fragebogen ansehen</Text>
            <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
          </BNMPressable>
        )}

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
            <BNMPressable
              style={[styles.notesSaveButton, isSavingNotes ? { opacity: 0.6 } : {}]}
              onPress={handleSaveNotes}
              disabled={isSavingNotes}
              accessibilityRole="button"
              accessibilityLabel="Notizen speichern"
            >
              <Text style={styles.notesSaveButtonText}>
                {isSavingNotes ? t("notes.saving") : t("notes.save")}
              </Text>
            </BNMPressable>
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
            <BNMPressable
              style={[styles.modalCancelButton, { borderColor: themeColors.border }]}
              onPress={() => { setShowCancelModal(false); setCancelReason(""); }}
              disabled={isCancelling}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>{t("common.back")}</Text>
            </BNMPressable>
            <BNMPressable
              style={[styles.modalConfirmButton, isCancelling ? { opacity: 0.6 } : {}]}
              onPress={handleCancelConfirm}
              disabled={isCancelling}
              accessibilityRole="button"
              accessibilityLabel="Abbruch bestaetigen"
            >
              <Text style={styles.modalConfirmText}>
                {isCancelling ? "..." : t("cancel.title")}
              </Text>
            </BNMPressable>
          </View>
        </View>
      </View>
    </Modal>
    {/* Fragebogen-Vorschau Modal */}
    <Modal
      visible={showFeedbackPreview}
      transparent
      animationType="slide"
      onRequestClose={() => setShowFeedbackPreview(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.card, maxHeight: Dimensions.get("window").height * 0.85 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Feedback-Fragebogen</Text>
            <BNMPressable
              onPress={() => setShowFeedbackPreview(false)}
              accessibilityRole="button"
              accessibilityLabel="Schließen"
            >
              <Ionicons name="close" size={22} color={themeColors.textSecondary} />
            </BNMPressable>
          </View>
          <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary, marginBottom: 12 }]}>
            Diese Fragen werden dem Mentee nach Abschluss der Betreuung gestellt.
          </Text>
          <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.6 }} showsVerticalScrollIndicator={false}>
            {QUESTIONNAIRE_SECTIONS.map((section, sIdx) => (
              <View key={section.id} style={{ marginBottom: 16 }}>
                <Text style={{ fontWeight: "700", fontSize: 14, color: COLORS.gold, marginBottom: 8 }}>
                  {sIdx + 1}. {t(section.titleKey as any)}
                </Text>
                {section.questions
                  .filter((q) => !q.conditionalOn)
                  .map((q, qIdx) => (
                    <View key={q.id} style={{ flexDirection: "row", gap: 8, marginBottom: 6, paddingLeft: 8 }}>
                      <Text style={{ color: themeColors.textTertiary, fontSize: 13, minWidth: 16 }}>{qIdx + 1}.</Text>
                      <Text style={{ color: themeColors.textSecondary, fontSize: 13, flex: 1 }}>
                        {t(q.translationKey as any)}
                        {q.type === "rating" ? " (1–5 Sterne)" : ""}
                      </Text>
                    </View>
                  ))}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
    </>
    </Container>
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
  boldTitle: { fontWeight: "800" },
  page: { padding: 24 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  durationRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.xs, marginBottom: 12 },
  durationText: { fontSize: 12, fontWeight: "600" },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 14, fontWeight: "600" },
  dateSince: { fontSize: 12 },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  cardSectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  cardTitle: { fontWeight: "800" },
  bigName: { fontWeight: "800", fontSize: 20, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 12 },
  phoneText: { fontSize: 14, marginTop: 8 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressPercent: { color: COLORS.gold, fontWeight: "800", fontSize: 18 },
  progressTrack: { height: 12, borderRadius: RADIUS.full, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: RADIUS.full },
  progressSub: { fontSize: 12, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", letterSpacing: 1, marginBottom: 12 },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  timelineItemBorder: { borderBottomWidth: 1 },
  timelineDotCol: { alignItems: "center", marginRight: 12 },
  timelineDot: { width: 32, height: 32, borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center" },
  dotTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  dotTextTertiary: { fontSize: 12, fontWeight: "800" },
  timelineLine: { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 8 },
  stepName: { fontWeight: "600" },
  stepNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  expandArrow: { fontSize: 10, paddingHorizontal: 4 },
  sessionDate: { fontSize: 12, marginTop: 2 },
  sessionDetails: { fontSize: 12, marginTop: 4, fontStyle: "italic" },
  sessionNotesBox: { marginTop: 6, padding: 10, borderRadius: RADIUS.sm, borderWidth: 1 },
  sessionNotesText: { fontSize: 13, lineHeight: 18 },
  currentBadge: { marginTop: 4, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  currentBadgeText: { fontSize: 12, fontWeight: "500" },
  primaryButton: { borderRadius: RADIUS.md, paddingVertical: 9, alignItems: "center" },
  primaryButtonText: { color: COLORS.white, fontWeight: "800" },
  completeButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  completeButtonText: { fontWeight: "600", fontSize: 13 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelButtonText: { fontWeight: "600", fontSize: 14 },
  completedAtText: { fontSize: 12, textAlign: "center" },
  infoChip: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  infoChipText: { fontSize: 12, fontWeight: "500" },
  discrepancyBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  discrepancyTitle: { fontWeight: "800", fontSize: 14, marginBottom: 6 },
  discrepancyItem: { fontSize: 13, marginTop: 2 },
  allDoneBanner: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  allDoneBannerTitle: { fontWeight: "800", fontSize: 16, marginBottom: 12, textAlign: "center" },
  allDoneButton: {
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
  },
  allDoneButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
  allDoneBannerHint: { fontSize: 12, textAlign: "center" },
  notesCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
    ...SHADOWS.md,
  },
  notesTitle: { fontWeight: "800", fontSize: 15, marginBottom: 4 },
  notesHint: { fontSize: 12, marginBottom: 10 },
  notesInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: 10,
    fontSize: 14,
    minHeight: 90,
    textAlignVertical: "top",
    marginBottom: 10,
  },
  notesSaveButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  notesSaveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },

  feedbackPreviewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 16,
  },
  feedbackPreviewText: { flex: 1, fontSize: 14, fontWeight: "500" },

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
    borderRadius: RADIUS.lg,
    padding: 20,
    width: "100%",
    maxWidth: 400,
    ...SHADOWS.md,
  },
  modalTitle: { fontWeight: "800", fontSize: 16, marginBottom: 6 },
  modalSubtitle: { fontSize: 13, marginBottom: 14 },
  modalLabel: { fontSize: 13, fontWeight: "500", marginBottom: 6 },
  modalTextInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "600" },
  modalConfirmButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  modalConfirmText: { color: COLORS.white, fontWeight: "800" },

  // Abbruch-Info-Box
  cancelledInfoBox: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  cancelledInfoTitle: {
    fontWeight: "800",
    fontSize: 14,
    marginBottom: 4,
  },
  cancelledInfoReason: {
    fontSize: 13,
    marginTop: 4,
  },
});
