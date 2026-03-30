/**
 * AdminSidebar — Einklappbar (Collapsed/Expanded), scrollbar bei Zoom,
 * inspiriert von Musemind Dashboard Sidebar Navigation.
 */
import React, { useState, useEffect } from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
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

const SIDEBAR_EXPANDED = 250;
const SIDEBAR_COLLAPSED = 68;

// ─── Sidebar Item ─────────────────────────────────────────────────────────────

interface SidebarItemProps {
  label: string;
  iconName: string;
  iconNameActive: string;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
  collapsed?: boolean;
}

function SidebarItem({
  label,
  iconName,
  iconNameActive,
  isActive,
  onPress,
  badge,
  collapsed,
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
        collapsed && styles.itemCollapsed,
        isActive
          ? { backgroundColor: activeBg }
          : isHovered
          ? { backgroundColor: hoverBg }
          : { backgroundColor: "transparent" },
      ]}
      activeOpacity={0.7}
      // @ts-ignore — Web-only title attribute for tooltip in collapsed mode
      title={collapsed ? label : undefined}
      {...webHoverProps}
    >
      {/* Aktiver Indikator-Strich links */}
      {!collapsed && (
        <View style={[
          styles.activeIndicator,
          { backgroundColor: isActive ? activeAccent : "transparent" },
        ]} />
      )}

      {/* Icon */}
      <View style={[
        styles.iconCircle,
        collapsed && styles.iconCircleCollapsed,
        isActive
          ? { backgroundColor: isDark ? "rgba(255,202,40,0.15)" : "rgba(238,167,27,0.15)" }
          : { backgroundColor: "transparent" },
      ]}>
        <Ionicons
          name={(isActive ? iconNameActive : iconName) as any}
          size={collapsed ? 20 : 18}
          color={isActive ? activeAccent : inactiveIconColor}
        />
        {/* Badge über Icon im Collapsed-Modus */}
        {collapsed && badge != null && badge > 0 && (
          <View style={styles.badgeCollapsed}>
            <Text style={styles.badgeText}>{badge > 9 ? "9+" : String(badge)}</Text>
          </View>
        )}
      </View>

      {/* Label + Badge (nur im Expanded-Modus) */}
      {!collapsed && (
        <>
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
        </>
      )}

      {/* Web Tooltip bei Hover im Collapsed-Modus */}
      {collapsed && isHovered && Platform.OS === "web" && (
        <View style={[styles.tooltip, { backgroundColor: isDark ? "#1E1E2A" : "#1a1a2e" }]}>
          <Text style={styles.tooltipText}>{label}</Text>
          <View style={[styles.tooltipArrow, { borderRightColor: isDark ? "#1E1E2A" : "#1a1a2e" }]} />
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
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const chatUnread = isAdminOrOffice ? 0 : getTotalUnreadMessages();

  const isOffice = user?.role === "office";

  // Collapsed State — aus localStorage laden/speichern
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    if (Platform.OS === "web") {
      const stored = localStorage.getItem("bnm-sidebar-collapsed");
      if (stored === "true") setCollapsed(true);
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (Platform.OS === "web") {
      localStorage.setItem("bnm-sidebar-collapsed", String(next));
    }
  };

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

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED;

  return (
    <View
      style={[
        styles.sidebar,
        {
          width: sidebarWidth,
          minWidth: sidebarWidth,
          backgroundColor: isDark ? "#0A0A10" : "#FAFBFC",
          borderRightColor: isDark ? "#1A1A24" : themeColors.border,
        },
      ]}
    >
      {/* Logo + Collapse Toggle */}
      <View style={[styles.logoArea, { borderBottomColor: isDark ? "#1A1A24" : themeColors.border }]}>
        {!collapsed && (
          <View style={{ marginBottom: 12 }}>
            <BNMLogo size={48} showSubtitle={false} />
          </View>
        )}
        <TouchableOpacity
          onPress={toggleCollapsed}
          style={[styles.collapseBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)" }]}
          activeOpacity={0.7}
        >
          <Ionicons
            name={collapsed ? "chevron-forward-outline" : "chevron-back-outline"}
            size={16}
            color={isDark ? "#6E6E7A" : themeColors.textTertiary}
          />
        </TouchableOpacity>
      </View>

      {/* Sektions-Label */}
      {!collapsed && (
        <View style={styles.sectionLabelWrap}>
          <Text style={[styles.sectionLabel, { color: isDark ? "#4E4E5A" : themeColors.textTertiary }]}>
            NAVIGATION
          </Text>
        </View>
      )}

      {/* Haupt-Navigation — ScrollView für Zoom-Support */}
      <ScrollView
        style={styles.nav}
        contentContainerStyle={styles.navContent}
        showsVerticalScrollIndicator={false}
      >
        {mainItems.map((item) => (
          <SidebarItem
            key={item.key}
            label={item.label}
            iconName={item.iconName}
            iconNameActive={item.iconNameActive}
            isActive={activeSegment === item.key}
            onPress={() => router.push(item.href as any)}
            badge={(item as any).badge}
            collapsed={collapsed}
          />
        ))}
      </ScrollView>

      {/* Unten: Profil + Logout */}
      <View style={[styles.bottomArea, { borderTopColor: isDark ? "#1A1A24" : themeColors.border }]}>
        <SidebarItem
          key="profile"
          label={t("tabs.profile")}
          iconName="settings-outline"
          iconNameActive="settings"
          isActive={activeSegment === "profile"}
          onPress={() => router.push("/(tabs)/profile" as any)}
          collapsed={collapsed}
        />
        <TouchableOpacity
          style={[styles.logoutButton, collapsed && styles.logoutButtonCollapsed]}
          onPress={handleLogout}
          activeOpacity={0.7}
          // @ts-ignore
          title={collapsed ? t("sidebar.logout") : undefined}
        >
          <View style={styles.logoutIconCircle}>
            <Ionicons name="log-out-outline" size={16} color="#EF5350" />
          </View>
          {!collapsed && <Text style={styles.logoutLabel}>{t("sidebar.logout")}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    borderRightWidth: 1,
    flexDirection: "column",
    paddingTop: 16,
    flexShrink: 0,
    // @ts-ignore — Web transition
    ...(Platform.OS === "web" ? { transition: "width 0.2s ease, min-width 0.2s ease" } : {}),
  },
  logoArea: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  collapseBtn: {
    width: 32,
    height: 28,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  sectionLabelWrap: {
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
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
  },
  navContent: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    paddingLeft: 6,
    borderRadius: RADIUS.md,
    marginBottom: 2,
    gap: SPACING.sm,
    flexShrink: 0,
    // @ts-ignore
    ...(Platform.OS === "web" ? { position: "relative" } : {}),
  },
  itemCollapsed: {
    justifyContent: "center",
    paddingLeft: 0,
    paddingHorizontal: 0,
    marginHorizontal: 4,
  },
  activeIndicator: {
    width: 3,
    height: 20,
    borderRadius: 2,
    flexShrink: 0,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconCircleCollapsed: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
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
  badgeCollapsed: {
    position: "absolute",
    top: -2,
    right: -4,
    backgroundColor: "#EF5350",
    borderRadius: RADIUS.full,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: "bold",
  },
  tooltip: {
    position: "absolute",
    left: "100%",
    marginLeft: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    zIndex: 999,
    // @ts-ignore
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap", pointerEvents: "none" } : {}),
  },
  tooltipText: {
    color: "#F5F5F7",
    fontSize: 12,
    fontWeight: "600",
  },
  tooltipArrow: {
    position: "absolute",
    left: -4,
    top: "50%",
    marginTop: -4,
    width: 0,
    height: 0,
    borderTopWidth: 4,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderTopColor: "transparent",
    borderBottomColor: "transparent",
  },
  bottomArea: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.md,
    borderTopWidth: 1,
    gap: 2,
    flexShrink: 0,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: SPACING.sm,
    paddingLeft: 6 + 3 + SPACING.sm,
    borderRadius: RADIUS.md,
    gap: SPACING.sm,
    marginTop: 2,
    width: "100%",
    flexShrink: 0,
  },
  logoutButtonCollapsed: {
    justifyContent: "center",
    paddingLeft: 0,
    paddingHorizontal: 0,
    marginHorizontal: 4,
  },
  logoutIconCircle: {
    width: 34,
    height: 34,
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
