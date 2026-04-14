import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Resource } from "../../types";

const RESOURCE_CATEGORIES = ["general", "lernmaterial", "organisation", "kontakt", "event"];

export default function ResourcesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { resources, addResource, updateResource, deleteResource, getEventParticipationsByResourceId, getResourceCompletionCount, users, sessionTypes } = useData();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newIcon, setNewIcon] = useState("link-outline");
  const [newCategory, setNewCategory] = useState("general");
  const [newVisibleTo, setNewVisibleTo] = useState<string>("all");
  const [newVisibleUntil, setNewVisibleUntil] = useState("");
  const [newVisibleAfterSession, setNewVisibleAfterSession] = useState<string | null>(null);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editVisibleTo, setEditVisibleTo] = useState<string>("all");
  const [editVisibleUntil, setEditVisibleUntil] = useState("");
  const [editVisibleAfterSession, setEditVisibleAfterSession] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const isSavingRef = React.useRef(false);

  const sortedResources = [...resources].sort((a, b) => a.sort_order - b.sort_order);

  if (user?.role !== "admin") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>Kein Zugriff</Text>
      </View>
    );
  }

  function moveUp(idx: number) {
    if (idx === 0) return;
    const item = sortedResources[idx];
    const prev = sortedResources[idx - 1];
    updateResource(item.id, { sort_order: prev.sort_order });
    updateResource(prev.id, { sort_order: item.sort_order });
  }

  function moveDown(idx: number) {
    if (idx === sortedResources.length - 1) return;
    const item = sortedResources[idx];
    const next = sortedResources[idx + 1];
    updateResource(item.id, { sort_order: next.sort_order });
    updateResource(next.id, { sort_order: item.sort_order });
  }

  async function handleToggleActive(res: Resource) {
    try {
      await updateResource(res.id, { is_active: !res.is_active });
      showSuccess(res.is_active ? "Deaktiviert" : "Aktiviert");
    } catch {
      showError("Fehler beim Aktualisieren");
    }
  }

  async function handleDelete(res: Resource) {
    const ok = await showConfirm("Ressource löschen", `"${res.title}" wirklich löschen?`);
    if (!ok) return;
    try {
      await deleteResource(res.id);
      showSuccess("Gelöscht");
    } catch {
      showError("Fehler beim Löschen");
    }
  }

  function startEdit(res: Resource) {
    setEditingId(res.id);
    setEditTitle(res.title);
    setEditUrl(res.url);
    setEditDescription(res.description);
    setEditIcon(res.icon);
    setEditCategory(res.category);
    setEditVisibleTo(res.visible_to ?? "all");
    setEditVisibleUntil(res.visible_until ? res.visible_until.slice(0, 10) : "");
    setEditVisibleAfterSession(res.visible_after_session_type_id ?? null);
  }

  async function handleSaveEdit() {
    if (!editingId || !editTitle.trim() || !editUrl.trim()) {
      showError("Titel und URL sind Pflichtfelder");
      return;
    }
    setIsSaving(true);
    try {
      await updateResource(editingId, {
        title: editTitle.trim(),
        url: editUrl.trim(),
        description: editDescription.trim(),
        icon: editIcon.trim() || "link-outline",
        category: editCategory,
        visible_to: editVisibleTo as any,
        visible_until: editVisibleUntil ? new Date(editVisibleUntil).toISOString() : null,
        visible_after_session_type_id: editVisibleAfterSession,
      });
      setEditingId(null);
      showSuccess("Gespeichert");
    } catch {
      showError("Fehler beim Speichern");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAdd() {
    if (!newTitle.trim() || !newUrl.trim()) {
      showError("Titel und URL sind Pflichtfelder");
      return;
    }
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);
    try {
      const maxOrder = resources.length > 0 ? Math.max(...resources.map((r) => r.sort_order)) + 1 : 1;
      await addResource({
        title: newTitle.trim(),
        url: newUrl.trim(),
        description: newDescription.trim(),
        icon: newIcon.trim() || "link-outline",
        category: newCategory,
        sort_order: maxOrder,
        is_active: true,
        visible_to: newVisibleTo as any,
        visible_until: newVisibleUntil ? new Date(newVisibleUntil).toISOString() : null,
        visible_after_session_type_id: newVisibleAfterSession,
      });
      setNewTitle("");
      setNewUrl("");
      setNewDescription("");
      setNewIcon("link-outline");
      setNewCategory("general");
      setNewVisibleTo("all");
      setNewVisibleUntil("");
      setNewVisibleAfterSession(null);
      setShowAddForm(false);
      showSuccess("Ressource hinzugefügt");
    } catch (err) {
      showError("Fehler: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  }

  const ICON_OPTIONS = [
    "link-outline", "book-outline", "globe-outline", "videocam-outline",
    "document-text-outline", "school-outline", "people-outline", "heart-outline",
    "star-outline", "megaphone-outline", "calendar-outline", "chatbubble-outline",
  ];

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <KeyboardAvoidingView
        style={[styles.flex1, { backgroundColor: themeColors.background }]}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
          <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>Ressourcen verwalten</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              {sortedResources.length} Ressource{sortedResources.length !== 1 ? "n" : ""} - Links für das Mentor-Dashboard
            </Text>

            {/* Info Box */}
            <View style={[styles.blueBox, { backgroundColor: sem(SEMANTIC.blueBg, isDark), borderColor: isDark ? "#2d4a7a" : "#dbeafe" }]}>
              <Text style={[styles.blueTitle, { color: isDark ? "#93c5fd" : "#1e40af" }]}>Hinweis</Text>
              <Text style={[styles.blueText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>
                Ressourcen werden als klickbare Karten auf dem Mentor-Dashboard angezeigt. Inaktive Ressourcen sind für Mentoren nicht sichtbar.
              </Text>
            </View>

            {/* Resource List */}
            {sortedResources.length === 0 ? (
              <EmptyState
                icon="link-outline"
                title="Ressourcen"
                description="Noch keine Ressourcen vorhanden."
                compact
              />
            ) : (
              <View style={[styles.listCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                {sortedResources.map((res, idx) => (
                  <View
                    key={res.id}
                    style={[
                      styles.listItem,
                      idx < sortedResources.length - 1 ? [styles.listItemBorder, { borderBottomColor: themeColors.border }] : {},
                      !res.is_active && { opacity: 0.5 },
                    ]}
                  >
                    {/* Icon */}
                    <View style={[styles.iconCircle, { backgroundColor: COLORS.gold + "20" }]}>
                      <Ionicons name={res.icon as any} size={20} color={COLORS.gold} />
                    </View>

                    {/* Content or Edit Form */}
                    {editingId === res.id ? (
                      <View style={[styles.itemContent, { gap: 6 }]}>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                          value={editTitle}
                          onChangeText={setEditTitle}
                          placeholder="Titel"
                          placeholderTextColor={themeColors.textTertiary}
                        />
                        <TextInput
                          style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                          value={editUrl}
                          onChangeText={setEditUrl}
                          placeholder="URL (https://...)"
                          placeholderTextColor={themeColors.textTertiary}
                          autoCapitalize="none"
                          keyboardType="url"
                        />
                        <TextInput
                          style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                          value={editDescription}
                          onChangeText={setEditDescription}
                          placeholder="Beschreibung (optional)"
                          placeholderTextColor={themeColors.textTertiary}
                        />
                        <Text style={[styles.formLabel, { color: themeColors.textSecondary, marginBottom: 4 }]}>Icon</Text>
                        <View style={styles.iconGrid}>
                          {ICON_OPTIONS.map((ico) => (
                            <BNMPressable
                              key={ico}
                              style={[styles.iconOption, {
                                borderColor: editIcon === ico ? COLORS.gold : themeColors.border,
                                backgroundColor: editIcon === ico ? COLORS.gold + "15" : themeColors.background,
                              }]}
                              onPress={() => setEditIcon(ico)}
                              accessibilityRole="radio"
                              accessibilityLabel={ico}
                            >
                              <Ionicons name={ico as any} size={18} color={editIcon === ico ? COLORS.gold : themeColors.textSecondary} />
                            </BNMPressable>
                          ))}
                        </View>
                        <Text style={[styles.formLabel, { color: themeColors.textSecondary, marginBottom: 4 }]}>Kategorie</Text>
                        <View style={styles.chipRow}>
                          {RESOURCE_CATEGORIES.map((cat) => (
                            <BNMPressable
                              key={cat}
                              style={[styles.catChip, {
                                borderColor: editCategory === cat ? COLORS.gold : themeColors.border,
                                backgroundColor: editCategory === cat ? COLORS.gold + "15" : themeColors.background,
                              }]}
                              onPress={() => setEditCategory(cat)}
                              accessibilityRole="radio"
                              accessibilityLabel={cat}
                            >
                              <Text style={[styles.catChipText, { color: editCategory === cat ? COLORS.gold : themeColors.textSecondary }]}>
                                {cat}
                              </Text>
                            </BNMPressable>
                          ))}
                        </View>
                        {/* Sichtbarkeit */}
                        <Text style={{ fontSize: 12, fontWeight: "500", color: themeColors.textSecondary, marginTop: 6, marginBottom: 4 }}>Sichtbar für</Text>
                        <View style={styles.chipRow}>
                          {([
                            { key: "all", label: "Alle" },
                            { key: "mentors", label: "Mentoren" },
                            { key: "mentees", label: "Mentees" },
                            { key: "male", label: "Brüder" },
                            { key: "female", label: "Schwestern" },
                          ] as const).map((opt) => (
                            <BNMPressable
                              key={opt.key}
                              style={[styles.catChip, {
                                borderColor: editVisibleTo === opt.key ? COLORS.gradientStart : themeColors.border,
                                backgroundColor: editVisibleTo === opt.key ? COLORS.gradientStart + "15" : themeColors.background,
                              }]}
                              onPress={() => setEditVisibleTo(opt.key)}
                              accessibilityRole="radio"
                              accessibilityLabel={opt.label}
                            >
                              <Text style={[styles.catChipText, { color: editVisibleTo === opt.key ? COLORS.gradientStart : themeColors.textSecondary }]}>
                                {opt.label}
                              </Text>
                            </BNMPressable>
                          ))}
                        </View>
                        <TextInput
                          style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text, marginTop: 4 }]}
                          value={editVisibleUntil}
                          onChangeText={setEditVisibleUntil}
                          placeholder="Sichtbar bis: JJJJ-MM-TT (leer = unbegrenzt)"
                          placeholderTextColor={themeColors.textTertiary}
                        />
                        {/* Sichtbar ab Phase */}
                        <Text style={{ fontSize: 12, fontWeight: "500", color: themeColors.textSecondary, marginTop: 6, marginBottom: 4 }}>Ab Phase</Text>
                        <View style={styles.chipRow}>
                          <BNMPressable
                            style={[styles.catChip, {
                              borderColor: !editVisibleAfterSession ? COLORS.cta : themeColors.border,
                              backgroundColor: !editVisibleAfterSession ? COLORS.cta + "15" : themeColors.background,
                            }]}
                            onPress={() => setEditVisibleAfterSession(null)}
                            accessibilityRole="radio"
                            accessibilityLabel="Immer"
                          >
                            <Text style={[styles.catChipText, { color: !editVisibleAfterSession ? COLORS.cta : themeColors.textSecondary }]}>Immer</Text>
                          </BNMPressable>
                          {[...sessionTypes].sort((a, b) => a.sort_order - b.sort_order).map((st) => (
                            <BNMPressable
                              key={st.id}
                              style={[styles.catChip, {
                                borderColor: editVisibleAfterSession === st.id ? COLORS.cta : themeColors.border,
                                backgroundColor: editVisibleAfterSession === st.id ? COLORS.cta + "15" : themeColors.background,
                              }]}
                              onPress={() => setEditVisibleAfterSession(st.id)}
                              accessibilityRole="radio"
                              accessibilityLabel={st.name}
                            >
                              <Text style={[styles.catChipText, { color: editVisibleAfterSession === st.id ? COLORS.cta : themeColors.textSecondary }]} numberOfLines={1}>{st.name}</Text>
                            </BNMPressable>
                          ))}
                        </View>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                          <BNMPressable
                            style={[styles.arrowButton, { backgroundColor: themeColors.background, flex: 1 }]}
                            onPress={() => setEditingId(null)}
                            accessibilityRole="button"
                            accessibilityLabel="Abbrechen"
                          >
                            <Text style={{ color: themeColors.textSecondary, fontSize: 12, fontWeight: "600" }}>Abbrechen</Text>
                          </BNMPressable>
                          <BNMPressable
                            style={[styles.arrowButton, { backgroundColor: COLORS.cta, flex: 1 }]}
                            onPress={handleSaveEdit}
                            disabled={isSaving}
                            accessibilityRole="button"
                            accessibilityLabel="Speichern"
                          >
                            <Text style={{ color: COLORS.white, fontSize: 12, fontWeight: "600" }}>{isSaving ? "..." : "Speichern"}</Text>
                          </BNMPressable>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.itemContent}>
                        <Text style={[styles.itemName, { color: themeColors.text }]}>{res.title}</Text>
                        {res.description ? (
                          <Text style={[styles.itemDesc, { color: themeColors.textTertiary }]} numberOfLines={2}>
                            {res.description}
                          </Text>
                        ) : null}
                        <Text style={[styles.itemUrl, { color: COLORS.gold }]} numberOfLines={1}>{res.url}</Text>
                        <View style={styles.badgeRow}>
                          <View style={[styles.categoryBadge, { backgroundColor: themeColors.background }]}>
                            <Text style={[styles.categoryBadgeText, { color: themeColors.textTertiary }]}>{res.category}</Text>
                          </View>
                          {!res.is_active && (
                            <View style={[styles.categoryBadge, { backgroundColor: COLORS.errorBg }]}>
                              <Text style={[styles.categoryBadgeText, { color: COLORS.error }]}>inaktiv</Text>
                            </View>
                          )}
                          {res.visible_to !== "all" && (
                            <View style={[styles.categoryBadge, { backgroundColor: COLORS.gradientStart + "15" }]}>
                              <Text style={[styles.categoryBadgeText, { color: COLORS.gradientStart }]}>
                                {res.visible_to === "mentors" ? "Nur Mentoren" : res.visible_to === "mentees" ? "Nur Mentees" : res.visible_to === "male" ? "Nur Brüder" : "Nur Schwestern"}
                              </Text>
                            </View>
                          )}
                          {res.visible_until && (
                            <View style={[styles.categoryBadge, { backgroundColor: COLORS.gold + "15" }]}>
                              <Text style={[styles.categoryBadgeText, { color: COLORS.goldText }]}>
                                bis {new Date(res.visible_until).toLocaleDateString("de-DE")}
                              </Text>
                            </View>
                          )}
                          {res.visible_after_session_type_id && (() => {
                            const st = sessionTypes.find((s) => s.id === res.visible_after_session_type_id);
                            return st ? (
                              <View style={[styles.categoryBadge, { backgroundColor: COLORS.cta + "15" }]}>
                                <Text style={[styles.categoryBadgeText, { color: COLORS.cta }]}>
                                  ab {st.name}
                                </Text>
                              </View>
                            ) : null;
                          })()}
                        </View>
                        {/* Completion-Statistik */}
                        {res.category !== "event" && (() => {
                          const completionCount = getResourceCompletionCount(res.id);
                          const mentorCount = users.filter((u) => u.role === "mentor" && u.is_active !== false).length;
                          return completionCount > 0 ? (
                            <Text style={{ fontSize: 11, color: COLORS.cta, fontWeight: "600", marginTop: 4 }}>
                              ✓ {completionCount}/{mentorCount} Mentoren abgehakt
                            </Text>
                          ) : null;
                        })()}
                        {res.category === "event" && (() => {
                          const participations = getEventParticipationsByResourceId(res.id);
                          const confirmed = participations.filter((ep) => ep.status === "confirmed");
                          const interested = participations.filter((ep) => ep.status === "interested");
                          return (
                            <View style={{ marginTop: 6 }}>
                              <Text style={{ fontSize: 11, color: COLORS.gold, fontWeight: "600" }}>
                                {confirmed.length} bestätigt · {interested.length} interessiert
                              </Text>
                              {confirmed.length > 0 && (
                                <View style={{ marginTop: 4 }}>
                                  {confirmed.map((ep) => {
                                    const u = users.find((u) => u.id === ep.user_id);
                                    return (
                                      <Text key={ep.id} style={{ fontSize: 10, color: themeColors.textTertiary }}>
                                        • {u?.name ?? "Unbekannt"}
                                      </Text>
                                    );
                                  })}
                                </View>
                              )}
                            </View>
                          );
                        })()}
                      </View>
                    )}

                    {/* Actions */}
                    {editingId !== res.id && (
                      <View style={styles.actionsRow}>
                        <BNMPressable
                          style={[styles.arrowButton, { backgroundColor: themeColors.background }]}
                          onPress={() => startEdit(res)}
                          accessibilityRole="button"
                          accessibilityLabel={`${res.title} bearbeiten`}
                        >
                          <Ionicons name="pencil" size={14} color={COLORS.gradientStart} />
                        </BNMPressable>
                        <BNMPressable
                          style={[styles.arrowButton, { backgroundColor: themeColors.background }]}
                          onPress={() => handleToggleActive(res)}
                          accessibilityRole="button"
                          accessibilityLabel={res.is_active ? "Deaktivieren" : "Aktivieren"}
                        >
                          <Ionicons name={res.is_active ? "eye-outline" : "eye-off-outline"} size={14} color={themeColors.textSecondary} />
                        </BNMPressable>
                        <BNMPressable
                          style={[styles.arrowButton, { backgroundColor: themeColors.background }, idx === 0 ? { opacity: 0.3 } : {}]}
                          onPress={() => moveUp(idx)}
                          disabled={idx === 0}
                          accessibilityRole="button"
                          accessibilityLabel="Nach oben"
                        >
                          <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>&#x25B2;</Text>
                        </BNMPressable>
                        <BNMPressable
                          style={[
                            styles.arrowButton,
                            { backgroundColor: themeColors.background },
                            idx === sortedResources.length - 1 ? { opacity: 0.3 } : {},
                          ]}
                          onPress={() => moveDown(idx)}
                          disabled={idx === sortedResources.length - 1}
                          accessibilityRole="button"
                          accessibilityLabel="Nach unten"
                        >
                          <Text style={[styles.arrowText, { color: themeColors.textSecondary }]}>&#x25BC;</Text>
                        </BNMPressable>
                        <BNMPressable
                          style={styles.deleteButton}
                          onPress={() => handleDelete(res)}
                          accessibilityRole="button"
                          accessibilityLabel={`${res.title} löschen`}
                        >
                          <Ionicons name="trash-outline" size={14} color={COLORS.error} />
                        </BNMPressable>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {/* Add Form */}
            {showAddForm ? (
              <View style={[styles.addFormCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <Text style={[styles.addFormTitle, { color: themeColors.text }]}>Neue Ressource</Text>

                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Titel *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="z.B. Leitfaden für Mentoren"
                  placeholderTextColor={themeColors.textTertiary}
                />

                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>URL *</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                  value={newUrl}
                  onChangeText={setNewUrl}
                  placeholder="https://..."
                  placeholderTextColor={themeColors.textTertiary}
                  autoCapitalize="none"
                  keyboardType="url"
                />

                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Beschreibung</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  placeholder="Kurze Beschreibung (optional)"
                  placeholderTextColor={themeColors.textTertiary}
                />

                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Icon</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((ico) => (
                    <BNMPressable
                      key={ico}
                      style={[styles.iconOption, {
                        borderColor: newIcon === ico ? COLORS.gold : themeColors.border,
                        backgroundColor: newIcon === ico ? COLORS.gold + "15" : themeColors.background,
                      }]}
                      onPress={() => setNewIcon(ico)}
                      accessibilityRole="radio"
                      accessibilityLabel={ico}
                    >
                      <Ionicons name={ico as any} size={18} color={newIcon === ico ? COLORS.gold : themeColors.textSecondary} />
                    </BNMPressable>
                  ))}
                </View>

                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Kategorie</Text>
                <View style={styles.chipRow}>
                  {RESOURCE_CATEGORIES.map((cat) => (
                    <BNMPressable
                      key={cat}
                      style={[styles.catChip, {
                        borderColor: newCategory === cat ? COLORS.gold : themeColors.border,
                        backgroundColor: newCategory === cat ? COLORS.gold + "15" : themeColors.background,
                      }]}
                      onPress={() => setNewCategory(cat)}
                      accessibilityRole="radio"
                      accessibilityLabel={cat}
                    >
                      <Text style={[styles.catChipText, { color: newCategory === cat ? COLORS.gold : themeColors.textSecondary }]}>
                        {cat}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>

                {/* Sichtbarkeit */}
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Sichtbar für</Text>
                <View style={styles.chipRow}>
                  {([
                    { key: "all", label: "Alle" },
                    { key: "mentors", label: "Nur Mentoren" },
                    { key: "mentees", label: "Nur Mentees" },
                    { key: "male", label: "Nur Brüder" },
                    { key: "female", label: "Nur Schwestern" },
                  ] as const).map((opt) => (
                    <BNMPressable
                      key={opt.key}
                      style={[styles.catChip, {
                        borderColor: newVisibleTo === opt.key ? COLORS.gradientStart : themeColors.border,
                        backgroundColor: newVisibleTo === opt.key ? COLORS.gradientStart + "15" : themeColors.background,
                      }]}
                      onPress={() => setNewVisibleTo(opt.key)}
                      accessibilityRole="radio"
                      accessibilityLabel={opt.label}
                    >
                      <Text style={[styles.catChipText, { color: newVisibleTo === opt.key ? COLORS.gradientStart : themeColors.textSecondary }]}>
                        {opt.label}
                      </Text>
                    </BNMPressable>
                  ))}
                </View>

                {/* Sichtbar bis */}
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Sichtbar bis (optional)</Text>
                <TextInput
                  style={[styles.textInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
                  value={newVisibleUntil}
                  onChangeText={setNewVisibleUntil}
                  placeholder="JJJJ-MM-TT (leer = unbegrenzt)"
                  placeholderTextColor={themeColors.textTertiary}
                />

                {/* Sichtbar ab Session-Phase */}
                <Text style={[styles.formLabel, { color: themeColors.textSecondary }]}>Sichtbar ab Phase (optional)</Text>
                <View style={styles.chipRow}>
                  <BNMPressable
                    style={[styles.catChip, {
                      borderColor: !newVisibleAfterSession ? COLORS.cta : themeColors.border,
                      backgroundColor: !newVisibleAfterSession ? COLORS.cta + "15" : themeColors.background,
                    }]}
                    onPress={() => setNewVisibleAfterSession(null)}
                    accessibilityRole="radio"
                    accessibilityLabel="Immer"
                  >
                    <Text style={[styles.catChipText, { color: !newVisibleAfterSession ? COLORS.cta : themeColors.textSecondary }]}>Immer</Text>
                  </BNMPressable>
                  {[...sessionTypes].sort((a, b) => a.sort_order - b.sort_order).map((st) => (
                    <BNMPressable
                      key={st.id}
                      style={[styles.catChip, {
                        borderColor: newVisibleAfterSession === st.id ? COLORS.cta : themeColors.border,
                        backgroundColor: newVisibleAfterSession === st.id ? COLORS.cta + "15" : themeColors.background,
                      }]}
                      onPress={() => setNewVisibleAfterSession(st.id)}
                      accessibilityRole="radio"
                      accessibilityLabel={st.name}
                    >
                      <Text style={[styles.catChipText, { color: newVisibleAfterSession === st.id ? COLORS.cta : themeColors.textSecondary }]} numberOfLines={1}>{st.name}</Text>
                    </BNMPressable>
                  ))}
                </View>

                <View style={styles.formButtonRow}>
                  <BNMPressable
                    style={[styles.cancelFormButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => {
                      setShowAddForm(false);
                      setNewTitle("");
                      setNewUrl("");
                      setNewDescription("");
                      setNewIcon("link-outline");
                      setNewCategory("general");
                      setNewVisibleTo("all");
                      setNewVisibleUntil("");
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Abbrechen"
                  >
                    <Text style={[styles.cancelFormButtonText, { color: themeColors.textSecondary }]}>Abbrechen</Text>
                  </BNMPressable>
                  <BNMPressable
                    style={styles.addButton}
                    onPress={handleAdd}
                    disabled={isSaving}
                    accessibilityRole="button"
                    accessibilityLabel="Hinzufuegen"
                  >
                    <Text style={styles.addButtonText}>{isSaving ? "..." : "Hinzufuegen"}</Text>
                  </BNMPressable>
                </View>
              </View>
            ) : (
              <BNMPressable
                style={styles.primaryButton}
                onPress={() => setShowAddForm(true)}
                accessibilityRole="button"
                accessibilityLabel="Neue Ressource hinzufuegen"
              >
                <Text style={styles.primaryButtonText}>+ Neue Ressource</Text>
              </BNMPressable>
            )}
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
  pageTitle: { fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  pageSubtitle: { marginBottom: 24, color: COLORS.secondary },
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
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemContent: { flex: 1, marginRight: 12 },
  itemName: { fontWeight: "600", marginBottom: 2 },
  itemDesc: { fontSize: 12, marginBottom: 2 },
  itemUrl: { fontSize: 11, marginBottom: 4 },
  badgeRow: { flexDirection: "row", gap: 6 },
  categoryBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  categoryBadgeText: { fontSize: 10, textTransform: "capitalize" },
  actionsRow: { flexDirection: "column", alignItems: "center", gap: 4 },
  arrowButton: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  arrowText: { fontSize: 12 },
  deleteButton: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.errorBg,
    alignItems: "center",
    justifyContent: "center",
  },
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
  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  iconOption: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  catChip: {
    borderWidth: 1,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  catChipText: { fontSize: 12, fontWeight: "600", textTransform: "capitalize" },
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
