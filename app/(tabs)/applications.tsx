import React, { useState, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Modal,
  Platform,
  RefreshControl,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { MentorApplication } from "../../types";
import { COLORS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { sendApplicationRejectionEmail, sendInterviewInvitationEmail, sendWebinarInvitationEmail } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";
import { usePageTitle } from "../../hooks/usePageTitle";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { StatusBadge } from "../../components/StatusBadge";
import { EmptyState } from "../../components/EmptyState";
import { Ionicons } from "@expo/vector-icons";

// Öffentliche Anmeldungen sind in mentor_applications mit diesem Motivation-Marker gespeichert
const PUBLIC_REGISTRATION_MARKER = "Anmeldung als neuer Muslim (öffentliches Formular)";

type RejectReasonKey = "r1" | "r2" | "r3" | "r4" | "r5";

// Parse JSON-Zusatzdaten aus dem experience-Feld
function parseExtraData(experience: string): Record<string, string> | null {
  try {
    const data = JSON.parse(experience);
    if (typeof data === "object" && data !== null) return data;
  } catch {}
  return null;
}

// Werte lesbar machen: yes/no → Ja/Nein, enum-Werte übersetzen
function translateExtraValue(value: string): string {
  if (value === "yes" || value === "true") return "Ja";
  if (value === "no" || value === "false") return "Nein";
  if (value === "public_transport") return "Öffentliche Verkehrsmittel";
  if (value === "car") return "Auto";
  if (value === "bicycle") return "Fahrrad";
  if (value === "on_foot") return "Zu Fuß";
  if (value === "none") return "Keine";
  return value;
}

export default function ApplicationsTabScreen() {
  usePageTitle("Bewerbungen");
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { applications, approveApplication, rejectApplication, deleteApplication, refreshData } = useData();
  const [mentorFilter, setMentorFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  // Ablehnung-Modal State
  const [rejectModalApp, setRejectModalApp] = useState<MentorApplication | null>(null);
  const [selectedReason, setSelectedReason] = useState<RejectReasonKey | null>(null);
  const [customReason, setCustomReason] = useState("");
  const [rejectReasonError, setRejectReasonError] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);
  const isApprovingRef = useRef(false);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (user?.role !== "admin" && user?.role !== "office") {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessDeniedText, { color: themeColors.text }]}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  // Mentor-Bewerbungen = alle die NICHT den Public-Marker haben
  const mentorApps = applications.filter(
    (a) => a.motivation !== PUBLIC_REGISTRATION_MARKER
  );

  const searchLower = search.toLowerCase();
  const filteredMentorApps = mentorApps.filter(
    (a) =>
      a.status === mentorFilter &&
      (search === "" ||
        a.name.toLowerCase().includes(searchLower) ||
        a.email.toLowerCase().includes(searchLower) ||
        a.city.toLowerCase().includes(searchLower))
  );

  const pendingMentorCount = mentorApps.filter((a) => a.status === "pending").length;

  // ─── Statistiken ───
  const stats = useMemo(() => {
    const total = mentorApps.length;
    const pending = mentorApps.filter((a) => a.status === "pending").length;
    const approved = mentorApps.filter((a) => a.status === "approved").length;
    const rejected = mentorApps.filter((a) => a.status === "rejected").length;
    const acceptanceRate = total > 0 ? Math.round((approved / total) * 100) : 0;
    const maleCount = mentorApps.filter((a) => a.gender === "male").length;
    const femaleCount = mentorApps.filter((a) => a.gender === "female").length;
    return { total, pending, approved, rejected, acceptanceRate, maleCount, femaleCount };
  }, [mentorApps]);

  async function handleApproveMentor(app: MentorApplication) {
    if (isApprovingRef.current) {
      showError("Genehmigung läuft bereits, bitte warten...");
      return;
    }
    const ok = await showConfirm(t("applications.approveTitle"), t("applications.confirmApprove").replace("{0}", app.name));
    if (!ok) return;
    isApprovingRef.current = true;
    try {
      await approveApplication(app.id);
      showSuccess(t("applications.statusApproved"));
      // refreshData im Hintergrund (nicht blockierend)
      refreshData().catch(() => {});
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      showError(`Genehmigung fehlgeschlagen: ${msg}`);
    } finally {
      isApprovingRef.current = false;
    }
  }

  async function handleDeleteApplication(app: MentorApplication) {
    const confirmed = await showConfirm(
      "Bewerbung löschen",
      `Bewerbung von ${app.name} (${app.email}) unwiderruflich löschen?`
    );
    if (!confirmed) return;
    try {
      await deleteApplication(app.id);
      showSuccess("Bewerbung gelöscht");
      await refreshData();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      showError(`Löschen fehlgeschlagen: ${msg}`);
    }
  }

  // Ablehnung-Modal öffnen (nur für Mentoren)
  function openRejectModal(app: MentorApplication) {
    setRejectModalApp(app);
    setSelectedReason(null);
    setCustomReason("");
    setRejectReasonError("");
  }

  function closeRejectModal() {
    setRejectModalApp(null);
    setSelectedReason(null);
    setCustomReason("");
    setRejectReasonError("");
  }

  async function handleConfirmReject() {
    if (!rejectModalApp) return;

    // Validierung
    if (!selectedReason) {
      setRejectReasonError(t("applications.rejectReasonRequired"));
      return;
    }
    if (selectedReason === "r5" && !customReason.trim()) {
      setRejectReasonError(t("applications.rejectReasonCustomRequired"));
      return;
    }

    const reasonLabels: Record<RejectReasonKey, string> = {
      r1: t("applications.rejectReason1"),
      r2: t("applications.rejectReason2"),
      r3: t("applications.rejectReason3"),
      r4: t("applications.rejectReason4"),
      r5: customReason.trim(),
    };
    const reasonText = reasonLabels[selectedReason];

    setIsRejecting(true);
    try {
      await rejectApplication(rejectModalApp.id, reasonText);
      const appType = rejectModalApp.motivation === PUBLIC_REGISTRATION_MARKER ? "mentee" : "mentor";
      await sendApplicationRejectionEmail(
        rejectModalApp.email,
        rejectModalApp.name,
        appType,
        reasonText
      );
      closeRejectModal();
      showSuccess(t("applications.statusRejected"));
      await refreshData();
    } catch {
      showError(t("common.error"));
    } finally {
      setIsRejecting(false);
    }
  }

  // Vordefinierte Ablehnungsgründe
  const rejectReasons: { key: RejectReasonKey; label: string }[] = [
    { key: "r1", label: t("applications.rejectReason1") },
    { key: "r2", label: t("applications.rejectReason2") },
    { key: "r3", label: t("applications.rejectReason3") },
    { key: "r4", label: t("applications.rejectReason4") },
    { key: "r5", label: t("applications.rejectReason5") },
  ];

  // Refs für stabile Handler-Referenzen (vermeidet stale closures in FlatList)
  const handleApproveMentorRef = useRef(handleApproveMentor);
  handleApproveMentorRef.current = handleApproveMentor;
  const openRejectModalRef = useRef(openRejectModal);
  openRejectModalRef.current = openRejectModal;
  const handleDeleteApplicationRef = useRef(handleDeleteApplication);
  handleDeleteApplicationRef.current = handleDeleteApplication;

  const renderApplication = useCallback(({ item: app }: { item: MentorApplication }) => (
    <View style={styles.flatListItem}>
      <ApplicationCard
        application={app}
        type="mentor"
        onApprove={() => handleApproveMentorRef.current(app)}
        onReject={() => openRejectModalRef.current(app)}
        onDelete={() => handleDeleteApplicationRef.current(app)}
      />
    </View>
  ), []);

  const listHeader = useCallback(() => (
    <View style={styles.page}>
      <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("applications.title")}</Text>

      {/* ─── Statistik-Card ─── */}
      <View style={[styles.statsCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <Text style={[styles.statsTitle, { color: themeColors.text }]}>Statistik</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Gesamt</Text>
            <Text style={[styles.statsValue, { color: themeColors.text }]}>{stats.total}</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Offen</Text>
            <View style={[styles.statsBadge, { backgroundColor: "#fffbeb" }]}>
              <Text style={[styles.statsBadgeText, { color: "#92400e" }]}>{stats.pending}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Genehmigt</Text>
            <View style={[styles.statsBadge, { backgroundColor: COLORS.successBg }]}>
              <Text style={[styles.statsBadgeText, { color: COLORS.successDark }]}>{stats.approved}</Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Abgelehnt</Text>
            <View style={[styles.statsBadge, { backgroundColor: COLORS.errorBg }]}>
              <Text style={[styles.statsBadgeText, { color: COLORS.error }]}>{stats.rejected}</Text>
            </View>
          </View>
          <View style={styles.statsDivider} />
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Annahmequote</Text>
            <Text style={[styles.statsValue, { color: COLORS.cta }]}>{stats.acceptanceRate}%</Text>
          </View>
          <View style={styles.statsRow}>
            <Text style={[styles.statsLabel, { color: themeColors.textTertiary }]}>Geschlecht</Text>
            <Text style={[styles.statsValue, { color: themeColors.textSecondary }]}>
              {stats.maleCount} m / {stats.femaleCount} w
            </Text>
          </View>
        </View>
      </View>

      {/* Suche */}
      <TextInput
        style={[styles.searchInput, { backgroundColor: themeColors.card, borderColor: themeColors.border, color: themeColors.text }]}
        placeholder={t("applications.search")}
        placeholderTextColor={themeColors.textTertiary}
        value={search}
        onChangeText={(v) => setSearch(v)}
        accessibilityLabel="Bewerbungen durchsuchen"
      />

      {/* ─── Mentor-Bewerbungen ─── */}
      <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
        {t("applications.pendingMentor")
          .replace("{0}", String(pendingMentorCount))
          .replace("{1}", pendingMentorCount !== 1 ? "en" : "")}
      </Text>
      <View style={styles.filterRow}>
        {(
          [
            { key: "pending", label: t("applications.filterOpen") },
            { key: "approved", label: t("applications.filterApproved") },
            { key: "rejected", label: t("applications.filterRejected") },
          ] as const
        ).map((tab) => {
          const count = mentorApps.filter((a) => a.status === tab.key).length;
          return (
            <BNMPressable
              key={tab.key}
              style={[
                styles.filterChip,
                mentorFilter === tab.key ? styles.filterChipActive : [styles.filterChipInactive, { backgroundColor: themeColors.card, borderColor: themeColors.border }],
              ]}
              onPress={() => setMentorFilter(tab.key)}
              accessibilityRole="radio"
              accessibilityLabel={`${tab.label} (${count})`}
              accessibilityState={{ checked: mentorFilter === tab.key }}
            >
              <Text
                style={
                  mentorFilter === tab.key
                    ? styles.filterChipTextActive
                    : [styles.filterChipTextInactive, { color: themeColors.textSecondary }]
                }
              >
                {tab.label} ({count})
              </Text>
            </BNMPressable>
          );
        })}
      </View>
    </View>
  ), [themeColors, search, mentorFilter, pendingMentorCount, mentorApps, stats]);

  const listEmpty = useCallback(() => (
    <EmptyState
      icon={mentorFilter === "pending" ? "document-text-outline" : mentorFilter === "approved" ? "checkmark-circle-outline" : "close-circle-outline"}
      title={mentorFilter === "pending"
        ? t("applications.noOpen")
        : mentorFilter === "approved"
        ? t("applications.noApproved")
        : t("applications.noRejected")}
      compact
    />
  ), [themeColors, mentorFilter]);

  const keyExtractor = useCallback((item: MentorApplication) => item.id, []);

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <FlatList
        data={filteredMentorApps}
        renderItem={renderApplication}
        keyExtractor={keyExtractor}
        extraData={filteredMentorApps}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={listEmpty}
        contentContainerStyle={styles.flatListContent}
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        removeClippedSubviews={false}
        windowSize={10}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      />

      {/* ─── Ablehnung-Modal (Mentor) ─── */}
      <Modal
        visible={rejectModalApp !== null}
        transparent
        animationType="fade"
        onRequestClose={closeRejectModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: themeColors.card }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>
              {t("applications.rejectReasonTitle")}
            </Text>
            {rejectModalApp && (
              <Text style={[styles.modalSubtitle, { color: themeColors.textSecondary }]}>
                {rejectModalApp.name}
              </Text>
            )}
            <Text style={[styles.modalLabel, { color: themeColors.textTertiary }]}>
              {t("applications.rejectReasonSubtitle")}
            </Text>

            {rejectReasons.map((r) => (
              <BNMPressable
                key={r.key}
                style={[
                  styles.reasonRow,
                  { borderColor: themeColors.border },
                  selectedReason === r.key && [styles.reasonRowSelected, { borderColor: COLORS.error }],
                ]}
                onPress={() => {
                  setSelectedReason(r.key);
                  setRejectReasonError("");
                }}
                accessibilityRole="radio"
                accessibilityLabel={r.label}
                accessibilityState={{ checked: selectedReason === r.key }}
              >
                <View style={[
                  styles.radioOuter,
                  { borderColor: selectedReason === r.key ? COLORS.error : themeColors.border },
                ]}>
                  {selectedReason === r.key && (
                    <View style={[styles.radioInner, { backgroundColor: COLORS.error }]} />
                  )}
                </View>
                <Text style={[styles.reasonLabel, { color: themeColors.text }]}>{r.label}</Text>
              </BNMPressable>
            ))}

            {/* Freies Textfeld bei "Sonstiger Grund" */}
            {selectedReason === "r5" && (
              <TextInput
                style={[
                  styles.customReasonInput,
                  {
                    backgroundColor: themeColors.background,
                    borderColor: themeColors.border,
                    color: themeColors.text,
                  },
                ]}
                placeholder={t("applications.rejectReasonCustomPlaceholder")}
                placeholderTextColor={themeColors.textTertiary}
                value={customReason}
                onChangeText={(v) => {
                  setCustomReason(v);
                  setRejectReasonError("");
                }}
                multiline
                numberOfLines={3}
                accessibilityLabel="Eigenen Ablehnungsgrund eingeben"
              />
            )}

            {rejectReasonError !== "" && (
              <Text style={styles.errorText}>{rejectReasonError}</Text>
            )}

            <View style={styles.modalButtonRow}>
              <BNMPressable
                style={[styles.modalCancelButton, { borderColor: themeColors.border }]}
                onPress={closeRejectModal}
                disabled={isRejecting}
                accessibilityRole="button"
                accessibilityLabel={t("applications.rejectCancelButton")}
                accessibilityState={{ disabled: isRejecting }}
              >
                <Text style={[styles.modalCancelText, { color: themeColors.textSecondary }]}>
                  {t("applications.rejectCancelButton")}
                </Text>
              </BNMPressable>
              <BNMPressable
                style={[styles.modalRejectButton, isRejecting ? { opacity: 0.6 } : {}]}
                onPress={handleConfirmReject}
                disabled={isRejecting}
                hapticStyle="error"
                accessibilityRole="button"
                accessibilityLabel={t("applications.rejectConfirmButton")}
                accessibilityState={{ disabled: isRejecting }}
              >
                <Text style={styles.modalRejectText}>
                  {isRejecting ? "..." : t("applications.rejectConfirmButton")}
                </Text>
              </BNMPressable>
            </View>
          </View>
        </View>
      </Modal>
    </Container>
  );
}

function ApplicationCard({
  application,
  type,
  onApprove,
  onReject,
  onDelete,
}: {
  application: MentorApplication;
  type: "mentor" | "mentee";
  onApprove: () => void;
  onReject: () => void;
  onDelete?: () => void;
}) {
  const { t } = useLanguage();
  const { user: currentUser } = useAuth();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [isSendingInvite, setIsSendingInvite] = useState(false);
  const isPending = application.status === "pending";
  const isApproved = application.status === "approved";
  // Office darf Bewerbungen sehen aber nicht genehmigen (Genehmigung erstellt Accounts)
  const canApprove = currentUser?.role === "admin";

  const badgeStatus = isPending ? "pending" as const : isApproved ? "active" as const : "cancelled" as const;
  const statusLabel = isPending ? t("applications.statusOpen") : isApproved ? t("applications.statusApproved") : t("applications.statusRejected");

  const genderLabel = application.gender === "male" ? t("applications.brother") : t("applications.sister");

  const contactLabels: Record<string, string> = {
    whatsapp: "WhatsApp",
    phone: t("applications.phoneLabel"),
    email: t("applications.emailLabel"),
    telegram: "Telegram",
  };

  const approveLabel = type === "mentor" ? t("applications.approve") : t("applications.createAccount");
  const approveColor = type === "mentor" ? COLORS.cta : COLORS.gradientStart;

  const submittedDate = new Date(application.submitted_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Kompakte Übersichtszeile — immer sichtbar */}
      <BNMPressable
        style={styles.cardSummaryRow}
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`${application.name}, ${statusLabel} – ${expanded ? "Einklappen" : "Aufklappen"}`}
      >
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={[styles.applicantName, { color: themeColors.text }]}>{application.name}</Text>
            <StatusBadge status={badgeStatus} label={statusLabel} compact />
          </View>
          <Text style={[styles.applicantSummary, { color: themeColors.textTertiary }]}>
            {application.email} · {application.city} · {submittedDate}
          </Text>
        </View>
        <Text style={[styles.accordionArrow, { color: themeColors.textTertiary }]}>
          {expanded ? "▲" : "▼"}
        </Text>
      </BNMPressable>

      {/* Detail-Bereich — nur bei expanded sichtbar */}
      {expanded && (
        <>
          {/* Persönliche Infos */}
          <View style={[styles.infoSection, { backgroundColor: themeColors.background }]}>
            <InfoLine label={t("applications.emailLabel")} value={application.email} />
            {application.phone ? <InfoLine label={t("applications.phoneLabel")} value={application.phone} /> : null}
            <InfoLine
              label={t("applications.contactLabel")}
              value={contactLabels[application.contact_preference] ?? application.contact_preference}
            />
            <InfoLine label={t("applications.genderLabel")} value={`${genderLabel} · ${application.age} ${t("common.yearsOld")}`} />
            <InfoLine label={t("applications.cityLabel")} value={application.plz ? `${application.city}, ${application.plz}` : application.city} />
            <InfoLine
              label={t("applications.submittedLabel")}
              value={new Date(application.submitted_at).toLocaleDateString("de-DE", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            />
          </View>

          {/* Erfahrung / Motivation (nur für Mentor-Bewerbungen) */}
          {type === "mentor" && (
            <>
              {application.experience ? (() => {
                const extraData = parseExtraData(application.experience);
                const extraLabels: Record<string, string> = {
                  hoursPerWeek: t("applications.extraHoursPerWeek"),
                  driversLicense: t("applications.extraDriversLicense"),
                  travelTime: t("applications.extraTravelTime"),
                  qualification: t("applications.extraQualification"),
                  hasMentoredBefore: t("applications.extraHasMentoredBefore"),
                  mentoringExperience: t("applications.extraMentoringExperience"),
                  inOrganization: t("applications.extraInOrganization"),
                  organizationName: t("applications.extraOrganizationName"),
                  country: t("applications.extraCountry"),
                  birthdate: t("applications.extraBirthdate"),
                };
                if (extraData) {
                  return (
                    <View style={styles.textSection}>
                      <Text style={[styles.textSectionLabel, { color: themeColors.textTertiary }]}>{t("applications.experience")}</Text>
                      <View style={[styles.extraDataTable, { backgroundColor: themeColors.background }]}>
                        {Object.entries(extraData).map(([key, val]) => (
                          <View key={key} style={[styles.extraDataRow, { borderBottomColor: themeColors.border }]}>
                            <Text style={[styles.extraDataLabel, { color: themeColors.textTertiary }]}>
                              {extraLabels[key] ?? key}
                            </Text>
                            <Text style={[styles.extraDataValue, { color: themeColors.text }]}>
                              {translateExtraValue(String(val))}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  );
                }
                return (
                  <View style={styles.textSection}>
                    <Text style={[styles.textSectionLabel, { color: themeColors.textTertiary }]}>{t("applications.experience")}</Text>
                    <Text style={[styles.textSectionContent, { color: themeColors.textSecondary }]}>{application.experience}</Text>
                  </View>
                );
              })() : null}
              <View style={styles.textSection}>
                <Text style={[styles.textSectionLabel, { color: themeColors.textTertiary }]}>{t("applications.motivation")}</Text>
                <Text style={[styles.textSectionContent, { color: themeColors.textSecondary }]}>{application.motivation}</Text>
              </View>
            </>
          )}

          {/* Aktions-Buttons (nur für offene Einträge, Genehmigung nur für Admin) */}
          {isPending && canApprove && (
            <>
              <View style={styles.actionRow}>
                <BNMPressable
                  style={[styles.rejectButton, { backgroundColor: sem(SEMANTIC.redBg, isDark), borderColor: sem(SEMANTIC.redBorder, isDark) }]}
                  onPress={onReject}
                  accessibilityRole="button"
                  accessibilityLabel={`${application.name} ${t("applications.reject")}`}
                >
                  <Text style={[styles.rejectButtonText, { color: isDark ? "#f87171" : "#dc2626" }]}>{t("applications.reject")}</Text>
                </BNMPressable>
                <BNMPressable
                  style={[styles.approveButton, { backgroundColor: approveColor }]}
                  onPress={onApprove}
                  hapticStyle="success"
                  accessibilityRole="button"
                  accessibilityLabel={`${application.name} ${approveLabel}`}
                >
                  <Text style={styles.approveButtonText}>{approveLabel}</Text>
                </BNMPressable>
              </View>
              {/* Einladungs-Buttons */}
              <View style={styles.inviteRow}>
                <BNMPressable
                  style={[styles.inviteButton, { borderColor: COLORS.gradientStart }, isSendingInvite && { opacity: 0.6 }]}
                  disabled={isSendingInvite}
                  onPress={async () => {
                    setIsSendingInvite(true);
                    try {
                      const ok = await sendInterviewInvitationEmail(application.email, application.name);
                      if (ok) showSuccess("Gesprächseinladung gesendet");
                      else showError("E-Mail konnte nicht gesendet werden");
                    } catch { showError("Fehler beim Senden"); }
                    finally { setIsSendingInvite(false); }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${application.name} zum Gespräch einladen`}
                >
                  <Text style={[styles.inviteButtonText, { color: COLORS.gradientStart }]}>Zum Gespräch einladen</Text>
                </BNMPressable>
                <BNMPressable
                  style={[styles.inviteButton, { borderColor: COLORS.gold }, isSendingInvite && { opacity: 0.6 }]}
                  disabled={isSendingInvite}
                  onPress={async () => {
                    setIsSendingInvite(true);
                    try {
                      const ok = await sendWebinarInvitationEmail(application.email, application.name);
                      if (ok) showSuccess("Webinar-Einladung gesendet");
                      else showError("E-Mail konnte nicht gesendet werden");
                    } catch { showError("Fehler beim Senden"); }
                    finally { setIsSendingInvite(false); }
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`${application.name} zum Webinar einladen`}
                >
                  <Text style={[styles.inviteButtonText, { color: COLORS.gold }]}>Zum Webinar einladen</Text>
                </BNMPressable>
              </View>
            </>
          )}

          {/* Löschen-Button (Admin, alle Status) */}
          {canApprove && onDelete && (
            <BNMPressable
              style={[styles.deleteRow, { borderTopColor: themeColors.border }]}
              onPress={onDelete}
              accessibilityRole="button"
              accessibilityLabel={`${application.name} Bewerbung löschen`}
            >
              <Ionicons name="trash-outline" size={15} color={COLORS.error} />
              <Text style={styles.deleteText}>Bewerbung löschen</Text>
            </BNMPressable>
          )}
        </>
      )}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  const themeColors = useThemeColors();
  return (
    <View style={styles.infoLine}>
      <Text style={[styles.infoLineLabel, { color: themeColors.textTertiary }]}>{label}</Text>
      <Text style={[styles.infoLineValue, { color: themeColors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  accessDeniedText: { fontWeight: "600" },
  scrollView: { flex: 1 },
  flatListContent: { paddingBottom: 24 },
  flatListItem: { paddingHorizontal: 24 },
  page: { padding: 24, paddingBottom: 0 },
  pageTitle: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3, textAlign: "center", marginBottom: 12 },
  pageSubtitle: { marginBottom: 16, fontSize: 13, textAlign: "center" },

  searchInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    marginBottom: 12,
  },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipInactive: {},
  filterChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  filterChipTextInactive: { fontSize: 12, fontWeight: "500" },

  emptyCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 28,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, textAlign: "center" },

  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    marginBottom: 14,
  },
  cardSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  applicantName: { fontWeight: "800", fontSize: 16 },
  applicantSummary: { fontSize: 12, marginTop: 3 },
  applicantSub: { fontSize: 12, marginTop: 2 },
  accordionArrow: { fontSize: 11, paddingHorizontal: 4 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: RADIUS.full },
  statusText: { fontSize: 12, fontWeight: "600" },

  infoSection: {
    borderRadius: RADIUS.md,
    padding: 10,
    marginTop: 12,
    marginBottom: 10,
    gap: 5,
  },
  infoLine: { flexDirection: "row", justifyContent: "space-between" },
  infoLineLabel: { fontSize: 13 },
  infoLineValue: {
    fontSize: 13,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },

  textSection: { marginBottom: 10 },
  textSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textSectionContent: { fontSize: 13, lineHeight: 19 },
  extraDataTable: {
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 4,
  },
  extraDataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  extraDataLabel: {
    fontSize: 12,
    flex: 1,
  },
  extraDataValue: {
    fontSize: 12,
    fontWeight: "500",
    maxWidth: "55%",
    textAlign: "right",
  },

  // Stats
  statsCard: {
    borderRadius: RADIUS.md,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  statsTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  statsGrid: {
    gap: 6,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  statsLabel: {
    fontSize: 13,
  },
  statsValue: {
    fontSize: 13,
    fontWeight: "600",
  },
  statsBadge: {
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statsBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.divider,
    marginVertical: 4,
  },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  inviteRow: { flexDirection: "row", gap: 10, marginTop: 6 },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  deleteText: {
    fontSize: 13,
    color: COLORS.error,
    fontWeight: "500",
  },
  inviteButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 7,
    alignItems: "center",
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rejectButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectButtonText: { fontWeight: "600", fontSize: 13 },
  approveButton: {
    flex: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 13 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalBox: {
    width: "100%",
    maxWidth: 420,
    borderRadius: RADIUS.lg,
    padding: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  reasonRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginBottom: 8,
    gap: 10,
  },
  reasonRowSelected: {
    borderWidth: 1.5,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: RADIUS.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.sm,
  },
  reasonLabel: {
    fontSize: 14,
    flex: 1,
  },
  customReasonInput: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    marginBottom: 8,
    minHeight: 72,
    textAlignVertical: "top",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 12,
    marginBottom: 8,
  },
  modalButtonRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalRejectButton: {
    flex: 1,
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalRejectText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
});
