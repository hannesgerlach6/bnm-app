import React, { useMemo, useCallback, useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  RefreshControl,
  StyleSheet,
  Platform,
  TextInput,
  KeyboardAvoidingView,
  useWindowDimensions,
  Animated,
  Modal,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, RADIUS, TYPOGRAPHY, SHADOWS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { showError, showConfirm } from "../../lib/errorHandler";
import { usePageTitle } from "../../hooks/usePageTitle";
import { EmptyState } from "../../components/EmptyState";

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
    messageTemplates,
    getUserById,
  } = useData();

  const [inputText, setInputText] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  const isMentor = user?.role === "mentor";
  const mentorship = getMentorshipById(mentorshipId);
  const menteeUser = mentorship ? getUserById(mentorship.mentee_id) : null;
  const chatTemplates = useMemo(() =>
    messageTemplates.filter(t => !t.title.startsWith("[E-Mail]") && t.is_active),
    [messageTemplates]
  );
  const flatListRef = useRef<FlatList>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const fabOpacity = useRef(new Animated.Value(0)).current;

  // Scroll-Position tracken für FAB (inverted FlatList: offset 0 = unten)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    const shouldShow = contentOffset.y > 150;
    if (shouldShow !== showScrollFab) {
      setShowScrollFab(shouldShow);
      Animated.timing(fabOpacity, {
        toValue: shouldShow ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [showScrollFab]);

  const messages = getMessagesByMentorshipId(mentorshipId);
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

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
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch {
      setInputText(content);
      showError(t("chat.sendError"));
    }
  }

  async function handleLongPress(messageId: string, isOwn: boolean) {
    if (!isOwn) return;
    const ok = await showConfirm(t("chat.deleteConfirmTitle"), t("chat.deleteConfirmText"));
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
    <KeyboardAvoidingView
      style={panelStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
    >
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
      <View style={{ flex: 1 }}>
        {messages.length === 0 ? (
          <View style={[panelStyles.messagesScroll, { justifyContent: "center" }]}>
            <EmptyState
              icon="chatbubbles-outline"
              title={t("chat.noMessages")}
              description="Starte die Konversation mit einer Nachricht."
              compact
            />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={reversedMessages}
            keyExtractor={(item) => item.id}
            inverted={true}
            removeClippedSubviews={true}
            style={panelStyles.messagesScroll}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
            renderItem={({ item: msg, index }) => {
              const isOwn = msg.sender_id === user!.id;
              const sender =
                msg.sender ??
                (isOwn ? { name: user!.name } : { name: chatPartnerName ?? "?" });

              const senderRole = (msg.sender as any)?.role;
              const isThirdParty = !isOwn
                && msg.sender_id !== mentorship?.mentor_id
                && msg.sender_id !== mentorship?.mentee_id;
              const displayName =
                senderRole === "admin" ? "Admin" :
                senderRole === "office" ? "Office" :
                isThirdParty ? "Admin" :
                sender.name ?? chatPartnerName ?? "?";

              const msgDate = new Date(msg.created_at);
              const timeStr = msgDate.toLocaleTimeString("de-DE", {
                hour: "2-digit",
                minute: "2-digit",
              });

              // In inverted list: index 0 = neueste, index+1 = ältere Nachricht
              // "Vorherige" im chronologischen Sinn = nächsthöherer Index
              const prevMsg = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
              const prevDate = prevMsg ? new Date(prevMsg.created_at) : null;

              // Timestamp-Separator: erste Nachricht, >15 Min Abstand, oder Datumswechsel
              const showTimeSeparator = !prevDate
                || (msgDate.getTime() - prevDate.getTime() > 15 * 60 * 1000)
                || msgDate.toDateString() !== prevDate.toDateString();

              // Nachrichtengruppe: gleicher Sender, kein Separator dazwischen
              const isContinuation = prevMsg
                && prevMsg.sender_id === msg.sender_id
                && !showTimeSeparator;

              // Datum-Separator formatieren
              const dateSepLabel = showTimeSeparator ? (() => {
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                if (msgDate.toDateString() === today.toDateString()) return timeStr;
                if (msgDate.toDateString() === yesterday.toDateString()) return `Gestern, ${timeStr}`;
                return `${msgDate.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}, ${timeStr}`;
              })() : null;

              return (
                <React.Fragment key={msg.id}>
                  {/* Timestamp-Separator (erscheint VOR der Nachricht, in inverted = darunter) */}
                  {showTimeSeparator && (
                    <View style={panelStyles.timeSeparator}>
                      <Text style={[panelStyles.timeSeparatorText, { color: themeColors.textTertiary }]}>
                        {dateSepLabel}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      panelStyles.bubbleWrapper,
                      isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                      isContinuation && { marginTop: -4 },
                    ]}
                  >
                    {/* Sender-Name nur beim ersten in der Gruppe */}
                    {!isOwn && !isContinuation && (
                      <Text style={[panelStyles.senderName, { color: themeColors.textTertiary }]}>{displayName}</Text>
                    )}
                    <BNMPressable
                      activeOpacity={0.8}
                      onLongPress={() => handleLongPress(msg.id, isOwn)}
                      delayLongPress={500}
                      accessibilityRole="button"
                      accessibilityLabel={`Nachricht von ${displayName}: ${msg.content}`}
                    >
                      <View
                        style={[
                          panelStyles.bubble,
                          isOwn
                            ? panelStyles.ownBubble
                            : [panelStyles.otherBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                          isContinuation && isOwn && { borderTopRightRadius: RADIUS.lg },
                          isContinuation && !isOwn && { borderTopLeftRadius: RADIUS.lg },
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
                    </BNMPressable>
                  </View>
                </React.Fragment>
              );
            }}
          />
        )}

        {/* Scroll-to-Bottom FAB */}
        {showScrollFab && (
          <Animated.View style={[panelStyles.scrollFab, { opacity: fabOpacity }]}>
            <BNMPressable
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={[panelStyles.scrollFabBtn, { backgroundColor: themeColors.card, ...SHADOWS.md }]}
              accessibilityRole="button"
              accessibilityLabel="Nach unten scrollen"
            >
              <Ionicons name="chevron-down" size={20} color={themeColors.text} />
            </BNMPressable>
          </Animated.View>
        )}
      </View>

      {/* Template Modal */}
      <Modal visible={showTemplateModal} transparent animationType="fade" onRequestClose={() => setShowTemplateModal(false)}>
        <BNMPressable style={panelStyles.modalOverlay} onPress={() => setShowTemplateModal(false)}>
          <View style={[panelStyles.modalContent, { backgroundColor: themeColors.card }]}>
            <Text style={[panelStyles.modalTitle, { color: themeColors.text }]}>Vorlage waehlen</Text>
            <ScrollView style={{ maxHeight: 300 }}>
              {chatTemplates.map((tmpl) => (
                <BNMPressable
                  key={tmpl.id}
                  style={[panelStyles.templateCard, { borderBottomColor: themeColors.border }]}
                  onPress={() => {
                    let text = tmpl.body;
                    text = text.replace(/\{name\}/g, menteeUser?.name || "");
                    text = text.replace(/\{mentee_name\}/g, menteeUser?.name || "");
                    text = text.replace(/\{mentor_name\}/g, user?.name || "");
                    setInputText(text);
                    setShowTemplateModal(false);
                  }}
                >
                  <Text style={[panelStyles.templateTitle, { color: themeColors.text }]}>{tmpl.title}</Text>
                  <Text style={[panelStyles.templateBody, { color: themeColors.textTertiary }]} numberOfLines={2}>{tmpl.body}</Text>
                </BNMPressable>
              ))}
            </ScrollView>
          </View>
        </BNMPressable>
      </Modal>

      {/* Input-Bereich */}
      {mentorship && (mentorship.status === "active" || mentorship.status === "completed") ? (
        <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          {isMentor && chatTemplates.length > 0 && (
            <BNMPressable
              style={[panelStyles.templateButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setShowTemplateModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Nachrichtenvorlage"
            >
              <Ionicons name="document-text-outline" size={20} color={COLORS.gold} />
            </BNMPressable>
          )}
          <TextInput
            style={[panelStyles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            returnKeyType="default"
          />
          <BNMPressable
            style={[
              panelStyles.sendButton,
              { backgroundColor: COLORS.primary, opacity: inputText.trim() ? 1 : 0.35 },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
            accessibilityRole="button"
            accessibilityLabel="Nachricht senden"
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </BNMPressable>
        </View>
      ) : (
        <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
          <Text style={[panelStyles.inactiveHint, { color: themeColors.textTertiary }]}>
            {t("chat.notActiveHint")}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
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
  bubbleWrapper: { marginBottom: 6, maxWidth: "80%" },
  senderName: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 3, marginLeft: 12, fontWeight: TYPOGRAPHY.weight.medium },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg },
  ownBubble: {
    backgroundColor: COLORS.gradientStart,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    borderWidth: 1,
    borderTopLeftRadius: 4,
  },
  messageText: { fontSize: TYPOGRAPHY.size.base, lineHeight: TYPOGRAPHY.lineHeight.relaxed },
  timeSeparator: {
    alignItems: "center",
    marginVertical: 16,
  },
  timeSeparatorText: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.medium,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  scrollFab: {
    position: "absolute",
    bottom: 12,
    right: 16,
    zIndex: 10,
  },
  scrollFabBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
  },
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
    borderRadius: RADIUS.xl,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveHint: { flex: 1, textAlign: "center", fontSize: 13, paddingVertical: 4 },
  timeText: { fontSize: 10, marginTop: 2 },
  templateButton: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    borderRadius: RADIUS.lg,
    padding: 20,
    width: "90%",
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  templateCard: {
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  templateTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  templateBody: {
    fontSize: 12,
  },
});

// ─── Admin-DM Chat Panel ──────────────────────────────────────────────────────

function AdminChatPanel({ userId, adminId }: { userId: string; adminId?: string }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const {
    getAdminMessagesByUserId,
    sendAdminMessage,
    replyToAdmin,
    markAdminChatAsRead,
    users: allUsers,
  } = useData();

  const [inputText, setInputText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const messages = getAdminMessagesByUserId(userId);
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);
  const chatPartner = allUsers.find((u) => u.id === userId);

  const isAdmin = user?.role === "admin" || user?.role === "office";

  // Badge löschen: Admin-DMs als gelesen markieren wenn der Chat geöffnet wird
  useEffect(() => {
    if (!isAdmin) {
      markAdminChatAsRead(userId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, isAdmin, messages.length]);

  async function handleSend() {
    if (!inputText.trim() || !user) return;
    const content = inputText.trim();
    setInputText("");
    try {
      if (isAdmin) {
        await sendAdminMessage(userId, content);
      } else if (adminId) {
        await replyToAdmin(adminId, content);
      }
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch {
      setInputText(content);
      showError(t("chat.sendError"));
    }
  }

  if (!user) return null;

  return (
    <KeyboardAvoidingView
      style={panelStyles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
    >
      {/* Header */}
      <View style={[panelStyles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
        <Text style={[panelStyles.headerName, { color: themeColors.text }]}>
          {isAdmin ? (chatPartner?.name ?? "?") : "Admin"}
        </Text>
        <Text style={[panelStyles.headerSub, { color: themeColors.textTertiary }]}>
          {t("chats.adminDM") ?? "Direktnachricht"}
        </Text>
      </View>

      {/* Nachrichten */}
      {messages.length === 0 ? (
        <View style={[panelStyles.messagesScroll, { justifyContent: "center" }]}>
          <EmptyState
            icon="chatbubbles-outline"
            title={t("chat.noMessages")}
            description="Starte die Konversation mit einer Nachricht."
            compact
          />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={reversedMessages}
          keyExtractor={(item) => item.id}
          inverted={true}
          removeClippedSubviews={true}
          style={panelStyles.messagesScroll}
          contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
          renderItem={({ item: msg }) => {
            const isOwn = msg.sender_id === user!.id;
            const senderName = msg.sender?.name ?? (isOwn ? user!.name : "?");

            const timeStr = new Date(msg.created_at).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <View
                style={[
                  panelStyles.bubbleWrapper,
                  isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                ]}
              >
                {!isOwn && (
                  <Text style={[panelStyles.senderName, { color: themeColors.textTertiary }]}>{senderName}</Text>
                )}
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
          }}
        />
      )}

      {/* Input */}
      <View style={[panelStyles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <TextInput
          style={[panelStyles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={t("chat.placeholder")}
          placeholderTextColor={themeColors.textTertiary}
          multiline
          returnKeyType="default"
        />
        <BNMPressable
          style={[
            panelStyles.sendButton,
            { backgroundColor: COLORS.primary, opacity: inputText.trim() ? 1 : 0.35 },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
          accessibilityRole="button"
          accessibilityLabel="Nachricht senden"
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </BNMPressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Chats Screen ─────────────────────────────────────────────────────────────

export default function ChatsScreen() {
  usePageTitle("Chats");
  const router = useRouter();
  const params = useLocalSearchParams<{ openChat?: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width } = useWindowDimensions();
  const {
    mentorships,
    getMessagesByMentorshipId,
    getUnreadMessagesCount,
    refreshData,
    adminMessages,
    getAdminMessagesByUserId,
    getAdminChatPartners,
    markAdminChatAsRead,
    users: allUsers,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // Default: Mentor/Mentee sehen Betreuungs-Chats, Admin sieht Admin-DMs
  const isAdminRole = user?.role === "admin" || user?.role === "office";
  const [chatTab, setChatTab] = useState<"admin" | "mentorship">(isAdminRole ? "admin" : "mentorship");
  const [selectedAdminUserId, setSelectedAdminUserId] = useState<string | null>(null);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState<"all" | "mentor" | "mentee">("all");

  // Wenn von einem anderen Screen mit openChat-Parameter navigiert wird
  useEffect(() => {
    if (params.openChat && Platform.OS === "web") {
      setSelectedChatId(params.openChat);
    }
  }, [params.openChat]);

  // Mentor/Mentee: Admin-DMs automatisch als gelesen markieren wenn Chat-Tab geöffnet wird
  useEffect(() => {
    if (!user || user.role === "admin" || user.role === "office") return;
    markAdminChatAsRead(user.id);
  }, [user?.id, user?.role, markAdminChatAsRead, adminMessages.length]);

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

  // useFocusEffect refreshData entfernt — Realtime-Subscriptions reichen für Live-Updates.
  // Pull-to-Refresh ist als manueller Fallback vorhanden.

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

  // ── Admin-DM Chat-Liste ──────────────────────────────────────────────────────

  const adminChatList = useMemo(() => {
    if (!user) return [];
    if (isAdmin) {
      // Admin sieht alle User mit denen er Nachrichten hat
      const partnerIds = getAdminChatPartners();
      return partnerIds.map((uid) => {
        const msgs = getAdminMessagesByUserId(uid);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const partner = allUsers.find((u) => u.id === uid);
        return { userId: uid, adminId: undefined as string | undefined, name: partner?.name ?? "?", lastMsg };
      }).sort((a, b) => {
        if (!a.lastMsg && !b.lastMsg) return 0;
        if (!a.lastMsg) return 1;
        if (!b.lastMsg) return -1;
        return new Date(b.lastMsg.created_at).getTime() - new Date(a.lastMsg.created_at).getTime();
      });
    } else {
      // Mentor/Mentee sieht eigene Admin-DMs
      const msgs = getAdminMessagesByUserId(user.id);
      if (msgs.length === 0) return [];
      const lastMsg = msgs[msgs.length - 1];
      const adminId = msgs[0]?.admin_id;
      const admin = allUsers.find((u) => u.id === adminId);
      return [{ userId: user.id, adminId, name: admin?.name ?? "Admin", lastMsg }];
    }
  }, [user, isAdmin, adminMessages, getAdminChatPartners, getAdminMessagesByUserId, allUsers]);

  // Neue-Chat User-Liste (Admin kann mit jedem Mentor/Mentee chatten)
  const newChatUserList = useMemo(() => {
    if (!isAdmin) return [];
    const existingPartners = new Set(getAdminChatPartners());
    const q = newChatSearch.trim().toLowerCase();
    return allUsers
      .filter((u) => (u.role === "mentor" || u.role === "mentee") && !existingPartners.has(u.id))
      .filter((u) => !q || u.name.toLowerCase().includes(q) || (u.email ?? "").toLowerCase().includes(q))
      .slice(0, 20);
  }, [isAdmin, allUsers, getAdminChatPartners, newChatSearch]);

  // Gefilterte Admin-Chat-Liste nach Rolle
  const filteredAdminChatList = useMemo(() => {
    if (!isAdmin || adminFilter === "all") return adminChatList;
    return adminChatList.filter((item) => {
      const partner = allUsers.find((u) => u.id === item.userId);
      return partner?.role === adminFilter;
    });
  }, [adminChatList, adminFilter, allUsers, isAdmin]);

  // Bestimme aktive Daten je nach Tab
  const activeChatData = isAdmin && chatTab === "admin" ? filteredAdminChatList : filteredChatList;

  // ── Tab-Leiste fuer Admin ─────────────────────────────────────────────────

  function renderTabs() {
    // Tabs nur für Admin/Office anzeigen
    if (!isAdmin) return null;
    return (
      <View style={[styles.tabBar, { borderBottomColor: themeColors.border }]}>
        <BNMPressable
          style={[styles.tab, chatTab === "admin" && styles.tabActive, chatTab === "admin" && { borderBottomColor: themeColors.primary }]}
          onPress={() => { setChatTab("admin"); setSelectedChatId(null); }}
          accessibilityRole="button"
          accessibilityLabel="Admin-Chats"
          accessibilityState={{ selected: chatTab === "admin" }}
        >
          <Text style={[styles.tabText, { color: chatTab === "admin" ? themeColors.primary : themeColors.textSecondary }]}>
            {t("chats.adminChats") ?? "Admin-Chats"}
          </Text>
        </BNMPressable>
        <BNMPressable
          style={[styles.tab, chatTab === "mentorship" && styles.tabActive, chatTab === "mentorship" && { borderBottomColor: themeColors.primary }]}
          onPress={() => { setChatTab("mentorship"); setSelectedAdminUserId(null); }}
          accessibilityRole="button"
          accessibilityLabel="Betreuungs-Chats"
          accessibilityState={{ selected: chatTab === "mentorship" }}
        >
          <Text style={[styles.tabText, { color: chatTab === "mentorship" ? themeColors.primary : themeColors.textSecondary }]}>
            {t("chats.mentorshipChats") ?? "Betreuungs-Chats"}
          </Text>
        </BNMPressable>
      </View>
    );
  }

  // ── Zwei-Spalten-Layout (Web, breit) ─────────────────────────────────────

  if (isWideWeb) {
    return (
      <View style={[styles.twoColContainer, { backgroundColor: themeColors.background }]}>
        {/* Linke Spalte: Chat-Liste */}
        <View style={[styles.leftPanel, { borderRightColor: sem(SEMANTIC.darkBorder, isDark) }]}>
          <FlatList
            style={[styles.leftScroll, { backgroundColor: themeColors.background }]}
            data={activeChatData}
            keyExtractor={(item: any) => (isAdmin && chatTab === "admin") ? item.userId : item.mentorship?.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={COLORS.gold}
              />
            }
            removeClippedSubviews={true}
            ListHeaderComponent={
              <View style={styles.leftContent}>
                <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("chats.title")}</Text>
                {renderTabs()}

                {/* Admin-Tab Header */}
                {isAdmin && chatTab === "admin" && (
                  <>
                    <View style={[styles.filterRow, { marginBottom: 10 }]}>
                      {(["all", "mentor", "mentee"] as const).map((f) => {
                        const label = f === "all" ? "Alle" : f === "mentor" ? "Mentoren" : "Mentees";
                        const isActiveFilter = adminFilter === f;
                        return (
                          <BNMPressable
                            key={f}
                            style={[
                              styles.filterChip,
                              { backgroundColor: isActiveFilter ? themeColors.primary : themeColors.card, borderColor: isActiveFilter ? themeColors.primary : themeColors.border },
                            ]}
                            onPress={() => setAdminFilter(f)}
                            accessibilityRole="button"
                            accessibilityLabel={`Filter: ${label}`}
                          >
                            <Text style={{ color: isActiveFilter ? COLORS.white : themeColors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                              {label}
                            </Text>
                          </BNMPressable>
                        );
                      })}
                    </View>
                    <BNMPressable
                      style={[styles.newChatButton, { backgroundColor: themeColors.primary }]}
                      onPress={() => setShowNewChatModal(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Neuen Chat starten"
                    >
                      <Ionicons name="add" size={18} color={COLORS.white} />
                      <Text style={styles.newChatButtonText}>{t("chats.newAdminChat") ?? "Neuer Chat"}</Text>
                    </BNMPressable>
                    {showNewChatModal && (
                      <View style={[styles.newChatModal, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                        <View style={styles.newChatModalHeader}>
                          <Text style={[styles.newChatModalTitle, { color: themeColors.text }]}>
                            {t("chats.selectUser") ?? "User auswaehlen"}
                          </Text>
                          <BNMPressable onPress={() => { setShowNewChatModal(false); setNewChatSearch(""); }} accessibilityRole="button" accessibilityLabel="Schliessen">
                            <Ionicons name="close" size={20} color={themeColors.textTertiary} />
                          </BNMPressable>
                        </View>
                        <TextInput
                          style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }]}
                          value={newChatSearch}
                          onChangeText={setNewChatSearch}
                          placeholder={t("chats.search") ?? "Suchen..."}
                          placeholderTextColor={themeColors.textTertiary}
                        />
                        <ScrollView style={{ maxHeight: 200 }}>
                          {newChatUserList.map((u) => (
                            <BNMPressable
                              key={u.id}
                              style={[styles.chatRow, { borderBottomWidth: 1, borderBottomColor: themeColors.border }]}
                              onPress={() => {
                                setSelectedAdminUserId(u.id);
                                setShowNewChatModal(false);
                                setNewChatSearch("");
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Chat mit ${u.name} starten`}
                            >
                              <View style={[styles.avatar, { backgroundColor: themeColors.primary }]}>
                                <Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                              </View>
                              <View style={styles.chatInfo}>
                                <Text style={[styles.chatName, { color: themeColors.text }]}>{u.name}</Text>
                                <Text style={[styles.chatSub, { color: themeColors.textSecondary }]}>{u.role}</Text>
                              </View>
                            </BNMPressable>
                          ))}
                          {newChatUserList.length === 0 && (
                            <Text style={[{ color: themeColors.textTertiary, textAlign: "center", paddingVertical: 12, fontSize: 13 }]}>
                              {t("chats.noResults") ?? "Keine Ergebnisse"}
                            </Text>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}

                {/* Mentorship-Tab Header */}
                {(!isAdmin || chatTab === "mentorship") && (
                  <>
                    {!isAdmin && adminChatList.length > 0 && (
                      <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark), marginBottom: 12 }]}>
                        {adminChatList.map((item, idx) => {
                          const isSelectedItem = selectedAdminUserId === item.userId;
                          return (
                            <BNMPressable
                              key={item.userId}
                              style={[
                                styles.chatRow,
                                idx < adminChatList.length - 1 ? { borderBottomWidth: 1, borderBottomColor: sem(SEMANTIC.darkBorder, isDark) } : {},
                                isSelectedItem ? { backgroundColor: sem(SEMANTIC.selectedBg, isDark) } : {},
                              ]}
                              onPress={() => {
                                setSelectedAdminUserId(item.userId);
                                setSelectedChatId(null);
                              }}
                              accessibilityRole="button"
                              accessibilityLabel={`Admin-Chat: ${item.name}`}
                            >
                              <View style={[styles.avatar, { backgroundColor: COLORS.gold }]}>
                                <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
                              </View>
                              <View style={styles.chatInfo}>
                                <View style={styles.chatTopRow}>
                                  <Text style={[styles.chatName, { color: themeColors.text }]} numberOfLines={1}>
                                    {item.name}
                                  </Text>
                                  {item.lastMsg && (
                                    <Text style={[styles.chatTime, { color: themeColors.textTertiary }]}>
                                      {formatTime(item.lastMsg.created_at, t("chats.yesterday"))}
                                    </Text>
                                  )}
                                </View>
                                <Text style={[styles.chatSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                                  {item.lastMsg?.content ?? (t("chats.adminDM") ?? "Direktnachricht")}
                                </Text>
                              </View>
                              <View style={[styles.adminBadge, { backgroundColor: COLORS.gold }]}>
                                <Text style={styles.adminBadgeText}>Admin</Text>
                              </View>
                            </BNMPressable>
                          );
                        })}
                      </View>
                    )}
                    <View style={[styles.searchWrapper, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark) }]}>
                      <Ionicons name="search-outline" size={16} color={themeColors.textTertiary} />
                      <TextInput
                        style={[styles.searchInput, { color: themeColors.text }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholder={t("chats.search") ?? "Suchen..."}
                        placeholderTextColor={themeColors.textTertiary}
                      />
                      {searchQuery.length > 0 && (
                        <BNMPressable onPress={() => setSearchQuery("")} accessibilityRole="button" accessibilityLabel="Suche loeschen">
                          <Ionicons name="close-circle" size={16} color={themeColors.textTertiary} />
                        </BNMPressable>
                      )}
                    </View>
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
                  </>
                )}
              </View>
            }
            ListEmptyComponent={() => {
              if (isAdmin && chatTab === "admin") {
                return (
                  <EmptyState
                    icon="mail-outline"
                    title={t("chats.noAdminChats") ?? "Keine Direktnachrichten"}
                    description={isAdmin
                      ? (t("chats.noAdminChatsAdmin") ?? "Starte einen neuen Chat mit einem Mentor oder Mentee.")
                      : (t("chats.noAdminChatsUser") ?? "Noch keine Nachrichten vom Admin.")}
                  />
                );
              }
              return (
                <EmptyState
                  icon="chatbubbles-outline"
                  title={t("chats.noChats") ?? "Keine Chats"}
                  description={t("chats.noChatsText") ?? "Chats werden automatisch erstellt wenn Mentorships zugewiesen werden."}
                />
              );
            }}
            renderItem={({ item, index }: { item: any; index: number }) => {
              const isFirst = index === 0;
              const isLast = index === activeChatData.length - 1;
              const wrapperStyle = [
                isFirst ? { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 } : { borderLeftWidth: 1, borderRightWidth: 1 },
                isLast ? { borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, borderBottomWidth: 1 } : {},
                { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark), marginHorizontal: 24, overflow: "hidden" as const },
              ];

              if (isAdmin && chatTab === "admin") {
                return (
                  <View style={wrapperStyle}>
                    {renderAdminChatItem({ item, index })}
                  </View>
                );
              }
              return (
                <View style={wrapperStyle}>
                  {renderMentorshipChatItem({ item, index })}
                </View>
              );
            }}
          />
        </View>

        {/* Rechte Spalte: Chat-Inhalt */}
        <View style={[styles.rightPanel, { backgroundColor: themeColors.background }]}>
          {selectedAdminUserId ? (
            <AdminChatPanel
              userId={selectedAdminUserId}
              adminId={isAdmin ? undefined : adminChatList[0]?.adminId}
            />
          ) : selectedChatId ? (
            <ChatPanel mentorshipId={selectedChatId} />
          ) : (
            <EmptyState
              icon="chatbubbles-outline"
              title={t("chats.selectChat") ?? "Wähle einen Chat aus"}
            />
          )}
        </View>
      </View>
    );
  }

  // ── Mobile / schmales Layout ──────────────────────────────────────────────

  // Mobile: Wenn Admin-DM User ausgewaehlt, zeige AdminChatPanel
  if (selectedAdminUserId && !isWideWeb) {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={{ flex: 1 }}>
          <BNMPressable
            style={[styles.backButton, { backgroundColor: themeColors.card }]}
            onPress={() => setSelectedAdminUserId(null)}
            accessibilityRole="link"
            accessibilityLabel="Zurueck"
          >
            <Ionicons name="arrow-back" size={20} color={themeColors.text} />
            <Text style={[{ color: themeColors.text, marginLeft: 8, fontSize: 15, fontWeight: "600" }]}>
              {t("chats.back") ?? "Zurueck"}
            </Text>
          </BNMPressable>
          <AdminChatPanel
            userId={selectedAdminUserId}
            adminId={isAdmin ? undefined : adminChatList[0]?.adminId}
          />
        </View>
      </Container>
    );
  }

  function renderMentorshipChatItem({ item, index }: { item: typeof filteredChatList[0]; index: number }) {
    const { mentorship: m, lastMsg, unread } = item;
    const isActive = m.status === "active";
    const isSelected = isWideWeb && selectedChatId === m.id;
    return (
      <BNMPressable
        style={[
          styles.chatRow,
          index < filteredChatList.length - 1 ? { borderBottomWidth: 1, borderBottomColor: sem(SEMANTIC.darkBorder, isDark) } : {},
          isSelected ? { backgroundColor: sem(SEMANTIC.selectedBg, isDark) } : {},
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
        accessibilityRole="button"
        accessibilityLabel={`Chat mit ${getChatTitle(m)}${unread > 0 ? `, ${unread} ungelesen` : ""}`}
      >
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
      </BNMPressable>
    );
  }

  function renderAdminChatItem({ item, index }: { item: typeof filteredAdminChatList[0]; index: number }) {
    const isSelected = isWideWeb && selectedAdminUserId === item.userId;
    const partner = allUsers.find((u) => u.id === item.userId);
    return (
      <BNMPressable
        style={[
          styles.chatRow,
          index < filteredAdminChatList.length - 1 ? { borderBottomWidth: 1, borderBottomColor: sem(SEMANTIC.darkBorder, isDark) } : {},
          isSelected ? { backgroundColor: sem(SEMANTIC.selectedBg, isDark) } : {},
        ]}
        onPress={() => {
          if (isWideWeb) {
            setSelectedAdminUserId(item.userId);
          } else {
            setSelectedAdminUserId(item.userId);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel={`Admin-Chat mit ${item.name}`}
      >
        <View style={[styles.avatar, { backgroundColor: COLORS.gold }]}>
          <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
        </View>
        <View style={styles.chatInfo}>
          <View style={styles.chatTopRow}>
            <Text style={[styles.chatName, { color: themeColors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            {item.lastMsg && (
              <Text style={[styles.chatTime, { color: themeColors.textTertiary }]}>
                {formatTime(item.lastMsg.created_at, t("chats.yesterday"))}
              </Text>
            )}
          </View>
          <Text style={[styles.chatSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
            {isAdmin && partner ? `${partner.role === "mentor" ? "Mentor" : "Mentee"} · ` : ""}
            {item.lastMsg?.content ?? (t("chats.adminDM") ?? "Direktnachricht")}
          </Text>
        </View>
      </BNMPressable>
    );
  }

  function renderMobileListHeader() {
    return (
      <View style={styles.page}>
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("chats.title")}</Text>
        {totalUnread > 0 && (
          <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
            {t("chats.unreadHint").replace("{0}", String(totalUnread))}
          </Text>
        )}
        {renderTabs()}

        {/* Admin-Tab Header: Filter + New Chat + Modal */}
        {isAdmin && chatTab === "admin" && (
          <>
            {/* Filter-Chips */}
            <View style={[styles.filterRow, { marginBottom: 10 }]}>
              {(["all", "mentor", "mentee"] as const).map((f) => {
                const label = f === "all" ? "Alle" : f === "mentor" ? "Mentoren" : "Mentees";
                const isActiveFilter = adminFilter === f;
                return (
                  <BNMPressable
                    key={f}
                    style={[
                      styles.filterChip,
                      { backgroundColor: isActiveFilter ? themeColors.primary : themeColors.card, borderColor: isActiveFilter ? themeColors.primary : themeColors.border },
                    ]}
                    onPress={() => setAdminFilter(f)}
                  >
                    <Text style={{ color: isActiveFilter ? COLORS.white : themeColors.textSecondary, fontSize: 13, fontWeight: "600" }}>
                      {label}
                    </Text>
                  </BNMPressable>
                );
              })}
            </View>

            {/* Neuer Chat Button */}
            <BNMPressable
              style={[styles.newChatButton, { backgroundColor: themeColors.primary }]}
              onPress={() => setShowNewChatModal(true)}
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.newChatButtonText}>{t("chats.newAdminChat") ?? "Neuer Chat"}</Text>
            </BNMPressable>

            {/* Neue-Chat Modal */}
            {showNewChatModal && (
              <View style={[styles.newChatModal, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.newChatModalHeader}>
                  <Text style={[styles.newChatModalTitle, { color: themeColors.text }]}>
                    {t("chats.selectUser") ?? "User auswaehlen"}
                  </Text>
                  <BNMPressable onPress={() => { setShowNewChatModal(false); setNewChatSearch(""); }}>
                    <Ionicons name="close" size={20} color={themeColors.textTertiary} />
                  </BNMPressable>
                </View>
                <TextInput
                  style={[styles.searchInput, { color: themeColors.text, backgroundColor: themeColors.background, borderColor: themeColors.border, borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8 }]}
                  value={newChatSearch}
                  onChangeText={setNewChatSearch}
                  placeholder={t("chats.search") ?? "Suchen..."}
                  placeholderTextColor={themeColors.textTertiary}
                />
                <ScrollView style={{ maxHeight: 200 }}>
                  {newChatUserList.map((u) => (
                    <BNMPressable
                      key={u.id}
                      style={[styles.chatRow, { borderBottomWidth: 1, borderBottomColor: themeColors.border }]}
                      onPress={() => {
                        setSelectedAdminUserId(u.id);
                        setShowNewChatModal(false);
                        setNewChatSearch("");
                      }}
                    >
                      <View style={[styles.avatar, { backgroundColor: themeColors.primary }]}>
                        <Text style={styles.avatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                      </View>
                      <View style={styles.chatInfo}>
                        <Text style={[styles.chatName, { color: themeColors.text }]}>{u.name}</Text>
                        <Text style={[styles.chatSub, { color: themeColors.textSecondary }]}>{u.role}</Text>
                      </View>
                    </BNMPressable>
                  ))}
                  {newChatUserList.length === 0 && (
                    <Text style={[{ color: themeColors.textTertiary, textAlign: "center", paddingVertical: 12, fontSize: 13 }]}>
                      {t("chats.noResults") ?? "Keine Ergebnisse"}
                    </Text>
                  )}
                </ScrollView>
              </View>
            )}
          </>
        )}

        {/* Mentorship-Tab Header: Admin-DMs + Search + Counters */}
        {(!isAdmin || chatTab === "mentorship") && (
          <>
            {/* Admin-DM Eintraege oben (nur fuer Mentor/Mentee) */}
            {!isAdmin && adminChatList.length > 0 && (
              <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark), marginBottom: 12 }]}>
                {adminChatList.map((item, idx) => {
                  const isSelected = isWideWeb && selectedAdminUserId === item.userId;
                  return (
                    <BNMPressable
                      key={item.userId}
                      style={[
                        styles.chatRow,
                        idx < adminChatList.length - 1 ? { borderBottomWidth: 1, borderBottomColor: sem(SEMANTIC.darkBorder, isDark) } : {},
                        isSelected ? { backgroundColor: sem(SEMANTIC.selectedBg, isDark) } : {},
                      ]}
                      onPress={() => {
                        if (isWideWeb) {
                          setSelectedAdminUserId(item.userId);
                          setSelectedChatId(null);
                        } else {
                          setSelectedAdminUserId(item.userId);
                        }
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`Admin-Chat: ${item.name}`}
                    >
                      <View style={[styles.avatar, { backgroundColor: COLORS.gold }]}>
                        <Ionicons name="shield-checkmark" size={20} color={COLORS.white} />
                      </View>
                      <View style={styles.chatInfo}>
                        <View style={styles.chatTopRow}>
                          <Text style={[styles.chatName, { color: themeColors.text }]} numberOfLines={1}>
                            {item.name}
                          </Text>
                          {item.lastMsg && (
                            <Text style={[styles.chatTime, { color: themeColors.textTertiary }]}>
                              {formatTime(item.lastMsg.created_at, t("chats.yesterday"))}
                            </Text>
                          )}
                        </View>
                        <Text style={[styles.chatSub, { color: themeColors.textSecondary }]} numberOfLines={1}>
                          {item.lastMsg?.content ?? (t("chats.adminDM") ?? "Direktnachricht")}
                        </Text>
                      </View>
                      <View style={[styles.adminBadge, { backgroundColor: COLORS.gold }]}>
                        <Text style={styles.adminBadgeText}>Admin</Text>
                      </View>
                    </BNMPressable>
                  );
                })}
              </View>
            )}

            {/* Suchfeld */}
            <View style={[styles.searchWrapper, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark) }]}>
              <Ionicons name="search-outline" size={16} color={themeColors.textTertiary} />
              <TextInput
                style={[styles.searchInput, { color: themeColors.text }, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}]}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder={t("chats.search") ?? "Suchen..."}
                placeholderTextColor={themeColors.textTertiary}
              />
              {searchQuery.length > 0 && (
                <BNMPressable onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={16} color={themeColors.textTertiary} />
                </BNMPressable>
              )}
            </View>

            {/* Zaehler */}
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
          </>
        )}
      </View>
    );
  }

  function renderMobileListEmpty() {
    if (isAdmin && chatTab === "admin") {
      return (
        <EmptyState
          icon="mail-outline"
          title={t("chats.noAdminChats") ?? "Keine Direktnachrichten"}
          description={isAdmin
            ? (t("chats.noAdminChatsAdmin") ?? "Starte einen neuen Chat mit einem Mentor oder Mentee.")
            : (t("chats.noAdminChatsUser") ?? "Noch keine Nachrichten vom Admin.")}
        />
      );
    }
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title={t("chats.noChats") ?? "Keine Chats"}
        description={t("chats.noChatsText") ?? "Chats werden automatisch erstellt wenn Mentorships zugewiesen werden."}
      />
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <FlatList
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        data={activeChatData}
        keyExtractor={(item: any) => (isAdmin && chatTab === "admin") ? item.userId : item.mentorship?.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
        ListHeaderComponent={<>{renderMobileListHeader()}</>}
        ListEmptyComponent={renderMobileListEmpty}
        removeClippedSubviews={true}
        contentContainerStyle={activeChatData.length > 0 ? {} : { flexGrow: 1 }}
        renderItem={({ item, index }: { item: any; index: number }) => {
          // Wrapper: listCard-Stil um die gesamte Liste simulieren
          const isFirst = index === 0;
          const isLast = index === activeChatData.length - 1;
          const wrapperStyle = [
            isFirst ? { borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1 } : { borderLeftWidth: 1, borderRightWidth: 1 },
            isLast ? { borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg, borderBottomWidth: 1 } : {},
            { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark), marginHorizontal: 24, overflow: "hidden" as const },
          ];

          if (isAdmin && chatTab === "admin") {
            return (
              <View style={wrapperStyle}>
                {renderAdminChatItem({ item, index })}
              </View>
            );
          }
          return (
            <View style={wrapperStyle}>
              {renderMentorshipChatItem({ item, index })}
            </View>
          );
        }}
      />
    </Container>
  );
}

const styles = StyleSheet.create({
  // Mobile Layout
  scrollView: { flex: 1 },
  page: { padding: 24 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 16,
  },
  pageSubtitle: {
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },

  // Filter
  filterRow: { flexDirection: "row" as const, gap: 8, flexWrap: "wrap" as const },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.xl, borderWidth: 1 },

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
    padding: 24,
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
    borderRadius: RADIUS.md,
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
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 40,
    alignItems: "center",
    marginTop: 8,
  },
  emptyIcon: { marginBottom: 12 },
  emptyTitle: {
    fontWeight: "800",
    fontSize: 16,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
  },

  // Chat-Liste
  listCard: {
    borderRadius: RADIUS.lg,
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
    borderRadius: RADIUS.full,
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
  adminBadge: {
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginLeft: 8,
  },
  adminBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "700",
  },

  // Tab-Leiste
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: "600",
  },

  // Neuer Chat Button
  newChatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: RADIUS.md,
    marginBottom: 12,
    gap: 6,
  },
  newChatButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },

  // Neue-Chat Modal
  newChatModal: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: 12,
    marginBottom: 12,
  },
  newChatModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  newChatModalTitle: {
    fontWeight: "600",
    fontSize: 15,
  },

  // Zurueck-Button (Mobile)
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
