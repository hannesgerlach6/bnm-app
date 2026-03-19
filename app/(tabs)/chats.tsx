import React, { useMemo, useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";

function formatTime(dateStr: string, yesterday: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) {
    return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  }
  if (diffDays === 1) return yesterday;
  if (diffDays < 7) return `${diffDays}d`;
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { mentorships, getMessagesByMentorshipId, getUnreadMessagesCount, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "office";
  const isMentor = user?.role === "mentor";
  const isMentee = user?.role === "mentee";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // Relevante Mentorships für den eingeloggten User
  const relevantMentorships = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return mentorships;
    if (isMentor) return mentorships.filter((m) => m.mentor_id === user.id);
    if (isMentee) return mentorships.filter((m) => m.mentee_id === user.id);
    return [];
  }, [mentorships, user, isAdmin, isMentor, isMentee]);

  // Chats sortiert nach letzter Nachricht
  const chatList = useMemo(() => {
    return relevantMentorships
      .map((m) => {
        const msgs = getMessagesByMentorshipId(m.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const unread = getUnreadMessagesCount(m.id);
        return { mentorship: m, lastMsg, unread };
      })
      .sort((a, b) => {
        if (!a.lastMsg && !b.lastMsg) return 0;
        if (!a.lastMsg) return 1;
        if (!b.lastMsg) return -1;
        return (
          new Date(b.lastMsg.created_at).getTime() -
          new Date(a.lastMsg.created_at).getTime()
        );
      });
  }, [relevantMentorships, getMessagesByMentorshipId, getUnreadMessagesCount]);

  const totalUnread = useMemo(
    () => chatList.reduce((sum, c) => sum + c.unread, 0),
    [chatList]
  );

  function getChatTitle(m: typeof relevantMentorships[0]) {
    if (isMentee) {
      return m.mentor?.name ?? t("chats.unknownMentor");
    }
    if (isMentor) {
      return m.mentee?.name ?? t("chats.unknownMentee");
    }
    // Admin/Office: beide Namen zeigen
    return `${m.mentor?.name ?? "?"} ↔ ${m.mentee?.name ?? "?"}`;
  }

  function getChatSubtitle(m: typeof relevantMentorships[0]) {
    if (isMentee && m.mentor) {
      return `${t("chats.mentor")}: ${m.mentor.city}`;
    }
    if (isMentor && m.mentee) {
      return `${t("chats.mentee")}: ${m.mentee.city}`;
    }
    return m.status === "active"
      ? t("chats.statusActive")
      : m.status === "completed"
      ? t("chats.statusCompleted")
      : t("chats.statusCancelled");
  }

  return (
    <Container>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        <View style={styles.page}>
          <Text style={styles.pageTitle}>{t("chats.title")}</Text>
          {totalUnread > 0 && (
            <Text style={styles.pageSubtitle}>
              {t("chats.unreadHint").replace("{0}", String(totalUnread))}
            </Text>
          )}

          {chatList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyTitle}>{t("chats.noChats")}</Text>
              <Text style={styles.emptyText}>{t("chats.noChatsText")}</Text>
            </View>
          ) : (
            <View style={styles.listCard}>
              {chatList.map((item, idx) => {
                const { mentorship: m, lastMsg, unread } = item;
                const isActive = m.status === "active";
                return (
                  <TouchableOpacity
                    key={m.id}
                    style={[
                      styles.chatRow,
                      idx < chatList.length - 1 ? styles.chatRowBorder : {},
                    ]}
                    onPress={() =>
                      router.push({
                        pathname: "/chat/[mentorshipId]",
                        params: { mentorshipId: m.id },
                      })
                    }
                  >
                    {/* Avatar-Kreis */}
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: isActive ? COLORS.gradientStart : COLORS.border },
                      ]}
                    >
                      <Text style={styles.avatarText}>
                        {getChatTitle(m).charAt(0).toUpperCase()}
                      </Text>
                    </View>

                    {/* Inhalt */}
                    <View style={styles.chatInfo}>
                      <View style={styles.chatTopRow}>
                        <Text style={styles.chatName} numberOfLines={1}>
                          {getChatTitle(m)}
                        </Text>
                        {lastMsg && (
                          <Text style={styles.chatTime}>
                            {formatTime(lastMsg.created_at, t("chats.yesterday"))}
                          </Text>
                        )}
                      </View>
                      <View style={styles.chatBottomRow}>
                        <Text style={styles.chatSub} numberOfLines={1}>
                          {lastMsg
                            ? lastMsg.content
                            : getChatSubtitle(m)}
                        </Text>
                        {unread > 0 && (
                          <View style={styles.unreadBadge}>
                            <Text style={styles.unreadText}>
                              {unread > 9 ? "9+" : String(unread)}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 4,
  },
  pageSubtitle: {
    color: COLORS.secondary,
    fontSize: 13,
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 40,
    alignItems: "center",
    marginTop: 24,
  },
  emptyIcon: { fontSize: 40, marginBottom: 12 },
  emptyTitle: {
    fontWeight: "700",
    color: COLORS.primary,
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    color: COLORS.secondary,
    fontSize: 13,
    textAlign: "center",
  },
  listCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  chatRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 18,
  },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  chatName: {
    fontWeight: "600",
    color: COLORS.primary,
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    color: COLORS.tertiary,
    fontSize: 12,
    flexShrink: 0,
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatSub: {
    color: COLORS.secondary,
    fontSize: 13,
    flex: 1,
    marginRight: 8,
  },
  unreadBadge: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 9999,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },
});
