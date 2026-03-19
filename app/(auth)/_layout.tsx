import { Stack } from "expo-router";
import { useThemeColors } from "../../contexts/ThemeContext";

export default function AuthLayout() {
  const themeColors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: themeColors.headerBackground },
        headerTintColor: themeColors.headerText,
        headerBackTitle: "Zurück",
        contentStyle: { backgroundColor: themeColors.background },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen
        name="register-mentor"
        options={{ title: "Als Mentor bewerben" }}
      />
      <Stack.Screen
        name="register-public"
        options={{ title: "Registrieren" }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{ title: "Passwort zurücksetzen" }}
      />
    </Stack>
  );
}
