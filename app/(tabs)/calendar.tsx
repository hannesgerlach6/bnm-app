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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, SHADOWS, RADIUS, SEMANTIC, sem } from "../../constants/Colors";
import { Container } from "../../components/Container";
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
}: {
  event: CalendarEvent;
  attendees: EventAttendee[];
  userId: string;
  onRespond: (eventId: string, status: "accepted" | "declined") => void;
  onAddToGoogle: (event: CalendarEvent) => void;
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
        {myAttendee && (
          <View style={styles.rsvpRow}>
            <BNMPressable
              style={[
                styles.rsvpBtn,
                myAttendee.status === "accepted"
                  ? { backgroundColor: COLORS.cta + "20", borderColor: COLORS.cta }
                  : { backgroundColor: themeColors.background, borderColor: themeColors.border },
              ]}
              onPress={() => onRespond(event.id, "accepted")}
              accessibilityLabel="Zusagen"
            >
              <Ionicons
                name="checkmark"
                size={14}
                color={myAttendee.status === "accepted" ? COLORS.cta : themeColors.textSecondary}
              />
              <Text style={[
                styles.rsvpText,
                { color: myAttendee.status === "accepted" ? COLORS.cta : themeColors.textSecondary },
              ]}>
                Zusagen
              </Text>
            </BNMPressable>
            <BNMPressable
              style={[
                styles.rsvpBtn,
                myAttendee.status === "declined"
                  ? { backgroundColor: COLORS.error + "20", borderColor: COLORS.error }
                  : { backgroundColor: themeColors.background, borderColor: themeColors.border },
              ]}
              onPress={() => onRespond(event.id, "declined")}
              accessibilityLabel="Absagen"
            >
              <Ionicons
                name="close"
                size={14}
                color={myAttendee.status === "declined" ? COLORS.error : themeColors.textSecondary}
              />
              <Text style={[
                styles.rsvpText,
                { color: myAttendee.status === "declined" ? COLORS.error : themeColors.textSecondary },
              ]}>
                Absagen
              </Text>
            </BNMPressable>
          </View>
        )}
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
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const {
    calendarEvents,
    eventAttendees,
    respondToEvent,
    addCalendarEvent,
  } = useData();

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

  const userId = user?.id;

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
      setGoogleConnected(!!tokens);
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
    setCreateTitle("");
    setCreateDate(selectedDate ?? new Date().toISOString().slice(0, 10));
    setCreateTime("10:00");
    setCreateDesc("");
    setCreateTimeError(false);
    setShowCreateModal(true);
  }, [selectedDate]);

  const handleCreateEvent = useCallback(async () => {
    if (!createTitle.trim() || !createDate) return;
    // Uhrzeit validieren
    const timeMatch = createTime.match(/^(\d{1,2}):(\d{2})$/);
    if (!timeMatch) { setCreateTimeError(true); return; }
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    if (h < 0 || h > 23 || m < 0 || m > 59) { setCreateTimeError(true); return; }
    setCreateSaving(true);
    try {
      const start = new Date(`${createDate}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
      await addCalendarEvent({
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
      setShowCreateModal(false);
    } catch {
      // handled in DataContext
    } finally {
      setCreateSaving(false);
    }
  }, [createTitle, createDate, createTime, createDesc, addCalendarEvent, userId]);

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
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>
          <Text style={[styles.pageTitle, { color: themeColors.text }]}>{t("tabs.calendar")}</Text>

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
                  {googleConnected ? "Verbunden — Events werden synchronisiert" : "Verbinden für automatische Sync"}
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

      {/* Termin erstellen Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.card, maxHeight: Dimensions.get("window").height * 0.85 }]}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <Text style={[styles.modalTitle, { color: themeColors.text }]}>Termin erstellen</Text>
              <BNMPressable onPress={() => setShowCreateModal(false)} accessibilityRole="button" accessibilityLabel="Schließen">
                <Ionicons name="close" size={22} color={themeColors.textSecondary} />
              </BNMPressable>
            </View>

            <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Titel *</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.background }]}
              value={createTitle}
              onChangeText={setCreateTitle}
              placeholder="z.B. Treffen mit Mentee"
              placeholderTextColor={themeColors.textTertiary}
              autoFocus
            />

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
              {/* Datum: auf Mobile read-only (kommt vom ausgewählten Kalendertag), auf Web editierbar */}
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Datum</Text>
                {Platform.OS === "web" ? (
                  <TextInput
                    style={[styles.modalInput, { borderColor: themeColors.border, color: themeColors.text, backgroundColor: themeColors.background }]}
                    value={createDate}
                    onChangeText={setCreateDate}
                    placeholder="JJJJ-MM-TT"
                    placeholderTextColor={themeColors.textTertiary}
                  />
                ) : (
                  <View style={[styles.modalInput, { borderColor: themeColors.border, backgroundColor: themeColors.background, justifyContent: "center" }]}>
                    <Text style={{ color: themeColors.text, fontSize: 14 }}>
                      {createDate ? new Date(createDate + "T00:00:00").toLocaleDateString("de-DE", { weekday: "short", day: "numeric", month: "long" }) : "–"}
                    </Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalLabel, { color: themeColors.textSecondary }]}>Uhrzeit</Text>
                <TextInput
                  style={[styles.modalInput, { borderColor: createTimeError ? COLORS.error : themeColors.border, color: themeColors.text, backgroundColor: themeColors.background }]}
                  value={createTime}
                  onChangeText={(v) => { setCreateTime(v); setCreateTimeError(false); }}
                  placeholder="HH:MM"
                  placeholderTextColor={themeColors.textTertiary}
                  keyboardType={Platform.OS === "ios" ? "numbers-and-punctuation" : "numeric"}
                  maxLength={5}
                />
                {createTimeError && (
                  <Text style={{ color: COLORS.error, fontSize: 11, marginTop: 2 }}>Format: HH:MM (z.B. 14:30)</Text>
                )}
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

            <View style={{ flexDirection: "row", gap: 10, marginTop: 20 }}>
              <BNMPressable
                style={[styles.modalCancelBtn, { borderColor: themeColors.border }]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={{ color: themeColors.textSecondary, fontWeight: "600" }}>Abbrechen</Text>
              </BNMPressable>
              <BNMPressable
                style={[styles.modalSaveBtn, { opacity: (!createTitle.trim() || createSaving) ? 0.5 : 1 }]}
                onPress={handleCreateEvent}
                disabled={!createTitle.trim() || createSaving}
              >
                <Text style={{ color: COLORS.white, fontWeight: "600" }}>{createSaving ? "..." : "Speichern"}</Text>
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
