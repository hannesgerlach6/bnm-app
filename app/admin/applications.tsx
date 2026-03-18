import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import type { MentorApplication } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";

export default function ApplicationsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const { applications, approveApplication, rejectApplication } = useData();
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");

  if (user?.role !== "admin") {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.accessDeniedText}>Nur für Admins zugänglich.</Text>
      </View>
    );
  }

  const filtered = applications.filter((a) => a.status === filter);
  const pendingCount = applications.filter((a) => a.status === "pending").length;

  function handleApprove(app: MentorApplication) {
    Alert.alert(
      "Bewerbung annehmen",
      `${app.name} wird als Mentor hinzugefügt. Fortfahren?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Annehmen",
          style: "default",
          onPress: () => {
            approveApplication(app.id);
            Alert.alert("Erfolgreich", `${app.name} wurde als Mentor hinzugefügt.`);
          },
        },
      ]
    );
  }

  function handleReject(app: MentorApplication) {
    Alert.alert(
      "Bewerbung ablehnen",
      `Die Bewerbung von ${app.name} wird abgelehnt. Fortfahren?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Ablehnen",
          style: "destructive",
          onPress: () => {
            rejectApplication(app.id);
          },
        },
      ]
    );
  }

  return (
    <Container>
      <ScrollView style={styles.scrollView}>
        <View style={styles.page}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>← Zurück</Text>
          </TouchableOpacity>

          <Text style={styles.pageTitle}>Mentor-Bewerbungen</Text>
          <Text style={styles.pageSubtitle}>
            {pendingCount} offene Bewerbung{pendingCount !== 1 ? "en" : ""}
          </Text>

          {/* Filter-Tabs */}
          <View style={styles.filterRow}>
            {(
              [
                { key: "pending", label: "Offen" },
                { key: "approved", label: "Angenommen" },
                { key: "rejected", label: "Abgelehnt" },
              ] as const
            ).map((tab) => {
              const count = applications.filter((a) => a.status === tab.key).length;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.filterChip,
                    filter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
                  ]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text
                    style={
                      filter === tab.key
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

          {/* Bewerbungsliste */}
          {filtered.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                Keine {filter === "pending" ? "offenen" : filter === "approved" ? "angenommenen" : "abgelehnten"} Bewerbungen.
              </Text>
            </View>
          ) : (
            filtered.map((app) => (
              <ApplicationCard
                key={app.id}
                application={app}
                onApprove={() => handleApprove(app)}
                onReject={() => handleReject(app)}
              />
            ))
          )}
        </View>
      </ScrollView>
    </Container>
  );
}

function ApplicationCard({
  application,
  onApprove,
  onReject,
}: {
  application: MentorApplication;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isPending = application.status === "pending";
  const isApproved = application.status === "approved";

  const statusBg = isPending ? "#fef3c7" : isApproved ? "#dcfce7" : "#fee2e2";
  const statusColor = isPending ? "#b45309" : isApproved ? "#15803d" : "#b91c1c";
  const statusLabel = isPending ? "Offen" : isApproved ? "Angenommen" : "Abgelehnt";

  const genderLabel = application.gender === "male" ? "Bruder" : "Schwester";

  const contactLabels: Record<string, string> = {
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-Mail",
    telegram: "Telegram",
  };

  return (
    <View style={styles.card}>
      {/* Header */}
      <View style={styles.cardHeader}>
        <View>
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
        <InfoLine label="E-Mail" value={application.email} />
        {application.phone && <InfoLine label="Telefon" value={application.phone} />}
        <InfoLine label="Kontakt" value={contactLabels[application.contact_preference] ?? application.contact_preference} />
        <InfoLine
          label="Eingegangen"
          value={new Date(application.submitted_at).toLocaleDateString("de-DE", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        />
      </View>

      {/* Erfahrung */}
      <View style={styles.textSection}>
        <Text style={styles.textSectionLabel}>Erfahrung</Text>
        <Text style={styles.textSectionContent}>{application.experience}</Text>
      </View>

      {/* Motivation */}
      <View style={styles.textSection}>
        <Text style={styles.textSectionLabel}>Motivation</Text>
        <Text style={styles.textSectionContent}>{application.motivation}</Text>
      </View>

      {/* Aktions-Buttons (nur für offene Bewerbungen) */}
      {isPending && (
        <View style={styles.actionRow}>
          <TouchableOpacity style={styles.rejectButton} onPress={onReject}>
            <Text style={styles.rejectButtonText}>Ablehnen</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.approveButton} onPress={onApprove}>
            <Text style={styles.approveButtonText}>Annehmen</Text>
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
  page: { padding: 24 },
  backButton: { marginBottom: 16 },
  backButtonText: { color: COLORS.link, fontSize: 14 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  pageSubtitle: { color: COLORS.secondary, marginBottom: 24 },

  filterRow: { flexDirection: "row", gap: 8, marginBottom: 24, flexWrap: "wrap" },
  filterChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterChipInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  filterChipTextActive: { color: COLORS.white, fontSize: 13, fontWeight: "500" },
  filterChipTextInactive: { color: COLORS.secondary, fontSize: 13, fontWeight: "500" },

  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 32,
    alignItems: "center",
  },
  emptyText: { color: COLORS.tertiary, fontSize: 14, textAlign: "center" },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  applicantName: { fontWeight: "bold", color: COLORS.primary, fontSize: 17 },
  applicantSub: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 12, fontWeight: "600" },

  infoSection: {
    backgroundColor: COLORS.bg,
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    gap: 6,
  },
  infoLine: { flexDirection: "row", justifyContent: "space-between" },
  infoLineLabel: { color: COLORS.tertiary, fontSize: 13 },
  infoLineValue: { color: COLORS.primary, fontSize: 13, fontWeight: "500", maxWidth: "60%", textAlign: "right" },

  textSection: { marginBottom: 12 },
  textSectionLabel: { color: COLORS.tertiary, fontSize: 12, fontWeight: "600", marginBottom: 4, letterSpacing: 0.5 },
  textSectionContent: { color: COLORS.secondary, fontSize: 14, lineHeight: 20 },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 4 },
  rejectButton: {
    flex: 1,
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  rejectButtonText: { color: "#dc2626", fontWeight: "600", fontSize: 14 },
  approveButton: {
    flex: 1,
    backgroundColor: COLORS.cta,
    borderRadius: 5,
    paddingVertical: 9,
    alignItems: "center",
  },
  approveButtonText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
});
