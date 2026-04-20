import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BNMPressable } from "./BNMPressable";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS, RADIUS } from "../constants/Colors";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarViewEvent {
  date: string; // YYYY-MM-DD
  type: "event" | "session" | "milestone" | "google";
  title: string;
}

interface CalendarViewProps {
  events: CalendarViewEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

type ViewMode = "month" | "week";

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS     = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES  = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

function getMonthName(month: number): string {
  return MONTH_NAMES[month];
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function fromDateStr(str: string): Date {
  return new Date(str + "T00:00:00");
}

/** Gibt den Montag der Woche zurück, in der `date` liegt. */
function getWeekMonday(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=So
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function getMonthDays(year: number, month: number) {
  const firstDay      = new Date(year, month, 1).getDay();
  const startOffset   = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const daysInPrev    = new Date(year, month, 0).getDate();

  const days: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean }> = [];

  for (let i = startOffset - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    days.push({ day: daysInPrev - i, month: pm, year: py, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, month, year, isCurrentMonth: true });
  }
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nm = month === 11 ? 0 : month + 1;
    const ny = month === 11 ? year + 1 : year;
    days.push({ day: d, month: nm, year: ny, isCurrentMonth: false });
  }
  return days;
}

// ─── Dot colors ─────────────────────────────────────────────────────────────

const DOT_COLORS: Record<string, string> = {
  event:     COLORS.gold,
  session:   COLORS.gradientStart,
  milestone: COLORS.cta,
  google:    "#4285F4",
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CalendarView({ events, selectedDate, onSelectDate, onMonthChange }: CalendarViewProps) {
  const themeColors = useThemeColors();
  const today    = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewMode,  setViewMode]  = useState<ViewMode>("month");
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [weekStart, setWeekStart] = useState(() => getWeekMonday(today));

  // ── Event-Map: dateStr → Set<type> ────────────────────────────────────────
  const eventMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = new Set();
      map[e.date].add(e.type);
    });
    return map;
  }, [events]);

  // ── Monatsnavigation ──────────────────────────────────────────────────────
  const goToPrevMonth = useCallback(() => {
    let m = viewMonth - 1, y = viewYear;
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
    onMonthChange?.(y, m);
  }, [viewMonth, viewYear, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    let m = viewMonth + 1, y = viewYear;
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
    onMonthChange?.(y, m);
  }, [viewMonth, viewYear, onMonthChange]);

  // ── Wochennavigation ──────────────────────────────────────────────────────
  const goToPrevWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 7);
      return d;
    });
  }, []);

  const goToNextWeek = useCallback(() => {
    setWeekStart((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 7);
      return d;
    });
  }, []);

  // ── Wochentage (7 Tage ab Montag) ─────────────────────────────────────────
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const weekLabel = useMemo(() => {
    const s = weekDays[0];
    const e = weekDays[6];
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}. – ${e.getDate()}. ${getMonthName(e.getMonth())} ${e.getFullYear()}`;
    }
    return `${s.getDate()}. ${getMonthName(s.getMonth())} – ${e.getDate()}. ${getMonthName(e.getMonth())} ${e.getFullYear()}`;
  }, [weekDays]);

  // ── Wochenmodus: Ansicht auf heutigen Tag zurücksetzen ────────────────────
  const switchToWeek = useCallback(() => {
    const base = selectedDate ? fromDateStr(selectedDate) : today;
    setWeekStart(getWeekMonday(base));
    setViewMode("week");
  }, [selectedDate]);

  const switchToMonth = useCallback(() => {
    const base = selectedDate ? fromDateStr(selectedDate) : today;
    setViewYear(base.getFullYear());
    setViewMonth(base.getMonth());
    setViewMode("month");
  }, [selectedDate]);

  // ── Monats-Grid ──────────────────────────────────────────────────────────
  const monthDays = useMemo(
    () => getMonthDays(viewYear, viewMonth),
    [viewYear, viewMonth]
  );

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <View style={styles.header}>
        <BNMPressable
          onPress={viewMode === "month" ? goToPrevMonth : goToPrevWeek}
          style={styles.navBtn}
          accessibilityLabel="Zurück"
        >
          <Ionicons name="chevron-back" size={20} color={themeColors.text} />
        </BNMPressable>

        <Text style={[styles.monthLabel, { color: themeColors.text }]}>
          {viewMode === "month"
            ? `${getMonthName(viewMonth)} ${viewYear}`
            : weekLabel}
        </Text>

        <BNMPressable
          onPress={viewMode === "month" ? goToNextMonth : goToNextWeek}
          style={styles.navBtn}
          accessibilityLabel="Vorwärts"
        >
          <Ionicons name="chevron-forward" size={20} color={themeColors.text} />
        </BNMPressable>
      </View>

      {/* ── Monat / Woche Toggle ────────────────────────────────────────── */}
      <View style={styles.toggleRow}>
        <BNMPressable
          style={[
            styles.toggleBtn,
            viewMode === "month" && { backgroundColor: COLORS.gold + "20", borderColor: COLORS.gold + "60" },
            viewMode !== "month" && { borderColor: themeColors.border },
          ]}
          onPress={switchToMonth}
        >
          <Text style={[
            styles.toggleText,
            { color: viewMode === "month" ? COLORS.goldDeep : themeColors.textSecondary },
          ]}>
            Monat
          </Text>
        </BNMPressable>
        <BNMPressable
          style={[
            styles.toggleBtn,
            viewMode === "week" && { backgroundColor: COLORS.gold + "20", borderColor: COLORS.gold + "60" },
            viewMode !== "week" && { borderColor: themeColors.border },
          ]}
          onPress={switchToWeek}
        >
          <Text style={[
            styles.toggleText,
            { color: viewMode === "week" ? COLORS.goldDeep : themeColors.textSecondary },
          ]}>
            Woche
          </Text>
        </BNMPressable>
      </View>

      {/* ── Monatsansicht ───────────────────────────────────────────────── */}
      {viewMode === "month" && (
        <>
          <View style={styles.weekdayRow}>
            {WEEKDAYS.map((wd) => (
              <View key={wd} style={styles.weekdayCell}>
                <Text style={[styles.weekdayText, { color: themeColors.textTertiary }]}>{wd}</Text>
              </View>
            ))}
          </View>

          <View style={styles.grid}>
            {monthDays.map((d, idx) => {
              const dateStr    = toDateStr(d.year, d.month, d.day);
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const dotTypes   = eventMap[dateStr];

              return (
                <BNMPressable
                  key={idx}
                  style={[styles.dayCell, isSelected && { backgroundColor: COLORS.gold + "30" }]}
                  onPress={() => onSelectDate(dateStr)}
                  accessibilityLabel={`${d.day}. ${getMonthName(d.month)} ${d.year}`}
                >
                  <View style={[styles.dayNumberWrap, isToday && styles.todayCircle]}>
                    <Text style={[
                      styles.dayNumber,
                      { color: d.isCurrentMonth ? themeColors.text : themeColors.textTertiary + "50" },
                      isToday    && styles.todayText,
                      isSelected && { fontWeight: "700" },
                    ]}>
                      {d.day}
                    </Text>
                  </View>
                  {dotTypes && dotTypes.size > 0 && (
                    <View style={styles.dotRow}>
                      {Array.from(dotTypes).slice(0, 3).map((type) => (
                        <View key={type} style={[styles.dot, { backgroundColor: DOT_COLORS[type] || COLORS.gold }]} />
                      ))}
                    </View>
                  )}
                </BNMPressable>
              );
            })}
          </View>
        </>
      )}

      {/* ── Wochenansicht ───────────────────────────────────────────────── */}
      {viewMode === "week" && (
        <View style={styles.weekGrid}>
          {weekDays.map((d, idx) => {
            const dateStr    = toDateStr(d.getFullYear(), d.getMonth(), d.getDate());
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dotTypes   = eventMap[dateStr];
            const isWeekend  = idx >= 5; // Sa, So

            return (
              <BNMPressable
                key={idx}
                style={[
                  styles.weekDayCell,
                  { borderColor: themeColors.border },
                  isSelected && { backgroundColor: COLORS.gold + "25", borderColor: COLORS.gold + "80" },
                  isToday    && !isSelected && { borderColor: COLORS.gradientStart + "80" },
                ]}
                onPress={() => onSelectDate(dateStr)}
                accessibilityLabel={`${WEEKDAYS[idx]}, ${d.getDate()}. ${getMonthName(d.getMonth())}`}
              >
                {/* Wochentagname */}
                <Text style={[
                  styles.weekDayName,
                  { color: isWeekend ? themeColors.textTertiary : themeColors.textSecondary },
                  isSelected && { color: COLORS.goldDeep },
                ]}>
                  {WEEKDAYS[idx]}
                </Text>

                {/* Tag-Nummer */}
                <View style={[styles.weekDayNumberWrap, isToday && styles.todayCircle]}>
                  <Text style={[
                    styles.weekDayNumber,
                    { color: themeColors.text },
                    isToday    && styles.todayText,
                    isSelected && { color: COLORS.goldDeep, fontWeight: "700" },
                    isWeekend  && !isToday && !isSelected && { color: themeColors.textTertiary },
                  ]}>
                    {d.getDate()}
                  </Text>
                </View>

                {/* Monat (nur wenn Wochenbeginn oder 1. des Monats) */}
                {(idx === 0 || d.getDate() === 1) && (
                  <Text style={[styles.weekMonthHint, { color: themeColors.textTertiary }]}>
                    {getMonthName(d.getMonth()).slice(0, 3)}
                  </Text>
                )}

                {/* Event-Dots */}
                {dotTypes && dotTypes.size > 0 && (
                  <View style={styles.weekDotRow}>
                    {Array.from(dotTypes).slice(0, 3).map((type) => (
                      <View key={type} style={[styles.dot, { backgroundColor: DOT_COLORS[type] || COLORS.gold }]} />
                    ))}
                  </View>
                )}
              </BNMPressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: "700",
    letterSpacing: -0.2,
    flex: 1,
    textAlign: "center",
  },

  // Toggle
  toggleRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  toggleText: {
    fontSize: 12,
    fontWeight: "600",
  },

  // Month view
  weekdayRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  weekdayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  weekdayText: {
    fontSize: 11,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  dayCell: {
    width: "14.2857%",
    ...(Platform.OS === "web"
      ? { height: 44 }
      : { aspectRatio: 1 }),
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.xs,
  },
  dayNumberWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "500",
  },

  // Week view
  weekGrid: {
    flexDirection: "row",
    gap: 4,
  },
  weekDayCell: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    minHeight: 88,
    gap: 4,
  },
  weekDayName: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  weekDayNumberWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  weekDayNumber: {
    fontSize: 15,
    fontWeight: "600",
  },
  weekMonthHint: {
    fontSize: 9,
    fontWeight: "500",
  },
  weekDotRow: {
    flexDirection: "row",
    gap: 2,
    marginTop: 2,
  },

  // Shared
  todayCircle: {
    backgroundColor: COLORS.gradientStart,
  },
  todayText: {
    color: COLORS.white,
    fontWeight: "700",
  },
  dotRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
});
