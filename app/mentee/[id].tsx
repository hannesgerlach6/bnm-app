import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { useAuth } from "../../contexts/AuthContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function MenteeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
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
      <Container>
        <View style={[styles.root, { backgroundColor: themeColors.background }]}>
          <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: themeColors.text }]}>{t("menteeDetail.back")}</Text>
            </TouchableOpacity>
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
      : t("menteeDetail.cancelled")
    : t("menteeDetail.noMentor");

  const statusBg = mentorship
    ? mentorship.status === "active"
      ? "#F5F5F7"
      : mentorship.status === "completed"
      ? "#dcfce7"
      : "#fee2e2"
    : "#fef3c7";

  const statusColor = mentorship
    ? mentorship.status === "active"
      ? "#475467"
      : mentorship.status === "completed"
      ? "#15803d"
      : "#b91c1c"
    : "#b45309";

  return (
    <Container>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("menteeDetail.back")}</Text>
          </TouchableOpacity>
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
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
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
                  <TouchableOpacity
                    style={[styles.mentorDetailButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: mentor.id } })}
                  >
                    <Text style={[styles.mentorDetailText, { color: themeColors.text }]}>{t("menteeDetail.mentorProfile")}</Text>
                  </TouchableOpacity>
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
                          <View style={styles.currentChip}>
                            <Text style={styles.currentChipText}>{t("menteeDetail.current")}</Text>
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
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.gradientStart }]}
                onPress={() =>
                  router.push({ pathname: "/admin/edit-user", params: { id: mentee.id } })
                }
              >
                <Text style={styles.actionButtonText}>{t("editUser.editProfile")}</Text>
              </TouchableOpacity>
            )}
            {!mentorship && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={() =>
                  router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                }
              >
                <Text style={styles.actionButtonText}>{t("menteeDetail.assignMentor")}</Text>
              </TouchableOpacity>
            )}
            {mentorship && mentorship.status === "active" && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.cta }]}
                onPress={() =>
                  router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
                }
              >
                <Text style={styles.actionButtonText}>{t("menteeDetail.sendMessage")}</Text>
              </TouchableOpacity>
            )}
            {mentorship && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border }]}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
                }
              >
                <Text style={[styles.actionButtonText, { color: themeColors.text }]}>
                  {t("menteeDetail.viewMentorship")}
                </Text>
              </TouchableOpacity>
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
    paddingTop: 56,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { fontSize: 16 },
  profileCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    alignItems: "center",
    marginBottom: 20,
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
  avatarText: { color: COLORS.white, fontSize: 22, fontWeight: "bold" },
  profileName: { fontSize: 20, fontWeight: "bold", marginBottom: 4 },
  profileSub: { fontSize: 14, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 13, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
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
    padding: 14,
    gap: 12,
  },
  mentorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  mentorAvatarText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
  mentorInfo: { flex: 1 },
  mentorName: { fontWeight: "700", fontSize: 15 },
  mentorSub: { fontSize: 12, marginTop: 2 },
  mentorDetailButton: {
    borderWidth: 1,
    borderRadius: 8,
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
  progressValue: { fontWeight: "bold", color: COLORS.cta, fontSize: 16 },
  progressTrack: {
    height: 8,
    borderRadius: 9999,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 6,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
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
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIndicatorText: { fontWeight: "bold", fontSize: 12 },
  stepName: { flex: 1, fontSize: 13, fontWeight: "500" },
  currentChip: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  currentChipText: { color: "#b45309", fontSize: 11, fontWeight: "600" },
  actionsCard: {
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
});
