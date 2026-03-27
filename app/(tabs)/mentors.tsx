import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  RefreshControl,
  Platform,
  Modal,
  KeyboardAvoidingView,
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { showError, showSuccess } from "../../lib/errorHandler";
import { SkeletonList } from "../../components/Skeleton";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { Container } from "../../components/Container";
import { SlideOverPanel } from "../../components/SlideOverPanel";
import { MentorDetailPanel } from "../../components/MentorDetailPanel";

export default function MentorsTabScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { users, mentorships, sessions, feedback, sendAdminDirectMessage, refreshData, isLoading, bulkDeleteUsers } = useData();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [selectedMentorId, setSelectedMentorId] = useState<string | null>(null);

  // Multi-Select State
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmModal1, setConfirmModal1] = useState(false);
  const [confirmModal2, setConfirmModal2] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Admin-Direktnachricht State
  const [msgModalUserId, setMsgModalUserId] = useState<string | null>(null);
  const [msgModalName, setMsgModalName] = useState("");
  const [msgText, setMsgText] = useState("");
  const [isSendingMsg, setIsSendingMsg] = useState(false);

  async function handleSendAdminMessage() {
    if (!msgModalUserId || !msgText.trim()) return;
    setIsSendingMsg(true);
    try {
      await sendAdminDirectMessage(msgModalUserId, msgText.trim());
      showSuccess(t("adminMsg.sent"));
      setMsgModalUserId(null);
      setMsgText("");
    } catch {
      showError(t("adminMsg.error"));
    } finally {
      setIsSendingMsg(false);
    }
  }

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

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

  const selectedCount = selectedIds.size;
  const confirmWord = t("admin.deleteConfirmInput");

  // Nur Admin/Office
  if (!user || (user.role !== "admin" && user.role !== "office")) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessDenied, { color: themeColors.error }]}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  const allMentors = users.filter((u) => u.role === "mentor");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allMentors;
    return allMentors.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q)
    );
  }, [allMentors, search]);

  function handleExportCsv() {
    try {
      const header = t("adminMentors.csvHeaderRow");
      const rows = filtered.map((mentor) => {
        const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
        const active = myMentorships.filter((m) => m.status === "active").length;
        const completed = myMentorships.filter((m) => m.status === "completed").length;
        const gender = mentor.gender === "male" ? t("adminMentors.csvGenderBrother") : t("adminMentors.csvGenderSister");
        return `"${mentor.name}","${mentor.email}","${mentor.city}",${mentor.age},"${gender}",${active},${completed}`;
      }).join("\n");
      const csvContent = `${header}\n${rows}`;

      // Dateiname: bei aktiver Suche wird der Suchbegriff angehängt
      const filenamePart = search.trim()
        ? `${t("adminMentors.csvFileAll")}_${search.trim().replace(/\s+/g, "_")}`
        : t("adminMentors.csvFileAll");

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

  return (
    <Container fullWidth={Platform.OS === "web"}>
    {/* Admin-Direktnachricht Modal */}
    <Modal visible={!!msgModalUserId} transparent animationType="fade" onRequestClose={() => { setMsgModalUserId(null); setMsgText(""); }}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.modalBox, { backgroundColor: themeColors.card }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>{t("adminMsg.title")}</Text>
          <Text style={[styles.modalMsg, { color: themeColors.textSecondary }]}>
            {t("adminMsg.recipient")}: {msgModalName}
          </Text>
          <TextInput
            style={[styles.deleteInput, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text, letterSpacing: 0, textAlign: "left", minHeight: 80 }]}
            placeholder={t("adminMsg.placeholder")}
            placeholderTextColor={themeColors.textTertiary}
            value={msgText}
            onChangeText={setMsgText}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
              onPress={() => { setMsgModalUserId(null); setMsgText(""); }}
            >
              <Text style={[styles.modalBtnText, { color: themeColors.text }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, msgText.trim() ? styles.modalBtnPrimary : styles.modalBtnDisabled]}
              onPress={handleSendAdminMessage}
              disabled={!msgText.trim() || isSendingMsg}
            >
              <Text style={[styles.modalBtnText, { color: COLORS.white }]}>
                {isSendingMsg ? "..." : t("adminMsg.send")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>

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
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("adminMentors.title")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              {filtered.length} {t("adminMentors.mentors")}
            </Text>
          </View>
          {!selectMode && Platform.OS === "web" && (
            <>
              <TouchableOpacity
                style={[styles.csvButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                onPress={() => router.push("/admin/csv-import")}
              >
                <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csvImport.tabMentors")}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.csvButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} onPress={handleExportCsv}>
                <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csv.export")}</Text>
              </TouchableOpacity>
            </>
          )}
          <TouchableOpacity
            style={[styles.csvButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
            onPress={toggleSelectMode}
          >
            <Text style={[styles.csvButtonText, { color: selectMode ? themeColors.textSecondary : themeColors.text }]}>
              {selectMode ? t("admin.selectModeExit") : t("admin.selectMode")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Suchfeld */}
        <TextInput
          style={[styles.searchInput, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
          placeholder={t("adminMentors.search")}
          placeholderTextColor={themeColors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />

        {/* Multi-Select: Alle / Keine */}
        {selectMode && (
          <View style={[styles.selectBar, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <TouchableOpacity onPress={() => setSelectedIds(new Set(filtered.map((m) => m.id)))}>
              <Text style={[styles.selectBarBtn, { color: COLORS.gradientStart }]}>{t("admin.selectAll")}</Text>
            </TouchableOpacity>
            <Text style={[styles.selectBarSep, { color: themeColors.border }]}>|</Text>
            <TouchableOpacity onPress={() => setSelectedIds(new Set())}>
              <Text style={[styles.selectBarBtn, { color: themeColors.textSecondary }]}>{t("admin.selectNone")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mentor-Liste */}
        {isLoading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>{t("adminMentors.noMentors")}</Text>
          </View>
        ) : (
          filtered.map((mentor) => {
            const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
            const active = myMentorships.filter((m) => m.status === "active").length;
            const completed = myMentorships.filter((m) => m.status === "completed").length;
            const totalSessions = sessions.filter((s) =>
              myMentorships.some((m) => m.id === s.mentorship_id)
            ).length;

            // Feedback-Durchschnitt berechnen (Mentee bewertet Mentor)
            const mentorFeedback = feedback.filter((f) =>
              myMentorships.some((m) => m.id === f.mentorship_id)
            );
            const avgRating = mentorFeedback.length > 0
              ? mentorFeedback.reduce((sum, f) => sum + f.rating, 0) / mentorFeedback.length
              : null;

            const initials = mentor.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            const isSelected = selectedIds.has(mentor.id);

            return (
              <TouchableOpacity
                key={mentor.id}
                style={[
                  styles.mentorCard,
                  { backgroundColor: isSelected ? (isDark ? "#1a2a1a" : "#dcfce7") : themeColors.card },
                  isSelected && styles.mentorCardSelected,
                ]}
                onPress={() => {
                  if (selectMode) {
                    toggleSelect(mentor.id);
                  } else if (Platform.OS === "web") {
                    setSelectedMentorId(mentor.id);
                  } else {
                    router.push({ pathname: "/mentor/[id]", params: { id: mentor.id } });
                  }
                }}
              >
                <View style={styles.cardRow}>
                  {selectMode && (
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Text style={styles.checkmark}>✓</Text>}
                    </View>
                  )}
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <Text style={[styles.mentorName, { color: themeColors.text }]}>{mentor.name}</Text>
                      {mentor.is_active === false && (
                        <View style={[styles.blockedBadge, { backgroundColor: isDark ? "#3a1a1a" : "#fee2e2" }]}>
                          <Text style={[styles.blockedBadgeText, { color: isDark ? "#f87171" : "#b91c1c" }]}>{t("editUser.blocked")}</Text>
                        </View>
                      )}
                      {/* Mentee-Bewertung: Sterne neben dem Namen */}
                      {avgRating !== null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 2 }}>
                          {[1,2,3,4,5].map((i) => (
                            <Text key={i} style={{ fontSize: 12, color: avgRating >= i ? COLORS.gold : (isDark ? "#3A3A3A" : "#D1D5DB") }}>★</Text>
                          ))}
                          <Text style={{ fontSize: 11, color: themeColors.textTertiary, marginLeft: 2 }}>
                            ({avgRating.toFixed(1)})
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.mentorMeta, { color: themeColors.textTertiary }]}>
                      {mentor.city} · {mentor.age} J. · {mentor.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
                    </Text>
                  </View>
                  {!selectMode && <Text style={[styles.arrow, { color: themeColors.textTertiary }]}>›</Text>}
                </View>

                {/* Stats-Zeile */}
                {!selectMode && (
                  <View style={styles.statsRow}>
                    <View style={[styles.statChip, { backgroundColor: themeColors.background }]}>
                      <Text style={[styles.statChipValue, { color: COLORS.gradientStart }]}>{active}</Text>
                      <Text style={[styles.statChipLabel, { color: themeColors.textTertiary }]}>{t("adminMentors.activeMentorships")}</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: themeColors.background }]}>
                      <Text style={[styles.statChipValue, { color: COLORS.cta }]}>{completed}</Text>
                      <Text style={[styles.statChipLabel, { color: themeColors.textTertiary }]}>{t("adminMentors.completedMentorships")}</Text>
                    </View>
                    <View style={[styles.statChip, { backgroundColor: themeColors.background }]}>
                      <Text style={[styles.statChipValue, { color: COLORS.gold }]}>{totalSessions}</Text>
                      <Text style={[styles.statChipLabel, { color: themeColors.textTertiary }]}>{t("common.sessions")}</Text>
                    </View>
                  </View>
                )}
                {/* Admin-Nachricht Button */}
                {!selectMode && (
                  <TouchableOpacity
                    style={[styles.msgButton, { borderColor: isDark ? "#3A3A50" : "#D1D5DB" }]}
                    onPress={(e) => {
                      e.stopPropagation && e.stopPropagation();
                      setMsgModalUserId(mentor.id);
                      setMsgModalName(mentor.name);
                      setMsgText("");
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.msgButtonText, { color: themeColors.textSecondary }]}>{t("adminMsg.sendButton")}</Text>
                  </TouchableOpacity>
                )}
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

    <SlideOverPanel
      visible={!!selectedMentorId}
      onClose={() => setSelectedMentorId(null)}
    >
      <MentorDetailPanel id={selectedMentorId} />
    </SlideOverPanel>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  pageTitle: { fontSize: 20, fontWeight: "700" },
  pageSubtitle: { fontSize: 13 },
  searchInput: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 16,
  },
  emptyCard: {
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  mentorCard: {
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 6,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gradientStart,
  },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: COLORS.white, fontWeight: "700", fontSize: 15 },
  mentorName: { fontWeight: "700", fontSize: 15 },
  mentorMeta: { fontSize: 12, marginTop: 2 },
  arrow: { fontSize: 20 },
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  statChipValue: { fontSize: 18, fontWeight: "700" },
  statChipLabel: { fontSize: 10, marginTop: 2, textAlign: "center" },
  csvButton: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  csvButtonText: { fontSize: 12, fontWeight: "600" },
  blockedBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  blockedBadgeText: { fontSize: 10, fontWeight: "600" },

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
  mentorCardSelected: {
    borderWidth: 2,
    borderColor: COLORS.cta,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#ccc",
    marginRight: 6,
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
  modalBtnPrimary: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  modalBtnDisabled: { backgroundColor: "#666", borderColor: "#666", opacity: 0.5 },
  msgButton: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 6,
    alignItems: "center",
  },
  msgButtonText: { fontSize: 12, fontWeight: "500" },
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
});
