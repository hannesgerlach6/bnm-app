import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";
import { COLORS } from "../constants/Colors";

interface BNMLogoProps {
  size?: number;
  showSubtitle?: boolean;
  color?: string;
}

export function BNMLogo({
  size = 60,
  showSubtitle = false,
  color = COLORS.gradientStart,
}: BNMLogoProps) {
  const textSize = size * 0.22;
  const subSize = size * 0.14;

  return (
    <View style={styles.wrapper}>
      <Image
        source={require("../assets/images/bnm-logo.png")}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
      {showSubtitle && (
        <View style={styles.textContainer}>
          <Text style={[styles.title, { fontSize: textSize, color }]}>
            BETREUUNG
          </Text>
          <Text style={[styles.subtitle, { fontSize: subSize, color }]}>
            NEUER MUSLIME
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
  textContainer: {
    marginTop: 4,
    alignItems: "center",
  },
  title: {
    fontWeight: "800",
    letterSpacing: 3,
  },
  subtitle: {
    fontWeight: "500",
    letterSpacing: 2,
    opacity: 0.7,
    marginTop: 1,
  },
});

export default BNMLogo;
