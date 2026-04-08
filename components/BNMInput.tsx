/**
 * BNMInput — Einheitliches Input-Feld mit:
 *   • Floating Label Animation
 *   • Focus-Glow (2px Border + Shadow)
 *   • Error-State mit Shake-Animation
 *   • Leading Icon Support
 *   • Konsistentes Styling über die gesamte App
 *
 * Verwendung:
 *   import { BNMInput } from "@/components/BNMInput";
 *   <BNMInput label="E-Mail" icon="mail-outline" error={errors.email} ... />
 */
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Animated,
  Platform,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, TYPOGRAPHY, SPACING } from "../constants/Colors";
import { useThemeColors } from "../contexts/ThemeContext";
import { BNMPressable } from "./BNMPressable";

const isWeb = Platform.OS === "web";

interface BNMInputProps extends Omit<TextInputProps, "style"> {
  label: string;
  icon?: string;
  error?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
  multiline?: boolean;
}

export function BNMInput({
  label,
  icon,
  error,
  rightIcon,
  onRightIconPress,
  containerStyle,
  value,
  onFocus,
  onBlur,
  multiline = false,
  ...rest
}: BNMInputProps) {
  const themeColors = useThemeColors();
  const [isFocused, setIsFocused] = useState(false);
  const hasValue = !!value && value.length > 0;

  // Floating label animation
  const labelAnim = useRef(new Animated.Value(hasValue ? 1 : 0)).current;
  // Error shake animation
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(labelAnim, {
      toValue: isFocused || hasValue ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [isFocused, hasValue]);

  // Shake bei Error
  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -8, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 50, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  const labelTop = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [multiline ? 14 : 15, -9],
  });
  const labelFontSize = labelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [TYPOGRAPHY.size.base, TYPOGRAPHY.size.xs],
  });

  const borderColor = error
    ? themeColors.error
    : isFocused
      ? themeColors.borderFocus
      : themeColors.border;

  const borderWidth = isFocused ? 2 : 1;

  return (
    <View style={[styles.wrapper, containerStyle]}>
      <Animated.View style={[
        styles.container,
        {
          backgroundColor: themeColors.input,
          borderColor,
          borderWidth,
          transform: [{ translateX: shakeAnim }],
        },
        isFocused && !error && styles.focusGlow,
        error && styles.errorGlow,
      ]}>
        {/* Leading Icon */}
        {icon && (
          <Ionicons
            name={icon as any}
            size={18}
            color={isFocused ? themeColors.borderFocus : themeColors.textTertiary}
            style={styles.leadingIcon}
          />
        )}

        <View style={styles.inputWrapper}>
          {/* Floating Label */}
          <Animated.Text
            style={[
              styles.floatingLabel,
              {
                top: labelTop,
                fontSize: labelFontSize,
                color: error
                  ? themeColors.error
                  : isFocused
                    ? themeColors.borderFocus
                    : themeColors.textTertiary,
                backgroundColor: (isFocused || hasValue) ? themeColors.input : "transparent",
              },
            ]}
            pointerEvents="none"
          >
            {label}
          </Animated.Text>

          <TextInput
            style={[
              styles.input,
              {
                color: themeColors.text,
                paddingTop: 8,
              },
              multiline && styles.inputMultiline,
            ]}
            value={value}
            placeholderTextColor="transparent"
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            multiline={multiline}
            {...rest}
          />
        </View>

        {/* Right Icon (z.B. Show/Hide Password) */}
        {rightIcon && (
          <BNMPressable onPress={onRightIconPress} disableHover style={styles.rightIconBtn}>
            <Ionicons
              name={rightIcon as any}
              size={20}
              color={themeColors.textTertiary}
            />
          </BNMPressable>
        )}
      </Animated.View>

      {/* Error Message */}
      {error && (
        <View style={styles.errorRow}>
          <Ionicons name="alert-circle" size={14} color={themeColors.error} />
          <Text style={[styles.errorText, { color: themeColors.error }]}>{error}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.md,
  },
  container: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.sm,
    minHeight: 52,
    paddingHorizontal: 12,
    ...(isWeb ? {
      // @ts-ignore – web-only CSS
      transition: "border-color 0.15s ease, box-shadow 0.15s ease",
    } : {}),
  },
  focusGlow: {
    ...(isWeb ? {
      // @ts-ignore
      boxShadow: `0 0 0 3px rgba(10, 58, 90, 0.12)`,
    } : {
      shadowColor: "#0A3A5A",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  errorGlow: {
    ...(isWeb ? {
      // @ts-ignore
      boxShadow: `0 0 0 3px rgba(220, 38, 38, 0.12)`,
    } : {
      shadowColor: "#DC2626",
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.12,
      shadowRadius: 6,
      elevation: 3,
    }),
  },
  leadingIcon: {
    marginRight: 10,
  },
  inputWrapper: {
    flex: 1,
    justifyContent: "center",
  },
  floatingLabel: {
    position: "absolute",
    left: 0,
    paddingHorizontal: 4,
    fontWeight: TYPOGRAPHY.weight.medium,
    zIndex: 1,
  },
  input: {
    fontSize: TYPOGRAPHY.size.base,
    fontWeight: TYPOGRAPHY.weight.regular,
    lineHeight: TYPOGRAPHY.lineHeight.relaxed,
    paddingVertical: Platform.OS === "web" ? 10 : 12,
    minHeight: 44,
  },
  inputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  rightIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.xs,
    marginLeft: 4,
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: TYPOGRAPHY.size.sm,
    fontWeight: TYPOGRAPHY.weight.medium,
  },
});
