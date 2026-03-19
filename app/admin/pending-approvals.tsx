import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useConfirm } from "../../contexts/ModalContext";
import { showError, showSuccess } from "../../lib/errorHandler";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useLanguage } from "../../contexts/LanguageContext";

export default function PendingApprovalsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { mentorships, approveMentorship, rejectMentorship, refreshData } = useData();
  const confirm = useConfirm();
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = user?.role === "admin" || user?.role === "office";

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.accessText}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  const pendingList = mentorships.filter((m) => m.status === "pending_approval");

  async function handleApprove(mentorshipId: string) {
    const m = pendingList.find((ms) => ms.id === mentorshipId);
    if (!m) return;

    const confirmed = await confirm(
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

  async function handleReject(mentorshipId: string) {
    const m = pendingList.find((ms) => ms.id === mentorshipId);
    if (!m) return;

    const confirmed = await confirm(
      t("pendingApprovals.rejectTitle"),
      t("pendingApprovals.rejectText")
        .replace("{0}", m.mentor?.name ?? "?")
        .replace("{1}", m.mentee?.name ?? "?")
    );
    if (!confirmed) return;

    try {
      await rejectMentorship(mentorshipId);
      showSuccess(t("pendingApprovals.rejectSuccess"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("assign.errorUnknown");
      showError(t("common.errorPrefix").replace("{0}", msg));
    }
  }

  return (
    <Container>
      <ScrollView
        style={styles.scrollView}
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
            <Text style={styles.backLinkText}>‹ {t("common.back")}</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>{t("pendingApprovals.title")}</Text>

          {pendingList.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>{t("pendingApprovals.empty")}</Text>
            </View>
          ) : (
            pendingList.map((m) => (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.cardTitle}>
                      {m.mentor?.name ?? "?"} → {m.mentee?.name ?? "?"}
                    </Text>
                    <Text style={styles.cardSub}>
                      {t("chats.mentor")}: {m.mentor?.city ?? "?"} ·{" "}
                      {t("chats.mentee")}: {m.mentee?.city ?? "?"}
                    </Text>
                    {m.assigned_at && (
                      <Text style={styles.cardDate}>
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
                    style={styles.rejectButton}
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
    </Container>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  center: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  accessText: { color: COLORS.primary, fontWeight: "600" },
  page: { padding: 20 },
  backLink: { marginBottom: 12 },
  backLinkText: { color: COLORS.link, fontSize: 14 },
  pageTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: COLORS.primary,
    marginBottom: 20,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { color: COLORS.secondary, fontSize: 14 },
  card: {
    backgroundColor: COLORS.white,
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
  cardTitle: { fontWeight: "700", color: COLORS.primary, fontSize: 15 },
  cardSub: { color: COLORS.secondary, fontSize: 12, marginTop: 3 },
  cardDate: { color: COLORS.tertiary, fontSize: 11, marginTop: 3 },
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
    borderColor: COLORS.error,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectButtonText: { color: COLORS.error, fontWeight: "600", fontSize: 14 },
});
