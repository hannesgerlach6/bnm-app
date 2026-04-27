/**
 * Avatar — Einheitliche Avatar-Komponente mit:
 *   - Initialen-Fallback
 *   - Optional: Online-Status-Dot
 *   - Hover-Scale auf Web
 *
 * Verwendung:
 *   <Avatar name="Hasan" size={44} />
 *   <Avatar name="Hasan" size={44} showOnline online />
 */
import React from "react";
import { View, Text, StyleSheet, Platform, ViewStyle } from "react-native";
import { COLORS, TYPOGRAPHY } from "../constants/Colors";
import { useThemeColors } from "../contexts/ThemeContext";

interface AvatarProps {
  name: string;
  size?: number;
  color?: string;
  showOnline?: boolean;
  online?: boolean;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (name[0] ?? "?").toUpperCase();
}

export function Avatar({ name, size = 44, color, showOnline, online }: AvatarProps) {
  const themeColors = useThemeColors();
  const bgColor = color ?? COLORS.gradientStart;
  const fontSize = Math.round(size * 0.38);
  const dotSize = Math.max(10, Math.round(size * 0.25));
  const borderWidth = Math.max(2, Math.round(size * 0.05));

  return (
    <View style={[
      styles.container,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bgColor,
      },
      Platform.OS === "web" && styles.webHover,
    ]}>
      <Text style={[styles.initials, { fontSize, lineHeight: fontSize + 2 }]}>
        {getInitials(name)}
      </Text>

      {showOnline && (
        <View style={[
          styles.statusDot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            borderWidth,
            borderColor: themeColors.card,
            backgroundColor: online ? "#22C55E" : COLORS.tertiary,
            bottom: -1,
            right: -1,
          },
        ]} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  initials: {
    color: COLORS.white,
    fontWeight: TYPOGRAPHY.weight.bold,
    textAlign: "center",
  },
  statusDot: {
    position: "absolute",
  },
  webHover: (Platform.OS === "web" ? {
    // @ts-ignore
    transition: "transform 0.15s ease",
  } : {}) as ViewStyle,
});
