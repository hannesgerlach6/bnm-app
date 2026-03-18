import React, { useState, useRef } from "react";
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
import { useLocalSearchParams } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS } from "../../constants/Colors";

export default function ChatScreen() {
  const { user } = useAuth();
  const { getMessagesByMentorshipId, getMentorshipById, sendMessage } = useData();
  const { mentorshipId } = useLocalSearchParams<{ mentorshipId: string }>();

  const [inputText, setInputText] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);

  const mentorship = mentorshipId ? getMentorshipById(mentorshipId) : undefined;
  const messages = mentorshipId ? getMessagesByMentorshipId(mentorshipId) : [];

  function handleSend() {
    if (!inputText.trim() || !user || !mentorshipId) return;
    sendMessage(mentorshipId, user.id, inputText.trim());
    setInputText("");
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }

  if (!user) return null;

  const chatPartnerName =
    user.id === mentorship?.mentor_id
      ? mentorship?.mentee?.name
      : mentorship?.mentor?.name;

  const statusLabel =
    mentorship?.status === "active"
      ? "Aktiv"
      : mentorship?.status === "completed"
      ? "Abgeschlossen"
      : "Abgebrochen";

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={90}
    >
      {/* Chat-Header-Info */}
      {mentorship && (
        <View style={styles.chatHeader}>
          <Text style={styles.chatHeaderName}>{chatPartnerName}</Text>
          <Text style={styles.chatHeaderSub}>
            Betreuung · {statusLabel}
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
        {messages.length === 0 ? (
          <View style={styles.emptyMessages}>
            <Text style={styles.emptyText}>
              Noch keine Nachrichten.{"\n"}Schreibe die erste Nachricht!
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
                  styles.messageBubbleWrapper,
                  isOwn ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" },
                ]}
              >
                {!isOwn && (
                  <Text style={styles.senderName}>{sender.name}</Text>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    isOwn ? styles.ownBubble : styles.otherBubble,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      isOwn ? { color: COLORS.white } : { color: COLORS.primary },
                    ]}
                  >
                    {msg.content}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.timeText,
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

      {/* Input-Bereich */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Nachricht schreiben..."
          placeholderTextColor="#98A2B3"
          multiline
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            { backgroundColor: inputText.trim() ? COLORS.primary : COLORS.border },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim()}
        >
          <Text style={styles.sendButtonText}>→</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, backgroundColor: COLORS.bg },
  chatHeader: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatHeaderName: { fontWeight: "600", color: COLORS.primary, textAlign: "center" },
  chatHeaderSub: { color: COLORS.tertiary, fontSize: 12, textAlign: "center" },
  messagesScroll: { flex: 1 },
  emptyMessages: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 64 },
  emptyText: { color: COLORS.tertiary, textAlign: "center", fontSize: 14 },
  messageBubbleWrapper: { marginBottom: 12, maxWidth: "80%" },
  senderName: { color: COLORS.tertiary, fontSize: 12, marginBottom: 4, marginLeft: 4 },
  messageBubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16 },
  ownBubble: {
    backgroundColor: COLORS.primary,
    borderTopRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopLeftRadius: 4,
  },
  messageText: { fontSize: 14, lineHeight: 20 },
  timeText: { color: COLORS.tertiary, fontSize: 12, marginTop: 4 },
  inputContainer: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.primary,
    maxHeight: 120,
    minHeight: 44,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonText: { color: COLORS.white, fontWeight: "bold", fontSize: 18 },
});
