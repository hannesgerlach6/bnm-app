import React, { useRef, useEffect } from "react";
import {
  Animated,
  Platform,
  TouchableWithoutFeedback,
  View,
  TouchableOpacity,
  Text,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useThemeColors, useTheme } from "../contexts/ThemeContext";

interface SlideOverPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function SlideOverPanel({ visible, onClose, children, title }: SlideOverPanelProps) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Modal-Größe: responsive
  const modalWidth = Math.min(560, screenWidth * 0.5);
  const modalMaxHeight = screenHeight * 0.85;

  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  if (Platform.OS !== "web") return null;
  if (!visible) return null;

  const goldBorder = isDark ? "#3A3520" : themeColors.border;

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      {/* Zentriertes Modal */}
      <Animated.View
        style={[
          styles.modal,
          {
            width: modalWidth,
            maxHeight: modalMaxHeight,
            backgroundColor: themeColors.card,
            borderColor: goldBorder,
            transform: [{ scale: scaleAnim }],
            opacity: opacityAnim,
          },
          Platform.OS === "web" ? ({ boxShadow: "0 20px 60px rgba(0,0,0,0.4)" } as any) : {},
        ]}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: goldBorder }]}>
          {title ? (
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{title}</Text>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: themeColors.elevated }]} activeOpacity={0.7}>
            <Text style={[styles.closeButtonText, { color: themeColors.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          style={styles.modalContent}
          contentContainerStyle={styles.modalContentInner}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>

        {/* Footer: Schließen Button */}
        <View style={[styles.modalFooter, { borderTopColor: goldBorder }]}>
          <TouchableOpacity
            style={[styles.closeFooterButton, { backgroundColor: isDark ? "#FFCA28" : "#EEA71B" }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeFooterText, { color: isDark ? "#0E0E14" : "#fff" }]}>Schließen</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute" as any,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modal: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonText: {
    fontSize: 15,
    fontWeight: "500",
  },
  modalContent: {
    flex: 1,
  },
  modalContentInner: {
    padding: 24,
    paddingBottom: 16,
  },
  modalFooter: {
    borderTopWidth: 1,
    padding: 16,
    paddingHorizontal: 24,
  },
  closeFooterButton: {
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeFooterText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
