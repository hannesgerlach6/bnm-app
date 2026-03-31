import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS } from "../constants/Colors";
import { BNMLogo } from "./BNMLogo";
import { useLanguage } from "../contexts/LanguageContext";
import { useThemeColors } from "../contexts/ThemeContext";

/**
 * Vollbild-Ladescreen: wird während AuthContext.isLoading angezeigt.
 * Zeigt BNM-Logo + ActivityIndicator + Statustext.
 */
export function LoadingScreen() {
  // useLanguage ist hier sicher nutzbar, da LanguageProvider den AuthProvider umschließt
  // Falls der Context noch nicht verfügbar ist, fällt er auf den Default-Wert zurück ("Wird geladen...")
  const { t } = useLanguage();
  const themeColors = useThemeColors();

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]} accessibilityRole="progressbar" accessibilityLabel="Anwendung wird geladen">
      <BNMLogo size={72} showSubtitle={false} />
      <ActivityIndicator
        size="large"
        color={COLORS.gold}
        style={styles.spinner}
        accessibilityLabel="Ladevorgang läuft"
      />
      <Text style={[styles.label, { color: themeColors.textSecondary }]} accessibilityLabel={t("common.loading")}>{t("common.loading")}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  spinner: {
    marginTop: 8,
  },
  label: {
    fontSize: 14,
  },
});

export default LoadingScreen;
