import { createClient } from "@supabase/supabase-js";

// Separater Supabase-Client ohne Session-Persistenz.
// Wird für Admin-Operationen genutzt (z.B. signUp eines neuen Users),
// damit die bestehende Admin-Session nicht überschrieben wird.

const SUPABASE_URL = "https://jbuvnmjlvebzknbmzryb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidXZubWpsdmViemtuYm16cnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjYyNTIsImV4cCI6MjA4OTQwMjI1Mn0.VKYa75wnPJ435ICu_NQSzwyQUcaWAXVKoaLlP7uSucg";

export const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
