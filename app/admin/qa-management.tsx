import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  StyleSheet,
  Alert,
  Platform,
  RefreshControl,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData, type QAEntry } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";

const CATEGORIES = ["Grundlagen", "Gebet", "Alltag", "Persönliches", "allgemein"];

type FormData = {
  question: string;
  answer: string;
  category: string;
  tags: string;
  is_published: boolean;
};

const EMPTY_FORM: FormData = {
  question: "",
  answer: "",
  category: "allgemein",
  tags: "",
  is_published: true,
};

export default function QAManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { qaEntries, loadQAEntries, addQAEntry, updateQAEntry, deleteQAEntry } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<QAEntry | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Zugangskontrolle
  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <Container>
        <View style={styles.accessDeniedBox}>
          <Text style={[styles.accessDeniedText, { color: themeColors.text }]}>
            {t("qa.accessDenied")}
          </Text>
        </View>
      </Container>
    );
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadQAEntries();
    setRefreshing(false);
  }, [loadQAEntries]);

  function openAddForm() {
    setEditingEntry(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEditForm(entry: QAEntry) {
    setEditingEntry(entry);
    setForm({
      question: entry.question,
      answer: entry.answer,
      category: entry.category,
      tags: entry.tags.join(", "),
      is_published: entry.is_published,
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingEntry(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.question.trim()) {
      Alert.alert(t("common.error"), t("qa.errorQuestion"));
      return;
    }
    if (!form.answer.trim()) {
      Alert.alert(t("common.error"), t("qa.errorAnswer"));
      return;
    }

    setSaving(true);
    try {
      const tagsArray = form.tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      if (editingEntry) {
        await updateQAEntry(editingEntry.id, {
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category,
          tags: tagsArray,
          is_published: form.is_published,
        });
      } else {
        await addQAEntry({
          question: form.question.trim(),
          answer: form.answer.trim(),
          category: form.category,
          tags: tagsArray,
          is_published: form.is_published,
          created_by: user?.id,
        });
      }
      Alert.alert(t("common.success"), t("qa.saveSuccess"));
      closeForm();
    } catch {
      Alert.alert(t("common.error"), t("qa.loadError"));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry: QAEntry) {
    Alert.alert(t("qa.deleteTitle"), t("qa.deleteText"), [
      { text: t("qa.cancel"), style: "cancel" },
      {
        text: t("qa.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteQAEntry(entry.id);
          } catch {
            Alert.alert(t("common.error"), t("qa.loadError"));
          }
        },
      },
    ]);
  }

  async function handleTogglePublish(entry: QAEntry) {
    try {
      await updateQAEntry(entry.id, { is_published: !entry.is_published });
    } catch {
      Alert.alert(t("common.error"), t("qa.loadError"));
    }
  }

  if (showForm) {
    return (
      <Container>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            style={[styles.scrollView, { backgroundColor: themeColors.background }]}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.page}>
              <TouchableOpacity style={styles.backRow} onPress={closeForm}>
                <Text style={[styles.backText, { color: themeColors.textSecondary }]}>
                  {t("qa.back")}
                </Text>
              </TouchableOpacity>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>
                {editingEntry ? t("qa.editTitle") : t("qa.addTitle")}
              </Text>

              {/* Frage */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{t("qa.question")} *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text },
                ]}
                placeholder={t("qa.questionPlaceholder")}
                placeholderTextColor={themeColors.textSecondary}
                value={form.question}
                onChangeText={(v) => setForm((f) => ({ ...f, question: v }))}
                multiline
              />

              {/* Antwort */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{t("qa.answer")} *</Text>
              <TextInput
                style={[
                  styles.textInput,
                  styles.textAreaInput,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text },
                ]}
                placeholder={t("qa.answerPlaceholder")}
                placeholderTextColor={themeColors.textSecondary}
                value={form.answer}
                onChangeText={(v) => setForm((f) => ({ ...f, answer: v }))}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />

              {/* Kategorie */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{t("qa.category")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.categoryScroll}
                contentContainerStyle={styles.categoryContent}
              >
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.chip,
                      form.category === cat
                        ? { backgroundColor: COLORS.gradientStart }
                        : { backgroundColor: themeColors.card, borderWidth: 1, borderColor: themeColors.border },
                    ]}
                    onPress={() => setForm((f) => ({ ...f, category: cat }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        form.category === cat ? { color: COLORS.white } : { color: themeColors.text },
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Tags */}
              <Text style={[styles.fieldLabel, { color: themeColors.text }]}>{t("qa.tags")}</Text>
              <TextInput
                style={[
                  styles.textInput,
                  { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text },
                ]}
                placeholder={t("qa.tagsPlaceholder")}
                placeholderTextColor={themeColors.textSecondary}
                value={form.tags}
                onChangeText={(v) => setForm((f) => ({ ...f, tags: v }))}
              />

              {/* Veröffentlicht Toggle */}
              <View style={styles.publishRow}>
                <Text style={[styles.fieldLabel, { color: themeColors.text, marginBottom: 0 }]}>
                  {t("qa.published")}
                </Text>
                <Switch
                  value={form.is_published}
                  onValueChange={(v) => setForm((f) => ({ ...f, is_published: v }))}
                  thumbColor={form.is_published ? COLORS.cta : themeColors.border}
                  trackColor={{ false: themeColors.border, true: "rgba(39,174,96,0.3)" }}
                />
              </View>

              {/* Buttons */}
              <View style={styles.formButtonRow}>
                <TouchableOpacity
                  style={[styles.cancelButton, { borderColor: themeColors.border }]}
                  onPress={closeForm}
                  disabled={saving}
                >
                  <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>
                    {t("qa.cancel")}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { backgroundColor: COLORS.gradientStart }]}
                  onPress={handleSave}
                  disabled={saving}
                >
                  <Text style={styles.saveButtonText}>
                    {saving ? t("qa.saving") : t("qa.save")}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Container>
    );
  }

  return (
    <Container>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />
        }
      >
        <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
          {/* Header */}
          <TouchableOpacity style={styles.backRow} onPress={() => router.back()}>
            <Text style={[styles.backText, { color: themeColors.textSecondary }]}>
              {t("qa.back")}
            </Text>
          </TouchableOpacity>
          <View style={styles.headerRow}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("qa.manage")}</Text>
            <Text style={[styles.countBadge, { color: themeColors.textSecondary }]}>
              {t("qa.totalEntries").replace("{0}", String(qaEntries.length))}
            </Text>
          </View>

          {/* Neue Frage Button */}
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: COLORS.gradientStart }]}
            onPress={openAddForm}
          >
            <Text style={styles.addButtonText}>{t("qa.addNew")}</Text>
          </TouchableOpacity>

          {/* Einträge-Liste */}
          {qaEntries.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: themeColors.card }]}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>
                {t("qa.noResults")}
              </Text>
            </View>
          ) : (
            qaEntries.map((entry) => (
              <View
                key={entry.id}
                style={[
                  styles.entryCard,
                  {
                    backgroundColor: themeColors.card,
                    borderColor: themeColors.border,
                    opacity: entry.is_published ? 1 : 0.7,
                  },
                ]}
              >
                <View style={styles.entryHeader}>
                  <View style={styles.entryMeta}>
                    <View
                      style={[styles.categoryPill, { backgroundColor: themeColors.background }]}
                    >
                      <Text style={[styles.categoryPillText, { color: themeColors.textSecondary }]}>
                        {entry.category}
                      </Text>
                    </View>
                    {!entry.is_published && (
                      <View style={[styles.unpublishedBadge, { backgroundColor: isDark ? "#3a2e1a" : "#fef3c7" }]}>
                        <Text style={[styles.unpublishedBadgeText, { color: isDark ? "#fbbf24" : "#92400e" }]}>{t("qa.unpublishedBadge")}</Text>
                      </View>
                    )}
                  </View>
                  <Switch
                    value={entry.is_published}
                    onValueChange={() => handleTogglePublish(entry)}
                    thumbColor={entry.is_published ? COLORS.cta : themeColors.border}
                    trackColor={{ false: themeColors.border, true: "rgba(39,174,96,0.3)" }}
                    style={styles.entrySwitch}
                  />
                </View>

                <Text style={[styles.entryQuestion, { color: themeColors.text }]} numberOfLines={2}>
                  {entry.question}
                </Text>
                <Text
                  style={[styles.entryAnswer, { color: themeColors.textSecondary }]}
                  numberOfLines={2}
                >
                  {entry.answer}
                </Text>

                {entry.tags.length > 0 && (
                  <View style={styles.tagsRow}>
                    {entry.tags.map((tag) => (
                      <View
                        key={tag}
                        style={[styles.tagBadge, { backgroundColor: themeColors.background }]}
                      >
                        <Text style={[styles.tagText, { color: themeColors.textSecondary }]}>
                          #{tag}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={[styles.entryActions, { borderTopColor: themeColors.border }]}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => openEditForm(entry)}
                  >
                    <Text style={styles.editButtonText}>{t("qa.edit")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(entry)}
                  >
                    <Text style={styles.deleteButtonText}>{t("qa.delete")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20, paddingBottom: 40 },
  backRow: { marginBottom: 8 },
  backText: { fontSize: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  pageTitle: { fontSize: 22, fontWeight: "700" },
  countBadge: { fontSize: 13 },
  addButton: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  emptyBox: {
    borderRadius: 8,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  entryCard: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
  },
  entryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  entryMeta: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1 },
  categoryPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
  },
  categoryPillText: { fontSize: 10, fontWeight: "600" },
  unpublishedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  unpublishedBadgeText: { fontSize: 10, fontWeight: "600" },
  entrySwitch: { flexShrink: 0 },
  entryQuestion: { fontSize: 14, fontWeight: "600", marginBottom: 4, lineHeight: 20 },
  entryAnswer: { fontSize: 13, lineHeight: 18, marginBottom: 8 },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 8 },
  tagBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagText: { fontSize: 11 },
  entryActions: {
    flexDirection: "row",
    gap: 8,
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 2,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 5,
    alignItems: "center",
  },
  editButton: { backgroundColor: "rgba(39,174,96,0.1)", borderWidth: 1, borderColor: "rgba(39,174,96,0.3)" },
  editButtonText: { color: COLORS.cta, fontWeight: "600", fontSize: 13 },
  deleteButton: { backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)" },
  deleteButtonText: { color: "#ef4444", fontWeight: "600", fontSize: 13 },
  accessDeniedBox: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  accessDeniedText: { fontSize: 16, textAlign: "center" },

  // Formular
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6, marginTop: 12 },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
  },
  textAreaInput: { minHeight: 100, textAlignVertical: "top" },
  categoryScroll: { marginBottom: 4 },
  categoryContent: { gap: 8, paddingRight: 4, paddingVertical: 2 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipText: { fontSize: 13, fontWeight: "500" },
  publishRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 8,
  },
  formButtonRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: { fontSize: 14, fontWeight: "600" },
  saveButton: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
});
