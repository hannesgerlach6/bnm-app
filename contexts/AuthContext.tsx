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

// Dev-Shortcut Credentials — nur in Development verwendet
const DEV_CREDENTIALS: Record<UserRole, { email: string; password: string }> = __DEV__
  ? {
      admin: { email: "admin@bnm.org", password: "admin123" },
      office: { email: "office@bnm.org", password: "office123" },
      mentor: { email: "mentor@bnm.org", password: "mentor123" },
      mentee: { email: "mentee@bnm.org", password: "mentee123" },
    }
  : ({} as Record<UserRole, { email: string; password: string }>);

/**
 * Erstellt Test-User in Supabase Auth (einmalig aufrufen).
 * Benötigt signUp, daher Email-Bestätigung je nach Supabase-Einstellung nötig.
 */
export async function registerTestUsers(): Promise<string[]> {
  const results: string[] = [];

  const testUsers = [
    { email: "admin@bnm.org", password: "admin123", name: "Ahmad Al-Farsi", role: "admin", gender: "male", city: "Berlin", age: 38 },
    { email: "office@bnm.org", password: "office123", name: "Maryam Hassan", role: "office", gender: "female", city: "Berlin", age: 31 },
    { email: "mentor@bnm.org", password: "mentor123", name: "Yusuf Schneider", role: "mentor", gender: "male", city: "Hamburg", age: 32 },
    { email: "mentee@bnm.org", password: "mentee123", name: "Michael Bauer", role: "mentee", gender: "male", city: "Hamburg", age: 27 },
  ];

  for (const u of testUsers) {
    const { error } = await supabase.auth.signUp({
      email: u.email,
      password: u.password,
      options: {
        data: {
          name: u.name,
          role: u.role,
          gender: u.gender,
          city: u.city,
          age: u.age,
        },
      },
    });
    if (error) {
      results.push(`${u.email}: FEHLER – ${error.message}`);
    } else {
      results.push(`${u.email}: OK`);
    }
  }

  return results;
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
        setUser(profile);
      }
      setIsLoading(false);
    });

    // Auf Auth-Änderungen reagieren
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          const profile = await loadProfile(session.user.id);
          setUser(profile);
        } else {
          setUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string): Promise<boolean> => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });

        if (error || !data.user) {
          setIsLoading(false);
          return false;
        }

        const profile = await loadProfile(data.user.id);
        setUser(profile);
        setIsLoading(false);
        return true;
      } catch {
        setIsLoading(false);
        return false;
      }
    },
    []
  );

  /**
   * Dev-Shortcut: Als bestimmte Rolle einloggen.
   * Nur in Development verfügbar (__DEV__ === true).
   */
  const loginAs = useCallback(
    async (role: UserRole): Promise<{ success: boolean; error?: string }> => {
      if (!__DEV__) {
        return { success: false, error: "Schnellzugang nur in Development verfügbar." };
      }

      const creds = DEV_CREDENTIALS[role];
      if (!creds) return { success: false, error: "Unbekannte Rolle" };

      setIsLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email: creds.email,
        password: creds.password,
      });

      if (error || !data.user) {
        setIsLoading(false);
        return {
          success: false,
          error: `Benutzer existiert nicht. Bitte zuerst registerTestUsers() aufrufen.`,
        };
      }

      const profile = await loadProfile(data.user.id);
      setUser(profile);
      setIsLoading(false);
      return { success: true };
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

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginAs, logout }}>
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
