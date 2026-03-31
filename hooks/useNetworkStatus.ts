// Detects online/offline status cross-platform
// Web: uses navigator.onLine + online/offline events
// Native: uses fetch-based polling (no extra dependency)
import { useState, useEffect } from "react";
import { Platform } from "react-native";

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    } else {
      // Native: Check once on mount, then poll every 10s
      let mounted = true;
      async function checkOnline() {
        try {
          await fetch("https://jbuvnmjlvebzknbmzryb.supabase.co/health", {
            method: "HEAD",
            cache: "no-store",
          });
          if (mounted) setIsOnline(true);
        } catch {
          if (mounted) setIsOnline(false);
        }
      }
      checkOnline();
      const interval = setInterval(checkOnline, 15000);
      return () => {
        mounted = false;
        clearInterval(interval);
      };
    }
  }, []);

  return isOnline;
}
