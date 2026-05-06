import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { SessionType } from "../../types";
import { COLORS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function SessionTypesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { sessionTypes, addSessionType, updateSessionTypeOrder, updateSessionType, deleteSessionType } = useData();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

  // Edit-State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  function moveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...sortedTypes];
    const temp = updated[idx];
    updated[idx] = { ...updated[idx - 1], sort_order: updated[idx].sort_order };
    updated[idx - 1] = { ...temp, sort_order: updated[idx - 1].sort_order };
    updateSessionTypeOrder(updated);
  }

  function moveDown(idx: number) {
    if (idx === sortedTypes.length - 1) return;
    const updated = [...sortedTypes];
    const temp = updated[idx];
    updated[idx] = { ...updated[idx + 1], sort_order: updated[idx].sort_order };
    updated[idx + 1] = { ...temp, sort_order: updated[idx + 1].sort_order };
    updateSessionTypeOrder(updated);
  }

  async function handleDelete(st: SessionType) {
    if (st.is_default) {
      showError(t("sessionTypes.errorDefault"));
      return;
    }
    const ok = await showConfirm(t("sessionTypes.deleteTitle"), t("sessionTypes.deleteText").replace("{0}", `"${st.name}"`));
    if (ok) deleteSessionType(st.id);
  }

  function startEdit(st: SessionType) {
    setEditingId(st.id);
    setEditName(st.name);
    setEditDescription(st.description ?? "");
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) {
      showError(t("sessionTypes.errorName"));
      return;
    }
    try {
      await updateSessionType(editingId, { name: editName.trim(), description: editDescription.trim() });
      setEditingId(null);
      showSuccess("Gespeichert");
    } catch (err) {
      showError("Fehler beim Speichern: " + (err instanceof Error ? err.message : String(err)));
    }
  }

  function handleAdd() {
    if (!newName.trim()) {
      showError(t("sessionTypes.errorName"));
      return;
    }
    const maxOrder = Math.max(...sessionTypes.map((st) => st.sort_order), 0);
    addSessionType({
      name: newName.trim(),
      description: newDescription.trim(),
      sort_order: maxOrder + 1,
      is_default: false,
    });
    setNewName("");
    setNewDescription("");
    setShowAddForm(false);
  }

  if (user?.role !== "admin" && user?.role !== "office") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("sessionTypes.accessDenied")}</Text>
      </View>
    );
  }

  const isAdminRole = user?.role === "admin";

  return (
    <Container fullWidth={Platform.OS === "web"}>
    <KeyboardAvoidingView
      style={[styles.flex1, { backgroundColor: themeColors.background }]}
      behavior="padding"
    >
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <BNMPressable onPress={() => router.back()} style={styles.backBtn} accessibilityRole="link" accessibilityLabel="Zurück">
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>← Zurück</Text>
          </BNMPressable>
        </View>
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("sessionTypes.title")}</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
          {t("sessionTypes.subtitle").replace("{0}", String(sortedTypes.length))}
        </Text>

        {/* Hinweis */}
        <View style={[styles.blueBox, { backgroundColor: sem(SEMANTIC.blueBg, isDark), borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
          <Text style={[styles.blueTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{t("sessionTypes.infoTitle")}</Text>
          <Text style={[styles.blueText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
            {t("sessionTypes.infoText")}
          </Text>
        </View>

        {/* Liste */}
        {sortedTypes.length === 0 ? (
          <EmptyState
            icon="list-outline"
            title={t("sessionTypes.title")}
            description="Noch keine Sitzungstypen vorhanden."
            compact
          />
        ) : (
        <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          {sortedTypes.map((st, idx) => (
            <View
              key={st.id}
              style={[
                styles.listItem,
                idx < sortedTypes.length - 1 ? [styles.listItemBorder, { borderBottomColor: themeColors.border }] : {},
              ]}
            >
              {/* Nummer */}
              <View style={styles.numberCircle}>
                <Text style={styles.numberText}>{idx + 1}</Text>
              </View>

              {/* Inhalt */}
              {editingId === st.id ? (
                <View style={[styles.itemContent, { gap: 6 }]}>
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text, marginBottom: 0 }]}
                    value={editName}
                    onChangeText={setEditName}
                    placeholder={t("sessionTypes.namePlaceholder")}
                    placeholderTextColor={themeColors.textTertiary}
                  />
                  <TextInput
                    style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text, marginBottom: 0, minHeight: 50 }]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder={t("sessionTypes.descPlaceholder")}
                    placeholderTextColor={themeColors.textTertiary}
                    multiline
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <BNMPressable
                      style={[styles.arrowButton, { backgroundColor: themeColors.background, flex: 1 }]}
                      onPress={() => setEditingId(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Abbrechen"
                    >
                      <Text style={[{ color: themeColors.textSecondary, fontSize: 12, fontWeight: "600" }]}>✕</Text>
                    </BNMPressable>
                    <BNMPressable
                      style={[styles.arrowButton, { backgroundColor: COLORS.cta, flex: 1 }]}
                      onPress={handleSaveEdit}
                      accessibilityRole="button"
                      accessibilityLabel="Speichern"
                    >
                      <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: "600" }}>✓</Text>
                    </BNMPressable>
                  </View>
                </View>
              ) : (
                <View style={styles.itemContent}>
                  <View style={styles.itemNameRow}>
                    <Text style={[styles.itemName, { color: themeColors.text }]}>{st.name}</Text>
                    {st.is_default && (
                      <View style={[styles.standardBadge, { backgroundColor: themeColors.background }]}>
                        <Text style={[styles.standardBadgeText, { color: themeColors.textTertiary }]}>{t("sessionTypes.standard")}</Text>
                      </View>
                    )}
                  </View>
                  {st.description ? (
                    <Text style={[styles.itemDesc, { color: themeColors.textTertiary }]} numberOfLines={2}>
                      {st.description}
                    </Text>
                  ) : null}
                </View>
              )}

              {/* Aktionen (nur Admin) */}
              {isAdminRole && editingId !== st.id && (
                <View style={styles.actionsRow}>
                  {/* Bearbeiten */}
                  <BNMPressable
                    style={[styles.arrowButton, { backgroundColor: themeColors.background }]}
                    onPress={() => startEdit(st)}
                    accessibilityRole="button"
                    accessibilityLabel={`${st.name} bearbeiten`}
                  >
                    <Text style={[styles.arrowText, { color: COLORS.gradientStart }]}>✎</Text>
                  </BNMPressable>

                  {/* Hoch */}
                  <BNMPressable
                    style={[styles.arrowButton, { backgroundColor: themeColors.background }, idx === 0 ? { opacity: 0.3 } : {}]}
                    onPress={() => moveUp(idx)}
                    disabled={idx === 0}
                    accessibilityRole="button"
                    accessibilityLabel={`${st.name} nach oben verschieben`}
                  >
                    <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>▲</Text>
                  </BNMPressable>

                  {/* Runter */}
                  <BNMPressable
                    style={[
                      styles.arrowButton,
                      { backgroundColor: themeColors.background },
                      idx === sortedTypes.length - 1 ? { opacity: 0.3 } : {},
                    ]}
                    onPress={() => moveDown(idx)}
                    disabled={idx === sortedTypes.length - 1}
                    accessibilityRole="button"
                    accessibilityLabel={`${st.name} nach unten verschieben`}
                  >
                    <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>▼</Text>
                  </BNMPressable>

                  {/* Löschen (nur custom) */}
                  {!st.is_default && (
                    <BNMPressable
                      style={styles.deleteButton}
                      onPress={() => handleDelete(st)}
                      accessibilityRole="button"
                      accessibilityLabel={`${st.name} löschen`}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </BNMPressable>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>
        )}

        {/* Neuen Typ hinzufügen (nur Admin) */}
        {isAdminRole && showAddForm ? (
          <View style={[styles.addFormCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.addFormTitle, { color: themeColors.text }]}>{t("sessionTypes.addTitle")}</Text>

            <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("sessionTypes.nameLabel")}</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
              value={newName}
              onChangeText={setNewName}
              placeholder={t("sessionTypes.namePlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
            />

            <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>{t("sessionTypes.descLabel")}</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text, minHeight: 80, marginBottom: 16 }]}
              value={newDescription}
              onChangeText={setNewDescription}
              placeholder={t("sessionTypes.descPlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={styles.formButtonRow}>
              <BNMPressable
                style={[styles.cancelFormButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                onPress={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewDescription("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Abbrechen"
              >
                <Text style={[styles.cancelFormButtonText, { color: themeColors.textSecondary }]}>{t("sessionTypes.cancel")}</Text>
              </BNMPressable>
              <BNMPressable style={styles.addButton} onPress={handleAdd} accessibilityRole="button" accessibilityLabel="Hinzufügen">
                <Text style={styles.addButtonText}>{t("sessionTypes.add")}</Text>
              </BNMPressable>
            </View>
          </View>
        ) : isAdminRole ? (
          <BNMPressable
            style={styles.primaryButton}
            onPress={() => setShowAddForm(true)}
            accessibilityRole="button"
            accessibilityLabel="Neuen Sitzungstyp hinzufügen"
          >
            <Text style={styles.primaryButtonText}>{t("sessionTypes.addNew")}</Text>
          </BNMPressable>
        ) : null}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },
  page: { padding: 24 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  backBtn: { paddingRight: 8, paddingVertical: 4 },
  backBtnText: { fontSize: 16, fontWeight: "500" },
  pageTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { marginBottom: 24 },
  blueBox: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    padding: 14,
    marginBottom: 24,
  },
  blueTitle: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  blueText: { fontSize: 12 },
  listCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  listItem: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  listItemBorder: { borderBottomWidth: 1 },
  numberCircle: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  numberText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
  itemContent: { flex: 1, marginRight: 12 },
  itemNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 2 },
  itemName: { fontWeight: "600" },
  standardBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  standardBadgeText: { fontSize: 12 },
  itemDesc: { fontSize: 12 },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  arrowButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 14 },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.errorBg,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  deleteButtonText: { color: COLORS.error, fontSize: 14, fontWeight: "bold" },
  addFormCard: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  addFormTitle: { fontWeight: "bold", marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderRadius: RADIUS.xs,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  formButtonRow: { flexDirection: "row", gap: 12 },
  cancelFormButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelFormButtonText: { fontWeight: "600" },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  addButtonText: { color: COLORS.white, fontWeight: "600" },
  primaryButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "bold" },
});
