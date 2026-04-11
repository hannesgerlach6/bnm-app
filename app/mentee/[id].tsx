import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { navigateToChat } from "../../lib/chatNavigation";
import { StatusBadge } from "../../components/StatusBadge";

export default function MenteeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { user: authUser } = useAuth();
  const isAdminOrOffice = authUser?.role === "admin" || authUser?.role === "office";

  const CONTACT_LABELS: Record<string, string> = {
    whatsapp: "WhatsApp",
    phone: t("menteeDetail.phone"),
    telegram: "Telegram",
    email: t("menteeDetail.email"),
  };
  const {
    getUserById,
    mentorships,
    getCompletedStepIds,
    sessionTypes,
  } = useData();

  const mentee = getUserById(id);
  const mentorship = mentorships.find((m) => m.mentee_id === id);
  const mentor = mentorship ? getUserById(mentorship.mentor_id) : undefined;
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sortedSteps = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);
  const progress = sessionTypes.length > 0
    ? Math.round((completedStepIds.length / sessionTypes.length) * 100)
    : 0;

  if (!mentee) {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.root, { backgroundColor: themeColors.background }]}>
          <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
            <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="link" accessibilityLabel="Zurueck">
              <Text style={[styles.backText, { color: themeColors.text }]}>{t("menteeDetail.back")}</Text>
            </BNMPressable>
            <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("menteeDetail.headerTitle")}</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("menteeDetail.notFound")}</Text>
          </View>
        </View>
      </Container>
    );
  }

  const initials = mentee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const statusLabel = mentorship
    ? mentorship.status === "active"
      ? t("menteeDetail.active")
      : mentorship.status === "completed"
      ? t("menteeDetail.completed")
      : mentorship.status === "pending_approval"
      ? t("mentees.pendingApproval")
      : t("menteeDetail.cancelled")
    : t("menteeDetail.noMentor");

  const badgeStatus = mentorship
    ? mentorship.status === "active" ? "active" as const
      : mentorship.status === "completed" ? "completed" as const
      : mentorship.status === "pending_approval" ? "pending" as const
      : "cancelled" as const
    : "pending" as const;

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("menteeDetail.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("menteeDetail.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Profil-Card */}
          <View style={[styles.profileCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={[styles.profileName, { color: themeColors.text }]}>{mentee.name}</Text>
            <Text style={[styles.profileSub, { color: themeColors.textSecondary }]}>
              {mentee.city} · {mentee.age} {t("common.yearsOld")} ·{" "}
              {mentee.gender === "male" ? t("menteeDetail.brother") : t("menteeDetail.sister")}
            </Text>
            <StatusBadge status={badgeStatus} label={statusLabel} />
          </View>

          {/* Kontaktinformationen */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("menteeDetail.contactInfo")}</Text>
          <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <InfoRow label={t("menteeDetail.email")} value={mentee.email} />
            {mentee.phone && <InfoRow label={t("menteeDetail.phone")} value={mentee.phone} />}
            <InfoRow
              label={t("menteeDetail.contactPref")}
              value={CONTACT_LABELS[mentee.contact_preference] ?? mentee.contact_preference}
              isLast
            />
          </View>

          {/* Zugewiesener Mentor */}
          {mentor && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("menteeDetail.assignedMentor")}</Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.mentorRow}>
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorAvatarText}>
                      {mentor.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.mentorInfo}>
                    <Text style={[styles.mentorName, { color: themeColors.text }]}>{mentor.name}</Text>
                    <Text style={[styles.mentorSub, { color: themeColors.textTertiary }]}>
                      {mentor.city} · {mentor.gender === "male" ? t("menteeDetail.brother") : t("menteeDetail.sister")}
                    </Text>
                  </View>
                  <BNMPressable
                    style={[styles.mentorDetailButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: mentor.id } })}
                    accessibilityRole="link"
                    accessibilityLabel="Mentor-Profil anzeigen"
                  >
                    <Text style={[styles.mentorDetailText, { color: themeColors.text }]}>{t("menteeDetail.mentorProfile")}</Text>
                  </BNMPressable>
                </View>
              </View>
            </>
          )}

          {/* Mentoring-Fortschritt */}
          {mentorship && (
            <>
              <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("menteeDetail.mentoringProgress")}</Text>
              <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.progressHeaderRow}>
                  <Text style={[styles.progressLabel, { color: themeColors.text }]}>{t("menteeDetail.progress")}</Text>
                  <Text style={styles.progressValue}>{progress}%</Text>
                </View>
                <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
                  <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
                </View>
                <Text style={[styles.progressSub, { color: themeColors.textTertiary }]}>
                  {t("menteeDetail.stepsCompleted")
                    .replace("{0}", String(completedStepIds.length))
                    .replace("{1}", String(sessionTypes.length))}
                </Text>

                <View style={[styles.stepsList, { borderTopColor: themeColors.border }]}>
                  {sortedSteps.map((step, idx) => {
                    const isDone = completedStepIds.includes(step.id);
                    const isCurrent = !isDone && idx === completedStepIds.length;
                    return (
                      <View
                        key={step.id}
                        style={[
                          styles.stepRow,
                          idx < sortedSteps.length - 1 && [styles.stepRowBorder, { borderBottomColor: themeColors.border }],
                        ]}
                      >
                        <View
                          style={[
                            styles.stepIndicator,
                            isDone
                              ? { backgroundColor: COLORS.cta }
                              : isCurrent
                              ? { backgroundColor: COLORS.gold }
                              : { backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.stepIndicatorText,
                              isDone || isCurrent
                                ? { color: COLORS.white }
                                : { color: COLORS.tertiary },
                            ]}
                          >
                            {isDone ? "✓" : String(idx + 1)}
                          </Text>
                        </View>
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
                        {isCurrent && (
                          <View style={[styles.currentChip, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
                            <Text style={[styles.currentChipText, { color: isDark ? "#fbbf24" : "#b45309" }]}>{t("menteeDetail.current")}</Text>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              </View>
            </>
          )}

          {/* Aktionen */}
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("menteeDetail.actions")}</Text>
          <View style={styles.actionsCard}>
            {isAdminOrOffice && (
              <BNMPressable
                style={[styles.actionButton, { backgroundColor: COLORS.gradientStart }]}
                onPress={() =>
                  router.push({ pathname: "/admin/edit-user", params: { id: mentee.id, from: "mentees" } })
                }
                accessibilityRole="link"
                accessibilityLabel="Profil bearbeiten"
              >
                <Text style={styles.actionButtonText}>{t("editUser.editProfile")}</Text>
              </BNMPressable>
            )}
            {!mentorship && (
              <BNMPressable
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={() =>
                  router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                }
                accessibilityRole="button"
                accessibilityLabel="Mentor zuweisen"
              >
                <Text style={styles.actionButtonText}>{t("menteeDetail.assignMentor")}</Text>
              </BNMPressable>
            )}
            {mentorship && mentorship.status === "active" && (
              <BNMPressable
                style={[styles.actionButton, { backgroundColor: COLORS.cta }]}
                onPress={() =>
                  navigateToChat(router, mentorship.id)
                }
                accessibilityRole="button"
                accessibilityLabel="Nachricht senden"
              >
                <Text style={styles.actionButtonText}>{t("menteeDetail.sendMessage")}</Text>
              </BNMPressable>
            )}
            {mentorship && (
              <BNMPressable
                style={[styles.actionButton, { backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border }]}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
                }
                accessibilityRole="link"
                accessibilityLabel="Betreuung anzeigen"
              >
                <Text style={[styles.actionButtonText, { color: themeColors.text }]}>
                  {t("menteeDetail.viewMentorship")}
                </Text>
              </BNMPressable>
            )}
          </View>

        </ScrollView>
      </View>
    </Container>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const themeColors = useThemeColors();
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: themeColors.border },
      ]}
    >
      <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "800", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { fontSize: 16 },
  profileCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 20,
    ...SHADOWS.md,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: COLORS.white, fontSize: 22, fontWeight: "800" },
  profileName: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  profileSub: { fontSize: 14, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 13, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
    ...SHADOWS.md,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  infoLabel: { fontSize: 14 },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    maxWidth: "55%",
    textAlign: "right",
  },
  mentorRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    gap: 12,
  },
  mentorAvatar: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.xl,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mentorAvatarText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  mentorInfo: { flex: 1 },
  mentorName: { fontWeight: "800", fontSize: 15 },
  mentorSub: { fontSize: 12, marginTop: 2 },
  mentorDetailButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mentorDetailText: { fontSize: 12, fontWeight: "600" },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  progressLabel: { fontWeight: "600" },
  progressValue: { fontWeight: "800", color: COLORS.cta, fontSize: 16 },
  progressTrack: {
    height: 8,
    borderRadius: RADIUS.full,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 6,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: RADIUS.full },
  progressSub: {
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  stepsList: {
    borderTopWidth: 1,
  },
  stepRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  stepRowBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepIndicator: {
    width: 28,
    height: 28,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIndicatorText: { fontWeight: "800", fontSize: 12 },
  stepName: { flex: 1, fontSize: 13, fontWeight: "500" },
  currentChip: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  currentChipText: { fontSize: 11, fontWeight: "600" },
  actionsCard: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 15 },
});
