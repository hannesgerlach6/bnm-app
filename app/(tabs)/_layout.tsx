import React, { useState, useEffect, useCallback } from "react";
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
import { AdminMobileDrawer } from "../../components/AdminMobileDrawer";

// ─── Bell Button ────────────────────────────────────────────────────────────

function BellButton() {
  const router = useRouter();
  const { getUnreadCount } = useData();
  const unreadCount = getUnreadCount();

  return (
    <TouchableOpacity
      onPress={() => router.push("/notifications")}
      style={tabStyles.bellWrapper}
      accessibilityRole="button"
      accessibilityLabel={unreadCount > 0 ? `Benachrichtigungen, ${unreadCount} ungelesen` : "Benachrichtigungen"}
    >
      <Ionicons name="notifications-outline" size={22} color={COLORS.gold} />
      {unreadCount > 0 && (
        <View style={tabStyles.badge} accessibilityElementsHidden>
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
    <View style={tabStyles.chatIconWrapper} accessibilityLabel={unread > 0 ? `Chats, ${unread} ungelesen` : "Chats"}>
      {Platform.OS === "ios" ? (
        <SymbolView name={"message.fill" as any} tintColor={color} size={24} />
      ) : (
        <Ionicons name="chatbubble" size={22} color={color} />
      )}
      {unread > 0 && (
        <View style={tabStyles.badge} accessibilityElementsHidden>
          <Text style={tabStyles.badgeText}>
            {unread > 9 ? "9+" : String(unread)}
          </Text>
        </View>
      )}
    </View>
  );
}

// AdminSidebar ist jetzt in components/AdminSidebar.tsx und wird vom Root-Layout gerendert

// ─── Tab Icon mit Dot-Indikator ──────────────────────────────────────────────

function TabIcon({
  iosName,
  iosActiveName,
  ionName,
  color,
  focused,
}: {
  iosName: string;
  iosActiveName: string;
  ionName: string;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={tabStyles.iconWrapper}>
      {Platform.OS === "ios" ? (
        <SymbolView name={(focused ? iosActiveName : iosName) as any} tintColor={color} size={23} />
      ) : (
        <Ionicons name={ionName as any} size={22} color={color} />
      )}
      {focused && <View style={[tabStyles.activeDot, { backgroundColor: color }]} />}
    </View>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  bellWrapper: {
    marginRight: 8,
    position: "relative",
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  chatIconWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 2,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    marginTop: 3,
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
          borderTopWidth: 1,
          minHeight: 62,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.2,
          marginTop: 0,
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
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="house" iosActiveName="house.fill" ionName="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mentees"
        options={{
          title: t("tabs.mentees"),
          href: showMentees ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="person.2" iosActiveName="person.2.fill" ionName="people" color={color} focused={focused} />
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
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="trophy" iosActiveName="trophy.fill" ionName="trophy" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="faq"
        options={{
          title: t("tabs.faq"),
          href: showFAQ ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="questionmark.circle" iosActiveName="questionmark.circle.fill" ionName="help-circle" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="mentors"
        options={{
          title: t("sidebar.mentors"),
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="person.badge.clock" iosActiveName="person.badge.clock.fill" ionName="school" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="applications"
        options={{
          title: t("sidebar.applications"),
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="doc.text" iosActiveName="doc.text.fill" ionName="document-text" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="wrench.and.screwdriver" iosActiveName="wrench.and.screwdriver.fill" ionName="construct" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: t("tabs.reports"),
          href: isAdminOrOffice ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="chart.bar" iosActiveName="chart.bar.fill" ionName="bar-chart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="feedback"
        options={{
          title: t("tabs.feedback"),
          href: showAdminTabOnMobile ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="star" iosActiveName="star.fill" ionName={focused ? "star" : "star-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, focused }) => (
            <TabIcon iosName="person.circle" iosActiveName="person.circle.fill" ionName={focused ? "person-circle" : "person-circle-outline"} color={color} focused={focused} />
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

// ─── Admin Mobile Layout (Hamburger-Menü, kein TabBar) ──────────────────────

function AdminMobileLayout() {
  const themeColors = useThemeColors();
  const { t } = useLanguage();
  const { user } = useAuth();
  const isOffice = user?.role === "office";
  const [drawerOpen, setDrawerOpen] = useState(false);

  const headerLeft = useCallback(() => (
    <TouchableOpacity
      onPress={() => setDrawerOpen(true)}
      style={{ paddingLeft: 16, paddingRight: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="button"
      accessibilityLabel="Menü öffnen"
    >
      <Ionicons name="menu" size={26} color={COLORS.gold} />
    </TouchableOpacity>
  ), []);

  const headerRight = useCallback(() => <BellButton />, []);

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarStyle: { display: "none", height: 0, overflow: "hidden" },
          headerShown: true,
          headerStyle: { backgroundColor: themeColors.headerBackground },
          headerTintColor: themeColors.headerText,
          headerLeft,
          headerRight,
          lazy: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: t("tabs.dashboard") }} />
        <Tabs.Screen name="mentees" options={{ title: t("tabs.mentees") }} />
        <Tabs.Screen name="chats" options={{ title: t("tabs.chats"), href: isOffice ? null : undefined }} />
        <Tabs.Screen name="leaderboard" options={{ href: null }} />
        <Tabs.Screen name="faq" options={{ href: null }} />
        <Tabs.Screen name="mentors" options={{ title: t("sidebar.mentors") }} />
        <Tabs.Screen name="applications" options={{ title: t("sidebar.applications") }} />
        <Tabs.Screen name="tools" options={{ title: "Tools" }} />
        <Tabs.Screen name="reports" options={{ title: t("tabs.reports") }} />
        <Tabs.Screen name="feedback" options={{ title: t("tabs.feedback") }} />
        <Tabs.Screen name="profile" options={{ title: t("tabs.profile") }} />
      </Tabs>
      <AdminMobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}

// ─── Root Layout Switcher ────────────────────────────────────────────────────

export default function TabLayout() {
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => { setHasMounted(true); }, []);

  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const isWeb = Platform.OS === "web";
  const isMobile = Platform.OS !== "web";

  // Sidebar nur auf Web und bei Admin/Office, und nur wenn Viewport breit genug (>= 768px)
  // hasMounted verhindert Hydration-Mismatch (Server: width=0, Client: echter Viewport)
  const useSidebar = hasMounted && isWeb && isAdminOrOffice && width >= 768;

  // Admin/Office auf Mobile: Hamburger-Menü statt TabBar
  const useMobileAdminDrawer = hasMounted && isMobile && isAdminOrOffice;

  if (useSidebar) {
    return <AdminSidebarLayout />;
  }

  if (useMobileAdminDrawer) {
    return <AdminMobileLayout />;
  }

  return <TabsLayout />;
}
