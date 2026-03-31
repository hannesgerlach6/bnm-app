import React, { useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import type { Notification, NotificationType } from "../types";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

function getTypeConfig(isDark: boolean): Record<NotificationType, { icon: string; bg: string; color: string }> {
  return {
    assignment: { icon: "👤", bg: isDark ? "#1e2d4a" : "#dbeafe", color: isDark ? "#93c5fd" : "#1d4ed8" },
    reminder:   { icon: "⏰", bg: isDark ? "#3a2e1a" : "#fef3c7", color: isDark ? "#fbbf24" : "#b45309" },
    progress:   { icon: "✅", bg: isDark ? "#1a3a2a" : "#dcfce7", color: isDark ? "#4ade80" : "#15803d" },
    message:    { icon: "✉", bg: isDark ? "#2e1a4a" : "#f3e8ff", color: isDark ? "#c084fc" : "#7e22ce" },
    feedback:   { icon: "⭐", bg: isDark ? "#3a2e1a" : "#fef3c7", color: isDark ? "#fbbf24" : "#b45309" },
    system:     { icon: "ℹ️", bg: isDark ? "#2a2d3a" : "#f3f4f6", color: isDark ? "#9ca3af" : "#4b5563" },
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const TYPE_CONFIG = getTypeConfig(isDark);
  const { notifications, feedback, markAsRead, markAllAsRead } = useData();
  const { user } = useAuth();

  // Feedback-Notifications ausblenden wenn Feedback bereits abgegeben
  const visibleNotifications = notifications.filter((n) => {
    if (n.type === "feedback" && n.related_id && user) {
      return !feedback.some(
        (f) => f.mentorship_id === n.related_id && f.submitted_by === user.id
      );
    }
    return true;
  });

  function timeAgo(isoDate: string): string {
    const diff = Date.now() - new Date(isoDate).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return t("notifications.minutesAgo").replace("{0}", String(minutes));
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t("notifications.hoursAgo").replace("{0}", String(hours));
    const days = Math.floor(hours / 24);
    return t("notifications.daysAgo").replace("{0}", String(days)).replace("{1}", days > 1 ? "en" : "");
  }

  const typeLabel = (type: NotificationType): string => {
    if (type === "assignment") return t("notifications.typeAssignment");
    if (type === "reminder") return t("notifications.typeReminder");
    if (type === "progress") return t("notifications.typeProgress");
    if (type === "feedback") return t("notifications.typeFeedback");
    if (type === "system") return t("notifications.typeSystem");
    return t("notifications.typeMessage");
  };

  const unreadCount = visibleNotifications.filter((n) => !n.read).length;
  const sorted = [...visibleNotifications].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  function handlePress(notification: Notification) {
    markAsRead(notification.id);
    if (notification.type === "feedback" && notification.related_id) {
      router.push({ pathname: "/feedback", params: { mentorshipId: notification.related_id } });
    } else if (notification.type === "assignment" && notification.related_id) {
      router.push({ pathname: "/mentorship/[id]", params: { id: notification.related_id } });
    }
  }

  const renderNotification = useCallback(({ item: notification }: { item: Notification }) => {
    const config = TYPE_CONFIG[notification.type];
    return (
      <TouchableOpacity
        style={[
          styles.notifCard,
          { backgroundColor: themeColors.card, borderColor: themeColors.border },
          !notification.read && [styles.notifCardUnread, {
            borderColor: isDark ? "#2d4a7a" : "#bfdbfe",
            backgroundColor: isDark ? "#1a1f2e" : "#f8faff",
          }],
        ]}
        onPress={() => handlePress(notification)}
      >
        {/* Unread dot */}
        {!notification.read && <View style={styles.unreadDot} />}

        <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
          <Text style={styles.iconEmoji}>{config.icon}</Text>
        </View>

        <View style={styles.notifContent}>
          <View style={styles.notifHeader}>
            <Text style={[styles.notifTitle, { color: themeColors.text }]} numberOfLines={1}>
              {notification.title}
            </Text>
            <Text style={[styles.notifTime, { color: themeColors.textTertiary }]}>
              {timeAgo(notification.created_at)}
            </Text>
          </View>
          <Text style={[styles.notifBody, { color: themeColors.textSecondary }]} numberOfLines={2}>
            {notification.body}
          </Text>
          <View style={[styles.typeBadge, { backgroundColor: config.bg }]}>
            <Text style={[styles.typeBadgeText, { color: config.color }]}>
              {typeLabel(notification.type)}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [TYPE_CONFIG, themeColors, isDark]);

  const listHeader = useCallback(() => (
    <>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 12 }]}>
        <View style={styles.headerLeft}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("common.back")}</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("notifications.title")}</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead}>
              <Text style={[styles.markAllText, { color: themeColors.link }]}>{t("notifications.markAll")}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {Platform.OS !== "web" && (
        <TouchableOpacity
          style={[styles.settingsLink, { borderBottomColor: themeColors.border }]}
          onPress={() => router.push("/notification-settings")}
        >
          <Ionicons name="settings-outline" size={16} color={themeColors.textSecondary} />
          <Text style={[styles.settingsLinkText, { color: themeColors.textSecondary }]}>{t("notifSettings.title")}</Text>
          <Text style={{ color: themeColors.textTertiary }}>›</Text>
        </TouchableOpacity>
      )}

      {unreadCount > 0 && (
        <View style={[styles.unreadBanner, {
          backgroundColor: isDark ? "#1e2d4a" : "#eff6ff",
          borderBottomColor: isDark ? "#2d4a7a" : "#dbeafe",
        }]}>
          <Text style={[styles.unreadBannerText, { color: isDark ? "#93c5fd" : "#1d4ed8" }]}>
            {t("notifications.unread").replace("{0}", String(unreadCount)).replace("{1}", unreadCount > 1 ? "en" : "")}
          </Text>
        </View>
      )}
    </>
  ), [themeColors, insets.top, unreadCount, isDark]);

  const listEmpty = useCallback(() => (
    <View style={styles.emptyBox}>
      <Ionicons name="notifications-outline" size={36} color={themeColors.textTertiary} style={{ marginBottom: 8 }} />
      <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{t("notifications.emptyTitle")}</Text>
      <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
        {t("notifications.emptyText")}
      </Text>
    </View>
  ), [themeColors]);

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        <FlatList
          data={sorted}
          renderItem={renderNotification}
          keyExtractor={keyExtractor}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={styles.list}
          style={styles.scrollView}
          removeClippedSubviews={true}
          windowSize={10}
        />
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    // paddingTop wird dynamisch via insets.top + 12 gesetzt
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerLeft: { flex: 1 },
  headerRight: { flex: 1, alignItems: "flex-end" },
  settingsLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1 },
  settingsLinkText: { flex: 1, fontSize: 13, fontWeight: "500" },
  backButton: { paddingVertical: 4 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "800", fontSize: 16 },
  markAllText: { fontSize: 13, fontWeight: "500" },
  unreadBanner: {
    borderBottomWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unreadBannerText: { fontSize: 13, fontWeight: "500" },
  scrollView: { flex: 1 },
  list: { padding: 24, gap: 12 },
  emptyBox: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontWeight: "800", fontSize: 18, marginBottom: 8 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  notifCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 18,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    position: "relative",
  },
  notifCardUnread: {
    // Colors applied dynamically via isDark
  },
  unreadDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.link,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconEmoji: { fontSize: 20 },
  notifContent: { flex: 1 },
  notifHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
    gap: 8,
  },
  notifTitle: {
    fontWeight: "800",
    fontSize: 14,
    flex: 1,
  },
  notifTime: { fontSize: 12, flexShrink: 0 },
  notifBody: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
});
