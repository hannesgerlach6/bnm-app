import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { COLORS, SHADOWS, RADIUS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function PendingApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { mentorships, users, approveMentorship, rejectMentorship, refreshData } = useData();
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

    const mentorName = users.find((u) => u.id === m.mentor_id)?.name ?? "?";
    const menteeName = users.find((u) => u.id === m.mentee_id)?.name ?? "?";
    const confirmed = await showConfirm(
      t("pendingApprovals.approveTitle"),
      t("pendingApprovals.approveText")
        .replace("{0}", mentorName)
        .replace("{1}", menteeName)
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
        <View style={[styles.page, { paddingTop: insets.top + 12 }]}>
          <BNMPressable style={styles.backLink} onPress={() => router.back()} accessibilityRole="link" accessibilityLabel="Zurück">
            <Text style={[styles.backLinkText, { color: themeColors.link }]}>‹ {t("common.back")}</Text>
          </BNMPressable>

          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("pendingApprovals.title")}</Text>

          {pendingList.length === 0 ? (
            <EmptyState
              icon="checkmark-done-outline"
              title={t("pendingApprovals.empty")}
              description={t("pendingApprovals.allHandled")}
              compact
            />
          ) : (
            pendingList.map((m) => (
              <View key={m.id} style={[styles.card, { backgroundColor: themeColors.card }]}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={[styles.cardTitle, { color: themeColors.text }]}>
                      {users.find((u) => u.id === m.mentor_id)?.name ?? "?"} → {users.find((u) => u.id === m.mentee_id)?.name ?? "?"}
                    </Text>
                    <Text style={[styles.cardSub, { color: themeColors.textSecondary }]}>
                      {t("chats.mentor")}: {users.find((u) => u.id === m.mentor_id)?.city ?? "?"} ·{" "}
                      {t("chats.mentee")}: {users.find((u) => u.id === m.mentee_id)?.city ?? "?"}
                    </Text>
                    {m.assigned_at && (
                      <Text style={[styles.cardDate, { color: themeColors.textTertiary }]}>
                        {new Date(m.assigned_at).toLocaleDateString("de-DE")}
                      </Text>
                    )}
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <BNMPressable
                    style={styles.approveButton}
                    onPress={() => handleApprove(m.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Genehmigen"
                  >
                    <Text style={styles.approveButtonText}>
                      ✓ {t("pendingApprovals.approve")}
                    </Text>
                  </BNMPressable>
                  <BNMPressable
                    style={[styles.rejectButton, { borderColor: COLORS.error }]}
                    onPress={() => handleReject(m.id)}
                    accessibilityRole="button"
                    accessibilityLabel="Ablehnen"
                  >
                    <Text style={styles.rejectButtonText}>
                      ✕ {t("pendingApprovals.reject")}
                    </Text>
                  </BNMPressable>
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
          behavior="padding"
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
              <BNMPressable
                style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
                onPress={() => {
                  setRejectModalVisible(false);
                  setRejectTargetId(null);
                  setRejectReason("");
                }}
                accessibilityRole="button"
                accessibilityLabel="Abbrechen"
              >
                <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>
                  {t("pendingApprovals.rejectCancel")}
                </Text>
              </BNMPressable>
              <BNMPressable
                style={[styles.modalConfirmBtn, { backgroundColor: COLORS.error }]}
                onPress={confirmReject}
                accessibilityRole="button"
                accessibilityLabel="Ablehnung bestaetigen"
              >
                <Text style={styles.modalConfirmText}>
                  {t("pendingApprovals.rejectConfirm")}
                </Text>
              </BNMPressable>
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
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { fontSize: 14 },
  card: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.warningBorder,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    padding: 14,
    marginBottom: 12,
    ...SHADOWS.sm,
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
    borderRadius: RADIUS.sm,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveButtonText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.sm,
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
    borderRadius: RADIUS.xs,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: { fontWeight: "600", fontSize: 14 },
  modalConfirmBtn: {
    flex: 1,
    borderRadius: RADIUS.xs,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalConfirmText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
});
