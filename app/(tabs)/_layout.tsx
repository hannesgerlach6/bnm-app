import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Tabs, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useThemeColors } from "../../contexts/ThemeContext";
import { COLORS } from "../../constants/Colors";

// ─── Bell Button ────────────────────────────────────────────────────────────

function BellButton() {
  const router = useRouter();
  const { getUnreadCount } = useData();
  const unreadCount = getUnreadCount();

  return (
    <TouchableOpacity
      onPress={() => router.push("/notifications")}
      style={tabStyles.bellWrapper}
    >
      <Ionicons name="notifications-outline" size={22} color={COLORS.gold} />
      {unreadCount > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>
            {unreadCount > 9 ? "9+" : String(unreadCount)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Chat Tab Icon ───────────────────────────────────────────────────────────

function ChatTabIcon({ color }: { color: string }) {
  const { getTotalUnreadMessages } = useData();
  const { user } = useAuth();
  // Admin und Office sind nur Beobachter — sie bekommen keine direkten Nachrichten,
  // daher keinen Badge anzeigen (würde jeden Mentor↔Mentee-Chat zählen).
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const unread = isAdminOrOffice ? 0 : getTotalUnreadMessages();
  return (
    <View style={tabStyles.chatIconWrapper}>
      {Platform.OS === "ios" ? (
        <SymbolView name={"message.fill" as any} tintColor={color} size={24} />
      ) : (
        <Ionicons name="chatbubble" size={22} color={color} />
      )}
      {unread > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>
            {unread > 9 ? "9+" : String(unread)}
          </Text>
        </View>
      )}
    </View>
  );
}

// AdminSidebar ist jetzt in components/AdminSidebar.tsx und wird vom Root-Layout gerendert

// ─── Styles ─────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  bellWrapper: {
    marginRight: 12,
    position: "relative",
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  chatIconWrapper: {
    position: "relative",
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -6,
    backgroundColor: COLORS.error,
    borderRadius: 9999,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },
});

// ─── Tab Layout (Mobile + Web Non-Admin) ────────────────────────────────────

function TabsLayout() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const themeColors = useThemeColors();
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const isMentee = user?.role === "mentee";
  const isOffice = user?.role === "office";
  const isMobile = Platform.OS !== "web";

  // Mobile TabBar: Max 5-6 Tabs anzeigen.
  // Admin/Office auf Mobile: Dashboard, Mentees, Chats, Reports, Profile (5 Tabs).
  // Mentors, Applications, Tools, Feedback, Leaderboard werden über Sidebar navigiert (Web)
  // oder sind über Dashboard-Quicklinks erreichbar.
  // Mentor auf Mobile: Dashboard, Mentees, Chats, Leaderboard, Profile (5 Tabs).
  // Mentee auf Mobile: Dashboard, Chats, Profile (3 Tabs).

  const showMentees = !isMentee;
  const showChats = !isOffice;
  // Leaderboard: nur für Mentor auf Mobile; für Admin/Office auf Mobile ausblenden (zu viele Tabs)
  const showLeaderboard = !isMentee && !(isAdminOrOffice && isMobile);
  // FAQ: nur für Mentees sichtbar
  const showFAQ = isMentee;
  // Admin-only Tabs (Mentors, Applications, Tools, Reports, Feedback): auf Mobile ausblenden
  const showAdminTabOnMobile = isAdminOrOffice && !isMobile;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.tabIconActive,
        tabBarInactiveTintColor: themeColors.tabIconInactive,
        tabBarStyle: {
          backgroundColor: themeColors.tabBar,
          borderTopColor: themeColors.tabBarBorder,
        },
        headerStyle: {
          backgroundColor: themeColors.headerBackground,
        },
        headerTintColor: themeColors.headerText,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("tabs.dashboard"),
          headerRight: () => <BellButton />,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"house.fill" as any} tintColor={color} size={24} /> : <Ionicons name="home" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mentees"
        options={{
          title: t("tabs.mentees"),
          href: showMentees ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"person.2.fill" as any} tintColor={color} size={24} /> : <Ionicons name="people" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: t("tabs.chats"),
          href: showChats ? undefined : null,
          tabBarIcon: ({ color }) => <ChatTabIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: t("tabs.ranking"),
          href: showLeaderboard ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"trophy.fill" as any} tintColor={color} size={24} /> : <Ionicons name="trophy" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="faq"
        options={{
          title: t("tabs.faq"),
          href: showFAQ ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"questionmark.circle.fill" as any} tintColor={color} size={24} /> : <Ionicons name="help-circle" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="mentors"
        options={{
          title: t("sidebar.mentors"),
          // Nur auf Web für Admin/Office sichtbar; auf Mobile ausgeblendet (TabBar zu voll)
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"person.badge.clock.fill" as any} tintColor={color} size={24} /> : <Ionicons name="school" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: t("sidebar.applications"),
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"doc.text.fill" as any} tintColor={color} size={24} /> : <Ionicons name="document-text" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"wrench.and.screwdriver.fill" as any} tintColor={color} size={24} /> : <Ionicons name="construct" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          // Reports auf Mobile für Admin sichtbar lassen (wichtig für unterwegs)
          href: isAdminOrOffice ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"chart.bar.fill" as any} tintColor={color} size={24} /> : <Ionicons name="bar-chart" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: t("tabs.feedback"),
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color }) => (
            <Ionicons name="star" size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"person.circle.fill" as any} tintColor={color} size={24} /> : <Ionicons name="person-circle" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

// ─── Admin Sidebar Layout (Web only) ────────────────────────────────────────
// Sidebar wird vom Root-Layout (_layout.tsx) gerendert — hier nur Tabs ohne TabBar

function AdminSidebarLayout() {
  const themeColors = useThemeColors();

  return (
    <Tabs
      screenOptions={{
        tabBarStyle: { display: "none", height: 0, overflow: "hidden" },
        headerShown: false,
        // Lazy loading deaktivieren damit Tabs sofort verfügbar sind
        // und kein Flash zum Default-Tab entsteht
        lazy: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="mentees" options={{ title: "Mentees" }} />
      <Tabs.Screen name="chats" options={{ title: "Chats" }} />
      <Tabs.Screen name="leaderboard" options={{ href: null }} />
      <Tabs.Screen name="faq" options={{ href: null }} />
      <Tabs.Screen name="mentors" options={{ title: "Mentoren" }} />
      <Tabs.Screen name="applications" options={{ title: "Bewerbungen" }} />
      <Tabs.Screen name="tools" options={{ title: "Tools" }} />
      <Tabs.Screen name="reports" options={{ title: "Berichte" }} />
      <Tabs.Screen name="feedback" options={{ title: "Feedback" }} />
      <Tabs.Screen name="profile" options={{ title: "Profil" }} />
    </Tabs>
  );
}

// ─── Root Layout Switcher ────────────────────────────────────────────────────

export default function TabLayout() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();

  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const isWeb = Platform.OS === "web";
  // Sidebar nur auf Web und bei Admin/Office, und nur wenn Viewport breit genug (>= 768px)
  const useSidebar = isWeb && isAdminOrOffice && width >= 768;

  if (useSidebar) {
    return <AdminSidebarLayout />;
  }

  return <TabsLayout />;
}
