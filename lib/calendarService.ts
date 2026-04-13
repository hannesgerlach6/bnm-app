import { Platform, Alert, Linking } from "react-native";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import type { CalendarEvent } from "../types";

// ============================================================
// Calendar Service — iCal Export + Google Calendar OAuth Sync
// ============================================================
// Tokens werden in profiles.google_calendar_token (Supabase) gespeichert
// → bleibt über Browser/Gerätewechsel hinweg verbunden.
// Fallback: AsyncStorage / localStorage
// ============================================================

// ─── Konfiguration ─────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID     ?? "";
const GOOGLE_CLIENT_SECRET = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET ?? "";

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const SCOPES = "https://www.googleapis.com/auth/calendar.events";

const STORAGE_KEY_ACCESS  = "google_access_token";
const STORAGE_KEY_REFRESH = "google_refresh_token";

// ─── Token-Persistenz (DB + lokaler Fallback) ──────────────────────────────────

/** Tokens in Supabase profiles + lokal speichern */
export async function saveGoogleTokens(
  accessToken: string,
  refreshToken: string,
  userId?: string
): Promise<void> {
  // Lokal speichern (Fallback + schneller Zugriff)
  try {
    if (Platform.OS === "web") {
      localStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
      localStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    } else {
      await AsyncStorage.setItem(STORAGE_KEY_ACCESS, accessToken);
      await AsyncStorage.setItem(STORAGE_KEY_REFRESH, refreshToken);
    }
  } catch { /* ignorieren */ }

  // In Supabase DB speichern (persistent über Geräte/Browser)
  if (userId) {
    await supabase
      .from("profiles")
      .update({ google_calendar_token: { access_token: accessToken, refresh_token: refreshToken } })
      .eq("id", userId);
  }
}

/** Tokens laden — DB hat Vorrang, lokaler Fallback wenn nicht eingeloggt */
export async function loadGoogleTokens(
  userId?: string
): Promise<{ accessToken: string | null; refreshToken: string | null }> {
  // Aus Supabase DB laden (persistent)
  if (userId) {
    const { data } = await supabase
      .from("profiles")
      .select("google_calendar_token")
      .eq("id", userId)
      .single();

    const token = data?.google_calendar_token as { access_token?: string; refresh_token?: string } | null;
    if (token?.access_token) {
      // Auch lokal cachen
      try {
        if (Platform.OS === "web") {
          localStorage.setItem(STORAGE_KEY_ACCESS,  token.access_token);
          localStorage.setItem(STORAGE_KEY_REFRESH, token.refresh_token ?? "");
        } else {
          await AsyncStorage.setItem(STORAGE_KEY_ACCESS,  token.access_token);
          await AsyncStorage.setItem(STORAGE_KEY_REFRESH, token.refresh_token ?? "");
        }
      } catch { /* ignorieren */ }
      return { accessToken: token.access_token, refreshToken: token.refresh_token ?? null };
    }
  }

  // Lokaler Fallback
  try {
    if (Platform.OS === "web") {
      return {
        accessToken: localStorage.getItem(STORAGE_KEY_ACCESS),
        refreshToken: localStorage.getItem(STORAGE_KEY_REFRESH),
      };
    } else {
      return {
        accessToken: await AsyncStorage.getItem(STORAGE_KEY_ACCESS),
        refreshToken: await AsyncStorage.getItem(STORAGE_KEY_REFRESH),
      };
    }
  } catch {
    return { accessToken: null, refreshToken: null };
  }
}

export async function clearGoogleTokens(userId?: string): Promise<void> {
  // Lokal löschen
  try {
    if (Platform.OS === "web") {
      localStorage.removeItem(STORAGE_KEY_ACCESS);
      localStorage.removeItem(STORAGE_KEY_REFRESH);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEY_ACCESS);
      await AsyncStorage.removeItem(STORAGE_KEY_REFRESH);
    }
  } catch { /* ignorieren */ }

  // In DB löschen
  if (userId) {
    await supabase
      .from("profiles")
      .update({ google_calendar_token: null })
      .eq("id", userId);
  }
}

// ─── Hilfsfunktionen ───────────────────────────────────────────────────────────

function toGoogleDateFormat(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function toICalDateFormat(isoDate: string): string {
  return new Date(isoDate).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function getEndDate(startAt: string, endAt?: string | null): string {
  if (endAt) return endAt;
  const d = new Date(startAt);
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

// ─── 1. iCal Export ────────────────────────────────────────────────────────────

export function generateICalEvent(event: {
  title: string;
  description?: string;
  start_at: string;
  end_at?: string | null;
  location?: string;
}): string {
  const dtStart = toICalDateFormat(event.start_at);
  const dtEnd   = toICalDateFormat(getEndDate(event.start_at, event.end_at));
  const uid     = `${Date.now()}-${Math.random().toString(36).slice(2)}@bnm-app`;
  const now     = toICalDateFormat(new Date().toISOString());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//BNM-App//BNM Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICalText(event.title)}`,
  ];

  if (event.description) lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  if (event.location)    lines.push(`LOCATION:${escapeICalText(event.location)}`);

  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}

export function generateGoogleCalendarUrl(event: {
  title: string;
  description?: string;
  start_at: string;
  end_at?: string | null;
  location?: string;
}): string {
  const dtStart = toGoogleDateFormat(event.start_at);
  const dtEnd   = toGoogleDateFormat(getEndDate(event.start_at, event.end_at));

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text:   event.title,
    dates:  `${dtStart}/${dtEnd}`,
  });

  if (event.description) params.set("details", event.description);
  if (event.location)    params.set("location", event.location);

  return `https://calendar.google.com/calendar/event?${params.toString()}`;
}

export function downloadICalFile(event: {
  title: string;
  description?: string;
  start_at: string;
  end_at?: string | null;
  location?: string;
}): void {
  if (Platform.OS !== "web") return;

  const icsContent = generateICalEvent(event);
  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const filename = `${event.title.replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, "").replace(/\s+/g, "-")}.ics`;

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}

// ─── 2. Google OAuth ───────────────────────────────────────────────────────────

/** Auth-Code gegen Access + Refresh Token tauschen */
async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string } | null> {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    "authorization_code",
      }).toString(),
    });

    if (!res.ok) {
      console.error("[calendarService] Token-Tausch fehlgeschlagen:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    if (!data.access_token) return null;

    return {
      accessToken:  data.access_token,
      refreshToken: data.refresh_token ?? "",
    };
  } catch (err) {
    console.error("[calendarService] exchangeCodeForTokens Fehler:", err);
    return null;
  }
}

function buildAuthUrl(redirectUri: string): string {
  const params = new URLSearchParams({
    client_id:     GOOGLE_CLIENT_ID,
    redirect_uri:  redirectUri,
    response_type: "code",
    scope:         SCOPES,
    access_type:   "offline",
    prompt:        "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Startet den Google OAuth Flow — Web + Native.
 * Gibt Tokens zurück oder null wenn abgebrochen/fehlgeschlagen.
 * Tokens werden automatisch in DB + lokal gespeichert.
 */
export async function initiateGoogleAuth(userId?: string): Promise<{
  accessToken: string;
  refreshToken: string;
} | null> {
  try {
    // ── Web ──────────────────────────────────────────────────────────────────
    if (Platform.OS === "web") {
      const redirectUri = `${window.location.origin}/auth/google/callback`;
      const authUrl     = buildAuthUrl(redirectUri);

      return new Promise((resolve) => {
        const popup = window.open(authUrl, "google-auth", "width=500,height=600");
        if (!popup) {
          Alert.alert("Fehler", "Popup wurde blockiert. Bitte Popup-Blocker deaktivieren.");
          resolve(null);
          return;
        }

        const handleMessage = async (e: MessageEvent) => {
          if (e.data?.type === "google-auth-callback" && e.data?.code) {
            window.removeEventListener("message", handleMessage);
            const tokens = await exchangeCodeForTokens(e.data.code, redirectUri);
            if (tokens) await saveGoogleTokens(tokens.accessToken, tokens.refreshToken, userId);
            resolve(tokens);
          }
        };
        window.addEventListener("message", handleMessage);

        const checkClosed = setInterval(() => {
          if (popup.closed) {
            clearInterval(checkClosed);
            window.removeEventListener("message", handleMessage);
            resolve(null);
          }
        }, 1000);
      });

    // ── Native (iOS + Android) ───────────────────────────────────────────────
    } else {
      // Redirect URI: gleiche Web-URL — kein Custom Scheme nötig.
      // expo-web-browser fängt die URL ab sobald Google dorthin redirectet.
      // Muss in Google Cloud Console als "Authorized redirect URI" eingetragen sein:
      //   https://bnm.iman.ngo/auth/google/callback  ← bereits eingetragen
      const redirectUri = "https://bnm.iman.ngo/auth/google/callback";
      const authUrl     = buildAuthUrl(redirectUri);

      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

      if (result.type !== "success" || !result.url) {
        if (result.type === "cancel") return null;
        Alert.alert(
          "Google Calendar",
          "Verbindung fehlgeschlagen. Stelle sicher, dass du mit deinem Google-Account eingeloggt bist."
        );
        return null;
      }

      // Auth-Code aus Redirect-URL extrahieren
      let code: string | null = null;
      try {
        const url = new URL(result.url);
        code = url.searchParams.get("code");
      } catch {
        // Fallback: URL manuell parsen
        const match = result.url.match(/[?&]code=([^&]+)/);
        code = match ? decodeURIComponent(match[1]) : null;
      }

      if (!code) {
        console.error("[calendarService] Kein Auth-Code in Redirect-URL:", result.url);
        return null;
      }

      const tokens = await exchangeCodeForTokens(code, redirectUri);
      if (tokens) await saveGoogleTokens(tokens.accessToken, tokens.refreshToken, userId);
      return tokens;
    }
  } catch (err) {
    console.error("[calendarService] initiateGoogleAuth Fehler:", err);
    return null;
  }
}

// ─── 3. Google Calendar API ────────────────────────────────────────────────────

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  start: string;     // ISO datetime oder YYYY-MM-DD (ganztägig)
  end: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  isAllDay: boolean;
}

/**
 * Lädt alle Events aus dem primären Google Calendar des Users.
 * Standardmäßig: aktueller Monat ±1 Monat.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin?: string,
  timeMax?: string
): Promise<GoogleCalendarEvent[]> {
  if (!accessToken) return [];

  const now = new Date();
  const min = timeMin ?? new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const max = timeMax ?? new Date(now.getFullYear(), now.getMonth() + 2, 1).toISOString();

  try {
    const params = new URLSearchParams({
      timeMin:      min,
      timeMax:      max,
      singleEvents: "true",
      orderBy:      "startTime",
      maxResults:   "250",
    });

    const res = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events?${params.toString()}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status !== 401) {
        console.error("[calendarService] fetchGoogleCalendarEvents:", res.status);
      }
      return [];
    }

    const data = await res.json();
    return (data.items ?? []).map((item: any): GoogleCalendarEvent => {
      const isAllDay = !!item.start?.date && !item.start?.dateTime;
      return {
        id:          item.id,
        title:       item.summary || "(kein Titel)",
        start:       item.start?.dateTime ?? item.start?.date ?? "",
        end:         item.end?.dateTime   ?? item.end?.date   ?? "",
        description: item.description,
        location:    item.location,
        htmlLink:    item.htmlLink,
        isAllDay,
      };
    });
  } catch (err) {
    console.error("[calendarService] fetchGoogleCalendarEvents Fehler:", err);
    return [];
  }
}

/**
 * Synchronisiert ein Event zum Google Calendar des Users.
 * Gibt die Google Event ID zurück.
 */
export async function syncEventToGoogle(
  event: CalendarEvent,
  accessToken: string
): Promise<string | null> {
  if (!accessToken) return null;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10_000);

    const googleEvent = {
      summary:     event.title,
      description: event.description || "",
      location:    event.location    || "",
      start: { dateTime: event.start_at,                          timeZone: "Europe/Berlin" },
      end:   { dateTime: getEndDate(event.start_at, event.end_at), timeZone: "Europe/Berlin" },
    };

    const res = await fetch(`${GOOGLE_CALENDAR_API}/calendars/primary/events`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body:   JSON.stringify(googleEvent),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) {
      // 401 → Token abgelaufen
      if (res.status === 401) return null;
      console.error("[calendarService] Google Sync fehlgeschlagen:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.id as string;
  } catch (err: any) {
    if (err?.name === "AbortError") console.error("[calendarService] Google Sync Timeout");
    else console.error("[calendarService] syncEventToGoogle Fehler:", err);
    return null;
  }
}

/**
 * Löscht ein Event aus dem Google Calendar.
 */
export async function removeEventFromGoogle(
  googleEventId: string,
  accessToken: string
): Promise<void> {
  if (!accessToken || !googleEventId) return;

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 10_000);

    await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/primary/events/${encodeURIComponent(googleEventId)}`,
      {
        method:  "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
        signal:  controller.signal,
      }
    );
    clearTimeout(timeout);
  } catch (err: any) {
    if (err?.name !== "AbortError") console.error("[calendarService] removeEventFromGoogle Fehler:", err);
  }
}

/**
 * Erneuert ein abgelaufenes Google Access Token via Refresh Token.
 */
export async function refreshGoogleToken(refreshToken: string): Promise<string | null> {
  if (!refreshToken) return null;

  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method:  "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        grant_type:    "refresh_token",
        refresh_token: refreshToken,
      }).toString(),
    });

    if (!res.ok) return null;

    const data = await res.json();
    if (data.access_token) {
      await saveGoogleTokens(data.access_token, refreshToken, undefined);
    }
    return data.access_token ?? null;
  } catch (err) {
    console.error("[calendarService] refreshGoogleToken Fehler:", err);
    return null;
  }
}

/**
 * Gibt ein gültiges Access Token zurück — erneuert automatisch falls abgelaufen.
 * userId optional für DB-Abfrage statt nur lokalem Storage.
 */
export async function getValidAccessToken(userId?: string): Promise<string | null> {
  const { accessToken, refreshToken } = await loadGoogleTokens(userId);
  if (!accessToken) return null;

  // Prüfen ob Token noch gültig (einfacher Test via Tokeninfo)
  try {
    const res = await fetch(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${accessToken}`
    );
    if (res.ok) return accessToken;
  } catch { /* Netzwerkfehler — Token trotzdem versuchen */ }

  // Token abgelaufen → erneuern
  if (refreshToken) {
    return await refreshGoogleToken(refreshToken);
  }

  return null;
}
