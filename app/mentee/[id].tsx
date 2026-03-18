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
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";

const CONTACT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone: "Telefon",
  telegram: "Telegram",
  email: "E-Mail",
};

export default function MenteeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
        <View style={styles.root}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹ Zurück</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Mentee-Detail</Text>
            <View style={styles.headerRight} />
          </View>
          <View style={styles.emptyBox}>
            <Text style={styles.emptyText}>Mentee nicht gefunden.</Text>
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
      ? "Aktiv"
      : mentorship.status === "completed"
      ? "Abgeschlossen"
      : "Abgebrochen"
    : "Kein Mentor zugewiesen";

  const statusBg = mentorship
    ? mentorship.status === "active"
      ? "#dcfce7"
      : mentorship.status === "completed"
      ? "#dbeafe"
      : "#fee2e2"
    : "#fef3c7";

  const statusColor = mentorship
    ? mentorship.status === "active"
      ? "#15803d"
      : mentorship.status === "completed"
      ? "#1d4ed8"
      : "#b91c1c"
    : "#b45309";

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Mentee-Profil</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Profil-Card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
            <Text style={styles.profileName}>{mentee.name}</Text>
            <Text style={styles.profileSub}>
              {mentee.city} · {mentee.age} Jahre ·{" "}
              {mentee.gender === "male" ? "Bruder" : "Schwester"}
            </Text>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusLabel}
              </Text>
            </View>
          </View>

          {/* Kontaktinformationen */}
          <Text style={styles.sectionLabel}>KONTAKTINFORMATIONEN</Text>
          <View style={styles.card}>
            <InfoRow label="E-Mail" value={mentee.email} />
            {mentee.phone && <InfoRow label="Telefon" value={mentee.phone} />}
            <InfoRow
              label="Kontaktpräferenz"
              value={CONTACT_LABELS[mentee.contact_preference] ?? mentee.contact_preference}
              isLast
            />
          </View>

          {/* Zugewiesener Mentor */}
          {mentor && (
            <>
              <Text style={styles.sectionLabel}>ZUGEWIESENER MENTOR</Text>
              <View style={styles.card}>
                <View style={styles.mentorRow}>
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorAvatarText}>
                      {mentor.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </Text>
                  </View>
                  <View style={styles.mentorInfo}>
                    <Text style={styles.mentorName}>{mentor.name}</Text>
                    <Text style={styles.mentorSub}>
                      {mentor.city} · {mentor.gender === "male" ? "Bruder" : "Schwester"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.mentorDetailButton}
                    onPress={() => router.push({ pathname: "/mentor/[id]", params: { id: mentor.id } })}
                  >
                    <Text style={styles.mentorDetailText}>Profil</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}

          {/* Mentoring-Fortschritt */}
          {mentorship && (
            <>
              <Text style={styles.sectionLabel}>MENTORING-FORTSCHRITT</Text>
              <View style={styles.card}>
                <View style={styles.progressHeaderRow}>
                  <Text style={styles.progressLabel}>Fortschritt</Text>
                  <Text style={styles.progressValue}>{progress}%</Text>
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: progress + "%" }]} />
                </View>
                <Text style={styles.progressSub}>
                  {completedStepIds.length} von {sessionTypes.length} Schritten abgeschlossen
                </Text>

                <View style={styles.stepsList}>
                  {sortedSteps.map((step, idx) => {
                    const isDone = completedStepIds.includes(step.id);
                    const isCurrent = !isDone && idx === completedStepIds.length;
                    return (
                      <View
                        key={step.id}
                        style={[
                          styles.stepRow,
                          idx < sortedSteps.length - 1 && styles.stepRowBorder,
                        ]}
                      >
                        <View
                          style={[
                            styles.stepIndicator,
                            isDone
                              ? { backgroundColor: COLORS.cta }
                              : isCurrent
                              ? { backgroundColor: COLORS.gold }
                              : { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
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
                              ? { color: COLORS.primary }
                              : { color: COLORS.tertiary },
                          ]}
                        >
                          {step.name}
                        </Text>
                        {isCurrent && (
                          <View style={styles.currentChip}>
                            <Text style={styles.currentChipText}>Aktuell</Text>
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
          <Text style={styles.sectionLabel}>AKTIONEN</Text>
          <View style={styles.actionsCard}>
            {!mentorship && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
                onPress={() =>
                  router.push({ pathname: "/assign", params: { menteeId: mentee.id } })
                }
              >
                <Text style={styles.actionButtonText}>Mentor zuweisen</Text>
              </TouchableOpacity>
            )}
            {mentorship && mentorship.status === "active" && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.cta }]}
                onPress={() =>
                  router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } })
                }
              >
                <Text style={styles.actionButtonText}>Nachricht senden</Text>
              </TouchableOpacity>
            )}
            {mentorship && (
              <TouchableOpacity
                style={[styles.actionButton, { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border }]}
                onPress={() =>
                  router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
                }
              >
                <Text style={[styles.actionButtonText, { color: COLORS.primary }]}>
                  Betreuung ansehen
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
  return (
    <View
      style={[
        styles.infoRow,
        !isLast && { borderBottomWidth: 1, borderBottomColor: COLORS.border },
      ]}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { flex: 1 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  emptyBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  emptyText: { color: COLORS.tertiary, fontSize: 16 },
  profileCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  profileName: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  profileSub: { color: COLORS.secondary, fontSize: 14, marginBottom: 10 },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 13, fontWeight: "600" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
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
  infoLabel: { color: COLORS.secondary, fontSize: 14 },
  infoValue: {
    color: COLORS.primary,
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
  mentorName: { fontWeight: "700", color: COLORS.primary, fontSize: 15 },
  mentorSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  mentorDetailButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  mentorDetailText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  progressLabel: { fontWeight: "600", color: COLORS.primary },
  progressValue: { fontWeight: "bold", color: COLORS.cta, fontSize: 16 },
  progressTrack: {
    height: 8,
    backgroundColor: COLORS.bg,
    borderRadius: 9999,
    overflow: "hidden",
    marginHorizontal: 16,
    marginBottom: 6,
  },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 9999 },
  progressSub: {
    color: COLORS.tertiary,
    fontSize: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  stepsList: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
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
