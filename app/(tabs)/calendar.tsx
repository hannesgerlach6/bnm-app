import React, { useState, useMemo, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
  Linking,
  ActivityIndicator,
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
  } = useData();

  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });

  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleLoading,   setGoogleLoading]   = useState(false);

  const userId = user?.id;

  // Tokens aus DB laden beim Start
  useEffect(() => {
    getValidAccessToken(userId).then((token) => setGoogleConnected(!!token));
  }, [userId]);

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

    return result;
  }, [calendarEvents, user]);

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

  const handleRespond = async (eventId: string, status: "accepted" | "declined") => {
    try {
      await respondToEvent(eventId, status);
    } catch (e) {
      // Error handled in DataContext
    }
  };

  const hasItems = dayEvents.length > 0;

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
              <Text style={[styles.legendText, { color: themeColors.textTertiary }]}>Event</Text>
            </View>
          </View>

          {/* Day Detail */}
          {selectedDate && (
            <View style={styles.dayDetailSection}>
              <Text style={[styles.dayDetailTitle, { color: themeColors.text }]}>
                {selectedDateDisplay}
              </Text>

              {!hasItems && (
                <EmptyState
                  icon="calendar-outline"
                  title="Keine Termine an diesem Tag"
                />
              )}

              {/* Event Cards */}
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

            </View>
          )}
        </View>
      </ScrollView>
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

});
