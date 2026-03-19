import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { showConfirm, showError } from "../../lib/errorHandler";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";

export default function MentorshipDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const {
    getMentorshipById,
    getSessionsByMentorshipId,
    getCompletedStepIds,
    sessionTypes,
    updateMentorshipStatus,
  } = useData();

  const { id } = useLocalSearchParams<{ id: string }>();

  const mentorship = id ? getMentorshipById(id) : undefined;
  const sessions = id ? getSessionsByMentorshipId(id) : [];
  const completedStepIds = id ? getCompletedStepIds(id) : [];

  if (!mentorship) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.boldTitle}>{t("mentorship.notFound")}</Text>
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
    const ok = await showConfirm(t("mentorship.completeTitle"), t("mentorship.completeText"));
    if (!ok) return;
    setIsUpdatingStatus(true);
    try {
      await updateMentorshipStatus(mentorshipId, "completed");
      router.push({ pathname: "/feedback", params: { mentorshipId: mentorshipId } });
    } catch {
      showError("Fehler beim Abschließen der Betreuung.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  async function handleCancel() {
    const ok = await showConfirm(t("mentorship.cancelTitle"), t("mentorship.cancelText"));
    if (!ok) return;
    setIsUpdatingStatus(true);
    try {
      await updateMentorshipStatus(mentorshipId, "cancelled");
      router.push({ pathname: "/feedback", params: { mentorshipId: mentorshipId } });
    } catch {
      showError("Fehler beim Abbrechen der Betreuung.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }

  const statusBg =
    mentorship.status === "active"
      ? "#dcfce7"
      : mentorship.status === "completed"
      ? "#dbeafe"
      : "#fee2e2";
  const statusTextColor =
    mentorship.status === "active"
      ? "#15803d"
      : mentorship.status === "completed"
      ? "#1d4ed8"
      : "#b91c1c";
  const statusLabel =
    mentorship.status === "active"
      ? t("mentorship.active")
      : mentorship.status === "completed"
      ? t("mentorship.completed")
      : t("mentorship.cancelled");

  const sortedSessionTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Status-Badge */}
        <View style={styles.statusRow}>
          <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
            <Text style={[styles.statusText, { color: statusTextColor }]}>{statusLabel}</Text>
          </View>
          <Text style={styles.dateSince}>
            {t("mentorship.since").replace("{0}", new Date(mentorship.assigned_at).toLocaleDateString("de-DE"))}
          </Text>
        </View>

        {/* Mentee-Info */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>{t("mentorship.mentee")}</Text>
          <Text style={styles.bigName}>{mentorship.mentee?.name}</Text>
          <View style={styles.chipRow}>
            <InfoChip label={mentorship.mentee?.city ?? ""} />
            <InfoChip label={`${mentorship.mentee?.age} J.`} />
            <InfoChip label={mentorship.mentee?.gender === "male" ? t("mentorship.brother") : t("mentorship.sister")} />
          </View>
          {mentorship.mentee?.phone && (
            <Text style={styles.phoneText}>{mentorship.mentee.phone}</Text>
          )}
        </View>

        {/* Mentor-Info */}
        <View style={styles.card}>
          <Text style={styles.cardSectionLabel}>{t("mentorship.mentor")}</Text>
          <Text style={[styles.bigName, { fontSize: 18 }]}>{mentorship.mentor?.name}</Text>
          <View style={styles.chipRow}>
            <InfoChip label={mentorship.mentor?.city ?? ""} />
            <InfoChip label={`${mentorship.mentor?.age} J.`} />
          </View>
        </View>

        {/* Fortschrittsbalken */}
        <View style={styles.card}>
          <View style={styles.progressHeader}>
            <Text style={styles.cardTitle}>{t("mentorship.progress")}</Text>
            <Text style={styles.progressPercent}>{progress}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
          </View>
          <Text style={styles.progressSub}>
            {t("mentorship.stepsCompleted")
              .replace("{0}", String(completedStepIds.length))
              .replace("{1}", String(sessionTypes.length))}
          </Text>
        </View>

        {/* Session-Timeline */}
        <Text style={styles.sectionLabel}>{t("mentorship.sessionHistory")}</Text>
        <View style={[styles.card, { padding: 0, overflow: "hidden" }]}>
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
                  !isLast ? styles.timelineItemBorder : {},
                  isCurrent ? { backgroundColor: "#fffbeb" } : {},
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
                        : { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
                    ]}
                  >
                    {isDone ? (
                      <Text style={styles.dotTextWhite}>✓</Text>
                    ) : (
                      <Text
                        style={
                          isCurrent ? styles.dotTextWhite : styles.dotTextTertiary
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
                        { backgroundColor: isDone ? COLORS.cta : COLORS.border },
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
                        ? { color: COLORS.primary }
                        : { color: COLORS.tertiary },
                    ]}
                  >
                    {step.name}
                  </Text>

                  {isDone && session && (
                    <>
                      <Text style={styles.sessionDate}>
                        {new Date(session.date).toLocaleDateString("de-DE")} ·{" "}
                        {session.is_online ? t("mentorship.online") : t("mentorship.inPerson")}
                      </Text>
                      {session.details && (
                        <Text style={styles.sessionDetails}>"{session.details}"</Text>
                      )}
                    </>
                  )}

                  {isCurrent && (
                    <View style={styles.currentBadge}>
                      <Text style={styles.currentBadgeText}>{t("mentorship.nextStep")}</Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>

        {/* Abschluss-Banner wenn alle Steps erledigt */}
        {mentorship.status === "active" && completedStepIds.length === sessionTypes.length && canChangeStatus && (
          <View style={styles.allDoneBanner}>
            <Text style={styles.allDoneBannerTitle}>✓ {t("mentorship.allStepsComplete")}</Text>
            <TouchableOpacity
              style={styles.allDoneButton}
              onPress={handleComplete}
            >
              <Text style={styles.allDoneButtonText}>
                {t("mentorship.completeNow")}
              </Text>
            </TouchableOpacity>
            <Text style={styles.allDoneBannerHint}>{t("mentorship.completeHint")}</Text>
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
                  style={[styles.completeButton, isUpdatingStatus ? { opacity: 0.5 } : {}]}
                  onPress={handleComplete}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.completeButtonText}>
                    {isUpdatingStatus ? "..." : t("mentorship.complete")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelButton, isUpdatingStatus ? { opacity: 0.5 } : {}]}
                  onPress={handleCancel}
                  disabled={isUpdatingStatus}
                >
                  <Text style={styles.cancelButtonText}>
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
          <Text style={styles.completedAtText}>
            {t("mentorship.completedAt")
              .replace("{0}", mentorship.status === "completed" ? t("mentorship.completed") : t("mentorship.cancelled"))
              .replace("{1}", new Date(mentorship.completed_at).toLocaleDateString("de-DE"))}
          </Text>
        )}
      </View>
    </ScrollView>
  );
}

function InfoChip({ label }: { label: string }) {
  return (
    <View style={styles.infoChip}>
      <Text style={styles.infoChipText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  centerContainer: { flex: 1, backgroundColor: COLORS.bg, alignItems: "center", justifyContent: "center", padding: 24 },
  boldTitle: { color: COLORS.primary, fontWeight: "bold" },
  page: { padding: 24 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 14, fontWeight: "600" },
  dateSince: { color: COLORS.tertiary, fontSize: 12 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  cardSectionLabel: { fontSize: 12, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 12 },
  cardTitle: { fontWeight: "bold", color: COLORS.primary },
  bigName: { fontWeight: "bold", color: COLORS.primary, fontSize: 20, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 12 },
  phoneText: { color: COLORS.secondary, fontSize: 14, marginTop: 8 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  progressPercent: { color: COLORS.gold, fontWeight: "bold", fontSize: 18 },
  progressTrack: { height: 12, backgroundColor: COLORS.bg, borderRadius: 9999, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 4 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: COLORS.tertiary, letterSpacing: 1, marginBottom: 12 },
  timelineItem: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  timelineItemBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  timelineDotCol: { alignItems: "center", marginRight: 12 },
  timelineDot: { width: 32, height: 32, borderRadius: 9999, alignItems: "center", justifyContent: "center" },
  dotTextWhite: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  dotTextTertiary: { color: COLORS.tertiary, fontSize: 12, fontWeight: "bold" },
  timelineLine: { width: 2, flex: 1, minHeight: 16, marginTop: 4 },
  timelineContent: { flex: 1, paddingBottom: 8 },
  stepName: { fontWeight: "600" },
  sessionDate: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  sessionDetails: { color: COLORS.secondary, fontSize: 12, marginTop: 4, fontStyle: "italic" },
  currentBadge: { marginTop: 4, backgroundColor: "#fef3c7", alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  currentBadgeText: { color: "#b45309", fontSize: 12, fontWeight: "500" },
  primaryButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center" },
  primaryButtonText: { color: COLORS.white, fontWeight: "bold" },
  completeButton: {
    flex: 1,
    backgroundColor: "#f0fdf4",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  completeButtonText: { color: "#15803d", fontWeight: "600", fontSize: 13 },
  cancelButton: {
    flex: 1,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingVertical: 8,
    alignItems: "center",
  },
  cancelButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 14 },
  completedAtText: { color: COLORS.tertiary, fontSize: 12, textAlign: "center" },
  infoChip: { backgroundColor: COLORS.bg, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  infoChipText: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },
  allDoneBanner: {
    backgroundColor: "#dcfce7",
    borderWidth: 1,
    borderColor: "#86efac",
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  allDoneBannerTitle: { color: "#15803d", fontWeight: "700", fontSize: 16, marginBottom: 12, textAlign: "center" },
  allDoneButton: {
    backgroundColor: "#15803d",
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 24,
    alignItems: "center",
    marginBottom: 10,
    width: "100%",
  },
  allDoneButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 15 },
  allDoneBannerHint: { color: "#16a34a", fontSize: 12, textAlign: "center" },
});
