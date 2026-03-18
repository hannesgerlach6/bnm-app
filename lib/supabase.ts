import { createClient } from "@supabase/supabase-js";

// HINWEIS: In Supabase Dashboard → Authentication → Providers → Email
// "Confirm email" auf OFF stellen, damit Registrierung ohne E-Mail-Verify funktioniert.

const SUPABASE_URL = "https://jbuvnmjlvebzknbmzryb.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpidXZubWpsdmViemtuYm16cnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjYyNTIsImV4cCI6MjA4OTQwMjI1Mn0.VKYa75wnPJ435ICu_NQSzwyQUcaWAXVKoaLlP7uSucg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    // persistSession: true für alle Plattformen —
    // Web nutzt localStorage (Supabase-Default), Native nutzt AsyncStorage falls konfiguriert.
    // Damit bleibt man nach Browser-Refresh / App-Neustart eingeloggt.
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
