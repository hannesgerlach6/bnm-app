import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
  Modal,
} from "react-native";
import { COLORS } from "../constants/Colors";
import { useLanguage } from "../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../contexts/ThemeContext";

export type ModalType = "confirm" | "info" | "success" | "error";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: ModalType;
  onConfirm: () => void;
  onCancel?: () => void;
}

function TypeIcon({ type, isDark }: { type: ModalType; isDark: boolean }) {
  if (type === "success") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1a3a2a" : "#dcfce7" }]}>
        <Text style={[styles.iconText, { color: isDark ? "#4ade80" : COLORS.cta }]}>✓</Text>
      </View>
    );
  }
  if (type === "error") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: isDark ? "#3a1a1a" : "#fef2f2" }]}>
        <Text style={[styles.iconText, { color: isDark ? "#f87171" : COLORS.error }]}>✕</Text>
      </View>
    );
  }
  if (type === "info") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: isDark ? "#1e2d4a" : "#eff6ff" }]}>
        <Text style={[styles.iconText, { color: isDark ? "#93c5fd" : "#2563eb" }]}>i</Text>
      </View>
    );
  }
  return null;
}

export function ConfirmModal({
  visible,
  title,
  message,
  type = "confirm",
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const { isDark } = useTheme();

  const isConfirm = type === "confirm";

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={isConfirm ? onCancel : onConfirm}>
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={isConfirm ? onCancel : onConfirm} />
      <View style={[styles.card, { backgroundColor: themeColors.card }]}>
        {type !== "confirm" ? <TypeIcon type={type} isDark={isDark} /> : null}

        <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        <Text style={[styles.message, { color: themeColors.textSecondary }]}>{message}</Text>

        <View style={styles.buttonRow}>
          {isConfirm && onCancel && (
            <TouchableOpacity
              style={[styles.cancelButton, { borderColor: themeColors.border }]}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={[styles.cancelButtonText, { color: themeColors.textSecondary }]}>{t("common.cancel")}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.confirmButton,
              type === "error" && { backgroundColor: COLORS.error },
              type === "success" && { backgroundColor: COLORS.cta },
              !isConfirm && styles.confirmButtonFull,
            ]}
            onPress={onConfirm}
            activeOpacity={0.7}
          >
            <Text style={styles.confirmButtonText}>
              {isConfirm ? t("common.confirm") : t("common.ok")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    zIndex: 9999,
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  card: {
    borderRadius: 12,
    padding: 24,
    width: "100%",
    maxWidth: 400,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
    alignItems: "center",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  iconText: {
    fontSize: 22,
    fontWeight: "700",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  cancelButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  cancelButtonText: {
    fontWeight: "600",
    fontSize: 14,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: COLORS.gradientStart,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmButtonFull: {
    flex: 1,
  },
  confirmButtonText: {
    color: COLORS.white,
    fontWeight: "600",
    fontSize: 14,
  },
});

export default ConfirmModal;
