import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TextInput,
  RefreshControl,
  StyleSheet,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Mentorship } from "../../types";
import { COLORS, SHADOWS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { showError, showSuccess } from "../../lib/errorHandler";
import { SkeletonList } from "../../components/Skeleton";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import { navigateToChat } from "../../lib/chatNavigation";
import { SlideOverPanel } from "../../components/SlideOverPanel";
import { MenteeDetailPanel } from "../../components/MenteeDetailPanel";
import { EmptyState } from "../../components/EmptyState";
import { StatusBadge } from "../../components/StatusBadge";

export default function MenteesScreen() {
  usePageTitle("Mentees");
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "admin" || user.role === "office") return <Container fullWidth={Platform.OS === "web"}><AdminMenteesView /></Container>;
  if (user.role === "mentor") return <Container fullWidth={Platform.OS === "web"}><MentorMenteesView /></Container>;
  return <Container fullWidth={Platform.OS === "web"}><MenteeProgressView /></Container>;
}

function getMentorshipDuration(assignedAt: string): { weeks: number; days: number; label: string; color: string } {
  const start = new Date(assignedAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(days / 7);
  const label = weeks >= 1 ? `${weeks} Wochen` : `${days} Tage`;
  const color = weeks <= 8 ? COLORS.cta : weeks <= 12 ? COLORS.gold : COLORS.error;
  return { weeks, days, label, color };
}

type AssignmentFilter = "all" | "assigned" | "unassigned";
type StatusFilter = "all" | "active" | "completed" | "cancelled" | "archived";
type GenderFilter = "all" | "male" | "female";
type SortKey = "name" | "city" | "progress" | "date";

function AdminMenteesView() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [search, setSearch] = useState("");
  const [assignFilter, setAssignFilter] = useState<AssignmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);

  // Multi-Select State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Erstes Confirm-Modal (Ja/Nein)
  const [confirmModal1, setConfirmModal1] = useState(false);
  // Zweites Confirm-Modal (Tippe LÖSCHEN)
  const [confirmModal2, setConfirmModal2] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { users, mentorships, sessionTypes, getCompletedStepIds, refreshData, isLoading, bulkDeleteUsers, setUserActive } = useData();
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // useFocusEffect refreshData entfernt — Realtime reicht, Pull-to-Refresh als Fallback

  function toggleSelectMode() {
    setSelectMode((prev) => !prev);
    setSelectedIds(new Set());
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll(ids: string[]) {
    setSelectedIds(new Set(ids));
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  async function handleBulkDelete() {
    setConfirmModal2(false);
    setIsDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await bulkDeleteUsers(ids);
      if (result.failed === 0) {
        showSuccess(t("admin.deleteSuccess").replace("{0}", String(result.success)));
      } else if (result.success === 0) {
        showError(t("admin.deleteFailed").replace("{0}", String(result.failed)));
      } else {
        showSuccess(t("admin.deletePartial").replace("{0}", String(result.success)).replace("{1}", String(result.failed)));
      }
    } finally {
      setIsDeleting(false);
      setSelectMode(false);
      setSelectedIds(new Set());
      setDeleteInput("");
    }
  }

  const allMentees = users.filter((u) => u.role === "mentee");

  function handleExportCsv() {
    try {
      const header = t("mentees.csvHeaderRow");
      const rows = filteredMentees.map((mentee) => {
        const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
        const status = mentorship
          ? mentorship.status === "active" ? t("mentees.csvStatusActive")
          : mentorship.status === "completed" ? t("mentees.csvStatusCompleted")
          : mentorship.status === "pending_approval" ? t("mentees.pendingApproval")
          : t("mentees.csvStatusCancelled")
          : t("mentees.csvStatusOpen");
        const mentorName = mentorship?.mentor?.name ?? "";
        const completedSteps = mentorship ? getCompletedStepIds(mentorship.id).length : 0;
        const progress = sessionTypes.length > 0
          ? `${completedSteps}/${sessionTypes.length}`
          : "0/0";
        const gender = mentee.gender === "male" ? t("mentees.csvGenderBrother") : t("mentees.csvGenderSister");
        return `"${mentee.name}","${mentee.email}","${mentee.city}",${mentee.age},"${gender}","${status}","${mentorName}","${progress}"`;
      }).join("\n");
      const csvContent = `${header}\n${rows}`;

      // Dateiname anhand des aktiven Filters bestimmen
      let filenamePart: string;
      if (assignFilter === "unassigned") {
        filenamePart = t("mentees.csvFileWithoutMentor");
      } else if (statusFilter === "active") {
        filenamePart = t("mentees.csvFileActive");
      } else if (statusFilter === "completed") {
        filenamePart = t("mentees.csvFileCompleted");
      } else if (statusFilter === "cancelled") {
        filenamePart = t("mentees.cancelled");
      } else {
        filenamePart = t("mentees.csvFileAll");
      }

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${filenamePart}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        showSuccess(t("csv.exporting"));
      }
    } catch {
      showError(t("csv.errorShare"));
    }
  }

  const archivedCount = useMemo(() => allMentees.filter((u) => u.is_active === false).length, [allMentees]);

  const filteredMentees = useMemo(() => allMentees
    .filter((mentee) => {
      // Archiv-Filter: nur deaktivierte anzeigen
      if (statusFilter === "archived") {
        return mentee.is_active === false &&
          (mentee.name.toLowerCase().includes(search.toLowerCase()) ||
           mentee.city.toLowerCase().includes(search.toLowerCase())) &&
          (genderFilter === "all" ? true : mentee.gender === genderFilter);
      }
      // Normaler Modus: deaktivierte ausblenden
      if (mentee.is_active === false) return false;

      const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
      const matchesSearch =
        mentee.name.toLowerCase().includes(search.toLowerCase()) ||
        mentee.city.toLowerCase().includes(search.toLowerCase());
      const matchesAssign =
        assignFilter === "all"
          ? true
          : assignFilter === "assigned"
          ? !!mentorship
          : !mentorship;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : mentorship
          ? mentorship.status === statusFilter
          : false;
      const matchesGender =
        genderFilter === "all" ? true : mentee.gender === genderFilter;
      return matchesSearch && matchesAssign && matchesStatus && matchesGender;
    })
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "city") return a.city.localeCompare(b.city);
      if (sortKey === "date") return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (sortKey === "progress") {
        const mA = mentorships.find((m) => m.mentee_id === a.id);
        const mB = mentorships.find((m) => m.mentee_id === b.id);
        const progA = mA ? getCompletedStepIds(mA.id).length : 0;
        const progB = mB ? getCompletedStepIds(mB.id).length : 0;
        return progB - progA;
      }
      return 0;
    }), [allMentees, mentorships, search, assignFilter, statusFilter, genderFilter, sortKey, getCompletedStepIds]);

  const selectedCount = selectedIds.size;
  const confirmWord = t("admin.deleteConfirmInput");

  return (
    <>
    {/* Erstes Bestätigungs-Modal */}
    <Modal visible={confirmModal1} transparent animationType="fade" onRequestClose={() => setConfirmModal1(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalBox, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("admin.deleteConfirmTitle")}</Text>
          <Text style={[styles.modalMsg, { color: themeColors.textSecondary }]}>
            {t("admin.deleteConfirmMessage").replace("{0}", String(selectedCount))}
          </Text>
          <View style={styles.modalButtons}>
            <BNMPressable
              style={[styles.modalBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setConfirmModal1(false)}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={[styles.modalBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
            </BNMPressable>
            <BNMPressable
              style={[styles.modalBtn, styles.modalBtnDanger]}
              onPress={() => { setConfirmModal1(false); setConfirmModal2(true); setDeleteInput(""); }}
              accessibilityRole="button"
              accessibilityLabel="Bestätigen"
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t("common.confirm")}</Text>
            </BNMPressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Zweites Bestätigungs-Modal mit Texteingabe */}
    <Modal visible={confirmModal2} transparent animationType="fade" onRequestClose={() => setConfirmModal2(false)}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.modalBox, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.modalTitle, { color: COLORS.error }]}>{t("admin.deleteConfirmSecond")}</Text>
          <Text style={[styles.modalMsg, { color: themeColors.textSecondary }]}>
            {t("admin.deleteConfirmSecondMessage")}
          </Text>
          <TextInput
            style={[styles.deleteInput, { backgroundColor: themeColors.background, borderColor: deleteInput.toUpperCase() === confirmWord.toUpperCase() ? COLORS.error : themeColors.border, color: themeColors.text }]}
            placeholder={t("admin.deleteConfirmPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={deleteInput}
            onChangeText={setDeleteInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <BNMPressable
              style={[styles.modalBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => { setConfirmModal2(false); setDeleteInput(""); }}
              accessibilityRole="button"
              accessibilityLabel="Abbrechen"
            >
              <Text style={[styles.modalBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
            </BNMPressable>
            <BNMPressable
              style={[styles.modalBtn, deleteInput.toUpperCase() === confirmWord.toUpperCase() ? styles.modalBtnDanger : styles.modalBtnDisabled]}
              onPress={deleteInput.toUpperCase() === confirmWord.toUpperCase() ? handleBulkDelete : undefined}
              disabled={deleteInput.toUpperCase() !== confirmWord.toUpperCase() || isDeleting}
              hapticStyle="error"
              accessibilityRole="button"
              accessibilityLabel={isDeleting ? "Wird gelöscht" : "Löschen bestätigen"}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                {isDeleting ? t("admin.deleting") : t("admin.deleteConfirmInput")}
              </Text>
            </BNMPressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <FlatList
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      contentContainerStyle={styles.page}
      data={isLoading ? [] : filteredMentees}
      keyExtractor={(item) => item.id}
      removeClippedSubviews={true}
      windowSize={10}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      ListHeaderComponent={
        <>
          <View style={styles.titleRow}>
            <View>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.allMentees")}</Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{allMentees.length} {t("mentees.registered")}</Text>
            </View>
            <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
              {!selectMode && Platform.OS === "web" && (
                <>
                  {user?.role === "admin" && (
                    <BNMPressable
                      style={[styles.csvButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                      onPress={() => router.push("/admin/csv-import")}
                      accessibilityRole="link"
                      accessibilityLabel="CSV importieren"
                    >
                      <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csvImport.title")}</Text>
                    </BNMPressable>
                  )}
                  <BNMPressable style={[styles.csvButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={handleExportCsv} accessibilityRole="button" accessibilityLabel="CSV exportieren">
                    <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csv.export")}</Text>
                  </BNMPressable>
                </>
              )}
              <BNMPressable
                style={[styles.csvButton, selectMode
                  ? { backgroundColor: themeColors.background, borderColor: themeColors.border }
                  : { backgroundColor: themeColors.card, borderColor: themeColors.border }
                ]}
                onPress={toggleSelectMode}
                accessibilityRole="button"
                accessibilityLabel={selectMode ? "Auswahl beenden" : "Mehrfachauswahl"}
              >
                <Text style={[styles.csvButtonText, { color: selectMode ? themeColors.textSecondary : themeColors.text }]}>
                  {selectMode ? t("admin.selectModeExit") : t("admin.selectMode")}
                </Text>
              </BNMPressable>
            </View>
          </View>

          {/* Suche */}
          <TextInput
            style={[styles.searchInput, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
            placeholder={t("mentees.search")}
            placeholderTextColor={themeColors.textTertiary}
            value={search}
            onChangeText={setSearch}
          />

          {/* Multi-Select: Alle / Keine */}
          {selectMode && (
            <View style={[styles.selectBar, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <BNMPressable onPress={() => selectAll(filteredMentees.map((m) => m.id))} accessibilityRole="button" accessibilityLabel="Alle auswählen">
                <Text style={[styles.selectBarBtn, { color: COLORS.gradientStart }]}>{t("admin.selectAll")}</Text>
              </BNMPressable>
              <Text style={[styles.selectBarSep, { color: themeColors.border }]}>|</Text>
              <BNMPressable onPress={selectNone} accessibilityRole="button" accessibilityLabel="Keine auswählen">
                <Text style={[styles.selectBarBtn, { color: themeColors.textSecondary }]}>{t("admin.selectNone")}</Text>
              </BNMPressable>
            </View>
          )}

          {/* Filter: kompakte Zeile */}
          <View style={[styles.filterBarRow, { marginBottom: 16 }]}>
            {/* Schnell-Chips */}
            <View style={styles.filterChipsGroup}>
              {/* "Alle" */}
              <BNMPressable
                style={[
                  styles.filterChip,
                  assignFilter === "all" && statusFilter === "all"
                    ? styles.filterChipActive
                    : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => { setAssignFilter("all"); setStatusFilter("all"); }}
                accessibilityRole="button"
                accessibilityLabel="Alle anzeigen"
              >
                <Text style={assignFilter === "all" && statusFilter === "all" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                  {t("mentees.all")}
                </Text>
              </BNMPressable>

              {/* "Ohne Mentor" */}
              <BNMPressable
                style={[
                  styles.filterChip,
                  assignFilter === "unassigned"
                    ? styles.filterChipActive
                    : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => { setAssignFilter("unassigned"); setStatusFilter("all"); }}
                accessibilityRole="button"
                accessibilityLabel="Ohne Mentor filtern"
              >
                <Text style={assignFilter === "unassigned" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                  {t("mentees.withoutMentor")}
                </Text>
              </BNMPressable>

              {/* "Aktiv" */}
              <BNMPressable
                style={[
                  styles.filterChip,
                  statusFilter === "active" && assignFilter !== "unassigned"
                    ? styles.filterChipActive
                    : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => { setStatusFilter("active"); setAssignFilter("all"); }}
                accessibilityRole="button"
                accessibilityLabel="Aktive filtern"
              >
                <Text style={statusFilter === "active" && assignFilter !== "unassigned" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                  {t("mentees.active")}
                </Text>
              </BNMPressable>

              {/* "Abgeschlossen" */}
              <BNMPressable
                style={[
                  styles.filterChip,
                  statusFilter === "completed" && assignFilter !== "unassigned"
                    ? styles.filterChipActive
                    : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => { setStatusFilter("completed"); setAssignFilter("all"); }}
                accessibilityRole="button"
                accessibilityLabel="Abgeschlossene filtern"
              >
                <Text style={statusFilter === "completed" && assignFilter !== "unassigned" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                  {t("mentees.completedStatus")}
                </Text>
              </BNMPressable>

              {/* "Abgebrochen" */}
              <BNMPressable
                style={[
                  styles.filterChip,
                  statusFilter === "cancelled" && assignFilter !== "unassigned"
                    ? styles.filterChipActive
                    : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                ]}
                onPress={() => { setStatusFilter("cancelled"); setAssignFilter("all"); }}
                accessibilityRole="button"
                accessibilityLabel="Abgebrochene filtern"
              >
                <Text style={statusFilter === "cancelled" && assignFilter !== "unassigned" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                  {t("mentees.cancelled")}
                </Text>
              </BNMPressable>

              {/* "Archiv" (deaktivierte) */}
              {archivedCount > 0 && (
                <BNMPressable
                  style={[
                    styles.filterChip,
                    statusFilter === "archived"
                      ? [styles.filterChipActive, { backgroundColor: COLORS.error, borderColor: COLORS.error }]
                      : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
                  ]}
                  onPress={() => { setStatusFilter("archived"); setAssignFilter("all"); }}
                  accessibilityRole="button"
                  accessibilityLabel="Archiv / Deaktivierte anzeigen"
                >
                  <Text style={statusFilter === "archived" ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                    Archiv ({archivedCount})
                  </Text>
                </BNMPressable>
              )}
            </View>

            {/* Sort-Icon */}
            <BNMPressable
              style={[styles.filterIconBtn, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
              onPress={() => {
                const order: SortKey[] = ["name", "city", "progress", "date"];
                const next = order[(order.indexOf(sortKey) + 1) % order.length];
                setSortKey(next);
              }}
              accessibilityRole="button"
              accessibilityLabel="Sortierung ändern"
            >
              <Ionicons name="swap-vertical-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.filterIconBtnText, { color: themeColors.textSecondary }]}>
                {sortKey === "name" ? t("mentees.sortName") : sortKey === "city" ? t("mentees.sortCity") : sortKey === "date" ? "Datum" : t("mentees.sortProgress")}
              </Text>
            </BNMPressable>
          </View>

          {/* Gender-Tabs: Alle / Brüder / Schwestern */}
          <View style={[styles.filterChipsGroup, { marginBottom: 12 }]}>
            {(["all", "male", "female"] as GenderFilter[]).map((g) => {
              const isActive = genderFilter === g;
              const label = g === "all" ? t("mentees.all") : g === "male" ? t("mentees.brothers") : t("mentees.sisters");
              return (
                <BNMPressable
                  key={g}
                  style={[styles.filterChip, isActive ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }]]}
                  onPress={() => setGenderFilter(g)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                >
                  <Text style={isActive ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]}>
                    {label}
                  </Text>
                </BNMPressable>
              );
            })}
          </View>
        </>
      }
      ListEmptyComponent={
        isLoading ? (
          <SkeletonList count={5} />
        ) : (
          <EmptyState
            icon="people-outline"
            title={t("mentees.noResults") ?? "Keine Mentees gefunden"}
            description="Versuche andere Filter oder füge neue Mentees hinzu."
          />
        )
      }
      renderItem={({ item: mentee }) => {
        const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
        const completedSteps = mentorship ? getCompletedStepIds(mentorship.id) : [];
        const progress = mentorship
          ? Math.round((completedSteps.length / sessionTypes.length) * 100)
          : 0;

        const badgeStatus = mentorship
          ? mentorship.status === "active" ? "active" as const
            : mentorship.status === "completed" ? "completed" as const
            : mentorship.status === "pending_approval" ? "pending" as const
            : "cancelled" as const
          : "pending" as const;
        const statusLabel =
          mentorship
            ? mentorship.status === "active"
              ? t("mentees.active")
              : mentorship.status === "completed"
              ? t("mentees.completedStatus")
              : mentorship.status === "pending_approval"
              ? t("mentees.pendingApproval")
              : t("mentees.cancelled")
            : t("mentees.unassigned");

        const isSelected = selectedIds.has(mentee.id);

        return (
          <BNMPressable
            style={[
              styles.menteeCard,
              { backgroundColor: isSelected ? (sem(SEMANTIC.greenBg, isDark)) : themeColors.card },
              mentorship ? styles.menteeCardAssigned : [styles.menteeCardUnassigned, { borderColor: themeColors.border }],
              isSelected && styles.menteeCardSelected,
            ]}
            onPress={() => {
              if (selectMode) {
                toggleSelect(mentee.id);
              } else if (Platform.OS === "web") {
                setSelectedMenteeId(mentee.id);
              } else {
                router.push({ pathname: "/mentee/[id]", params: { id: mentee.id } });
              }
            }}
            accessibilityRole="button"
            accessibilityLabel={`${mentee.name}, ${mentee.city}`}
          >
            <View style={styles.menteeCardHeader}>
              {selectMode && (
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </View>
              )}
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[styles.meneeName, { color: themeColors.text }]}>{mentee.name}</Text>
                  {mentee.is_active === false && (
                    <View style={[styles.blockedBadge, { backgroundColor: sem(SEMANTIC.redBg, isDark) }]}>
                      <Text style={[styles.blockedBadgeText, { color: sem(SEMANTIC.redTextDark, isDark) }]}>{t("editUser.blocked")}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.menteeSubText, { color: themeColors.textTertiary }]}>
                  {mentee.city} · {mentee.age} J. ·{" "}
                  {mentee.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
                </Text>
              </View>
              <StatusBadge status={badgeStatus} label={statusLabel} compact />
            </View>

            {!selectMode && mentorship ? (
              <>
                <Text style={[styles.mentorLabel, { color: themeColors.textTertiary }]}>{t("mentees.mentor")}: {mentorship.mentor?.name}</Text>
                {mentorship.status === "active" && (() => {
                  const dur = getMentorshipDuration(mentorship.assigned_at);
                  return (
                    <View style={[styles.durationChip, { backgroundColor: dur.color + "18" }]}>
                      <Text style={[styles.durationChipText, { color: dur.color }]}>Betreuung: seit {dur.label}</Text>
                    </View>
                  );
                })()}
                {mentorship.status === "cancelled" && (
                  <Text style={[styles.mentorLabel, { color: sem(SEMANTIC.redTextDark, isDark), marginTop: 2 }]}>
                    {mentorship.cancelled_at
                      ? new Date(mentorship.cancelled_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })
                      : ""}
                    {mentorship.cancel_reason ? ` · ${mentorship.cancel_reason}` : ""}
                  </Text>
                )}
                <View style={styles.progressRow}>
                  <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
                    <View
                      style={[styles.progressFill, { width: `${progress}%` as any }]}
                    />
                  </View>
                  <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
                    {completedSteps.length}/{sessionTypes.length}
                  </Text>
                </View>
              </>
            ) : !selectMode ? (
              <BNMPressable
                style={styles.assignButton}
                hapticStyle="light"
                onPress={(e) => {
                  e.stopPropagation();
                  router.push({ pathname: "/assign", params: { menteeId: mentee.id } });
                }}
                accessibilityRole="button"
                accessibilityLabel="Mentor zuweisen"
              >
                <Text style={styles.assignButtonText}>{t("mentees.assignMentor")}</Text>
              </BNMPressable>
            ) : null}

            {/* Reaktivieren-Button für archivierte User */}
            {!selectMode && statusFilter === "archived" && mentee.is_active === false && (
              <BNMPressable
                style={styles.reactivateButton}
                hapticStyle="success"
                onPress={async (e) => {
                  e.stopPropagation();
                  try {
                    await setUserActive(mentee.id, true);
                    showSuccess(`${mentee.name} wurde reaktiviert.`);
                  } catch {
                    showError(t("common.error"));
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Reaktivieren"
              >
                <Text style={styles.reactivateButtonText}>Reaktivieren</Text>
              </BNMPressable>
            )}
          </BNMPressable>
        );
      }}
    />

    {/* Footer-Bar im Select-Modus */}
    {selectMode && selectedCount > 0 && (
      <View style={[styles.footerBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <Text style={[styles.footerBarText, { color: themeColors.text }]}>
          {t("admin.xSelected").replace("{0}", String(selectedCount))}
        </Text>
        <BNMPressable
          style={styles.footerDeleteBtn}
          onPress={() => { setConfirmModal1(true); }}
          hapticStyle="error"
          accessibilityRole="button"
          accessibilityLabel={`${selectedCount} ausgewählte löschen`}
        >
          <Text style={styles.footerDeleteBtnText}>
            {t("admin.deleteSelected").replace("{0}", String(selectedCount))}
          </Text>
        </BNMPressable>
      </View>
    )}

    <SlideOverPanel
      visible={!!selectedMenteeId}
      onClose={() => setSelectedMenteeId(null)}
    >
      <MenteeDetailPanel id={selectedMenteeId} />
    </SlideOverPanel>
    </>
  );
}

function MentorMenteesView() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getMentorshipsByMentorId, getCompletedStepIds, sessionTypes, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");
  const [selectedMenteeId, setSelectedMenteeId] = useState<string | null>(null);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // useFocusEffect refreshData entfernt — Realtime reicht, Pull-to-Refresh als Fallback

  if (!user) return null;

  const myMentorships = getMentorshipsByMentorId(user.id);
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");

  const listData = activeTab === "active" ? activeMentorships : completedMentorships;

  // Web + Mobile: FlatList mit Tabs im Header
  return (
    <>
      <FlatList
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        contentContainerStyle={styles.page}
        data={listData}
        keyExtractor={(item) => item.id}
        removeClippedSubviews={true}
        windowSize={10}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
        ListHeaderComponent={
          <>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.myMentees")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              {activeMentorships.length} {t("mentees.activeMentorships")}
            </Text>

            {/* Tab-Switcher: Aktiv | Abgeschlossen */}
            <View style={[styles.tabSwitcher, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <BNMPressable
                style={[styles.tabSwitcherBtn, activeTab === "active" && styles.tabSwitcherBtnActive]}
                onPress={() => setActiveTab("active")}
                accessibilityRole="button"
                accessibilityLabel="Aktive Mentees"
                accessibilityState={{ selected: activeTab === "active" }}
              >
                <Text style={[styles.tabSwitcherText, activeTab === "active" ? styles.tabSwitcherTextActive : { color: themeColors.textSecondary }]}>
                  {t("mentees.active")}
                  {activeMentorships.length > 0 && (
                    <Text style={[styles.tabSwitcherCount, activeTab === "active" ? { color: COLORS.white } : { color: themeColors.textTertiary }]}>
                      {" "}{activeMentorships.length}
                    </Text>
                  )}
                </Text>
              </BNMPressable>
              <BNMPressable
                style={[styles.tabSwitcherBtn, activeTab === "completed" && styles.tabSwitcherBtnActive]}
                onPress={() => setActiveTab("completed")}
                accessibilityRole="button"
                accessibilityLabel="Abgeschlossene Mentees"
                accessibilityState={{ selected: activeTab === "completed" }}
              >
                <Text style={[styles.tabSwitcherText, activeTab === "completed" ? styles.tabSwitcherTextActive : { color: themeColors.textSecondary }]}>
                  {t("mentees.completedStatus")}
                  {completedMentorships.length > 0 && (
                    <Text style={[styles.tabSwitcherCount, activeTab === "completed" ? { color: COLORS.white } : { color: themeColors.textTertiary }]}>
                      {" "}{completedMentorships.length}
                    </Text>
                  )}
                </Text>
              </BNMPressable>
            </View>

            {/* Mentor kann selbst Mentee übernehmen (nur im aktiven Tab) */}
            {activeTab === "active" && (
              <BNMPressable
                style={styles.selfAssignButton}
                onPress={() => router.push("/assign")}
                accessibilityRole="link"
                accessibilityLabel="Mentee übernehmen"
              >
                <Text style={styles.selfAssignText}>{t("mentees.takeMentee")}</Text>
              </BNMPressable>
            )}
          </>
        }
        ListEmptyComponent={
          activeTab === "active" ? (
            <EmptyState
              icon="people-outline"
              title={t("mentees.noMenteesYet")}
              description={t("mentees.noMenteesText")}
              actionLabel={t("mentees.takeMenteeButton")}
              onAction={() => router.push("/assign")}
            />
          ) : (
            <EmptyState
              icon="checkmark-circle-outline"
              title={t("mentees.noCompletedYet")}
            />
          )
        }
        renderItem={({ item: mentorship }) => {
          if (activeTab === "active") {
            const completedSteps = getCompletedStepIds(mentorship.id);
            const progress = sessionTypes.length > 0
              ? Math.round((completedSteps.length / sessionTypes.length) * 100)
              : 0;
            return (
              <BNMPressable
                style={[styles.menteeCard, { backgroundColor: themeColors.card }, styles.menteeCardAssigned]}
                onPress={() => {
                  if (Platform.OS === "web") {
                    setSelectedMenteeId(mentorship.mentee_id);
                  } else {
                    router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } });
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel={`Mentee ${mentorship.mentee?.name ?? ""} anzeigen`}
              >
                <View style={styles.menteeCardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.meneeName, { color: themeColors.text }]}>{mentorship.mentee?.name}</Text>
                    <Text style={[styles.menteeSubText, { color: themeColors.textTertiary }]}>
                      {mentorship.mentee?.city} · {mentorship.mentee?.age} J.
                    </Text>
                  </View>
                  <StatusBadge status="active" label={t("mentees.active")} compact />
                </View>
                <View style={styles.mentorSplitProgressRow}>
                  <View style={[styles.mentorSplitTrack, { backgroundColor: sem(SEMANTIC.goldBorder, isDark) }]}>
                    <View style={[styles.mentorSplitFill, { width: `${progress}%` as any }]} />
                  </View>
                  <Text style={[styles.mentorSplitProgressText, { color: themeColors.textSecondary }]}>
                    {completedSteps.length}/{sessionTypes.length}
                  </Text>
                </View>
              </BNMPressable>
            );
          }

          // Completed tab
          const completedSteps = getCompletedStepIds(mentorship.id);
          return (
            <BNMPressable
              style={[styles.completedCompactCard, { backgroundColor: themeColors.card, borderColor: sem(SEMANTIC.greenBorder, isDark) }]}
              onPress={() => {
                if (Platform.OS === "web") {
                  setSelectedMenteeId(mentorship.mentee_id);
                } else {
                  router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } });
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={`Abgeschlossene Betreuung: ${mentorship.mentee?.name ?? ""}`}
            >
              <View style={styles.completedCardRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.completedCardName, { color: themeColors.text }]}>{mentorship.mentee?.name}</Text>
                  {mentorship.completed_at && (
                    <Text style={[styles.completedCardDate, { color: themeColors.textTertiary }]}>
                      {new Date(mentorship.completed_at).toLocaleDateString("de-DE")}
                    </Text>
                  )}
                </View>
                <View style={styles.completedCardRight}>
                  <View style={[styles.completedBadge, { backgroundColor: sem(SEMANTIC.greenBg, isDark) }]}>
                    <Text style={[styles.completedBadgeText, { color: sem(SEMANTIC.greenText, isDark) }]}>
                      {completedSteps.length}/{sessionTypes.length}
                    </Text>
                  </View>
                  <Text style={[styles.completedArrow, { color: themeColors.textTertiary }]}>›</Text>
                </View>
              </View>
            </BNMPressable>
          );
        }}
      />

      <SlideOverPanel
        visible={!!selectedMenteeId}
        onClose={() => setSelectedMenteeId(null)}
      >
        <MenteeDetailPanel id={selectedMenteeId} />
      </SlideOverPanel>
    </>
  );
}

function MentorMenteeCard({ mentorship }: { mentorship: Mentorship }) {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { getCompletedStepIds, getSessionsByMentorshipId, sessionTypes } = useData();

  const completedStepIds = getCompletedStepIds(mentorship.id);
  const sessions = getSessionsByMentorshipId(mentorship.id);
  const progress = Math.round((completedStepIds.length / sessionTypes.length) * 100);
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <BNMPressable
      style={[
        styles.menteeCard,
        { backgroundColor: themeColors.card },
        mentorship.status === "active" ? styles.menteeCardAssigned : [styles.menteeCardUnassigned, { borderColor: themeColors.border }],
      ]}
      onPress={() =>
        router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
      }
      accessibilityRole="link"
      accessibilityLabel={`Betreuung von ${mentorship.mentee?.name ?? "Mentee"} anzeigen`}
    >
      {/* Mentee-Header */}
      <View style={styles.menteeCardHeader}>
        <View>
          <Text style={[styles.meneeName, { color: themeColors.text }]}>{mentorship.mentee?.name}</Text>
          <Text style={[styles.menteeSubText, { color: themeColors.textTertiary }]}>
            {mentorship.mentee?.city} · {mentorship.mentee?.age} J. ·{" "}
            {mentorship.mentee?.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
          </Text>
        </View>
        <StatusBadge
          status={mentorship.status === "active" ? "active" : mentorship.status === "completed" ? "completed" : mentorship.status === "pending_approval" ? "pending" : "cancelled"}
          label={mentorship.status === "active" ? t("mentees.active") : mentorship.status === "completed" ? t("mentees.completedStatus") : mentorship.status === "pending_approval" ? t("mentees.pendingApproval") : t("mentees.cancelled")}
          compact
        />
      </View>

      {/* Fortschrittsbalken */}
      <View style={styles.progressRow}>
        <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>
        <Text style={[styles.progressText, { color: themeColors.textSecondary }]}>
          {completedStepIds.length}/{sessionTypes.length} {t("mentees.steps")}
        </Text>
      </View>

      {/* Step-Liste */}
      <Text style={[styles.stepSectionLabel, { color: themeColors.textTertiary }]}>{t("mentees.progress")}</Text>
      <View style={styles.stepChipRow}>
        {sortedTypes.map((step, idx) => {
          const isDone = completedStepIds.includes(step.id);
          const isCurrent = !isDone && idx === completedStepIds.length;
          const chipBg = isDone ? (sem(SEMANTIC.greenBg, isDark)) : isCurrent ? (sem(SEMANTIC.amberBg, isDark)) : themeColors.background;
          const chipColor = isDone ? (sem(SEMANTIC.greenText, isDark)) : isCurrent ? (sem(SEMANTIC.amberText, isDark)) : themeColors.textTertiary;
          const chipWeight: "normal" | "500" = isDone || isCurrent ? "500" : "normal";
          return (
            <View key={step.id} style={[styles.stepChip, { backgroundColor: chipBg }]}>
              <Text style={[styles.stepChipText, { color: chipColor, fontWeight: chipWeight }]}>
                {idx + 1}. {step.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Session-Anzahl + Aktionen */}
      <View style={[styles.cardFooter, { borderTopColor: themeColors.border }]}>
        <Text style={[styles.sessionCount, { color: themeColors.textTertiary }]}>
          {sessions.length !== 1
            ? t("mentees.sessionCountMany").replace("{0}", String(sessions.length))
            : t("mentees.sessionCountOne").replace("{0}", String(sessions.length))}
        </Text>
        {mentorship.status === "active" && (
          <BNMPressable
            style={styles.docChipButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/document-session",
                params: { mentorshipId: mentorship.id },
              });
            }}
          >
            <Text style={styles.docChipText}>{t("sessions.document")}</Text>
          </BNMPressable>
        )}
      </View>
    </BNMPressable>
  );
}

function MenteeProgressView() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const {
    getMentorshipByMenteeId,
    getCompletedStepIds,
    getSessionsByMentorshipId,
    sessionTypes,
    refreshData,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  // useFocusEffect refreshData entfernt — Realtime reicht, Pull-to-Refresh als Fallback

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sessions = mentorship ? getSessionsByMentorshipId(mentorship.id) : [];
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  if (!mentorship) {
    return (
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.myProgress")}</Text>
          <EmptyState
            icon="leaf-outline"
            title={t("mentees.noAssignmentYet")}
            description={t("mentees.noAssignmentText")}
          />
        </View>
      </ScrollView>
    );
  }

  const totalProgress = Math.round((completedStepIds.length / sessionTypes.length) * 100);

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.myProgress")}</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{t("mentees.mentor")}: {mentorship.mentor?.name}</Text>

        {/* Gesamtfortschritt – dunkle Hero-Card */}
        <View style={styles.progressHeaderCard}>
          <Text style={styles.progressHeaderLabel}>{t("mentees.totalProgress")}</Text>
          <Text style={styles.progressHeaderValue}>{totalProgress}%</Text>
          <View style={styles.progressTrackWhite}>
            <View
              style={[styles.progressFillGold, { width: `${totalProgress}%` as any }]}
            />
          </View>
          <Text style={styles.progressHeaderSub}>
            {completedStepIds.length} {t("mentees.stepsCompleted").replace("{0}", String(sessionTypes.length))}
          </Text>
        </View>

        {/* Betreuungsdetails */}
        <BNMPressable
          style={styles.detailsButton}
          onPress={() =>
            router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
          }
        >
          <Text style={styles.detailsButtonText}>{t("mentees.viewDetails")}</Text>
          <Text style={styles.detailsArrow}>›</Text>
        </BNMPressable>

        {/* Detaillierte Schritt-Liste */}
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t("mentees.your10StepsDetail")}</Text>
        <View style={[styles.emptyCard, { backgroundColor: themeColors.card, padding: 0, overflow: "hidden", marginBottom: 24 }]}>
          {sortedTypes.map((step, idx) => {
            const isDone = completedStepIds.includes(step.id);
            const isCurrent = !isDone && idx === completedStepIds.length;
            const isLocked = !isDone && idx > completedStepIds.length;
            const session = sessions.find((s) => s.session_type_id === step.id);

            return (
              <View
                key={step.id}
                style={[
                  styles.stepDetailRow,
                  idx < sessionTypes.length - 1 ? [styles.stepDetailBorder, { borderBottomColor: themeColors.border }] : {},
                  isCurrent ? { backgroundColor: isDark ? "#2a2218" : "#fffbeb" } : {},
                ]}
              >
                <View
                  style={[
                    styles.stepIndicator,
                    isDone
                      ? { backgroundColor: COLORS.cta }
                      : isCurrent
                      ? { backgroundColor: COLORS.gold }
                      : { backgroundColor: themeColors.background, borderWidth: 1, borderColor: themeColors.border },
                  ]}
                >
                  {isDone ? (
                    <Text style={styles.stepIndicatorTextWhite}>✓</Text>
                  ) : (
                    <Text
                      style={
                        isCurrent ? styles.stepIndicatorTextWhite : styles.stepIndicatorTextTertiary
                      }
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <Text
                      style={[
                        styles.stepDetailName,
                        isDone
                          ? { color: COLORS.cta }
                          : isCurrent
                          ? { color: themeColors.text }
                          : { color: themeColors.textTertiary },
                      ]}
                    >
                      {step.name}
                    </Text>
                    {isLocked && (
                      <Text style={{ color: themeColors.textTertiary, fontSize: 12 }}>{t("mentees.locked")}</Text>
                    )}
                    {isCurrent && (
                      <View style={{ backgroundColor: sem(SEMANTIC.amberBg, isDark), paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: sem(SEMANTIC.amberText, isDark), fontSize: 12, fontWeight: "500" }}>{t("mentees.current")}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stepDetailDesc, { color: themeColors.textTertiary }]}>{step.description}</Text>
                  {isDone && session && (
                    <Text style={{ color: sem(SEMANTIC.greenTextAlt, isDark), fontSize: 12, marginTop: 4 }}>
                      {t("mentees.completedOn")}{" "}
                      {new Date(session.date).toLocaleDateString("de-DE")}
                      {session.is_online ? ` (${t("mentees.online")})` : ` (${t("mentees.offline")})`}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },

  // Kompakte Mentor-Karten für linke Spalte (Web)
  mentorSplitName: { fontSize: 14, fontWeight: "600", flex: 1, marginRight: 8 },
  mentorSplitCity: { fontSize: 12, marginBottom: 8 },
  mentorSplitStatus: { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  mentorSplitStatusText: { fontSize: 11, fontWeight: "600" },
  mentorSplitProgressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  mentorSplitTrack: { flex: 1, height: 4, borderRadius: 2, overflow: "hidden" },
  mentorSplitFill: { height: 4, backgroundColor: COLORS.gold, borderRadius: 2 },
  mentorSplitProgressText: { fontSize: 11 },

  // Multi-Select & Modal Styles
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 12,
  },
  selectBarBtn: { fontSize: 13, fontWeight: "600" },
  selectBarSep: { fontSize: 16 },
  menteeCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.cta,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: COLORS.grayLight,
    marginRight: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxSelected: {
    backgroundColor: COLORS.cta,
    borderColor: COLORS.cta,
  },
  checkmark: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  footerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  footerBarText: { fontSize: 14, fontWeight: "500" },
  footerDeleteBtn: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  footerDeleteBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalBox: {
    borderRadius: RADIUS.lg,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    ...SHADOWS.lg,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 10 },
  modalMsg: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 14, fontWeight: "600" },
  modalBtnDanger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  modalBtnDisabled: { backgroundColor: COLORS.gray, borderColor: COLORS.gray, opacity: 0.5 },
  deleteInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 2,
  },
  pageTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4, textAlign: "center" as const, letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, textAlign: "center" as const },
  csvButton: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  csvButtonText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  searchInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    fontSize: 14,
  },
  filterBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  filterChipsGroup: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  filterIconBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    minHeight: 44,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    flexShrink: 0,
  },
  filterIconBtnText: { fontSize: 11, fontWeight: "500" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: "center", borderRadius: RADIUS.sm, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: { borderWidth: 1 },
  filterChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  filterChipTextInactive: { fontSize: 12, fontWeight: "500" },
  emptyCard: {
    borderRadius: RADIUS.lg,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    ...SHADOWS.md,
  },
  emptyText: { textAlign: "center", fontSize: 14, marginTop: 8 },
  menteeCard: {
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 12,
    ...SHADOWS.md,
  },
  menteeCardAssigned: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  menteeCardUnassigned: {
    borderWidth: 1,
  },
  menteeCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  meneeName: { fontWeight: "700", fontSize: 15, letterSpacing: -0.2 },
  menteeSubText: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.sm },
  statusText: { fontSize: 12, fontWeight: "500" },
  mentorLabel: { fontSize: 12, marginBottom: 8 },
  durationChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.xs, marginBottom: 6 },
  durationChipText: { fontSize: 11, fontWeight: "600" },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 3 },
  progressText: { fontSize: 12 },
  assignButton: {
    marginTop: 10,
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  assignButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  reactivateButton: {
    marginTop: 10,
    backgroundColor: COLORS.cta,
    borderRadius: RADIUS.md,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: "flex-start",
  },
  reactivateButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  stepSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 1,
  },
  stepChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  stepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  stepChipText: { fontSize: 12 },
  cardFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionCount: { fontSize: 12 },
  docChipButton: {
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
  },
  docChipText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  blockedBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  blockedBadgeText: { fontSize: 11, fontWeight: "600" },
  selfAssignButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  selfAssignText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  progressHeaderCard: {
    backgroundColor: COLORS.gradientStart,  // intentional accent color
    borderRadius: RADIUS.md,
    padding: 16,
    marginBottom: 16,
    ...SHADOWS.md,
  },
  progressHeaderLabel: { color: COLORS.white, opacity: 0.75, fontSize: 13, marginBottom: 2 },
  progressHeaderValue: { color: COLORS.white, fontSize: 30, fontWeight: "700", marginBottom: 10 },
  progressTrackWhite: { height: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, overflow: "hidden" },
  progressFillGold: { height: "100%", backgroundColor: COLORS.gold, borderRadius: 6 },
  progressHeaderSub: { color: COLORS.white, opacity: 0.65, fontSize: 12, marginTop: 8 },
  detailsButton: {
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: RADIUS.sm,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsButtonText: { color: COLORS.cta, fontWeight: "600" },
  detailsArrow: { color: COLORS.cta },
  stepDetailRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  stepDetailBorder: { borderBottomWidth: 1 },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  stepIndicatorTextWhite: { color: COLORS.white, fontWeight: "700" },
  stepIndicatorTextTertiary: { fontSize: 14, fontWeight: "700" },
  stepDetailName: { fontWeight: "600", fontSize: 15 },
  stepDetailDesc: { fontSize: 12 },

  // Tab-Switcher (Mentor Mentees Aktiv/Abgeschlossen)
  tabSwitcher: {
    flexDirection: "row",
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 16,
    marginTop: 8,
  },
  tabSwitcherBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  tabSwitcherBtnActive: {
    backgroundColor: COLORS.gradientStart,
  },
  tabSwitcherText: {
    fontSize: 14,
    fontWeight: "600",
  },
  tabSwitcherTextActive: {
    color: COLORS.white,
  },
  tabSwitcherCount: {
    fontSize: 13,
    fontWeight: "700",
  },

  // Kompakte Karte für abgeschlossene Mentees
  completedCompactCard: {
    borderRadius: RADIUS.sm,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  completedCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  completedCardName: {
    fontWeight: "600",
    fontSize: 15,
    marginBottom: 2,
  },
  completedCardDate: {
    fontSize: 12,
  },
  completedCardRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  completedBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  completedBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  completedArrow: {
    fontSize: 18,
  },
});
