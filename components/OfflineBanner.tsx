import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { COLORS } from "../constants/Colors";

const BANNER_HEIGHT = 36;

export function OfflineBanner() {
  const isOnline = useNetworkStatus();
  const translateY = useRef(new Animated.Value(-BANNER_HEIGHT)).current;

  useEffect(() => {
    Animated.timing(translateY, {
      toValue: isOnline ? -BANNER_HEIGHT : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [isOnline]);

  return (
    <Animated.View
      style={[styles.banner, { transform: [{ translateY }] }]}
      pointerEvents="none"
    >
      <View style={styles.inner}>
        <Ionicons name="cloud-offline-outline" size={14} color={COLORS.white} style={styles.icon} />
        <Text style={styles.text}>Keine Verbindung – Daten können veraltet sein</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: COLORS.gold,
    height: BANNER_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  inner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
  },
  icon: {
    marginRight: 6,
  },
  text: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "500",
    textAlign: "center",
  },
});
