import { Alert, Platform } from "react-native";
import { getGlobalShowConfirm, getGlobalShowAlert } from "../contexts/ModalContext";

/**
 * Zeigt eine Fehlermeldung plattformübergreifend an.
 * Web: Custom-Modal, Mobile: Nativer Alert (zuverlässiger auf iOS)
 */
export function showError(message: string): void {
  if (Platform.OS !== "web") {
    Alert.alert("Fehler", message);
    return;
  }
  const globalAlert = getGlobalShowAlert();
  if (globalAlert) {
    globalAlert("Fehler", message, "error");
    return;
  }
  window.alert(message);
}

/**
 * Zeigt eine Erfolgs-/Info-Meldung plattformübergreifend an.
 * Web: Custom-Modal, Mobile: Nativer Alert
 */
export function showSuccess(message: string, onDismiss?: () => void): void {
  if (Platform.OS !== "web") {
    Alert.alert("Erfolg", message, [{ text: "OK", onPress: onDismiss }]);
    return;
  }
  const globalAlert = getGlobalShowAlert();
  if (globalAlert) {
    globalAlert("Erfolg", message, "success").then(() => onDismiss?.());
    return;
  }
  window.alert(message);
  onDismiss?.();
}

/**
 * Zeigt einen Bestätigungsdialog plattformübergreifend an.
 * Web: Custom-Modal, Mobile: Nativer Alert (kein Hänger auf iOS)
 */
export async function showConfirm(
  title: string,
  message: string
): Promise<boolean> {
  if (Platform.OS !== "web") {
    return new Promise((resolve) =>
      Alert.alert(title, message, [
        { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
        { text: "Bestätigen", onPress: () => resolve(true) },
      ])
    );
  }
  const globalConfirm = getGlobalShowConfirm();
  if (globalConfirm) {
    return globalConfirm(title, message);
  }
  return Promise.resolve(window.confirm(message));
}
