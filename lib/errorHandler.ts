import { Alert, Platform } from 'react-native';

/**
 * Zeigt eine Fehlermeldung plattformübergreifend an.
 * - Web: window.alert (kein nativer Alert verfügbar)
 * - Native (iOS/Android): Alert.alert mit Titel "Fehler"
 */
export function showError(message: string): void {
  if (Platform.OS === 'web') {
    // eslint-disable-next-line no-alert
    window.alert(`Fehler: ${message}`);
  } else {
    Alert.alert('Fehler', message);
  }
}
