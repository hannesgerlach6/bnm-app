import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { Container } from "../components/Container";
import { COLORS } from "../constants/Colors";
import { showSuccess } from "../lib/errorHandler";

// AsyncStorage — plattformunabhängig laden
let AsyncStorage: any = null;
if (Platform.OS !== "web") {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
}

const STORAGE_KEY = "bnm_notification_settings";

export interface NotificationSettings {
  chatMessages: boolean;
  assignments: boolean;
  applicationStatus: boolean;
  reminders: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  chatMessages: true,
  assignments: true,
  applicationStatus: true,
  reminders: true,
};

export async function loadNotificationSettings(): Promise<NotificationSettings> {
  try {
    if (Platform.OS === "web") {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    }
    if (!AsyncStorage) return DEFAULT_SETTINGS;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    const json = JSON.stringify(settings);
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEY, json);
      return;
    }
    if (!AsyncStorage) return;
    await AsyncStorage.setItem(STORAGE_KEY, json);
  } catch {
    // Speicherfehler ignorieren — App funktioniert ohne
  }
}

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then((s) => {
      setSettings(s);
      setLoaded(true);
    });
  }, []);

  const toggle = useCallback(
    (key: keyof NotificationSettings) => {
      setSettings((prev) => {
        const next = { ...prev, [key]: !prev[key] };
        saveNotificationSettings(next);
        return next;
      });
    },
    []
  );

  const handleSave = useCallback(async () => {
    await saveNotificationSettings(settings);
    showSuccess(t("notifSettings.saved"), () => router.back());
  }, [settings, t]);

  if (!loaded) return null;

  return (
    <Container fullWidth={Platform.OS === "web"}>
    <ScrollView
      style={[styles.scrollView, { backgroundColor: themeColors.background }]}
      contentContainerStyle={{ paddingBottom: 40 }}
    >
      {/* Header mit SafeArea-Padding */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: themeColors.card,
            borderBottomColor: themeColors.border,
            paddingTop: insets.top + 8,
          },
        ]}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={[styles.backText, { color: themeColors.text }]}>‹ {t("notifSettings.back")}</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.text }]}>
          {t("notifSettings.title")}
        </Text>
      </View>

      <View style={styles.page}>
        <Text style={[styles.subtitle, { color: themeColors.textSecondary }]}>
          {t("notifSettings.subtitle")}
        </Text>

        {/* Einzel-Toggles */}
        <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
          <ToggleRow
            label={t("notifSettings.chatMessages")}
            subtitle={t("notifSettings.chatMessagesSub")}
            value={settings.chatMessages}
            onToggle={() => toggle("chatMessages")}
            themeColors={themeColors}
          />
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <ToggleRow
            label={t("notifSettings.assignments")}
            subtitle={t("notifSettings.assignmentsSub")}
            value={settings.assignments}
            onToggle={() => toggle("assignments")}
            themeColors={themeColors}
          />
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <ToggleRow
            label={t("notifSettings.applicationStatus")}
            subtitle={t("notifSettings.applicationStatusSub")}
            value={settings.applicationStatus}
            onToggle={() => toggle("applicationStatus")}
            themeColors={themeColors}
          />
          <View style={[styles.divider, { backgroundColor: themeColors.border }]} />
          <ToggleRow
            label={t("notifSettings.reminders")}
            subtitle={t("notifSettings.remindersSub")}
            value={settings.reminders}
            onToggle={() => toggle("reminders")}
            themeColors={themeColors}
            isLast
          />
        </View>

        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: COLORS.gradientStart }]}
          onPress={handleSave}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>{t("common.save")}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
    </Container>
  );
}

function ToggleRow({
  label,
  subtitle,
  value,
  onToggle,
  themeColors,
  isLast,
}: {
  label: string;
  subtitle: string;
  value: boolean;
  onToggle: () => void;
  themeColors: ReturnType<typeof import("../contexts/ThemeContext").useThemeColors>;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, isLast && styles.toggleRowLast]}>
      <View style={styles.toggleTexts}>
        <Text style={[styles.toggleLabel, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.toggleSub, { color: themeColors.textSecondary }]}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: themeColors.border, true: COLORS.gradientStart }}
        thumbColor={COLORS.white}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backButton: { paddingVertical: 4, marginBottom: 4 },
  backText: { fontSize: 16 },
  headerTitle: { fontSize: 20, fontWeight: "700" },
  page: { padding: 16 },
  subtitle: { fontSize: 13, marginBottom: 20, lineHeight: 18 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 24,
  },
  divider: { height: 1, marginHorizontal: 16 },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  toggleRowLast: {},
  toggleTexts: { flex: 1 },
  toggleLabel: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  toggleSub: { fontSize: 12, lineHeight: 16 },
  saveButton: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
});
