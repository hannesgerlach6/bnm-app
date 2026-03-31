import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useThemeColors } from "../contexts/ThemeContext";
import { COLORS } from "../constants/Colors";

// ─── Route definitions ───────────────────────────────────────────────────────

type RouteItem = {
  id: string;
  label: string;
  description?: string;
  path: string;
  icon: string;
  roles: string[];
  keywords?: string[];
};

const ALL_ROUTES: RouteItem[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: "grid-outline",
    path: "/(tabs)/",
    roles: ["all"],
    keywords: ["home", "übersicht", "start"],
  },
  {
    id: "mentees",
    label: "Mentees",
    description: "Alle Mentees verwalten",
    icon: "people-outline",
    path: "/(tabs)/mentees",
    roles: ["admin", "office", "mentor"],
  },
  {
    id: "mentors",
    label: "Mentoren",
    description: "Mentoren verwalten",
    icon: "school-outline",
    path: "/(tabs)/mentors",
    roles: ["admin", "office"],
  },
  {
    id: "chats",
    label: "Chats",
    description: "Nachrichten & Gespräche",
    icon: "chatbubbles-outline",
    path: "/(tabs)/chats",
    roles: ["admin", "mentor", "mentee"],
  },
  {
    id: "applications",
    label: "Bewerbungen",
    description: "Mentor-Bewerbungen prüfen",
    icon: "document-text-outline",
    path: "/(tabs)/applications",
    roles: ["admin", "office"],
  },
  {
    id: "leaderboard",
    label: "Rangliste",
    description: "Mentor-Leaderboard",
    icon: "trophy-outline",
    path: "/(tabs)/leaderboard",
    roles: ["mentor"],
  },
  {
    id: "reports",
    label: "Berichte",
    description: "Statistiken & Auswertungen",
    icon: "stats-chart-outline",
    path: "/(tabs)/reports",
    roles: ["admin", "office"],
  },
  {
    id: "tools",
    label: "Tools",
    description: "Admin-Werkzeuge",
    icon: "construct-outline",
    path: "/(tabs)/tools",
    roles: ["admin", "office"],
  },
  {
    id: "feedback",
    label: "Feedback",
    description: "Mentor-Bewertungen",
    icon: "star-outline",
    path: "/(tabs)/feedback",
    roles: ["admin", "office"],
  },
  {
    id: "faq",
    label: "FAQ",
    description: "Häufige Fragen",
    icon: "help-circle-outline",
    path: "/(tabs)/faq",
    roles: ["mentee"],
  },
  {
    id: "profile",
    label: "Profil",
    description: "Mein Profil",
    icon: "person-circle-outline",
    path: "/(tabs)/profile",
    roles: ["all"],
  },
  {
    id: "edit-profile",
    label: "Profil bearbeiten",
    icon: "create-outline",
    path: "/edit-profile",
    roles: ["all"],
  },
  {
    id: "notifications",
    label: "Benachrichtigungen",
    icon: "notifications-outline",
    path: "/notifications",
    roles: ["all"],
  },
  {
    id: "settings",
    label: "Einstellungen",
    description: "App-Einstellungen",
    icon: "settings-outline",
    path: "/settings",
    roles: ["all"],
  },
  {
    id: "change-password",
    label: "Passwort ändern",
    icon: "lock-closed-outline",
    path: "/change-password",
    roles: ["all"],
  },
  {
    id: "session-types",
    label: "Session-Typen",
    description: "Mentoring-Schritte konfigurieren",
    icon: "list-outline",
    path: "/admin/session-types",
    roles: ["admin"],
  },
  {
    id: "statistics",
    label: "Statistiken",
    description: "Detaillierte Auswertungen",
    icon: "bar-chart-outline",
    path: "/admin/statistics",
    roles: ["admin", "office"],
  },
  {
    id: "csv-import",
    label: "CSV Import",
    description: "Nutzer importieren",
    icon: "cloud-upload-outline",
    path: "/admin/csv-import",
    roles: ["admin"],
  },
  {
    id: "qa-management",
    label: "FAQ verwalten",
    description: "Fragen & Antworten pflegen",
    icon: "help-buoy-outline",
    path: "/admin/qa-management",
    roles: ["admin"],
  },
  {
    id: "hadithe-management",
    label: "Hadithe verwalten",
    icon: "book-outline",
    path: "/admin/hadithe-management",
    roles: ["admin"],
  },
  {
    id: "pending-approvals",
    label: "Ausstehende Genehmigungen",
    description: "Mentor-Zulassungen prüfen",
    icon: "checkmark-circle-outline",
    path: "/admin/pending-approvals",
    roles: ["admin", "office"],
  },
  {
    id: "mentor-award",
    label: "Mentor des Monats",
    icon: "ribbon-outline",
    path: "/admin/mentor-award",
    roles: ["admin"],
  },
  {
    id: "hadithe",
    label: "Hadithe",
    description: "Islamische Lehren",
    icon: "book-outline",
    path: "/hadithe",
    roles: ["all"],
  },
  {
    id: "qa",
    label: "Fragen & Antworten",
    icon: "chatbox-ellipses-outline",
    path: "/qa",
    roles: ["all"],
  },
];

// ─── Component ───────────────────────────────────────────────────────────────

export function CommandPalette() {
  // Web-only guard — must be called before any other hook
  if (Platform.OS !== "web") return null;

  return <CommandPaletteInner />;
}

function CommandPaletteInner() {
  const { user } = useAuth();
  const themeColors = useThemeColors();
  const router = useRouter();

  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const inputRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  // Refs for each result row so we can scroll them into view
  const itemRefs = useRef<(View | null)[]>([]);

  // ── Filter routes by role ──────────────────────────────────────────────────
  const roleFilteredRoutes = React.useMemo(() => {
    if (!user) return [];
    return ALL_ROUTES.filter(
      (r) => r.roles.includes("all") || r.roles.includes(user.role)
    );
  }, [user?.role]);

  // ── Filter by search query ─────────────────────────────────────────────────
  const filteredRoutes = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roleFilteredRoutes;
    return roleFilteredRoutes.filter((r) => {
      const haystack = [
        r.label,
        r.description ?? "",
        ...(r.keywords ?? []),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [query, roleFilteredRoutes]);

  // ── Open / close helpers ───────────────────────────────────────────────────
  const open = useCallback(() => {
    setQuery("");
    setSelectedIndex(0);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const navigateTo = useCallback(
    (path: string) => {
      close();
      router.push(path as never);
    },
    [router, close]
  );

  const confirmSelected = useCallback(() => {
    const route = filteredRoutes[selectedIndex];
    if (route) navigateTo(route.path);
  }, [filteredRoutes, selectedIndex, navigateTo]);

  // ── Keyboard shortcut: Ctrl+K / Cmd+K ─────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open on Ctrl+K or Meta+K (skip when typing inside an input unless it's ours)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (isOpen) {
          close();
        } else {
          open();
        }
        return;
      }

      if (!isOpen) return;

      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredRoutes.length - 1 ? prev + 1 : prev
        );
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        confirmSelected();
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredRoutes.length, close, open, confirmSelected]);

  // ── Auto-focus input when opened ──────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Small delay ensures the Modal is fully mounted
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // ── Reset selectedIndex when results change ────────────────────────────────
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // ── Auto-scroll selected item into view ───────────────────────────────────
  useEffect(() => {
    const ref = itemRefs.current[selectedIndex];
    if (ref && scrollRef.current) {
      // scrollIntoView is available on web DOM nodes
      const domNode = ref as unknown as HTMLElement;
      if (domNode?.scrollIntoView) {
        domNode.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  // Don't render anything if user is not logged in
  if (!user) return null;

  const styles = makeStyles(themeColors);

  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={close}
      statusBarTranslucent
    >
      {/* Overlay — tap outside to close */}
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={close}
        accessible={false}
      >
        {/* Card — stop tap propagation */}
        <TouchableOpacity
          style={styles.card}
          activeOpacity={1}
          onPress={() => {/* do nothing – prevent overlay close */}}
        >
          {/* ── Search input ── */}
          <View style={styles.searchRow}>
            <Ionicons
              name="search-outline"
              size={18}
              color={themeColors.textSecondary}
              style={styles.searchIcon}
            />
            <TextInput
              ref={inputRef}
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Route suchen…"
              placeholderTextColor={themeColors.textTertiary}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="go"
              onSubmitEditing={confirmSelected}
            />
            {query.length > 0 && (
              <TouchableOpacity
                onPress={() => setQuery("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons
                  name="close-circle"
                  size={16}
                  color={themeColors.textTertiary}
                />
              </TouchableOpacity>
            )}
          </View>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Results list ── */}
          <ScrollView
            ref={scrollRef}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {filteredRoutes.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons
                  name="search-outline"
                  size={24}
                  color={themeColors.textTertiary}
                  style={{ marginBottom: 8 }}
                />
                <Text style={[styles.emptyText, { color: themeColors.textTertiary }]}>
                  {query.trim()
                    ? `Keine Ergebnisse für "${query.trim()}"`
                    : "Keine Routen verfügbar"}
                </Text>
              </View>
            ) : (
              filteredRoutes.map((route, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <View
                    key={route.id}
                    ref={(el) => { itemRefs.current[index] = el; }}
                  >
                    <TouchableOpacity
                      style={[
                        styles.resultItem,
                        isSelected && styles.resultItemSelected,
                      ]}
                      onPress={() => navigateTo(route.path)}
                      // @ts-ignore — Web-only hover prop
                      onMouseEnter={() => setSelectedIndex(index)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.iconContainer,
                          isSelected && styles.iconContainerSelected,
                        ]}
                      >
                        <Ionicons
                          name={route.icon as any}
                          size={16}
                          color={
                            isSelected ? COLORS.gold : themeColors.textSecondary
                          }
                        />
                      </View>
                      <View style={styles.labelContainer}>
                        <Text
                          style={[
                            styles.routeLabel,
                            { color: isSelected ? themeColors.text : themeColors.text },
                            isSelected && styles.routeLabelSelected,
                          ]}
                          numberOfLines={1}
                        >
                          {route.label}
                        </Text>
                        {route.description ? (
                          <Text
                            style={[
                              styles.routeDescription,
                              { color: themeColors.textTertiary },
                            ]}
                            numberOfLines={1}
                          >
                            {route.description}
                          </Text>
                        ) : null}
                      </View>
                      {isSelected && (
                        <Ionicons
                          name="return-down-back-outline"
                          size={14}
                          color={COLORS.gold}
                          style={styles.enterHint}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </ScrollView>

          {/* ── Divider ── */}
          <View style={styles.divider} />

          {/* ── Keyboard hints footer ── */}
          <View style={styles.footer}>
            <View style={styles.hintGroup}>
              <View style={styles.kbdBadge}>
                <Text style={styles.kbdText}>↑↓</Text>
              </View>
              <Text style={[styles.hintLabel, { color: themeColors.textTertiary }]}>
                Navigieren
              </Text>
            </View>
            <View style={styles.hintGroup}>
              <View style={styles.kbdBadge}>
                <Text style={styles.kbdText}>Enter</Text>
              </View>
              <Text style={[styles.hintLabel, { color: themeColors.textTertiary }]}>
                Öffnen
              </Text>
            </View>
            <View style={styles.hintGroup}>
              <View style={styles.kbdBadge}>
                <Text style={styles.kbdText}>Esc</Text>
              </View>
              <Text style={[styles.hintLabel, { color: themeColors.textTertiary }]}>
                Schließen
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── Styles factory ──────────────────────────────────────────────────────────

function makeStyles(themeColors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: "rgba(0, 0, 0, 0.60)",
      justifyContent: "flex-start",
      alignItems: "center",
      paddingTop: 80,
      paddingHorizontal: 16,
    },
    card: {
      width: "100%",
      maxWidth: 560,
      backgroundColor: themeColors.card,
      borderRadius: 16,
      overflow: "hidden",
      // Shadow
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.24,
      shadowRadius: 24,
      elevation: 16,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    searchIcon: {
      marginRight: 10,
    },
    input: {
      flex: 1,
      fontSize: 16,
      color: themeColors.text,
      outlineStyle: "none",
      // React Native web outline reset
      // @ts-ignore
      outline: "none",
    } as any,
    divider: {
      height: 1,
      backgroundColor: themeColors.border,
    },
    list: {
      maxHeight: 380,
    },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 40,
      paddingHorizontal: 24,
    },
    emptyText: {
      fontSize: 14,
      textAlign: "center",
    },
    resultItem: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginHorizontal: 8,
      marginVertical: 2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "transparent",
    },
    resultItemSelected: {
      backgroundColor: themeColors.elevated,
      borderColor: COLORS.gold,
    },
    iconContainer: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: themeColors.background,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    iconContainerSelected: {
      backgroundColor: `${COLORS.gold}18`,
    },
    labelContainer: {
      flex: 1,
    },
    routeLabel: {
      fontSize: 14,
      fontWeight: "500",
    },
    routeLabelSelected: {
      fontWeight: "600",
    },
    routeDescription: {
      fontSize: 12,
      marginTop: 1,
    },
    enterHint: {
      marginLeft: 8,
    },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 20,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    hintGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
    },
    kbdBadge: {
      backgroundColor: themeColors.background,
      borderWidth: 1,
      borderColor: themeColors.border,
      borderRadius: 4,
      paddingHorizontal: 5,
      paddingVertical: 2,
    },
    kbdText: {
      fontSize: 11,
      color: themeColors.textSecondary,
      fontFamily: "monospace",
    },
    hintLabel: {
      fontSize: 11,
    },
  });
}
