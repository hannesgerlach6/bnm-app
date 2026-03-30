/**
 * AdminSidebar — Redesign inspiriert von Musemind Dashboard Sidebar Navigation.
 * Goldener aktiver Indikator-Strich, subtile Hover-Effekte, modernes Spacing.
 */
import React, { useState } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { BNMLogo } from "./BNMLogo";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS, SPACING, RADIUS } from "../constants/Colors";

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

interface SidebarItemProps {
  label: string;
  href: string;
  iconName: string;
  iconNameActive: string;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}

function SidebarItem({
  label,
  iconName,
  iconNameActive,
  isActive,
  onPress,
  badge,
}: SidebarItemProps) {
  const themeColors = useThemeColors();
  const isDark = themeColors.background === "#0E0E14";
  const [isHovered, setIsHovered] = useState(false);

  const activeAccent = isDark ? "#FFCA28" : "#EEA71B";
  const activeTextColor = isDark ? "#FFCA28" : "#0E0E14";
  const activeBg = isDark ? "rgba(255,202,40,0.08)" : "rgba(238,167,27,0.10)";
  const hoverBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const inactiveIconColor = isDark ? "#6E6E7A" : themeColors.textSecondary;
  const inactiveTextColor = isDark ? "#9E9EAA" : themeColors.textSecondary;

  const webHoverProps = Platform.OS === "web" ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.item,
        isActive
          ? { backgroundColor: activeBg }
          : isHovered
          ? { backgroundColor: hoverBg }
          : { backgroundColor: "transparent" },
      ]}
      activeOpacity={0.7}
      {...webHoverProps}
    >
      {/* Aktiver Indikator-Strich links */}
      <View style={[
        styles.activeIndicator,
        { backgroundColor: isActive ? activeAccent : "transparent" },
      ]} />

      {/* Icon im halbtransparenten Kreis */}
      <View style={[
        styles.iconCircle,
        isActive
          ? { backgroundColor: isDark ? "rgba(255,202,40,0.15)" : "rgba(238,167,27,0.15)" }
          : { backgroundColor: "transparent" },
      ]}>
        <Ionicons
          name={(isActive ? iconNameActive : iconName) as any}
          size={18}
          color={isActive ? activeAccent : inactiveIconColor}
        />
      </View>

      <Text
        style={[
          styles.itemLabel,
          {
            color: isActive ? activeTextColor : inactiveTextColor,
            fontWeight: isActive ? "700" : "500",
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>

      {badge != null && badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {badge > 9 ? "9+" : String(badge)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── AdminSidebar ─────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const themeColors = useThemeColors();
  const isDark = themeColors.background === "#0E0E14";
  const { t } = useLanguage();
  const { getUnreadCount, getTotalUnreadMessages } = useData();
  const { user, logout } = useAuth();
  const { width } = useWindowDimensions();
  const unreadCount = getUnreadCount();
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const chatUnread = isAdminOrOffice ? 0 : getTotalUnreadMessages();
  const isNarrow = width < 900;

  const isOffice = user?.role === "office";

  // Aktiver Pfad ermitteln
  const isAdminToolScreen =
    pathname.includes("/admin/session-types") ||
    pathname.includes("/admin/qa-management") ||
    pathname.includes("/admin/hadithe-management");

  const activeSegment = pathname.includes("/reports") || pathname.includes("donor-report")
    ? "reports"
    : pathname.includes("/mentees")
    ? "mentees"
    : pathname.includes("/mentors") && !pathname.includes("/admin/mentor")
    ? "mentors"
    : pathname.includes("/applications") || pathname.includes("/admin/pending")
    ? "applications"
    : pathname.includes("/tools") || isAdminToolScreen
    ? "tools"
    : pathname.includes("/feedback")
    ? "feedback"
    : pathname.includes("/chats")
    ? "chats"
    : pathname.includes("/leaderboard")
    ? "leaderboard"
    : pathname.includes("/profile")
    ? "profile"
    : "index";

  const mainItems = [
    { key: "index", label: t("tabs.dashboard"), iconName: "grid-outline", iconNameActive: "grid", href: "/(tabs)/" },
    { key: "mentees", label: t("tabs.mentees"), iconName: "people-outline", iconNameActive: "people", href: "/(tabs)/mentees" },
    { key: "mentors", label: t("sidebar.mentors"), iconName: "school-outline", iconNameActive: "school", href: "/(tabs)/mentors" },
    { key: "applications", label: t("sidebar.applications"), iconName: "document-text-outline", iconNameActive: "document-text", href: "/(tabs)/applications" },
    { key: "tools", label: "Tools", iconName: "construct-outline", iconNameActive: "construct", href: "/(tabs)/tools" },
    { key: "feedback", label: t("tabs.feedback"), iconName: "star-outline", iconNameActive: "star", href: "/(tabs)/feedback" },
    ...(!isOffice
      ? [{ key: "chats", label: t("tabs.chats"), iconName: "chatbubbles-outline", iconNameActive: "chatbubbles", href: "/(tabs)/chats", badge: chatUnread }]
      : []),
    { key: "reports", label: t("tabs.reports"), iconName: "stats-chart-outline", iconNameActive: "stats-chart", href: "/(tabs)/reports" },
  ];

  const handleLogout = () => {
    if (Platform.OS === "web") {
      if (window.confirm(t("sidebar.logoutConfirmMsg"))) {
        logout();
      }
    } else {
      Alert.alert(
        t("sidebar.logoutConfirm"),
        t("sidebar.logoutConfirmMsg"),
        [
          { text: t("common.cancel"), style: "cancel" },
          { text: t("sidebar.logout"), style: "destructive", onPress: logout },
        ]
      );
    }
  };

  return (
    <View
      style={[
        styles.sidebar,
        {
          backgroundColor: isDark ? "#0A0A10" : "#FAFBFC",
          borderRightColor: isDark ? "#1A1A24" : themeColors.border,
        },
      ]}
    >
      {/* Logo */}
      <View style={[styles.logoArea, { borderBottomColor: isDark ? "#1A1A24" : themeColors.border }]}>
        <BNMLogo size={isNarrow ? 44 : 56} showSubtitle={false} />
      </View>

      {/* Sektions-Label */}
      <View style={styles.sectionLabelWrap}>
        <Text style={[styles.sectionLabel, { color: isDark ? "#4E4E5A" : themeColors.textTertiary }]}>
          NAVIGATION
        </Text>
      </View>

      {/* Haupt-Navigation */}
      <View style={styles.nav}>
        {mainItems.map((item) => (
          <SidebarItem
            key={item.key}
            label={item.label}
            href={item.href}
            iconName={item.iconName}
            iconNameActive={item.iconNameActive}
            isActive={activeSegment === item.key}
            onPress={() => router.push(item.href as any)}
            badge={(item as any).badge}
          />
        ))}
      </View>

      {/* Unten: Profil + Logout */}
      <View style={[styles.bottomArea, { borderTopColor: isDark ? "#1A1A24" : themeColors.border }]}>
        <SidebarItem
          key="profile"
          label={t("tabs.profile")}
          href="/(tabs)/profile"
          iconName="settings-outline"
          iconNameActive="settings"
          isActive={activeSegment === "profile"}
          onPress={() => router.push("/(tabs)/profile" as any)}
        />
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <View style={styles.logoutIconCircle}>
            <Ionicons name="log-out-outline" size={16} color="#EF5350" />
          </View>
          <Text style={styles.logoutLabel}>{t("sidebar.logout")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    width: 250,
    minWidth: 210,
    borderRightWidth: 1,
    flexDirection: "column",
    paddingTop: 20,
    flexShrink: 0,
  },
  logoArea: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl,
    borderBottomWidth: 1,
  },
  sectionLabelWrap: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.xs,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 1.2,
  },
  nav: {
    flex: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    paddingLeft: 6,
    borderRadius: RADIUS.md,
    marginBottom: 2,
    gap: SPACING.md,
    flexShrink: 0,
  },
  activeIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    flexShrink: 0,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 13,
    flex: 1,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: "#EF5350",
    borderRadius: RADIUS.full,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    flexShrink: 0,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  bottomArea: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    gap: 2,
    flexShrink: 0,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: SPACING.md,
    paddingLeft: 6 + 3 + SPACING.md, // align with nav items (indicator + gap)
    borderRadius: RADIUS.md,
    gap: SPACING.md,
    marginTop: 2,
    width: "100%",
    flexShrink: 0,
  },
  logoutIconCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(239,83,80,0.10)",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoutLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#EF5350",
    flex: 1,
    flexShrink: 1,
  },
});
