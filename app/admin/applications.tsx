import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from "react-native";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { MentorApplication } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { supabase } from "../../lib/supabase";
import { supabaseAnon } from "../../lib/supabaseAnon";
import { sendCredentialsEmail } from "../../lib/emailService";
import { useLanguage } from "../../contexts/LanguageContext";

// Öffentliche Anmeldungen sind in mentor_applications mit diesem Motivation-Marker gespeichert
const PUBLIC_REGISTRATION_MARKER = "Anmeldung als neuer Muslim (öffentliches Formular)";

type MainTab = "mentors" | "mentees";

export default function ApplicationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const { applications, approveApplication, rejectApplication } = useData();
  const [mainTab, setMainTab] = useState<MainTab>("mentors");
  const [mentorFilter, setMentorFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [menteeFilter, setMenteeFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [search, setSearch] = useState("");

  if (user?.role !== "admin" && user?.role !== "office") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>{t("applications.accessDenied")}</Text>
      </View>
    );
  }

  // Mentor-Bewerbungen = alle die NICHT den Public-Marker haben
  const mentorApps = applications.filter(
    (a) => a.motivation !== PUBLIC_REGISTRATION_MARKER
  );
  // Mentee-Anmeldungen = alle mit Public-Marker
  const menteeApps = applications.filter(
    (a) => a.motivation === PUBLIC_REGISTRATION_MARKER
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
  const filteredMenteeApps = menteeApps.filter(
    (a) =>
      a.status === menteeFilter &&
      (search === "" ||
        a.name.toLowerCase().includes(searchLower) ||
        a.email.toLowerCase().includes(searchLower) ||
        a.city.toLowerCase().includes(searchLower))
  );

  const pendingMentorCount = mentorApps.filter((a) => a.status === "pending").length;
  const pendingMenteeCount = menteeApps.filter((a) => a.status === "pending").length;

  async function handleApproveMentor(app: MentorApplication) {
    const ok = await showConfirm(t("applications.approveTitle"), t("applications.confirmApprove").replace("{0}", app.name));
    if (ok) {
      await approveApplication(app.id);
    }
  }

  async function handleRejectMentor(app: MentorApplication) {
    const ok = await showConfirm(t("applications.rejectTitle"), t("applications.confirmReject").replace("{0}", app.name));
    if (ok) {
      rejectApplication(app.id);
    }
  }

  async function handleAcceptMenteeRegistration(app: MentorApplication) {
    const ok = await showConfirm(t("applications.createAccountTitle"), t("applications.confirmCreateAccount").replace("{0}", app.name).replace("{1}", app.email));
    if (!ok) return;

    // Temporäres Passwort generieren: "BNM-" + 6 Zufallsziffern
    const digits = Math.floor(100000 + Math.random() * 900000).toString();
    const tempPassword = `BNM-${digits}`;

    // Admin-Session sichern (signUp loggt sonst den Admin aus!)
    const { data: adminSession } = await supabase.auth.getSession();

    const { error: signUpError } = await supabaseAnon.auth.signUp({
      email: app.email,
      password: tempPassword,
      options: {
        data: {
          name: app.name,
          role: "mentee",
          gender: app.gender,
          city: app.city,
          age: app.age,
        },
      },
    });

    // Admin-Session wiederherstellen
    if (adminSession?.session) {
      await supabase.auth.setSession({
        access_token: adminSession.session.access_token,
        refresh_token: adminSession.session.refresh_token,
      });
    }

    if (signUpError) {
      if (
        signUpError.message.includes("already registered") ||
        signUpError.message.includes("User already registered")
      ) {
        showSuccess(t("applications.alreadyAccount").replace("{0}", app.name));
      } else {
        showError(signUpError.message);
        return;
      }
    }

    // Anmeldung als approved markieren
    await approveApplication(app.id);

    // Zugangsdaten per E-Mail senden statt im Alert anzeigen
    await sendCredentialsEmail(app.email, app.name, tempPassword);
    showSuccess("Account erstellt. Zugangsdaten wurden per E-Mail an den Mentee gesendet.");
  }

  async function handleRejectMenteeRegistration(app: MentorApplication) {
    const ok = await showConfirm(t("applications.rejectMenteeTitle"), t("applications.confirmRejectMentee").replace("{0}", app.name));
    if (ok) {
      rejectApplication(app.id);
    }
  }

  return (
    <Container>
      <ScrollView style={styles.scrollView}>
        <View style={styles.page}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{t("applications.back")}</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>{t("applications.title")}</Text>

          {/* Suche */}
          <TextInput
            style={styles.searchInput}
            placeholder={t("applications.search")}
            placeholderTextColor="#98A2B3"
            value={search}
            onChangeText={(v) => setSearch(v)}
          />

          {/* Haupt-Tabs */}
          <View style={styles.mainTabRow}>
            <TouchableOpacity
              style={[
                styles.mainTab,
                mainTab === "mentors" ? styles.mainTabActive : styles.mainTabInactive,
              ]}
              onPress={() => setMainTab("mentors")}
            >
              <Text
                style={mainTab === "mentors" ? styles.mainTabTextActive : styles.mainTabTextInactive}
              >
                {t("applications.mentorTab")}
              </Text>
              {pendingMentorCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingMentorCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.mainTab,
                mainTab === "mentees" ? styles.mainTabActive : styles.mainTabInactive,
              ]}
              onPress={() => setMainTab("mentees")}
            >
              <Text
                style={mainTab === "mentees" ? styles.mainTabTextActive : styles.mainTabTextInactive}
              >
                {t("applications.menteeTab")}
              </Text>
              {pendingMenteeCount > 0 && (
                <View style={styles.tabBadge}>
                  <Text style={styles.tabBadgeText}>{pendingMenteeCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>

          {/* ─── Mentor-Bewerbungen ─── */}
          {mainTab === "mentors" && (
            <>
              <Text style={styles.pageSubtitle}>
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
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.filterChip,
                        mentorFilter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
                      ]}
                      onPress={() => setMentorFilter(tab.key)}
                    >
                      <Text
                        style={
                          mentorFilter === tab.key
                            ? styles.filterChipTextActive
                            : styles.filterChipTextInactive
                        }
                      >
                        {tab.label} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredMentorApps.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {mentorFilter === "pending"
                      ? t("applications.noOpen")
                      : mentorFilter === "approved"
                      ? t("applications.noApproved")
                      : t("applications.noRejected")}
                  </Text>
                </View>
              ) : (
                filteredMentorApps.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    type="mentor"
                    onApprove={() => handleApproveMentor(app)}
                    onReject={() => handleRejectMentor(app)}
                  />
                ))
              )}
            </>
          )}

          {/* ─── Mentee-Anmeldungen ─── */}
          {mainTab === "mentees" && (
            <>
              <Text style={styles.pageSubtitle}>
                {t("applications.pendingMentee")
                  .replace("{0}", String(pendingMenteeCount))
                  .replace("{1}", pendingMenteeCount !== 1 ? "en" : "")}
              </Text>

              <View style={styles.infoBox}>
                <Text style={styles.infoBoxText}>
                  {t("applications.infoBox")}
                </Text>
              </View>

              <View style={styles.filterRow}>
                {(
                  [
                    { key: "pending", label: t("applications.filterOpen") },
                    { key: "approved", label: t("applications.filterApproved") },
                    { key: "rejected", label: t("applications.filterRejected") },
                  ] as const
                ).map((tab) => {
                  const count = menteeApps.filter((a) => a.status === tab.key).length;
                  return (
                    <TouchableOpacity
                      key={tab.key}
                      style={[
                        styles.filterChip,
                        menteeFilter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
                      ]}
                      onPress={() => setMenteeFilter(tab.key)}
                    >
                      <Text
                        style={
                          menteeFilter === tab.key
                            ? styles.filterChipTextActive
                            : styles.filterChipTextInactive
                        }
                      >
                        {tab.label} ({count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {filteredMenteeApps.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyText}>
                    {menteeFilter === "pending"
                      ? t("applications.noOpenMentee")
                      : menteeFilter === "approved"
                      ? t("applications.noApprovedMentee")
                      : t("applications.noRejectedMentee")}
                  </Text>
                </View>
              ) : (
                filteredMenteeApps.map((app) => (
                  <ApplicationCard
                    key={app.id}
                    application={app}
                    type="mentee"
                    onApprove={() => handleAcceptMenteeRegistration(app)}
                    onReject={() => handleRejectMenteeRegistration(app)}
                  />
                ))
              )}
            </>
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

function ApplicationCard({
  application,
  type,
  onApprove,
  onReject,
}: {
  application: MentorApplication;
  type: "mentor" | "mentee";
  onApprove: () => void;
  onReject: () => void;
}) {
  const { t } = useLanguage();
  const isPending = application.status === "pending";
  const isApproved = application.status === "approved";

  const statusBg = isPending ? "#fef3c7" : isApproved ? "#dcfce7" : "#fee2e2";
  const statusColor = isPending ? "#b45309" : isApproved ? "#15803d" : "#b91c1c";
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

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.applicantName}>{application.name}</Text>
          <Text style={styles.applicantSub}>
            {application.city} · {genderLabel} · {application.age} Jahre
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Kontakt-Info */}
      <View style={styles.infoSection}>
        <InfoLine label={t("applications.emailLabel")} value={application.email} />
        {application.phone ? <InfoLine label={t("applications.phoneLabel")} value={application.phone} /> : null}
        <InfoLine
          label={t("applications.contactLabel")}
          value={contactLabels[application.contact_preference] ?? application.contact_preference}
        />
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
          {application.experience ? (
            <View style={styles.textSection}>
              <Text style={styles.textSectionLabel}>{t("applications.experience")}</Text>
              <Text style={styles.textSectionContent}>{application.experience}</Text>
            </View>
          ) : null}
          <View style={styles.textSection}>
            <Text style={styles.textSectionLabel}>{t("applications.motivation")}</Text>
            <Text style={styles.textSectionContent}>{application.motivation}</Text>
          </View>
        </>
      )}

      {/* Aktions-Buttons (nur für offene Einträge) */}
      {isPending && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
            <Text style={styles.rejectButtonText}>{t("applications.reject")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.approveButton, { backgroundColor: approveColor }]}
            onPress={onApprove}
          >
            <Text style={styles.approveButtonText}>{approveLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoLine}>
      <Text style={styles.infoLineLabel}>{label}</Text>
      <Text style={styles.infoLineValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  accessDeniedText: { color: COLORS.primary, fontWeight: "600" },
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  backButton: { marginBottom: 16 },
  backButtonText: { color: COLORS.link, fontSize: 14 },
  pageTitle: { fontSize: 22, fontWeight: "bold", color: COLORS.primary, marginBottom: 12 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 16, fontSize: 13 },

  mainTabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  mainTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  mainTabActive: {
    backgroundColor: COLORS.gradientStart,
    borderColor: COLORS.gradientStart,
  },
  mainTabInactive: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.border,
  },
  mainTabTextActive: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 13,
  },
  mainTabTextInactive: {
    color: COLORS.secondary,
    fontSize: 13,
  },
  tabBadge: {
    backgroundColor: COLORS.error,
    borderRadius: 9999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tabBadgeText: { color: COLORS.white, fontSize: 10, fontWeight: "700" },

  searchInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
    fontSize: 14,
    marginBottom: 12,
  },
  filterRow: { flexDirection: "row", gap: 8, marginBottom: 16, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 9999, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  filterChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  filterChipTextInactive: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },

  infoBox: {
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: "#dbeafe",
    borderRadius: 6,
    padding: 12,
    marginBottom: 12,
  },
  infoBoxText: { color: "#1e40af", fontSize: 12, lineHeight: 18 },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    alignItems: "center",
  },
  emptyText: { color: COLORS.tertiary, fontSize: 14, textAlign: "center" },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  applicantName: { fontWeight: "bold", color: COLORS.primary, fontSize: 16 },
  applicantSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 12, fontWeight: "600" },

  infoSection: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    gap: 5,
  },
  infoLine: { flexDirection: "row", justifyContent: "space-between" },
  infoLineLabel: { color: COLORS.tertiary, fontSize: 13 },
  infoLineValue: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },

  textSection: { marginBottom: 10 },
  textSectionLabel: {
    color: COLORS.tertiary,
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  textSectionContent: { color: COLORS.secondary, fontSize: 13, lineHeight: 19 },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  rejectButton: {
    flex: 1,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 13 },
  approveButton: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveButtonText: { color: COLORS.white, fontWeight: "bold", fontSize: 13 },
});
