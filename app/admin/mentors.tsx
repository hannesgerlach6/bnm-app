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

export default function AdminMentorsScreen() {
  const router = useRouter();
  const { t } = useLanguage();
  const { user } = useAuth();
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
      <View style={styles.center}>
        <Text style={styles.accessDenied}>{t("applications.accessDenied")}</Text>
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
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        {/* Header */}
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.pageTitle}>{t("adminMentors.title")}</Text>
            <Text style={styles.pageSubtitle}>
              {filtered.length} {t("adminMentors.mentors")}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.csvButton}
            onPress={() => router.push("/admin/csv-import")}
          >
            <Text style={styles.csvButtonText}>{t("csvImport.tabMentors")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.csvButton} onPress={handleExportCsv}>
            <Text style={styles.csvButtonText}>{t("csv.export")}</Text>
          </TouchableOpacity>
        </View>

        {/* Suchfeld */}
        <TextInput
          style={styles.searchInput}
          placeholder={t("adminMentors.search")}
          placeholderTextColor={COLORS.tertiary}
          value={search}
          onChangeText={setSearch}
        />

        {/* Mentor-Liste */}
        {isLoading ? (
          <SkeletonList count={4} />
        ) : filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("adminMentors.noMentors")}</Text>
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
                style={styles.mentorCard}
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
                      <Text style={styles.mentorName}>{mentor.name}</Text>
                      {mentor.is_active === false && (
                        <View style={styles.blockedBadge}>
                          <Text style={styles.blockedBadgeText}>{t("editUser.blocked")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.mentorMeta}>
                      {mentor.city} · {mentor.age} J. · {mentor.gender === "male" ? t("dashboard.brother") : t("dashboard.sister")}
                    </Text>
                  </View>
                  <Text style={styles.arrow}>›</Text>
                </View>

                {/* Stats-Zeile */}
                <View style={styles.statsRow}>
                  <View style={styles.statChip}>
                    <Text style={[styles.statChipValue, { color: COLORS.gradientStart }]}>{active}</Text>
                    <Text style={styles.statChipLabel}>{t("adminMentors.activeMentorships")}</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={[styles.statChipValue, { color: COLORS.cta }]}>{completed}</Text>
                    <Text style={styles.statChipLabel}>{t("adminMentors.completedMentorships")}</Text>
                  </View>
                  <View style={styles.statChip}>
                    <Text style={[styles.statChipValue, { color: COLORS.gold }]}>{totalSessions}</Text>
                    <Text style={styles.statChipLabel}>{t("common.sessions")}</Text>
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
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { color: COLORS.error, textAlign: "center" },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 24, color: COLORS.primary, fontWeight: "300" },
  pageTitle: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  pageSubtitle: { color: COLORS.secondary, fontSize: 13 },
  searchInput: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.primary,
    marginBottom: 16,
  },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
  },
  emptyText: { color: COLORS.tertiary, fontSize: 14 },
  mentorCard: {
    backgroundColor: COLORS.white,
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
  mentorName: { fontWeight: "700", color: COLORS.primary, fontSize: 15 },
  mentorMeta: { color: COLORS.tertiary, fontSize: 12, marginTop: 2 },
  arrow: { color: COLORS.tertiary, fontSize: 20 },
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderRadius: 6,
    padding: 8,
    alignItems: "center",
  },
  statChipValue: { fontSize: 18, fontWeight: "700" },
  statChipLabel: { color: COLORS.tertiary, fontSize: 10, marginTop: 2, textAlign: "center" },
  csvButton: {
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  csvButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  blockedBadge: {
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  blockedBadgeText: { color: "#b91c1c", fontSize: 10, fontWeight: "600" },
});
