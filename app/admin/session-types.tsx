import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { showError, showConfirm } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { SessionType } from "../../types";
import { COLORS } from "../../constants/Colors";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

export default function SessionTypesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { sessionTypes, addSessionType, updateSessionTypeOrder, deleteSessionType } = useData();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");

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
    <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
      <View style={styles.page}>
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("sessionTypes.title")}</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
          {t("sessionTypes.subtitle").replace("{0}", String(sortedTypes.length))}
        </Text>

        {/* Hinweis */}
        <View style={[styles.blueBox, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff", borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
          <Text style={[styles.blueTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>{t("sessionTypes.infoTitle")}</Text>
          <Text style={[styles.blueText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
            {t("sessionTypes.infoText")}
          </Text>
        </View>

        {/* Liste */}
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

              {/* Aktionen (nur Admin) */}
              {isAdminRole && (
                <View style={styles.actionsRow}>
                  {/* Hoch */}
                  <TouchableOpacity
                    style={[styles.arrowButton, { backgroundColor: themeColors.background }, idx === 0 ? { opacity: 0.3 } : {}]}
                    onPress={() => moveUp(idx)}
                    disabled={idx === 0}
                  >
                    <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>▲</Text>
                  </TouchableOpacity>

                  {/* Runter */}
                  <TouchableOpacity
                    style={[
                      styles.arrowButton,
                      { backgroundColor: themeColors.background },
                      idx === sortedTypes.length - 1 ? { opacity: 0.3 } : {},
                    ]}
                    onPress={() => moveDown(idx)}
                    disabled={idx === sortedTypes.length - 1}
                  >
                    <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>▼</Text>
                  </TouchableOpacity>

                  {/* Löschen (nur custom) */}
                  {!st.is_default && (
                    <TouchableOpacity
                      style={styles.deleteButton}
                      onPress={() => handleDelete(st)}
                    >
                      <Text style={styles.deleteButtonText}>✕</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ))}
        </View>

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
              <TouchableOpacity
                style={[styles.cancelFormButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                onPress={() => {
                  setShowAddForm(false);
                  setNewName("");
                  setNewDescription("");
                }}
              >
                <Text style={[styles.cancelFormButtonText, { color: themeColors.textSecondary }]}>{t("sessionTypes.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
                <Text style={styles.addButtonText}>{t("sessionTypes.add")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : isAdminRole ? (
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => setShowAddForm(true)}
          >
            <Text style={styles.primaryButtonText}>{t("sessionTypes.addNew")}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  centerContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  accessText: { fontWeight: "600" },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { marginBottom: 24 },
  blueBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    marginBottom: 24,
  },
  blueTitle: { fontSize: 14, fontWeight: "500", marginBottom: 4 },
  blueText: { fontSize: 12 },
  listCard: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  listItem: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", alignItems: "center" },
  listItemBorder: { borderBottomWidth: 1 },
  numberCircle: {
    width: 32,
    height: 32,
    borderRadius: 9999,
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
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 14 },
  deleteButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#fef2f2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  deleteButtonText: { color: "#ef4444", fontSize: 14, fontWeight: "bold" },
  addFormCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 14,
    marginBottom: 16,
  },
  addFormTitle: { fontWeight: "bold", marginBottom: 16 },
  formLabel: { fontSize: 14, fontWeight: "500", marginBottom: 8 },
  textInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  formButtonRow: { flexDirection: "row", gap: 12 },
  cancelFormButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  cancelFormButtonText: { fontWeight: "600" },
  addButton: {
    flex: 1,
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  addButtonText: { color: COLORS.white, fontWeight: "600" },
  primaryButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "bold" },
});
