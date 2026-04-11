/**
 * AdminSidebar — Einklappbar (Collapsed/Expanded), scrollbar bei Zoom,
 * rollenabhängige Navigation für alle User auf Web.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Alert,
  ScrollView,
  useWindowDimensions,
} from "react-native";
import { BNMPressable } from "./BNMPressable";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { BNMLogo } from "./BNMLogo";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
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
  const { isDark } = useTheme();
  const [isHovered, setIsHovered] = useState(false);

  const activeAccent = themeColors.accent;
  const activeTextColor = isDark ? themeColors.accent : themeColors.text;
  const activeBg = isDark ? "rgba(238,167,27,0.10)" : "rgba(238,167,27,0.08)";
  const hoverBg = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const inactiveIconColor = themeColors.textSecondary;
  const inactiveTextColor = themeColors.textSecondary;

  const webHoverProps = Platform.OS === "web" ? {
    onMouseEnter: () => setIsHovered(true),
    onMouseLeave: () => setIsHovered(false),
  } : {};

  return (
    <BNMPressable
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
      // @ts-ignore — Web-only title attribute for tooltip in collapsed mode
      title={collapsed ? label : undefined}
      accessibilityRole="menuitem"
      accessibilityLabel={badge && badge > 0 ? `${label}, ${badge} neu` : label}
      accessibilityState={{ selected: isActive }}
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
          ? { backgroundColor: "rgba(238,167,27,0.15)" }
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
        <View style={[styles.tooltip, { backgroundColor: isDark ? themeColors.elevated : themeColors.text }]}>
          <Text style={styles.tooltipText}>{label}</Text>
          <View style={[styles.tooltipArrow, { borderRightColor: isDark ? themeColors.elevated : themeColors.text }]} />
        </View>
      )}
    </BNMPressable>
  );
}

// ─── AdminSidebar ────────────────────────────────────────────────────────────

export function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
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
    pathname.includes("/admin/hadithe-management") ||
    pathname.includes("/admin/message-templates") ||
    pathname.includes("/admin/certificate-generator") ||
    pathname.includes("/admin/csv-import") ||
    pathname.includes("/admin/mentor-award") ||
    pathname.includes("/admin/statistics") ||
    pathname.includes("/admin/resources");

  const role = user?.role;
  const isMentor = role === "mentor";
  const isMentee = role === "mentee";

  // Sub-Routes die zu Mentees gehören: /mentee/[id], /mentorship/[id], /assign, /document-session
  const isMenteeSubRoute =
    pathname.match(/^\/mentee\//) ||
    pathname.includes("/mentorship/") ||
    pathname.includes("/assign") ||
    pathname.includes("/document-session");

  // Sub-Routes die zu Mentoren gehören: /mentor/[id], /admin/edit-user
  const isMentorSubRoute =
    (pathname.match(/^\/mentor\//) && !pathname.includes("/admin/mentor"));

  // /admin/edit-user kann von Mentees oder Mentoren kommen — wir nutzen den letzten bekannten Kontext
  // Fallback: wenn pathname /admin/edit-user ist, schaue ob davor mentees oder mentors aktiv war
  const isEditUser = pathname.includes("/admin/edit-user");

  const activeSegment = pathname.includes("/reports") || pathname.includes("donor-report")
    ? "reports"
    : pathname.includes("/mentees") || isMenteeSubRoute
    ? "mentees"
    : pathname.includes("/mentors") || isMentorSubRoute
    ? (isMentor ? "leaderboard" : "mentors")
    : pathname.includes("/applications") || pathname.includes("/admin/pending")
    ? "applications"
    : pathname.includes("/tools") || isAdminToolScreen
    ? "tools"
    : pathname.includes("/feedback")
    ? "feedback"
    : pathname.includes("/chats") || pathname.includes("/chat/")
    ? "chats"
    : pathname.includes("/leaderboard")
    ? "leaderboard"
    : pathname.includes("/faq") || pathname.includes("/qa")
    ? "faq"
    : pathname.includes("/profile") || pathname.includes("/edit-profile") || pathname.includes("/change-password")
    ? "profile"
    : isEditUser
    ? "mentees"
    : "index";

  // Rollenabhängige Menüpunkte
  const mainItems = isMentee
    ? [
        { key: "index", label: t("tabs.dashboard"), iconName: "grid-outline", iconNameActive: "grid", href: "/(tabs)/" },
        { key: "chats", label: t("tabs.chats"), iconName: "chatbubbles-outline", iconNameActive: "chatbubbles", href: "/(tabs)/chats", badge: chatUnread },
        { key: "faq", label: t("tabs.faq"), iconName: "help-circle-outline", iconNameActive: "help-circle", href: "/(tabs)/faq" },
      ]
    : isMentor
    ? [
        { key: "index", label: t("tabs.dashboard"), iconName: "grid-outline", iconNameActive: "grid", href: "/(tabs)/" },
        { key: "mentees", label: t("tabs.mentees"), iconName: "people-outline", iconNameActive: "people", href: "/(tabs)/mentees" },
        { key: "chats", label: t("tabs.chats"), iconName: "chatbubbles-outline", iconNameActive: "chatbubbles", href: "/(tabs)/chats", badge: chatUnread },
        { key: "leaderboard", label: t("tabs.ranking"), iconName: "trophy-outline", iconNameActive: "trophy", href: "/(tabs)/leaderboard" },
      ]
    : [
        // Admin/Office
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
          backgroundColor: themeColors.surface,
          borderRightColor: themeColors.border,
        },
      ]}
    >
      {/* Logo + Collapse Toggle */}
      <View style={[styles.logoArea, { borderBottomColor: themeColors.border }]}>
        {!collapsed && (
          <View style={{ marginBottom: 12 }}>
            <BNMLogo size={48} showSubtitle={false} />
          </View>
        )}
        <BNMPressable
          onPress={toggleCollapsed}
          style={[styles.collapseBtn, { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(10,58,90,0.05)" }]}
          accessibilityRole="button"
          accessibilityLabel={collapsed ? "Sidebar ausklappen" : "Sidebar einklappen"}
        >
          <Ionicons
            name={collapsed ? "chevron-forward-outline" : "chevron-back-outline"}
            size={16}
            color={themeColors.textTertiary}
          />
        </BNMPressable>
      </View>

      {/* Sektions-Label */}
      {!collapsed && (
        <View style={styles.sectionLabelWrap}>
          <Text style={[styles.sectionLabel, { color: themeColors.textTertiary }]}>
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
      <View style={[styles.bottomArea, { borderTopColor: themeColors.border }]}>
        <SidebarItem
          key="profile"
          label={t("tabs.profile")}
          iconName="settings-outline"
          iconNameActive="settings"
          isActive={activeSegment === "profile"}
          onPress={() => router.push("/(tabs)/profile" as any)}
          collapsed={collapsed}
        />
        <BNMPressable
          style={[styles.logoutButton, collapsed && styles.logoutButtonCollapsed]}
          onPress={handleLogout}
          hapticStyle="warning"
          accessibilityRole="button"
          accessibilityLabel={t("sidebar.logout")}
          // @ts-ignore
          title={collapsed ? t("sidebar.logout") : undefined}
        >
          <View style={styles.logoutIconCircle}>
            <Ionicons name="log-out-outline" size={16} color={COLORS.error} />
          </View>
          {!collapsed && <Text style={styles.logoutLabel}>{t("sidebar.logout")}</Text>}
        </BNMPressable>
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
    width: 44,
    height: 44,
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
    backgroundColor: COLORS.error,
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
    backgroundColor: COLORS.error,
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
    borderRadius: RADIUS.xs,
    zIndex: 999,
    // @ts-ignore
    ...(Platform.OS === "web" ? { whiteSpace: "nowrap", pointerEvents: "none" } : {}),
  },
  tooltipText: {
    color: COLORS.white,
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
    color: COLORS.error,
    flex: 1,
    flexShrink: 1,
  },
});

