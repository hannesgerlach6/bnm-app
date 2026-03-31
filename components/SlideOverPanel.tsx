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
import { useLanguage } from "../contexts/LanguageContext";

interface SlideOverPanelProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
}

export function SlideOverPanel({ visible, onClose, children, title }: SlideOverPanelProps) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const { t } = useLanguage();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Modal-Größe: responsive — auf kleinen Screens (mobile Browser) fast Vollbreite
  const modalWidth = screenWidth < 600
    ? screenWidth * 0.92
    : Math.min(560, screenWidth * 0.5);
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

  const goldBorder = themeColors.border;

  return (
    <View style={styles.container}>
      {/* Overlay */}
      <TouchableWithoutFeedback onPress={onClose} accessibilityLabel={t("common.close")} accessibilityRole="button">
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]} />
      </TouchableWithoutFeedback>

      {/* Zentriertes Modal */}
      <Animated.View
        accessibilityViewIsModal={true}
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
          Platform.OS === "web" ? ({ boxShadow: "0 24px 64px rgba(10,58,90,0.35), 0 4px 16px rgba(0,0,0,0.2)" } as any) : {},
        ]}
      >
        {/* Header */}
        <View style={[styles.modalHeader, { borderBottomColor: goldBorder }]}>
          {title ? (
            <Text style={[styles.modalTitle, { color: themeColors.text }]}>{title}</Text>
          ) : (
            <View />
          )}
          <TouchableOpacity onPress={onClose} style={[styles.closeButton, { backgroundColor: themeColors.elevated }]} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t("common.close")}>
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
            style={[styles.closeFooterButton, { backgroundColor: themeColors.accent }]}
            onPress={onClose}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t("common.close")}
          >
            <Text style={[styles.closeFooterText, { color: themeColors.black }]}>{t("common.close")}</Text>
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
    borderRadius: 20,
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
  },
  closeFooterText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
