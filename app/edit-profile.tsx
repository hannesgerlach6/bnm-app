import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { showError, showSuccess } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import type { ContactPreference } from "../types";
import { COLORS } from "../constants/Colors";
import { Container } from "../components/Container";
import { uploadAvatar } from "../lib/storage";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { updateUser } = useData();

  const CONTACT_OPTIONS: { key: ContactPreference; label: string }[] = [
    { key: "whatsapp", label: t("contactPref.whatsapp") },
    { key: "phone", label: t("contactPref.phone") },
    { key: "telegram", label: t("contactPref.telegram") },
    { key: "email", label: t("contactPref.email") },
  ];

  const [name, setName] = useState(user?.name ?? "");
  const [city, setCity] = useState(user?.city ?? "");
  const [plz, setPlz] = useState(user?.plz ?? "");
  const [age, setAge] = useState(String(user?.age ?? ""));
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [contactPref, setContactPref] = useState<ContactPreference>(
    user?.contact_preference ?? "email"
  );
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | undefined>(user?.avatar_url);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Web-only: verstecktes file-input Element
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!user) return null;

  // user ist hier garantiert nicht null (Early Return oben)
  const safeUser = user;

  async function handleAvatarPickWeb(uri: string) {
    if (!uri) return;
    setIsUploadingAvatar(true);
    setAvatarPreview(uri);
    const publicUrl = await uploadAvatar(safeUser.id, uri);
    if (publicUrl) {
      await updateUser(safeUser.id, { avatar_url: publicUrl });
      setAvatarPreview(publicUrl);
    } else {
      showError(t("editProfile.errorUpload"));
      setAvatarPreview(safeUser.avatar_url);
    }
    setIsUploadingAvatar(false);
  }

  function handleAvatarPress() {
    if (Platform.OS === 'web') {
      // Web: verstecktes input[type=file] triggern
      fileInputRef.current?.click();
    } else {
      // Native: expo-image-picker wäre nötig — Package noch nicht installiert
      showError(t("editProfile.nativeImagePicker"));
    }
  }

  function validate(): string | null {
    if (!name.trim()) return t("editProfile.errorName");
    if (!city.trim()) return t("editProfile.errorCity");
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 14 || ageNum > 99) return t("editProfile.errorAge");
    return null;
  }

  async function handleSave() {
    const error = validate();
    if (error) {
      showError(error);
      return;
    }

    setIsSaving(true);
    await updateUser(safeUser.id, {
      name: name.trim(),
      city: city.trim(),
      plz: plz.trim(),
      age: parseInt(age, 10),
      phone: phone.trim() || undefined,
      contact_preference: contactPref,
    });
    // AuthContext-User aktualisieren damit Profil-Seite die neuen Werte zeigt
    await refreshUser();
    setIsSaving(false);
    showSuccess(t("editProfile.successMsg"), () => router.back());
  }

  return (
    <Container>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: themeColors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("editProfile.back")}</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("editProfile.title")}</Text>
          <View style={styles.headerRight} />
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>

          {/* Profilbild */}
          <View style={styles.avatarSection}>
            {avatarPreview ? (
              <Image
                source={{ uri: avatarPreview }}
                style={styles.avatarPreview}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitials}>
                  {safeUser.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()
                    .slice(0, 2)}
                </Text>
              </View>
            )}
            <TouchableOpacity
              style={[styles.avatarButton, isUploadingAvatar && styles.avatarButtonDisabled]}
              onPress={handleAvatarPress}
              disabled={isUploadingAvatar}
            >
              <Text style={styles.avatarButtonText}>
                {isUploadingAvatar ? t("editProfile.uploading") : t("editProfile.changePicture")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Web: verstecktes file-input */}
          {Platform.OS === 'web' && (
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const objectUrl = URL.createObjectURL(file);
                handleAvatarPickWeb(objectUrl);
                // Input zurücksetzen damit dasselbe Bild nochmal gewählt werden kann
                e.target.value = '';
              }}
            />
          )}

          {/* Name */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.name")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={name}
            onChangeText={setName}
            placeholder={t("editProfile.namePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            autoCapitalize="words"
          />

          {/* Stadt */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.city")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={city}
            onChangeText={setCity}
            placeholder={t("editProfile.cityPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            autoCapitalize="words"
          />

          {/* Postleitzahl */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("profile.plz")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={plz}
            onChangeText={setPlz}
            placeholder={t("register.plzPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="number-pad"
            maxLength={5}
          />

          {/* Alter */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.age")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={age}
            onChangeText={setAge}
            placeholder={t("editProfile.agePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="number-pad"
          />

          {/* Telefon */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.phone")}</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
            value={phone}
            onChangeText={setPhone}
            placeholder="+49 151 ..."
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
          />

          {/* Kontaktpräferenz */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.contactPref")}</Text>
          <View style={styles.contactGrid}>
            {CONTACT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[
                  styles.contactChip,
                  contactPref === opt.key ? styles.contactChipActive : [styles.contactChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setContactPref(opt.key)}
              >
                <Text
                  style={
                    contactPref === opt.key
                      ? styles.contactChipTextActive
                      : [styles.contactChipTextInactive, { color: themeColors.textSecondary }]
                  }
                >
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Unveränderliche Info */}
          <View style={[styles.infoBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
            <Text style={[styles.infoBoxTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{t("editProfile.unchangeable")}</Text>
            <Text style={[styles.infoBoxText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
              {t("editProfile.unchangeableText")}
            </Text>
            <Text style={[styles.infoBoxValue, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{safeUser.email}</Text>
          </View>

          {/* Speichern */}
          <TouchableOpacity
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? t("editProfile.saving") : t("editProfile.save")}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.cancelButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} onPress={() => router.back()}>
            <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>{t("editProfile.cancel")}</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "bold", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
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
  contactChipInactive: {},
  contactChipTextActive: { color: COLORS.white, fontWeight: "600", fontSize: 13 },
  contactChipTextInactive: { fontWeight: "500", fontSize: 13 },
  infoBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxTitle: { fontWeight: "700", fontSize: 13, marginBottom: 4 },
  infoBoxText: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  infoBoxValue: { fontSize: 13, fontWeight: "600" },
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
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelButtonText: { fontWeight: "500", fontSize: 14 },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarPreview: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  avatarInitials: {
    color: COLORS.gold,
    fontSize: 26,
    fontWeight: "700",
  },
  avatarButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  avatarButtonDisabled: { opacity: 0.5 },
  avatarButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "500" },
});
