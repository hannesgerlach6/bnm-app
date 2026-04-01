import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter, usePathname } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS, SHADOWS } from "../constants/Colors";

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

  const isOffice = user?.role === "office";
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

  const navItems = [
    {
      key: "/",
      label: t("tabs.dashboard"),
      icon: "grid-outline" as const,
      iconActive: "grid" as const,
      href: "/(tabs)/",
    },
    {
      key: "/mentees",
      label: t("tabs.mentees"),
      icon: "people-outline" as const,
      iconActive: "people" as const,
      href: "/(tabs)/mentees",
    },
    {
      key: "/mentors",
      label: t("sidebar.mentors"),
      icon: "school-outline" as const,
      iconActive: "school" as const,
      href: "/(tabs)/mentors",
    },
    {
      key: "/applications",
      label: t("sidebar.applications"),
      icon: "document-text-outline" as const,
      iconActive: "document-text" as const,
      href: "/(tabs)/applications",
    },
    ...(!isOffice
      ? [
          {
            key: "/chats",
            label: t("tabs.chats"),
            icon: "chatbubbles-outline" as const,
            iconActive: "chatbubbles" as const,
            href: "/(tabs)/chats",
            badge: chatUnread,
          },
        ]
      : []),
    {
      key: "/tools",
      label: "Tools",
      icon: "construct-outline" as const,
      iconActive: "construct" as const,
      href: "/(tabs)/tools",
    },
    {
      key: "/reports",
      label: t("tabs.reports"),
      icon: "stats-chart-outline" as const,
      iconActive: "stats-chart" as const,
      href: "/(tabs)/reports",
    },
    {
      key: "/feedback",
      label: t("tabs.feedback"),
      icon: "star-outline" as const,
      iconActive: "star" as const,
      href: "/(tabs)/feedback",
    },
    {
      key: "/profile",
      label: t("tabs.profile"),
      icon: "person-circle-outline" as const,
      iconActive: "person-circle" as const,
      href: "/(tabs)/profile",
    },
  ];

  function isActive(key: string) {
    if (key === "/") return pathname === "/" || pathname === "/index";
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
          <View>
            <Text style={styles.drawerBrand}>BNM</Text>
            <Text style={[styles.drawerRole, { color: themeColors.textSecondary }]}>
              {user?.role === "admin" ? t("profile.roleAdmin") : t("profile.roleOffice")}
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Menü schließen"
          >
            <Ionicons name="close" size={22} color={themeColors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Navigation */}
        <ScrollView style={styles.navList} showsVerticalScrollIndicator={false}>
          {navItems.map((item) => {
            const active = isActive(item.key);
            return (
              <TouchableOpacity
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
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutBtn, { borderTopColor: themeColors.border }]}
          onPress={logout}
          accessibilityRole="button"
          accessibilityLabel={t("sidebar.logout")}
        >
          <Ionicons name="log-out-outline" size={18} color="#EF5350" />
          <Text style={styles.logoutLabel}>{t("sidebar.logout")}</Text>
        </TouchableOpacity>
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
    borderRadius: 8,
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
    borderRadius: 9999,
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
    color: "#EF5350",
    fontWeight: "600",
    fontSize: 14,
  },
});
