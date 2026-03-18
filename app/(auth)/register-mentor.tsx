import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import type { Gender, ContactPreference } from "../../types";
import { COLORS } from "../../constants/Colors";

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

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: "male", label: "Bruder" },
  { value: "female", label: "Schwester" },
];

const CONTACT_OPTIONS: { value: ContactPreference; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "phone", label: "Telefon" },
  { value: "telegram", label: "Telegram" },
  { value: "email", label: "E-Mail" },
];

export default function RegisterMentorScreen() {
  const router = useRouter();
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
    if (!form.name.trim()) newErrors.name = "Pflichtfeld";
    if (!form.email.trim()) newErrors.email = "Pflichtfeld";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Ungültige E-Mail";
    if (!form.gender) newErrors.gender = "Pflichtfeld";
    if (!form.city.trim()) newErrors.city = "Pflichtfeld";
    if (!form.age.trim()) newErrors.age = "Pflichtfeld";
    else if (isNaN(Number(form.age)) || Number(form.age) < 18)
      newErrors.age = "Mindestalter: 18 Jahre";
    if (!form.contact_preference)
      newErrors.contact_preference = "Pflichtfeld";
    if (!form.motivation.trim()) newErrors.motivation = "Pflichtfeld";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    Alert.alert(
      "Bewerbung eingegangen",
      "Vielen Dank für deine Bewerbung als Mentor! Das BNM-Team wird deine Bewerbung prüfen und sich bei dir melden.",
      [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
    );
  }

  function update(field: keyof MentorFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.intro}>
            Bewirb dich als Mentor und begleite neue Muslime auf ihrem Weg.
          </Text>

          {/* Name */}
          <FieldLabel label="Vollständiger Name" error={errors.name} />
          <TextInput
            style={[styles.input, errors.name ? styles.inputError : styles.inputNormal]}
            placeholder="Dein Name"
            placeholderTextColor="#98A2B3"
            value={form.name}
            onChangeText={(v) => update("name", v)}
          />

          {/* E-Mail */}
          <FieldLabel label="E-Mail-Adresse" error={errors.email} />
          <TextInput
            style={[styles.input, errors.email ? styles.inputError : styles.inputNormal]}
            placeholder="deine@email.de"
            placeholderTextColor="#98A2B3"
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => update("email", v)}
          />

          {/* Telefon */}
          <FieldLabel label="Telefonnummer (optional)" />
          <TextInput
            style={[styles.input, styles.inputNormal]}
            placeholder="+49 151 ..."
            placeholderTextColor="#98A2B3"
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
          />

          {/* Geschlecht */}
          <FieldLabel label="Ich bin" error={errors.gender} />
          <View style={styles.rowGap3Mb4}>
            {GENDER_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.toggleButton,
                  form.gender === opt.value
                    ? styles.toggleButtonActive
                    : styles.toggleButtonInactive,
                ]}
                onPress={() => update("gender", opt.value)}
              >
                <Text
                  style={
                    form.gender === opt.value
                      ? styles.toggleTextActive
                      : styles.toggleTextInactive
                  }
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Stadt */}
          <FieldLabel label="Wohnort / Stadt" error={errors.city} />
          <TextInput
            style={[styles.input, errors.city ? styles.inputError : styles.inputNormal]}
            placeholder="z.B. Hamburg"
            placeholderTextColor="#98A2B3"
            value={form.city}
            onChangeText={(v) => update("city", v)}
          />

          {/* Alter */}
          <FieldLabel label="Alter (mindestens 18)" error={errors.age} />
          <TextInput
            style={[styles.input, errors.age ? styles.inputError : styles.inputNormal]}
            placeholder="z.B. 28"
            placeholderTextColor="#98A2B3"
            keyboardType="number-pad"
            value={form.age}
            onChangeText={(v) => update("age", v)}
          />

          {/* Kontaktpräferenz */}
          <FieldLabel
            label="Bevorzugter Kontaktweg"
            error={errors.contact_preference}
          />
          <View style={styles.chipRow}>
            {CONTACT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.value}
                style={[
                  styles.chip,
                  form.contact_preference === opt.value
                    ? styles.chipActive
                    : styles.chipInactive,
                ]}
                onPress={() => update("contact_preference", opt.value)}
              >
                <Text
                  style={[
                    styles.chipText,
                    form.contact_preference === opt.value
                      ? styles.chipTextActive
                      : styles.chipTextInactive,
                  ]}
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Erfahrung */}
          <FieldLabel
            label="Erfahrung (optional)"
            error={errors.experience}
          />
          <TextInput
            style={[styles.input, styles.inputNormal, { minHeight: 80 }]}
            placeholder="Wie lange bist du Muslim? Hast du Erfahrung in der Dawah-Arbeit?"
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            value={form.experience}
            onChangeText={(v) => update("experience", v)}
          />

          {/* Motivation */}
          <FieldLabel
            label="Motivation / Warum möchtest du Mentor werden?"
            error={errors.motivation}
          />
          <TextInput
            style={[
              styles.input,
              errors.motivation ? styles.inputError : styles.inputNormal,
              { minHeight: 100, marginBottom: 24 },
            ]}
            placeholder="Erzähl uns, warum du neuen Muslimen helfen möchtest..."
            placeholderTextColor="#98A2B3"
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={form.motivation}
            onChangeText={(v) => update("motivation", v)}
          />

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              Bewerbung einreichen
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
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text style={{ color: COLORS.secondary, fontSize: 14, fontWeight: "500" }}>{label}</Text>
      {error ? <Text style={{ color: "#ef4444", fontSize: 12 }}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  intro: {
    color: COLORS.secondary,
    fontSize: 14,
    marginBottom: 24,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.primary,
    marginBottom: 16,
  },
  inputNormal: {
    borderColor: COLORS.border,
  },
  inputError: {
    borderColor: "#f87171",
  },
  rowGap3Mb4: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
  },
  toggleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  toggleButtonInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  toggleTextActive: {
    color: COLORS.white,
    fontWeight: "500",
  },
  toggleTextInactive: {
    color: COLORS.secondary,
    fontWeight: "500",
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  chipInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  chipText: {
    fontSize: 14,
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
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  submitButtonText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 16,
  },
});
