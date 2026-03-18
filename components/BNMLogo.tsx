import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/Colors";

interface BNMLogoProps {
  size?: number;
  showSubtitle?: boolean;
}

export function BNMLogo({ size = 60, showSubtitle = false }: BNMLogoProps) {
  const containerSize = size;
  const borderRadius = size * 0.2;
  const letterFontSize = size * 0.45;
  const titleFontSize = size * 0.4;
  const subtitleFontSize = size * 0.18;

  return (
    <View style={styles.wrapper}>
      {/* Logo-Box: dunkelblaues abgerundetes Quadrat mit Gold-Buchstaben */}
      <View
        style={[
          styles.logoBox,
          {
            width: containerSize,
            height: containerSize,
            borderRadius,
          },
        ]}
      >
        {/* Dezenter Gold-Strich oben links als Akzent */}
        <View
          style={[
            styles.accentBar,
            { width: containerSize * 0.25, borderRadius: 2 },
          ]}
        />
        <Text style={[styles.logoLetters, { fontSize: letterFontSize }]}>
          BNM
        </Text>
      </View>

      {/* Subtitle */}
      {showSubtitle && (
        <View style={styles.subtitleContainer}>
          <Text style={[styles.logoTitle, { fontSize: titleFontSize }]}>
            BNM
          </Text>
          <Text style={[styles.subtitleText, { fontSize: subtitleFontSize }]}>
            Betreuung neuer Muslime
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: "center",
  },
  logoBox: {
    backgroundColor: COLORS.gradientStart,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    position: "relative",
    overflow: "hidden",
  },
  accentBar: {
    position: "absolute",
    top: 6,
    left: 6,
    height: 3,
    backgroundColor: COLORS.gold,
    opacity: 0.8,
  },
  logoLetters: {
    color: COLORS.gold,
    fontWeight: "800",
    letterSpacing: 2,
  },
  subtitleContainer: {
    marginTop: 8,
    alignItems: "center",
  },
  logoTitle: {
    color: COLORS.primary,
    fontWeight: "700",
    letterSpacing: 3,
  },
  subtitleText: {
    color: COLORS.secondary,
    fontWeight: "500",
    letterSpacing: 0.5,
    marginTop: 2,
  },
});

export default BNMLogo;
