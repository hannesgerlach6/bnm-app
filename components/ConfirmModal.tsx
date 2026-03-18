import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from "react-native";
import { COLORS } from "../constants/Colors";

export type ModalType = "confirm" | "info" | "success" | "error";

interface ConfirmModalProps {
  visible: boolean;
  title: string;
  message: string;
  type?: ModalType;
  onConfirm: () => void;
  onCancel?: () => void;
}

function TypeIcon({ type }: { type: ModalType }) {
  if (type === "success") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: "#dcfce7" }]}>
        <Text style={[styles.iconText, { color: COLORS.cta }]}>✓</Text>
      </View>
    );
  }
  if (type === "error") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: "#fef2f2" }]}>
        <Text style={[styles.iconText, { color: COLORS.error }]}>✕</Text>
      </View>
    );
  }
  if (type === "info") {
    return (
      <View style={[styles.iconCircle, { backgroundColor: "#eff6ff" }]}>
        <Text style={[styles.iconText, { color: "#2563eb" }]}>i</Text>
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
  if (!visible) return null;

  const isConfirm = type === "confirm";

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      <Pressable style={styles.backdrop} onPress={isConfirm ? onCancel : onConfirm} />
      <View style={styles.card}>
        {type !== "confirm" && <TypeIcon type={type} />}

        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>

        <View style={styles.buttonRow}>
          {isConfirm && onCancel && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Abbrechen</Text>
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
              {isConfirm ? "Bestätigen" : "OK"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
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
    backgroundColor: COLORS.white,
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
    color: COLORS.gradientStart,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: COLORS.secondary,
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
    borderColor: COLORS.border,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "transparent",
  },
  cancelButtonText: {
    color: COLORS.secondary,
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
