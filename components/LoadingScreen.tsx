import React from "react";
import { View, Text, ActivityIndicator, StyleSheet } from "react-native";
import { COLORS } from "../constants/Colors";
import { BNMLogo } from "./BNMLogo";

/**
 * Vollbild-Ladescreen: wird während AuthContext.isLoading angezeigt.
 * Zeigt BNM-Logo + ActivityIndicator + Statustext.
 */
export function LoadingScreen() {
  return (
    <View style={styles.container}>
      <BNMLogo size={72} showSubtitle={false} />
      <ActivityIndicator
        size="large"
        color={COLORS.gold}
        style={styles.spinner}
      />
      <Text style={styles.label}>Wird geladen...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  spinner: {
    marginTop: 8,
  },
  label: {
    color: COLORS.secondary,
    fontSize: 14,
  },
});

export default LoadingScreen;
