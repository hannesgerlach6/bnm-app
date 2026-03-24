import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors } from "../contexts/ThemeContext";

interface ScreenHeaderProps {
  /** Callback beim Drücken des Zurück-Buttons */
  onBack: () => void;
  /** Titel der Seite (optional — manche Screens zeigen Titel separat) */
  title?: string;
  /** Rechte Aktions-Elemente (optional) */
  rightElement?: React.ReactNode;
  /** Zusätzlicher paddingTop-Offset (Standard: 8) */
  extraTopPadding?: number;
}

/**
 * Einheitlicher Screen-Header mit SafeArea-Padding-Top.
 * Verhindert, dass der Zurück-Button die iOS-Statusleiste/Uhr überlappt.
 *
 * Verwendung:
 *   <ScreenHeader onBack={() => router.back()} title="Mein Titel" />
 */
export function ScreenHeader({
  onBack,
  title,
  rightElement,
  extraTopPadding = 8,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const themeColors = useThemeColors();

  return (
    <View
      style={[
        styles.header,
        {
          backgroundColor: themeColors.card,
          borderBottomColor: themeColors.border,
          paddingTop: insets.top + extraTopPadding,
        },
      ]}
    >
      <TouchableOpacity onPress={onBack} style={styles.backButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Text style={[styles.backIcon, { color: themeColors.text }]}>‹</Text>
      </TouchableOpacity>

      {title ? (
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {title}
        </Text>
      ) : (
        <View style={styles.titlePlaceholder} />
      )}

      {rightElement ? (
        <View style={styles.rightSlot}>{rightElement}</View>
      ) : (
        <View style={styles.rightPlaceholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 8,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  backIcon: {
    fontSize: 28,
    fontWeight: "300",
    lineHeight: 34,
    marginTop: -2,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
  },
  titlePlaceholder: { flex: 1 },
  rightSlot: { minWidth: 36, alignItems: "flex-end" },
  rightPlaceholder: { width: 36 },
});
