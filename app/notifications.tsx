import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../contexts/DataContext";
import type { Notification, NotificationType } from "../types";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";
import { useLanguage } from "../contexts/LanguageContext";

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: string; bg: string; color: string }
> = {
  assignment: { icon: "👤", bg: "#dbeafe", color: "#1d4ed8" },
  reminder: { icon: "⏰", bg: "#fef3c7", color: "#b45309" },
  progress: { icon: "✅", bg: "#dcfce7", color: "#15803d" },
  message: { icon: "💬", bg: "#f3e8ff", color: "#7e22ce" },
  feedback: { icon: "⭐", bg: "#fef3c7", color: "#b45309" },
  system: { icon: "ℹ️", bg: "#f3f4f6", color: "#4b5563" },
};

export default function NotificationsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { notifications, markAsRead, markAllAsRead } = useData();

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
    return t("notifications.typeMessage");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const sorted = [...notifications].sort(
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

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={styles.backText}>‹ {t("common.back")}</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.headerTitle}>{t("notifications.title")}</Text>
          <View style={styles.headerRight}>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={markAllAsRead}>
                <Text style={styles.markAllText}>{t("notifications.markAll")}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <Text style={styles.unreadBannerText}>
              {t("notifications.unread").replace("{0}", String(unreadCount)).replace("{1}", unreadCount > 1 ? "en" : "")}
            </Text>
          </View>
        )}

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.list}>
          {sorted.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyTitle}>{t("notifications.emptyTitle")}</Text>
              <Text style={styles.emptyText}>
                {t("notifications.emptyText")}
              </Text>
            </View>
          ) : (
            sorted.map((notification) => {
              const config = TYPE_CONFIG[notification.type];
              return (
                <TouchableOpacity
                  key={notification.id}
                  style={[
                    styles.notifCard,
                    !notification.read && styles.notifCardUnread,
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
                      <Text style={styles.notifTitle} numberOfLines={1}>
                        {notification.title}
                      </Text>
                      <Text style={styles.notifTime}>
                        {timeAgo(notification.created_at)}
                      </Text>
                    </View>
                    <Text style={styles.notifBody} numberOfLines={2}>
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
            })
          )}
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerLeft: { flex: 1 },
  headerRight: { flex: 1, alignItems: "flex-end" },
  backButton: { paddingVertical: 4 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  markAllText: { color: COLORS.link, fontSize: 13, fontWeight: "500" },
  unreadBanner: {
    backgroundColor: "#eff6ff",
    borderBottomWidth: 1,
    borderBottomColor: "#dbeafe",
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  unreadBannerText: { color: "#1d4ed8", fontSize: 13, fontWeight: "500" },
  scrollView: { flex: 1 },
  list: { padding: 16, gap: 12 },
  emptyBox: {
    marginTop: 60,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 18, marginBottom: 8 },
  emptyText: { color: COLORS.tertiary, fontSize: 14, textAlign: "center", lineHeight: 20 },
  notifCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    position: "relative",
  },
  notifCardUnread: {
    borderColor: "#bfdbfe",
    backgroundColor: "#f8faff",
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
    fontWeight: "700",
    color: COLORS.primary,
    fontSize: 14,
    flex: 1,
  },
  notifTime: { color: COLORS.tertiary, fontSize: 12, flexShrink: 0 },
  notifBody: { color: COLORS.secondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  typeBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "600" },
});
