/**
 * Confetti — Leichte Konfetti-Animation für Meilensteine.
 * Nutzt nur Animated API (kein extra Package).
 *
 * Verwendung:
 *   const [showConfetti, setShowConfetti] = useState(false);
 *   {showConfetti && <Confetti onComplete={() => setShowConfetti(false)} />}
 */
import React, { useEffect, useMemo } from "react";
import { View, Animated, StyleSheet, Dimensions } from "react-native";
import { COLORS } from "../constants/Colors";

const PARTICLE_COUNT = 30;
const DURATION = 2000;
const COLORS_POOL = [COLORS.gold, COLORS.error, COLORS.blue, COLORS.progressGreen, "#8B5CF6", COLORS.warning, COLORS.gradientStart];

interface ConfettiProps {
  onComplete?: () => void;
}

interface Particle {
  x: Animated.Value;
  y: Animated.Value;
  rotate: Animated.Value;
  opacity: Animated.Value;
  color: string;
  size: number;
  startX: number;
  isCircle: boolean;
}

export function Confetti({ onComplete }: ConfettiProps) {
  const { width, height } = Dimensions.get("window");

  const particles = useMemo<Particle[]>(() =>
    Array.from({ length: PARTICLE_COUNT }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
      rotate: new Animated.Value(0),
      opacity: new Animated.Value(1),
      color: COLORS_POOL[Math.floor(Math.random() * COLORS_POOL.length)],
      size: 6 + Math.random() * 8,
      startX: Math.random() * width,
      isCircle: Math.random() > 0.5,
    })),
  []);

  useEffect(() => {
    const animations = particles.map((p) =>
      Animated.parallel([
        Animated.timing(p.y, {
          toValue: height * 0.7 + Math.random() * height * 0.3,
          duration: DURATION + Math.random() * 800,
          useNativeDriver: true,
        }),
        Animated.timing(p.x, {
          toValue: (Math.random() - 0.5) * width * 0.6,
          duration: DURATION + Math.random() * 800,
          useNativeDriver: true,
        }),
        Animated.timing(p.rotate, {
          toValue: 3 + Math.random() * 5,
          duration: DURATION,
          useNativeDriver: true,
        }),
        Animated.timing(p.opacity, {
          toValue: 0,
          duration: DURATION,
          delay: DURATION * 0.5,
          useNativeDriver: true,
        }),
      ])
    );

    Animated.stagger(30, animations).start(() => {
      onComplete?.();
    });
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            styles.particle,
            {
              left: p.startX,
              top: -10,
              width: p.size,
              height: p.isCircle ? p.size : p.size * 0.5,
              borderRadius: p.isCircle ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: p.opacity,
              transform: [
                { translateX: p.x },
                { translateY: p.y },
                { rotate: p.rotate.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  })
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  particle: {
    position: "absolute",
  },
});
