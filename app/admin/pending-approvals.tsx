import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function PendingApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { mentorships, approveMentorship, rejectMentorship, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const isAdmin = user?.role === "admin" || user?.role === "office";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!isAdmin) {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessText, { color: themeColors.text }]}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  const pendingList = mentorships.filter((m) => m.status === "pending_approval");

  async function handleApprove(mentorshipId: string) {
    const m = pendingList.find((ms) => ms.id === mentorshipId);
    if (!m) return;

    const confirmed = await showConfirm(
      t("pendingApprovals.approveTitle"),
      t("pendingApprovals.approveText")
        .replace("{0}", m.mentor?.name ?? "?")
        .replace("{1}", m.mentee?.name ?? "?")
    );
    if (!confirmed) return;

    try {
      await approveMentorship(mentorshipId);
      showSuccess(t("pendingApprovals.approveSuccess"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(t("common.errorPrefix").replace("{0}", msg));
    }
  }

  function handleReject(mentorshipId: string) {
    setRejectTargetId(mentorshipId);
    setRejectReason("");
    setRejectModalVisible(true);
  }

  async function confirmReject() {
    if (!rejectTargetId) return;
    if (!rejectReason.trim()) {
      showError(t("pendingApprovals.rejectReasonRequired"));
      return;
    }
    setRejectModalVisible(false);
    try {
      await rejectMentorship(rejectTargetId, rejectReason.trim());
      showSuccess(t("pendingApprovals.rejectSuccess"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(t("common.errorPrefix").replace("{0}", msg));
    } finally {
      setRejectTargetId(null);
      setRejectReason("");
    }
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.gold}
          />
        }
      >
        <View style={styles.page}>
          <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
            <Text style={[styles.backLinkText, { color: themeColors.link }]}>‹ {t("common.back")}</Text>
          </TouchableOpacity>

          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("pendingApprovals.title")}</Text>

          {pendingList.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>{t("pendingApprovals.empty")}</Text>
            </View>
          ) : (
            pendingList.map((m) => (
              <View key={m.id} style={[styles.card, { backgroundColor: themeColors.card }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: themeColors.text }]}>
                      {m.mentor?.name ?? "?"} → {m.mentee?.name ?? "?"}
                    </Text>
                    <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
                      {t("chats.mentor")}: {m.mentor?.city ?? "?"} ·{" "}
                      {t("chats.mentee")}: {m.mentee?.city ?? "?"}
                    </Text>
                    {m.assigned_at && (
                      <Text style={[styles.cardDate, { color: themeColors.textTertiary }]}>
                        {new Date(m.assigned_at).toLocaleDateString("de-DE")}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.approveButton}
                    onPress={() => handleApprove(m.id)}
                  >
                    <Text style={styles.approveButtonText}>
                      ✓ {t("pendingApprovals.approve")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.rejectButton, { borderColor: COLORS.error }]}
                    onPress={() => handleReject(m.id)}
                  >
                    <Text style={styles.rejectButtonText}>
                      ✕ {t("pendingApprovals.reject")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Modal: Ablehnungsgrund */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRejectModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={[styles.modalBox, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {t("pendingApprovals.rejectReasonTitle")}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text },
              ]}
              placeholder={t("pendingApprovals.rejectReasonPlaceholder")}
              placeholderTextColor={themeColors.textTertiary}
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              autoFocus
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectTargetId(null);
                  setRejectReason("");
                }}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>
                  {t("pendingApprovals.rejectCancel")}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmBtn, { backgroundColor: COLORS.error }]}
                onPress={confirmReject}
              >
                <Text style={styles.modalConfirmText}>
                  {t("pendingApprovals.rejectConfirm")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  accessText: { fontWeight: "600" },
  page: { padding: 20 },
  backLink: { marginBottom: 12 },
  backLinkText: { fontSize: 14 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 20,
  },
  emptyCard: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fde68a",
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    padding: 14,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  cardHeader: { marginBottom: 12 },
  cardInfo: {},
  cardTitle: { fontWeight: "700", fontSize: 15 },
  cardSub: { fontSize: 12, marginTop: 3 },
  cardDate: { fontSize: 11, marginTop: 3 },
  actionRow: { flexDirection: "row", gap: 10 },
  approveButton: {
    flex: 1,
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 14 },

  // Modal: Ablehnungsgrund
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalBox: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 20,
    width: "100%",
    maxWidth: 440,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    minHeight: 90,
    marginBottom: 14,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalConfirmText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
