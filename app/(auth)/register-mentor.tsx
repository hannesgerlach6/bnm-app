import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { showError, showSuccess } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import type { Gender, ContactPreference } from "../../types";
import { COLORS } from "../../constants/Colors";
import { useThemeColors } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { sendNewMentorApplicationNotification } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";

interface MentorFormData {
  name: string;
  email: string;
  gender: Gender | "";
  city: string;
  age: string;
  phone: string;
  contact_preference: ContactPreference | "";
  experience: string;
  motivation: string;
}

export default function RegisterMentorScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState<MentorFormData>({
    name: "",
    email: "",
    gender: "",
    city: "",
    age: "",
    phone: "",
    contact_preference: "",
    experience: "",
    motivation: "",
  });
  const [errors, setErrors] = useState<Partial<Record<keyof MentorFormData, string>>>({});

  function validate(): boolean {
    const newErrors: Partial<Record<keyof MentorFormData, string>> = {};
    if (!form.name.trim()) newErrors.name = t("registerMentor.required");
    if (!form.email.trim()) newErrors.email = t("registerMentor.required");
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = t("registerMentor.invalidEmail");
    if (!form.gender) newErrors.gender = t("registerMentor.required");
    if (!form.city.trim()) newErrors.city = t("registerMentor.required");
    if (!form.age.trim()) newErrors.age = t("registerMentor.required");
    else if (isNaN(Number(form.age)) || Number(form.age) < 18)
      newErrors.age = t("registerMentor.minAge");
    if (!form.contact_preference)
      newErrors.contact_preference = t("registerMentor.required");
    if (!form.motivation.trim()) newErrors.motivation = t("registerMentor.required");

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const emailLower = form.email.trim().toLowerCase();

      // Mentor-Bewerbung in mentor_applications speichern
      const { error } = await supabase.from("mentor_applications").insert({
        name: form.name.trim(),
        email: emailLower,
        phone: form.phone.trim() || "",
        gender: form.gender,
        city: form.city.trim(),
        age: parseInt(form.age, 10),
        experience: form.experience.trim(),
        motivation: form.motivation.trim(),
        contact_preference: form.contact_preference,
        status: "pending",
      });

      if (error) {
        showError(error.message);
        setIsSubmitting(false);
        return;
      }

      // E-Mail-Benachrichtigung an Admin
      await sendNewMentorApplicationNotification(
        form.name.trim(),
        emailLower,
        form.city.trim(),
        form.gender
      );

      setSubmitted(true);
    } catch {
      showError(t("registerMentor.errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  function update(field: keyof MentorFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  const genderOptions: { value: Gender; label: string }[] = [
    { value: "male", label: t("register.brother") },
    { value: "female", label: t("register.sister") },
  ];

  const contactOptions: { value: ContactPreference; label: string }[] = [
    { value: "whatsapp", label: t("contactPref.whatsapp") },
    { value: "phone", label: t("contactPref.phone") },
    { value: "telegram", label: t("contactPref.telegram") },
    { value: "email", label: t("contactPref.email") },
  ];

  if (submitted) {
    return (
      <View style={[styles.successContainer, { backgroundColor: themeColors.background }]}>
        <View style={styles.successIcon}>
          <Text style={{ color: COLORS.white, fontSize: 28, fontWeight: "bold" }}>✓</Text>
        </View>
        <Text style={[styles.successTitle, { color: themeColors.text }]}>{t("registerMentor.successTitle")}</Text>
        <Text style={[styles.successText, { color: themeColors.textSecondary }]}>{t("registerMentor.successMsg")}</Text>
        <TouchableOpacity
          style={styles.successButton}
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text style={styles.successButtonText}>{t("login.submit")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex1, { backgroundColor: themeColors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={[styles.intro, { color: themeColors.textSecondary }]}>
            {t("registerMentor.intro")}
          </Text>

          {/* Name */}
          <FieldLabel label={t("registerMentor.name")} error={errors.name} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.name ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder={t("registerMentor.namePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={form.name}
            onChangeText={(v) => update("name", v)}
          />

          {/* E-Mail */}
          <FieldLabel label={t("registerMentor.email")} error={errors.email} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.email ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder="deine@email.de"
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => update("email", v)}
          />

          {/* Telefon */}
          <FieldLabel label={t("registerMentor.phone")} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            placeholder="+49 151 ..."
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
          />

          {/* Geschlecht */}
          <FieldLabel label={t("registerMentor.gender")} error={errors.gender} />
          <View style={styles.rowGap3Mb3}>
            {genderOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.toggleButton,
                  form.gender === opt.value
                    ? styles.toggleButtonActive
                    : [styles.toggleButtonInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => update("gender", opt.value)}
              >
                <Text
                  style={
                    form.gender === opt.value
                      ? styles.toggleTextActive
                      : [styles.toggleTextInactive, { color: themeColors.textSecondary }]
                  }
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stadt */}
          <FieldLabel label={t("registerMentor.city")} error={errors.city} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.city ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder={t("registerMentor.cityPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={form.city}
            onChangeText={(v) => update("city", v)}
          />

          {/* Alter */}
          <FieldLabel label={t("registerMentor.age")} error={errors.age} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.age ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder={t("registerMentor.agePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="number-pad"
            value={form.age}
            onChangeText={(v) => update("age", v)}
          />

          {/* Kontaktpräferenz */}
          <FieldLabel
            label={t("registerMentor.contactPref")}
            error={errors.contact_preference}
          />
          <View style={styles.chipRow}>
            {contactOptions.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  form.contact_preference === opt.value
                    ? styles.chipActive
                    : [styles.chipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => update("contact_preference", opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.contact_preference === opt.value
                      ? styles.chipTextActive
                      : [styles.chipTextInactive, { color: themeColors.textSecondary }],
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Erfahrung */}
          <FieldLabel label={t("registerMentor.experience")} error={errors.experience} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }, styles.textarea]}
            placeholder={t("registerMentor.experiencePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={form.experience}
            onChangeText={(v) => update("experience", v)}
          />

          {/* Motivation */}
          <FieldLabel
            label={t("registerMentor.motivation")}
            error={errors.motivation}
          />
          <TextInput
            style={[
              styles.input,
              { backgroundColor: themeColors.card, color: themeColors.text },
              errors.motivation ? styles.inputError : { borderColor: themeColors.border },
              styles.textarea,
              { marginBottom: 16 },
            ]}
            placeholder={t("registerMentor.motivationPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={form.motivation}
            onChangeText={(v) => update("motivation", v)}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting ? { opacity: 0.6 } : {}]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? t("registerMentor.submitting") : t("registerMentor.submit")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldLabel({
  label,
  error,
}: {
  label: string;
  error?: string;
}) {
  const themeColors = useThemeColors();
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text style={{ color: themeColors.textSecondary, fontSize: 13, fontWeight: "500", flex: 1 }}>{label}</Text>
      {error ? <Text style={{ color: "#ef4444", fontSize: 12, marginLeft: 8 }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  intro: {
    fontSize: 13,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  textarea: {
    height: 80,
  },
  inputNormal: {
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: "#f87171",
  },
  rowGap3Mb3: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleButtonInactive: {
  },
  toggleTextActive: {
    color: COLORS.white,
    fontWeight: "500",
    fontSize: 13,
  },
  toggleTextInactive: {
    color: COLORS.secondary,
    fontWeight: "500",
    fontSize: 13,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipInactive: {
  },
  chipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  chipTextActive: {
    color: COLORS.white,
  },
  chipTextInactive: {
    color: COLORS.secondary,
  },
  submitButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 10,
    alignItems: "center",
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.cta,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    textAlign: "center",
  },
  successText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  successButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
});
