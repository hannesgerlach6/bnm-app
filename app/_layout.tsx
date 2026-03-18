import { DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { DataProvider } from "../contexts/DataContext";
import { LoadingScreen } from "../components/LoadingScreen";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(auth)",
};

SplashScreen.preventAutoHideAsync();

const BNMTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: "#101828",
    background: "#F9FAFB",
    card: "#FFFFFF",
    text: "#101828",
    border: "#e5e7eb",
    notification: "#EEA71B",
  },
};

function NavigationGuard() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

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
  const { isLoading: authLoading } = useAuth();
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  // Auth-State wird noch geladen: Splash/Loading statt leerer Seite
  if (authLoading) {
    return <LoadingScreen />;
  }

  return (
    <ThemeProvider value={BNMTheme}>
      <NavigationGuard />
      <Stack>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="+not-found" />
        <Stack.Screen
          name="onboarding"
          options={{ headerShown: false }}
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
            presentation: "modal",
            title: "Mentor zuweisen",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="document-session"
          options={{
            presentation: "modal",
            title: "Session dokumentieren",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="feedback"
          options={{
            presentation: "modal",
            title: "Feedback",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="mentorship/[id]"
          options={{
            title: "Betreuung",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="chat/[mentorshipId]"
          options={{
            title: "Chat",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="admin/session-types"
          options={{
            title: "Session-Typen",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
          }}
        />
        <Stack.Screen
          name="admin/feedback-overview"
          options={{
            title: "Feedback-Übersicht",
            headerStyle: { backgroundColor: "#FFFFFF" },
            headerTintColor: "#101828",
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
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <DataProvider>
        <RootLayoutInner />
      </DataProvider>
    </AuthProvider>
  );
}
