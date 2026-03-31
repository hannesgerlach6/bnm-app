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
import { showError } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import type { Gender, ContactPreference } from "../../types";
import { COLORS } from "../../constants/Colors";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { supabase } from "../../lib/supabase";
import { sendNewMentorApplicationNotification } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";

type QualificationLevel =
  | "phd"
  | "master"
  | "bachelor"
  | "ausbildung"
  | "abitur"
  | "hauptschule"
  | "";

type HoursPerWeek = "3h" | "6h" | "9h" | "12h" | "12h+" | "";
type DriversLicense = "yes" | "no" | "public_transport" | "";
type TravelTime = "15min" | "30min" | "45min" | "60min" | "90min" | "";
type Country = "austria" | "germany" | "switzerland" | "other" | "";
type HasMentoredBefore = "yes" | "no" | "";
type InOrganization = "yes" | "no" | "";

interface MentorFormData {
  firstName: string;
  lastName: string;
  email: string;
  gender: Gender | "";
  birthdate: string;
  plz: string;
  city: string;
  country: Country;
  phone: string;
  hoursPerWeek: HoursPerWeek;
  driversLicense: DriversLicense;
  travelTime: TravelTime;
  qualification: QualificationLevel;
  hasMentoredBefore: HasMentoredBefore;
  mentoringExperience: string;
  inOrganization: InOrganization;
  organizationName: string;
  contact_preference: ContactPreference | "";
  additionalMessage: string;
}

function calculateAge(birthdate: string): number | null {
  // Erwartet TT.MM.JJJJ
  const parts = birthdate.trim().split(".");
  if (parts.length !== 3) return null;
  const [day, month, year] = parts.map(Number);
  if (isNaN(day) || isNaN(month) || isNaN(year)) return null;
  const bd = new Date(year, month - 1, day);
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
}

export default function RegisterMentorScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [form, setForm] = useState<MentorFormData>({
    firstName: "",
    lastName: "",
    email: "",
    gender: "",
    birthdate: "",
    plz: "",
    city: "",
    country: "",
    phone: "",
    hoursPerWeek: "",
    driversLicense: "",
    travelTime: "",
    qualification: "",
    hasMentoredBefore: "",
    mentoringExperience: "",
    inOrganization: "",
    organizationName: "",
    contact_preference: "",
    additionalMessage: "",
  });

  const [errors, setErrors] = useState<Partial<Record<keyof MentorFormData, string>>>({});

  function update<K extends keyof MentorFormData>(field: K, value: MentorFormData[K]) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function validate(): boolean {
    const newErrors: Partial<Record<keyof MentorFormData, string>> = {};
    const req = t("registerMentor.required");

    if (!form.firstName.trim()) newErrors.firstName = req;
    if (!form.lastName.trim()) newErrors.lastName = req;
    if (!form.email.trim()) newErrors.email = req;
    else if (!/\S+@\S+\.\S+/.test(form.email)) newErrors.email = t("registerMentor.invalidEmail");
    if (!form.gender) newErrors.gender = req;
    if (!form.birthdate.trim()) newErrors.birthdate = req;
    else {
      const age = calculateAge(form.birthdate);
      if (age === null || age < 18) newErrors.birthdate = t("registerMentor.minAge");
    }
    if (!form.plz.trim()) newErrors.plz = req;
    if (!form.city.trim()) newErrors.city = req;
    if (!form.country) newErrors.country = req;
    if (!form.phone.trim()) newErrors.phone = req;
    if (!form.hoursPerWeek) newErrors.hoursPerWeek = req;
    if (!form.driversLicense) newErrors.driversLicense = req;
    if (!form.travelTime) newErrors.travelTime = req;
    if (!form.qualification) newErrors.qualification = req;
    if (!form.hasMentoredBefore) newErrors.hasMentoredBefore = req;
    if (!form.inOrganization) newErrors.inOrganization = req;
    if (!form.contact_preference) newErrors.contact_preference = req;

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setIsSubmitting(true);
    try {
      const emailLower = form.email.trim().toLowerCase();
      const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
      const age = calculateAge(form.birthdate) ?? 0;

      const countryLabels: Record<string, string> = {
        austria: "Österreich",
        germany: "Deutschland",
        switzerland: "Schweiz",
        other: "Anderes",
      };

      // Alle Zusatzinfos als strukturierter JSON-String in "experience"
      const extraData = JSON.stringify({
        hoursPerWeek: form.hoursPerWeek,
        driversLicense: form.driversLicense,
        travelTime: form.travelTime,
        qualification: form.qualification,
        hasMentoredBefore: form.hasMentoredBefore,
        mentoringExperience: form.mentoringExperience.trim(),
        inOrganization: form.inOrganization,
        organizationName: form.organizationName.trim(),
        country: form.country,
        birthdate: form.birthdate.trim(),
      });

      const { error } = await supabase.from("mentor_applications").insert({
        name: fullName,
        email: emailLower,
        phone: form.phone.trim(),
        gender: form.gender,
        city: `${form.plz.trim()} ${form.city.trim()}`,
        plz: form.plz.trim(),
        age,
        experience: extraData,
        motivation: form.additionalMessage.trim() || "",
        contact_preference: form.contact_preference,
        status: "pending",
      });

      if (error) {
        showError(error.message);
        setIsSubmitting(false);
        return;
      }

      await sendNewMentorApplicationNotification(
        fullName,
        emailLower,
        form.city.trim(),
        form.gender as Gender
      );

      setSubmitted(true);
    } catch {
      showError(t("registerMentor.errorUnexpected"));
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeColor = isDark ? "#FFCA28" : COLORS.primary;
  const activeTextColor = isDark ? "#0E0E14" : COLORS.white;

  // Gemeinsame Theme-Props für alle PillGroup-Aufrufe
  const pp = {
    activeColor,
    activeTextColor,
    cardColor: themeColors.card,
    borderColor: themeColors.border,
    secondaryColor: themeColors.textSecondary,
  };

  if (submitted) {
    return (
      <View style={[styles.successContainer, { backgroundColor: themeColors.background }]}>
        <View style={styles.successIcon}>
          <Text style={{ color: COLORS.white, fontSize: 28, fontWeight: "bold" }}>✓</Text>
        </View>
        <Text style={[styles.successTitle, { color: themeColors.text }]}>
          {t("registerMentor.successTitle")}
        </Text>
        <Text style={[styles.successText, { color: themeColors.textSecondary }]}>
          {t("registerMentor.successMsg")}
        </Text>
        <TouchableOpacity
          style={styles.successButton}
          onPress={() => router.replace("/(auth)/login")}
          accessibilityRole="button"
          accessibilityLabel={t("login.submit")}
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

          {/* INTRO */}
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>
            {t("registerMentor.pageTitle")}
          </Text>
          <Text style={[styles.pageDesc, { color: themeColors.textSecondary }]}>
            {t("registerMentor.pageDesc")}
          </Text>
          <View style={[styles.requirementsBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.requirementsTitle, { color: themeColors.text }]}>
              {t("registerMentor.requirementsTitle")}
            </Text>
            {[
              t("registerMentor.req1"),
              t("registerMentor.req2"),
              t("registerMentor.req3"),
              t("registerMentor.req4"),
              t("registerMentor.req5"),
            ].map((req, i) => (
              <View key={i} style={styles.bulletRow}>
                <Text style={[styles.bullet, { color: activeColor }]}>•</Text>
                <Text style={[styles.bulletText, { color: themeColors.textSecondary }]}>{req}</Text>
              </View>
            ))}
          </View>

          {/* SEKTION 1: Persönliche Daten */}
          <SectionHeader label={t("registerMentor.section1")} />

          <FieldLabel label={t("registerMentor.firstName")} error={errors.firstName} themeColors={themeColors} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.firstName ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder={t("registerMentor.firstNamePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={form.firstName}
            onChangeText={(v) => update("firstName", v)}
            accessibilityLabel={t("registerMentor.firstName")}
          />

          <FieldLabel label={t("registerMentor.lastName")} error={errors.lastName} themeColors={themeColors} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.lastName ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder={t("registerMentor.lastNamePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={form.lastName}
            onChangeText={(v) => update("lastName", v)}
            accessibilityLabel={t("registerMentor.lastName")}
          />

          <FieldLabel label={t("registerMentor.email")} error={errors.email} themeColors={themeColors} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.email ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder="deine@email.de"
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
            value={form.email}
            onChangeText={(v) => update("email", v)}
            accessibilityLabel={t("registerMentor.email")}
          />

          <FieldLabel label={t("registerMentor.gender")} error={errors.gender} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "male" as Gender, label: t("register.brother") },
              { value: "female" as Gender, label: t("register.sister") },
            ]}
            value={form.gender}
            onSelect={(v) => update("gender", v)}
            error={errors.gender}
          />

          <FieldLabel label={t("registerMentor.birthdate")} error={errors.birthdate} themeColors={themeColors} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.birthdate ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder="TT.MM.JJJJ"
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="numeric"
            value={form.birthdate}
            onChangeText={(v) => update("birthdate", v)}
            accessibilityLabel={t("registerMentor.birthdate")}
          />

          <FieldLabel label={t("registerMentor.plzCity")} error={errors.plz ?? errors.city} themeColors={themeColors} />
          <View style={styles.rowInputs}>
            <TextInput
              style={[styles.input, styles.inputPlz, { backgroundColor: themeColors.card, color: themeColors.text }, errors.plz ? styles.inputError : { borderColor: themeColors.border }]}
              placeholder="PLZ"
              placeholderTextColor={themeColors.textTertiary}
              keyboardType="number-pad"
              maxLength={5}
              value={form.plz}
              onChangeText={(v) => update("plz", v)}
              accessibilityLabel="PLZ"
            />
            <TextInput
              style={[styles.input, styles.inputCity, { backgroundColor: themeColors.card, color: themeColors.text }, errors.city ? styles.inputError : { borderColor: themeColors.border }]}
              placeholder={t("registerMentor.cityPlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
              value={form.city}
              onChangeText={(v) => update("city", v)}
              accessibilityLabel={t("registerMentor.cityPlaceholder")}
            />
          </View>

          <FieldLabel label={t("registerMentor.country")} error={errors.country} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "austria" as Country, label: t("registerMentor.countryAT") },
              { value: "germany" as Country, label: t("registerMentor.countryDE") },
              { value: "switzerland" as Country, label: t("registerMentor.countryCH") },
              { value: "other" as Country, label: t("registerMentor.countryOther") },
            ]}
            value={form.country}
            onSelect={(v) => update("country", v)}
            error={errors.country}
          />

          <FieldLabel label={t("registerMentor.phone")} error={errors.phone} themeColors={themeColors} />
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text }, errors.phone ? styles.inputError : { borderColor: themeColors.border }]}
            placeholder="+49 151 ..."
            placeholderTextColor={themeColors.textTertiary}
            keyboardType="phone-pad"
            value={form.phone}
            onChangeText={(v) => update("phone", v)}
            accessibilityLabel={t("registerMentor.phone")}
          />

          {/* SEKTION 2: Deine Rolle als Mentor */}
          <SectionHeader label={t("registerMentor.section2")} />

          <FieldLabel label={t("registerMentor.hoursPerWeek")} error={errors.hoursPerWeek} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "3h" as HoursPerWeek, label: "3h" },
              { value: "6h" as HoursPerWeek, label: "6h" },
              { value: "9h" as HoursPerWeek, label: "9h" },
              { value: "12h" as HoursPerWeek, label: "12h" },
              { value: "12h+" as HoursPerWeek, label: "12h+" },
            ]}
            value={form.hoursPerWeek}
            onSelect={(v) => update("hoursPerWeek", v)}
            error={errors.hoursPerWeek}
          />

          <FieldLabel label={t("registerMentor.driversLicense")} error={errors.driversLicense} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "yes" as DriversLicense, label: t("registerMentor.yes") },
              { value: "no" as DriversLicense, label: t("registerMentor.no") },
              { value: "public_transport" as DriversLicense, label: t("registerMentor.publicTransport") },
            ]}
            value={form.driversLicense}
            onSelect={(v) => update("driversLicense", v)}
            error={errors.driversLicense}
          />

          <FieldLabel label={t("registerMentor.travelTime")} error={errors.travelTime} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "15min" as TravelTime, label: "15 min" },
              { value: "30min" as TravelTime, label: "30 min" },
              { value: "45min" as TravelTime, label: "45 min" },
              { value: "60min" as TravelTime, label: "60 min" },
              { value: "90min" as TravelTime, label: "90 min" },
            ]}
            value={form.travelTime}
            onSelect={(v) => update("travelTime", v)}
            error={errors.travelTime}
          />

          {/* SEKTION 3: Erfahrung & Qualifikation */}
          <SectionHeader label={t("registerMentor.section3")} />

          <FieldLabel label={t("registerMentor.qualification")} error={errors.qualification} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "phd" as QualificationLevel, label: "PhD" },
              { value: "master" as QualificationLevel, label: "Master" },
              { value: "bachelor" as QualificationLevel, label: "Bachelor" },
              { value: "ausbildung" as QualificationLevel, label: t("registerMentor.qualAusbildung") },
              { value: "abitur" as QualificationLevel, label: t("registerMentor.qualAbitur") },
              { value: "hauptschule" as QualificationLevel, label: t("registerMentor.qualHauptschule") },
            ]}
            value={form.qualification}
            onSelect={(v) => update("qualification", v)}
            error={errors.qualification}
          />

          <FieldLabel label={t("registerMentor.hasMentoredBefore")} error={errors.hasMentoredBefore} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "yes" as HasMentoredBefore, label: t("registerMentor.yes") },
              { value: "no" as HasMentoredBefore, label: t("registerMentor.no") },
            ]}
            value={form.hasMentoredBefore}
            onSelect={(v) => update("hasMentoredBefore", v)}
            error={errors.hasMentoredBefore}
          />

          {form.hasMentoredBefore === "yes" && (
            <>
              <FieldLabel label={t("registerMentor.mentoringExperience")} themeColors={themeColors} />
              <TextInput
                style={[styles.input, styles.textarea, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder={t("registerMentor.mentoringExperiencePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                value={form.mentoringExperience}
                onChangeText={(v) => update("mentoringExperience", v)}
                accessibilityLabel={t("registerMentor.mentoringExperience")}
              />
            </>
          )}

          <FieldLabel label={t("registerMentor.inOrganization")} error={errors.inOrganization} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "yes" as InOrganization, label: t("registerMentor.yes") },
              { value: "no" as InOrganization, label: t("registerMentor.no") },
            ]}
            value={form.inOrganization}
            onSelect={(v) => update("inOrganization", v)}
            error={errors.inOrganization}
          />

          {form.inOrganization === "yes" && (
            <>
              <FieldLabel label={t("registerMentor.organizationName")} themeColors={themeColors} />
              <TextInput
                style={[styles.input, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border }]}
                placeholder={t("registerMentor.organizationNamePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                value={form.organizationName}
                onChangeText={(v) => update("organizationName", v)}
                accessibilityLabel={t("registerMentor.organizationName")}
              />
            </>
          )}

          {/* SEKTION 4: Kontakt & Sonstiges */}
          <SectionHeader label={t("registerMentor.section4")} />

          <FieldLabel label={t("registerMentor.contactPref")} error={errors.contact_preference} themeColors={themeColors} />
          <PillGroup
            {...pp}
            options={[
              { value: "whatsapp" as ContactPreference, label: t("contactPref.whatsapp") },
              { value: "telegram" as ContactPreference, label: t("contactPref.telegram") },
              { value: "phone" as ContactPreference, label: t("contactPref.phone") },
              { value: "email" as ContactPreference, label: t("contactPref.email") },
            ]}
            value={form.contact_preference}
            onSelect={(v) => update("contact_preference", v)}
            error={errors.contact_preference}
          />

          <FieldLabel label={t("registerMentor.additionalMessage")} themeColors={themeColors} />
          <TextInput
            style={[styles.input, styles.textarea, { backgroundColor: themeColors.card, color: themeColors.text, borderColor: themeColors.border, marginBottom: 20 }]}
            placeholder={t("registerMentor.additionalMessagePlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            value={form.additionalMessage}
            onChangeText={(v) => update("additionalMessage", v)}
            accessibilityLabel={t("registerMentor.additionalMessage")}
          />

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting ? { opacity: 0.6 } : {}]}
            onPress={handleSubmit}
            disabled={isSubmitting}
            accessibilityRole="button"
            accessibilityLabel={isSubmitting ? t("registerMentor.submitting") : t("registerMentor.submitNew")}
            accessibilityState={{ disabled: isSubmitting }}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? t("registerMentor.submitting") : t("registerMentor.submitNew")}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PillGroup<T extends string,>({
  options,
  value,
  onSelect,
  error,
  activeColor,
  activeTextColor,
  cardColor,
  borderColor,
  secondaryColor,
}: {
  options: { value: T; label: string }[];
  value: T | "";
  onSelect: (v: T) => void;
  error?: string;
  activeColor: string;
  activeTextColor: string;
  cardColor: string;
  borderColor: string;
  secondaryColor: string;
}) {
  return (
    <>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <TouchableOpacity
              key={opt.value}
              style={[
                styles.pill,
                active
                  ? { backgroundColor: activeColor, borderColor: activeColor }
                  : { backgroundColor: cardColor, borderColor },
              ]}
              onPress={() => onSelect(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={opt.label}
            >
              <Text
                style={[
                  styles.pillText,
                  active
                    ? { color: activeTextColor, fontWeight: "600" as const }
                    : { color: secondaryColor },
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </>
  );
}

function SectionHeader({ label }: { label: string }) {
  const themeColors = useThemeColors();
  return (
    <View style={sectionStyles.container}>
      <Text style={[sectionStyles.label, { color: themeColors.text }]}>{label}</Text>
    </View>
  );
}

function FieldLabel({
  label,
  error,
  themeColors,
}: {
  label: string;
  error?: string;
  themeColors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
      <Text style={{ color: themeColors.textSecondary, fontSize: 13, fontWeight: "500", flex: 1 }}>
        {label}
      </Text>
      {error ? <Text style={{ color: "#ef4444", fontSize: 12, marginLeft: 8 }}>{error}</Text> : null}
    </View>
  );
}

const sectionStyles = StyleSheet.create({
  container: {
    marginTop: 20,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
});

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  pageTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
  },
  pageDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  requirementsBox: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 8,
  },
  requirementsTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  bullet: {
    fontSize: 14,
    marginRight: 6,
    lineHeight: 18,
  },
  bulletText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  inputError: {
    borderColor: "#f87171",
  },
  textarea: {
    height: 80,
  },
  rowInputs: {
    flexDirection: "row",
    gap: 8,
  },
  inputPlz: {
    width: 90,
    flex: 0,
  },
  inputCity: {
    flex: 1,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: "500",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    marginTop: -8,
    marginBottom: 8,
  },
  submitButton: {
    backgroundColor: COLORS.cta,
    borderRadius: 12,
    paddingVertical: 12,
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
    fontWeight: "800",
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
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  successButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
});
