import React, { useState, useMemo, useCallback } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BNMPressable } from "./BNMPressable";
import { Ionicons } from "@expo/vector-icons";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS, RADIUS } from "../constants/Colors";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CalendarViewEvent {
  date: string; // YYYY-MM-DD
  type: "event" | "session" | "milestone";
  title: string;
}

interface CalendarViewProps {
  events: CalendarViewEvent[];
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function getMonthName(month: number): string {
  const names = [
    "Januar", "Februar", "März", "April", "Mai", "Juni",
    "Juli", "August", "September", "Oktober", "November", "Dezember",
  ];
  return names[month];
}

function getMonthDays(year: number, month: number) {
  // Get first day of month (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDay = new Date(year, month, 1).getDay();
  // Convert to Monday-start (0=Mon, ..., 6=Sun)
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const days: Array<{ day: number; month: number; year: number; isCurrentMonth: boolean }> = [];

  // Previous month days
  for (let i = startOffset - 1; i >= 0; i--) {
    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;
    days.push({ day: daysInPrevMonth - i, month: prevMonth, year: prevYear, isCurrentMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    days.push({ day: d, month, year, isCurrentMonth: true });
  }

  // Next month days to fill 6 rows (42 cells)
  const remaining = 42 - days.length;
  for (let d = 1; d <= remaining; d++) {
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    days.push({ day: d, month: nextMonth, year: nextYear, isCurrentMonth: false });
  }

  return days;
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// ─── Dot colors ─────────────────────────────────────────────────────────────

const DOT_COLORS: Record<string, string> = {
  event: COLORS.gold,
  session: COLORS.gradientStart,
  milestone: COLORS.cta,
};

// ─── Component ──────────────────────────────────────────────────────────────

export function CalendarView({ events, selectedDate, onSelectDate, onMonthChange }: CalendarViewProps) {
  const themeColors = useThemeColors();
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const days = useMemo(() => getMonthDays(viewYear, viewMonth), [viewYear, viewMonth]);

  // Build a map: dateStr -> set of event types
  const eventMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    events.forEach((e) => {
      if (!map[e.date]) map[e.date] = new Set();
      map[e.date].add(e.type);
    });
    return map;
  }, [events]);

  const goToPrevMonth = useCallback(() => {
    let m = viewMonth - 1;
    let y = viewYear;
    if (m < 0) { m = 11; y--; }
    setViewMonth(m);
    setViewYear(y);
    onMonthChange?.(y, m);
  }, [viewMonth, viewYear, onMonthChange]);

  const goToNextMonth = useCallback(() => {
    let m = viewMonth + 1;
    let y = viewYear;
    if (m > 11) { m = 0; y++; }
    setViewMonth(m);
    setViewYear(y);
    onMonthChange?.(y, m);
  }, [viewMonth, viewYear, onMonthChange]);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      {/* Month Navigation */}
      <View style={styles.header}>
        <BNMPressable onPress={goToPrevMonth} style={styles.navBtn} accessibilityLabel="Vorheriger Monat">
          <Ionicons name="chevron-back" size={20} color={themeColors.text} />
        </BNMPressable>
        <Text style={[styles.monthLabel, { color: themeColors.text }]}>
          {getMonthName(viewMonth)} {viewYear}
        </Text>
        <BNMPressable onPress={goToNextMonth} style={styles.navBtn} accessibilityLabel="Naechster Monat">
          <Ionicons name="chevron-forward" size={20} color={themeColors.text} />
        </BNMPressable>
      </View>

      {/* Weekday Headers */}
      <View style={styles.weekdayRow}>
        {WEEKDAYS.map((wd) => (
          <View key={wd} style={styles.weekdayCell}>
            <Text style={[styles.weekdayText, { color: themeColors.textTertiary }]}>{wd}</Text>
          </View>
        ))}
      </View>

      {/* Day Grid (6 rows x 7 cols) */}
      <View style={styles.grid}>
        {days.map((d, idx) => {
          const dateStr = toDateStr(d.year, d.month, d.day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const isCurrentMonth = d.isCurrentMonth;
          const dotTypes = eventMap[dateStr];

          return (
            <BNMPressable
              key={idx}
              style={[
                styles.dayCell,
                isSelected && { backgroundColor: COLORS.gold + "30" },
              ]}
              onPress={() => onSelectDate(dateStr)}
              accessibilityLabel={`${d.day}. ${getMonthName(d.month)} ${d.year}`}
            >
              <View style={[
                styles.dayNumberWrap,
                isToday && styles.todayCircle,
              ]}>
                <Text style={[
                  styles.dayNumber,
                  { color: isCurrentMonth ? themeColors.text : themeColors.textTertiary + "60" },
                  isToday && styles.todayText,
                  isSelected && { fontWeight: "700" },
                ]}>
                  {d.day}
                </Text>
              </View>
              {/* Event Dots */}
              {dotTypes && dotTypes.size > 0 && (
                <View style={styles.dotRow}>
                  {Array.from(dotTypes).slice(0, 3).map((type) => (
                    <View
                      key={type}
                      style={[styles.dot, { backgroundColor: DOT_COLORS[type] || COLORS.gold }]}
                    />
                  ))}
                </View>
              )}
            </BNMPressable>
          );
        })}
      </View>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
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
  todayCircle: {
    backgroundColor: COLORS.gradientStart,
  },
  dayNumber: {
    fontSize: 13,
    fontWeight: "500",
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
