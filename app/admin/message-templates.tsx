import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";
import { supabase } from "../../lib/supabase";
import type { MessageTemplate } from "../../types";

const CATEGORIES = ["erstkontakt", "reaktivierung", "nachfassen", "general"];

export default function MessageTemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { messageTemplates, refreshData } = useData();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={{ color: themeColors.text }}>{t("common.noAccess")}</Text>
      </View>
    );
  }

  function startEdit(tmpl: MessageTemplate) {
    setEditingId(tmpl.id);
    setTitle(tmpl.title);
    setCategory(tmpl.category);
    setBody(tmpl.body);
  }

  function startNew() {
    setEditingId("new");
    setTitle("");
    setCategory("general");
    setBody("");
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setBody("");
  }

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      showError(t("templates.errorEmpty"));
      return;
    }
    setIsSaving(true);
    try {
      if (editingId === "new") {
        const { error } = await supabase.from("message_templates").insert({
          title: title.trim(),
          category,
          body: body.trim(),
          sort_order: messageTemplates.length + 1,
        });
        if (error) throw error;
        showSuccess(t("templates.saved"));
      } else {
        const { error } = await supabase.from("message_templates").update({
          title: title.trim(),
          category,
          body: body.trim(),
          updated_at: new Date().toISOString(),
        }).eq("id", editingId);
        if (error) throw error;
        showSuccess(t("templates.saved"));
      }
      cancelEdit();
      await refreshData();
    } catch {
      showError(t("common.error"));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await showConfirm(t("templates.deleteTitle"), t("templates.deleteConfirm"));
    if (!ok) return;
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) {
      showError(t("common.error"));
      return;
    }
    showSuccess(t("templates.deleted"));
    await refreshData();
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="link" accessibilityLabel="Zurueck">
            <Text style={[styles.backText, { color: themeColors.text }]}>{"\u2039"} {t("common.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("templates.manage")}</Text>
          <BNMPressable onPress={startNew} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Neue Vorlage erstellen">
            <Ionicons name="add-circle" size={28} color={COLORS.gold} />
          </BNMPressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={[styles.hint, { color: themeColors.textTertiary }]}>
            {t("templates.hint")}
          </Text>

          {/* Edit Form */}
          {editingId && (
            <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.formLabel, { color: themeColors.text }]}>{t("templates.titleLabel")}</Text>
              <TextInput
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.elevated }]}
                value={title}
                onChangeText={setTitle}
                placeholder={t("templates.titlePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
              />

              <Text style={[styles.formLabel, { color: themeColors.text }]}>{t("templates.categoryLabel")}</Text>
              <View style={styles.chipRow}>
                {CATEGORIES.map((cat) => (
                  <BNMPressable
                    key={cat}
                    style={[
                      styles.catChip,
                      { borderColor: category === cat ? COLORS.gold : themeColors.border,
                        backgroundColor: category === cat ? COLORS.gold + "15" : themeColors.elevated },
                    ]}
                    onPress={() => setCategory(cat)}
                    accessibilityRole="radio"
                    accessibilityLabel={cat}
                    accessibilityState={{ checked: category === cat }}
                  >
                    <Text style={[styles.catChipText, { color: category === cat ? COLORS.gold : themeColors.textSecondary }]}>
                      {cat}
                    </Text>
                  </BNMPressable>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: themeColors.text }]}>{t("templates.bodyLabel")}</Text>
              <Text style={[styles.placeholderHint, { color: themeColors.textTertiary }]}>
                {t("templates.placeholderHint")}
              </Text>
              <TextInput
                style={[styles.inputMulti, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.elevated }]}
                value={body}
                onChangeText={setBody}
                placeholder={t("templates.bodyPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                multiline
                numberOfLines={Platform.OS === "web" ? 16 : 8}
                textAlignVertical="top"
              />

              <View style={styles.formActions}>
                <BNMPressable style={[styles.cancelBtn, { borderColor: themeColors.border }]} onPress={cancelEdit} accessibilityRole="button" accessibilityLabel="Abbrechen">
                  <Text style={[styles.cancelBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
                </BNMPressable>
                <BNMPressable style={styles.saveBtn} onPress={handleSave} disabled={isSaving} accessibilityRole="button" accessibilityLabel="Speichern">
                  <Text style={styles.saveBtnText}>{isSaving ? "..." : t("common.save")}</Text>
                </BNMPressable>
              </View>
            </View>
          )}

          {/* Template List */}
          {messageTemplates.map((tmpl) => (
            <View key={tmpl.id} style={[styles.templateCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <View style={styles.templateHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.templateTitle, { color: themeColors.text }]}>{tmpl.title}</Text>
                  <Text style={[styles.templateCategory, { color: themeColors.textTertiary }]}>{tmpl.category}</Text>
                </View>
                <View style={styles.templateActions}>
                  <BNMPressable onPress={() => startEdit(tmpl)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Bearbeiten">
                    <Ionicons name="pencil" size={18} color={themeColors.textSecondary} />
                  </BNMPressable>
                  <BNMPressable onPress={() => handleDelete(tmpl.id)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Loeschen">
                    <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                  </BNMPressable>
                </View>
              </View>
              <Text style={[styles.templatePreview, { color: themeColors.textSecondary }]} numberOfLines={4}>
                {tmpl.body}
              </Text>
            </View>
          ))}

          {messageTemplates.length === 0 && !editingId && (
            <View style={styles.emptyBox}>
              <Ionicons name="document-text-outline" size={48} color={themeColors.textTertiary} />
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("templates.empty")}</Text>
            </View>
          )}
        </ScrollView>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: { flex: 1 },
  backText: { fontSize: 16, fontWeight: "500" },
  headerTitle: { fontWeight: "800", fontSize: 16 },
  addButton: { flex: 1, alignItems: "flex-end" },
  scroll: { flex: 1 },
  content: { padding: 24, paddingBottom: 40 },
  hint: { fontSize: 12, marginBottom: 16, textAlign: "center" },

  // Form
  formCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 20,
  },
  formLabel: { fontWeight: "600", fontSize: 13, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  inputMulti: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: Platform.OS === "web" ? 300 : 160,
  },
  placeholderHint: { fontSize: 11, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  catChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
  formActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: { flex: 1, borderWidth: 1, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: "center" },
  cancelBtnText: { fontWeight: "600", fontSize: 14 },
  saveBtn: { flex: 1, backgroundColor: COLORS.cta, borderRadius: RADIUS.sm, paddingVertical: 10, alignItems: "center" },
  saveBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },

  // Template cards
  templateCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
  },
  templateHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  templateTitle: { fontWeight: "700", fontSize: 14 },
  templateCategory: { fontSize: 11, marginTop: 2, textTransform: "capitalize" },
  templateActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  templatePreview: { fontSize: 12, lineHeight: 18 },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 14, marginTop: 8 },
});
