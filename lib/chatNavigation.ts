import { Platform } from "react-native";
import { Router } from "expo-router";

/**
 * Navigiert zum Chat. Auf Web: öffnet im Chats-Tab (inline).
 * Auf Mobile: öffnet separaten Chat-Screen.
 */
export function navigateToChat(router: Router, mentorshipId: string) {
  router.push({ pathname: "/(tabs)/chats", params: { openChat: mentorshipId } } as any);
}
