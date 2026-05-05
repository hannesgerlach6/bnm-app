/**
 * sentryService.ts
 *
 * Optionaler Sentry-Wrapper. Sentry wird NUR initialisiert wenn ein DSN
 * in der app_settings-Tabelle eingetragen ist (Admin-Einstellung).
 * Kein DSN → alle Funktionen sind No-Ops, kein Fehler, kein Tracking.
 *
 * Verwendung:
 *   initSentry("https://xxx@sentry.io/yyy")   // beim App-Start nach Settings-Load
 *   captureException(error)                    // in catch-Blöcken
 *   captureMessage("etwas ist passiert")       // für Warnungen
 *   setUser({ id, email, role })               // nach Login
 *   clearUser()                                // nach Logout
 */

import { Platform } from "react-native";

// Lazy-geladen damit der Import den Bundle auf Web nicht aufbläht
type SentryType = typeof import("@sentry/react-native");
let Sentry: SentryType | null = null;
let _initialized = false;

function getSentry(): SentryType | null {
  if (Platform.OS === "web") return null;
  if (!Sentry) {
    try {
      Sentry = require("@sentry/react-native");
    } catch {
      return null;
    }
  }
  return Sentry;
}

/**
 * Sentry initialisieren. Nur aufrufen wenn DSN vorhanden und nicht leer.
 * Doppelter Aufruf wird ignoriert.
 */
export function initSentry(dsn: string | undefined | null): void {
  if (!dsn || dsn.trim() === "") return;
  if (_initialized) return;
  if (Platform.OS === "web") return;

  const sentry = getSentry();
  if (!sentry) return;

  try {
    sentry.init({
      dsn: dsn.trim(),
      // Performance Tracing: 10% der Transaktionen samplen (anpassbar)
      tracesSampleRate: 0.1,
      // Umgebung: development vs. production
      environment: typeof __DEV__ !== "undefined" && __DEV__ ? "development" : "production",
      // Release-Info für Source Map Matching
      // release wird automatisch aus app.json version gesetzt
      enableAutoSessionTracking: true,
      sessionTrackingIntervalMillis: 30000,
      // Keine persönlichen Daten im Klartext
      sendDefaultPii: false,
      // Breadcrumbs für besseres Debugging
      maxBreadcrumbs: 50,
    });
    _initialized = true;
  } catch {
    // Init fehlgeschlagen — App läuft trotzdem normal weiter
  }
}

/** Gibt an ob Sentry aktiv ist */
export function isSentryActive(): boolean {
  return _initialized;
}

/** Fehler an Sentry melden */
export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!_initialized) return;
  const sentry = getSentry();
  if (!sentry) return;
  try {
    if (context) {
      sentry.withScope((scope) => {
        scope.setExtras(context);
        sentry.captureException(error);
      });
    } else {
      sentry.captureException(error);
    }
  } catch {}
}

/** Nachricht/Warnung an Sentry melden */
export function captureMessage(
  message: string,
  level: "fatal" | "error" | "warning" | "info" | "debug" = "info"
): void {
  if (!_initialized) return;
  const sentry = getSentry();
  if (!sentry) return;
  try {
    sentry.captureMessage(message, level);
  } catch {}
}

/** User nach Login setzen — hilft beim Zuordnen von Fehlern */
export function setSentryUser(user: { id: string; role?: string }): void {
  if (!_initialized) return;
  const sentry = getSentry();
  if (!sentry) return;
  try {
    // Keine E-Mail/Name — nur ID und Rolle für Debugging
    sentry.setUser({ id: user.id, role: user.role });
  } catch {}
}

/** User nach Logout leeren */
export function clearSentryUser(): void {
  if (!_initialized) return;
  const sentry = getSentry();
  if (!sentry) return;
  try {
    sentry.setUser(null);
  } catch {}
}

/**
 * Wrapper für Root-Component (verbessert Native Crash-Reporting).
 * Gibt die Component unverändert zurück wenn Sentry nicht aktiv.
 */
export function wrapWithSentry<T extends React.ComponentType<any>>(component: T): T {
  if (!_initialized) return component;
  const sentry = getSentry();
  if (!sentry) return component;
  try {
    return sentry.wrap(component) as T;
  } catch {
    return component;
  }
}
