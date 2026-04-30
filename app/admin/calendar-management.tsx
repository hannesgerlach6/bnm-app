import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  StyleSheet,
  Platform,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { showError, showSuccess, showConfirm } from "../../lib/errorHandler";
import { Container } from "../../components/Container";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, SHADOWS, SEMANTIC, sem } from "../../constants/Colors";
import { EmptyState } from "../../components/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { CalendarEvent, CalendarEventType, ResourceVisibility, EventAttendee, User } from "../../types";

const EVENT_TYPES: CalendarEventType[] = ["webinar", "retreat", "kurs", "meeting", "custom"];
const VISIBLE_OPTIONS: ResourceVisibility[] = ["all", "mentors", "mentees", "male", "female"];
const RECURRENCE_OPTIONS: Array<"none" | "weekly" | "biweekly" | "monthly"> = ["none", "weekly", "biweekly", "monthly"];

const VISIBLE_LABELS: Record<string, string> = {
  all: "Alle",
  mentors: "Mentoren",
  mentees: "Mentees",
  male: "Männer",
  female: "Frauen",
};

const RECURRENCE_LABELS: Record<string, string> = {
  none: "Keine",
  weekly: "Wöchentlich",
  biweekly: "Alle 2 Wochen",
  monthly: "Monatlich",
};

const TYPE_LABELS: Record<string, string> = {
  webinar: "Webinar",
  retreat: "Retreat",
  kurs: "Kurs",
  meeting: "Meeting",
  custom: "Benutzerdefiniert",
};

// ─── Attendee List ──────────────────────────────────────────────────────────

function AttendeeSection({
  eventId,
  attendees,
  users,
  onInviteMentors,
  onInviteMentees,
}: {
  eventId: string;
  attendees: EventAttendee[];
  users: User[];
  onInviteMentors: () => void;
  onInviteMentees: () => void;
}) {
  const themeColors = useThemeColors();
  const eventAttendees = attendees.filter((a) => a.event_id === eventId);
  const acceptedCount = eventAttendees.filter((a) => a.status === "accepted").length;

  return (
    <View style={[styles.attendeeSection, { borderTopColor: themeColors.border }]}>
      <Text style={[styles.attendeeCount, { color: themeColors.textSecondary }]}>
        {acceptedCount} zugesagt / {eventAttendees.length} eingeladen
      </Text>
      <View style={styles.inviteRow}>
        <BNMPressable style={[styles.inviteBtn, { backgroundColor: COLORS.gradientStart + "15" }]} onPress={onInviteMentors}>
          <Text style={[styles.inviteBtnText, { color: COLORS.gradientStart }]}>Alle Mentoren einladen</Text>
        </BNMPressable>
        <BNMPressable style={[styles.inviteBtn, { backgroundColor: COLORS.gold + "15" }]} onPress={onInviteMentees}>
          <Text style={[styles.inviteBtnText, { color: COLORS.gold }]}>Alle Mentees einladen</Text>
        </BNMPressable>
      </View>
      {eventAttendees.length > 0 && (
        <View style={styles.attendeeList}>
          {eventAttendees.map((a) => {
            const u = users.find((u) => u.id === a.user_id);
            const statusColor = a.status === "accepted" ? COLORS.cta : a.status === "declined" ? COLORS.error : COLORS.secondary;
            const statusLabel = a.status === "accepted" ? "Zugesagt" : a.status === "declined" ? "Abgesagt" : "Eingeladen";
            return (
              <View key={a.id} style={styles.attendeeRow}>
                <Text style={[styles.attendeeName, { color: themeColors.text }]}>{u?.name || "?"}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                  <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Main Screen ────────────────────────────────────────────────────────────

export default function CalendarManagementScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const {
    calendarEvents,
    eventAttendees,
    users,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    inviteToEvent,
  } = useData();

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formTitle, setFormTitle] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndDate, setFormEndDate] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formType, setFormType] = useState<CalendarEventType>("meeting");
  const [formLocation, setFormLocation] = useState("");
  const [formVisibleTo, setFormVisibleTo] = useState<ResourceVisibility>("all");
  const [formRecurrence, setFormRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");
  const [isSaving, setIsSaving] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editStartTime, setEditStartTime] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editEndTime, setEditEndTime] = useState("");
  const [editType, setEditType] = useState<CalendarEventType>("meeting");
  const [editLocation, setEditLocation] = useState("");
  const [editVisibleTo, setEditVisibleTo] = useState<ResourceVisibility>("all");
  const [editRecurrence, setEditRecurrence] = useState<"none" | "weekly" | "biweekly" | "monthly">("none");

  // Expanded attendees
  const [expandedAttendees, setExpandedAttendees] = useState<Set<string>>(new Set());

  const sorted = useMemo(
    () => [...calendarEvents].sort((a, b) => a.start_at.localeCompare(b.start_at)),
    [calendarEvents],
  );

  if (user?.role !== "admin") {
    return (
      <View style={[styles.center, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.accessDenied, { color: themeColors.error }]}>Kein Zugriff</Text>
      </View>
    );
  }

  const resetForm = () => {
    setFormTitle("");
    setFormDescription("");
    setFormStartDate("");
    setFormStartTime("");
    setFormEndDate("");
    setFormEndTime("");
    setFormType("meeting");
    setFormLocation("");
    setFormVisibleTo("all");
    setFormRecurrence("none");
  };

  const handleCreate = async () => {
    if (!formTitle.trim() || !formStartDate.trim() || !formStartTime.trim()) {
      showError("Bitte Titel, Startdatum und Startzeit eingeben.");
      return;
    }
    setIsSaving(true);
    try {
      const startAt = `${formStartDate}T${formStartTime}:00`;
      const endAt = formEndDate && formEndTime ? `${formEndDate}T${formEndTime}:00` : null;
      await addCalendarEvent({
        title: formTitle.trim(),
        description: formDescription.trim(),
        start_at: startAt,
        end_at: endAt,
        type: formType,
        location: formLocation.trim(),
        created_by: user.id,
        recurrence: formRecurrence === "none" ? null : formRecurrence,
        visible_to: formVisibleTo,
        is_active: true,
        google_calendar_event_id: null,
      });
      showSuccess("Event erstellt");
      resetForm();
      setShowForm(false);
    } catch (e) {
      showError("Fehler beim Erstellen");
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = (event: CalendarEvent) => {
    setEditingId(event.id);
    setEditTitle(event.title);
    setEditDescription(event.description || "");
    setEditStartDate(event.start_at.slice(0, 10));
    setEditStartTime(event.start_at.slice(11, 16));
    setEditEndDate(event.end_at ? event.end_at.slice(0, 10) : "");
    setEditEndTime(event.end_at ? event.end_at.slice(11, 16) : "");
    setEditType(event.type);
    setEditLocation(event.location || "");
    setEditVisibleTo(event.visible_to);
    setEditRecurrence(event.recurrence || "none");
  };

  const handleUpdate = async () => {
    if (!editingId || !editTitle.trim()) return;
    setIsSaving(true);
    try {
      const startAt = `${editStartDate}T${editStartTime}:00`;
      const endAt = editEndDate && editEndTime ? `${editEndDate}T${editEndTime}:00` : null;
      await updateCalendarEvent(editingId, {
        title: editTitle.trim(),
        description: editDescription.trim(),
        start_at: startAt,
        end_at: endAt,
        type: editType,
        location: editLocation.trim(),
        recurrence: editRecurrence === "none" ? null : editRecurrence,
        visible_to: editVisibleTo,
      });
      showSuccess("Event aktualisiert");
      setEditingId(null);
    } catch (e) {
      showError("Fehler beim Aktualisieren");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, title: string) => {
    const ok = await showConfirm("Event löschen", `"${title}" wirklich löschen?`);
    if (!ok) return;
    try {
      await deleteCalendarEvent(id);
      showSuccess("Event gelöscht");
    } catch {
      showError("Fehler beim Löschen");
    }
  };

  const handleInviteMentors = async (eventId: string) => {
    const mentorIds = users.filter((u) => u.role === "mentor" && u.is_active).map((u) => u.id);
    if (mentorIds.length === 0) { showError("Keine aktiven Mentoren gefunden"); return; }
    try {
      await inviteToEvent(eventId, mentorIds);
      showSuccess(`${mentorIds.length} Mentoren eingeladen`);
    } catch { showError("Fehler beim Einladen"); }
  };

  const handleInviteMentees = async (eventId: string) => {
    const menteeIds = users.filter((u) => u.role === "mentee" && u.is_active).map((u) => u.id);
    if (menteeIds.length === 0) { showError("Keine aktiven Mentees gefunden"); return; }
    try {
      await inviteToEvent(eventId, menteeIds);
      showSuccess(`${menteeIds.length} Mentees eingeladen`);
    } catch { showError("Fehler beim Einladen"); }
  };

  const inputStyle = [styles.input, { backgroundColor: themeColors.input, color: themeColors.text, borderColor: themeColors.border }];

  return (
    <Container fullWidth={Platform.OS === "web"}>
      <ScrollView style={[styles.scrollView, { backgroundColor: themeColors.background }]}>
        <View style={styles.page}>
          {/* Header */}
          <View style={[styles.headerRow, { paddingTop: insets.top + 12 }]}>
            <BNMPressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={themeColors.text} />
            </BNMPressable>
            <Text style={[styles.pageTitle, { color: themeColors.text }]}>Kalender verwalten</Text>
          </View>

          {/* Add Button */}
          <BNMPressable
            style={[styles.addBtn, { backgroundColor: COLORS.gradientStart }]}
            onPress={() => setShowForm(!showForm)}
          >
            <Ionicons name={showForm ? "close" : "add"} size={18} color={COLORS.white} />
            <Text style={styles.addBtnText}>{showForm ? "Abbrechen" : "Neues Event"}</Text>
          </BNMPressable>

          {/* Create Form */}
          {showForm && (
            <View style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>TITEL *</Text>
              <TextInput style={inputStyle} value={formTitle} onChangeText={setFormTitle} placeholder="Event-Titel" placeholderTextColor={themeColors.textTertiary} />

              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>BESCHREIBUNG</Text>
              <TextInput style={[...inputStyle, styles.textArea]} value={formDescription} onChangeText={setFormDescription} placeholder="Beschreibung" placeholderTextColor={themeColors.textTertiary} multiline numberOfLines={3} />

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>STARTDATUM *</Text>
                  <TextInput style={inputStyle} value={formStartDate} onChangeText={setFormStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>STARTZEIT *</Text>
                  <TextInput style={inputStyle} value={formStartTime} onChangeText={setFormStartTime} placeholder="HH:MM" placeholderTextColor={themeColors.textTertiary} />
                </View>
              </View>

              <View style={styles.formRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ENDDATUM</Text>
                  <TextInput style={inputStyle} value={formEndDate} onChangeText={setFormEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textTertiary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ENDZEIT</Text>
                  <TextInput style={inputStyle} value={formEndTime} onChangeText={setFormEndTime} placeholder="HH:MM" placeholderTextColor={themeColors.textTertiary} />
                </View>
              </View>

              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>TYP</Text>
              <View style={styles.chipRow}>
                {EVENT_TYPES.map((tp) => (
                  <BNMPressable
                    key={tp}
                    style={[styles.chip, formType === tp ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => setFormType(tp)}
                  >
                    <Text style={formType === tp ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                      {TYPE_LABELS[tp]}
                    </Text>
                  </BNMPressable>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ORT</Text>
              <TextInput style={inputStyle} value={formLocation} onChangeText={setFormLocation} placeholder="Ort / Link" placeholderTextColor={themeColors.textTertiary} />

              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>SICHTBAR FÜR</Text>
              <View style={styles.chipRow}>
                {VISIBLE_OPTIONS.map((v) => (
                  <BNMPressable
                    key={v}
                    style={[styles.chip, formVisibleTo === v ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => setFormVisibleTo(v)}
                  >
                    <Text style={formVisibleTo === v ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                      {VISIBLE_LABELS[v]}
                    </Text>
                  </BNMPressable>
                ))}
              </View>

              <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>WIEDERHOLUNG</Text>
              <View style={styles.chipRow}>
                {RECURRENCE_OPTIONS.map((r) => (
                  <BNMPressable
                    key={r}
                    style={[styles.chip, formRecurrence === r ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                    onPress={() => setFormRecurrence(r)}
                  >
                    <Text style={formRecurrence === r ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                      {RECURRENCE_LABELS[r]}
                    </Text>
                  </BNMPressable>
                ))}
              </View>

              <BNMPressable
                style={[styles.saveBtn, { opacity: isSaving ? 0.6 : 1 }]}
                onPress={handleCreate}
                disabled={isSaving}
              >
                <Text style={styles.saveBtnText}>{isSaving ? "Speichern..." : "Event erstellen"}</Text>
              </BNMPressable>
            </View>
          )}

          {/* Event List */}
          {sorted.length === 0 && (
            <EmptyState icon="calendar-outline" title="Keine Events vorhanden" description="Erstelle ein neues Event oben." />
          )}

          {sorted.map((event) => {
            const isEditing = editingId === event.id;
            const showAttendees = expandedAttendees.has(event.id);

            if (isEditing) {
              return (
                <View key={event.id} style={[styles.formCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>TITEL</Text>
                  <TextInput style={inputStyle} value={editTitle} onChangeText={setEditTitle} />

                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>BESCHREIBUNG</Text>
                  <TextInput style={[...inputStyle, styles.textArea]} value={editDescription} onChangeText={setEditDescription} multiline numberOfLines={3} />

                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>STARTDATUM</Text>
                      <TextInput style={inputStyle} value={editStartDate} onChangeText={setEditStartDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>STARTZEIT</Text>
                      <TextInput style={inputStyle} value={editStartTime} onChangeText={setEditStartTime} placeholder="HH:MM" placeholderTextColor={themeColors.textTertiary} />
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ENDDATUM</Text>
                      <TextInput style={inputStyle} value={editEndDate} onChangeText={setEditEndDate} placeholder="YYYY-MM-DD" placeholderTextColor={themeColors.textTertiary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ENDZEIT</Text>
                      <TextInput style={inputStyle} value={editEndTime} onChangeText={setEditEndTime} placeholder="HH:MM" placeholderTextColor={themeColors.textTertiary} />
                    </View>
                  </View>

                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>TYP</Text>
                  <View style={styles.chipRow}>
                    {EVENT_TYPES.map((tp) => (
                      <BNMPressable
                        key={tp}
                        style={[styles.chip, editType === tp ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                        onPress={() => setEditType(tp)}
                      >
                        <Text style={editType === tp ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                          {TYPE_LABELS[tp]}
                        </Text>
                      </BNMPressable>
                    ))}
                  </View>

                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>ORT</Text>
                  <TextInput style={inputStyle} value={editLocation} onChangeText={setEditLocation} />

                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>SICHTBAR FÜR</Text>
                  <View style={styles.chipRow}>
                    {VISIBLE_OPTIONS.map((v) => (
                      <BNMPressable
                        key={v}
                        style={[styles.chip, editVisibleTo === v ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                        onPress={() => setEditVisibleTo(v)}
                      >
                        <Text style={editVisibleTo === v ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                          {VISIBLE_LABELS[v]}
                        </Text>
                      </BNMPressable>
                    ))}
                  </View>

                  <Text style={[styles.formLabel, { color: themeColors.textTertiary }]}>WIEDERHOLUNG</Text>
                  <View style={styles.chipRow}>
                    {RECURRENCE_OPTIONS.map((r) => (
                      <BNMPressable
                        key={r}
                        style={[styles.chip, editRecurrence === r ? styles.chipActive : { backgroundColor: themeColors.background, borderColor: themeColors.border }]}
                        onPress={() => setEditRecurrence(r)}
                      >
                        <Text style={editRecurrence === r ? styles.chipTextActive : [styles.chipTextInactive, { color: themeColors.textSecondary }]}>
                          {RECURRENCE_LABELS[r]}
                        </Text>
                      </BNMPressable>
                    ))}
                  </View>

                  <View style={styles.editActions}>
                    <BNMPressable style={[styles.saveBtn, { flex: 1, opacity: isSaving ? 0.6 : 1 }]} onPress={handleUpdate} disabled={isSaving}>
                      <Text style={styles.saveBtnText}>{isSaving ? "Speichern..." : "Speichern"}</Text>
                    </BNMPressable>
                    <BNMPressable style={[styles.cancelEditBtn, { borderColor: themeColors.border }]} onPress={() => setEditingId(null)}>
                      <Text style={[styles.cancelEditText, { color: themeColors.textSecondary }]}>Abbrechen</Text>
                    </BNMPressable>
                  </View>
                </View>
              );
            }

            return (
              <View key={event.id} style={[styles.eventItem, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                <View style={styles.eventItemHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.eventItemTitle, { color: themeColors.text }]}>{event.title}</Text>
                    <Text style={[styles.eventItemMeta, { color: themeColors.textSecondary }]}>
                      {new Date(event.start_at).toLocaleDateString("de-DE")} {event.start_at.slice(11, 16)}
                      {event.end_at ? ` - ${event.end_at.slice(11, 16)}` : ""}
                    </Text>
                    <View style={styles.eventItemTags}>
                      <View style={[styles.tag, { backgroundColor: COLORS.gradientStart + "20" }]}>
                        <Text style={[styles.tagText, { color: COLORS.gradientStart }]}>{TYPE_LABELS[event.type]}</Text>
                      </View>
                      <View style={[styles.tag, { backgroundColor: COLORS.gold + "20" }]}>
                        <Text style={[styles.tagText, { color: COLORS.gold }]}>{VISIBLE_LABELS[event.visible_to]}</Text>
                      </View>
                      {event.recurrence && (
                        <View style={[styles.tag, { backgroundColor: COLORS.cta + "20" }]}>
                          <Text style={[styles.tagText, { color: COLORS.cta }]}>{RECURRENCE_LABELS[event.recurrence]}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <View style={styles.eventItemActions}>
                    <BNMPressable onPress={() => startEdit(event)} style={styles.iconBtn}>
                      <Ionicons name="create-outline" size={18} color={COLORS.gradientStart} />
                    </BNMPressable>
                    <BNMPressable onPress={() => handleDelete(event.id, event.title)} style={styles.iconBtn}>
                      <Ionicons name="trash-outline" size={18} color={COLORS.error} />
                    </BNMPressable>
                  </View>
                </View>

                {event.location ? (
                  <Text style={[styles.eventItemLocation, { color: themeColors.textTertiary }]}>
                    <Ionicons name="location-outline" size={12} color={themeColors.textTertiary} /> {event.location}
                  </Text>
                ) : null}

                {/* Attendee toggle */}
                <BNMPressable
                  style={styles.attendeeToggle}
                  onPress={() => {
                    setExpandedAttendees((prev) => {
                      const next = new Set(prev);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    });
                  }}
                >
                  <Ionicons name={showAttendees ? "chevron-up" : "chevron-down"} size={16} color={themeColors.textTertiary} />
                  <Text style={[styles.attendeeToggleText, { color: themeColors.textTertiary }]}>
                    Teilnehmer ({eventAttendees.filter((a) => a.event_id === event.id).length})
                  </Text>
                </BNMPressable>

                {showAttendees && (
                  <AttendeeSection
                    eventId={event.id}
                    attendees={eventAttendees}
                    users={users}
                    onInviteMentors={() => handleInviteMentors(event.id)}
                    onInviteMentees={() => handleInviteMentees(event.id)}
                  />
                )}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Container>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  page: { padding: 24 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  accessDenied: { textAlign: "center", fontWeight: "600" },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 20,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: -0.3,
  },

  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    marginBottom: 16,
  },
  addBtnText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },

  // Form
  formCard: {
    borderRadius: RADIUS.lg,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
  },
  formLabel: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.8,
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  textArea: {
    minHeight: 70,
    textAlignVertical: "top",
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: COLORS.gradientStart,
    borderColor: COLORS.gradientStart,
  },
  chipTextActive: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 12,
  },
  chipTextInactive: {
    fontSize: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.gradientStart,
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: "700",
    fontSize: 14,
  },
  editActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  cancelEditBtn: {
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelEditText: {
    fontWeight: "600",
    fontSize: 13,
  },

  // Event Item
  eventItem: {
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    ...SHADOWS.sm,
  },
  eventItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eventItemTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  eventItemMeta: {
    fontSize: 13,
    marginBottom: 6,
  },
  eventItemTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.xs,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "600",
  },
  eventItemActions: {
    flexDirection: "row",
    gap: 4,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  eventItemLocation: {
    fontSize: 12,
    marginTop: 6,
  },

  // Attendee
  attendeeToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    marginTop: 4,
  },
  attendeeToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  attendeeSection: {
    borderTopWidth: 1,
    paddingTop: 10,
    marginTop: 4,
  },
  attendeeCount: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  inviteRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    flexWrap: "wrap",
  },
  inviteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.sm,
  },
  inviteBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
  attendeeList: {
    gap: 4,
  },
  attendeeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  attendeeName: {
    fontSize: 13,
    fontWeight: "500",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.xs,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
});
