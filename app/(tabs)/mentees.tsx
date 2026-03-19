import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  RefreshControl,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import type { Mentorship } from "../../types";
import { COLORS } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { showError, showSuccess } from "../../lib/errorHandler";
import { SkeletonList } from "../../components/Skeleton";

export default function MenteesScreen() {
  const { user } = useAuth();
  if (!user) return null;

  if (user.role === "admin" || user.role === "office") return <Container><AdminMenteesView /></Container>;
  if (user.role === "mentor") return <Container><MentorMenteesView /></Container>;
  return <Container><MenteeProgressView /></Container>;
}

type AssignmentFilter = "all" | "assigned" | "unassigned";
type StatusFilter = "all" | "active" | "completed" | "cancelled";
type GenderFilter = "all" | "male" | "female";
type SortKey = "name" | "city" | "progress";

function AdminMenteesView() {
  const router = useRouter();
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [assignFilter, setAssignFilter] = useState<AssignmentFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [genderFilter, setGenderFilter] = useState<GenderFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [refreshing, setRefreshing] = useState(false);
  const { users, mentorships, sessionTypes, getCompletedStepIds, refreshData, isLoading } = useData();
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const allMentees = users.filter((u) => u.role === "mentee");

  function handleExportCsv() {
    try {
      const header = "Name,E-Mail,Stadt,Alter,Geschlecht,Status,Mentor,Fortschritt";
      const rows = allMentees.map((mentee) => {
        const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
        const status = mentorship
          ? mentorship.status === "active" ? "Aktiv"
          : mentorship.status === "completed" ? "Abgeschlossen"
          : "Abgebrochen"
          : "Offen";
        const mentorName = mentorship?.mentor?.name ?? "";
        const completedSteps = mentorship ? getCompletedStepIds(mentorship.id).length : 0;
        const progress = sessionTypes.length > 0
          ? `${completedSteps}/${sessionTypes.length}`
          : "0/0";
        const gender = mentee.gender === "male" ? "Bruder" : "Schwester";
        return `"${mentee.name}","${mentee.email}","${mentee.city}",${mentee.age},"${gender}","${status}","${mentorName}","${progress}"`;
      }).join("\n");
      const csvContent = `${header}\n${rows}`;

      if (Platform.OS === "web") {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `BNM-Mentees-${new Date().toISOString().split("T")[0]}.csv`;
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

  const filteredMentees = allMentees
    .filter((mentee) => {
      const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
      const matchesSearch =
        mentee.name.toLowerCase().includes(search.toLowerCase()) ||
        mentee.city.toLowerCase().includes(search.toLowerCase());
      const matchesAssign =
        assignFilter === "all"
          ? true
          : assignFilter === "assigned"
          ? !!mentorship
          : !mentorship;
      const matchesStatus =
        statusFilter === "all"
          ? true
          : mentorship
          ? mentorship.status === statusFilter
          : false;
      const matchesGender =
        genderFilter === "all" ? true : mentee.gender === genderFilter;
      return matchesSearch && matchesAssign && matchesStatus && matchesGender;
    })
    .sort((a, b) => {
      if (sortKey === "name") return a.name.localeCompare(b.name);
      if (sortKey === "city") return a.city.localeCompare(b.city);
      if (sortKey === "progress") {
        const mA = mentorships.find((m) => m.mentee_id === a.id);
        const mB = mentorships.find((m) => m.mentee_id === b.id);
        const progA = mA ? getCompletedStepIds(mA.id).length : 0;
        const progB = mB ? getCompletedStepIds(mB.id).length : 0;
        return progB - progA;
      }
      return 0;
    });

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <View style={styles.titleRow}>
          <View>
            <Text style={styles.pageTitle}>{t("mentees.allMentees")}</Text>
            <Text style={styles.pageSubtitle}>{allMentees.length} {t("mentees.registered")}</Text>
          </View>
          <View style={{ flexDirection: "row", gap: 6 }}>
            <TouchableOpacity
              style={styles.csvButton}
              onPress={() => router.push("/admin/csv-import")}
            >
              <Text style={styles.csvButtonText}>{t("csvImport.title")}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.csvButton} onPress={handleExportCsv}>
              <Text style={styles.csvButtonText}>{t("csv.export")}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Suche */}
        <TextInput
          style={styles.searchInput}
          placeholder={t("mentees.search")}
          placeholderTextColor="#98A2B3"
          value={search}
          onChangeText={setSearch}
        />

        {/* Filter: Zuweisung */}
        <Text style={styles.filterGroupLabel}>{t("mentees.filterAssignment")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "assigned", label: t("mentees.assigned") },
              { key: "unassigned", label: t("mentees.unassigned") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                assignFilter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setAssignFilter(tab.key)}
            >
              <Text
                style={
                  assignFilter === tab.key ? styles.filterChipTextActive : styles.filterChipTextInactive
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter: Status */}
        <Text style={styles.filterGroupLabel}>{t("mentees.filterStatus")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "active", label: t("mentees.active") },
              { key: "completed", label: t("mentees.completedStatus") },
              { key: "cancelled", label: t("mentees.cancelled") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                statusFilter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setStatusFilter(tab.key)}
            >
              <Text
                style={
                  statusFilter === tab.key ? styles.filterChipTextActive : styles.filterChipTextInactive
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Filter: Geschlecht */}
        <Text style={styles.filterGroupLabel}>{t("mentees.filterGender")}</Text>
        <View style={styles.filterRow}>
          {(
            [
              { key: "all", label: t("mentees.all") },
              { key: "male", label: t("mentees.brothers") },
              { key: "female", label: t("mentees.sisters") },
            ] as const
          ).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.filterChip,
                genderFilter === tab.key ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setGenderFilter(tab.key)}
            >
              <Text
                style={
                  genderFilter === tab.key ? styles.filterChipTextActive : styles.filterChipTextInactive
                }
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sortierung */}
        <Text style={styles.filterGroupLabel}>{t("mentees.filterSort")}</Text>
        <View style={[styles.filterRow, { marginBottom: 24 }]}>
          {(
            [
              { key: "name", label: t("mentees.sortName") },
              { key: "city", label: t("mentees.sortCity") },
              { key: "progress", label: t("mentees.sortProgress") },
            ] as const
          ).map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.filterChip,
                sortKey === opt.key ? styles.filterChipActive : styles.filterChipInactive,
              ]}
              onPress={() => setSortKey(opt.key)}
            >
              <Text
                style={
                  sortKey === opt.key ? styles.filterChipTextActive : styles.filterChipTextInactive
                }
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Mentee-Liste */}
        {isLoading ? (
          <SkeletonList count={5} />
        ) : filteredMentees.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>{t("mentees.noResults")}</Text>
          </View>
        ) : (
          filteredMentees.map((mentee) => {
            const mentorship = mentorships.find((m) => m.mentee_id === mentee.id);
            const completedSteps = mentorship ? getCompletedStepIds(mentorship.id) : [];
            const progress = mentorship
              ? Math.round((completedSteps.length / sessionTypes.length) * 100)
              : 0;

            const statusBg =
              mentorship
                ? mentorship.status === "active"
                  ? "#dcfce7"
                  : mentorship.status === "completed"
                  ? "#dbeafe"
                  : "#fee2e2"
                : "#fef3c7";
            const statusColor =
              mentorship
                ? mentorship.status === "active"
                  ? "#15803d"
                  : mentorship.status === "completed"
                  ? "#1d4ed8"
                  : "#b91c1c"
                : "#b45309";
            const statusLabel =
              mentorship
                ? mentorship.status === "active"
                  ? t("mentees.active")
                  : mentorship.status === "completed"
                  ? t("mentees.completedStatus")
                  : t("mentees.cancelled")
                : t("mentees.unassigned");

            return (
              <TouchableOpacity
                key={mentee.id}
                style={[
                  styles.menteeCard,
                  mentorship ? styles.menteeCardAssigned : styles.menteeCardUnassigned,
                ]}
                onPress={() =>
                  router.push({ pathname: "/mentee/[id]", params: { id: mentee.id } })
                }
              >
                <View style={styles.menteeCardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                      <Text style={styles.meneeName}>{mentee.name}</Text>
                      {mentee.is_active === false && (
                        <View style={styles.blockedBadge}>
                          <Text style={styles.blockedBadgeText}>{t("editUser.blocked")}</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.menteeSubText}>
                      {mentee.city} · {mentee.age} J. ·{" "}
                      {mentee.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                  </View>
                </View>

                {mentorship ? (
                  <>
                    <Text style={styles.mentorLabel}>{t("mentees.mentor")}: {mentorship.mentor?.name}</Text>
                    <View style={styles.progressRow}>
                      <View style={styles.progressTrack}>
                        <View
                          style={[styles.progressFill, { width: `${progress}%` as any }]}
                        />
                      </View>
                      <Text style={styles.progressText}>
                        {completedSteps.length}/{sessionTypes.length}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.viewChatButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        router.push({ pathname: "/chat/[mentorshipId]", params: { mentorshipId: mentorship.id } });
                      }}
                    >
                      <Text style={styles.viewChatButtonText}>{t("admin.viewChat")}</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <TouchableOpacity
                    style={styles.assignButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push({ pathname: "/assign", params: { menteeId: mentee.id } });
                    }}
                  >
                    <Text style={styles.assignButtonText}>{t("mentees.assignMentor")}</Text>
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}

function MentorMenteesView() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { getMentorshipsByMentorId, refreshData } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!user) return null;

  const myMentorships = getMentorshipsByMentorId(user.id);

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <Text style={styles.pageTitle}>{t("mentees.myMentees")}</Text>
        <Text style={styles.pageSubtitle}>
          {myMentorships.filter((m) => m.status === "active").length} {t("mentees.activeMentorships")}
        </Text>

        {/* Mentor kann selbst Mentee übernehmen */}
        <TouchableOpacity
          style={styles.selfAssignButton}
          onPress={() => router.push("/assign")}
        >
          <Text style={styles.selfAssignText}>{t("mentees.takeMentee")}</Text>
        </TouchableOpacity>

        {myMentorships.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🤝</Text>
            <Text style={[styles.meneeName, { textAlign: "center", marginBottom: 8 }]}>
              {t("mentees.noMenteesYet")}
            </Text>
            <Text style={[styles.emptyText, { marginTop: 0, marginBottom: 12 }]}>
              {t("mentees.noMenteesText")}
            </Text>
            <TouchableOpacity
              style={{ backgroundColor: COLORS.gradientStart, borderRadius: 5, paddingVertical: 9, paddingHorizontal: 20 }}
              onPress={() => router.push("/assign")}
            >
              <Text style={{ color: COLORS.white, fontWeight: "600", fontSize: 14 }}>
                {t("mentees.takeMenteeButton")}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          myMentorships.map((mentorship) => (
            <MentorMenteeCard key={mentorship.id} mentorship={mentorship} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function MentorMenteeCard({ mentorship }: { mentorship: Mentorship }) {
  const router = useRouter();
  const { t } = useLanguage();
  const { getCompletedStepIds, getSessionsByMentorshipId, sessionTypes } = useData();

  const completedStepIds = getCompletedStepIds(mentorship.id);
  const sessions = getSessionsByMentorshipId(mentorship.id);
  const progress = Math.round((completedStepIds.length / sessionTypes.length) * 100);
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <TouchableOpacity
      style={[
        styles.menteeCard,
        mentorship.status === "active" ? styles.menteeCardAssigned : styles.menteeCardUnassigned,
      ]}
      onPress={() =>
        router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
      }
    >
      {/* Mentee-Header */}
      <View style={styles.menteeCardHeader}>
        <View>
          <Text style={styles.meneeName}>{mentorship.mentee?.name}</Text>
          <Text style={styles.menteeSubText}>
            {mentorship.mentee?.city} · {mentorship.mentee?.age} J. ·{" "}
            {mentorship.mentee?.gender === "male" ? t("mentees.brother") : t("mentees.sister")}
          </Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: mentorship.status === "active" ? "#dcfce7" : "#f3f4f6" },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              { color: mentorship.status === "active" ? "#15803d" : "#4b5563" },
            ]}
          >
            {mentorship.status === "active" ? t("mentees.active") : t("mentees.completedStatus")}
          </Text>
        </View>
      </View>

      {/* Fortschrittsbalken */}
      <View style={styles.progressRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
        </View>
        <Text style={styles.progressText}>
          {completedStepIds.length}/{sessionTypes.length} {t("mentees.steps")}
        </Text>
      </View>

      {/* Step-Liste */}
      <Text style={styles.stepSectionLabel}>{t("mentees.progress")}</Text>
      <View style={styles.stepChipRow}>
        {sortedTypes.map((step, idx) => {
          const isDone = completedStepIds.includes(step.id);
          const isCurrent = !isDone && idx === completedStepIds.length;
          const chipBg = isDone ? "#dcfce7" : isCurrent ? "#fef3c7" : COLORS.bg;
          const chipColor = isDone ? "#15803d" : isCurrent ? "#b45309" : COLORS.tertiary;
          const chipWeight: "normal" | "500" = isDone || isCurrent ? "500" : "normal";
          return (
            <View key={step.id} style={[styles.stepChip, { backgroundColor: chipBg }]}>
              <Text style={[styles.stepChipText, { color: chipColor, fontWeight: chipWeight }]}>
                {idx + 1}. {step.name}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Session-Anzahl + Aktionen */}
      <View style={styles.cardFooter}>
        <Text style={styles.sessionCount}>
          {sessions.length} Session{sessions.length !== 1 ? "s" : ""} {t("mentees.documented")}
        </Text>
        {mentorship.status === "active" && (
          <TouchableOpacity
            style={styles.docChipButton}
            onPress={(e) => {
              e.stopPropagation();
              router.push({
                pathname: "/document-session",
                params: { mentorshipId: mentorship.id },
              });
            }}
          >
            <Text style={styles.docChipText}>{t("sessions.document")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function MenteeProgressView() {
  const { user } = useAuth();
  const router = useRouter();
  const { t } = useLanguage();
  const {
    getMentorshipByMenteeId,
    getCompletedStepIds,
    getSessionsByMentorshipId,
    sessionTypes,
    refreshData,
  } = useData();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  if (!user) return null;

  const mentorship = getMentorshipByMenteeId(user.id);
  const completedStepIds = mentorship ? getCompletedStepIds(mentorship.id) : [];
  const sessions = mentorship ? getSessionsByMentorshipId(mentorship.id) : [];
  const sortedTypes = [...sessionTypes].sort((a, b) => a.sort_order - b.sort_order);

  if (!mentorship) {
    return (
      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
      >
        <View style={styles.page}>
          <Text style={styles.pageTitle}>{t("mentees.myProgress")}</Text>
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 36, marginBottom: 12 }}>🌱</Text>
            <Text style={[styles.meneeName, { textAlign: "center", marginBottom: 8 }]}>
              {t("mentees.noAssignmentYet")}
            </Text>
            <Text style={[styles.emptyText, { marginTop: 0 }]}>
              {t("mentees.noAssignmentText")}
            </Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  const totalProgress = Math.round((completedStepIds.length / sessionTypes.length) * 100);

  return (
    <ScrollView
      style={styles.scrollView}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.gold} />}
    >
      <View style={styles.page}>
        <Text style={styles.pageTitle}>{t("mentees.myProgress")}</Text>
        <Text style={styles.pageSubtitle}>{t("mentees.mentor")}: {mentorship.mentor?.name}</Text>

        {/* Gesamtfortschritt – dunkle Hero-Card */}
        <View style={styles.progressHeaderCard}>
          <Text style={styles.progressHeaderLabel}>{t("mentees.totalProgress")}</Text>
          <Text style={styles.progressHeaderValue}>{totalProgress}%</Text>
          <View style={styles.progressTrackWhite}>
            <View
              style={[styles.progressFillGold, { width: `${totalProgress}%` as any }]}
            />
          </View>
          <Text style={styles.progressHeaderSub}>
            {completedStepIds.length} {t("mentees.stepsCompleted").replace("{0}", String(sessionTypes.length))}
          </Text>
        </View>

        {/* Betreuungsdetails */}
        <TouchableOpacity
          style={styles.detailsButton}
          onPress={() =>
            router.push({ pathname: "/mentorship/[id]", params: { id: mentorship.id } })
          }
        >
          <Text style={styles.detailsButtonText}>{t("mentees.viewDetails")}</Text>
          <Text style={styles.detailsArrow}>›</Text>
        </TouchableOpacity>

        {/* Detaillierte Schritt-Liste */}
        <Text style={styles.sectionTitle}>{t("mentees.your10StepsDetail")}</Text>
        <View style={[styles.emptyCard, { padding: 0, overflow: "hidden", marginBottom: 24 }]}>
          {sortedTypes.map((step, idx) => {
            const isDone = completedStepIds.includes(step.id);
            const isCurrent = !isDone && idx === completedStepIds.length;
            const isLocked = !isDone && idx > completedStepIds.length;
            const session = sessions.find((s) => s.session_type_id === step.id);

            return (
              <View
                key={step.id}
                style={[
                  styles.stepDetailRow,
                  idx < sessionTypes.length - 1 ? styles.stepDetailBorder : {},
                  isCurrent ? { backgroundColor: "#fffbeb" } : {},
                ]}
              >
                <View
                  style={[
                    styles.stepIndicator,
                    isDone
                      ? { backgroundColor: COLORS.cta }
                      : isCurrent
                      ? { backgroundColor: COLORS.gold }
                      : { backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
                  ]}
                >
                  {isDone ? (
                    <Text style={styles.stepIndicatorTextWhite}>✓</Text>
                  ) : (
                    <Text
                      style={
                        isCurrent ? styles.stepIndicatorTextWhite : styles.stepIndicatorTextTertiary
                      }
                    >
                      {idx + 1}
                    </Text>
                  )}
                </View>

                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <Text
                      style={[
                        styles.stepDetailName,
                        isDone
                          ? { color: COLORS.cta }
                          : isCurrent
                          ? { color: COLORS.primary }
                          : { color: COLORS.tertiary },
                      ]}
                    >
                      {step.name}
                    </Text>
                    {isLocked && (
                      <Text style={{ color: COLORS.tertiary, fontSize: 12 }}>{t("mentees.locked")}</Text>
                    )}
                    {isCurrent && (
                      <View style={{ backgroundColor: "#fef3c7", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ color: "#b45309", fontSize: 12, fontWeight: "500" }}>{t("mentees.current")}</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.stepDetailDesc}>{step.description}</Text>
                  {isDone && session && (
                    <Text style={{ color: "#16a34a", fontSize: 12, marginTop: 4 }}>
                      {t("mentees.completedOn")}{" "}
                      {new Date(session.date).toLocaleDateString("de-DE")}
                      {session.is_online ? ` (${t("mentees.online")})` : ` (${t("mentees.offline")})`}
                    </Text>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: COLORS.bg },
  page: { padding: 20 },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  pageTitle: { fontSize: 24, fontWeight: "700", color: COLORS.primary, marginBottom: 2 },
  pageSubtitle: { color: COLORS.secondary, fontSize: 13 },
  csvButton: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginTop: 4,
  },
  csvButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: "600" },
  sectionTitle: { fontSize: 18, fontWeight: "600", color: COLORS.primary, marginBottom: 10 },
  searchInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: COLORS.primary,
    marginBottom: 12,
    fontSize: 14,
  },
  filterGroupLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.tertiary,
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 5, borderWidth: 1 },
  filterChipActive: { backgroundColor: COLORS.gradientStart, borderColor: COLORS.gradientStart },
  filterChipInactive: { backgroundColor: COLORS.white, borderColor: COLORS.border },
  filterChipTextActive: { color: COLORS.white, fontSize: 12, fontWeight: "500" },
  filterChipTextInactive: { color: COLORS.secondary, fontSize: 12, fontWeight: "500" },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 32,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  emptyText: { color: COLORS.tertiary, textAlign: "center", fontSize: 14, marginTop: 8 },
  menteeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  menteeCardAssigned: {
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
  },
  menteeCardUnassigned: {
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menteeCardHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  meneeName: { fontWeight: "700", color: COLORS.primary, fontSize: 15 },
  menteeSubText: { color: COLORS.tertiary, fontSize: 12 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "500" },
  mentorLabel: { color: COLORS.tertiary, fontSize: 12, marginBottom: 8 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressTrack: { flex: 1, height: 6, backgroundColor: COLORS.bg, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: COLORS.cta, borderRadius: 3 },
  progressText: { color: COLORS.secondary, fontSize: 12 },
  assignButton: {
    marginTop: 8,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  assignButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },
  viewChatButton: {
    marginTop: 8,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 5,
    paddingVertical: 7,
    paddingHorizontal: 16,
    alignItems: "center",
    alignSelf: "flex-start",
  },
  viewChatButtonText: { color: COLORS.secondary, fontSize: 13, fontWeight: "500" },
  stepSectionLabel: {
    color: COLORS.tertiary,
    fontSize: 11,
    fontWeight: "600",
    marginTop: 12,
    marginBottom: 8,
    letterSpacing: 1,
  },
  stepChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 12 },
  stepChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
  stepChipText: { fontSize: 12 },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sessionCount: { color: COLORS.tertiary, fontSize: 12 },
  docChipButton: {
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 5,
  },
  docChipText: { color: COLORS.cta, fontSize: 12, fontWeight: "600" },
  blockedBadge: {
    backgroundColor: "#fee2e2",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  blockedBadgeText: { color: "#b91c1c", fontSize: 11, fontWeight: "600" },
  selfAssignButton: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 5,
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginBottom: 12,
    alignItems: "center",
  },
  selfAssignText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  progressHeaderCard: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: 8,
    padding: 16,
    marginBottom: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  progressHeaderLabel: { color: COLORS.white, opacity: 0.75, fontSize: 13, marginBottom: 2 },
  progressHeaderValue: { color: COLORS.white, fontSize: 30, fontWeight: "700", marginBottom: 10 },
  progressTrackWhite: { height: 12, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 6, overflow: "hidden" },
  progressFillGold: { height: "100%", backgroundColor: COLORS.gold, borderRadius: 6 },
  progressHeaderSub: { color: COLORS.white, opacity: 0.65, fontSize: 12, marginTop: 8 },
  detailsButton: {
    backgroundColor: "rgba(39,174,96,0.08)",
    borderWidth: 1,
    borderColor: "rgba(39,174,96,0.3)",
    borderRadius: 5,
    paddingVertical: 9,
    paddingHorizontal: 16,
    marginBottom: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  detailsButtonText: { color: COLORS.cta, fontWeight: "600" },
  detailsArrow: { color: COLORS.cta },
  stepDetailRow: { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 16, paddingVertical: 12 },
  stepDetailBorder: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  stepIndicator: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    flexShrink: 0,
  },
  stepIndicatorTextWhite: { color: COLORS.white, fontWeight: "700" },
  stepIndicatorTextTertiary: { color: COLORS.tertiary, fontSize: 14, fontWeight: "700" },
  stepDetailName: { fontWeight: "600", fontSize: 15 },
  stepDetailDesc: { color: COLORS.tertiary, fontSize: 12 },
});
