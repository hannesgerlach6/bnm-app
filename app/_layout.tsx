import { DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useRef, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, View, useWindowDimensions } from "react-native";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { DataProvider } from "../contexts/DataContext";
import { ModalProvider } from "../contexts/ModalContext";
import { LanguageProvider } from "../contexts/LanguageContext";
import { ThemeProvider, useTheme, useThemeColors } from "../contexts/ThemeContext";
import { LoadingScreen } from "../components/LoadingScreen";
import { registerForPushNotifications } from "../lib/notificationService";
import { AdminSidebar } from "../components/AdminSidebar";
import { CommandPalette } from "../components/CommandPalette";
import { OfflineBanner } from "../components/OfflineBanner";
import { ToastProvider } from "../components/Toast";
import { LIGHT_COLORS, DARK_COLORS, COLORS } from "../constants/Colors";

// Expo Notifications nur auf Native importieren
let Notifications: typeof import("expo-notifications") | null = null;
if (Platform.OS !== "web") {
  Notifications = require("expo-notifications");
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

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/login");
    } else if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isLoading, segments]);

  return null;
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

  // Auf Web für Admin/Office: Sidebar permanent neben dem Stack anzeigen,
  // damit sie auch auf Detail-Screens (assign, mentorship/[id], admin/...) sichtbar bleibt.
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const showPermanentSidebar = hasMounted && Platform.OS === "web" && isAdminOrOffice && width >= 768;

  // Gemeinsame Screen-Transition-Options (nur auf Native — Web hat eigene CSS-Transitions)
  const isNative = Platform.OS !== "web";
  const fadeAnimation = isNative ? { animation: "fade" as const, animationDuration: 200 } : {};
  const slideAnimation = isNative ? { animation: "slide_from_right" as const, animationDuration: 250 } : {};
  const modalAnimation = isNative ? { animation: "slide_from_bottom" as const, animationDuration: 300, presentation: "modal" as const } : { presentation: "modal" as const };

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
            <Stack screenOptions={{ ...slideAnimation }}>
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
              <Stack.Screen name="assign" options={{ headerShown: false }} />
              <Stack.Screen name="document-session" options={{ headerShown: false }} />
              <Stack.Screen name="feedback" options={{ headerShown: false }} />
              <Stack.Screen name="mentorship/[id]" options={{ title: "Betreuung", headerStyle: { backgroundColor: themeColors.headerBackground }, headerTintColor: themeColors.headerText }} />
              <Stack.Screen name="chat/[mentorshipId]" options={{ title: "Chat", headerStyle: { backgroundColor: themeColors.headerBackground }, headerTintColor: themeColors.headerText }} />
              <Stack.Screen name="admin/session-types" options={{ title: "Session-Typen", headerStyle: { backgroundColor: themeColors.headerBackground }, headerTintColor: themeColors.headerText }} />
              <Stack.Screen name="reset-password" options={{ title: "Passwort zurücksetzen", headerStyle: { backgroundColor: themeColors.headerBackground }, headerTintColor: themeColors.headerText }} />
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
      <Stack screenOptions={{ ...slideAnimation }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false, ...fadeAnimation }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false, ...fadeAnimation }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false, ...fadeAnimation }}
        />
        <Stack.Screen
          name="notifications"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="notification-settings"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="change-password"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="mentee/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="mentor/[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="assign"
          options={{
            ...modalAnimation,
            title: "Mentor zuweisen",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="document-session"
          options={{
            ...modalAnimation,
            title: "Session dokumentieren",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="feedback"
          options={{
            ...modalAnimation,
            title: "Feedback",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="mentorship/[id]"
          options={{
            title: "Betreuung",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="chat/[mentorshipId]"
          options={{
            title: "Chat",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="admin/session-types"
          options={{
            title: "Session-Typen",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="reset-password"
          options={{
            title: "Passwort zurücksetzen",
            headerStyle: { backgroundColor: themeColors.headerBackground },
            headerTintColor: themeColors.headerText,
          }}
        />
        <Stack.Screen
          name="hadithe"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="donor-report"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/edit-user"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/statistics"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/csv-import"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="qa"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/qa-management"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/hadithe-management"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/donor-report"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/pending-approvals"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="admin/mentor-award"
          options={{
            headerShown: false,
          }}
        />
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
            <ModalProvider>
              <ToastProvider>
                <RootLayoutInner />
              </ToastProvider>
            </ModalProvider>
          </DataProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
