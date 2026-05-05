import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
  Modal,
  TextInput,
  Dimensions,
  Alert,
  RefreshControl,
} from "react-native";
import { supabase } from "../../lib/supabase";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, SHADOWS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarView, CalendarViewEvent } from "../../components/CalendarView";
import { EmptyState } from "../../components/EmptyState";
import { BNMPressable } from "../../components/BNMPressable";
import {
  getValidAccessToken,
  initiateGoogleAuth,
  clearGoogleTokens,
  syncEventToGoogle,
  generateGoogleCalendarUrl,
  fetchGoogleCalendarEvents,
  type GoogleCalendarEvent,
} from "../../lib/calendarService";
import type { CalendarEvent, EventAttendee } from "../../types";
import DateTimePicker from "@react-native-community/datetimepicker";

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const EVENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  webinar: { label: "Webinar", color: COLORS.gradientStart },
  retreat: { label: "Retreat", color: COLORS.cta },
  kurs: { label: "Kurs", color: COLORS.gold },
  meeting: { label: "Meeting", color: COLORS.blue },
  custom: { label: "Termin", color: COLORS.secondary },
};

// ─── Event Card ─────────────────────────────────────────────────────────────

function EventCard({
  event,
  attendees,
  userId,
  onRespond,
  onAddToGoogle,
  onEdit,
  onDelete,
}: {
  event: CalendarEvent;
  attendees: EventAttendee[];
  userId: string;
  onRespond: (eventId: string, status: "accepted" | "declined") => void;
  onAddToGoogle: (event: CalendarEvent) => void;
  onEdit?: (event: CalendarEvent) => void;
  onDelete?: (event: CalendarEvent) => void;
}) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const typeInfo = EVENT_TYPE_LABELS[event.type] || EVENT_TYPE_LABELS.custom;
  const myAttendee = attendees.find((a) => a.event_id === event.id && a.user_id === userId);
  const acceptedCount = attendees.filter((a) => a.event_id === event.id && a.status === "accepted").length;

  return (
    <View style={[styles.eventCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <View style={styles.eventCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eventTitle, { color: themeColors.text }]}>{event.title}</Text>
          <View style={styles.eventMetaRow}>
            <Ionicons name="time-outline" size={14} color={themeColors.textTertiary} />
            <Text style={[styles.eventTime, { color: themeColors.textSecondary }]}>
              {formatTime(event.start_at)}
              {event.end_at ? ` - ${formatTime(event.end_at)}` : ""}
            </Text>
          </View>
          {event.location ? (
            <View style={styles.eventMetaRow}>
              <Ionicons name="location-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.eventLocation, { color: themeColors.textSecondary }]}>{event.location}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + "20" }]}>
          <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>{typeInfo.label}</Text>
        </View>
      </View>

      {event.description ? (
        <Text style={[styles.eventDescription, { color: themeColors.textSecondary }]} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}

      {/* Attendee count + RSVP */}
      <View style={styles.eventFooter}>
        <Text style={[styles.attendeeCount, { color: themeColors.textTertiary }]}>
          {acceptedCount} zugesagt
        </Text>
        <View style={styles.rsvpRow}>
          <BNMPressable
            style={[
              styles.rsvpBtn,
              myAttendee?.status === "accepted"
                ? { backgroundColor: COLORS.cta + "20", borderColor: COLORS.cta }
                : { backgroundColor: themeColors.background, borderColor: themeColors.border },
            ]}
            onPress={() => onRespond(event.id, "accepted")}
            accessibilityLabel="Zusagen"
          >
            <Ionicons
              name="checkmark"
              size={14}
              color={myAttendee?.status === "accepted" ? COLORS.cta : themeColors.textSecondary}
            />
            <Text style={[
              styles.rsvpText,
              { color: myAttendee?.status === "accepted" ? COLORS.cta : themeColors.textSecondary },
            ]}>
              Zusagen
            </Text>
          </BNMPressable>
          <BNMPressable
            style={[
              styles.rsvpBtn,
              myAttendee?.status === "declined"
                ? { backgroundColor: COLORS.error + "20", borderColor: COLORS.error }
                : { backgroundColor: themeColors.background, borderColor: themeColors.border },
            ]}
            onPress={() => onRespond(event.id, "declined")}
            accessibilityLabel="Absagen"
          >
            <Ionicons
              name="close"
              size={14}
              color={myAttendee?.status === "declined" ? COLORS.error : themeColors.textSecondary}
            />
            <Text style={[
              styles.rsvpText,
              { color: myAttendee?.status === "declined" ? COLORS.error : themeColors.textSecondary },
            ]}>
              Absagen
            </Text>
          </BNMPressable>
        </View>
      </View>

      {/* Google Calendar Button */}
      <BNMPressable
        style={[styles.googleCalBtn, { borderColor: themeColors.border }]}
        onPress={() => onAddToGoogle(event)}
        accessibilityLabel="Zu Google Calendar hinzufügen"
      >
        <Ionicons name="logo-google" size={13} color={themeColors.textSecondary} />
        <Text style={[styles.googleCalBtnText, { color: themeColors.textSecondary }]}>
          Google Kalender
        </Text>
      </BNMPressable>

      {(onEdit || onDelete) && (
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 8 }}>
          {onEdit && (
            <BNMPressable
              style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
              onPress={() => onEdit(event)}
            >
              <Ionicons name="pencil-outline" size={14} color={themeColors.textSecondary} />
              <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>Bearbeiten</Text>
            </BNMPressable>
          )}
          {onDelete && (
            <BNMPressable
              style={{ flexDirection: "row", alignItems: "center", gap: 4, padding: 6 }}
              onPress={() => onDelete(event)}
            >
              <Ionicons name="trash-outline" size={14} color={COLORS.error} />
              <Text style={{ fontSize: 12, color: COLORS.error }}>Stornieren</Text>
            </BNMPressable>
          )}
        </View>
      )}
    </View>
  );
}

// ─── Google Event Card ───────────────────────────────────────────────────────

function GoogleEventCard({ event }: { event: GoogleCalendarEvent }) {
  const themeColors = useThemeColors();

  const timeStr = event.isAllDay
    ? "Ganztägig"
    : event.start
    ? `${formatTime(event.start)}${event.end ? ` - ${formatTime(event.end)}` : ""}`
    : "";

  const openInGoogle = () => {
    if (!event.htmlLink) return;
    if (Platform.OS === "web") window.open(event.htmlLink, "_blank");
    else Linking.openURL(event.htmlLink);
  };

  return (
    <View style={[styles.eventCard, { backgroundColor: themeColors.card, borderColor: "#4285F480" }]}>
      <View style={styles.eventCardHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.eventTitle, { color: themeColors.text }]}>{event.title}</Text>
          {timeStr ? (
            <View style={styles.eventMetaRow}>
              <Ionicons name="time-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.eventTime, { color: themeColors.textSecondary }]}>{timeStr}</Text>
            </View>
          ) : null}
          {event.location ? (
            <View style={styles.eventMetaRow}>
              <Ionicons name="location-outline" size={14} color={themeColors.textTertiary} />
              <Text style={[styles.eventLocation, { color: themeColors.textSecondary }]}>{event.location}</Text>
            </View>
          ) : null}
        </View>
        <View style={[styles.typeBadge, { backgroundColor: "#4285F420" }]}>
          <Text style={[styles.typeBadgeText, { color: "#4285F4" }]}>Google</Text>
        </View>
      </View>
      {event.description ? (
        <Text style={[styles.eventDescription, { color: themeColors.textSecondary }]} numberOfLines={2}>
          {event.description}
        </Text>
      ) : null}
      {event.htmlLink ? (
        <BNMPressable
          style={[styles.googleCalBtn, { borderColor: "#4285F440" }]}
          onPress={openInGoogle}
          accessibilityLabel="In Google Calendar öffnen"
        >
          <Ionicons name="open-outline" size={13} color="#4285F4" />
          <Text style={[styles.googleCalBtnText, { color: "#4285F4" }]}>
            In Google Calendar öffnen
          </Text>
        </BNMPressable>
      ) : null}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const { user } = useAuth();
  const { t, language } = useLanguage();

  // Locale-Map für DateTimePicker (iOS verwendet IETF BCP 47 Tags)
  const datePickerLocale: Record<string, string> = {
    de: "de-DE", en: "en-GB", tr: "tr-TR", ar: "ar-SA",
  };
  const pickerLocale = datePickerLocale[language] ?? "de-DE";
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    calendarEvents,
    eventAttendees,
    respondToEvent,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    inviteToEvent,
    mentorships,
    users,
    refreshData,
  } = useData();

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);
  const [googleCalItems,  setGoogleCalItems]   = useState<GoogleCalendarEvent[]>([]);

  // Termin-Erstellen State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDate, setCreateDate] = useState("");
  const [createTime, setCreateTime] = useState("10:00");
  const [createDesc, setCreateDesc] = useState("");
  const [createSaving, setCreateSaving] = useState(false);
  const [createTimeError, setCreateTimeError] = useState(false);
  const [createDateError, setCreateDateError] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedMenteeIds, setSelectedMenteeIds] = useState<string[]>([]);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<CalendarEvent | null>(null);

  const userId = user?.id;

  // Eigene aktive Mentees (nur für Mentoren)
  const myMentees = useMemo(() => {
    if (!userId || user?.role === "mentee") return [];
    return mentorships
      .filter((m) => m.mentor_id === userId && m.status === "active")
      .map((m) => users.find((u) => u.id === m.mentee_id))
      .filter((u): u is NonNullable<typeof u> => !!u);
  }, [mentorships, users, userId, user?.role]);

  // Tokens aus DB laden beim Start
  useEffect(() => {
    getValidAccessToken(userId).then((token) => setGoogleConnected(!!token));
  }, [userId]);

  // Google-Kalender-Einträge laden wenn verbunden
  useEffect(() => {
    if (!googleConnected) { setGoogleCalItems([]); return; }
    getValidAccessToken(userId).then(async (token) => {
      if (!token) return;
      const items = await fetchGoogleCalendarEvents(token);
      setGoogleCalItems(items);
    });
  }, [googleConnected, userId]);

  const handleGoogleConnect = useCallback(async () => {
    setGoogleLoading(true);
    try {
      const tokens = await initiateGoogleAuth(userId);
      if (tokens) {
        setGoogleConnected(true);
        const items = await fetchGoogleCalendarEvents(tokens.accessToken);
        setGoogleCalItems(items);
        // Seite neu laden damit alle Kalender-Daten frisch geladen werden
        if (Platform.OS === "web") {
          (window as any).location.reload();
        }
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [userId]);

  const handleGoogleDisconnect = useCallback(async () => {
    await clearGoogleTokens(userId);
    setGoogleConnected(false);
  }, [userId]);

  const handleAddToGoogle = useCallback(async (event: CalendarEvent) => {
    if (!googleConnected) {
      const url = generateGoogleCalendarUrl(event);
      if (Platform.OS === "web") window.open(url, "_blank");
      else Linking.openURL(url);
      return;
    }

    setGoogleLoading(true);
    try {
      const token = await getValidAccessToken(userId);
      if (!token) { setGoogleConnected(false); return; }
      const googleId = await syncEventToGoogle(event, token);
      if (!googleId) {
        const url = generateGoogleCalendarUrl(event);
        if (Platform.OS === "web") window.open(url, "_blank");
        else Linking.openURL(url);
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [googleConnected, userId]);

  // Build calendar view events
  const calendarViewEvents = useMemo(() => {
    const result: CalendarViewEvent[] = [];

    // BNM-Events
    calendarEvents.forEach((e) => {
      if (!e.is_active) return;
      if (user) {
        if (e.visible_to === "mentors" && user.role === "mentee") return;
        if (e.visible_to === "mentees" && user.role !== "mentee") return;
        if (e.visible_to === "male" && user.gender !== "male") return;
        if (e.visible_to === "female" && user.gender !== "female") return;
      }
      result.push({
        date: e.start_at.slice(0, 10),
        type: "event",
        title: e.title,
      });
    });

    // Google-Kalender-Einträge
    googleCalItems.forEach((e) => {
      const date = e.start.slice(0, 10);
      if (date) result.push({ date, type: "google", title: e.title });
    });

    return result;
  }, [calendarEvents, googleCalItems, user]);

  // Events for selected day
  const dayEvents = useMemo(() => {
    if (!selectedDate) return [];
    return calendarEvents.filter((e) => {
      if (!e.is_active) return false;
      if (e.start_at.slice(0, 10) !== selectedDate) return false;
      // Filter by visible_to
      if (user) {
        if (e.visible_to === "mentors" && user.role === "mentee") return false;
        if (e.visible_to === "mentees" && user.role !== "mentee") return false;
        if (e.visible_to === "male" && user.gender !== "male") return false;
        if (e.visible_to === "female" && user.gender !== "female") return false;
      }
      return true;
    });
  }, [calendarEvents, selectedDate, user]);

  // Google-Events für den ausgewählten Tag
  const dayGoogleItems = useMemo(() => {
    if (!selectedDate) return [];
    return googleCalItems.filter((e) => e.start.slice(0, 10) === selectedDate);
  }, [googleCalItems, selectedDate]);

  const handleRespond = async (eventId: string, status: "accepted" | "declined") => {
    try {
      await respondToEvent(eventId, status);
    } catch (e) {
      // Error handled in DataContext
    }
  };

  const hasItems = dayEvents.length > 0 || dayGoogleItems.length > 0;

  const openCreateModal = useCallback(() => {
    setEditingEvent(null);
    setSelectedMenteeIds([]);
    setCreateTitle("");
    setCreateDate(selectedDate ?? new Date().toISOString().slice(0, 10));
    setCreateTime("10:00");
    setCreateDesc("");
    setCreateTimeError(false);
    setCreateDateError(false);
    setShowCreateModal(true);
  }, [selectedDate]);

  const openEditModal = useCallback((event: CalendarEvent) => {
    setEditingEvent(event);
    const d = new Date(event.start_at);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const timeStr = `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
    // Bereits eingeladene Mentees vorselektieren
    const alreadyInvited = eventAttendees
      .filter((a) => a.event_id === event.id)
      .map((a) => a.user_id);
    setSelectedMenteeIds(alreadyInvited);
    setCreateTitle(event.title);
    setCreateDate(dateStr);
    setCreateTime(timeStr);
    setCreateDesc(event.description ?? "");
    setCreateTimeError(false);
    setCreateDateError(false);
    setShowCreateModal(true);
  }, [eventAttendees]);

  const handleSaveEvent = useCallback(async () => {
    if (!createTitle.trim() || !createDate) return;
    const dateMatch = createDate.match(/^\d{4}-\d{2}-\d{2}$/);
    if (!dateMatch) { setCreateDateError(true); return; }
    const timeMatch = createTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) { setCreateTimeError(true); return; }
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) { setCreateTimeError(true); return; }
    setCreateSaving(true);
    try {
      const start = new Date(`${createDate}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);
      if (isNaN(start.getTime())) { setCreateDateError(true); setCreateSaving(false); return; }

      let eventId: string | null = editingEvent?.id ?? null;

      if (editingEvent) {
        // Bearbeiten
        await updateCalendarEvent(editingEvent.id, {
          title: createTitle.trim(),
          description: createDesc.trim(),
          start_at: start.toISOString(),
        });
      } else {
        // Neu erstellen
        eventId = await addCalendarEvent({
          title: createTitle.trim(),
          description: createDesc.trim(),
          start_at: start.toISOString(),
          end_at: null,
          type: "custom" as const,
          location: "",
          created_by: userId ?? null,
          recurrence: null,
          visible_to: "all" as const,
          is_active: true,
          google_calendar_event_id: null,
        });
      }

      // Mentees einladen (nur neu hinzugefügte)
      if (eventId && selectedMenteeIds.length > 0) {
        await inviteToEvent(eventId, selectedMenteeIds);

        // In-App Benachrichtigung an eingeladene Mentees
        const alreadyInvited = editingEvent
          ? eventAttendees.filter((a) => a.event_id === editingEvent.id).map((a) => a.user_id)
          : [];
        const newlyInvited = selectedMenteeIds.filter((id) => !alreadyInvited.includes(id));
        if (newlyInvited.length > 0) {
          await supabase.from("notifications").insert(
            newlyInvited.map((uid) => ({
              user_id: uid,
              type: "calendar_invite",
              title: "Neuer Termin",
              body: `Du wurdest zu einem Termin eingeladen: ${createTitle.trim()}`,
              related_id: eventId,
            }))
          );
        }
      }

      // Auto-Einladung aller aktiven Mentoren bei neuem Event (ohne bereits manuell gewählte)
      if (eventId && !editingEvent) {
        const mentorIds = users
          .filter((u) => u.role === "mentor" && u.is_active && !selectedMenteeIds.includes(u.id))
          .map((u) => u.id);
        if (mentorIds.length > 0) {
          await inviteToEvent(eventId, mentorIds);
          await supabase.from("notifications").insert(
            mentorIds.map((uid) => ({
              user_id: uid,
              type: "calendar_invite",
              title: "Neuer Termin",
              body: `Du wurdest zu einem Termin eingeladen: ${createTitle.trim()}`,
              related_id: eventId,
            }))
          );
        }
      }

      setShowCreateModal(false);
    } catch {
      // handled
    } finally {
      setCreateSaving(false);
    }
  }, [createTitle, createDate, createTime, createDesc, editingEvent, selectedMenteeIds,
      addCalendarEvent, updateCalendarEvent, inviteToEvent, userId, eventAttendees, users]);

  const handleDeleteEvent = useCallback((event: CalendarEvent) => {
    setConfirmDeleteEvent(event);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!confirmDeleteEvent) return;
    try {
      await deleteCalendarEvent(confirmDeleteEvent.id);
    } catch { /* handled */ }
    finally { setConfirmDeleteEvent(null); }
  }, [confirmDeleteEvent, deleteCalendarEvent]);

  // Format selected date for display
  const selectedDateDisplay = selectedDate
    ? new Date(selectedDate + "T00:00:00").toLocaleDateString("de-DE", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView
        style={[styles.scrollView, { backgroundColor: themeColors.background }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
      >
        <View style={[styles.page, Platform.OS !== "web" && { paddingTop: insets.top + 12 }]}>

          {/* Google Calendar Connect Card */}
          <View style={[styles.googleConnectCard, {
            backgroundColor: themeColors.card,
            borderColor: googleConnected ? COLORS.cta + "60" : themeColors.border,
          }]}>
            <View style={styles.googleConnectLeft}>
              <Ionicons
                name="logo-google"
                size={18}
                color={googleConnected ? COLORS.cta : themeColors.textSecondary}
              />
              <View>
                <Text style={[styles.googleConnectTitle, { color: themeColors.text }]}>
                  Google Kalender
                </Text>
                <Text style={[styles.googleConnectSub, { color: themeColors.textTertiary }]}>
                  {googleConnected ? "Verbunden" : "Verbinden für automatische Sync"}
                </Text>
              </View>
            </View>
            {googleLoading ? (
              <ActivityIndicator size="small" color={COLORS.gold} />
            ) : (
              <BNMPressable
                style={[
                  styles.googleConnectBtn,
                  { backgroundColor: googleConnected ? COLORS.error + "15" : COLORS.gold + "15",
                    borderColor:     googleConnected ? COLORS.error + "40" : COLORS.gold + "40" },
                ]}
                onPress={googleConnected ? handleGoogleDisconnect : handleGoogleConnect}
              >
                <Text style={[styles.googleConnectBtnText, {
                  color: googleConnected ? COLORS.error : COLORS.goldDeep,
                }]}>
                  {googleConnected ? "Trennen" : "Verbinden"}
                </Text>
              </BNMPressable>
            )}
          </View>

          {/* Calendar Grid */}
          <CalendarView
            events={calendarViewEvents}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />

          {/* Legend */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: COLORS.gold }]} />
              <Text style={[styles.legendText, { color: themeColors.textTertiary }]}>BNM Event</Text>
            </View>
            {googleConnected && (
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: "#4285F4" }]} />
                <Text style={[styles.legendText, { color: themeColors.textTertiary }]}>Google</Text>
              </View>
            )}
          </View>

          {/* Day Detail */}
          {selectedDate && (
            <View style={styles.dayDetailSection}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={[styles.dayDetailTitle, { color: themeColors.text, marginBottom: 0 }]}>
                  {selectedDateDisplay}
                </Text>
                <BNMPressable
                  style={[styles.createEventBtn, { backgroundColor: COLORS.gold + "18", borderColor: COLORS.gold + "50" }]}
                  onPress={openCreateModal}
                  accessibilityRole="button"
                  accessibilityLabel="Termin erstellen"
                >
                  <Ionicons name="add" size={16} color={COLORS.gold} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: COLORS.gold }}>Termin</Text>
                </BNMPressable>
              </View>

              {!hasItems && (
                <EmptyState
                  icon="calendar-outline"
                  title="Keine Termine an diesem Tag"
                />
              )}

              {/* BNM Event Cards */}
              {dayEvents.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  attendees={eventAttendees}
                  userId={user?.id || ""}
                  onRespond={handleRespond}
                  onAddToGoogle={handleAddToGoogle}
                  onEdit={(event.created_by === userId || user?.role === "admin" || user?.role === "office") ? openEditModal : undefined}
                  onDelete={(event.created_by === userId || user?.role === "admin" || user?.role === "office") ? handleDeleteEvent : undefined}
                />
              ))}

              {/* Google Kalender Karten */}
              {dayGoogleItems.map((gEvent) => (
                <GoogleEventCard key={gEvent.id} event={gEvent} />
              ))}

            </View>
          )}
        </View>
      </ScrollView>

      {/* Termin erstellen / bearbeiten Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card, maxHeight: Dimensions.get("window").height * 0.9 }]}>
            {/* Header */}
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>{editingEvent ? "Termin bearbeiten" : "Termin erstellen"}</Text>
              <BNMPressable onPress={() => setShowCreateModal(false)} accessibilityRole="button" accessibilityLabel="Schließen">
                <Ionicons name="close" size={22} color={themeColors.textSecondary} />
              </BNMPressable>
            </View>

            {/* Scrollbarer Inhalt */}
            <ScrollView style={{ maxHeight: Dimensions.get("window").height * 0.65 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

              <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Titel *</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.background }]}
                value={createTitle}
                onChangeText={setCreateTitle}
                placeholder="z.B. Treffen mit Mentee"
                placeholderTextColor={themeColors.textTertiary}
              />

              <View style={{ flexDirection: showTimePicker && Platform.OS === "ios" ? "column" : "row", gap: 12, marginTop: 12 }}>
                {/* Datum */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Datum</Text>
                  {Platform.OS === "web" ? (
                    // Web: nativer Browser-Kalender via <input type="date">
                    <View style={[styles.modalInput, { borderColor: createDateError ? COLORS.error : themeColors.border, backgroundColor: themeColors.background, padding: 0 }]}>
                      {(global as any).document ? (
                        <input
                          type="date"
                          value={createDate}
                          onChange={(e: any) => { setCreateDate(e.target.value); setCreateDateError(false); }}
                          style={{
                            width: "100%", border: "none", outline: "none", background: "transparent",
                            fontSize: 14, color: themeColors.text, padding: "10px 12px", boxSizing: "border-box",
                          } as any}
                        />
                      ) : null}
                    </View>
                  ) : (
                    // Mobile: Tap → DateTimePicker inline im Modal
                    <>
                      <BNMPressable
                        style={[styles.modalInput, { borderColor: themeColors.border, backgroundColor: themeColors.background, justifyContent: "space-between", flexDirection: "row", alignItems: "center" }]}
                        onPress={() => { setShowDatePicker((v) => !v); setShowTimePicker(false); }}
                      >
                        <Text style={{ color: themeColors.text, fontSize: 14 }}>
                          {createDate ? new Date(createDate + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" }) : "Datum wählen"}
                        </Text>
                        <Ionicons name="calendar-outline" size={16} color={themeColors.textSecondary} />
                      </BNMPressable>
                      {showDatePicker && (
                        <DateTimePicker
                          value={createDate ? new Date(createDate + "T00:00:00") : new Date()}
                          mode="date"
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          locale={pickerLocale}
                          onChange={(_, date) => {
                            if (Platform.OS === "android") setShowDatePicker(false);
                            if (date) {
                              const y = date.getFullYear();
                              const m = String(date.getMonth() + 1).padStart(2, "0");
                              const d = String(date.getDate()).padStart(2, "0");
                              setCreateDate(`${y}-${m}-${d}`);
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                  {createDateError && <Text style={{ color: COLORS.error, fontSize: 11, marginTop: 2 }}>Ungültiges Datum</Text>}
                </View>

                {/* Uhrzeit */}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Uhrzeit</Text>
                  {Platform.OS === "web" ? (
                    <View style={[styles.modalInput, { borderColor: themeColors.border, backgroundColor: themeColors.background, padding: 0 }]}>
                      {(global as any).document ? (
                        <input
                          type="time"
                          value={createTime}
                          onChange={(e: any) => { setCreateTime(e.target.value); setCreateTimeError(false); }}
                          style={{
                            width: "100%", border: "none", outline: "none", background: "transparent",
                            fontSize: 14, color: themeColors.text, padding: "10px 12px", boxSizing: "border-box",
                          } as any}
                        />
                      ) : null}
                    </View>
                  ) : (
                    <>
                      <BNMPressable
                        style={[styles.modalInput, { borderColor: themeColors.border, backgroundColor: themeColors.background, justifyContent: "space-between", flexDirection: "row", alignItems: "center" }]}
                        onPress={() => { setShowTimePicker((v) => !v); setShowDatePicker(false); }}
                      >
                        <Text style={{ color: themeColors.text, fontSize: 14 }}>{createTime || "10:00"}</Text>
                        <Ionicons name="time-outline" size={16} color={themeColors.textSecondary} />
                      </BNMPressable>
                      {showTimePicker && (
                        <DateTimePicker
                          value={(() => {
                            const [hStr, mStr] = (createTime || "10:00").split(":");
                            const d = new Date();
                            d.setHours(parseInt(hStr || "10", 10), parseInt(mStr || "0", 10), 0);
                            return d;
                          })()}
                          mode="time"
                          is24Hour
                          minuteInterval={5}
                          locale={pickerLocale}
                          display={Platform.OS === "ios" ? "spinner" : "default"}
                          style={{ width: "100%" }}
                          onChange={(_, date) => {
                            if (Platform.OS === "android") setShowTimePicker(false);
                            if (date) {
                              const h = String(date.getHours()).padStart(2, "0");
                              const m = String(date.getMinutes()).padStart(2, "0");
                              setCreateTime(`${h}:${m}`);
                            }
                          }}
                        />
                      )}
                    </>
                  )}
                  {createTimeError && <Text style={{ color: COLORS.error, fontSize: 11, marginTop: 2 }}>Format: HH:MM</Text>}
                </View>
              </View>

              <Text style={[styles.modalLabel, { color: themeColors.textSecondary, marginTop: 12 }]}>Beschreibung</Text>
              <TextInput
                style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.background, minHeight: 64, textAlignVertical: "top" }]}
                value={createDesc}
                onChangeText={setCreateDesc}
                placeholder="Optional"
                placeholderTextColor={themeColors.textTertiary}
                multiline
                numberOfLines={3}
              />

              {/* Mentees einladen — eigene ScrollView damit lange Listen nicht das Modal sprengen */}
              {myMentees.length > 0 && (
                <View style={{ marginTop: 12 }}>
                  <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Mentees einladen</Text>
                  <ScrollView
                    style={{ maxHeight: 200, marginTop: 6 }}
                    nestedScrollEnabled
                    showsVerticalScrollIndicator={true}
                  >
                    <View style={{ gap: 6 }}>
                      {myMentees.map((mentee) => {
                        const isSelected = selectedMenteeIds.includes(mentee.id);
                        return (
                          <BNMPressable
                            key={mentee.id}
                            style={{
                              flexDirection: "row", alignItems: "center", gap: 10, padding: 10,
                              borderRadius: RADIUS.sm, borderWidth: 1,
                              borderColor: isSelected ? COLORS.gold : themeColors.border,
                              backgroundColor: isSelected ? COLORS.gold + "15" : themeColors.background,
                            }}
                            onPress={() => setSelectedMenteeIds((prev) =>
                              isSelected ? prev.filter((id) => id !== mentee.id) : [...prev, mentee.id]
                            )}
                          >
                            <Ionicons name={isSelected ? "checkmark-circle" : "ellipse-outline"} size={18} color={isSelected ? COLORS.gold : themeColors.textTertiary} />
                            <Text style={{ fontSize: 14, color: themeColors.text, flex: 1 }}>{mentee.name}</Text>
                          </BNMPressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              )}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 20, marginBottom: 4 }}>
                <BNMPressable style={[styles.modalCancelBtn, { borderColor: themeColors.border }]} onPress={() => setShowCreateModal(false)}>
                  <Text style={{ color: themeColors.textSecondary, fontWeight: "600" }}>Abbrechen</Text>
                </BNMPressable>
                <BNMPressable
                  style={[styles.modalSaveBtn, { opacity: (!createTitle.trim() || createSaving) ? 0.5 : 1 }]}
                  onPress={handleSaveEvent}
                  disabled={!createTitle.trim() || createSaving}
                >
                  <Text style={{ color: COLORS.white, fontWeight: "600" }}>{createSaving ? "..." : "Speichern"}</Text>
                </BNMPressable>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Termin stornieren — Bestätigung */}
      <Modal visible={!!confirmDeleteEvent} transparent animationType="fade" onRequestClose={() => setConfirmDeleteEvent(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card, maxHeight: 220 }]}>
            <Text style={[styles.modalTitle, { color: themeColors.text, marginBottom: 10 }]}>Termin stornieren</Text>
            <Text style={{ color: themeColors.textSecondary, marginBottom: 20 }}>
              Möchtest du <Text style={{ fontWeight: "700", color: themeColors.text }}>„{confirmDeleteEvent?.title}"</Text> wirklich löschen?
            </Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              <BNMPressable style={[styles.modalCancelBtn, { borderColor: themeColors.border }]} onPress={() => setConfirmDeleteEvent(null)}>
                <Text style={{ color: themeColors.textSecondary, fontWeight: "600" }}>Abbrechen</Text>
              </BNMPressable>
              <BNMPressable style={[styles.modalSaveBtn, { backgroundColor: COLORS.error }]} onPress={confirmDelete}>
                <Text style={{ color: COLORS.white, fontWeight: "600" }}>Löschen</Text>
              </BNMPressable>
            </View>
          </View>
        </View>
      </Modal>

    </Container>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  pageTitle: {
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: -0.3,
    textAlign: "center",
    marginBottom: 16,
  },

  // Google Connect Card
  googleConnectCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginBottom: 16,
    ...SHADOWS.sm,
  },
  googleConnectLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  googleConnectTitle: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  googleConnectSub: {
    fontSize: 11,
  },
  googleConnectBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  googleConnectBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Google Cal Button (EventCard)
  googleCalBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: RADIUS.xs,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  googleCalBtnText: {
    fontSize: 11,
    fontWeight: "500",
  },

  // Legend
  legendRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 20,
    marginBottom: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: "500",
  },

  // Day Detail
  dayDetailSection: {
    marginTop: 4,
  },
  dayDetailTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 12,
  },

  // Event Card
  eventCard: {
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  eventCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  eventTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  eventMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  eventTime: {
    fontSize: 13,
  },
  eventLocation: {
    fontSize: 13,
  },
  eventDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.xs,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
  },
  attendeeCount: {
    fontSize: 12,
    fontWeight: "500",
  },
  rsvpRow: {
    flexDirection: "row",
    gap: 8,
  },
  rsvpBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  rsvpText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Termin erstellen Button
  createEventBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },

  // Create Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 480,
    borderRadius: RADIUS.lg,
    padding: 24,
    ...SHADOWS.lg,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  modalLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 6,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  modalCancelBtn: {
    flex: 1,
    padding: 12,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: "center",
  },
  modalSaveBtn: {
    flex: 1,
    padding: 12,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    backgroundColor: COLORS.gradientStart,
  },
});
