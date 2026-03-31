import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { showError, showConfirm } from "../../lib/errorHandler";
import { COLORS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { SkeletonChatMessages } from "../../components/Skeleton";
import { usePageTitle } from "../../hooks/usePageTitle";

export default function ChatScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {
    getMessagesByMentorshipId,
    getMentorshipById,
    sendMessage,
    deleteMessage,
    markChatAsRead,
    isLoading: dataLoading,
  } = useData();
  const { mentorshipId } = useLocalSearchParams<{ mentorshipId: string }>();

  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  const mentorship = mentorshipId ? getMentorshipById(mentorshipId) : undefined;
  const messages = mentorshipId ? getMessagesByMentorshipId(mentorshipId) : [];

  // Beim Öffnen des Chats UND bei neuen eingehenden Nachrichten: als gelesen markieren.
  // Zweite Dependency `messages` stellt sicher, dass auch Realtime-Nachrichten die
  // während der Chat-Screen offen ist reinkommen, sofort als gelesen markiert werden
  // und der Badge in der Chats-Liste nicht fälschlicherweise erscheint.
  useEffect(() => {
    if (mentorshipId) {
      markChatAsRead(mentorshipId);
    }
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
      setInputText(content); // Text wiederherstellen bei Fehler
      showError(t("chat.sendError"));
    }
  }

  async function handleLongPress(messageId: string, isOwn: boolean) {
    if (!isOwn) return; // Nur eigene Nachrichten löschbar

    const ok = await showConfirm(t("chat.deleteConfirmTitle"), t("chat.deleteConfirmText"));
    if (!ok) return;

    try {
      await deleteMessage(messageId);
    } catch {
      showError(t("chat.deleteError"));
    }
  }

  const chatPartnerName = user
    ? (user.id === mentorship?.mentor_id
        ? mentorship?.mentee?.name
        : mentorship?.mentor?.name)
    : undefined;

  usePageTitle(chatPartnerName ? `Chat – ${chatPartnerName}` : "Chat");

  if (!user) return null;

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
      style={[styles.flex1, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      {/* Chat-Header-Info */}
      {mentorship && (
        <View style={[styles.chatHeader, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border }]}>
          <Text style={[styles.chatHeaderName, { color: themeColors.text }]}>{chatPartnerName}</Text>
          <Text style={[styles.chatHeaderSub, { color: themeColors.textTertiary }]}>
            {t("chat.mentorship")} · {statusLabel}
          </Text>
        </View>
      )}

      {/* Nachrichten */}
      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesScroll}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        onContentSizeChange={() =>
          scrollViewRef.current?.scrollToEnd({ animated: false })
        }
      >
        {dataLoading ? (
          <SkeletonChatMessages count={6} />
        ) : messages.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
              {t("chat.noMessages")}
            </Text>
          </View>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === user.id;
            const sender =
              msg.sender ??
              (isOwn ? { name: user.name } : { name: chatPartnerName ?? "?" });

            // Admin/Office: Rolle statt echtem Namen anzeigen
            const senderRole = (msg.sender as any)?.role;
            const displayName =
              senderRole === "admin" ? "Admin" :
              senderRole === "office" ? "Office" :
              sender.name ?? chatPartnerName ?? "?";

            const timeStr = new Date(msg.created_at).toLocaleTimeString("de-DE", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <View
                key={msg.id}
                style={[
                  styles.messageBubbleWrapper,
                  isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                ]}
              >
                {!isOwn && (
                  <Text style={[styles.senderName, { color: themeColors.textTertiary }]}>{displayName}</Text>
                )}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onLongPress={() => handleLongPress(msg.id, isOwn)}
                  delayLongPress={500}
                >
                  <View
                    style={[
                      styles.messageBubble,
                      isOwn
                        ? styles.ownBubble
                        : [styles.otherBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                    ]}
                  >
                    <Text
                      style={[
                        styles.messageText,
                        isOwn ? { color: COLORS.white } : { color: themeColors.text },
                      ]}
                    >
                      {msg.content}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.timeText,
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
        {/* Abstandhalter unten */}
        <View style={{ height: 16 }} />
      </ScrollView>

      {/* Input-Bereich — Admin/Office dürfen schreiben (als Beobachter/Moderator) */}
      {mentorship && (mentorship.status === "active" || mentorship.status === "completed") ? (
        <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border, paddingBottom: Platform.OS !== "web" ? Math.max(insets.bottom, 16) + 12 : 10 }]}>
          <TextInput
            style={[styles.textInput, { backgroundColor: themeColors.elevated, borderColor: themeColors.border, color: themeColors.text }]}
            value={inputText}
            onChangeText={setInputText}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            returnKeyType="default"
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? themeColors.primary : themeColors.border },
            ]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border, paddingBottom: Platform.OS !== "web" ? Math.max(insets.bottom, 16) + 12 : 10 }]}>
          <Text style={[styles.inactiveHint, { color: themeColors.textTertiary }]}>
            {t("chat.notActiveHint")}
          </Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  chatHeader: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatHeaderName: { fontWeight: "600", textAlign: "center", fontSize: 15 },
  chatHeaderSub: { fontSize: 12, textAlign: "center", marginTop: 2 },
  messagesScroll: { flex: 1 },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyText: { textAlign: "center", fontSize: 14 },
  messageBubbleWrapper: { marginBottom: 10, maxWidth: Platform.OS === "web" ? "60%" : "80%" },
  senderName: { fontSize: 11, marginBottom: 3, marginLeft: 12, opacity: 0.7 },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
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
