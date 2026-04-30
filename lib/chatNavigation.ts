import { Router } from "expo-router";

export function navigateToChat(router: Router, mentorshipId: string) {
  router.push({ pathname: "/(tabs)/chats", params: { openChat: mentorshipId } } as any);
}
