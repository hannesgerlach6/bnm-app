import React from "react";
import { Tabs } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useAuth } from "../../contexts/AuthContext";

export default function TabLayout() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#101828",
        tabBarInactiveTintColor: "#98A2B3",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          borderTopColor: "#e5e7eb",
        },
        headerStyle: {
          backgroundColor: "#FFFFFF",
        },
        headerTintColor: "#101828",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{ ios: "house.fill", android: "home", web: "home" }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="mentees"
        options={{
          title: "Mentees",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "person.2.fill",
                android: "group",
                web: "group",
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: "Berichte",
          href: isAdmin ? undefined : null,
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "chart.bar.fill",
                android: "bar_chart",
                web: "bar_chart",
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => (
            <SymbolView
              name={{
                ios: "person.circle.fill",
                android: "account_circle",
                web: "account_circle",
              }}
              tintColor={color}
              size={24}
            />
          ),
        }}
      />
    </Tabs>
  );
}
