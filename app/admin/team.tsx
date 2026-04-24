import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { COLORS, RADIUS, SHADOWS } from "../../constants/Colors";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { BNMPressable } from "../../components/BNMPressable";
import { StatusBadge } from "../../components/StatusBadge";
import { useThemeColors } from "../../contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { User } from "../../types";

type TabKey = "members" | "permissions";

interface PermissionRow {
  label: string;
  admin: boolean;
  office: boolean;
  note?: string;
}

const PERMISSIONS: PermissionRow[] = [
  { label: "Team-Verwaltung (diese Seite)", admin: true, office: false },
  { label: "Admin/Office User anlegen", admin: true, office: false },
  { label: "User hart löschen (DB + Auth)", admin: true, office: false },
  { label: "User sperren/entsperren", admin: true, office: true },
  { label: "Bewerbungen genehmigen (Account erstellen)", admin: true, office: false },
  { label: "Bewerbungen sehen + ablehnen", admin: true, office: true },
  { label: "CSV-Import (Bulk-Upload)", admin: true, office: false },
  { label: "Session-Typen verwalten", admin: true, office: false },
  { label: "Hadithe verwalten", admin: true, office: false },
  { label: "Nachrichten-Vorlagen", admin: true, office: false },
  { label: "Ressourcen verwalten", admin: true, office: false },
  { label: "Kalender-Events verwalten", admin: true, office: false },
  { label: "Mentor-Award", admin: true, office: false },
  { label: "Chats einsehen", admin: true, office: false },
  { label: "Admin-Notizen bearbeiten", admin: true, office: false, note: "Office: nur lesen" },
  { label: "Dashboard", admin: true, office: true },
  { label: "Mentees-Liste", admin: true, office: true },
  { label: "Mentoren-Liste", admin: true, office: true },
  { label: "Feedback einsehen", admin: true, office: true },
  { label: "Q&A verwalten", admin: true, office: true },
  { label: "Zertifikate erstellen", admin: true, office: true },
  { label: "Berichte / Reports", admin: true, office: true },
  { label: "Ranking / Leaderboard", admin: true, office: true },
  { label: "User-Profile bearbeiten", admin: true, office: true },
];

export default function TeamScreen() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const { users, setUserActive } = useData();
  const themeColors = useThemeColors();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabKey>("members");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Nur Admin darf diese Seite öffnen
  if (!authUser || authUser.role !== "admin") {
    return (
      <Container fullWidth={Platform.OS === "web"}>
        <View style={[styles.center, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.denied, { color: COLORS.error }]}>
            Diese Seite ist nur für Admins. Office-Mitarbeiter haben keinen Zugriff.
          </Text>
        </View>
      </Container>
    );
  }

  const teamMembers = useMemo(
    () =>
      users
        .filter((u) => u.role === "admin" || u.role === "office")
        .sort((a, b) => {
          // Admin zuerst, dann Office, dann alphabetisch
          if (a.role !== b.role) return a.role === "admin" ? -1 : 1;
          return a.name.localeCompare(b.name);
        }),
    [users]
  );

  const adminCount = teamMembers.filter((u) => u.role === "admin").length;
  const officeCount = teamMembers.filter((u) => u.role === "office").length;

  async function handleToggleActive(u: User) {
    if (u.id === authUser?.id) {
      showError("Du kannst dich nicht selbst sperren.");
      return;
    }
    const action = u.is_active === false ? "entsperren" : "sperren";
    const ok = await showConfirm(
      `${action === "sperren" ? "Sperren" : "Entsperren"} bestätigen`,
      `${u.name} wirklich ${action}?`
    );
    if (!ok) return;
    setTogglingId(u.id);
    try {
      await setUserActive(u.id, u.is_active === false);
      showSuccess(`${u.name} wurde ${action === "sperren" ? "gesperrt" : "entsperrt"}.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      showError(`Aktion fehlgeschlagen: ${msg}`);
    } finally {
      setTogglingId(null);
    }
  }

  function renderMember({ item: u }: { item: User }) {
    const isSelf = u.id === authUser?.id;
    const roleLabel = u.role === "admin" ? "Admin" : "Office";
    const roleColor = u.role === "admin" ? COLORS.error : COLORS.gradientStart;
    const isBlocked = u.is_active === false;

    return (
      <View style={[styles.memberCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <View style={styles.memberHeader}>
          <View style={styles.memberInfo}>
            <View style={styles.memberTitleRow}>
              <Text style={[styles.memberName, { color: themeColors.text }]}>{u.name}</Text>
              <View style={[styles.roleBadge, { backgroundColor: roleColor }]}>
                <Text style={styles.roleBadgeText}>{roleLabel}</Text>
              </View>
              {isSelf && (
                <View style={[styles.selfBadge, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}>
                  <Text style={[styles.selfBadgeText, { color: themeColors.textSecondary }]}>Du</Text>
                </View>
              )}
            </View>
            <Text style={[styles.memberEmail, { color: themeColors.textSecondary }]}>{u.email}</Text>
            {u.city ? (
              <Text style={[styles.memberMeta, { color: themeColors.textTertiary }]}>{u.city}</Text>
            ) : null}
          </View>
          <StatusBadge
            status={isBlocked ? "cancelled" : "active"}
            label={isBlocked ? "Gesperrt" : "Aktiv"}
            compact
          />
        </View>

        <View style={styles.memberActions}>
          <BNMPressable
            style={[styles.actionBtn, { borderColor: themeColors.border }]}
            onPress={() => router.push(`/admin/edit-user?id=${u.id}` as never)}
            accessibilityRole="link"
            accessibilityLabel={`${u.name} bearbeiten`}
          >
            <Ionicons name="create-outline" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.actionBtnText, { color: themeColors.textSecondary }]}>Bearbeiten</Text>
          </BNMPressable>

          {!isSelf && (
            <BNMPressable
              style={[
                styles.actionBtn,
                {
                  borderColor: isBlocked ? COLORS.cta : COLORS.error,
                  backgroundColor: isBlocked ? "transparent" : "transparent",
                  opacity: togglingId === u.id ? 0.5 : 1,
                },
              ]}
              disabled={togglingId === u.id}
              onPress={() => handleToggleActive(u)}
              accessibilityRole="button"
              accessibilityLabel={isBlocked ? `${u.name} entsperren` : `${u.name} sperren`}
            >
              <Ionicons
                name={isBlocked ? "lock-open-outline" : "lock-closed-outline"}
                size={16}
                color={isBlocked ? COLORS.cta : COLORS.error}
              />
              <Text style={[styles.actionBtnText, { color: isBlocked ? COLORS.cta : COLORS.error }]}>
                {isBlocked ? "Entsperren" : "Sperren"}
              </Text>
            </BNMPressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <View style={[styles.flex1, { backgroundColor: themeColors.background }]}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <BNMPressable style={styles.backLink} onPress={() => router.back()}>
            <Text style={[styles.backLinkText, { color: themeColors.link }]}>‹ Zurück</Text>
          </BNMPressable>

          <View style={styles.titleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.pageTitle, { color: themeColors.text }]}>Team</Text>
              <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
                {adminCount} Admin · {officeCount} Office
              </Text>
            </View>
            <BNMPressable
              style={styles.addBtn}
              onPress={() => router.push("/admin/create-user?role=office" as never)}
              accessibilityRole="link"
              accessibilityLabel="Neues Mitglied anlegen"
            >
              <Ionicons name="add" size={18} color={COLORS.white} />
              <Text style={styles.addBtnText}>Neues Mitglied</Text>
            </BNMPressable>
          </View>

          {/* Tabs */}
          <View style={styles.tabRow}>
            <BNMPressable
              style={[
                styles.tab,
                tab === "members"
                  ? styles.tabActive
                  : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
              ]}
              onPress={() => setTab("members")}
            >
              <Text style={[styles.tabText, { color: tab === "members" ? COLORS.white : themeColors.textSecondary }]}>
                Mitglieder ({teamMembers.length})
              </Text>
            </BNMPressable>
            <BNMPressable
              style={[
                styles.tab,
                tab === "permissions"
                  ? styles.tabActive
                  : { backgroundColor: themeColors.card, borderColor: themeColors.border, borderWidth: 1 },
              ]}
              onPress={() => setTab("permissions")}
            >
              <Text style={[styles.tabText, { color: tab === "permissions" ? COLORS.white : themeColors.textSecondary }]}>
                Berechtigungen
              </Text>
            </BNMPressable>
          </View>
        </View>

        {/* Content */}
        {tab === "members" ? (
          <FlatList
            data={teamMembers}
            keyExtractor={(u) => u.id}
            renderItem={renderMember}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>Keine Team-Mitglieder gefunden.</Text>
              </View>
            }
          />
        ) : (
          <ScrollView style={styles.flex1} contentContainerStyle={styles.listContent}>
            <View style={[styles.matrixCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              {/* Matrix-Header */}
              <View style={[styles.matrixRow, styles.matrixHeader, { borderBottomColor: themeColors.border }]}>
                <Text style={[styles.matrixLabel, styles.matrixHeaderText, { color: themeColors.text }]}>Feature</Text>
                <Text style={[styles.matrixCell, styles.matrixHeaderText, { color: themeColors.text }]}>Admin</Text>
                <Text style={[styles.matrixCell, styles.matrixHeaderText, { color: themeColors.text }]}>Office</Text>
              </View>

              {PERMISSIONS.map((p, idx) => (
                <View
                  key={p.label}
                  style={[
                    styles.matrixRow,
                    idx < PERMISSIONS.length - 1 && { borderBottomWidth: 1, borderBottomColor: themeColors.border },
                  ]}
                >
                  <View style={styles.matrixLabelWrap}>
                    <Text style={[styles.matrixLabel, { color: themeColors.text }]}>{p.label}</Text>
                    {p.note ? (
                      <Text style={[styles.matrixNote, { color: themeColors.textTertiary }]}>{p.note}</Text>
                    ) : null}
                  </View>
                  <View style={styles.matrixCell}>
                    {p.admin ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.cta} />
                    ) : (
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                    )}
                  </View>
                  <View style={styles.matrixCell}>
                    {p.office ? (
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.cta} />
                    ) : (
                      <Ionicons name="close-circle" size={20} color={COLORS.error} />
                    )}
                  </View>
                </View>
              ))}
            </View>

            <Text style={[styles.matrixFooter, { color: themeColors.textTertiary }]}>
              Hinweis: Office kann die meisten Lese-Operationen durchführen, aber keine System-Einstellungen ändern und keine neuen Accounts erstellen.
            </Text>
          </ScrollView>
        )}
      </View>
    </Container>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  denied: { fontWeight: "600", textAlign: "center" },

  header: { padding: 20, paddingBottom: 12 },
  backLink: { marginBottom: 8 },
  backLinkText: { fontSize: 14 },

  titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 16 },
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  pageSubtitle: { fontSize: 13, marginTop: 2 },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.cta,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: RADIUS.md,
  },
  addBtnText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },

  tabRow: { flexDirection: "row", gap: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: RADIUS.full },
  tabActive: { backgroundColor: COLORS.gradientStart },
  tabText: { fontSize: 13, fontWeight: "600" },

  listContent: { padding: 20, paddingBottom: 40 },

  memberCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 14,
    marginBottom: 10,
    ...SHADOWS.sm,
  },
  memberHeader: { flexDirection: "row", gap: 12, marginBottom: 10 },
  memberInfo: { flex: 1 },
  memberTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 2 },
  memberName: { fontSize: 15, fontWeight: "700" },
  memberEmail: { fontSize: 12, marginTop: 2 },
  memberMeta: { fontSize: 11, marginTop: 2 },

  roleBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: RADIUS.full },
  roleBadgeText: { color: COLORS.white, fontSize: 11, fontWeight: "700" },
  selfBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: RADIUS.full, borderWidth: 1 },
  selfBadgeText: { fontSize: 10, fontWeight: "600" },

  memberActions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  empty: { padding: 40, alignItems: "center" },
  emptyText: { fontSize: 13 },

  matrixCard: { borderRadius: RADIUS.md, borderWidth: 1, overflow: "hidden" },
  matrixRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 },
  matrixHeader: { borderBottomWidth: 1 },
  matrixHeaderText: { fontWeight: "700", fontSize: 12, letterSpacing: 0.3 },
  matrixLabelWrap: { flex: 1 },
  matrixLabel: { flex: 1, fontSize: 13 },
  matrixNote: { fontSize: 10, marginTop: 2, fontStyle: "italic" },
  matrixCell: { width: 70, alignItems: "center", justifyContent: "center" },
  matrixFooter: { fontSize: 11, marginTop: 14, fontStyle: "italic", lineHeight: 16 },
});
