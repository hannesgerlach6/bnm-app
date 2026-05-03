import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  LayoutAnimation,
  ActivityIndicator,
} from "react-native";
import { showError, showSuccess } from "../lib/errorHandler";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { COLORS, RADIUS } from "../constants/Colors";
import { sendNewFeedbackNotification } from "../lib/emailService";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import { Container } from "../components/Container";
import { BNMPressable } from "../components/BNMPressable";
import { BNMInput } from "../components/BNMInput";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  QUESTIONNAIRE_SECTIONS,
  isConditionMet,
  validateSection,
} from "../lib/questionnaireConfig";
import type { QuestionConfig } from "../lib/questionnaireConfig";
import type { QuestionnaireAnswers } from "../types";

const TOTAL_SECTIONS = QUESTIONNAIRE_SECTIONS.length;

// ─── Star Rating Input ──────────────────────────────────────────────────────

function StarRatingInput({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (v: number) => void;
  error?: string;
}) {
  const themeColors = useThemeColors();
  const { t } = useLanguage();
  const labels = [
    t("feedback.rating1"),
    t("feedback.rating2"),
    t("feedback.rating3"),
    t("feedback.rating4"),
    t("feedback.rating5"),
  ];

  return (
    <View>
      <View style={styles.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <BNMPressable key={star} onPress={() => onChange(star)} style={styles.starButton} accessibilityRole="button" accessibilityLabel={`${star} Stern${star > 1 ? "e" : ""}`}>
            <Ionicons
              name={star <= value ? "star" : "star-outline"}
              size={32}
              color={star <= value ? COLORS.gold : themeColors.border}
            />
          </BNMPressable>
        ))}
      </View>
      {value > 0 && (
        <Text style={[styles.ratingLabel, { color: themeColors.textSecondary }]}>
          {labels[value - 1]}
        </Text>
      )}
      {error && <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>}
    </View>
  );
}

// ─── Chip Selector (Multi/Single) ───────────────────────────────────────────

function ChipSelector({
  options,
  selected,
  onChange,
  multi,
  error,
}: {
  options: { key: string; label: string }[];
  selected: string | string[];
  onChange: (v: string | string[]) => void;
  multi: boolean;
  error?: string;
}) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const handlePress = (key: string) => {
    if (multi) {
      const arr = Array.isArray(selected) ? selected : [];
      const next = arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key];
      onChange(next);
    } else {
      onChange(key === selected ? "" : key);
    }
  };

  return (
    <View>
      <View style={styles.chipGrid}>
        {options.map((opt) => {
          const isSelected = multi
            ? (Array.isArray(selected) && selected.includes(opt.key))
            : selected === opt.key;
          return (
            <BNMPressable
              key={opt.key}
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected
                    ? (isDark ? COLORS.gold + "20" : COLORS.gold + "15")
                    : themeColors.card,
                  borderColor: isSelected ? COLORS.gold : themeColors.border,
                },
              ]}
              onPress={() => handlePress(opt.key)}
              accessibilityRole={multi ? "checkbox" : "radio"}
              accessibilityLabel={opt.label}
              accessibilityState={{ checked: multi ? (Array.isArray(selected) && selected.includes(opt.key)) : selected === opt.key }}
            >
              <Ionicons
                name={isSelected ? (multi ? "checkbox" : "radio-button-on") : (multi ? "square-outline" : "radio-button-off")}
                size={18}
                color={isSelected ? COLORS.gold : themeColors.textTertiary}
                style={{ marginRight: 8 }}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? themeColors.text : themeColors.textSecondary },
                  isSelected && { fontWeight: "600" },
                ]}
              >
                {opt.label}
              </Text>
            </BNMPressable>
          );
        })}
      </View>
      {error && <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>}
    </View>
  );
}

// ─── Progress Bar ───────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const themeColors = useThemeColors();
  return (
    <View style={styles.progressContainer}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.progressSegment,
            {
              backgroundColor: i <= current ? COLORS.gold : themeColors.border,
              flex: 1,
            },
          ]}
        />
      ))}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function FeedbackScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { addFeedback, getMentorshipById } = useData();
  const params = useLocalSearchParams<{ mentorshipId?: string; type?: string }>();
  const scrollRef = useRef<ScrollView>(null);

  const [currentSection, setCurrentSection] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showSummary, setShowSummary] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const isCancellation = params.type === "cancellation";
  const mentorship = params.mentorshipId ? getMentorshipById(params.mentorshipId) : undefined;

  const section = QUESTIONNAIRE_SECTIONS[currentSection];

  const setAnswer = useCallback((id: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  function handleNext() {
    const validationErrors = validateSection(section, answers);
    const translatedErrors: Record<string, string> = {};
    for (const [key, tKey] of Object.entries(validationErrors)) {
      translatedErrors[key] = t(tKey as any);
    }
    if (Object.keys(translatedErrors).length > 0) {
      setErrors(translatedErrors);
      return;
    }

    scrollRef.current?.scrollTo({ y: 0, animated: true });

    if (currentSection < TOTAL_SECTIONS - 1) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentSection((s) => s + 1);
      setErrors({});
    } else {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowSummary(true);
    }
  }

  function handleBack() {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    if (showSummary) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setShowSummary(false);
    } else if (currentSection > 0) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setCurrentSection((s) => s - 1);
      setErrors({});
    }
  }

  async function handleSubmit() {
    if (!user || !params.mentorshipId) {
      showError(t("feedback.errorMissing"));
      return;
    }

    setIsSaving(true);
    try {
      const questAnswers = answers as QuestionnaireAnswers;
      await addFeedback({
        mentorship_id: params.mentorshipId,
        submitted_by: user.id,
        rating: questAnswers.q1_1 || 0,
        comments: questAnswers.q1_2 || undefined,
        answers: questAnswers,
      });

      if (mentorship) {
        sendNewFeedbackNotification(
          mentorship.mentor?.name ?? t("common.unknown"),
          mentorship.mentee?.name ?? t("common.unknown"),
          questAnswers.q1_1 || 0,
          questAnswers.q1_2 || undefined,
        ).catch(() => {});
      }

      showSuccess(t("feedback.successMsg"));
      setTimeout(() => router.replace("/(tabs)"), 1500);
    } catch {
      showError(t("feedback.errorMissing"));
    } finally {
      setIsSaving(false);
    }
  }

  // ─── Question Renderer ──────────────────────────────────────────

  function renderQuestion(q: QuestionConfig) {
    if (!isConditionMet(q, answers)) return null;

    const error = errors[q.id];

    return (
      <View key={q.id} style={styles.questionBlock}>
        <Text style={[styles.questionLabel, { color: themeColors.text }]}>
          {t(q.translationKey as any)}
          {q.required && <Text style={{ color: COLORS.error }}> *</Text>}
        </Text>

        {q.type === "rating" && (
          <StarRatingInput
            value={answers[q.id] || 0}
            onChange={(v) => setAnswer(q.id, v)}
            error={error}
          />
        )}

        {q.type === "text" && (
          <View>
            <BNMInput
              label=""
              value={answers[q.id] || ""}
              onChangeText={(v: string) => setAnswer(q.id, v)}
              placeholder={t("feedback.commentPlaceholder")}
              multiline
              numberOfLines={3}
              error={error}
            />
          </View>
        )}

        {q.type === "multiselect" && q.options && (
          <ChipSelector
            options={q.options.map((o) => ({ key: o.key, label: t(o.translationKey as any) }))}
            selected={answers[q.id] || []}
            onChange={(v) => setAnswer(q.id, v)}
            multi
            error={error}
          />
        )}

        {q.type === "singleselect" && q.options && (
          <ChipSelector
            options={q.options.map((o) => ({ key: o.key, label: t(o.translationKey as any) }))}
            selected={answers[q.id] || ""}
            onChange={(v) => setAnswer(q.id, v)}
            multi={false}
            error={error}
          />
        )}
      </View>
    );
  }

  // ─── Summary View ───────────────────────────────────────────────

  function renderSummary() {
    return (
      <View>
        <Text style={[styles.summaryTitle, { color: themeColors.text }]}>
          {t("questionnaire.summary")}
        </Text>
        <Text style={[styles.summaryHint, { color: themeColors.textSecondary }]}>
          {t("questionnaire.summaryHint")}
        </Text>

        {QUESTIONNAIRE_SECTIONS.map((sec) => (
          <View key={sec.id} style={[styles.summaryCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.summarySectionTitle, { color: themeColors.primary }]}>
              {t(sec.titleKey as any)}
            </Text>
            {sec.questions.map((q) => {
              if (!isConditionMet(q, answers)) return null;
              const val = answers[q.id];
              if (val === undefined || val === null || val === "" || (Array.isArray(val) && val.length === 0)) return null;

              let display = "";
              if (q.type === "rating") {
                display = "★".repeat(val) + "☆".repeat(5 - val);
              } else if (q.type === "text") {
                display = String(val);
              } else if (q.type === "multiselect" && q.options) {
                display = (val as string[]).map((k) => {
                  const opt = q.options!.find((o) => o.key === k);
                  return opt ? t(opt.translationKey as any) : k;
                }).join(", ");
              } else if (q.type === "singleselect" && q.options) {
                const opt = q.options.find((o) => o.key === val);
                display = opt ? t(opt.translationKey as any) : String(val);
              }

              return (
                <View key={q.id} style={styles.summaryRow}>
                  <Text style={[styles.summaryQuestion, { color: themeColors.textSecondary }]}>
                    {t(q.translationKey as any)}
                  </Text>
                  <Text style={[styles.summaryAnswer, { color: themeColors.text }]}>
                    {display}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>
    );
  }

  // ─── Header ─────────────────────────────────────────────────────

  const statusLabel =
    mentorship?.status === "completed" ? t("feedback.completed") : t("feedback.cancelled");

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        behavior="padding"
      >
        <ScrollView
          ref={scrollRef}
          style={[styles.flex1, { backgroundColor: themeColors.background }]}
          contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + 32 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.page}>
            {/* Header Card */}
            <View style={[styles.headerCard, { backgroundColor: COLORS.gradientStart }]}>
              <Ionicons
                name={isCancellation ? "document-text-outline" : "ribbon-outline"}
                size={28}
                color={COLORS.gold}
                style={{ marginBottom: 6 }}
              />
              <Text style={styles.headerTitle}>
                {isCancellation ? t("feedback.cancellationTitle") : t("feedback.headerTitle").replace("{0}", statusLabel)}
              </Text>
              {mentorship && (
                <Text style={styles.headerSub}>
                  {mentorship.mentee?.name} & {mentorship.mentor?.name}
                </Text>
              )}
            </View>

            {/* Progress */}
            <View style={styles.progressSection}>
              <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
                {showSummary
                  ? t("questionnaire.summary")
                  : t("questionnaire.progress").replace("{0}", String(currentSection + 1)).replace("{1}", String(TOTAL_SECTIONS))}
              </Text>
              <ProgressBar current={showSummary ? TOTAL_SECTIONS : currentSection} total={TOTAL_SECTIONS} />
            </View>

            {/* Content */}
            {showSummary ? (
              renderSummary()
            ) : (
              <View style={[styles.sectionCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Text style={[styles.sectionTitle, { color: themeColors.primary }]}>
                  {t(section.titleKey as any)}
                </Text>
                {section.questions.map(renderQuestion)}
              </View>
            )}

            {/* Navigation */}
            <View style={styles.navRow}>
              {(currentSection > 0 || showSummary) && (
                <BNMPressable
                  style={[styles.navButton, styles.navButtonBack, { borderColor: themeColors.border }]}
                  onPress={handleBack}
                  accessibilityRole="button"
                  accessibilityLabel="Zurück"
                >
                  <Ionicons name="chevron-back" size={18} color={themeColors.text} />
                  <Text style={[styles.navButtonText, { color: themeColors.text }]}>
                    {t("questionnaire.back")}
                  </Text>
                </BNMPressable>
              )}
              <View style={{ flex: 1 }} />
              {showSummary ? (
                <BNMPressable
                  style={[styles.navButton, styles.navButtonSubmit]}
                  onPress={handleSubmit}
                  disabled={isSaving}
                  hapticStyle="success"
                  accessibilityRole="button"
                  accessibilityLabel="Absenden"
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.white} />
                      <Text style={[styles.navButtonText, { color: COLORS.white }]}>
                        {t("questionnaire.submit")}
                      </Text>
                    </>
                  )}
                </BNMPressable>
              ) : (
                <BNMPressable
                  style={[styles.navButton, styles.navButtonNext]}
                  onPress={handleNext}
                  hapticStyle="light"
                  accessibilityRole="button"
                  accessibilityLabel="Weiter"
                >
                  <Text style={[styles.navButtonText, { color: COLORS.white }]}>
                    {t("questionnaire.next")}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
                </BNMPressable>
              )}
            </View>

            {/* Skip */}
            <BNMPressable style={styles.skipButton} onPress={() => router.replace("/(tabs)")} accessibilityRole="link" accessibilityLabel="Überspringen">
              <Text style={[styles.skipText, { color: themeColors.textTertiary }]}>{t("feedback.skip")}</Text>
            </BNMPressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  page: { padding: 24 },

  // Header
  headerCard: {
    borderRadius: RADIUS.lg,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  headerTitle: { color: COLORS.white, fontWeight: "800", fontSize: 17, textAlign: "center", marginBottom: 4 },
  headerSub: { color: COLORS.white, opacity: 0.7, fontSize: 13, textAlign: "center" },

  // Progress
  progressSection: { marginBottom: 16 },
  progressText: { fontSize: 12, fontWeight: "600", marginBottom: 8, textAlign: "center" },
  progressContainer: { flexDirection: "row", gap: 4, height: 4 },
  progressSegment: { borderRadius: 2 },

  // Section Card
  sectionCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: { fontWeight: "700", fontSize: 16, marginBottom: 16 },

  // Questions
  questionBlock: { marginBottom: 20 },
  questionLabel: { fontWeight: "600", fontSize: 14, marginBottom: 10, lineHeight: 20 },

  // Stars
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 12 },
  starButton: { padding: 4 },
  ratingLabel: { textAlign: "center", marginTop: 8, fontSize: 13 },

  // Chips
  chipGrid: { gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  chipText: { fontSize: 14, flex: 1 },

  // Errors
  errorText: { fontSize: 12, marginTop: 6 },

  // Navigation
  navRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 8 },
  navButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: RADIUS.full,
  },
  navButtonBack: { borderWidth: 1.5 },
  navButtonNext: { backgroundColor: COLORS.gradientStart },
  navButtonSubmit: { backgroundColor: COLORS.cta },
  navButtonText: { fontWeight: "600", fontSize: 14 },

  // Skip
  skipButton: { paddingVertical: 12, alignItems: "center" },
  skipText: { fontSize: 13 },

  // Summary
  summaryTitle: { fontWeight: "800", fontSize: 20, marginBottom: 4 },
  summaryHint: { fontSize: 13, marginBottom: 16 },
  summaryCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  summarySectionTitle: { fontWeight: "700", fontSize: 14, marginBottom: 12 },
  summaryRow: { marginBottom: 10 },
  summaryQuestion: { fontSize: 12, marginBottom: 2 },
  summaryAnswer: { fontSize: 14, fontWeight: "500" },
});
