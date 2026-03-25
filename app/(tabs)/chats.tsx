import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Platform,
  TextInput,
  Alert,
  useWindowDimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { showError } from "../../lib/errorHandler";

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

// ─── Inline Chat Panel (für Zwei-Spalten-Layout auf Web) ─────────────────────

function ChatPanel({ mentorshipId }: { mentorshipId: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const {
    getMessagesByMentorshipId,
    getMentorshipById,
    sendMessage,
    deleteMessage,
    markChatAsRead,
  } = useData();

  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  const mentorship = getMentorshipById(mentorshipId);
  const messages = getMessagesByMentorshipId(mentorshipId);

  useEffect(() => {
    markChatAsRead(mentorshipId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentorshipId, markChatAsRead, messages.length]);

  async function handleSend() {
    if (!inputText.trim() || !user || !mentorshipId) return;
    const content = inputText.trim();
    setInputText("");
    try {
      await sendMessage(mentorshipId, user.id, content);
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch {
      setInputText(content);
      showError(t("chat.sendError"));
    }
  }

  async function handleLongPress(messageId: string, isOwn: boolean) {
    if (!isOwn) return;
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(
        t("chat.deleteConfirmTitle"),
        t("chat.deleteConfirmText"),
        [
          { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
          { text: t("common.confirm"), onPress: () => resolve(true) },
        ]
      );
    });
    if (!ok) return;
    try {
      await deleteMessage(messageId);
    } catch {
      showError(t("chat.deleteError"));
    }
  }

  if (!user) return null;

  const chatPartnerName =
    user.id === mentorship?.mentor_id
      ? mentorship?.mentee?.name
      : mentorship?.mentor?.name;

  const statusLabel =
    mentorship?.status === "active"
      ? t("chat.active")
      : mentorship?.status === "completed"
      ? t("chat.completed")
      : mentorship?.status === "pending_approval"
      ? t("mentees.pendingApproval")
      : t("chat.cancelled");

  return (
    <View style={panelStyles.container}>
      {/* Chat-Header */}
      {mentorship && (
        <View style={[panelStyles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <Text style={[panelStyles.headerName, { color: themeColors.text }]}>{chatPartnerName}</Text>
          <Text style={[panelStyles.headerSub, { color: themeColors.textTertiary }]}>
            {t("chat.mentorship")} · {statusLabel}
          </Text>
        </View>
      )}

      {/* Nachrichten */}
      <ScrollView
        ref={scrollViewRef}
        style={panelStyles.messagesScroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: false })
        }
      >
        {messages.length === 0 ? (
          <View style={panelStyles.emptyMessages}>
            <Text style={[panelStyles.emptyText, { color: themeColors.textTertiary }]}>
              {t("chat.noMessages")}
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user.id;
            const sender =
              msg.sender ??
              (isOwn ? { name: user.name } : { name: chatPartnerName ?? "?" });

            const timeStr = new Date(msg.created_at).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <View
                key={msg.id}
                style={[
                  panelStyles.bubbleWrapper,
                  isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                ]}
              >
                {!isOwn && (
                  <Text style={[panelStyles.senderName, { color: themeColors.textTertiary }]}>{sender.name}</Text>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => handleLongPress(msg.id, isOwn)}
                  delayLongPress={500}
                >
                  <View
                    style={[
                      panelStyles.bubble,
                      isOwn
                        ? panelStyles.ownBubble
                        : [panelStyles.otherBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                    ]}
                  >
                    <Text
                      style={[
                        panelStyles.messageText,
                        isOwn ? { color: COLORS.white } : { color: themeColors.text },
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text
                  style={[
                    panelStyles.timeText,
                    { color: themeColors.textTertiary },
                    isOwn ? { textAlign: "right", marginRight: 4 } : { marginLeft: 4 },
                  ]}
                >
                  {timeStr}
                </Text>
              </View>
            );
          })
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Input-Bereich */}
      {user?.role === "admin" || user?.role === "office" ? (
        <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          <Text style={[panelStyles.inactiveHint, { color: themeColors.textTertiary }]}>
            {t("chat.adminReadOnly")}
          </Text>
        </View>
      ) : mentorship && (mentorship.status === "active" || mentorship.status === "completed") ? (
        <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          <TextInput
            style={[panelStyles.textInput, { backgroundColor: themeColors.elevated, borderColor: themeColors.border, color: themeColors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              panelStyles.sendButton,
              { backgroundColor: inputText.trim() ? themeColors.primary : themeColors.border },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          <Text style={[panelStyles.inactiveHint, { color: themeColors.textTertiary }]}>
            {t("chat.notActiveHint")}
          </Text>
        </View>
      )}
    </View>
  );
}

const panelStyles = StyleSheet.create({
  container: { flex: 1, flexDirection: "column" },
  header: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerName: { fontWeight: "600", textAlign: "center", fontSize: 15 },
  headerSub: { fontSize: 12, textAlign: "center", marginTop: 2 },
  messagesScroll: { flex: 1 },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyText: { textAlign: "center", fontSize: 14 },
  bubbleWrapper: { marginBottom: 10, maxWidth: "80%" },
  senderName: { fontSize: 11, marginBottom: 3, marginLeft: 12, opacity: 0.7 },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  ownBubble: {
    backgroundColor: COLORS.gradientStart,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  timeText: { fontSize: 11, marginTop: 3, opacity: 0.6 },
  inputContainer: {
    borderTopWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveHint: { flex: 1, textAlign: "center", fontSize: 13, paddingVertical: 4 },
});

// ─── Chats Screen ─────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const { mentorships, getMessagesByMentorshipId, getUnreadMessagesCount, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Zwei-Spalten-Layout nur auf Web bei ausreichend Breite
  const isWideWeb = Platform.OS === "web" && width > 768;

  const isAdmin = user?.role === "admin" || user?.role === "office";
  const isMentor = user?.role === "mentor";
  const isMentee = user?.role === "mentee";

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

  // Relevante Mentorships für den eingeloggten User
  const relevantMentorships = useMemo(() => {
    if (!user) return [];
    const activeMentorships = (list: typeof mentorships) =>
      list.filter((m) => m.status === "active" || m.status === "completed");
    if (isAdmin) return mentorships;
    if (isMentor) return activeMentorships(mentorships.filter((m) => m.mentor_id === user.id));
    if (isMentee) return activeMentorships(mentorships.filter((m) => m.mentee_id === user.id));
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

  // Gefilterte Chat-Liste (Suchfeld)
  const filteredChatList = useMemo(() => {
    if (!searchQuery.trim()) return chatList;
    const q = searchQuery.trim().toLowerCase();
    return chatList.filter((item) =>
      getChatTitle(item.mentorship).toLowerCase().includes(q)
    );
  }, [chatList, searchQuery]);

  const totalUnread = useMemo(
    () => chatList.reduce((sum, c) => sum + c.unread, 0),
    [chatList]
  );

  function getChatTitle(m: typeof relevantMentorships[0]) {
    if (isMentee) return m.mentor?.name ?? t("chats.unknownMentor");
    if (isMentor) return m.mentee?.name ?? t("chats.unknownMentee");
    return `${m.mentor?.name ?? "?"} ↔ ${m.mentee?.name ?? "?"}`;
  }

  function getChatSubtitle(m: typeof relevantMentorships[0]) {
    if (isMentee && m.mentor) return `${t("chats.mentor")}: ${m.mentor.city}`;
    if (isMentor && m.mentee) return `${t("chats.mentee")}: ${m.mentee.city}`;
    return m.status === "active"
      ? t("chats.statusActive")
      : m.status === "completed"
      ? t("chats.statusCompleted")
      : m.status === "pending_approval"
      ? t("mentees.pendingApproval")
      : t("chats.statusCancelled");
  }

  // ── Chat-Liste-Inhalt (geteilt zwischen Mobile und linker Spalte) ──────────

  function renderChatList() {
    return (
      <>
        {/* Suchfeld */}
        <View style={[styles.searchWrapper, { backgroundColor: themeColors.card, borderColor: isDark ? "#2A2A35" : themeColors.border }]}>
          <Ionicons name="search-outline" size={16} color={themeColors.textTertiary} />
          <TextInput
            style={[styles.searchInput, { color: themeColors.text }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder={t("chats.search") ?? "Suchen..."}
            placeholderTextColor={themeColors.textTertiary}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color={themeColors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Zähler */}
        <View style={styles.counters}>
          <View style={styles.counterItem}>
            <Text style={[styles.counterLabel, { color: themeColors.textSecondary }]}>{t("chats.total") ?? "Gesamt"}:</Text>
            <Text style={[styles.counterValue, { color: COLORS.gold }]}>{chatList.length}</Text>
          </View>
          <View style={styles.counterItem}>
            <Text style={[styles.counterLabel, { color: themeColors.textSecondary }]}>{t("chats.unread") ?? "Ungelesen"}:</Text>
            <Text style={[styles.counterValue, { color: COLORS.gold }]}>{totalUnread}</Text>
          </View>
        </View>

        {/* Chat-Einträge */}
        {filteredChatList.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Ionicons name="chatbubbles-outline" size={40} color={themeColors.textTertiary} style={styles.emptyIcon} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>{t("chats.noChats")}</Text>
            <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t("chats.noChatsText")}</Text>
          </View>
        ) : (
          <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#2A2A35" : themeColors.border }]}>
            {filteredChatList.map((item, idx) => {
              const { mentorship: m, lastMsg, unread } = item;
              const isActive = m.status === "active";
              const isSelected = isWideWeb && selectedChatId === m.id;
              return (
                <TouchableOpacity
                  key={m.id}
                  style={[
                    styles.chatRow,
                    idx < filteredChatList.length - 1 ? { borderBottomWidth: 1, borderBottomColor: isDark ? "#2A2A35" : themeColors.border } : {},
                    isSelected ? { backgroundColor: isDark ? "#1E1E2C" : "#F0F4FF" } : {},
                  ]}
                  onPress={() => {
                    if (isWideWeb) {
                      setSelectedChatId(m.id);
                    } else {
                      router.push({
                        pathname: "/chat/[mentorshipId]",
                        params: { mentorshipId: m.id },
                      });
                    }
                  }}
                >
                  {/* Avatar */}
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: isActive ? COLORS.gradientStart : themeColors.border },
                    ]}
                  >
                    <Text style={styles.avatarText}>
                      {getChatTitle(m).charAt(0).toUpperCase()}
                    </Text>
                  </View>

                  {/* Inhalt */}
                  <View style={styles.chatInfo}>
                    <View style={styles.chatTopRow}>
                      <Text style={[styles.chatName, { color: themeColors.text }]} numberOfLines={1}>
                        {getChatTitle(m)}
                      </Text>
                      {lastMsg && (
                        <Text style={[styles.chatTime, { color: themeColors.textTertiary }]}>
                          {formatTime(lastMsg.created_at, t("chats.yesterday"))}
                        </Text>
                      )}
                    </View>
                    <View style={styles.chatBottomRow}>
                      <Text
                        style={[styles.chatSub, { color: themeColors.textSecondary }]}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                      >
                        {lastMsg ? lastMsg.content : getChatSubtitle(m)}
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
      </>
    );
  }

  // ── Zwei-Spalten-Layout (Web, breit) ─────────────────────────────────────

  if (isWideWeb) {
    return (
      <View style={[styles.twoColContainer, { backgroundColor: themeColors.background }]}>
        {/* Linke Spalte: Chat-Liste */}
        <View style={[styles.leftPanel, { borderRightColor: isDark ? "#2A2A35" : themeColors.border }]}>
          <ScrollView
            style={[styles.leftScroll, { backgroundColor: themeColors.background }]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold}
              />
            }
          >
            <View style={styles.leftContent}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("chats.title")}</Text>
              {renderChatList()}
            </View>
          </ScrollView>
        </View>

        {/* Rechte Spalte: Chat-Inhalt */}
        <View style={[styles.rightPanel, { backgroundColor: themeColors.background }]}>
          {selectedChatId ? (
            <ChatPanel mentorshipId={selectedChatId} />
          ) : (
            <View style={styles.noChatSelected}>
              <Ionicons name="chatbubbles-outline" size={56} color={themeColors.textTertiary} />
              <Text style={[styles.noChatText, { color: themeColors.textTertiary }]}>
                {t("chats.selectChat") ?? "Wähle einen Chat aus"}
              </Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  // ── Mobile / schmales Layout ──────────────────────────────────────────────

  return (
    <Container>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("chats.title")}</Text>
          {totalUnread > 0 && (
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              {t("chats.unreadHint").replace("{0}", String(totalUnread))}
            </Text>
          )}
          {renderChatList()}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  // Mobile Layout
  scrollView: { flex: 1 },
  page: { padding: 20 },
  pageTitle: {
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 16,
  },
  pageSubtitle: {
    fontSize: 13,
    marginBottom: 16,
  },

  // Zwei-Spalten-Layout
  twoColContainer: {
    flex: 1,
    flexDirection: "row",
  },
  leftPanel: {
    width: "40%",
    borderRightWidth: 1,
  },
  leftScroll: {
    flex: 1,
  },
  leftContent: {
    padding: 20,
  },
  rightPanel: {
    flex: 1,
  },
  noChatSelected: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  noChatText: {
    fontSize: 15,
    textAlign: "center",
  },

  // Suchfeld
  searchWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },

  // Zähler
  counters: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 12,
  },
  counterItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  counterLabel: {
    fontSize: 13,
  },
  counterValue: {
    fontSize: 14,
    fontWeight: "700",
  },

  // Leerer Zustand
  emptyCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: {
    fontWeight: "700",
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },

  // Chat-Liste
  listCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
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
    fontSize: 15,
    flex: 1,
    marginRight: 8,
  },
  chatTime: {
    fontSize: 12,
    flexShrink: 0,
  },
  chatBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  chatSub: {
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
