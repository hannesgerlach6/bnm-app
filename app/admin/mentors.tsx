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
} from "react-native";
import { useRouter } from "expo-router";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { COLORS } from "../../constants/Colors";
import { useAuth } from "../../contexts/AuthContext";
import { showError, showSuccess } from "../../lib/errorHandler";
import { SkeletonList } from "../../components/Skeleton";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function AdminMentorsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const { users, mentorships, sessions, refreshData, isLoading } = useData();
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  };

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
      const header = "Name,E-Mail,Stadt,Alter,Geschlecht,Aktive Betreuungen,Abgeschlossene";
      const rows = allMentors.map((mentor) => {
        const myMentorships = mentorships.filter((m) => m.mentor_id === mentor.id);
        const active = myMentorships.filter((m) => m.status === "active").length;
        const completed = myMentorships.filter((m) => m.status === "completed").length;
        const gender = mentor.gender === "male" ? "Bruder" : "Schwester";
        return `"${mentor.name}","${mentor.email}","${mentor.city}",${mentor.age},"${gender}",${active},${completed}`;
      }).join("\n");
      const csvContent = `${header}\n${rows}`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BNM-Mentoren-${new Date().toISOString().split("T")[0]}.csv`;
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
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={[styles.backBtnText, { color: themeColors.text }]}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("adminMentors.title")}</Text>
            <Text style={[styles.pageSubtitle, { color: themeColors.textSecondary }]}>
              {filtered.length} {t("adminMentors.mentors")}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.csvButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
            onPress={() => router.push("/admin/csv-import")}
          >
            <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csvImport.tabMentors")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.csvButton, { backgroundColor: themeColors.background, borderColor: themeColors.border }]} onPress={handleExportCsv}>
            <Text style={[styles.csvButtonText, { color: themeColors.text }]}>{t("csv.export")}</Text>
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

            const initials = mentor.name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <TouchableOpacity
                key={mentor.id}
                style={[styles.mentorCard, { backgroundColor: themeColors.card }]}
                onPress={() =>
                  router.push({ pathname: "/mentor/[id]", params: { id: mentor.id } })
                }
              >
                <View style={styles.cardRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={[styles.mentorName, { color: themeColors.text }]}>{mentor.name}</Text>
                      {mentor.is_active === false && (
                        <View style={styles.blockedBadge}>
                          <Text style={styles.blockedBadgeText}>{t("editUser.blocked")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={[styles.mentorMeta, { color: themeColors.textTertiary }]}>
                      {mentor.city} · {mentor.age} J. · {mentor.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
                    </Text>
                  </View>
                  <Text style={[styles.arrow, { color: themeColors.textTertiary }]}>›</Text>
                </View>

                {/* Stats-Zeile */}
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
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 24, fontWeight: "300" },
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
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  blockedBadgeText: { color: "#b91c1c", fontSize: 10, fontWeight: "600" },
});
