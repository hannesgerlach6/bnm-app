import React, { useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMLogo } from "../../components/BNMLogo";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  mentor: "Mentor",
  mentee: "Mentee (Neuer Muslim)",
};

const CONTACT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone: "Telefon",
  telegram: "Telegram",
  email: "E-Mail",
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { getMentorshipsByMentorId, sessions, users } = useData();

  const mentorStats = useMemo(() => {
    if (!user || user.role !== "mentor") return null;

    const myMentorships = getMentorshipsByMentorId(user.id);
    const activeMentorships = myMentorships.filter((m) => m.status === "active");
    const completedMentorships = myMentorships.filter((m) => m.status === "completed");
    const totalSessions = sessions.filter((s) =>
      myMentorships.some((m) => m.id === s.mentorship_id)
    ).length;

    // Ranking berechnen
    const allMentors = users.filter((u) => u.role === "mentor");
    const scores = allMentors.map((mentor) => {
      const ms = getMentorshipsByMentorId(mentor.id);
      const completed = ms.filter((m) => m.status === "completed").length;
      const sessionsCnt = sessions.filter((s) =>
        ms.some((m) => m.id === s.mentorship_id)
      ).length;
      return { mentorId: mentor.id, score: completed * 10 + sessionsCnt * 3 };
    });
    scores.sort((a, b) => b.score - a.score);
    const myRank = scores.findIndex((s) => s.mentorId === user.id) + 1;

    return {
      active: activeMentorships.length,
      completed: completedMentorships.length,
      totalSessions,
      rank: myRank,
      totalMentors: allMentors.length,
    };
  }, [user, getMentorshipsByMentorId, sessions, users]);

  if (!user) return null;

  function handleLogout() {
    Alert.alert("Abmelden", "Möchtest du dich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Abmelden", style: "destructive", onPress: logout },
    ]);
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleBgColor =
    user.role === "admin"
      ? "#f3e8ff"
      : user.role === "mentor"
      ? "#dbeafe"
      : "#dcfce7";

  const roleTextColor =
    user.role === "admin"
      ? "#7e22ce"
      : user.role === "mentor"
      ? "#1d4ed8"
      : "#15803d";

  return (
    <Container>
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Hero-Header mit dunklem Blau */}
        <View style={styles.heroHeader}>
          {/* BNM Logo oben rechts */}
          <View style={styles.heroLogoPosition}>
            <BNMLogo size={40} showSubtitle={false} />
          </View>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>

          {/* Rollen-Badge */}
          <View style={[styles.roleBadge, { backgroundColor: roleBgColor }]}>
            <Text style={[styles.roleBadgeText, { color: roleTextColor }]}>
              {ROLE_LABELS[user.role]}
            </Text>
          </View>

          {/* Geschlecht-Badge */}
          <View style={styles.genderBadge}>
            <Text style={styles.genderText}>
              {user.gender === "male" ? "Bruder" : "Schwester"}
            </Text>
          </View>
        </View>

        {/* Persönliche Infos */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>{"PERSÖNLICHE INFORMATIONEN"}</Text>

          <InfoRow label="E-Mail" value={user.email} />
          <InfoRow label="Stadt" value={user.city} />
          <InfoRow label="Alter" value={`${user.age} Jahre`} />
          {user.phone && <InfoRow label="Telefon" value={user.phone} />}
          <InfoRow
            label="Kontakt"
            value={CONTACT_LABELS[user.contact_preference] ?? user.contact_preference}
            isLast
          />
        </View>

        {/* Mentor-Statistiken */}
        {user.role === "mentor" && mentorStats && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionLabel}>{"MEINE STATISTIKEN"}</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{mentorStats.active}</Text>
                <Text style={styles.statLabel}>Aktive Betreuungen</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.cta }]}>{mentorStats.completed}</Text>
                <Text style={styles.statLabel}>Abgeschlossen</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.gradientStart }]}>{mentorStats.totalSessions}</Text>
                <Text style={styles.statLabel}>Sessions gesamt</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: COLORS.gold }]}>
                  #{mentorStats.rank}
                </Text>
                <Text style={styles.statLabel}>Ranking</Text>
              </View>
            </View>
            <Text style={styles.rankHint}>
              von {mentorStats.totalMentors} Mentoren · Score = Abschlüsse × 10 + Sessions × 3
            </Text>
          </View>
        )}

        {/* Konto-Aktionen */}
        <View style={[styles.infoCard, { padding: 0, overflow: "hidden" }]}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }]}>
            {"KONTO"}
          </Text>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/edit-profile")}
          >
            <Text style={styles.menuItemText}>Profil bearbeiten</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => router.push("/change-password")}
          >
            <Text style={styles.menuItemText}>Passwort ändern</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => router.push("/settings")}
          >
            <Text style={styles.menuItemText}>Einstellungen</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>

        {/* App-Info */}
        <Text style={styles.appInfo}>BNM App · Betreuung neuer Muslime</Text>
      </View>
    </ScrollView>
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
        isLast ? {} : { borderBottomWidth: 1, borderBottomColor: COLORS.border },
      ]}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  heroHeader: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
    position: "relative",
  },
  heroLogoPosition: {
    position: "absolute",
    top: 12,
    right: 12,
    opacity: 0.85,
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.gold,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarText: { color: COLORS.white, fontSize: 22, fontWeight: "700" },
  userName: { fontSize: 18, fontWeight: "700", color: COLORS.white, marginBottom: 6 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4 },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  genderBadge: { marginTop: 8 },
  genderText: { color: COLORS.white, opacity: 0.75, fontSize: 13 },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  infoLabel: { color: COLORS.secondary, fontSize: 13 },
  infoValue: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { color: COLORS.primary, fontSize: 14 },
  menuArrow: { color: COLORS.tertiary, fontSize: 18 },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 8,
  },
  statItem: {
    flex: 1,
    minWidth: "40%",
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    borderLeftWidth: 3,
    borderLeftColor: COLORS.gold,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: COLORS.primary },
  statLabel: { color: COLORS.tertiary, fontSize: 11, marginTop: 2, textAlign: "center" },
  rankHint: { color: COLORS.tertiary, fontSize: 11, textAlign: "center", marginTop: 4 },
  logoutButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 12,
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
  appInfo: { color: COLORS.tertiary, fontSize: 12, textAlign: "center" },
});
