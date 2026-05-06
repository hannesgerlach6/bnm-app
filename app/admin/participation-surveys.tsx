import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, SHADOWS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { EmptyState } from "../../components/EmptyState";
import { Ionicons } from "@expo/vector-icons";
import type { ParticipationSurvey, SurveyVisibility } from "../../types";

const VISIBILITY_OPTIONS: { key: SurveyVisibility; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "male", label: "Brüder" },
  { key: "female", label: "Schwestern" },
];

type FormData = {
  title: string;
  description: string;
  survey_date: string;
  visible_to: SurveyVisibility;
  is_active: boolean;
};

const EMPTY_FORM: FormData = {
  title: "",
  description: "",
  survey_date: "",
  visible_to: "all",
  is_active: true,
};

export default function ParticipationSurveysScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const {
    participationSurveys,
    participationResponses,
    users,
    refreshData,
    addParticipationSurvey,
    updateParticipationSurvey,
    deleteParticipationSurvey,
    getSurveyResponsesBySurveyId,
  } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={{ color: themeColors.error }}>Kein Zugriff</Text>
      </View>
    );
  }

  function openCreate() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(survey: ParticipationSurvey) {
    setForm({
      title: survey.title,
      description: survey.description ?? "",
      survey_date: survey.survey_date ?? "",
      visible_to: survey.visible_to,
      is_active: survey.is_active,
    });
    setEditingId(survey.id);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.title.trim()) { showError("Titel ist erforderlich"); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        survey_date: form.survey_date.trim() || undefined,
        visible_to: form.visible_to,
        is_active: form.is_active,
      };
      if (editingId) {
        await updateParticipationSurvey(editingId, payload);
      } else {
        await addParticipationSurvey(payload as any);
      }
      showSuccess(editingId ? "Abfrage aktualisiert" : "Abfrage erstellt");
      setShowForm(false);
      setEditingId(null);
    } catch {
      showError("Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    showConfirm(
      "Abfrage löschen?",
      "Alle Antworten werden ebenfalls gelöscht.",
      async () => {
        try {
          await deleteParticipationSurvey(id);
          showSuccess("Abfrage gelöscht");
        } catch {
          showError("Fehler beim Löschen");
        }
      }
    );
  }

  async function handleToggleActive(survey: ParticipationSurvey) {
    try {
      await updateParticipationSurvey(survey.id, { is_active: !survey.is_active });
    } catch {
      showError("Fehler");
    }
  }

  function getResponseLabel(r: string) {
    if (r === "yes") return "Ja";
    if (r === "maybe") return "Vielleicht";
    return "Nein";
  }

  function getResponseColor(r: string) {
    if (r === "yes") return COLORS.cta;
    if (r === "maybe") return COLORS.gold;
    return COLORS.error;
  }

  function formatDate(dateStr?: string) {
    if (!dateStr) return null;
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch { return dateStr; }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={[styles.scrollView, { backgroundColor: themeColors.background }]}
          contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        >
          <View style={styles.page}>
            {/* Header */}
            <View style={styles.headerRow}>
              <BNMPressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Zurück">
                <Ionicons name="arrow-back" size={22} color={themeColors.text} />
              </BNMPressable>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>Teilnahmeabfragen</Text>
              <BNMPressable
                style={[styles.addBtn, { backgroundColor: COLORS.gradientStart }]}
                onPress={openCreate}
                accessibilityRole="button"
                accessibilityLabel="Neue Abfrage erstellen"
              >
                <Ionicons name="add" size={20} color="#fff" />
                <Text style={styles.addBtnText}>Neu</Text>
              </BNMPressable>
            </View>

            {/* Form */}
            {showForm && (
              <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.goldBorder, isDark) }]}>
                <Text style={[styles.formTitle, { color: themeColors.text }]}>
                  {editingId ? "Abfrage bearbeiten" : "Neue Abfrage"}
                </Text>

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Titel *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.elevated, color: themeColors.text, borderColor: themeColors.border }]}
                  value={form.title}
                  onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
                  placeholder="z.B. Retreat Mai 2026"
                  placeholderTextColor={themeColors.textTertiary}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Beschreibung</Text>
                <TextInput
                  style={[styles.input, styles.multiline, { backgroundColor: themeColors.elevated, color: themeColors.text, borderColor: themeColors.border }]}
                  value={form.description}
                  onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
                  placeholder="Optionale Details zur Veranstaltung"
                  placeholderTextColor={themeColors.textTertiary}
                  multiline
                  numberOfLines={3}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Datum (optional)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: themeColors.elevated, color: themeColors.text, borderColor: themeColors.border }]}
                  value={form.survey_date}
                  onChangeText={(v) => setForm((p) => ({ ...p, survey_date: v }))}
                  placeholder="JJJJ-MM-TT"
                  placeholderTextColor={themeColors.textTertiary}
                />

                <Text style={[styles.label, { color: themeColors.textSecondary }]}>Sichtbar für</Text>
                <View style={styles.chipRow}>
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <BNMPressable
                      key={opt.key}
                      style={[styles.chip, form.visible_to === opt.key && { backgroundColor: COLORS.gradientStart }]}
                      onPress={() => setForm((p) => ({ ...p, visible_to: opt.key }))}
                      accessibilityRole="button"
                    >
                      <Text style={[styles.chipText, { color: form.visible_to === opt.key ? "#fff" : themeColors.text }]}>{opt.label}</Text>
                    </BNMPressable>
                  ))}
                </View>

                <View style={styles.activeRow}>
                  <Text style={[styles.label, { color: themeColors.textSecondary, marginBottom: 0 }]}>Aktiv (für Mentees sichtbar)</Text>
                  <BNMPressable
                    style={[styles.toggleBtn, { backgroundColor: form.is_active ? COLORS.cta : themeColors.border }]}
                    onPress={() => setForm((p) => ({ ...p, is_active: !p.is_active }))}
                    accessibilityRole="switch"
                  >
                    <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>{form.is_active ? "AN" : "AUS"}</Text>
                  </BNMPressable>
                </View>

                <View style={styles.formActions}>
                  <BNMPressable
                    style={[styles.cancelBtn, { borderColor: themeColors.border }]}
                    onPress={() => setShowForm(false)}
                    accessibilityRole="button"
                  >
                    <Text style={{ color: themeColors.textSecondary, fontWeight: "600" }}>Abbrechen</Text>
                  </BNMPressable>
                  <BNMPressable
                    style={[styles.saveBtn, { backgroundColor: COLORS.gradientStart, opacity: saving ? 0.6 : 1 }]}
                    onPress={handleSave}
                    disabled={saving}
                    accessibilityRole="button"
                  >
                    <Text style={styles.saveBtnText}>{saving ? "Speichern…" : "Speichern"}</Text>
                  </BNMPressable>
                </View>
              </View>
            )}

            {/* Survey List */}
            {participationSurveys.length === 0 ? (
              <EmptyState
                iconName="clipboard-outline"
                title="Keine Abfragen"
                description="Erstelle deine erste Teilnahmeabfrage für Mentees."
              />
            ) : (
              participationSurveys.map((survey) => {
                const responses = getSurveyResponsesBySurveyId(survey.id);
                const yesCount = responses.filter((r) => r.response === "yes").length;
                const maybeCount = responses.filter((r) => r.response === "maybe").length;
                const noCount = responses.filter((r) => r.response === "no").length;
                const isExpanded = expandedId === survey.id;

                return (
                  <View key={survey.id} style={[styles.surveyCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.darkBorder, isDark) }]}>
                    {/* Card Header */}
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <Text style={[styles.surveyTitle, { color: themeColors.text }]}>{survey.title}</Text>
                          {!survey.is_active && (
                            <View style={[styles.badge, { backgroundColor: sem(SEMANTIC.amberBg, isDark) }]}>
                              <Text style={[styles.badgeText, { color: sem(SEMANTIC.amberText, isDark) }]}>Inaktiv</Text>
                            </View>
                          )}
                        </View>
                        {survey.survey_date && (
                          <Text style={[styles.surveyDate, { color: themeColors.textTertiary }]}>
                            <Ionicons name="calendar-outline" size={12} /> {formatDate(survey.survey_date)}
                          </Text>
                        )}
                        {survey.description && (
                          <Text style={[styles.surveyDesc, { color: themeColors.textSecondary }]} numberOfLines={isExpanded ? undefined : 2}>
                            {survey.description}
                          </Text>
                        )}
                      </View>
                    </View>

                    {/* Response Stats */}
                    <View style={[styles.statsRow, { borderTopColor: sem(SEMANTIC.darkBorder, isDark) }]}>
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: COLORS.cta }]}>{yesCount}</Text>
                        <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Ja</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: sem(SEMANTIC.darkBorder, isDark) }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: COLORS.gold }]}>{maybeCount}</Text>
                        <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Vielleicht</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: sem(SEMANTIC.darkBorder, isDark) }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: COLORS.error }]}>{noCount}</Text>
                        <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Nein</Text>
                      </View>
                      <View style={[styles.statDivider, { backgroundColor: sem(SEMANTIC.darkBorder, isDark) }]} />
                      <View style={styles.statItem}>
                        <Text style={[styles.statNumber, { color: themeColors.text }]}>{responses.length}</Text>
                        <Text style={[styles.statLabel, { color: themeColors.textTertiary }]}>Gesamt</Text>
                      </View>
                    </View>

                    {/* Expanded: who responded */}
                    {isExpanded && responses.length > 0 && (
                      <View style={[styles.respondentList, { borderTopColor: sem(SEMANTIC.darkBorder, isDark) }]}>
                        {responses.map((resp) => {
                          const respUser = users.find((u) => u.id === resp.user_id);
                          return (
                            <View key={resp.id} style={styles.respondentRow}>
                              <Text style={[styles.respondentName, { color: themeColors.text }]} numberOfLines={1}>
                                {respUser?.name ?? "Unbekannt"}
                              </Text>
                              <View style={[styles.responseBadge, { backgroundColor: getResponseColor(resp.response) + "20" }]}>
                                <Text style={[styles.responseBadgeText, { color: getResponseColor(resp.response) }]}>
                                  {getResponseLabel(resp.response)}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {/* Actions */}
                    <View style={[styles.cardActions, { borderTopColor: sem(SEMANTIC.darkBorder, isDark) }]}>
                      {responses.length > 0 && (
                        <BNMPressable
                          style={styles.actionBtn}
                          onPress={() => setExpandedId(isExpanded ? null : survey.id)}
                          accessibilityRole="button"
                        >
                          <Ionicons name={isExpanded ? "chevron-up-outline" : "people-outline"} size={16} color={COLORS.gradientStart} />
                          <Text style={[styles.actionText, { color: COLORS.gradientStart }]}>
                            {isExpanded ? "Einklappen" : "Antworten anzeigen"}
                          </Text>
                        </BNMPressable>
                      )}
                      <BNMPressable
                        style={styles.actionBtn}
                        onPress={() => handleToggleActive(survey)}
                        accessibilityRole="button"
                      >
                        <Ionicons name={survey.is_active ? "eye-off-outline" : "eye-outline"} size={16} color={themeColors.textSecondary} />
                        <Text style={[styles.actionText, { color: themeColors.textSecondary }]}>
                          {survey.is_active ? "Deaktivieren" : "Aktivieren"}
                        </Text>
                      </BNMPressable>
                      <BNMPressable
                        style={styles.actionBtn}
                        onPress={() => openEdit(survey)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="create-outline" size={16} color={COLORS.gold} />
                        <Text style={[styles.actionText, { color: COLORS.gold }]}>Bearbeiten</Text>
                      </BNMPressable>
                      <BNMPressable
                        style={styles.actionBtn}
                        onPress={() => handleDelete(survey.id)}
                        accessibilityRole="button"
                      >
                        <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                        <Text style={[styles.actionText, { color: COLORS.error }]}>Löschen</Text>
                      </BNMPressable>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 16, maxWidth: 720, width: "100%", alignSelf: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 12 },
  backBtn: { padding: 6 },
  pageTitle: { flex: 1, fontSize: 20, fontWeight: "700" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: RADIUS.sm },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  formCard: { borderRadius: RADIUS.md, borderWidth: 1, padding: 16, marginBottom: 20, ...SHADOWS.sm },
  formTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: RADIUS.sm, padding: 10, fontSize: 14 },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: RADIUS.sm, backgroundColor: "#e5e7eb" },
  chipText: { fontSize: 13, fontWeight: "600" },
  activeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 14 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: RADIUS.sm },
  formActions: { flexDirection: "row", gap: 10, marginTop: 18, justifyContent: "flex-end" },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: RADIUS.sm, borderWidth: 1 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 9, borderRadius: RADIUS.sm },
  saveBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  surveyCard: { borderRadius: RADIUS.md, borderWidth: 1, marginBottom: 14, overflow: "hidden", ...SHADOWS.sm },
  cardHeader: { padding: 14 },
  surveyTitle: { fontSize: 15, fontWeight: "700" },
  surveyDate: { fontSize: 12, marginTop: 4 },
  surveyDesc: { fontSize: 13, marginTop: 6, lineHeight: 20 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs },
  badgeText: { fontSize: 11, fontWeight: "600" },
  statsRow: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 10 },
  statItem: { flex: 1, alignItems: "center" },
  statNumber: { fontSize: 20, fontWeight: "700" },
  statLabel: { fontSize: 11, fontWeight: "600", marginTop: 2 },
  statDivider: { width: 1, marginVertical: 4 },
  respondentList: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 8, gap: 8 },
  respondentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  respondentName: { fontSize: 13, fontWeight: "500", flex: 1 },
  responseBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: RADIUS.xs },
  responseBadgeText: { fontSize: 12, fontWeight: "600" },
  cardActions: { flexDirection: "row", flexWrap: "wrap", borderTopWidth: 1, paddingHorizontal: 10, paddingVertical: 8, gap: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: RADIUS.xs },
  actionText: { fontSize: 13, fontWeight: "600" },
});
