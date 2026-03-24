import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Alert,
} from "react-native";
import { showError, showSuccess } from "../lib/errorHandler";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { COLORS } from "../constants/Colors";
import { sendNewFeedbackNotification } from "../lib/emailService";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";

export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { addFeedback, getMentorshipById } = useData();
  const params = useLocalSearchParams<{ mentorshipId?: string; type?: string }>();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const isCancellation = params.type === "cancellation";
  const mentorship = params.mentorshipId
    ? getMentorshipById(params.mentorshipId)
    : undefined;

  async function handleSubmit() {
    if (rating === 0) {
      showError(t("feedback.errorRating"));
      return;
    }
    if (!user || !params.mentorshipId) {
      showError(t("feedback.errorMissing"));
      return;
    }

    setIsSaving(true);
    try {
      await addFeedback({
        mentorship_id: params.mentorshipId,
        submitted_by: user.id,
        rating,
        comments: comment.trim() || undefined,
      });

      // E-Mail-Benachrichtigung an Admin (fire-and-forget, Fehler nicht kritisch)
      if (mentorship) {
        sendNewFeedbackNotification(
          mentorship.mentor?.name ?? t("common.unknown"),
          mentorship.mentee?.name ?? t("common.unknown"),
          rating,
          comment.trim() || undefined
        ).catch(() => {});
      }

      // Erfolgs-Meldung anzeigen, dann nach 1,5 Sekunden zum Dashboard navigieren
      Alert.alert(t("feedback.successMsg"), "", [
        {
          text: "OK",
          onPress: () => router.replace("/(tabs)"),
        },
      ]);
      setTimeout(() => router.replace("/(tabs)"), 1500);
    } catch {
      showError(t("feedback.errorMissing"));
    } finally {
      setIsSaving(false);
    }
  }

  const statusLabel =
    mentorship?.status === "completed" ? t("feedback.completed") : t("feedback.cancelled");

  const ratingLabel =
    rating === 1
      ? t("feedback.rating1")
      : rating === 2
      ? t("feedback.rating2")
      : rating === 3
      ? t("feedback.rating3")
      : rating === 4
      ? t("feedback.rating4")
      : t("feedback.rating5");

  const isDisabled = isSaving || rating === 0;

  return (
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerEmoji}>
            {isCancellation ? <Ionicons name="document-text-outline" size={28} color={COLORS.gold} /> : mentorship?.status === "completed" ? <Ionicons name="ribbon-outline" size={28} color={COLORS.cta} /> : <Ionicons name="document-text-outline" size={28} color={COLORS.gold} />}
          </Text>
          <Text style={styles.headerTitle}>
            {isCancellation ? t("feedback.cancellationTitle") : t("feedback.headerTitle").replace("{0}", statusLabel)}
          </Text>
          {mentorship && (
            <Text style={styles.headerSub}>
              {mentorship.mentee?.name} & {mentorship.mentor?.name}
            </Text>
          )}
        </View>

        <Text style={[styles.subText, { color: themeColors.textSecondary }]}>
          {isCancellation ? t("feedback.cancellationHelp") : t("feedback.helpText")}
        </Text>

        {/* Sternbewertung */}
        <View style={[styles.ratingCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.ratingTitle, { color: themeColors.text }]}>{t("feedback.ratingTitle")}</Text>
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity
                key={star}
                onPress={() => setRating(star)}
                style={styles.starButton}
              >
                <Text style={[styles.starText, star > rating ? { opacity: 0.3 } : {}]}>
                  {star <= rating ? "★" : "☆"}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={[styles.ratingLabel, { color: themeColors.textSecondary }]}>{ratingLabel}</Text>
          )}
        </View>

        {/* Kommentar */}
        <View style={[styles.commentCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <Text style={[styles.commentTitle, { color: themeColors.text }]}>{t("feedback.commentTitle")}</Text>
          <TextInput
            style={[styles.commentInput, { borderColor: themeColors.border, color: themeColors.text }]}
            value={comment}
            onChangeText={setComment}
            placeholder={t("feedback.commentPlaceholder")}
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Absenden */}
        <TouchableOpacity
          style={[
            styles.submitButton,
            { backgroundColor: isDisabled ? COLORS.border : COLORS.cta },
          ]}
          onPress={handleSubmit}
          disabled={isDisabled}
        >
          <Text
            style={[
              styles.submitButtonText,
              { color: isDisabled ? COLORS.tertiary : COLORS.white },
            ]}
          >
            {isSaving ? t("feedback.submitting") : t("feedback.submit")}
          </Text>
        </TouchableOpacity>

        {/* Überspringen */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={[styles.skipText, { color: themeColors.textTertiary }]}>{t("feedback.skip")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  headerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
  },
  headerEmoji: { fontSize: 28, marginBottom: 6 },
  headerTitle: { color: COLORS.white, fontWeight: "bold", fontSize: 17, textAlign: "center", marginBottom: 4 },
  headerSub: { color: COLORS.white, opacity: 0.7, fontSize: 13, textAlign: "center" },
  subText: { textAlign: "center", marginBottom: 16, fontSize: 13 },
  ratingCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  ratingTitle: { fontWeight: "600", textAlign: "center", marginBottom: 12, fontSize: 14 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 10 },
  starButton: { padding: 4 },
  starText: { fontSize: 30 },
  ratingLabel: { textAlign: "center", marginTop: 10, fontSize: 13 },
  commentCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  commentTitle: { fontWeight: "600", marginBottom: 6, fontSize: 13 },
  commentInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    height: 80,
  },
  submitButton: { borderRadius: 5, paddingVertical: 9, alignItems: "center", marginBottom: 10 },
  submitButtonText: { fontWeight: "600", fontSize: 14 },
  skipButton: { paddingVertical: 10, alignItems: "center" },
  skipText: { fontSize: 13 },
});
