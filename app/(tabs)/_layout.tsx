import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { BNMPressable } from "../../components/BNMPressable";
import { Tabs, useRouter, usePathname } from "expo-router";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
// Lazy-Import: BlurView nur wenn verfügbar (vermeidet Web-Crashes)
let BlurView: any = null;
try {
  BlurView = require("expo-blur").BlurView;
} catch {
  // expo-blur nicht verfügbar — Fallback auf View
}
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useData } from "../../contexts/DataContext";
import { useLanguage } from "../../contexts/LanguageContext";
import { useTheme, useThemeColors } from "../../contexts/ThemeContext";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../constants/Colors";
import { AdminMobileDrawer } from "../../components/AdminMobileDrawer";

// ─── Bell Button ────────────────────────────────────────────────────────────

function BellButton() {
  const router = useRouter();
  const { getUnreadCount } = useData();
  const unreadCount = getUnreadCount();

  return (
    <BNMPressable
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
    </BNMPressable>
  );
}

// ─── Chat Tab Icon ───────────────────────────────────────────────────────────

function ChatTabIcon({ color }: { color: string }) {
  const { getTotalUnreadMessages, getTotalUnreadAdminMessages } = useData();
  const { user } = useAuth();
  // Admin und Office sind nur Beobachter — sie bekommen keine direkten Nachrichten,
  // daher keinen Badge anzeigen (würde jeden Mentor↔Mentee-Chat zählen).
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const unread = isAdminOrOffice ? 0 : getTotalUnreadMessages() + getTotalUnreadAdminMessages();
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
        <SymbolView
          name={(focused ? iosActiveName : iosName) as any}
          tintColor={color}
          size={23}
          style={tabStyles.symbolView}
        />
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
    width: 28,
    height: 26,
  },
  symbolView: {
    width: 24,
    height: 24,
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
    borderRadius: RADIUS.full,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },
});

// ─── Glassmorphism Tab Bar ──────────────────────────────────────────────────

function GlassTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const themeColors = useThemeColors();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  // Sub-Route → Tab-Index Mapping (damit Highlight bei Sub-Screens korrekt bleibt)
  const overrideIndex = (() => {
    const menteeSubPaths = ["/mentee/", "/mentorship/", "/assign", "/document-session", "/admin/edit-user"];
    const mentorSubPaths = ["/mentor/"];
    const toolPaths = ["/admin/session-types", "/admin/qa-management", "/admin/hadithe-management", "/admin/message-templates", "/admin/certificate-generator", "/admin/csv-import", "/admin/mentor-award", "/admin/statistics", "/admin/resources"];
    const chatPaths = ["/chat/"];

    if (menteeSubPaths.some((p) => pathname.includes(p))) {
      return state.routes.findIndex((r) => r.name === "mentees");
    }
    if (mentorSubPaths.some((p) => pathname.match(new RegExp("^" + p)))) {
      return state.routes.findIndex((r) => r.name === "mentors");
    }
    if (toolPaths.some((p) => pathname.includes(p))) {
      return state.routes.findIndex((r) => r.name === "tools");
    }
    if (chatPaths.some((p) => pathname.includes(p))) {
      return state.routes.findIndex((r) => r.name === "chats");
    }
    if (pathname.includes("/edit-profile") || pathname.includes("/change-password")) {
      return state.routes.findIndex((r) => r.name === "profile");
    }
    return -1; // kein Override
  })();
  const effectiveIndex = overrideIndex >= 0 ? overrideIndex : state.index;

  const containerStyle = [
    glassStyles.container,
    {
      paddingBottom: Math.max(insets.bottom, 8),
      borderTopColor: isDark ? themeColors.border : "rgba(0,0,0,0.06)",
      backgroundColor: isDark ? `${themeColors.background}D9` : "rgba(255,255,255,0.85)",
    },
  ];

  // BlurView mit Fallback auf einfaches View
  const Wrapper = BlurView ?? View;
  const wrapperProps = BlurView ? { intensity: isDark ? 40 : 60, tint: isDark ? "dark" : "light" } : {};

  return (
    <Wrapper {...wrapperProps} style={containerStyle}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = effectiveIndex === index;

        // Hidden tabs: Expo Router setzt tabBarButton → null für href: null
        if (options.tabBarButton) {
          try {
            const btn = (options.tabBarButton as any)({ children: null, style: {} });
            if (btn === null) return null;
          } catch { /* ignorieren */ }
        }

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const color = isFocused ? themeColors.tabIconActive : themeColors.tabIconInactive;

        return (
          <BNMPressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            style={glassStyles.tab}
          >
            {options.tabBarIcon?.({ color, focused: isFocused, size: 22 })}
            <Text style={[
              glassStyles.label,
              { color },
              isFocused && glassStyles.labelActive,
            ]}>
              {options.title ?? route.name}
            </Text>
          </BNMPressable>
        );
      })}
    </Wrapper>
  );
}

const glassStyles = StyleSheet.create({
  container: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 6,
    // Glassmorphism: halbtransparenter Hintergrund
    ...(Platform.OS === "web" ? {
      // @ts-ignore
      backdropFilter: "blur(20px) saturate(180%)",
    } : {}),
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
    gap: 2,
  },
  label: {
    fontSize: TYPOGRAPHY.size.xs,
    fontWeight: TYPOGRAPHY.weight.semibold,
    letterSpacing: 0.2,
    marginTop: 1,
  },
  labelActive: {
    fontWeight: TYPOGRAPHY.weight.bold,
  },
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
      tabBar={(props) => <GlassTabBar {...props} />}
      screenOptions={{
        tabBarActiveTintColor: themeColors.tabIconActive,
        tabBarInactiveTintColor: themeColors.tabIconInactive,
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
            // Ionicons statt SymbolView — trophy SF Symbol hat schlechte Proportionen im Tab Bar
            <View style={tabStyles.iconWrapper}>
              <Ionicons name={focused ? "trophy" : "trophy-outline"} size={22} color={color} />
              {focused && <View style={[tabStyles.activeDot, { backgroundColor: color }]} />}
            </View>
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
    <BNMPressable
      onPress={() => setDrawerOpen(true)}
      style={{ paddingLeft: 16, paddingRight: 8, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
      accessibilityRole="button"
      accessibilityLabel="Menü öffnen"
    >
      <Ionicons name="menu" size={26} color={COLORS.gold} />
    </BNMPressable>
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

  // Web Desktop (>= 768px): Sidebar für alle eingeloggten User
  const useSidebar = hasMounted && isWeb && !!user && width >= 768;

  // Web Mobile (< 768px): Hamburger-Drawer für alle User
  const useWebMobileDrawer = hasMounted && isWeb && !!user && width < 768;

  // Native Admin/Office: Hamburger-Menü statt TabBar
  const useNativeAdminDrawer = hasMounted && isMobile && isAdminOrOffice;

  if (useSidebar) {
    return <AdminSidebarLayout />;
  }

  if (useWebMobileDrawer || useNativeAdminDrawer) {
    return <AdminMobileLayout />;
  }

  // Native Mentor/Mentee: Bottom-Tabs
  return <TabsLayout />;
}
