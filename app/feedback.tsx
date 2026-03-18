import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { COLORS } from "../constants/Colors";

export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addFeedback, getMentorshipById } = useData();
  const params = useLocalSearchParams<{ mentorshipId?: string }>();

  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);

  const mentorship = params.mentorshipId
    ? getMentorshipById(params.mentorshipId)
    : undefined;

  async function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Bewertung fehlt", "Bitte wähle eine Bewertung (1–5 Sterne).");
      return;
    }
    if (!user || !params.mentorshipId) {
      Alert.alert("Fehler", "Fehlende Informationen.");
      return;
    }

    setIsSaving(true);
    addFeedback({
      mentorship_id: params.mentorshipId,
      submitted_by: user.id,
      rating,
      comments: comment.trim() || undefined,
    });

    await new Promise((resolve) => setTimeout(resolve, 400));
    setIsSaving(false);

    Alert.alert(
      "Danke für dein Feedback!",
      "Deine Rückmeldung wurde gespeichert.",
      [{ text: "OK", onPress: () => router.replace("/(tabs)") }]
    );
  }

  const statusLabel =
    mentorship?.status === "completed" ? "abgeschlossen" : "abgebrochen";

  const ratingLabel =
    rating === 1
      ? "Verbesserungsbedarf"
      : rating === 2
      ? "Teilweise gut"
      : rating === 3
      ? "Gut"
      : rating === 4
      ? "Sehr gut"
      : "Ausgezeichnet!";

  const isDisabled = isSaving || rating === 0;

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerCard}>
          <Text style={styles.headerEmoji}>
            {mentorship?.status === "completed" ? "🎉" : "📝"}
          </Text>
          <Text style={styles.headerTitle}>Betreuung {statusLabel}</Text>
          {mentorship && (
            <Text style={styles.headerSub}>
              {mentorship.mentee?.name} & {mentorship.mentor?.name}
            </Text>
          )}
        </View>

        <Text style={styles.subText}>
          Dein Feedback hilft uns, das BNM-Programm zu verbessern.
        </Text>

        {/* Sternbewertung */}
        <View style={styles.ratingCard}>
          <Text style={styles.ratingTitle}>Wie bewertest du die Betreuung?</Text>
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
            <Text style={styles.ratingLabel}>{ratingLabel}</Text>
          )}
        </View>

        {/* Kommentar */}
        <View style={styles.commentCard}>
          <Text style={styles.commentTitle}>Kommentar (optional)</Text>
          <TextInput
            style={[styles.commentInput, { minHeight: 120 }]}
            value={comment}
            onChangeText={setComment}
            placeholder="Dein Feedback zur Betreuung..."
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={5}
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
            {isSaving ? "Wird gespeichert..." : "Feedback absenden"}
          </Text>
        </TouchableOpacity>

        {/* Überspringen */}
        <TouchableOpacity
          style={styles.skipButton}
          onPress={() => router.replace("/(tabs)")}
        >
          <Text style={styles.skipText}>Überspringen</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 24 },
  headerCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    alignItems: "center",
  },
  headerEmoji: { fontSize: 36, marginBottom: 8 },
  headerTitle: { color: COLORS.white, fontWeight: "bold", fontSize: 20, textAlign: "center", marginBottom: 4 },
  headerSub: { color: COLORS.white, opacity: 0.7, fontSize: 14, textAlign: "center" },
  subText: { color: COLORS.secondary, textAlign: "center", marginBottom: 24 },
  ratingCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 20,
    marginBottom: 16,
  },
  ratingTitle: { fontWeight: "bold", color: COLORS.primary, textAlign: "center", marginBottom: 16 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  starButton: { padding: 4 },
  starText: { fontSize: 36 },
  ratingLabel: { color: COLORS.secondary, textAlign: "center", marginTop: 12, fontSize: 14 },
  commentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 24,
  },
  commentTitle: { fontWeight: "600", color: COLORS.primary, marginBottom: 8 },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: COLORS.primary,
  },
  submitButton: { borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  submitButtonText: { fontWeight: "bold", fontSize: 16 },
  skipButton: { paddingVertical: 12, alignItems: "center" },
  skipText: { color: COLORS.tertiary, fontSize: 14 },
});
