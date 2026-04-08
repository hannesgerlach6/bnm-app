import React, { useMemo, useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  Image,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { navigateToChat } from "../../lib/chatNavigation";
import type { ThemeMode } from "../../contexts/ThemeContext";
import type { UserRole } from "../../types";
import { COLORS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";

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

  const partnerContact = useMemo(() => {
    if (!user) return null;
    if (user.role === "mentor") {
      const myMentorships = getMentorshipsByMentorId(user.id).filter((m) => m.status === "active");
      if (myMentorships.length === 0) return null;
      const mentee = myMentorships[0].mentee;
      return mentee ? { person: mentee, label: t("profile.myMentee"), mentorshipId: myMentorships[0].id } : null;
    }
    if (user.role === "mentee") {
      const mentorship = getMentorshipByMenteeId(user.id);
      if (!mentorship || mentorship.status !== "active" || !mentorship.mentor) return null;
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
      ? sem(SEMANTIC.purpleBg, isDark)
      : user.role === "mentor"
      ? themeColors.primaryLight
      : themeColors.successLight;

  const roleTextColor =
    user.role === "admin"
      ? sem(SEMANTIC.purpleText, isDark)
      : user.role === "mentor"
      ? themeColors.primary
      : themeColors.success;

  const THEME_OPTIONS: { value: ThemeMode; labelKey: "theme.light" | "theme.dark" | "theme.system"; icon: string }[] = [
    { value: "light", labelKey: "theme.light", icon: "sunny-outline" },
    { value: "dark", labelKey: "theme.dark", icon: "moon-outline" },
    { value: "system", labelKey: "theme.system", icon: "phone-portrait-outline" },
  ];

  // ─── Shared Content Blocks ───

  const profileHeaderBlock = (
    <View style={[styles.profileHeader, { backgroundColor: themeColors.card }]}>
      {user.avatar_url ? (
        <Image
          source={{ uri: user.avatar_url }}
          style={[styles.avatarImage, { borderColor: COLORS.gold }]}
          resizeMode="cover"
          accessibilityLabel={`Profilbild von ${user.name}`}
        />
      ) : (
        <View style={[styles.avatarCircle, { backgroundColor: themeColors.primaryLight }]}>
          <Text style={[styles.avatarText, { color: themeColors.primary }]}>{initials}</Text>
        </View>
      )}
      <Text style={[styles.userName, { color: themeColors.text }]}>{user.name}</Text>
      <Text style={[styles.userEmail, { color: themeColors.textTertiary }]}>{user.email}</Text>

      <View style={[styles.roleBadge, { backgroundColor: roleBgColor }]}>
        <Text style={[styles.roleBadgeText, { color: roleTextColor }]}>
          {ROLE_LABELS[user.role]}
        </Text>
      </View>

      <Text style={[styles.genderText, { color: themeColors.textTertiary }]}>
        {user.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
      </Text>

      <BNMPressable
        style={[styles.editProfileBtn, { backgroundColor: themeColors.text }]}
        onPress={() => router.push("/edit-profile")}
        accessibilityRole="button"
        accessibilityLabel={t("profile.editProfile")}
      >
        <Text style={[styles.editProfileBtnText, { color: themeColors.background }]}>{t("profile.editProfile")}</Text>
      </BNMPressable>
    </View>
  );

  const personalInfoBlock = (
    <>
      <Text style={[styles.sectionHeader, { color: themeColors.textTertiary }]}>{t("profile.personalInfo")}</Text>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <InfoRow icon="mail-outline" label={t("profile.email")} value={user.email} />
        <InfoRow icon="location-outline" label={t("profile.city")} value={user.city} />
        <InfoRow icon="calendar-outline" label={t("profile.age")} value={`${user.age} ${t("profile.ageYears")}`} />
        {user.phone && <InfoRow icon="call-outline" label={t("profile.phone")} value={user.phone} />}
        <InfoRow
          icon="chatbubble-outline"
          label={t("profile.contact")}
          value={CONTACT_LABELS[user.contact_preference] ?? user.contact_preference}
          isLast
        />
      </View>
    </>
  );

  const partnerBlock = partnerContact && user.role === "mentee" ? (
    <>
      <Text style={[styles.sectionHeader, { color: themeColors.textTertiary }]}>{t("profile.partnerInfo")}</Text>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.partnerName, { color: themeColors.text }]}>
          {partnerContact.label}: {partnerContact.person.name}
        </Text>
        <InfoRow icon="mail-outline" label={t("profile.partnerEmail")} value={partnerContact.person.email} />
        {partnerContact.person.phone ? (
          <InfoRow icon="call-outline" label={t("profile.partnerPhone")} value={partnerContact.person.phone} />
        ) : null}
        <InfoRow
          icon="chatbubble-outline"
          label={t("profile.partnerContact")}
          value={CONTACT_LABELS[partnerContact.person.contact_preference] ?? partnerContact.person.contact_preference}
          isLast
        />
        <BNMPressable
          style={[styles.partnerMessageBtn, { backgroundColor: themeColors.primary }]}
          onPress={() => navigateToChat(router, partnerContact.mentorshipId)}
          accessibilityRole="button"
          accessibilityLabel={t("profile.sendMessage")}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.white} style={{ marginRight: 6 }} />
          <Text style={styles.partnerMessageBtnText}>{t("profile.sendMessage")}</Text>
        </BNMPressable>
      </View>
    </>
  ) : null;

  const accountBlock = (
    <>
      <Text style={[styles.sectionHeader, { color: themeColors.textTertiary }]}>{t("profile.account")}</Text>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, padding: 0, overflow: "hidden" }]}>
        <MenuItem
          icon="key-outline"
          label={t("profile.changePassword")}
          onPress={() => router.push("/change-password")}
        />
        <MenuItem
          icon="notifications-outline"
          label={t("profile.notifications")}
          onPress={() => router.push("/notification-settings")}
        />
        <MenuItem
          icon="settings-outline"
          label={t("profile.settings")}
          onPress={() => router.push("/settings")}
          isLast
        />
      </View>
    </>
  );

  const themeBlock = (
    <>
      <Text style={[styles.sectionHeader, { color: themeColors.textTertiary }]}>{t("theme.appearance")}</Text>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.themeRow}>
          {THEME_OPTIONS.map((option) => {
            const isActive = mode === option.value;
            return (
              <BNMPressable
                key={option.value}
                style={[
                  styles.themeOption,
                  {
                    backgroundColor: isActive ? COLORS.gradientStart : themeColors.background,
                    borderColor: isActive ? COLORS.gradientStart : themeColors.border,
                  },
                ]}
                onPress={() => setMode(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ checked: isActive }}
                accessibilityLabel={t(option.labelKey)}
              >
                <Ionicons
                  name={option.icon as any}
                  size={18}
                  color={isActive ? COLORS.white : themeColors.textSecondary}
                />
                <Text
                  style={[
                    styles.themeOptionLabel,
                    { color: isActive ? COLORS.white : themeColors.textSecondary },
                  ]}
                >
                  {t(option.labelKey)}
                </Text>
              </BNMPressable>
            );
          })}
        </View>
      </View>
    </>
  );

  const statsBlock = user.role === "mentor" && mentorStats ? (
    <>
      <Text style={[styles.sectionHeader, { color: themeColors.textTertiary }]}>{t("profile.myStats")}</Text>
      <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.statsGrid}>
          <StatItem value={String(mentorStats.active)} label={t("profile.activeMentorships")} color={themeColors.accent} />
          <StatItem value={String(mentorStats.completed)} label={t("profile.completedMentorships")} color={themeColors.success} />
          <StatItem value={String(mentorStats.totalSessions)} label={t("profile.totalSessions")} color={themeColors.primary} />
          <StatItem value={`#${mentorStats.rank}`} label={t("profile.ranking")} color={COLORS.gold} />
        </View>
        <Text style={[styles.rankHint, { color: themeColors.textTertiary }]}>
          {t("profile.rankingOf").replace("{0}", String(mentorStats.totalMentors))}
        </Text>
      </View>
    </>
  ) : null;

  const logoutBlock = (
    <View style={styles.logoutSection}>
      <BNMPressable
        style={styles.logoutRow}
        onPress={handleLogout}
        hapticStyle="warning"
        accessibilityRole="button"
        accessibilityLabel={t("profile.logout")}
      >
        <Ionicons name="log-out-outline" size={20} color={themeColors.error} />
        <Text style={[styles.logoutText, { color: themeColors.error }]}>{t("profile.logout")}</Text>
      </BNMPressable>
    </View>
  );

  const footerBlock = (
    <View style={styles.footerBox}>
      <Text style={[styles.footerVersion, { color: themeColors.textTertiary }]}>{t("footer.version")}</Text>
      <Text style={[styles.footerPartner, { color: themeColors.textTertiary }]}>
        Ein iERA Projekt in Kooperation mit IMAN
      </Text>
      <View style={styles.footerLinks}>
        <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/datenschutzerklaerung/")} accessibilityRole="link" accessibilityLabel={t("footer.privacy")}>
          <Text style={[styles.footerLink, { color: themeColors.link }]}>{t("footer.privacy")}</Text>
        </BNMPressable>
        <Text style={[styles.footerSep, { color: themeColors.textTertiary }]}>·</Text>
        <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/impressum/")} accessibilityRole="link" accessibilityLabel={t("footer.imprint")}>
          <Text style={[styles.footerLink, { color: themeColors.link }]}>{t("footer.imprint")}</Text>
        </BNMPressable>
        <Text style={[styles.footerSep, { color: themeColors.textTertiary }]}>·</Text>
        <BNMPressable onPress={() => Linking.openURL("https://iman.ngo/agbs/")} accessibilityRole="link" accessibilityLabel="Allgemeine Geschäftsbedingungen">
          <Text style={[styles.footerLink, { color: themeColors.link }]}>AGB</Text>
        </BNMPressable>
      </View>
    </View>
  );

  const modals = (
    <>
      {showPrivacy && (
        <View style={styles.overlay}>
          <View style={[styles.overlayCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.overlayTitle, { color: themeColors.text }]}>{t("footer.privacyTitle")}</Text>
            <Text style={[styles.overlayText, { color: themeColors.textSecondary }]}>{t("footer.privacyText")}</Text>
            <BNMPressable style={[styles.overlayClose, { backgroundColor: themeColors.primary }]} onPress={() => setShowPrivacy(false)} accessibilityRole="button" accessibilityLabel={t("common.back")}>
              <Text style={styles.overlayCloseText}>{t("common.back")}</Text>
            </BNMPressable>
          </View>
        </View>
      )}
      {showImprint && (
        <View style={styles.overlay}>
          <View style={[styles.overlayCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.overlayTitle, { color: themeColors.text }]}>{t("footer.imprintTitle")}</Text>
            <Text style={[styles.overlayText, { color: themeColors.textSecondary }]}>{t("footer.imprintText")}</Text>
            <BNMPressable style={[styles.overlayClose, { backgroundColor: themeColors.primary }]} onPress={() => setShowImprint(false)} accessibilityRole="button" accessibilityLabel={t("common.back")}>
              <Text style={styles.overlayCloseText}>{t("common.back")}</Text>
            </BNMPressable>
          </View>
        </View>
      )}
    </>
  );

  return (
    <Container>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeColors.accent} />}
    >
      <View style={styles.page}>
        {profileHeaderBlock}
        {personalInfoBlock}
        {partnerBlock}
        {accountBlock}
        {themeBlock}
        {statsBlock}
        {logoutBlock}
        {footerBlock}
        {modals}
      </View>
    </ScrollView>
    </Container>
  );
}

/* ─── Sub-Components ─── */

function InfoRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon?: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  const themeColors = useThemeColors();
  return (
    <View
      style={[
        styles.infoRow,
        isLast ? {} : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
      ]}
    >
      <View style={styles.infoRowLeft}>
        {icon && (
          <Ionicons name={icon as any} size={18} color={themeColors.textTertiary} style={{ marginRight: 10 }} />
        )}
        <Text style={[styles.infoLabel, { color: themeColors.textSecondary }]}>{label}</Text>
      </View>
      <Text style={[styles.infoValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  isLast,
}: {
  icon: string;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const themeColors = useThemeColors();
  return (
    <BNMPressable
      style={[
        styles.menuItem,
        isLast ? {} : { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.border },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.menuItemLeft}>
        <Ionicons name={icon as any} size={20} color={themeColors.textSecondary} />
        <Text style={[styles.menuItemText, { color: themeColors.text }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={themeColors.textTertiary} />
    </BNMPressable>
  );
}

function StatItem({ value, label, color }: { value: string; label: string; color: string }) {
  const themeColors = useThemeColors();
  return (
    <View style={[styles.statItem, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>{label}</Text>
    </View>
  );
}

/* ─── Styles ─── */

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 16, paddingBottom: 32 },

  // --- Profile Header ---
  profileHeader: {
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    marginBottom: 8,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    borderWidth: 2.5,
  },
  avatarText: { fontSize: 26, fontWeight: "700" },
  userName: { fontSize: 20, fontWeight: "700", marginBottom: 2 },
  userEmail: { fontSize: 14, marginBottom: 8 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: RADIUS.full },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  genderText: { fontSize: 13, marginTop: 4 },
  editProfileBtn: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  editProfileBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // --- Section Header ---
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },

  // --- Card ---
  card: {
    borderRadius: RADIUS.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },

  // --- Info Rows ---
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
  },
  infoRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoLabel: { fontSize: 13 },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    maxWidth: "55%",
    textAlign: "right",
  },

  // --- Menu Items ---
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: { fontSize: 15 },

  // --- Theme Toggle ---
  themeRow: {
    flexDirection: "row",
    gap: 8,
  },
  themeOption: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: RADIUS.sm,
    borderWidth: 1.5,
    gap: 4,
  },
  themeOptionLabel: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },

  // --- Stats ---
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  statItem: {
    flex: 1,
    minWidth: "40%",
    borderRadius: RADIUS.sm,
    padding: 12,
    alignItems: "center",
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, marginTop: 2, textAlign: "center" },
  rankHint: { fontSize: 11, textAlign: "center", marginTop: 6 },

  // --- Partner ---
  partnerName: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 8,
  },
  partnerMessageBtn: {
    marginTop: 12,
    borderRadius: RADIUS.full,
    paddingVertical: 10,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  partnerMessageBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 13 },

  // --- Logout ---
  logoutSection: {
    marginTop: 24,
    marginBottom: 8,
  },
  logoutRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
  },
  logoutText: { fontWeight: "600", fontSize: 15 },

  // --- Footer ---
  footerBox: { alignItems: "center", marginTop: 8, marginBottom: 16 },
  footerVersion: { fontSize: 12, marginBottom: 4 },
  footerPartner: { fontSize: 11, marginBottom: 8, textAlign: "center" },
  footerLinks: { flexDirection: "row", alignItems: "center", gap: 6 },
  footerLink: { fontSize: 12 },
  footerSep: { fontSize: 12 },

  // --- Overlays ---
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
    borderRadius: RADIUS.md,
    padding: 24,
    width: "100%",
  },
  overlayTitle: { fontWeight: "800", fontSize: 17, marginBottom: 12 },
  overlayText: { fontSize: 14, lineHeight: 22, marginBottom: 20 },
  overlayClose: {
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
  overlayCloseText: { color: COLORS.white, fontWeight: "600" },
});
