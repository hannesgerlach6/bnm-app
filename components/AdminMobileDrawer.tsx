import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BNMPressable } from "./BNMPressable";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS, SHADOWS, RADIUS } from "../constants/Colors";
import { BNMLogo } from "./BNMLogo";

const DRAWER_WIDTH = 280;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function AdminMobileDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { user, logout } = useAuth();
  const { getTotalUnreadMessages } = useData();

  const role = user?.role;
  const isOffice = role === "office";
  const isAdminOrOffice = role === "admin" || role === "office";
  const isMentor = role === "mentor";
  const isMentee = role === "mentee";
  const chatUnread = isOffice ? 0 : getTotalUnreadMessages();

  const [visible, setVisible] = useState(false);
  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.timing(translateX, {
        toValue: 0,
        duration: 240,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(translateX, {
        toValue: -DRAWER_WIDTH,
        duration: 200,
        useNativeDriver: true,
      }).start(() => setVisible(false));
    }
  }, [open]);

  const calendarNavItem = { key: "/calendar", label: t("tabs.calendar"), icon: "calendar-outline" as const, iconActive: "calendar" as const, href: "/(tabs)/calendar" };

  // Rollenabhängige Menüpunkte
  const navItems = isMentee
    ? [
        { key: "/", label: t("tabs.dashboard"), icon: "grid-outline" as const, iconActive: "grid" as const, href: "/(tabs)/" },
        { key: "/chats", label: t("tabs.chats"), icon: "chatbubbles-outline" as const, iconActive: "chatbubbles" as const, href: "/(tabs)/chats", badge: chatUnread },
        calendarNavItem,
        { key: "/faq", label: t("tabs.faq"), icon: "help-circle-outline" as const, iconActive: "help-circle" as const, href: "/(tabs)/faq" },
        { key: "/profile", label: t("tabs.profile"), icon: "person-circle-outline" as const, iconActive: "person-circle" as const, href: "/(tabs)/profile" },
      ]
    : isMentor
    ? [
        { key: "/", label: t("tabs.dashboard"), icon: "grid-outline" as const, iconActive: "grid" as const, href: "/(tabs)/" },
        { key: "/mentees", label: t("tabs.mentees"), icon: "people-outline" as const, iconActive: "people" as const, href: "/(tabs)/mentees" },
        { key: "/chats", label: t("tabs.chats"), icon: "chatbubbles-outline" as const, iconActive: "chatbubbles" as const, href: "/(tabs)/chats", badge: chatUnread },
        calendarNavItem,
        { key: "/leaderboard", label: t("tabs.ranking"), icon: "trophy-outline" as const, iconActive: "trophy" as const, href: "/(tabs)/leaderboard" },
        { key: "/profile", label: t("tabs.profile"), icon: "person-circle-outline" as const, iconActive: "person-circle" as const, href: "/(tabs)/profile" },
      ]
    : [
        // Admin/Office
        { key: "/", label: t("tabs.dashboard"), icon: "grid-outline" as const, iconActive: "grid" as const, href: "/(tabs)/" },
        { key: "/mentees", label: t("tabs.mentees"), icon: "people-outline" as const, iconActive: "people" as const, href: "/(tabs)/mentees" },
        { key: "/mentors", label: t("sidebar.mentors"), icon: "school-outline" as const, iconActive: "school" as const, href: "/(tabs)/mentors" },
        { key: "/applications", label: t("sidebar.applications"), icon: "document-text-outline" as const, iconActive: "document-text" as const, href: "/(tabs)/applications" },
        ...(!isOffice
          ? [
              { key: "/admin/team", label: "Team", icon: "shield-checkmark-outline" as const, iconActive: "shield-checkmark" as const, href: "/admin/team" },
              { key: "/chats", label: t("tabs.chats"), icon: "chatbubbles-outline" as const, iconActive: "chatbubbles" as const, href: "/(tabs)/chats", badge: chatUnread },
            ]
          : []),
        { key: "/tools", label: "Tools", icon: "construct-outline" as const, iconActive: "construct" as const, href: "/(tabs)/tools" },
        calendarNavItem,
        { key: "/reports", label: t("tabs.reports"), icon: "stats-chart-outline" as const, iconActive: "stats-chart" as const, href: "/(tabs)/reports" },
        { key: "/feedback", label: t("tabs.feedback"), icon: "star-outline" as const, iconActive: "star" as const, href: "/(tabs)/feedback" },
        { key: "/leaderboard", label: t("tabs.ranking"), icon: "trophy-outline" as const, iconActive: "trophy" as const, href: "/(tabs)/leaderboard" },
        { key: "/profile", label: t("tabs.profile"), icon: "person-circle-outline" as const, iconActive: "person-circle" as const, href: "/(tabs)/profile" },
      ];

  const adminToolPaths = ["/admin/session-types", "/admin/qa-management", "/admin/hadithe-management", "/admin/message-templates", "/admin/certificate-generator", "/admin/csv-import", "/admin/mentor-award", "/admin/statistics", "/admin/resources"];
  const calendarPaths = ["/admin/calendar-management"];
  // Sub-Routes die zu bestimmten Tabs gehören
  const menteeSubPaths = ["/mentee/", "/mentorship/", "/assign", "/document-session"];
  const mentorSubPaths = ["/mentor/"];
  function isActive(key: string) {
    if (key === "/") return pathname === "/" || pathname === "/index";
    // Tools-Tab soll auch bei Admin-Unterseiten aktiv bleiben
    if (key === "/tools") return pathname.includes("/tools") || adminToolPaths.some((p) => pathname.includes(p));
    // Calendar-Tab: auch bei /admin/calendar-management
    if (key === "/calendar") return pathname.includes("/calendar") || calendarPaths.some((p) => pathname.includes(p));
    // Mentees-Tab: auch bei Mentee-Detail, Mentorship, Assign, Document-Session, edit-user
    // edit-user: from-Parameter bestimmt ob Mentees oder Mentoren
    if (pathname.includes("/admin/edit-user")) {
      const editFrom = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("from") : null;
      if (key === "/mentees") return editFrom !== "mentors";
      if (key === "/mentors") return editFrom === "mentors";
      return false;
    }
    if (key === "/mentees") return pathname.includes("/mentees") || menteeSubPaths.some((p) => pathname.includes(p));
    // Mentoren-Tab: auch bei Mentor-Detail
    if (key === "/mentors") return pathname.includes("/mentors") || (mentorSubPaths.some((p) => pathname.match(new RegExp("^" + p))) && !pathname.includes("/admin/mentor"));
    // Feedback-Tab: auch bei /feedback Detailseite
    if (key === "/feedback") return pathname.includes("/feedback");
    // Chats-Tab: auch bei /chat/[id]
    if (key === "/chats") return pathname.includes("/chats") || pathname.includes("/chat/");
    // Profil-Tab: auch bei /edit-profile, /change-password
    if (key === "/profile") return pathname.includes("/profile") || pathname.includes("/edit-profile") || pathname.includes("/change-password");
    return pathname === key || pathname.startsWith(key + "/");
  }

  function navigate(href: string) {
    onClose();
    // Kleines Delay damit die Schließ-Animation sauber läuft
    setTimeout(() => router.push(href as any), 180);
  }

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} statusBarTranslucent>
      {/* Abdunklung */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Drawer-Panel */}
      <Animated.View
        style={[
          styles.drawer,
          { backgroundColor: themeColors.card, transform: [{ translateX }] },
        ]}
      >
        {/* Header */}
        <View style={[styles.drawerHeader, { borderBottomColor: themeColors.border }]}>
          <View style={styles.drawerBrandRow}>
            <BNMLogo size={36} />
            <View>
              <Text style={styles.drawerBrand}>BNM</Text>
              <Text style={[styles.drawerRole, { color: themeColors.textSecondary }]}>
                {role === "admin" ? t("profile.roleAdmin") : role === "office" ? t("profile.roleOffice") : role === "mentor" ? t("profile.roleMentor") : t("profile.roleMentee")}
              </Text>
            </View>
          </View>
          <BNMPressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Menü schließen"
          >
            <Ionicons name="close" size={22} color={themeColors.textSecondary} />
          </BNMPressable>
        </View>

        {/* Navigation */}
        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {navItems.map((item) => {
            const active = isActive(item.key);
            return (
              <BNMPressable
                key={item.key}
                style={[
                  styles.navItem,
                  active && styles.navItemActive,
                ]}
                onPress={() => navigate(item.href)}
                accessibilityRole="menuitem"
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? COLORS.gradientStart : themeColors.textSecondary}
                  style={styles.navIcon}
                />
                <Text
                  style={[
                    styles.navLabel,
                    { color: active ? COLORS.gradientStart : themeColors.text },
                    active && { fontWeight: "700" },
                  ]}
                >
                  {item.label}
                </Text>
                {"badge" in item && item.badge! > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>
                      {item.badge! > 9 ? "9+" : String(item.badge)}
                    </Text>
                  </View>
                )}
                {active && <View style={styles.activeBar} />}
              </BNMPressable>
            );
          })}
        </ScrollView>

        {/* Logout */}
        <BNMPressable
          style={[styles.logoutBtn, { borderTopColor: themeColors.border }]}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel={t("sidebar.logout")}
        >
          <Ionicons name="log-out-outline" size={18} color={COLORS.error} />
          <Text style={styles.logoutLabel}>{t("sidebar.logout")}</Text>
        </BNMPressable>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  drawer: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    ...SHADOWS.lg,
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingBottom: 16,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    marginBottom: 8,
  },
  drawerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  drawerBrand: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.gold,
    letterSpacing: 1,
  },
  drawerRole: {
    fontSize: 12,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
  },
  navList: {
    flex: 1,
    paddingHorizontal: 12,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: RADIUS.sm,
    marginBottom: 2,
    position: "relative",
    overflow: "hidden",
  },
  navItemActive: {
    backgroundColor: COLORS.gradientStart + "18",
  },
  navIcon: {
    marginRight: 12,
    width: 22,
  },
  navLabel: {
    fontSize: 14,
    flex: 1,
  },
  activeBar: {
    position: "absolute",
    left: 0,
    top: 8,
    bottom: 8,
    width: 3,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 2,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderTopWidth: 1,
  },
  logoutLabel: {
    color: COLORS.error,
    fontWeight: "600",
    fontSize: 14,
  },
});
