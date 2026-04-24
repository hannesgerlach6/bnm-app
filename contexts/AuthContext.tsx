import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { Platform } from "react-native";
import type { User, UserRole, AuthContextValue } from "../types";
import { supabase } from "../lib/supabase";
import { unregisterPushToken } from "../lib/notificationService";

const AuthContext = createContext<AuthContextValue | null>(null);

// Hilfsfunktion: Profil aus profiles-Tabelle laden
async function loadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    email: data.email,
    role: data.role,
    gender: data.gender,
    name: data.name,
    phone: data.phone ?? undefined,
    city: data.city ?? "",
    plz: data.plz ?? "",
    age: data.age ?? 0,
    contact_preference: data.contact_preference ?? "whatsapp",
    avatar_url: data.avatar_url ?? undefined,
    created_at: data.created_at,
    is_active: data.is_active ?? true,
    force_password_change: data.force_password_change ?? false,
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth-State-Listener beim Mount registrieren
  useEffect(() => {
    // Initiale Session prüfen — mit 5s Hard-Cutoff, damit die App nicht
    // endlos auf "Wird geladen..." haengt, falls die Session-Tokens korrupt
    // oder Supabase langsam ist.
    let settled = false;
    const cutoff = setTimeout(() => {
      if (settled) return;
      settled = true;
      console.warn("[AuthContext] getSession timeout — clearing localStorage");
      // Session-Daten aus localStorage loeschen (kaputte Tokens)
      try {
        if (Platform.OS === "web" && typeof localStorage !== "undefined") {
          const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-"));
          keys.forEach((k) => localStorage.removeItem(k));
        }
      } catch {}
      setUser(null);
      setIsLoading(false);
    }, 5000);

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (settled) return;
      if (session?.user) {
        const profile = await loadProfile(session.user.id).catch(() => null);
        if (settled) return;
        if (profile?.is_active === false) {
          supabase.auth.signOut().catch(() => {});
        } else {
          setUser(profile);
        }
      }
      settled = true;
      clearTimeout(cutoff);
      setIsLoading(false);
    }).catch(() => {
      if (settled) return;
      settled = true;
      clearTimeout(cutoff);
      setUser(null);
      setIsLoading(false);
    });

    // Auf Auth-Änderungen reagieren
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await loadProfile(session.user.id);
          if (profile?.is_active === false) {
            await supabase.auth.signOut();
          } else {
            setUser(profile);
          }
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<"ok" | "banned" | "invalid"> => {
      // KEIN setIsLoading(true) hier — isLoading ist nur für den initialen Session-Check.
      // setIsLoading(true) würde _layout.tsx dazu bringen den Login-Screen zu unmounten,
      // sodass Fehlermeldungen nach Rückkehr verloren gehen (sieht aus wie "Page-Refresh").
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error || !data.user) {
          // Supabase setzt banned_until → Login schlägt mit "User is banned" fehl
          if (error?.message?.toLowerCase().includes("ban") || error?.message?.toLowerCase().includes("user_banned")) {
            return "banned";
          }
          return "invalid";
        }

        const profile = await loadProfile(data.user.id);

        // Fallback: is_active prüfen falls banned_until doch nicht gesetzt war
        if (profile?.is_active === false) {
          await supabase.auth.signOut();
          return "banned";
        }

        setUser(profile);
        return "ok";
      } catch {
        return "invalid";
      }
    },
    []
  );

  // loginAs: nicht mehr verfügbar (Test-Credentials entfernt)
  const loginAs = useCallback(
    async (_role: UserRole): Promise<{ success: boolean; error?: string }> => {
      return { success: false, error: "Schnellzugang nicht verfügbar." };
    },
    []
  );

  const logout = useCallback(async () => {
    // Sofort User-State löschen → UI reagiert unmittelbar
    setUser(null);
    const userId = user?.id;
    if (userId) unregisterPushToken(userId).catch(() => {});

    if (Platform.OS === "web") {
      // Web: Session-Daten sofort aus localStorage entfernen, dann redirect.
      // signOut fire-and-forget — darf den Redirect NICHT blockieren.
      try {
        const keys = Object.keys(localStorage).filter((k) => k.startsWith("sb-"));
        keys.forEach((k) => localStorage.removeItem(k));
      } catch {}
      supabase.auth.signOut().catch(() => {});
      window.location.href = "/";
    } else {
      // Native: signOut fire-and-forget, nicht blockieren
      supabase.auth.signOut().catch(() => {});
    }
  }, [user?.id]);

  const refreshUser = useCallback(async () => {
    if (!user?.id) return;
    const profile = await loadProfile(user.id);
    if (profile) setUser(profile);
  }, [user?.id]);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAs, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth muss innerhalb eines AuthProviders verwendet werden");
  }
  return context;
}
