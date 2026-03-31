/**
 * BNMPressable — Drop-in-Ersatz für TouchableOpacity mit:
 *   • Android: Ripple-Effekt via Pressable + android_ripple
 *   • iOS:     Haptic Feedback via expo-haptics
 *   • Web:     Standard Opacity-Feedback
 *
 * Verwendung:
 *   import { BNMPressable } from "@/components/BNMPressable";
 *   <BNMPressable onPress={...} style={...}>...</BNMPressable>
 *
 * Props: wie TouchableOpacity + optional `hapticStyle`
 */
import React from "react";
import { Pressable, StyleProp, ViewStyle, Platform, PressableProps } from "react-native";
import * as Haptics from "expo-haptics";

type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

interface BNMPressableProps extends PressableProps {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: React.ReactNode;
  hapticStyle?: HapticStyle;
  /** Ripple-Farbe für Android (default: rgba(0,0,0,0.12)) */
  rippleColor?: string;
  /** Ripple auf Borderless setzen (z. B. für Icon-Buttons ohne Hintergrund) */
  rippleBorderless?: boolean;
  activeOpacity?: number;
}

export function BNMPressable({
  style,
  children,
  hapticStyle = "light",
  rippleColor = "rgba(0,0,0,0.12)",
  rippleBorderless = false,
  onPress,
  activeOpacity = 0.7,
  ...rest
}: BNMPressableProps) {
  async function handlePress(event: Parameters<NonNullable<PressableProps["onPress"]>>[0]) {
    // Haptic Feedback nur auf iOS-Native
    if (Platform.OS === "ios") {
      try {
        switch (hapticStyle) {
          case "light":
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            break;
          case "medium":
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            break;
          case "heavy":
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            break;
          case "success":
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            break;
          case "warning":
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            break;
          case "error":
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            break;
        }
      } catch {
        // Haptics nicht verfügbar — still fail
      }
    }
    onPress?.(event);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        typeof style === "function" ? style({ pressed }) : style,
        // Nur auf Web + iOS Opacity-Feedback; Android hat Ripple
        Platform.OS !== "android" && pressed ? { opacity: activeOpacity } : undefined,
      ]}
      android_ripple={
        Platform.OS === "android"
          ? { color: rippleColor, borderless: rippleBorderless }
          : undefined
      }
      {...rest}
    >
      {children}
    </Pressable>
  );
}
