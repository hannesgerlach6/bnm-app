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
const EMAIL_CATEGORIES = ["einladung", "absage", "willkommen", "general"];

type TemplateTab = "chat" | "email";

export default function MessageTemplatesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { messageTemplates, refreshData } = useData();

  const [activeTab, setActiveTab] = useState<TemplateTab>("chat");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={{ color: themeColors.text }}>{t("common.noAccess")}</Text>
      </View>
    );
  }

  // Filter templates by tab
  const isEmailTemplate = (tmpl: MessageTemplate) => tmpl.title.startsWith("[E-Mail]");
  const chatTemplates = messageTemplates.filter((t) => !isEmailTemplate(t));
  const emailTemplates = messageTemplates.filter((t) => isEmailTemplate(t));
  const displayedTemplates = activeTab === "chat" ? chatTemplates : emailTemplates;

  function startEdit(tmpl: MessageTemplate) {
    setEditingId(tmpl.id);
    if (activeTab === "email") {
      // Parse "[E-Mail] Title" format and extract subject from body
      const rawTitle = tmpl.title.replace(/^\[E-Mail\]\s*/, "");
      setTitle(rawTitle);
      // Body format: "Betreff: ...\n---\n..."
      const bodyParts = tmpl.body.split("\n---\n");
      if (bodyParts.length >= 2) {
        setSubject(bodyParts[0].replace(/^Betreff:\s*/, ""));
        setBody(bodyParts.slice(1).join("\n---\n"));
      } else {
        setSubject("");
        setBody(tmpl.body);
      }
    } else {
      setTitle(tmpl.title);
      setBody(tmpl.body);
    }
    setCategory(tmpl.category);
  }

  function startNew() {
    setEditingId("new");
    setTitle("");
    setCategory(activeTab === "email" ? "einladung" : "general");
    setSubject("");
    setBody("");
  }

  function cancelEdit() {
    setEditingId(null);
    setTitle("");
    setSubject("");
    setBody("");
  }

  async function handleSave() {
    if (!title.trim() || !body.trim()) {
      showError(t("templates.errorEmpty"));
      return;
    }
    if (activeTab === "email" && !subject.trim()) {
      showError("Bitte einen Betreff eingeben");
      return;
    }
    setIsSaving(true);
    try {
      // For email templates: prefix title with [E-Mail] and encode subject in body
      const finalTitle = activeTab === "email" ? `[E-Mail] ${title.trim()}` : title.trim();
      const finalBody = activeTab === "email"
        ? `Betreff: ${subject.trim()}\n---\n${body.trim()}`
        : body.trim();

      if (editingId === "new") {
        const { error } = await supabase.from("message_templates").insert({
          title: finalTitle,
          category,
          body: finalBody,
          subject: activeTab === "email" ? subject.trim() : "",
          sort_order: messageTemplates.length + 1,
        });
        if (error) throw error;
        showSuccess(t("templates.saved"));
      } else {
        const { error } = await supabase.from("message_templates").update({
          title: finalTitle,
          category,
          body: finalBody,
          subject: activeTab === "email" ? subject.trim() : "",
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
    try {
      const { error } = await supabase.from("message_templates").delete().eq("id", id);
      if (error) {
        showError(t("common.error"));
        return;
      }
      showSuccess(t("templates.deleted"));
      await refreshData();
    } catch {
      showError(t("common.error"));
    }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.root, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: themeColors.card, borderBottomColor: themeColors.border, paddingTop: insets.top + 16 }]}>
          <BNMPressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="link" accessibilityLabel="Zurück">
            <Text style={[styles.backText, { color: themeColors.text }]}>{"\u2039"} {t("common.back")}</Text>
          </BNMPressable>
          <Text style={[styles.headerTitle, { color: themeColors.text }]}>{t("templates.manage")}</Text>
          <BNMPressable onPress={startNew} style={styles.addButton} accessibilityRole="button" accessibilityLabel="Neue Vorlage erstellen">
            <Ionicons name="add-circle" size={28} color={COLORS.gold} />
          </BNMPressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Tab Switcher */}
          <View style={styles.tabRow}>
            <BNMPressable
              style={[styles.tab, activeTab === "chat" && styles.tabActive, { borderColor: activeTab === "chat" ? COLORS.gold : themeColors.border }]}
              onPress={() => { setActiveTab("chat"); cancelEdit(); }}
              accessibilityRole="tab"
              accessibilityLabel="Chat-Vorlagen"
              accessibilityState={{ selected: activeTab === "chat" }}
            >
              <Ionicons name="chatbubble-outline" size={16} color={activeTab === "chat" ? COLORS.gold : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "chat" ? COLORS.gold : themeColors.textSecondary }]}>Chat-Vorlagen</Text>
            </BNMPressable>
            <BNMPressable
              style={[styles.tab, activeTab === "email" && styles.tabActive, { borderColor: activeTab === "email" ? COLORS.gold : themeColors.border }]}
              onPress={() => { setActiveTab("email"); cancelEdit(); }}
              accessibilityRole="tab"
              accessibilityLabel="E-Mail-Vorlagen"
              accessibilityState={{ selected: activeTab === "email" }}
            >
              <Ionicons name="mail-outline" size={16} color={activeTab === "email" ? COLORS.gold : themeColors.textSecondary} />
              <Text style={[styles.tabText, { color: activeTab === "email" ? COLORS.gold : themeColors.textSecondary }]}>E-Mail-Vorlagen</Text>
            </BNMPressable>
          </View>

          <Text style={[styles.hint, { color: themeColors.textTertiary }]}>
            {activeTab === "chat" ? t("templates.hint") : "E-Mail-Vorlagen mit Betreff und Text. Platzhalter: {name}, {datum}, {mentor_name}"}
          </Text>

          {/* Edit Form */}
          {editingId && (
            <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.formLabel, { color: themeColors.text }]}>{t("templates.titleLabel")}</Text>
              <TextInput
                style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.elevated }]}
                value={title}
                onChangeText={setTitle}
                placeholder={activeTab === "email" ? "z.B. Einladung zum Gespräch" : t("templates.titlePlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
              />

              <Text style={[styles.formLabel, { color: themeColors.text }]}>{t("templates.categoryLabel")}</Text>
              <View style={styles.chipRow}>
                {(activeTab === "email" ? EMAIL_CATEGORIES : CATEGORIES).map((cat) => (
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

              {/* Subject field for email templates */}
              {activeTab === "email" && (
                <>
                  <Text style={[styles.formLabel, { color: themeColors.text }]}>Betreff</Text>
                  <TextInput
                    style={[styles.input, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.elevated }]}
                    value={subject}
                    onChangeText={setSubject}
                    placeholder="z.B. Einladung: Erstgespräch am {datum}"
                    placeholderTextColor={themeColors.textTertiary}
                  />
                  <Text style={[styles.placeholderHint, { color: themeColors.textTertiary }]}>
                    Platzhalter: {"{name}"}, {"{datum}"}, {"{mentor_name}"}, {"{mentee_name}"}
                  </Text>
                </>
              )}

              <Text style={[styles.formLabel, { color: themeColors.text }]}>
                {activeTab === "email" ? "E-Mail-Text" : t("templates.bodyLabel")}
              </Text>
              <Text style={[styles.placeholderHint, { color: themeColors.textTertiary }]}>
                {activeTab === "email"
                  ? "Platzhalter: {name}, {datum}, {mentor_name}, {mentee_name}, {link}"
                  : t("templates.placeholderHint")}
              </Text>
              <TextInput
                style={[styles.inputMulti, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.elevated }]}
                value={body}
                onChangeText={setBody}
                placeholder={activeTab === "email"
                  ? "Assalamu alaikum {name},\n\nwir laden dich herzlich ein..."
                  : t("templates.bodyPlaceholder")}
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
          {displayedTemplates.map((tmpl) => {
            const displayTitle = activeTab === "email" ? tmpl.title.replace(/^\[E-Mail\]\s*/, "") : tmpl.title;
            const displayBody = activeTab === "email"
              ? tmpl.body.replace(/^Betreff:.*?\n---\n/, "")
              : tmpl.body;
            const emailSubject = activeTab === "email"
              ? tmpl.body.match(/^Betreff:\s*(.*?)(?:\n|$)/)?.[1] ?? ""
              : "";

            return (
              <View key={tmpl.id} style={[styles.templateCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.templateHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.templateTitle, { color: themeColors.text }]}>{displayTitle}</Text>
                    {activeTab === "email" && emailSubject ? (
                      <Text style={[styles.templateCategory, { color: COLORS.gold }]}>Betreff: {emailSubject}</Text>
                    ) : null}
                    {activeTab === "email" && tmpl.template_key ? (
                      <View style={styles.templateKeyBadge}>
                        <Ionicons name="link" size={10} color={COLORS.gradientStart} />
                        <Text style={styles.templateKeyText}>{tmpl.template_key}</Text>
                      </View>
                    ) : null}
                    <Text style={[styles.templateCategory, { color: themeColors.textTertiary }]}>{tmpl.category}</Text>
                  </View>
                  <View style={styles.templateActions}>
                    <BNMPressable onPress={() => startEdit(tmpl)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Bearbeiten">
                      <Ionicons name="pencil" size={18} color={themeColors.textSecondary} />
                    </BNMPressable>
                    <BNMPressable onPress={() => handleDelete(tmpl.id)} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Löschen">
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </BNMPressable>
                  </View>
                </View>
                <Text style={[styles.templatePreview, { color: themeColors.textSecondary }]} numberOfLines={4}>
                  {displayBody}
                </Text>
              </View>
            );
          })}

          {displayedTemplates.length === 0 && !editingId && (
            <View style={styles.emptyBox}>
              <Ionicons name={activeTab === "email" ? "mail-outline" : "document-text-outline"} size={48} color={themeColors.textTertiary} />
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                {activeTab === "email" ? "Noch keine E-Mail-Vorlagen vorhanden" : t("templates.empty")}
              </Text>
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
  tabRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  tabActive: {
    backgroundColor: COLORS.gold + "15",
  },
  tabText: { fontSize: 13, fontWeight: "600" },
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
  templateKeyBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 3,
    backgroundColor: COLORS.gradientStart + "15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    alignSelf: "flex-start",
  },
  templateKeyText: { fontSize: 10, color: COLORS.gradientStart, fontWeight: "600", fontFamily: Platform.OS === "web" ? "monospace" : undefined },
  templateActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  templatePreview: { fontSize: 12, lineHeight: 18 },

  // Empty
  emptyBox: { alignItems: "center", paddingVertical: 48 },
  emptyText: { fontSize: 14, marginTop: 8 },
});
