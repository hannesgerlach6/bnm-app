import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData, type Hadith } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { COLORS } from "../../constants/Colors";
import { showError, showSuccess } from "../../lib/errorHandler";

type FormData = {
  text_ar: string;
  text_de: string;
  source: string;
};

const EMPTY_FORM: FormData = {
  text_ar: "",
  text_de: "",
  source: "",
};

// CSV-Zeile parsen: Arabisch;Deutsch;Quelle (Semikolon-getrennt)
function parseCSVLine(line: string): { text_ar: string; text_de: string; source: string } | null {
  const parts = line.split(";");
  if (parts.length < 2) return null;
  const text_de = (parts[1] ?? "").trim();
  if (!text_de) return null;
  return {
    text_ar: (parts[0] ?? "").trim(),
    text_de,
    source: (parts[2] ?? "").trim(),
  };
}

function parseCSVContent(content: string): Array<{ text_ar: string; text_de: string; source: string }> {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCSVLine)
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

export default function HaditheManagementScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { hadithe, refreshData, addHadith, updateHadith, deleteHadith, reorderHadithe, bulkInsertHadithe } = useData();

  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingHadith, setEditingHadith] = useState<Hadith | null>(null);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // CSV Import State
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [csvPreview, setCSVPreview] = useState<Array<{ text_ar: string; text_de: string; source: string }>>([]);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const sortedHadithe = [...hadithe].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  function openAddForm() {
    setEditingHadith(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
    setShowCSVImport(false);
  }

  function openEditForm(h: Hadith) {
    setEditingHadith(h);
    setForm({ text_ar: h.text_ar ?? "", text_de: h.text_de, source: h.source ?? "" });
    setShowForm(true);
    setShowCSVImport(false);
  }

  function cancelForm() {
    setShowForm(false);
    setEditingHadith(null);
    setForm(EMPTY_FORM);
  }

  async function handleSave() {
    if (!form.text_de.trim()) {
      showError(t("haditheMgmt.errorTextDe"));
      return;
    }
    setSaving(true);
    try {
      if (editingHadith) {
        await updateHadith(editingHadith.id, {
          text_ar: form.text_ar.trim() || undefined,
          text_de: form.text_de.trim(),
          source: form.source.trim() || undefined,
        });
      } else {
        await addHadith(form.text_ar.trim(), form.text_de.trim(), form.source.trim());
      }
      cancelForm();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(h: Hadith) {
    const ok = await new Promise<boolean>((resolve) => {
      Alert.alert(t("haditheMgmt.delete"), t("haditheMgmt.confirmDelete"), [
        { text: t("common.cancel"), onPress: () => resolve(false), style: "cancel" },
        { text: t("common.confirm"), onPress: () => resolve(true) },
      ]);
    });
    if (!ok) return;
    try {
      await deleteHadith(h.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    }
  }

  async function handleReorder(id: string, direction: "up" | "down") {
    try {
      await reorderHadithe(id, direction);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    }
  }

  // CSV Import — Web: file input; Native: Alert mit Paste-Hinweis + TextInput
  const [csvText, setCSVText] = useState("");
  const [showCSVText, setShowCSVText] = useState(false);

  function openCSVImport() {
    setShowForm(false);
    setShowCSVImport(true);
    setCSVPreview([]);
    setCSVText("");
    setShowCSVText(false);
  }

  function handleCSVTextChange(text: string) {
    setCSVText(text);
    const parsed = parseCSVContent(text);
    setCSVPreview(parsed);
  }

  function handleWebFileSelect() {
    if (Platform.OS !== "web") return;
    // Dynamisch ein file-input erstellen (kein nativewind, kein DOM-Zustand im JSX)
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv,text/plain";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      setCSVText(text);
      setCSVPreview(parseCSVContent(text));
      setShowCSVText(true);
    };
    input.click();
  }

  async function handleImport() {
    if (csvPreview.length === 0) {
      showError(t("haditheMgmt.csvEmpty"));
      return;
    }
    setImporting(true);
    try {
      const count = await bulkInsertHadithe(csvPreview);
      showSuccess(t("haditheMgmt.imported").replace("{0}", String(count)));
      setShowCSVImport(false);
      setCSVPreview([]);
      setCSVText("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showError(msg);
    } finally {
      setImporting(false);
    }
  }

  if (user?.role !== "admin" && user?.role !== "office") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>Zugriff verweigert</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
          {/* Header */}
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Text style={[styles.backText, { color: themeColors.textSecondary }]}>‹ Zurück</Text>
            </TouchableOpacity>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("haditheMgmt.title")}</Text>
          </View>

          {/* Aktionsbuttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.addButton, showForm && !editingHadith ? styles.addButtonActive : {}]}
              onPress={openAddForm}
            >
              <Text style={styles.addButtonText}>+ {t("haditheMgmt.addNew")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.csvButton, showCSVImport ? styles.csvButtonActive : {}]}
              onPress={openCSVImport}
            >
              <Text style={styles.csvButtonText}>{t("haditheMgmt.csvImport")}</Text>
            </TouchableOpacity>
          </View>

          {/* Inline-Formular: Neuer / Bearbeiteter Hadith */}
          {showForm && (
            <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.formTitle, { color: themeColors.text }]}>
                {editingHadith ? t("haditheMgmt.edit") : t("haditheMgmt.addNew")}
              </Text>

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("haditheMgmt.textAr")}</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                value={form.text_ar}
                onChangeText={(v) => setForm((p) => ({ ...p, text_ar: v }))}
                multiline
                numberOfLines={3}
                placeholder="بِسْمِ اللَّهِ..."
                placeholderTextColor={themeColors.textTertiary}
                textAlign="right"
              />

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>
                {t("haditheMgmt.textDe")} *
              </Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                value={form.text_de}
                onChangeText={(v) => setForm((p) => ({ ...p, text_de: v }))}
                multiline
                numberOfLines={4}
                placeholder="Deutsche Übersetzung..."
                placeholderTextColor={themeColors.textTertiary}
              />

              <Text style={[styles.fieldLabel, { color: themeColors.textSecondary }]}>{t("haditheMgmt.source")}</Text>
              <TextInput
                style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                value={form.source}
                onChangeText={(v) => setForm((p) => ({ ...p, source: v }))}
                placeholder="z.B. Sahih Bukhari, Hadith 5027"
                placeholderTextColor={themeColors.textTertiary}
              />

              <View style={styles.formButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={cancelForm}>
                  <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>{t("haditheMgmt.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                  <Text style={styles.saveBtnText}>{saving ? "…" : t("haditheMgmt.save")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* CSV Import Panel */}
          {showCSVImport && (
            <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.formTitle, { color: themeColors.text }]}>{t("haditheMgmt.csvImport")}</Text>
              <Text style={[styles.csvHint, { color: themeColors.textTertiary }]}>{t("haditheMgmt.csvFormat")}</Text>

              {/* Web: File-Picker Button */}
              {Platform.OS === "web" && (
                <TouchableOpacity style={styles.filePickerBtn} onPress={handleWebFileSelect}>
                  <Text style={styles.filePickerText}>Datei auswählen (.csv)</Text>
                </TouchableOpacity>
              )}

              {/* CSV Text-Eingabe (immer verfügbar, auch auf Native) */}
              <TouchableOpacity
                style={[styles.csvToggleBtn, { borderColor: themeColors.border }]}
                onPress={() => setShowCSVText((v) => !v)}
              >
                <Text style={[styles.csvToggleBtnText, { color: themeColors.textSecondary }]}>
                  {showCSVText ? "Text ausblenden" : "CSV-Text einfügen"}
                </Text>
              </TouchableOpacity>

              {showCSVText && (
                <TextInput
                  style={[styles.textArea, { height: 120, backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                  value={csvText}
                  onChangeText={handleCSVTextChange}
                  multiline
                  placeholder={"Arabisch;Deutsch;Quelle\nاللهم...;O Allah...;Sahih Muslim"}
                  placeholderTextColor={themeColors.textTertiary}
                />
              )}

              {/* Vorschau */}
              {csvPreview.length > 0 && (
                <View style={[styles.previewBox, { borderColor: themeColors.border }]}>
                  <Text style={[styles.previewTitle, { color: themeColors.text }]}>
                    {t("haditheMgmt.importPreview")} ({csvPreview.length})
                  </Text>
                  {csvPreview.slice(0, 5).map((row, i) => (
                    <View key={i} style={[styles.previewRow, { borderBottomColor: themeColors.border }]}>
                      {row.text_ar ? (
                        <Text style={[styles.previewAr, { color: themeColors.text }]} numberOfLines={1}>{row.text_ar}</Text>
                      ) : null}
                      <Text style={[styles.previewDe, { color: themeColors.textSecondary }]} numberOfLines={2}>{row.text_de}</Text>
                      {row.source ? (
                        <Text style={[styles.previewSource, { color: themeColors.textTertiary }]}>{row.source}</Text>
                      ) : null}
                    </View>
                  ))}
                  {csvPreview.length > 5 && (
                    <Text style={[styles.previewMore, { color: themeColors.textTertiary }]}>
                      + {csvPreview.length - 5} weitere...
                    </Text>
                  )}
                </View>
              )}

              <View style={styles.formButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCSVImport(false)}>
                  <Text style={[styles.cancelBtnText, { color: themeColors.textSecondary }]}>{t("haditheMgmt.cancel")}</Text>
                </TouchableOpacity>
                {csvPreview.length > 0 && (
                  <TouchableOpacity style={styles.saveBtn} onPress={handleImport} disabled={importing}>
                    <Text style={styles.saveBtnText}>{importing ? "…" : t("haditheMgmt.importButton")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}

          {/* Hadith-Liste */}
          <View style={[styles.listCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.listTitle, { color: themeColors.text }]}>
              {t("haditheMgmt.title")} ({sortedHadithe.length})
            </Text>

            {sortedHadithe.length === 0 ? (
              <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("haditheMgmt.empty")}</Text>
            ) : (
              sortedHadithe.map((h, idx) => (
                <View
                  key={h.id}
                  style={[
                    styles.hadithRow,
                    idx < sortedHadithe.length - 1 ? [styles.hadithRowBorder, { borderBottomColor: themeColors.border }] : {},
                  ]}
                >
                  {/* Sortier-Buttons */}
                  <View style={styles.orderButtons}>
                    <TouchableOpacity
                      style={[styles.orderBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                      onPress={() => handleReorder(h.id, "up")}
                      disabled={idx === 0}
                    >
                      <Text style={[styles.orderBtnText, idx === 0 ? { opacity: 0.3 } : {}, { color: themeColors.text }]}>↑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.orderBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                      onPress={() => handleReorder(h.id, "down")}
                      disabled={idx === sortedHadithe.length - 1}
                    >
                      <Text style={[styles.orderBtnText, idx === sortedHadithe.length - 1 ? { opacity: 0.3 } : {}, { color: themeColors.text }]}>↓</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Text-Inhalt */}
                  <View style={styles.hadithContent}>
                    {h.text_ar ? (
                      <Text style={[styles.hadithAr, { color: themeColors.text }]} numberOfLines={2}>
                        {h.text_ar}
                      </Text>
                    ) : null}
                    <Text style={[styles.hadithDe, { color: themeColors.textSecondary }]} numberOfLines={3}>
                      {h.text_de}
                    </Text>
                    {h.source ? (
                      <Text style={[styles.hadithSource, { color: themeColors.textTertiary }]}>{h.source}</Text>
                    ) : null}
                  </View>

                  {/* Aktionen */}
                  <View style={styles.hadithActions}>
                    <TouchableOpacity
                      style={[styles.editBtn, { borderColor: themeColors.border }]}
                      onPress={() => openEditForm(h)}
                    >
                      <Text style={[styles.editBtnText, { color: themeColors.textSecondary }]}>{t("haditheMgmt.edit")}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => handleDelete(h)}
                    >
                      <Text style={styles.deleteBtnText}>{t("haditheMgmt.delete")}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  accessText: { fontSize: 16 },
  page: { padding: 16, paddingBottom: 40, paddingTop: Platform.OS === "ios" ? 50 : 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  backButton: { paddingVertical: 4, paddingRight: 8 },
  backText: { fontSize: 16 },
  pageTitle: { fontSize: 22, fontWeight: "700", flex: 1 },
  actionRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  addButtonActive: { opacity: 0.7 },
  addButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  csvButton: {
    flex: 1,
    backgroundColor: "transparent",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingVertical: 10,
    alignItems: "center",
  },
  csvButtonActive: { backgroundColor: "rgba(238,167,27,0.12)" },
  csvButtonText: { color: COLORS.gold, fontWeight: "700", fontSize: 14 },

  // Formular
  formCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  formTitle: { fontSize: 16, fontWeight: "700", marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    minHeight: 80,
    textAlignVertical: "top",
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    height: 44,
  },
  formButtons: { flexDirection: "row", gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "600" },
  saveBtn: {
    flex: 1,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: COLORS.gradientStart,
  },
  saveBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },

  // CSV Import
  csvHint: { fontSize: 12, marginBottom: 10, lineHeight: 18 },
  filePickerBtn: {
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 8,
  },
  filePickerText: { color: COLORS.cta, fontWeight: "600", fontSize: 14 },
  csvToggleBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 8,
    alignItems: "center",
    marginBottom: 8,
  },
  csvToggleBtnText: { fontSize: 13, fontWeight: "600" },
  previewBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
  },
  previewTitle: { fontWeight: "700", fontSize: 13, marginBottom: 8 },
  previewRow: {
    paddingVertical: 6,
    borderBottomWidth: 1,
  },
  previewAr: { fontSize: 14, textAlign: "right", marginBottom: 2 },
  previewDe: { fontSize: 13, lineHeight: 18 },
  previewSource: { fontSize: 11, marginTop: 2 },
  previewMore: { fontSize: 12, marginTop: 6, textAlign: "center" },

  // Liste
  listCard: {
    borderRadius: 10,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 2,
  },
  listTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  emptyText: { fontSize: 14, textAlign: "center", paddingVertical: 20 },
  hadithRow: {
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  hadithRowBorder: { borderBottomWidth: 1 },
  orderButtons: { gap: 4, flexShrink: 0 },
  orderBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  orderBtnText: { fontSize: 14, fontWeight: "700" },
  hadithContent: { flex: 1 },
  hadithAr: {
    fontSize: 15,
    textAlign: "right",
    lineHeight: 22,
    marginBottom: 4,
    fontWeight: "500",
  },
  hadithDe: { fontSize: 13, lineHeight: 18, marginBottom: 2 },
  hadithSource: { fontSize: 11 },
  hadithActions: { flexShrink: 0, gap: 4 },
  editBtn: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  editBtnText: { fontSize: 12, fontWeight: "600" },
  deleteBtn: {
    backgroundColor: "rgba(239,68,68,0.08)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 5,
    alignItems: "center",
  },
  deleteBtnText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
});
