import { Alert, Platform } from "react-native";
import { getGlobalShowConfirm, getGlobalShowAlert } from "../contexts/ModalContext";

/**
 * Zeigt eine Fehlermeldung plattformübergreifend an.
 * Verwendet das Custom-Modal wenn verfügbar, sonst nativen Fallback.
 */
export function showError(message: string): void {
  const globalAlert = getGlobalShowAlert();
  if (globalAlert) {
    globalAlert("Fehler", message, "error");
    return;
  }
  if (Platform.OS === "web") {
    window.alert(message);
  } else {
    Alert.alert("Fehler", message);
  }
}

/**
 * Zeigt eine Erfolgs-/Info-Meldung plattformübergreifend an.
 * Verwendet das Custom-Modal wenn verfügbar, sonst nativen Fallback.
 */
export function showSuccess(message: string, onDismiss?: () => void): void {
  const globalAlert = getGlobalShowAlert();
  if (globalAlert) {
    globalAlert("Erfolg", message, "success").then(() => onDismiss?.());
    return;
  }
  if (Platform.OS === "web") {
    window.alert(message);
    onDismiss?.();
  } else {
    Alert.alert("Erfolg", message, [{ text: "OK", onPress: onDismiss }]);
  }
}

/**
 * Zeigt einen Bestätigungsdialog plattformübergreifend an.
 * Gibt true zurück wenn bestätigt, false wenn abgebrochen.
 * Verwendet das Custom-Modal wenn verfügbar, sonst nativen Fallback.
 */
export async function showConfirm(
  title: string,
  message: string
): Promise<boolean> {
  const globalConfirm = getGlobalShowConfirm();
  if (globalConfirm) {
    return globalConfirm(title, message);
  }
  // Fallback wenn ModalProvider noch nicht gemountet ist
  if (Platform.OS === "web") {
    return Promise.resolve(window.confirm(message));
  }
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: "Abbrechen", style: "cancel", onPress: () => resolve(false) },
      { text: "Bestätigen", onPress: () => resolve(true) },
    ])
  );
}
