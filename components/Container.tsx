import React, { ReactNode } from "react";
import { View, Platform, StyleSheet, useWindowDimensions } from "react-native";
import { BREAKPOINTS } from "../constants/Colors";

interface ContainerProps {
  children: ReactNode;
  style?: object;
  /** Wenn true, wird kein maxWidth angewendet — nutze das in breiten Layouts (z.B. Sidebar-Layout). */
  fullWidth?: boolean;
}

/**
 * Responsive Wrapper-Komponente.
 * Auf Web ohne fullWidth: Content wird auf max. 900px begrenzt und zentriert, mit responsivem Padding.
 * Auf Web mit fullWidth: volle Breite (für Sidebar-Layouts).
 * Auf Native: volle Breite (kein Wrapper-Overhead).
 */
export function Container({ children, style, fullWidth }: ContainerProps) {
  const { width } = useWindowDimensions();

  if (Platform.OS !== "web") {
    return <>{children}</>;
  }

  if (fullWidth) {
    return (
      <View style={[styles.outerWebFull, style]}>{children}</View>
    );
  }

  const horizontalPadding = width >= BREAKPOINTS.wide ? 48 : width >= BREAKPOINTS.tablet ? 32 : 16;

  return (
    <View style={styles.outerWeb}>
      <View style={[styles.innerWeb, { paddingHorizontal: horizontalPadding }, style]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWeb: {
    flex: 1,
    alignItems: "center",
    width: "100%",
  },
  innerWeb: {
    width: "100%",
    maxWidth: 900,
    flex: 1,
  },
  outerWebFull: {
    flex: 1,
    width: "100%",
  },
});
