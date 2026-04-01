import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
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
  };
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auth-State-Listener beim Mount registrieren
  useEffect(() => {
    // Initiale Session prüfen
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const profile = await loadProfile(session.user.id);
        if (profile?.is_active === false) {
          await supabase.auth.signOut();
        } else {
          setUser(profile);
        }
      }
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
    // Push Token aus DB entfernen bevor Session ungültig wird
    if (user?.id) {
      await unregisterPushToken(user.id).catch(() => {});
    }
    await supabase.auth.signOut();
    setUser(null);
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
