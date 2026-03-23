import React, { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Mentorship } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { showError, showSuccess } from "../../lib/errorHandler";
import { SkeletonList } from "../../components/Skeleton";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";

export default function MenteesScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "admin" || user.role === "office") return <Container><AdminMenteesView /></Container>;
  if (user.role === "mentor") return <Container><MentorMenteesView /></Container>;
  return <Container><MenteeProgressView /></Container>;
}

type AssignmentFilter = "all" | "assigned" | "unassigned";
type StatusFilter = "all" | "active" | "completed" | "cancelled";
type GenderFilter = "all" | "male" | "female";
type SortKey = "name" | "city" | "progress";

function AdminMenteesView() {
  const router = useRouter();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [search, setSearch] = useState("");
  const [assignFilter, setAssignFilter] = useState<AssignmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [refreshing, setRefreshing] = useState(false);

  // Multi-Select State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Erstes Confirm-Modal (Ja/Nein)
  const [confirmModal1, setConfirmModal1] = useState(false);
  // Zweites Confirm-Modal (Tippe LÖSCHEN)
  const [confirmModal2, setConfirmModal2] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const { users, mentorships, sessionTypes, getCompletedStepIds, refreshData, isLoading, bulkDeleteUsers } = useData();
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

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
      const rows = allMentees.map((mentee) => {
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

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BNM-Mentees-${new Date().toISOString().split("T")[0]}.csv`;
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

  const filteredMentees = allMentees
    .filter((mentee) => {
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
      if (sortKey === "progress") {
        const mA = mentorships.find((m) => m.mentee_id === a.id);
        const mB = mentorships.find((m) => m.mentee_id === b.id);
        const progA = mA ? getCompletedStepIds(mA.id).length : 0;
        const progB = mB ? getCompletedStepIds(mB.id).length : 0;
        return progB - progA;
      }
      return 0;
    });

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
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => setConfirmModal1(false)}
            >
              <Text style={[styles.modalBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalBtnDanger]}
              onPress={() => { setConfirmModal1(false); setConfirmModal2(true); setDeleteInput(""); }}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>{t("common.confirm")}</Text>
            </TouchableOpacity>
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
            style={[styles.deleteInput, { backgroundColor: themeColors.background, borderColor: deleteInput === confirmWord ? COLORS.error : themeColors.border, color: themeColors.text }]}
            placeholder={t("admin.deleteConfirmPlaceholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={deleteInput}
            onChangeText={setDeleteInput}
            autoCapitalize="characters"
            autoCorrect={false}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => { setConfirmModal2(false); setDeleteInput(""); }}
            >
              <Text style={[styles.modalBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, deleteInput === confirmWord ? styles.modalBtnDanger : styles.modalBtnDisabled]}
              onPress={deleteInput === confirmWord ? handleBulkDelete : undefined}
              disabled={deleteInput !== confirmWord || isDeleting}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                {isDeleting ? t("admin.deleting") : t("admin.deleteConfirmInput")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <View style={styles.titleRow}>
          <View>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.allMentees")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>{allMentees.length} {t("mentees.registered")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            {!selectMode && (
              <>
                <TouchableOpacity
                  style={[styles.csvButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}
                  onPress={() => router.push("/admin/csv-import")}
                >
                  <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csvImport.title")}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.csvButton, { backgroundColor: themeColors.card, borderColor: themeColors.border }]} onPress={handleExportCsv}>
                  <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csv.export")}</Text>
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity
              style={[styles.csvButton, selectMode
                ? { backgroundColor: themeColors.background, borderColor: themeColors.border }
                : { backgroundColor: themeColors.card, borderColor: themeColors.border }
              ]}
              onPress={toggleSelectMode}
            >
              <Text style={[styles.csvButtonText, { color: selectMode ? themeColors.textSecondary : themeColors.text }]}>
                {selectMode ? t("admin.selectModeExit") : t("admin.selectMode")}
              </Text>
            </TouchableOpacity>
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
            <TouchableOpacity onPress={() => selectAll(filteredMentees.map((m) => m.id))}>
              <Text style={[styles.selectBarBtn, { color: COLORS.gradientStart }]}>{t("admin.selectAll")}</Text>
            </TouchableOpacity>
            <Text style={[styles.selectBarSep, { color: themeColors.border }]}>|</Text>
            <TouchableOpacity onPress={selectNone}>
              <Text style={[styles.selectBarBtn, { color: themeColors.textSecondary }]}>{t("admin.selectNone")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Filter: Zuweisung */}
        <Text style={[styles.filterGroupLabel, { color: themeColors.textTertiary }]}>{t("mentees.filterAssignment")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "assigned", label: t("mentees.assigned") },
              { key: "unassigned", label: t("mentees.unassigned") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                assignFilter === tab.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
              ]}
              onPress={() => setAssignFilter(tab.key)}
            >
              <Text
                style={
                  assignFilter === tab.key ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter: Status */}
        <Text style={[styles.filterGroupLabel, { color: themeColors.textTertiary }]}>{t("mentees.filterStatus")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "active", label: t("mentees.active") },
              { key: "completed", label: t("mentees.completedStatus") },
              { key: "cancelled", label: t("mentees.cancelled") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                statusFilter === tab.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={
                  statusFilter === tab.key ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter: Geschlecht */}
        <Text style={[styles.filterGroupLabel, { color: themeColors.textTertiary }]}>{t("mentees.filterGender")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "male", label: t("mentees.brothers") },
              { key: "female", label: t("mentees.sisters") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                genderFilter === tab.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
              ]}
              onPress={() => setGenderFilter(tab.key)}
            >
              <Text
                style={
                  genderFilter === tab.key ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sortierung */}
        <Text style={[styles.filterGroupLabel, { color: themeColors.textTertiary }]}>{t("mentees.filterSort")}</Text>
        <View style={[styles.filterRow, { marginBottom: 24 }]}>
          {(
            [
              { key: "name", label: t("mentees.sortName") },
              { key: "city", label: t("mentees.sortCity") },
              { key: "progress", label: t("mentees.sortProgress") },
            ] as const
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterChip,
                sortKey === opt.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
              ]}
              onPress={() => setSortKey(opt.key)}
            >
              <Text
                style={
                  sortKey === opt.key ? styles.filterChipTextActive : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                }
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mentee-Liste */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredMentees.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("mentees.noResults")}</Text>
          </View>
        ) : (
          filteredMentees.map((mentee) => {
            const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
            const completedSteps = mentorship ? getCompletedStepIds(mentorship.id) : [];
            const progress = mentorship
              ? Math.round((completedSteps.length / sessionTypes.length) * 100)
              : 0;

            const statusBg =
              mentorship
                ? mentorship.status === "active"
                  ? (isDark ? "#2A2D3A" : "#F5F5F7")
                  : mentorship.status === "completed"
                  ? (isDark ? "#1a3a2a" : "#dcfce7")
                  : mentorship.status === "pending_approval"
                  ? (isDark ? "#3a2e1a" : "#fef3c7")
                  : (isDark ? "#3a1a1a" : "#fee2e2")
                : (isDark ? "#3a2e1a" : "#fef3c7");
            const statusColor =
              mentorship
                ? mentorship.status === "active"
                  ? (isDark ? "#A0A0B0" : "#475467")
                  : mentorship.status === "completed"
                  ? (isDark ? "#4ade80" : "#15803d")
                  : mentorship.status === "pending_approval"
                  ? (isDark ? "#fbbf24" : "#b45309")
                  : (isDark ? "#f87171" : "#b91c1c")
                : (isDark ? "#fbbf24" : "#b45309");
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
              <TouchableOpacity
                key={mentee.id}
                style={[
                  styles.menteeCard,
                  { backgroundColor: isSelected ? (isDark ? "#1a2a1a" : "#dcfce7") : themeColors.card },
                  mentorship ? styles.menteeCardAssigned : [styles.menteeCardUnassigned, { borderColor: themeColors.border }],
                  isSelected && styles.menteeCardSelected,
                ]}
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(mentee.id);
                  } else {
                    router.push({ pathname: "/mentee/[id]", params: { id: mentee.id } });
                  }
                }}
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
                        <View style={[styles.blockedBadge, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                          <Text style={[styles.blockedBadgeText, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("editUser.blocked")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.menteeSubText, { color: themeColors.textTertiary }]}>
                      {mentee.city} · {mentee.age} J. ·{" "}
                      {mentee.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {!selectMode && mentorship ? (
                  <>
                    <Text style={[styles.mentorLabel, { color: themeColors.textTertiary }]}>{t("mentees.mentor")}: {mentorship.mentor?.name}</Text>
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
                    <TouchableOpacity
                      style={[styles.viewChatButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } });
                      }}
                    >
                      <Text style={[styles.viewChatButtonText, { color: themeColors.textSecondary }]}>{t("admin.viewChat")}</Text>
                    </TouchableOpacity>
                  </>
                ) : !selectMode ? (
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: "/assign", params: { menteeId: mentee.id } });
                    }}
                  >
                    <Text style={styles.assignButtonText}>{t("mentees.assignMentor")}</Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>

    {/* Footer-Bar im Select-Modus */}
    {selectMode && selectedCount > 0 && (
      <View style={[styles.footerBar, { backgroundColor: themeColors.card, borderTopColor: themeColors.border }]}>
        <Text style={[styles.footerBarText, { color: themeColors.text }]}>
          {t("admin.xSelected").replace("{0}", String(selectedCount))}
        </Text>
        <TouchableOpacity
          style={styles.footerDeleteBtn}
          onPress={() => setConfirmModal1(true)}
        >
          <Text style={styles.footerDeleteBtnText}>
            {t("admin.deleteSelected").replace("{0}", String(selectedCount))}
          </Text>
        </TouchableOpacity>
      </View>
    )}
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
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

  if (!user) return null;

  const myMentorships = getMentorshipsByMentorId(user.id);
  const activeMentorships = myMentorships.filter((m) => m.status === "active");
  const completedMentorships = myMentorships.filter((m) => m.status === "completed");

  return (
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("mentees.myMentees")}</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
          {activeMentorships.length} {t("mentees.activeMentorships")}
        </Text>

        {/* Tab-Switcher: Aktiv | Abgeschlossen */}
        <View style={[styles.tabSwitcher, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <TouchableOpacity
            style={[styles.tabSwitcherBtn, activeTab === "active" && styles.tabSwitcherBtnActive]}
            onPress={() => setActiveTab("active")}
          >
            <Text style={[styles.tabSwitcherText, activeTab === "active" ? styles.tabSwitcherTextActive : { color: themeColors.textSecondary }]}>
              {t("mentees.active")}
              {activeMentorships.length > 0 && (
                <Text style={[styles.tabSwitcherCount, activeTab === "active" ? { color: COLORS.white } : { color: themeColors.textTertiary }]}>
                  {" "}{activeMentorships.length}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabSwitcherBtn, activeTab === "completed" && styles.tabSwitcherBtnActive]}
            onPress={() => setActiveTab("completed")}
          >
            <Text style={[styles.tabSwitcherText, activeTab === "completed" ? styles.tabSwitcherTextActive : { color: themeColors.textSecondary }]}>
              {t("mentees.completedStatus")}
              {completedMentorships.length > 0 && (
                <Text style={[styles.tabSwitcherCount, activeTab === "completed" ? { color: COLORS.white } : { color: themeColors.textTertiary }]}>
                  {" "}{completedMentorships.length}
                </Text>
              )}
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "active" ? (
          <>
            {/* Mentor kann selbst Mentee übernehmen */}
            <TouchableOpacity
              style={styles.selfAssignButton}
              onPress={() => router.push("/assign")}
            >
              <Text style={styles.selfAssignText}>{t("mentees.takeMentee")}</Text>
            </TouchableOpacity>

            {activeMentorships.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
                <Ionicons name="people-outline" size={36} color={themeColors.textTertiary} style={{ marginBottom: 12 }} />
                <Text style={[styles.meneeName, { textAlign: "center", marginBottom: 8, color: themeColors.text }]}>
                  {t("mentees.noMenteesYet")}
                </Text>
                <Text style={[styles.emptyText, { marginTop: 0, marginBottom: 12, color: themeColors.textTertiary }]}>
                  {t("mentees.noMenteesText")}
                </Text>
                <TouchableOpacity
                  style={{ backgroundColor: COLORS.gradientStart, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 20 }}
                  onPress={() => router.push("/assign")}
                >
                  <Text style={{ color: COLORS.white, fontWeight: "600", fontSize: 14 }}>
                    {t("mentees.takeMenteeButton")}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              activeMentorships.map((mentorship) => (
                <MentorMenteeCard key={mentorship.id} mentorship={mentorship} />
              ))
            )}
          </>
        ) : (
          <>
            {completedMentorships.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
                <Ionicons name="checkmark-circle-outline" size={36} color={themeColors.textTertiary} style={{ marginBottom: 12 }} />
                <Text style={[styles.emptyText, { marginTop: 0, color: themeColors.textTertiary }]}>
                  {t("mentees.noCompletedYet")}
                </Text>
              </View>
            ) : (
              completedMentorships.map((mentorship) => {
                const completedSteps = getCompletedStepIds(mentorship.id);
                return (
                  <TouchableOpacity
                    key={mentorship.id}
                    style={[styles.completedCompactCard, { backgroundColor: themeColors.card, borderColor: isDark ? "#2d6a4a" : "#bbf7d0" }]}
                    onPress={() => router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })}
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
                        <View style={[styles.completedBadge, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
                          <Text style={[styles.completedBadgeText, { color: isDark ? "#4ade80" : "#15803d" }]}>
                            {completedSteps.length}/{sessionTypes.length}
                          </Text>
                        </View>
                        <Text style={[styles.completedArrow, { color: themeColors.textTertiary }]}>›</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </>
        )}
      </View>
    </ScrollView>
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
    <TouchableOpacity
      style={[
        styles.menteeCard,
        { backgroundColor: themeColors.card },
        mentorship.status === "active" ? styles.menteeCardAssigned : [styles.menteeCardUnassigned, { borderColor: themeColors.border }],
      ]}
      onPress={() =>
        router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
      }
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
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor:
                mentorship.status === "active"
                  ? (isDark ? "#2A2D3A" : "#F5F5F7")
                  : mentorship.status === "completed"
                  ? (isDark ? "#1a3a2a" : "#dcfce7")
                  : mentorship.status === "pending_approval"
                  ? (isDark ? "#3a2e1a" : "#fef3c7")
                  : (isDark ? "#3a1a1a" : "#fee2e2"),
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color:
                  mentorship.status === "active"
                    ? (isDark ? "#A0A0B0" : "#475467")
                    : mentorship.status === "completed"
                    ? (isDark ? "#4ade80" : "#15803d")
                    : mentorship.status === "pending_approval"
                    ? (isDark ? "#fbbf24" : "#b45309")
                    : (isDark ? "#f87171" : "#b91c1c"),
              },
            ]}
          >
            {mentorship.status === "active"
              ? t("mentees.active")
              : mentorship.status === "completed"
              ? t("mentees.completedStatus")
              : mentorship.status === "pending_approval"
              ? t("mentees.pendingApproval")
              : t("mentees.cancelled")}
          </Text>
        </View>
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
          const chipBg = isDone ? (isDark ? "#1a3a2a" : "#dcfce7") : isCurrent ? (isDark ? "#3a2e1a" : "#fef3c7") : themeColors.background;
          const chipColor = isDone ? (isDark ? "#4ade80" : "#15803d") : isCurrent ? (isDark ? "#fbbf24" : "#b45309") : themeColors.textTertiary;
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
          <TouchableOpacity
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
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
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

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData])
  );

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
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
            <Ionicons name="leaf-outline" size={36} color={themeColors.textTertiary} style={{ marginBottom: 12 }} />
            <Text style={[styles.meneeName, { textAlign: "center", marginBottom: 8, color: themeColors.text }]}>
              {t("mentees.noAssignmentYet")}
            </Text>
            <Text style={[styles.emptyText, { marginTop: 0, color: themeColors.textTertiary }]}>
              {t("mentees.noAssignmentText")}
            </Text>
          </View>
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
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() =>
            router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
          }
        >
          <Text style={styles.detailsButtonText}>{t("mentees.viewDetails")}</Text>
          <Text style={styles.detailsArrow}>›</Text>
        </TouchableOpacity>

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
                      <View style={{ backgroundColor: isDark ? "#3a2e1a" : "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: isDark ? "#fbbf24" : "#b45309", fontSize: 12, fontWeight: "500" }}>{t("mentees.current")}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.stepDetailDesc, { color: themeColors.textTertiary }]}>{step.description}</Text>
                  {isDone && session && (
                    <Text style={{ color: isDark ? "#4ade80" : "#16a34a", fontSize: 12, marginTop: 4 }}>
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
  page: { padding: 20 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },

  // Multi-Select & Modal Styles
  selectBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
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
    borderColor: "#ccc",
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
    borderRadius: 6,
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
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", marginBottom: 10 },
  modalMsg: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalButtons: { flexDirection: "row", gap: 10 },
  modalBtn: {
    flex: 1,
    borderRadius: 6,
    borderWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalBtnText: { fontSize: 14, fontWeight: "600" },
  modalBtnDanger: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  modalBtnDisabled: { backgroundColor: "#666", borderColor: "#666", opacity: 0.5 },
  deleteInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    letterSpacing: 2,
  },
  pageTitle: { fontSize: 24, fontWeight: "700", marginBottom: 2 },
  pageSubtitle: { fontSize: 13 },
  csvButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  csvButtonText: { fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", marginBottom: 10 },
  searchInput: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: { borderWidth: 1 },
  filterChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  filterChipTextInactive: { fontSize: 12, fontWeight: "500" },
  emptyCard: {
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyText: { textAlign: "center", fontSize: 14, marginTop: 8 },
  menteeCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  menteeCardAssigned: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  menteeCardUnassigned: {
    borderWidth: 1,
  },
  menteeCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  meneeName: { fontWeight: "700", fontSize: 15 },
  menteeSubText: { fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "500" },
  mentorLabel: { fontSize: 12, marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 3 },
  progressText: { fontSize: 12 },
  assignButton: {
    marginTop: 8,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  assignButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  viewChatButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  viewChatButtonText: { fontSize: 13, fontWeight: "500" },
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
    borderRadius: 5,
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
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  selfAssignText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  progressHeaderCard: {
    backgroundColor: COLORS.gradientStart,  // intentional accent color
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
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
    borderRadius: 5,
    paddingVertical: 9,
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
    borderRadius: 18,
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
    borderRadius: 8,
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
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 3,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
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
