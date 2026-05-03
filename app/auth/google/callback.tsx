import { useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { COLORS } from "../../../constants/Colors";

/**
 * Google OAuth Callback — nur für Web relevant.
 * Nach der Google-Auth kommt der Browser auf diese Seite mit ?code=...
 * Die Seite postet den Code per postMessage an das Popup-Elternfenster
 * und schließt sich dann selbst.
 *
 * Auf Native fängt expo-web-browser die Redirect-URL ab,
 * bevor diese Seite geladen wird — daher kein Native-Code nötig.
 */
export default function GoogleCallbackScreen() {
  const params = useLocalSearchParams();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const code  = params.code  as string | undefined;
    const error = params.error as string | undefined;

    if (window.opener) {
      // Web-Popup-Flow: Code ans Elternfenster schicken
      window.opener.postMessage(
        { type: "google-auth-callback", code: code ?? null, error: error ?? null },
        window.location.origin
      );
      window.close();
    } else if (code || error) {
      // Native-Flow (iOS/Android): weiterleiten auf Custom-Scheme damit
      // ASWebAuthenticationSession / Chrome Custom Tabs die URL abfangen können
      const qs = window.location.search;
      window.location.href = `bnmapp://auth/google/callback${qs}`;
    } else {
      window.location.href = "/";
    }
  }, [params]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={COLORS.gold} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.bg,
  },
});
