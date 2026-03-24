import { Platform } from "react-native";
import { supabase } from "./supabase";

// Expo-APIs nur auf Native importieren — auf Web nicht verfügbar
let Notifications: any = null;
let Device: any = null;
let Constants: any = null;

if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
  Device = require("expo-device");
  Constants = require("expo-constants");
}

// Notification Handler: Verhalten wenn App im Vordergrund ist
if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

/**
 * Push Token vom Expo-Service holen und in der DB (profiles.push_token) speichern.
 * Gibt den Token zurück oder null (Web / kein echtes Gerät / Berechtigung verweigert).
 */
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  // Web und Simulator überspringen
  if (Platform.OS === "web" || !Device || !Notifications || !Constants) {
    return null;
  }

  if (!Device.isDevice) {
    // Im Simulator keine Push Tokens verfügbar
    return null;
  }

  // Bestehende Berechtigung prüfen
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  // Project ID aus app.json/app.config.ts lesen
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;

  if (!projectId) {
    // Kein EAS Project ID konfiguriert — lokal (Expo Go) trotzdem versuchen
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      const token = tokenData.data;

      await supabase
        .from("profiles")
        .update({ push_token: token })
        .eq("id", userId);

      return token;
    } catch {
      return null;
    }
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;

    await supabase
      .from("profiles")
      .update({ push_token: token })
      .eq("id", userId);

    return token;
  } catch {
    return null;
  }
}

/**
 * Push Token aus der DB entfernen (beim Logout).
 */
export async function unregisterPushToken(userId: string): Promise<void> {
  if (Platform.OS === "web") return;

  await supabase
    .from("profiles")
    .update({ push_token: null })
    .eq("id", userId);
}

// ============================================================
// Notification Settings — lokal gespeichert (AsyncStorage)
// ============================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

const SETTINGS_KEY = "bnm_notification_settings";

export interface NotificationSettings {
  chatMessages: boolean;
  assignments: boolean;
  applicationStatus: boolean;
  reminders: boolean;
  feedback: boolean;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  chatMessages: true,
  assignments: true,
  applicationStatus: true,
  reminders: true,
  feedback: true,
};

export async function getNotificationSettings(): Promise<NotificationSettings> {
  try {
    const stored = await AsyncStorage.getItem(SETTINGS_KEY);
    if (stored) return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export async function saveNotificationSettings(settings: NotificationSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {}
}

/**
 * Sofortige lokale Notification anzeigen (Foreground-Fallback).
 * Prüft ob die Kategorie in den Settings aktiviert ist.
 */
export async function sendLocalNotification(
  title: string,
  body: string,
  category?: keyof NotificationSettings
): Promise<void> {
  if (Platform.OS === "web" || !Notifications) return;

  if (category) {
    const settings = await getNotificationSettings();
    if (!settings[category]) return;
  }

  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null,
  });
}

// ============================================================
// Convenience-Funktionen für verschiedene Events
// ============================================================

export async function notifyNewMessage(senderName: string, preview: string): Promise<void> {
  const text = preview.length > 80 ? preview.substring(0, 80) + "..." : preview;
  await sendLocalNotification(`Neue Nachricht von ${senderName}`, text, "chatMessages");
}

export async function notifyMentorAssigned(mentorName: string): Promise<void> {
  await sendLocalNotification("Mentor zugewiesen", `${mentorName} wurde dir als Mentor zugewiesen.`, "assignments");
}

export async function notifyMenteeAssigned(menteeName: string): Promise<void> {
  await sendLocalNotification("Neuer Mentee", `${menteeName} wurde dir als Mentee zugewiesen.`, "assignments");
}

export async function notifyMentorshipCompleted(menteeName: string): Promise<void> {
  await sendLocalNotification("Betreuung abgeschlossen", `Die Betreuung von ${menteeName} wurde erfolgreich abgeschlossen.`, "feedback");
}

export async function notifyFeedbackRequested(mentorName: string): Promise<void> {
  await sendLocalNotification("Feedback gewünscht", `Bitte gib Feedback zu deiner Betreuung mit ${mentorName}.`, "feedback");
}
