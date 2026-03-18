import React from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import type { UserRole } from "../../types";
import { COLORS } from "../../constants/Colors";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  mentor: "Mentor",
  mentee: "Mentee (Neuer Muslim)",
};

const CONTACT_LABELS: Record<string, string> = {
  whatsapp: "WhatsApp",
  phone: "Telefon",
  telegram: "Telegram",
  email: "E-Mail",
};

export default function ProfileScreen() {
  const { user, logout } = useAuth();

  if (!user) return null;

  function handleLogout() {
    Alert.alert("Abmelden", "Möchtest du dich wirklich abmelden?", [
      { text: "Abbrechen", style: "cancel" },
      { text: "Abmelden", style: "destructive", onPress: logout },
    ]);
  }

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const roleBgColor =
    user.role === "admin"
      ? "#f3e8ff"
      : user.role === "mentor"
      ? "#dbeafe"
      : "#dcfce7";

  const roleTextColor =
    user.role === "admin"
      ? "#7e22ce"
      : user.role === "mentor"
      ? "#1d4ed8"
      : "#15803d";

  return (
    <ScrollView style={styles.scrollView}>
      <View style={styles.page}>
        <Text style={styles.pageTitle}>Profil</Text>

        {/* Avatar + Name Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.userName}>{user.name}</Text>

          {/* Rollen-Badge */}
          <View style={[styles.roleBadge, { backgroundColor: roleBgColor }]}>
            <Text style={[styles.roleBadgeText, { color: roleTextColor }]}>
              {ROLE_LABELS[user.role]}
            </Text>
          </View>

          {/* Geschlecht-Badge */}
          <View style={styles.genderBadge}>
            <Text style={styles.genderText}>
              {user.gender === "male" ? "Bruder" : "Schwester"}
            </Text>
          </View>
        </View>

        {/* Persönliche Infos */}
        <View style={styles.infoCard}>
          <Text style={styles.sectionLabel}>{"PERSÖNLICHE INFORMATIONEN"}</Text>

          <InfoRow label="E-Mail" value={user.email} />
          <InfoRow label="Stadt" value={user.city} />
          <InfoRow label="Alter" value={`${user.age} Jahre`} />
          {user.phone && <InfoRow label="Telefon" value={user.phone} />}
          <InfoRow
            label="Kontakt"
            value={CONTACT_LABELS[user.contact_preference] ?? user.contact_preference}
            isLast
          />
        </View>

        {/* Konto-Aktionen */}
        <View style={[styles.infoCard, { padding: 0, overflow: "hidden" }]}>
          <Text style={[styles.sectionLabel, { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }]}>
            {"KONTO"}
          </Text>
          <TouchableOpacity style={styles.menuItem}>
            <Text style={styles.menuItemText}>Profil bearbeiten</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.menuItem, { borderBottomWidth: 0 }]}>
            <Text style={styles.menuItemText}>Passwort ändern</Text>
            <Text style={styles.menuArrow}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Logout */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Abmelden</Text>
        </TouchableOpacity>

        {/* App-Info */}
        <Text style={styles.appInfo}>BNM App · Betreuung neuer Muslime</Text>
      </View>
    </ScrollView>
  );
}

function InfoRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View
      style={[
        styles.infoRow,
        isLast ? {} : { borderBottomWidth: 1, borderBottomColor: COLORS.border },
      ]}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 24 },
  pageTitle: { fontSize: 24, fontWeight: "bold", color: COLORS.primary, marginBottom: 24 },
  avatarCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 9999,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  avatarText: { color: COLORS.white, fontSize: 24, fontWeight: "bold" },
  userName: { fontSize: 20, fontWeight: "bold", color: COLORS.primary, marginBottom: 4 },
  roleBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 9999 },
  roleBadgeText: { fontSize: 12, fontWeight: "600" },
  genderBadge: { marginTop: 8 },
  genderText: { color: COLORS.tertiary, fontSize: 12 },
  infoCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 1,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  infoLabel: { color: COLORS.secondary, fontSize: 14 },
  infoValue: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "500",
    maxWidth: "60%",
    textAlign: "right",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  menuItemText: { color: COLORS.primary },
  menuArrow: { color: COLORS.tertiary },
  logoutButton: {
    backgroundColor: "#fef2f2",
    borderWidth: 1,
    borderColor: "#fecaca",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 16,
  },
  logoutText: { color: "#dc2626", fontWeight: "600" },
  appInfo: { color: COLORS.tertiary, fontSize: 12, textAlign: "center" },
});
