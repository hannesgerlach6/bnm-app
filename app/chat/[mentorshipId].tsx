import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Animated,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Modal,
  ScrollView,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { showError, showConfirm, showSuccess } from "../../lib/errorHandler";
import { COLORS, RADIUS, TYPOGRAPHY, SHADOWS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { SkeletonChatMessages } from "../../components/Skeleton";
import { usePageTitle } from "../../hooks/usePageTitle";
import { EmptyState } from "../../components/EmptyState";

export default function ChatScreen() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const {
    getMessagesByMentorshipId,
    getMentorshipById,
    getMentorshipsByMentorId,
    getMentorshipByMenteeId,
    sendMessage,
    deleteMessage,
    markChatAsRead,
    getUserById,
    mentorships: allMentorships,
    messageTemplates,
    isLoading: dataLoading,
  } = useData();
  const { mentorshipId } = useLocalSearchParams<{ mentorshipId: string }>();

  const [inputText, setInputText] = useState("");
  const [inputHeight, setInputHeight] = useState(44);
  const flatListRef = useRef<FlatList>(null);
  const [showScrollFab, setShowScrollFab] = useState(false);
  const fabOpacity = useRef(new Animated.Value(0)).current;

  // Template picker state
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  // Forward message state
  const [forwardModalVisible, setForwardModalVisible] = useState(false);
  const [forwardMessageContent, setForwardMessageContent] = useState("");
  const [forwardSenderName, setForwardSenderName] = useState("");

  // Für inverted FlatList: offset > 150 bedeutet der User hat nach oben gescrollt (= ältere Nachrichten)
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset } = event.nativeEvent;
    // In einer inverted FlatList ist offset 0 = unten (neueste). Größerer offset = weiter oben (ältere).
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

  // Kein initialer Scroll nötig: inverted FlatList zeigt neueste Nachrichten automatisch unten.

  async function handleSend() {
    if (!inputText.trim() || !user || !mentorshipId) return;
    const content = inputText.trim();
    setInputText("");
    try {
      await sendMessage(mentorshipId, user.id, content);
      // Bei inverted FlatList: offset 0 = neueste Nachrichten (unten)
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }, 100);
    } catch {
      setInputText(content); // Text wiederherstellen bei Fehler
      showError(t("chat.sendError"));
    }
  }

  const handleLongPress = useCallback(async (messageId: string, isOwn: boolean, msgContent: string, senderName: string) => {
    if (Platform.OS !== "web") {
      // Native: use Alert with multiple buttons
      const { Alert } = require("react-native");
      const buttons: any[] = [];

      buttons.push({
        text: "Weiterleiten",
        onPress: () => {
          setForwardMessageContent(msgContent);
          setForwardSenderName(senderName);
          setForwardModalVisible(true);
        },
      });

      if (isOwn) {
        buttons.push({
          text: "Löschen",
          style: "destructive",
          onPress: async () => {
            const ok = await showConfirm(t("chat.deleteConfirmTitle"), t("chat.deleteConfirmText"));
            if (!ok) return;
            try {
              await deleteMessage(messageId);
            } catch {
              showError(t("chat.deleteError"));
            }
          },
        });
      }

      buttons.push({ text: "Abbrechen", style: "cancel" });
      Alert.alert("Nachricht", undefined, buttons);
    } else {
      // Web: simple confirm-based flow
      const action = isOwn
        ? window.confirm("Weiterleiten? (OK = Weiterleiten, Abbrechen = weitere Optionen)")
        : true;

      if (action) {
        setForwardMessageContent(msgContent);
        setForwardSenderName(senderName);
        setForwardModalVisible(true);
      } else if (isOwn) {
        const ok = window.confirm("Nachricht löschen?");
        if (ok) {
          try {
            await deleteMessage(messageId);
          } catch {
            showError(t("chat.deleteError"));
          }
        }
      }
    }
  }, [t, deleteMessage]);

  const chatPartnerName = user
    ? (user.id === mentorship?.mentor_id
        ? mentorship?.mentee?.name
        : mentorship?.mentor?.name)
    : undefined;

  usePageTitle(chatPartnerName ? `Chat – ${chatPartnerName}` : "Chat");

  // Messages für inverted FlatList umkehren (neueste zuerst)
  const reversedMessages = useMemo(() => [...messages].reverse(), [messages]);

  // renderItem für FlatList — Logik aus dem alten .map() extrahiert
  const renderItem = useCallback(({ item: msg, index }: { item: typeof messages[0]; index: number }) => {
    if (!user) return null;
    const isOwn = msg.sender_id === user.id;
    const sender =
      msg.sender ??
      (isOwn ? { name: user.name } : { name: chatPartnerName ?? "?" });

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

    // In der reversed Liste: das "nächste" Element (index+1) ist die chronologisch VORHERIGE Nachricht.
    // Wir brauchen die chronologisch nächste (= index-1 in reversed = die Nachricht DANACH in der Zeit).
    // Für Timestamp-Separator: Prüfen ob zwischen dieser und der vorherigen Nachricht (chronologisch) >15 Min liegen.
    // In reversed: die chronologisch vorherige Nachricht ist bei index+1.
    const prevInTime = index < reversedMessages.length - 1 ? reversedMessages[index + 1] : null;
    const prevDate = prevInTime ? new Date(prevInTime.created_at) : null;
    const showTimeSeparator = !prevDate
      || (msgDate.getTime() - prevDate.getTime() > 15 * 60 * 1000)
      || msgDate.toDateString() !== prevDate.toDateString();

    // Nachrichtengruppe: Aufeinanderfolgende Nachrichten desselben Senders
    const isContinuation = prevInTime
      && prevInTime.sender_id === msg.sender_id
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
      <React.Fragment>
        {/* Nachricht */}
        <View
          style={[
            styles.messageBubbleWrapper,
            isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
            isContinuation && { marginTop: -4 },
          ]}
        >
          {/* Sender-Name nur bei erstem in der Gruppe */}
          {!isOwn && !isContinuation && (
            <Text style={[styles.senderName, { color: themeColors.textTertiary }]}>{displayName}</Text>
          )}
          <BNMPressable
            activeOpacity={0.8}
            onLongPress={() => handleLongPress(msg.id, isOwn, msg.content, displayName)}
            delayLongPress={500}
            accessibilityRole="button"
            accessibilityLabel={`Nachricht von ${displayName}`}
          >
            <View
              style={[
                styles.messageBubble,
                isOwn
                  ? styles.ownBubble
                  : [styles.otherBubble, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                isContinuation && isOwn && { borderTopRightRadius: RADIUS.lg },
                isContinuation && !isOwn && { borderTopLeftRadius: RADIUS.lg },
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
          </BNMPressable>
        </View>
        {/* Timestamp-Separator: wird ÜBER der Nachricht angezeigt.
            In inverted FlatList kommt "über" = nach dem Item im Array,
            also rendern wir den Separator NACH der Bubble. */}
        {showTimeSeparator && (
          <View style={styles.timeSeparator}>
            <Text style={[styles.timeSeparatorText, { color: themeColors.textTertiary }]}>
              {dateSepLabel}
            </Text>
          </View>
        )}
      </React.Fragment>
    );
  }, [user, chatPartnerName, mentorship, reversedMessages, themeColors, handleLongPress]);

  const keyExtractor = useCallback((item: typeof messages[0]) => item.id, []);

  // Mentorships for forwarding (exclude current chat)
  const forwardableMentorships = useMemo(() => {
    if (!user) return [];
    return allMentorships
      .filter((m) => m.id !== mentorshipId && (m.mentor_id === user.id || m.mentee_id === user.id))
      .filter((m) => m.status === "active" || m.status === "completed")
      .map((m) => {
        const partnerId = m.mentor_id === user.id ? m.mentee_id : m.mentor_id;
        const partner = getUserById(partnerId);
        return { ...m, partnerName: partner?.name ?? "Unbekannt" };
      });
  }, [allMentorships, user, mentorshipId, getUserById]);

  // Chat templates (exclude email templates, only active)
  const chatTemplates = useMemo(() =>
    messageTemplates.filter(t => !t.title.startsWith("[E-Mail]") && t.is_active),
    [messageTemplates]
  );

  const isMentor = user?.role === "mentor";

  // Mentee name for placeholder replacement
  const menteeName = useMemo(() => {
    if (!mentorship) return "";
    const mentee = getUserById(mentorship.mentee_id);
    return mentee?.name ?? "";
  }, [mentorship, getUserById]);

  const handleSelectTemplate = useCallback((template: typeof chatTemplates[0]) => {
    let body = template.body;
    body = body.replace(/\{name\}/g, menteeName);
    body = body.replace(/\{mentor_name\}/g, user?.name ?? "");
    body = body.replace(/\{mentee_name\}/g, menteeName);
    setInputText(body);
    setShowTemplateModal(false);
  }, [menteeName, user?.name]);

  const handleForwardToChat = useCallback(async (targetMentorshipId: string) => {
    if (!user) return;
    const forwardedContent = `\u21AA Weitergeleitet von ${forwardSenderName}:\n${forwardMessageContent}`;
    try {
      await sendMessage(targetMentorshipId, user.id, forwardedContent);
      setForwardModalVisible(false);
      setForwardMessageContent("");
      setForwardSenderName("");
      showSuccess("Nachricht weitergeleitet");
    } catch {
      showError("Fehler beim Weiterleiten");
    }
  }, [user, forwardSenderName, forwardMessageContent, sendMessage]);

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
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 80}
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
      <View style={{ flex: 1 }}>
        {dataLoading ? (
          <View style={[styles.messagesScroll, { paddingHorizontal: 16, paddingVertical: 12 }]}>
            <SkeletonChatMessages count={6} />
          </View>
        ) : reversedMessages.length === 0 ? (
          <View style={[styles.messagesScroll, { justifyContent: "center" }]}>
            <EmptyState
              icon="chatbubble-ellipses-outline"
              title={t("chat.noMessages")}
              description="Starte die Konversation mit einer Nachricht."
              compact
            />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={reversedMessages}
            renderItem={renderItem}
            keyExtractor={keyExtractor}
            inverted={true}
            removeClippedSubviews={true}
            style={styles.messagesScroll}
            contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
            onScroll={handleScroll}
            scrollEventThrottle={100}
          />
        )}

        {/* Scroll-to-Bottom FAB */}
        {showScrollFab && (
          <Animated.View style={[styles.scrollFab, { opacity: fabOpacity }]}>
            <BNMPressable
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
              style={[styles.scrollFabBtn, { backgroundColor: themeColors.card, ...SHADOWS.md }]}
              accessibilityRole="button"
              accessibilityLabel="Nach unten scrollen"
            >
              <Ionicons name="chevron-down" size={20} color={themeColors.text} />
            </BNMPressable>
          </Animated.View>
        )}
      </View>

      {/* Input-Bereich — Admin/Office dürfen schreiben (als Beobachter/Moderator) */}
      {mentorship && (mentorship.status === "active" || mentorship.status === "completed") ? (
        <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border, paddingBottom: Platform.OS !== "web" ? Math.max(insets.bottom, 16) + 12 : 10 }]}>
          {isMentor && chatTemplates.length > 0 && (
            <BNMPressable
              style={[styles.templateButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setShowTemplateModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Nachrichtenvorlage einfügen"
            >
              <Ionicons name="document-text-outline" size={20} color={COLORS.gold} />
            </BNMPressable>
          )}
          <TextInput
            style={[
              styles.textInput,
              styles.textInputWithTemplate,
              { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text },
              { height: Math.max(44, Math.min(inputHeight, Platform.OS === "web" ? 300 : 120)) },
            ]}
            value={inputText}
            onChangeText={(text) => { setInputText(text); if (!text) setInputHeight(44); }}
            placeholder={t("chat.placeholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            onContentSizeChange={(e) => setInputHeight(e.nativeEvent.contentSize.height + 20)}
            returnKeyType="default"
          />
          <BNMPressable
            style={[
              styles.sendButton,
              { backgroundColor: inputText.trim() ? COLORS.primary : COLORS.primary, opacity: inputText.trim() ? 1 : 0.35 },
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
        <View style={[styles.inputContainer, { backgroundColor: themeColors.card, borderTopColor: themeColors.border, paddingBottom: Platform.OS !== "web" ? Math.max(insets.bottom, 16) + 12 : 10 }]}>
          <Text style={[styles.inactiveHint, { color: themeColors.textTertiary }]}>
            {t("chat.notActiveHint")}
          </Text>
        </View>
      )}

      {/* Template Picker Modal */}
      <Modal
        visible={showTemplateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTemplateModal(false)}
      >
        <BNMPressable
          style={styles.modalOverlay}
          onPress={() => setShowTemplateModal(false)}
          accessibilityRole="button"
          accessibilityLabel="Schliessen"
        >
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Vorlage einfügen</Text>
            <Text style={[styles.modalSubtitle, { color: themeColors.textTertiary }]}>
              Tippe auf eine Vorlage, um den Text einzufügen.
            </Text>
            {chatTemplates.length === 0 ? (
              <Text style={{ color: themeColors.textTertiary, textAlign: "center", paddingVertical: 20, fontSize: 13 }}>
                Keine Vorlagen verfügbar.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 350 }}>
                {chatTemplates.map((tmpl) => (
                  <BNMPressable
                    key={tmpl.id}
                    style={[styles.templateCard, { borderBottomColor: themeColors.border }]}
                    onPress={() => handleSelectTemplate(tmpl)}
                    accessibilityRole="button"
                    accessibilityLabel={`Vorlage: ${tmpl.title}`}
                  >
                    <Text style={[styles.templateCardTitle, { color: themeColors.text }]}>{tmpl.title}</Text>
                    <Text style={[styles.templateCardPreview, { color: themeColors.textTertiary }]} numberOfLines={2}>
                      {tmpl.body.length > 80 ? tmpl.body.substring(0, 80) + "..." : tmpl.body}
                    </Text>
                  </BNMPressable>
                ))}
              </ScrollView>
            )}
            <BNMPressable
              style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
              onPress={() => setShowTemplateModal(false)}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={{ color: themeColors.textSecondary, fontWeight: "600", fontSize: 14 }}>Abbrechen</Text>
            </BNMPressable>
          </View>
        </BNMPressable>
      </Modal>

      {/* Forward Modal */}
      <Modal
        visible={forwardModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setForwardModalVisible(false)}
      >
        <BNMPressable
          style={styles.modalOverlay}
          onPress={() => setForwardModalVisible(false)}
          accessibilityRole="button"
          accessibilityLabel="Schliessen"
        >
          <View style={[styles.modalContent, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>Weiterleiten an</Text>
            <Text style={[styles.modalSubtitle, { color: themeColors.textTertiary }]} numberOfLines={2}>
              {forwardMessageContent.length > 80
                ? forwardMessageContent.substring(0, 80) + "..."
                : forwardMessageContent}
            </Text>
            {forwardableMentorships.length === 0 ? (
              <Text style={{ color: themeColors.textTertiary, textAlign: "center", paddingVertical: 20, fontSize: 13 }}>
                Keine anderen Chats verfügbar.
              </Text>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {forwardableMentorships.map((m) => (
                  <BNMPressable
                    key={m.id}
                    style={[styles.forwardItem, { borderBottomColor: themeColors.border }]}
                    onPress={() => handleForwardToChat(m.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Weiterleiten an ${m.partnerName}`}
                  >
                    <Ionicons name="chatbubble-outline" size={18} color={COLORS.gold} style={{ marginRight: 10 }} />
                    <Text style={[styles.forwardItemText, { color: themeColors.text }]}>{m.partnerName}</Text>
                    <Ionicons name="chevron-forward" size={16} color={themeColors.textTertiary} />
                  </BNMPressable>
                ))}
              </ScrollView>
            )}
            <BNMPressable
              style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
              onPress={() => setForwardModalVisible(false)}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={{ color: themeColors.textSecondary, fontWeight: "600", fontSize: 14 }}>Abbrechen</Text>
            </BNMPressable>
          </View>
        </BNMPressable>
      </Modal>
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
  messageBubbleWrapper: { marginBottom: 6, maxWidth: Platform.OS === "web" ? "60%" : "80%" },
  senderName: { fontSize: TYPOGRAPHY.size.xs, marginBottom: 3, marginLeft: 12, fontWeight: TYPOGRAPHY.weight.medium },
  messageBubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: RADIUS.lg },
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
    width: 44,
    height: 44,
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
    maxHeight: Platform.OS === "web" ? 300 : 120,
    minHeight: Platform.OS === "web" ? 60 : 44,
    ...(Platform.OS === "web" ? { resize: "vertical" } as any : {}),
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
  },
  inactiveHint: { flex: 1, textAlign: "center", fontSize: 13, paddingVertical: 4 },

  textInputWithTemplate: {},
  templateButton: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  templateCard: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  templateCardTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  templateCardPreview: {
    fontSize: 12,
    lineHeight: 18,
  },

  // Forward Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    borderRadius: RADIUS.lg,
    padding: 20,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 16,
    fontStyle: "italic",
  },
  forwardItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  forwardItemText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
  },
  modalCancelBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    alignItems: "center",
  },
});
