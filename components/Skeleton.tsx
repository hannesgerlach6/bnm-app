import React, { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, ViewStyle } from "react-native";
import { COLORS } from "../constants/Colors";
import { useThemeColors } from "../contexts/ThemeContext";

// Gemeinsame Pulsier-Animation
function usePulse() {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return opacity;
}

// Basis-Skeleton-Block
function SkeletonBase({ style }: { style?: ViewStyle }) {
  const opacity = usePulse();
  const themeColors = useThemeColors();
  return (
    <Animated.View
      style={[styles.base, { backgroundColor: themeColors.border }, style, { opacity }]}
    />
  );
}

// Rechteckige Karte
export function SkeletonCard({ height = 80, style }: { height?: number; style?: ViewStyle }) {
  return <SkeletonBase style={{ height, borderRadius: 14, ...(style ?? {}) }} />;
}

// Schmale Linie
export function SkeletonLine({
  width = "100%",
  height = 14,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <SkeletonBase
      style={{ height, width: width as any, borderRadius: 4, ...(style ?? {}) }}
    />
  );
}

// Kreis (für Avatare)
export function SkeletonCircle({ size = 44 }: { size?: number }) {
  return (
    <SkeletonBase
      style={{ width: size, height: size, borderRadius: size / 2 }}
    />
  );
}

// Vorgefertigtes Mentee-/Mentor-Card-Skeleton
export function SkeletonUserCard() {
  const themeColors = useThemeColors();
  return (
    <View style={[styles.userCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <SkeletonCircle size={44} />
      <View style={styles.userCardContent}>
        <SkeletonLine width="60%" height={16} style={{ marginBottom: 8 }} />
        <SkeletonLine width="40%" height={12} />
      </View>
    </View>
  );
}

// Liste von Skeleton-Karten
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonUserCard key={i} />
      ))}
    </>
  );
}

// KPI-Karte für Dashboard (Admin/Mentor)
export function SkeletonKPICard() {
  const themeColors = useThemeColors();
  return (
    <View style={[skeletonStyles.kpiCard, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
      <SkeletonLine width="40%" height={12} style={{ marginBottom: 10 }} />
      <SkeletonLine width="55%" height={28} style={{ marginBottom: 6 }} />
      <SkeletonLine width="30%" height={11} />
    </View>
  );
}

// Dashboard-Skeleton: 4 KPI-Karten + 2 Platzhalter-Sections
export function SkeletonDashboard() {
  const themeColors = useThemeColors();
  return (
    <View style={{ padding: 24 }}>
      {/* KPI-Reihe */}
      <View style={skeletonStyles.kpiRow}>
        <SkeletonKPICard />
        <SkeletonKPICard />
      </View>
      <View style={skeletonStyles.kpiRow}>
        <SkeletonKPICard />
        <SkeletonKPICard />
      </View>
      {/* Section-Platzhalter */}
      <View style={[skeletonStyles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <SkeletonLine width="50%" height={16} style={{ marginBottom: 14 }} />
        <SkeletonLine width="100%" height={12} style={{ marginBottom: 8 }} />
        <SkeletonLine width="85%" height={12} style={{ marginBottom: 8 }} />
        <SkeletonLine width="70%" height={12} />
      </View>
      <View style={[skeletonStyles.section, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
        <SkeletonLine width="45%" height={16} style={{ marginBottom: 14 }} />
        <SkeletonUserCard />
        <SkeletonUserCard />
      </View>
    </View>
  );
}

// Chat-Message-Skeleton
export function SkeletonChatMessages({ count = 5 }: { count?: number }) {
  return (
    <View style={{ padding: 16, gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => {
        const isRight = i % 3 !== 0;
        return (
          <View key={i} style={{ alignItems: isRight ? "flex-end" : "flex-start" }}>
            <SkeletonBase
              style={{
                height: 44 + (i % 2) * 20,
                width: `${50 + (i % 3) * 15}%` as `${number}%`,
                borderRadius: 14,
              }}
            />
          </View>
        );
      })}
    </View>
  );
}

const skeletonStyles = StyleSheet.create({
  kpiCard: {
    flex: 1,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    margin: 4,
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 0,
  },
  section: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    marginTop: 12,
  },
});

const styles = StyleSheet.create({
  base: {
    // backgroundColor applied dynamically via themeColors.border
  },
  userCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
  },
  userCardContent: {
    flex: 1,
  },
});
