import React, { useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import type { ThemeMode } from "../../contexts/ThemeContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMLogo } from "../../components/BNMLogo";

// Contact labels are now resolved via t() inside the component

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { getMentorshipsByMentorId, getMentorshipByMenteeId, sessions, users, mentorships, refreshData } = useData();
  const { t } = useLanguage();
  const { mode, setMode, isDark } = useTheme();
  const themeColors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showImprint, setShowImprint] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  const ROLE_LABELS: Record<UserRole, string> = {
    admin: t("profile.roleAdmin"),
    office: t("profile.roleOffice"),
    mentor: t("profile.roleMentor"),
    mentee: t("profile.roleMentee"),
  };

  const CONTACT_LABELS: Record<string, string> = {
    whatsapp: t("contactPref.whatsapp"),
    phone: t("contactPref.phone"),
    telegram: t("contactPref.telegram"),
    email: t("contactPref.email"),
  };

  // Kontaktinfo des Mentorship-Partners
  const partnerContact = useMemo(() => {
    if (!user) return null;
    if (user.role === "mentor") {
      // Aktive Mentees des Mentors
      const myMentorships = getMentorshipsByMentorId(user.id).filter((m) => m.status === "active");
      if (myMentorships.length === 0) return null;
      const mentee = myMentorships[0].mentee;
      return mentee ? { person: mentee, label: t("profile.myMentee"), mentorshipId: myMentorships[0].id } : null;
    }
    if (user.role === "mentee") {
      const mentorship = getMentorshipByMenteeId(user.id);
      if (!mentorship || !mentorship.mentor) return null;
      return { person: mentorship.mentor, label: t("profile.myMentorSection"), mentorshipId: mentorship.id };
    }
    return null;
  }, [user, getMentorshipsByMentorId, getMentorshipByMenteeId, mentorships, t]);

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

  async function handleLogout() {
    let ok = false;
    if (Platform.OS === "web") {
      ok = window.confirm(t("profile.logoutConfirm"));
    } else {
      ok = await new Promise<boolean>((resolve) => {
        Alert.alert(t("profile.logoutTitle"), t("profile.logoutConfirm"), [
          { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
          { text: t("common.confirm"), onPress: () => resolve(true) },
        ]);
      });
    }
    if (ok) logout();
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleBgColor =
    user.role === "admin"
      ? (isDark ? "#2e1a4a" : "#f3e8ff")
      : user.role === "mentor"
      ? (isDark ? "#1e2d4a" : "#dbeafe")
      : (isDark ? "#1a3a2a" : "#dcfce7");

  const roleTextColor =
    user.role === "admin"
      ? (isDark ? "#c084fc" : "#7e22ce")
      : user.role === "mentor"
      ? (isDark ? "#93c5fd" : "#1d4ed8")
      : (isDark ? "#4ade80" : "#15803d");

  const THEME_OPTIONS: { value: ThemeMode; labelKey: "theme.light" | "theme.dark" | "theme.system"; icon: string }[] = [
    { value: "light", labelKey: "theme.light", icon: "☀️" },
    { value: "dark", labelKey: "theme.dark", icon: "🌙" },
    { value: "system", labelKey: "theme.system", icon: "📱" },
  ];

  return (
    <Container fullWidth={Platform.OS === "web"}>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* Hero-Header mit dunklem Blau */}
        <View style={styles.heroHeader}>
          {/* BNM Logo oben rechts */}
          <View style={styles.heroLogoPosition}>
            <BNMLogo size={40} showSubtitle={false} />
          </View>
          {user.avatar_url ? (
            <Image
              source={{ uri: user.avatar_url }}
              style={styles.avatarImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
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
              {user.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
            </Text>
          </View>
        </View>

        {/* Erscheinungsbild / Theme-Toggle */}
        <View style={[styles.infoCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("theme.appearance")}</Text>
          <View style={themeToggleStyles.row}>
            {THEME_OPTIONS.map((option) => {
              const isActive = mode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    themeToggleStyles.option,
                    {
                      backgroundColor: isActive ? COLORS.gradientStart : themeColors.background,
                      borderColor: isActive ? COLORS.gradientStart : themeColors.border,
                    },
                  ]}
                  onPress={() => setMode(option.value)}
                  activeOpacity={0.7}
                >
                  <Text style={themeToggleStyles.optionIcon}>{option.icon}</Text>
                  <Text
                    style={[
                      themeToggleStyles.optionLabel,
                      { color: isActive ? COLORS.white : themeColors.textSecondary },
                    ]}
                  >
                    {t(option.labelKey)}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={{ fontSize: 11, color: themeColors.textTertiary, marginTop: 6 }}>
            Alpha-Version – noch in Entwicklung
          </Text>
        </View>

        {/* Persönliche Infos */}
        <View style={[styles.infoCard, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("profile.personalInfo")}</Text>

          <InfoRow label={t("profile.email")} value={user.email} />
          <InfoRow label={t("profile.city")} value={user.city} />
          <InfoRow label={t("profile.age")} value={`${user.age} ${t("profile.ageYears")}`} />
          {user.phone && <InfoRow label={t("profile.phone")} value={user.phone} />}
          <InfoRow
            label={t("profile.contact")}
            value={CONTACT_LABELS[user.contact_preference] ?? user.contact_preference}
            isLast
          />
        </View>

        {/* Mentor-Statistiken */}
        {user.role === "mentor" && mentorStats && (
          <View style={[styles.infoCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("profile.myStats")}</Text>
            <View style={styles.statsGrid}>
              <View style={[styles.statItem, { backgroundColor: themeColors.statItem }]}>
                <Text style={[styles.statValue, { color: themeColors.text }]}>{mentorStats.active}</Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("profile.activeMentorships")}</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: themeColors.statItem }]}>
                <Text style={[styles.statValue, { color: COLORS.cta }]}>{mentorStats.completed}</Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("profile.completedMentorships")}</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: themeColors.statItem }]}>
                <Text style={[styles.statValue, { color: COLORS.gradientStart }]}>{mentorStats.totalSessions}</Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("profile.totalSessions")}</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: themeColors.statItem }]}>
                <Text style={[styles.statValue, { color: COLORS.gold }]}>
                  #{mentorStats.rank}
                </Text>
                <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{t("profile.ranking")}</Text>
              </View>
            </View>
            <Text style={[styles.rankHint, { color: themeColors.textTertiary }]}>
              {t("profile.rankingOf").replace("{0}", String(mentorStats.totalMentors))}
            </Text>
          </View>
        )}

        {/* Kontaktinfo Mentorship-Partner — nur für Mentees sichtbar */}
        {partnerContact && user.role === "mentee" && (
          <View style={[styles.infoCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>{t("profile.partnerInfo")}</Text>
            <Text style={[styles.infoValue, { textAlign: "left", maxWidth: "100%", fontWeight: "700", color: themeColors.text, marginBottom: 8 }]}>
              {partnerContact.label}: {partnerContact.person.name}
            </Text>
            <InfoRow label={t("profile.partnerEmail")} value={partnerContact.person.email} />
            {partnerContact.person.phone ? (
              <InfoRow label={t("profile.partnerPhone")} value={partnerContact.person.phone} />
            ) : null}
            <InfoRow
              label={t("profile.partnerContact")}
              value={CONTACT_LABELS[partnerContact.person.contact_preference] ?? partnerContact.person.contact_preference}
              isLast
            />
            <TouchableOpacity
              style={[styles.partnerMessageBtn]}
              onPress={() =>
                router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: partnerContact.mentorshipId } })
              }
            >
              <Text style={styles.partnerMessageBtnText}>{t("profile.sendMessage")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Konto-Aktionen */}
        <View style={[styles.infoCard, { padding: 0, overflow: "hidden", backgroundColor: themeColors.card }]}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, color: themeColors.textTertiary }]}>
            {t("profile.account")}
          </Text>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: themeColors.border }]}
            onPress={() => router.push("/edit-profile")}
          >
            <Text style={[styles.menuItemText, { color: themeColors.text }]}>{t("profile.editProfile")}</Text>
            <Text style={[styles.menuArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: themeColors.border }]}
            onPress={() => router.push("/change-password")}
          >
            <Text style={[styles.menuItemText, { color: themeColors.text }]}>{t("profile.changePassword")}</Text>
            <Text style={[styles.menuArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomColor: themeColors.border }]}
            onPress={() => router.push("/settings")}
          >
            <Text style={[styles.menuItemText, { color: themeColors.text }]}>{t("profile.settings")}</Text>
            <Text style={[styles.menuArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.menuItem, { borderBottomWidth: 0 }]}
            onPress={() => router.push("/notification-settings")}
          >
            <Text style={[styles.menuItemText, { color: themeColors.text }]}>{t("notifSettings.title")}</Text>
            <Text style={[styles.menuArrow, { color: themeColors.textTertiary }]}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2", borderColor: isDark ? "#7a2a2a" : "#fecaca" }]}
          onPress={handleLogout}
        >
          <Text style={[styles.logoutText, { color: isDark ? "#f87171" : "#dc2626" }]}>{t("profile.logout")}</Text>
        </TouchableOpacity>

        {/* App-Footer */}
        <View style={styles.footerBox}>
          <Text style={[styles.footerVersion, { color: themeColors.textTertiary }]}>{t("footer.version")}</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => setShowPrivacy(true)}>
              <Text style={[styles.footerLink, { color: themeColors.link }]}>{t("footer.privacy")}</Text>
            </TouchableOpacity>
            <Text style={[styles.footerSep, { color: themeColors.textTertiary }]}>·</Text>
            <TouchableOpacity onPress={() => setShowImprint(true)}>
              <Text style={[styles.footerLink, { color: themeColors.link }]}>{t("footer.imprint")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Datenschutz Modal */}
        {showPrivacy && (
          <View style={styles.overlay}>
            <View style={[styles.overlayCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.overlayTitle, { color: themeColors.text }]}>{t("footer.privacyTitle")}</Text>
              <Text style={[styles.overlayText, { color: themeColors.textSecondary }]}>{t("footer.privacyText")}</Text>
              <TouchableOpacity style={styles.overlayClose} onPress={() => setShowPrivacy(false)}>
                <Text style={styles.overlayCloseText}>{t("common.back")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Impressum Modal */}
        {showImprint && (
          <View style={styles.overlay}>
            <View style={[styles.overlayCard, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.overlayTitle, { color: themeColors.text }]}>{t("footer.imprintTitle")}</Text>
              <Text style={[styles.overlayText, { color: themeColors.textSecondary }]}>{t("footer.imprintText")}</Text>
              <TouchableOpacity style={styles.overlayClose} onPress={() => setShowImprint(false)}>
                <Text style={styles.overlayCloseText}>{t("common.back")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
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
  const themeColors = useThemeColors();
  return (
    <View
      style={[
        styles.infoRow,
        isLast ? {} : { borderBottomWidth: 1, borderBottomColor: themeColors.border },
      ]}
    >
      <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: themeColors.text }]}>{value}</Text>
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
  avatarImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.gold,
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
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 12,
  },
  logoutText: { fontWeight: "600" },
  appInfo: { color: COLORS.tertiary, fontSize: 12, textAlign: "center" },
  partnerMessageBtn: {
    marginTop: 10,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  partnerMessageBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  footerBox: { alignItems: "center", marginBottom: 16 },
  footerVersion: { color: COLORS.tertiary, fontSize: 12, marginBottom: 6 },
  footerLinks: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLink: { color: COLORS.link, fontSize: 12 },
  footerSep: { color: COLORS.tertiary, fontSize: 12 },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
    padding: 32,
  },
  overlayCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 24,
    width: "100%",
  },
  overlayTitle: { fontWeight: "700", fontSize: 17, color: COLORS.primary, marginBottom: 12 },
  overlayText: { color: COLORS.secondary, fontSize: 14, lineHeight: 22, marginBottom: 20 },
  overlayClose: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  overlayCloseText: { color: COLORS.white, fontWeight: "600" },
});

// Styles für den Theme-Toggle (SegmentedControl-ähnlich)
const themeToggleStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
  },
  option: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 8,
    borderWidth: 1.5,
    gap: 4,
  },
  optionIcon: {
    fontSize: 18,
  },
  optionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
});
