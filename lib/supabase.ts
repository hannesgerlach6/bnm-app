import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

// HINWEIS: In Supabase Dashboard → Authentication → Providers → Email
// "Confirm email" auf OFF stellen, damit Registrierung ohne E-Mail-Verify funktioniert.

export const SUPABASE_URL = "https://cufuikcxliwbmyhwlmga.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZnVpa2N4bGl3Ym15aHdsbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTE1MDksImV4cCI6MjA4OTgyNzUwOX0.MMZ_5cT8Uluz4lWSFC3RSZT0NWmRVwPZIbRelXwAdko";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // AsyncStorage auf Native → Session überlebt Reload/Neustart
    // Web nutzt localStorage (Supabase-Standard, kein Override nötig)
    storage: Platform.OS !== "web" ? AsyncStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    debug: false,
    // navigator.locks komplett deaktivieren — verhindert AbortError + Lock-Timeout auf Web.
    // lock: undefined deaktiviert NICHT, es braucht eine no-op Funktion.
    lock: <R>(_name: string, _timeout: number, fn: () => Promise<R>): Promise<R> => fn(),
    flowType: "pkce",
  },
});
