import { createClient } from "@supabase/supabase-js";

// Separater Supabase-Client ohne Session-Persistenz.
// Wird für Admin-Operationen genutzt (z.B. signUp eines neuen Users),
// damit die bestehende Admin-Session nicht überschrieben wird.

const SUPABASE_URL = "https://cufuikcxliwbmyhwlmga.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN1ZnVpa2N4bGl3Ym15aHdsbWdhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQyNTE1MDksImV4cCI6MjA4OTgyNzUwOX0.MMZ_5cT8Uluz4lWSFC3RSZT0NWmRVwPZIbRelXwAdko";

export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: "sb-anon-auth-token", // Eigener Key um Lock-Konflikte zu vermeiden
    flowType: "pkce",
  },
});
