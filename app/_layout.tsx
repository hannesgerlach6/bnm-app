import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, View, useWindowDimensions } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { DataProvider, useData } from "../contexts/DataContext";
import { GamificationProvider } from "../contexts/GamificationContext";
import { ModalProvider } from "../contexts/ModalContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ThemeProvider, useTheme, useThemeColors } from "../contexts/ThemeContext";
import { LoadingScreen } from "../components/LoadingScreen";
import { registerForPushNotifications } from "../lib/notificationService";
import { initSentry, setSentryUser, clearSentryUser } from "../lib/sentryService";
import { AdminSidebar } from "../components/AdminSidebar";
import { CommandPalette } from "../components/CommandPalette";
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/Toast";
import { LIGHT_COLORS, DARK_COLORS, COLORS } from "../constants/Colors";

// Expo Notifications nur auf Native importieren
let Notifications: typeof import("expo-notifications") | null = null;
let Updates: typeof import("expo-updates") | null = null;
if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
  Updates = require("expo-updates");
}

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

SplashScreen.preventAutoHideAsync();

const BNMLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: LIGHT_COLORS.primary,
    background: LIGHT_COLORS.background,
    card: LIGHT_COLORS.card,
    text: LIGHT_COLORS.text,
    border: LIGHT_COLORS.border,
    notification: COLORS.gold,
  },
};

const BNMDarkTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: DARK_COLORS.text,
    background: DARK_COLORS.background,
    card: DARK_COLORS.card,
    text: DARK_COLORS.text,
    border: DARK_COLORS.border,
    notification: COLORS.gold,
  },
};

function SentryInitializer() {
  const { getSetting } = useData();
  const { user } = useAuth();

  // Sentry starten sobald Settings geladen sind (einmalig)
  useEffect(() => {
    const dsn = getSetting("sentry_dsn");
    if (dsn) initSentry(dsn);
  }, [getSetting]);

  // User-Kontext bei Login/Logout setzen
  useEffect(() => {
    if (user) {
      setSentryUser({ id: user.id, role: user.role });
    } else {
      clearSentryUser();
    }
  }, [user?.id]);

  return null;
}

function OTAUpdateChecker() {
  useEffect(() => {
    if (Platform.OS === "web" || !Updates) return;
    // Nur in Production-Builds prüfen — in Expo Go / Dev-Client überspringen
    if (__DEV__) return;

    async function checkForUpdate() {
      try {
        const result = await Updates!.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates!.fetchUpdateAsync();
          await Updates!.reloadAsync();
        }
      } catch {
        // Kein Update verfügbar oder offline — ignorieren
      }
    }

    checkForUpdate();
  }, []);

  return null;
}

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pushRegisteredRef = useRef<string | null>(null);

  // Push Token registrieren sobald User eingeloggt ist (einmalig pro User)
  useEffect(() => {
    if (!user) {
      pushRegisteredRef.current = null;
      return;
    }
    // Nicht doppelt registrieren wenn User-ID gleich bleibt
    if (pushRegisteredRef.current === user.id) return;
    pushRegisteredRef.current = user.id;

    registerForPushNotifications(user.id).catch(() => {
      // Fehler beim Token-Registrieren ignorieren — App funktioniert ohne Push
    });
  }, [user?.id]);

  useEffect(() => {
    // Warten bis Auth-State geladen ist — sonst falscher Redirect
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inLegalGroup = segments[0] === "legal";
    const isChangePassword = segments[0] === "change-password";
    const isResetPassword = segments[0] === "reset-password";

    if (!user && !inAuthGroup && !inLegalGroup && !isResetPassword) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      // Nach Login: Prüfen ob PW-Änderung erzwungen wird (Admin-Reset)
      if (user.force_password_change) {
        router.replace("/change-password");
      } else {
        router.replace("/(tabs)");
      }
    } else if (user?.force_password_change && !isChangePassword && !isResetPassword) {
      // User hat temporäres PW — immer zu change-password weiterleiten
      router.replace("/change-password");
    }
  }, [user, isLoading, segments]);

  return null;
}

// ─── Gemeinsame Screen-Definitionen ─────────────────────────────────────────
// Alle Stack.Screen nur einmal definieren — wird in Sidebar + Non-Sidebar-Layout genutzt.

function AppStackScreens({ isWebSidebar }: { isWebSidebar: boolean }) {
  const themeColors = useThemeColors();
  const isNative = Platform.OS !== "web";
  const fadeAnimation = isNative ? { animation: "fade" as const, animationDuration: 200 } : {};
  const modalAnimation = isNative
    ? { animation: "slide_from_bottom" as const, animationDuration: 300, presentation: "modal" as const }
    : { presentation: "modal" as const };

  const headerOpts = (title: string) => ({
    title,
    headerShown: true,
    headerStyle: { backgroundColor: themeColors.headerBackground },
    headerTintColor: themeColors.headerText,
  });

  // Modal-Screens: Im Web-Sidebar-Layout kein Header (Sidebar übernimmt Navigation)
  const modalOpts = (title: string) =>
    isWebSidebar ? { headerShown: false } : { ...modalAnimation, ...headerOpts(title) };

  return (
    <>
      <Stack.Screen name="(auth)" options={{ headerShown: false, ...fadeAnimation }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false, ...fadeAnimation }} />
      <Stack.Screen name="+not-found" />
      <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="notification-settings" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="change-password" options={{ headerShown: false }} />
      <Stack.Screen name="mentee/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="mentor/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="assign" options={modalOpts("Mentor zuweisen")} />
      <Stack.Screen name="document-session" options={modalOpts("Session dokumentieren")} />
      <Stack.Screen name="feedback" options={modalOpts("Feedback")} />
      <Stack.Screen name="mentorship/[id]" options={headerOpts("Betreuung")} />
      <Stack.Screen name="chat/[mentorshipId]" options={headerOpts("Chat")} />
      <Stack.Screen name="admin/session-types" options={headerOpts("Session-Typen")} />
      <Stack.Screen name="reset-password" options={headerOpts("Passwort zurücksetzen")} />
      <Stack.Screen name="hadithe" options={{ headerShown: false }} />
      <Stack.Screen name="donor-report" options={{ headerShown: false }} />
      <Stack.Screen name="admin/edit-user" options={{ headerShown: false }} />
      <Stack.Screen name="admin/statistics" options={{ headerShown: false }} />
      <Stack.Screen name="admin/csv-import" options={{ headerShown: false }} />
      <Stack.Screen name="qa" options={{ headerShown: false }} />
      <Stack.Screen name="admin/qa-management" options={{ headerShown: false }} />
      <Stack.Screen name="admin/hadithe-management" options={{ headerShown: false }} />
      <Stack.Screen name="admin/donor-report" options={{ headerShown: false }} />
      <Stack.Screen name="admin/pending-approvals" options={{ headerShown: false }} />
      <Stack.Screen name="admin/mentor-award" options={{ headerShown: false }} />
      <Stack.Screen name="admin/message-templates" options={{ headerShown: false }} />
      <Stack.Screen name="admin/certificate-generator" options={{ headerShown: false }} />
      <Stack.Screen name="admin/calendar-management" options={{ headerShown: false }} />
      <Stack.Screen name="legal" options={{ headerShown: false }} />
    </>
  );
}

function RootLayoutInner() {
  const { isLoading: authLoading, user } = useAuth();
  const { isDark } = useTheme();
  const themeColors = useThemeColors();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // .catch() verhindert den Expo-Go-Fehler "No native splash screen registered"
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded]);

  useEffect(() => { setHasMounted(true); }, []);

  // Notification Listener (nur Native)
  useEffect(() => {
    if (Platform.OS === "web" || !Notifications) return;

    // Foreground-Listener: Notification empfangen während App offen ist
    const foregroundSub = Notifications.addNotificationReceivedListener(
      (_notification) => {
        // Lokale Darstellung wird durch setNotificationHandler gesteuert (in notificationService.ts)
        // Zusätzliche App-Logik hier möglich (z.B. Badge-Counter erhöhen)
      }
    );

    // Tap-Listener: User tippt auf eine Notification
    const responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as Record<
          string,
          unknown
        >;

        // Zur richtigen Seite navigieren basierend auf Notification-Typ
        if (data?.type === "message" && data?.mentorshipId) {
          router.push(`/chat/${data.mentorshipId}` as never);
        } else if (data?.type === "assignment" && data?.mentorshipId) {
          router.push(`/mentorship/${data.mentorshipId}` as never);
        } else if (data?.type === "feedback") {
          router.push("/(tabs)" as never);
        } else {
          // Fallback: Notifications-Screen öffnen
          router.push("/notifications" as never);
        }
      }
    );

    return () => {
      foregroundSub.remove();
      responseSub.remove();
    };
  }, []);


  if (!loaded) {
    return null;
  }

  // Auth-State wird noch geladen: Splash/Loading statt leerer Seite
  if (authLoading) {
    return <LoadingScreen />;
  }

  const navigationTheme = isDark ? BNMDarkTheme : BNMLightTheme;

  // Auf Web: Sidebar permanent neben dem Stack für alle eingeloggten User
  const showPermanentSidebar = hasMounted && Platform.OS === "web" && !!user && width >= 768;

  // Gemeinsame Screen-Transition-Options (nur auf Native — Web hat eigene CSS-Transitions)
  const isNative = Platform.OS !== "web";
  const slideAnimation = isNative ? { animation: "slide_from_right" as const, animationDuration: 250 } : {};

  if (showPermanentSidebar) {
    return (
      <NavigationThemeProvider value={navigationTheme}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <NavigationGuard />
        <CommandPalette />
        <OfflineBanner />
        <View style={{ flexDirection: "row", flex: 1, backgroundColor: themeColors.background }}>
          <AdminSidebar />
          <View style={{ flex: 1, overflow: "hidden" }}>
            <Stack screenOptions={{ headerShown: false, ...slideAnimation }}>
              <AppStackScreens isWebSidebar={true} />
            </Stack>
          </View>
        </View>
      </NavigationThemeProvider>
    );
  }

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <NavigationGuard />
      <CommandPalette />
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false, ...slideAnimation }}>
        <AppStackScreens isWebSidebar={false} />
      </Stack>
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DataProvider>
            <GamificationProvider>
              <ModalProvider>
                <ToastProvider>
                  <OTAUpdateChecker />
                  <SentryInitializer />
                  <RootLayoutInner />
                </ToastProvider>
              </ModalProvider>
            </GamificationProvider>
          </DataProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
