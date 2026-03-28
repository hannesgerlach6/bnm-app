/**
 * AdminSidebar — exportierte Komponente, die sowohl in (tabs)/_layout.tsx
 * als auch direkt in app/_layout.tsx (als permanenter Web-Wrapper) genutzt wird.
 */
import React from "react";
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
import { COLORS } from "../constants/Colors";

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
  const activeColor = isDark ? "#FFCA28" : "#EEA71B";
  const activeTextColor = "#0E0E14";
  const inactiveIconColor = isDark ? "#5E5E6A" : themeColors.textSecondary;
  const inactiveTextColor = isDark ? "#8E8E9A" : themeColors.textSecondary;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        sidebarStyles.item,
        isActive
          ? { backgroundColor: activeColor }
          : { backgroundColor: "transparent" },
      ]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={(isActive ? iconNameActive : iconName) as any}
        size={20}
        color={isActive ? activeTextColor : inactiveIconColor}
      />
      <Text
        style={[
          sidebarStyles.itemLabel,
          { color: isActive ? activeTextColor : inactiveTextColor },
        ]}
      >
        {label}
      </Text>
      {badge != null && badge > 0 && (
        <View style={sidebarStyles.badge}>
          <Text style={sidebarStyles.badgeText}>
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
  // Bei sehr schmalen Viewports (768-900px) Logo kompakter darstellen
  const isNarrow = width < 900;

  const isOffice = user?.role === "office";

  // Aktiver Pfad ermitteln
  // /admin/* Screens (session-types, donor-report, qa-management, hadithe-management)
  // gehören zum "tools" Bereich und sollen dort highlighted bleiben
  const isAdminToolScreen =
    pathname.includes("/admin/session-types") ||
    pathname.includes("/admin/qa-management") ||
    pathname.includes("/admin/hadithe-management");

  const activeSegment = pathname.includes("/reports") || pathname.includes("/admin/donor-report")
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
      // Bestätigung auch im Browser (besonders wichtig auf mobilen Browsern)
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
        sidebarStyles.sidebar,
        {
          backgroundColor: isDark ? "#0D0D12" : themeColors.background,
          borderRightColor: isDark ? "#1A1A24" : themeColors.border,
        },
      ]}
    >
      {/* Logo */}
      <View style={sidebarStyles.logoArea}>
        <BNMLogo size={isNarrow ? 48 : 72} showSubtitle={false} />
      </View>

      {/* Haupt-Navigation */}
      <View style={sidebarStyles.nav}>
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
      <View style={[sidebarStyles.bottomArea, { borderTopColor: isDark ? "#1A1A24" : themeColors.border }]}>
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
          style={sidebarStyles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
          <Text style={sidebarStyles.logoutLabel}>{t("sidebar.logout")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: 240,
    minWidth: 200,
    borderRightWidth: 1,
    flexDirection: "column",
    paddingTop: 24,
    flexShrink: 0,
  },
  logoArea: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(128,128,128,0.15)",
  },
  nav: {
    flex: 1,
    paddingTop: 12,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 4,
    gap: 12,
    flexShrink: 0,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    flexShrink: 1,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 9999,
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
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderTopWidth: 1,
    gap: 2,
    flexShrink: 0,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 12,
    marginTop: 4,
    width: "100%",
    flexShrink: 0,
  },
  logoutLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.error,
    flex: 1,
    flexShrink: 1,
  },
});
