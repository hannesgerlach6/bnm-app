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
import { useData } from "../../contexts/DataContext";

interface MenteeFormData {
  name: string;
  email: string;
  gender: Gender | "";
  city: string;
  age: string;
  phone: string;
  contact_preference: ContactPreference | "";
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

export default function RegisterMenteeScreen() {
  const router = useRouter();
  const { users } = useData();
  const [form, setForm] = useState<MenteeFormData>({
    name: "",
    email: "",
    gender: "",
    city: "",
    age: "",
    phone: "",
    contact_preference: "",
  });
  const [errors, setErrors] = useState<Partial<MenteeFormData>>({});

  function validate(): boolean {
    const newErrors: Partial<MenteeFormData> = {};
    if (!form.name.trim()) newErrors.name = "Pflichtfeld";
    if (!form.email.trim()) newErrors.email = "Pflichtfeld";
    else if (!/\S+@\S+\.\S+/.test(form.email))
      newErrors.email = "Ungültige E-Mail";
    if (!form.gender) newErrors.gender = "Pflichtfeld";
    if (!form.city.trim()) newErrors.city = "Pflichtfeld";
    if (!form.age.trim()) newErrors.age = "Pflichtfeld";
    else if (isNaN(Number(form.age)) || Number(form.age) < 10)
      newErrors.age = "Ungültiges Alter";
    if (!form.contact_preference)
      newErrors.contact_preference = "Pflichtfeld";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit() {
    if (!validate()) return;
    const emailLower = form.email.trim().toLowerCase();
    const exists = users.some((u) => u.email.toLowerCase() === emailLower);
    if (exists) {
      setErrors((prev) => ({ ...prev, email: "Diese E-Mail ist bereits registriert." }));
      return;
    }
    Alert.alert(
      "Registrierung eingegangen",
      "Vielen Dank! Deine Registrierung wurde eingereicht. Das BNM-Team wird sich bald bei dir melden.",
      [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
    );
  }

  function update(field: keyof MenteeFormData, value: string) {
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
            Melde dich als neuer Muslim an, um einer Betreuung zugewiesen zu werden.
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
          <View style={styles.rowGap3Mb3}>
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
            placeholder="z.B. Berlin"
            placeholderTextColor="#98A2B3"
            value={form.city}
            onChangeText={(v) => update("city", v)}
          />

          {/* Alter */}
          <FieldLabel label="Alter" error={errors.age} />
          <TextInput
            style={[styles.input, errors.age ? styles.inputError : styles.inputNormal]}
            placeholder="z.B. 25"
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

          {/* Submit */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
          >
            <Text style={styles.submitButtonText}>
              Registrierung einreichen
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
      <Text style={{ color: COLORS.secondary, fontSize: 13, fontWeight: "500" }}>{label}</Text>
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
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  intro: {
    color: COLORS.secondary,
    fontSize: 13,
    marginBottom: 16,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
    marginBottom: 12,
    fontSize: 14,
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
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
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
    marginBottom: 16,
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
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
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
});
