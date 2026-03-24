import React from "react";
import {
  TouchableOpacity,
  View,
  Text,
  StyleSheet,
  Platform,
  useWindowDimensions,
} from "react-native";
import { Tabs, useRouter, usePathname } from "expo-router";
import { SymbolView } from "expo-symbols";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { BNMLogo } from "../../components/BNMLogo";
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

// ─── Sidebar Item ────────────────────────────────────────────────────────────

interface SidebarItemProps {
  label: string;
  href: string;
  iconName: string;
  iconNameActive: string;
  isActive: boolean;
  onPress: () => void;
  badge?: number;
}

function SidebarItem({
  label,
  iconName,
  iconNameActive,
  isActive,
  onPress,
  badge,
}: SidebarItemProps) {
  const themeColors = useThemeColors();

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        sidebarStyles.item,
        isActive && {
          backgroundColor: themeColors.card,
          borderLeftColor: COLORS.gold,
        },
        !isActive && { borderLeftColor: "transparent" },
      ]}
      activeOpacity={0.7}
    >
      <Ionicons
        name={(isActive ? iconNameActive : iconName) as any}
        size={20}
        color={isActive ? COLORS.gold : themeColors.textSecondary}
      />
      <Text
        style={[
          sidebarStyles.itemLabel,
          { color: isActive ? themeColors.text : themeColors.textSecondary },
        ]}
      >
        {label}
      </Text>
      {badge != null && badge > 0 && (
        <View style={sidebarStyles.badge}>
          <Text style={sidebarStyles.badgeText}>
            {badge > 9 ? "9+" : String(badge)}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Admin Sidebar ───────────────────────────────────────────────────────────

function AdminSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const themeColors = useThemeColors();
  const { t } = useLanguage();
  const { getUnreadCount, getTotalUnreadMessages } = useData();
  const { user } = useAuth();
  const unreadCount = getUnreadCount();
  const isAdminOrOffice = user?.role === "admin" || user?.role === "office";
  const chatUnread = isAdminOrOffice ? 0 : getTotalUnreadMessages();

  const isOffice = user?.role === "office";

  // Aktiver Pfad: expo-router Tabs liefern z.B. "/(tabs)/index" oder "/(tabs)/reports"
  const activeSegment = pathname.includes("/reports")
    ? "reports"
    : pathname.includes("/mentees")
    ? "mentees"
    : pathname.includes("/chats")
    ? "chats"
    : pathname.includes("/leaderboard")
    ? "leaderboard"
    : pathname.includes("/profile")
    ? "profile"
    : "index";

  const items = [
    { key: "index", label: t("tabs.dashboard"), iconName: "home-outline", iconNameActive: "home", href: "/(tabs)/" },
    { key: "mentees", label: t("tabs.mentees"), iconName: "people-outline", iconNameActive: "people", href: "/(tabs)/mentees" },
    ...(!isOffice
      ? [{ key: "chats", label: t("tabs.chats"), iconName: "chatbubbles-outline", iconNameActive: "chatbubbles", href: "/(tabs)/chats", badge: chatUnread }]
      : []),
    { key: "reports", label: t("tabs.reports"), iconName: "bar-chart-outline", iconNameActive: "bar-chart", href: "/(tabs)/reports" },
    { key: "profile", label: t("tabs.profile"), iconName: "person-outline", iconNameActive: "person", href: "/(tabs)/profile" },
  ];

  return (
    <View
      style={[
        sidebarStyles.sidebar,
        { backgroundColor: themeColors.background, borderRightColor: themeColors.border },
      ]}
    >
      {/* Logo / App-Titel */}
      <View style={sidebarStyles.logoArea}>
        <BNMLogo size={36} showSubtitle={false} />
        <Text style={[sidebarStyles.logoSubtext, { color: themeColors.textSecondary, marginTop: 4 }]}>
          {user?.role === "admin" ? "Admin" : user?.role === "office" ? "Office" : user?.role === "mentor" ? "Mentor" : "Mentee"}
        </Text>
      </View>

      {/* Navigation Items */}
      <View style={sidebarStyles.nav}>
        {items.map((item) => (
          <SidebarItem
            key={item.key}
            label={item.label}
            href={item.href}
            iconName={item.iconName}
            iconNameActive={item.iconNameActive}
            isActive={activeSegment === item.key}
            onPress={() => router.push(item.href as any)}
            badge={item.badge}
          />
        ))}
      </View>

      {/* Notifications Button unten */}
      <View style={sidebarStyles.bottomArea}>
        <BellButton />
      </View>
    </View>
  );
}

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
  bellIcon: { fontSize: 22 },
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

const sidebarStyles = StyleSheet.create({
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    flexDirection: "column",
    paddingTop: 24,
  },
  logoArea: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  logoText: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 2,
  },
  logoSubtext: {
    fontSize: 11,
    fontWeight: "500",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginTop: 2,
  },
  nav: {
    flex: 1,
    paddingTop: 12,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderLeftWidth: 3,
    marginBottom: 2,
    gap: 12,
  },
  itemLabel: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
  },
  badge: {
    backgroundColor: COLORS.error,
    borderRadius: 9999,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: "bold",
  },
  bottomArea: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    alignItems: "flex-start",
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
  const showLeaderboard = !isMentee;
  const showChats = !isOffice;
  const showMentees = !isMentee;

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
        name="reports"
        options={{
          title: t("tabs.reports"),
          href: isAdminOrOffice ? undefined : null,
          tabBarIcon: ({ color }) => (
            Platform.OS === "ios" ? <SymbolView name={"chart.bar.fill" as any} tintColor={color} size={24} /> : <Ionicons name="bar-chart" size={22} color={color} />
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

function AdminSidebarLayout() {
  const themeColors = useThemeColors();

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: themeColors.background }}>
      <AdminSidebar />
      {/* Content area: Tabs mit ausgeblendeter TabBar */}
      <View style={{ flex: 1 }}>
        <Tabs
          screenOptions={{
            tabBarStyle: { display: "none", height: 0, overflow: "hidden" },
            headerStyle: {
              backgroundColor: themeColors.headerBackground,
            },
            headerTintColor: themeColors.headerText,
          }}
        >
          <Tabs.Screen
            name="index"
            options={{ title: "Dashboard" }}
          />
          <Tabs.Screen
            name="mentees"
            options={{ title: "Mentees" }}
          />
          <Tabs.Screen
            name="chats"
            options={{ title: "Chats" }}
          />
          <Tabs.Screen
            name="leaderboard"
            options={{ href: null }}
          />
          <Tabs.Screen
            name="reports"
            options={{ title: "Berichte" }}
          />
          <Tabs.Screen
            name="profile"
            options={{ title: "Profil" }}
          />
        </Tabs>
      </View>
    </View>
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
