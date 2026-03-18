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
import { useRouter } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import type { ContactPreference } from "../types";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";

const CONTACT_OPTIONS: { key: ContactPreference; label: string }[] = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "phone", label: "Telefon" },
  { key: "telegram", label: "Telegram" },
  { key: "email", label: "E-Mail" },
];

export default function EditProfileScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { updateUser } = useData();

  const [name, setName] = useState(user?.name ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [age, setAge] = useState(String(user?.age ?? ""));
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [contactPref, setContactPref] = useState<ContactPreference>(
    user?.contact_preference ?? "email"
  );
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return null;

  function validate(): string | null {
    if (!name.trim()) return "Name darf nicht leer sein.";
    if (!city.trim()) return "Stadt darf nicht leer sein.";
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 14 || ageNum > 99) return "Bitte ein gültiges Alter (14–99) eingeben.";
    return null;
  }

  async function handleSave() {
    const error = validate();
    if (error) {
      Alert.alert("Fehler", error);
      return;
    }

    setIsSaving(true);
    await updateUser(user.id, {
      name: name.trim(),
      city: city.trim(),
      age: parseInt(age, 10),
      phone: phone.trim() || undefined,
      contact_preference: contactPref,
    });
    setIsSaving(false);
    Alert.alert("Gespeichert", "Dein Profil wurde aktualisiert.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  }

  return (
    <Container>
      <View style={styles.root}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>‹ Zurück</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profil bearbeiten</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Name */}
          <Text style={styles.fieldLabel}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Vor- und Nachname"
            placeholderTextColor={COLORS.tertiary}
            autoCapitalize="words"
          />

          {/* Stadt */}
          <Text style={styles.fieldLabel}>Stadt</Text>
          <TextInput
            style={styles.input}
            value={city}
            onChangeText={setCity}
            placeholder="z.B. Berlin"
            placeholderTextColor={COLORS.tertiary}
            autoCapitalize="words"
          />

          {/* Alter */}
          <Text style={styles.fieldLabel}>Alter</Text>
          <TextInput
            style={styles.input}
            value={age}
            onChangeText={setAge}
            placeholder="z.B. 28"
            placeholderTextColor={COLORS.tertiary}
            keyboardType="number-pad"
          />

          {/* Telefon */}
          <Text style={styles.fieldLabel}>Telefonnummer (optional)</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+49 151 ..."
            placeholderTextColor={COLORS.tertiary}
            keyboardType="phone-pad"
          />

          {/* Kontaktpräferenz */}
          <Text style={styles.fieldLabel}>Kontaktpräferenz</Text>
          <View style={styles.contactGrid}>
            {CONTACT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.contactChip,
                  contactPref === opt.key ? styles.contactChipActive : styles.contactChipInactive,
                ]}
                onPress={() => setContactPref(opt.key)}
              >
                <Text
                  style={
                    contactPref === opt.key
                      ? styles.contactChipTextActive
                      : styles.contactChipTextInactive
                  }
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unveränderliche Info */}
          <View style={styles.infoBox}>
            <Text style={styles.infoBoxTitle}>Nicht änderbar</Text>
            <Text style={styles.infoBoxText}>
              E-Mail-Adresse und Rolle können nicht selbst geändert werden.
              Bitte wende dich an das BNM-Team.
            </Text>
            <Text style={styles.infoBoxValue}>{user.email}</Text>
          </View>

          {/* Speichern */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? "Speichern..." : "Änderungen speichern"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
            <Text style={styles.cancelButtonText}>Abbrechen</Text>
          </TouchableOpacity>

        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { flex: 1 },
  backText: { color: COLORS.primary, fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  fieldLabel: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  contactGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 14,
  },
  contactChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1,
  },
  contactChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  contactChipInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  contactChipTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  contactChipTextInactive: { color: COLORS.secondary, fontWeight: "500", fontSize: 13 },
  infoBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxTitle: { fontWeight: "700", color: "#1e40af", fontSize: 13, marginBottom: 4 },
  infoBoxText: { color: "#2563eb", fontSize: 13, lineHeight: 18, marginBottom: 6 },
  infoBoxValue: { color: "#1e40af", fontSize: 13, fontWeight: "600" },
  saveButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  cancelButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelButtonText: { color: COLORS.secondary, fontWeight: "500", fontSize: 14 },
});
