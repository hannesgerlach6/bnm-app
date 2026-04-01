import React, { useState, useRef } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { BNMPressable } from "../components/BNMPressable";
import { BNMInput } from "../components/BNMInput";
import * as ImagePicker from "expo-image-picker";
import { showError, showSuccess } from "../lib/errorHandler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import type { ContactPreference } from "../types";
import { COLORS, RADIUS } from "../constants/Colors";
import { Container } from "../components/Container";
import { uploadAvatar } from "../lib/storage";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";
import { geocodePLZ } from "../lib/geocoding";

export default function EditProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { updateUser, refreshData } = useData();

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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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

  async function handleAvatarPickNative() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      showError("Zugriff auf Fotos wurde verweigert. Bitte erlaube den Zugriff in den Einstellungen.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;
    setIsUploadingAvatar(true);
    setAvatarPreview(result.assets[0].uri);
    const publicUrl = await uploadAvatar(safeUser.id, result.assets[0].uri);
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
      fileInputRef.current?.click();
    } else {
      handleAvatarPickNative();
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
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = t("editProfile.errorName");
    if (!city.trim()) errors.city = t("editProfile.errorCity");
    const ageNum = parseInt(age, 10);
    if (isNaN(ageNum) || ageNum < 14 || ageNum > 99) errors.age = t("editProfile.errorAge");
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});

    setIsSaving(true);
    const plzChanged = plz.trim() !== (safeUser.plz ?? "");
    const coords = plzChanged ? await geocodePLZ(plz.trim()) : null;
    await updateUser(safeUser.id, {
      name: name.trim(),
      city: city.trim(),
      plz: plz.trim(),
      age: parseInt(age, 10),
      phone: phone.trim() || undefined,
      contact_preference: contactPref,
      ...(coords ? { lat: coords.lat, lng: coords.lng } : {}),
    });
    // AuthContext + DataContext aktualisieren
    await Promise.all([refreshUser(), refreshData()]);
    setIsSaving(false);
    showSuccess(t("editProfile.successMsg"), () => router.back());
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: themeColors.background }]}
        behavior="padding"
      >
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t("editProfile.back")}>
            <Text style={[styles.backText, { color: themeColors.text }]}>{t("editProfile.back")}</Text>
          </BNMPressable>
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
                accessibilityLabel={`Profilbild von ${safeUser.name}`}
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
            <BNMPressable
              style={[styles.avatarButton, isUploadingAvatar && styles.avatarButtonDisabled]}
              onPress={handleAvatarPress}
              disabled={isUploadingAvatar}
              accessibilityRole="button"
              accessibilityLabel={isUploadingAvatar ? t("editProfile.uploading") : t("editProfile.changePicture")}
              accessibilityState={{ disabled: isUploadingAvatar }}
            >
              <Text style={styles.avatarButtonText}>
                {isUploadingAvatar ? t("editProfile.uploading") : t("editProfile.changePicture")}
              </Text>
            </BNMPressable>
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
          <BNMInput
            label={t("editProfile.name")}
            icon="person-outline"
            value={name}
            onChangeText={(v) => { setName(v); if (fieldErrors.name) setFieldErrors(p => ({ ...p, name: "" })); }}
            autoCapitalize="words"
            error={fieldErrors.name}
            accessibilityLabel={t("editProfile.name")}
          />

          {/* Stadt */}
          <BNMInput
            label={t("editProfile.city")}
            icon="location-outline"
            value={city}
            onChangeText={(v) => { setCity(v); if (fieldErrors.city) setFieldErrors(p => ({ ...p, city: "" })); }}
            autoCapitalize="words"
            error={fieldErrors.city}
            accessibilityLabel={t("editProfile.city")}
          />

          {/* Postleitzahl */}
          <BNMInput
            label={t("profile.plz")}
            icon="navigate-outline"
            value={plz}
            onChangeText={setPlz}
            keyboardType="number-pad"
            maxLength={5}
            accessibilityLabel={t("profile.plz")}
          />

          {/* Alter */}
          <BNMInput
            label={t("editProfile.age")}
            value={age}
            onChangeText={(v) => { setAge(v); if (fieldErrors.age) setFieldErrors(p => ({ ...p, age: "" })); }}
            keyboardType="number-pad"
            error={fieldErrors.age}
            accessibilityLabel={t("editProfile.age")}
          />

          {/* Telefon */}
          <BNMInput
            label={t("editProfile.phone")}
            icon="call-outline"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            accessibilityLabel={t("editProfile.phone")}
          />

          {/* Kontaktpräferenz */}
          <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("editProfile.contactPref")}</Text>
          <View style={styles.contactGrid}>
            {CONTACT_OPTIONS.map((opt) => (
              <BNMPressable
                key={opt.key}
                style={[
                  styles.contactChip,
                  contactPref === opt.key ? styles.contactChipActive : [styles.contactChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => setContactPref(opt.key)}
                accessibilityRole="radio"
                accessibilityLabel={opt.label}
                accessibilityState={{ checked: contactPref === opt.key }}
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
              </BNMPressable>
            ))}
          </View>

          {/* Unveränderliche Info */}
          <View style={[styles.infoBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
            <Text style={[styles.infoBoxTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{t("editProfile.unchangeable")}</Text>
            <Text style={[styles.infoBoxText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
              {t("editProfile.unchangeableText")}
            </Text>
            <Text style={{ color: isDark ? "#60a5fa" : "#3b82f6", marginTop: 8, fontSize: 11, fontWeight: "600" }}>{t("editProfile.yourEmail")}</Text>
            <Text style={[styles.infoBoxValue, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{safeUser.email}</Text>
          </View>

          {/* Speichern */}
          <BNMPressable
            style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={isSaving}
            hapticStyle="success"
            accessibilityRole="button"
            accessibilityLabel={isSaving ? t("editProfile.saving") : t("editProfile.save")}
            accessibilityState={{ disabled: isSaving }}
          >
            <Text style={styles.saveButtonText}>
              {isSaving ? t("editProfile.saving") : t("editProfile.save")}
            </Text>
          </BNMPressable>

          <BNMPressable style={[styles.cancelButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel={t("editProfile.cancel")}>
            <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>{t("editProfile.cancel")}</Text>
          </BNMPressable>

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
  headerTitle: { fontWeight: "800", fontSize: 16 },
  headerRight: { flex: 1 },
  scrollView: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 4,
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
    borderRadius: RADIUS.full,
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
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
  },
  infoBoxTitle: { fontWeight: "800", fontSize: 13, marginBottom: 4 },
  infoBoxText: { fontSize: 13, lineHeight: 18, marginBottom: 6 },
  infoBoxValue: { fontSize: 13, fontWeight: "600" },
  saveButton: {
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
    marginBottom: 10,
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  cancelButton: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
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
    fontWeight: "800",
  },
  avatarButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 16,
    paddingVertical: 7,
  },
  avatarButtonDisabled: { opacity: 0.5 },
  avatarButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "500" },
});
