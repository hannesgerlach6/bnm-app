export const COLORS = {
  primary: "#101828",
  secondary: "#475467",
  tertiary: "#98A2B3",
  gold: "#EEA71B",
  goldDeep: "#D4920F",        // Dunkleres Gold für Hover/Active
  cta: "#0D9C6E",             // Satteres Grün
  link: "#444CE7",
  gradientStart: "#0A3A5A",
  gradientEnd: "#012A46",
  progressGreen: "#0D9C6E",
  bg: "#F8F7F4",              // Warmes Weiß statt kühles Grau
  card: "#FFFFFF",
  border: "#e5e7eb",
  error: "#dc2626",
  errorLight: "#ef4444",         // Helleres Rot (Badges, Borders)
  errorDark: "#b91c1c",          // Dunkles Rot (Text auf hellem Bg)
  errorBorder: "#f87171",        // Rot für Input-Borders, Error-States
  errorBg: "#fef2f2",            // Error-Hintergrund
  errorBorderLight: "#fecaca",   // Helle Error-Border
  blue: "#3b82f6",               // Standard-Blau (Links, Badges)
  blueLight: "#93c5fd",          // Helles Blau (Dark-Mode Text)
  blueBorder: "#bfdbfe",         // Blau für Borders
  warning: "#f59e0b",            // Amber/Warning
  warningDark: "#b45309",        // Dunkles Amber (Text)
  warningBorder: "#fde68a",      // Amber-Border
  successDark: "#15803d",        // Dunkles Grün (Text auf hellem Bg)
  successBg: "#dcfce7",          // Grüner Hintergrund
  gray: "#666666",               // Mittleres Grau (disabled Buttons)
  grayLight: "#cccccc",          // Helles Grau (Borders, disabled)
  grayMuted: "#6B7280",          // Gedämpftes Grau (Subtexte, Labels)
  grayBorder: "#D1D5DB",         // Helle Grau-Border (Sterne, Divider)
  divider: "#E5E7EB",            // Divider / Trenner
  goldText: "#92600a",           // Gold-Dunkel für Text auf Gold-Bg
  white: "#FFFFFF",
} as const;

// Typography-Token-System
export const TYPOGRAPHY = {
  // Größen
  size: {
    xs: 11,
    sm: 12,
    md: 13,
    base: 14,
    lg: 15,
    subtitle: 16,    // Für Untertitel, Card-Titles — füllt die Lücke zwischen lg und xl
    xl: 18,
    xxl: 20,
    xxxl: 24,
    display: 28,
    hero: 34,
    jumbo: 42,
  },
  // Gewichte
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
    extrabold: "800" as const,
  },
  // Zeilenhöhen
  lineHeight: {
    tight: 16,
    normal: 20,
    relaxed: 22,
    loose: 24,
    heading: 30,
  },
  // Letter-Spacing
  letterSpacing: {
    tight: -0.4,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
    caps: 0.8,       // Für uppercase Labels
  },
  // Fertige Text-Styles (copy-paste ready)
  styles: {
    h1: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5, lineHeight: 34 },
    h2: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.3, lineHeight: 28 },
    h3: { fontSize: 18, fontWeight: "600" as const, letterSpacing: -0.2, lineHeight: 24 },
    h4: { fontSize: 15, fontWeight: "600" as const, letterSpacing: -0.1, lineHeight: 20 },
    body: { fontSize: 14, fontWeight: "400" as const, lineHeight: 22 },
    bodyMedium: { fontSize: 14, fontWeight: "500" as const, lineHeight: 22 },
    bodySmall: { fontSize: 13, fontWeight: "400" as const, lineHeight: 20 },
    label: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.8, lineHeight: 16 },
    labelLarge: { fontSize: 13, fontWeight: "600" as const, letterSpacing: 0.3, lineHeight: 18 },
    caption: { fontSize: 11, fontWeight: "400" as const, lineHeight: 16 },
    button: { fontSize: 14, fontWeight: "600" as const, letterSpacing: 0.2 },
  },
} as const;

// Design-Tokens für konsistentes Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

// Radius-Skala — leicht aufgewertet für moderneres Gefühl
export const RADIUS = {
  xs: 6,    // Mini-Badges, Tags
  sm: 10,   // war 8 — kleine Chips, Buttons
  md: 14,   // war 12 — Standard: Inputs, Cards
  lg: 18,   // war 16 — Modals, Sheets
  xl: 24,   // war 20 — Hero-Cards
  full: 999,
} as const;

// Farbige Schatten — mehr Tiefe, weniger "generisch schwarz"
export const SHADOWS = {
  sm: {
    shadowColor: "#0A3A5A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.10,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#0A3A5A",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 10,
    elevation: 5,
  },
  lg: {
    shadowColor: "#0A3A5A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  // Gold-Glow für featured/aktive Elemente
  gold: {
    shadowColor: "#EEA71B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.30,
    shadowRadius: 10,
    elevation: 5,
  },
  // Dezenter Gold-Schimmer für Level-Cards, Hadith-Cards etc.
  goldSubtle: {
    shadowColor: "#EEA71B",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  // Kräftiger Gold-Schatten für Award-/Zertifikats-Cards
  goldMedium: {
    shadowColor: "#EEA71B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 6,
  },
  // Weicher Glow für Focus/Error-States (BNMInput etc.)
  glowSoft: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  }),
  // Farbloser Glow für beliebige Farbe
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

// ─── Light Theme ──────────────────────────────────────────────────────────────
export const LIGHT_COLORS = {
  // Backgrounds
  background: "#F8F7F4",        // Warmes Weiß
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  surface: "#F1EFE9",           // Für gruppierte Sektionen, leicht getönt

  // Text — etwas mehr Kontrast
  text: "#0F1923",
  textSecondary: "#4A5568",
  textTertiary: "#6B7280",      // war #98A2B3 — besser WCAG AA Kontrast
  textInverse: "#FFFFFF",

  // Borders
  border: "#E2E8F0",
  borderFocus: "#0A3A5A",       // Fokussierter Input-Border

  // Brand
  primary: "#0A3A5A",
  primaryDark: "#012A46",
  primaryLight: "#EAF3FB",      // Heller Blau-Tint für Hover/Highlights
  accent: "#EEA71B",
  accentLight: "#FFF8E6",       // Heller Gold-Tint für Hintergründe

  // Semantic
  success: "#0D9C6E",
  successLight: "#ECFDF5",
  warning: "#D97706",
  warningLight: "#FFFBEB",
  error: "#dc2626",
  errorLight: "#FEF2F2",
  info: "#0284C7",
  infoLight: "#F0F9FF",
  link: "#444CE7",

  // Misc
  white: "#FFFFFF",
  black: "#0F1923",

  // Navigation
  tabBar: "#FFFFFF",
  tabBarBorder: "#E2E8F0",
  tabIconActive: "#0A3A5A",     // Primärblau im Light Mode
  tabIconInactive: "#94A3B8",
  headerBackground: "#FFFFFF",
  headerText: "#0F1923",
  statItem: "#F8F7F4",
  input: "#FFFFFF",
} as const;

// ─── Dark Theme — tiefes Schwarz ──────────────────────────────────────────────
export const DARK_COLORS = {
  // Backgrounds — echtes Schwarz mit minimaler Aufhellung pro Ebene
  background: "#0E0E14",        // Fast Schwarz — neutral, kein Blaustich
  card: "#18181F",              // Card-Ebene — minimal heller
  elevated: "#222230",          // Inputs, Dropdowns — klar abgesetzt
  surface: "#131319",           // Zwischen bg und card — für Sektionen

  // Text
  text: "#F1F5F9",
  textSecondary: "#94A0B4",
  textTertiary: "#64748B",
  textInverse: "#0E0E14",

  // Borders
  border: "#2A2A38",            // Dezente Borders
  borderFocus: "#2D7AB8",       // Kräftiger Focus

  // Brand
  primary: "#2D7AB8",
  primaryDark: "#0A3A5A",
  primaryLight: "#0D1F35",
  accent: "#F5B731",
  accentLight: "#2A1F00",

  // Semantic
  success: "#34D399",
  successLight: "#0A2E1A",
  warning: "#FBBF24",
  warningLight: "#2A1F0A",
  error: "#F87171",
  errorLight: "#2D1010",
  info: "#60CDFF",
  infoLight: "#0C1F2E",
  link: "#7CB8FF",

  // Misc
  white: "#F1F5F9",
  black: "#0E0E14",

  // Navigation
  tabBar: "#0E0E14",
  tabBarBorder: "#2A2A38",
  tabIconActive: "#F5B731",
  tabIconInactive: "#4B5563",
  headerBackground: "#0E0E14",
  headerText: "#F1F5F9",
  statItem: "#18181F",
  input: "#222230",
} as const;

// ─── Responsive Breakpoints ──────────────────────────────────────────────────
export const BREAKPOINTS = {
  mobile: 375,
  tablet: 768,
  desktop: 1024,
  wide: 1280,
} as const;

// ─── Semantische Farb-Aliase (light/dark Paare für wiederkehrende Muster) ────
export const SEMANTIC = {
  // Amber/Warning Boxen (Dashboard, Mentees)
  amberBg:     { light: "#fffbeb", dark: "#3a2e1a" },
  amberBorder: { light: "#fde68a", dark: "#6b4e1a" },
  amberText:   { light: "#92400e", dark: "#fbbf24" },
  amberTextAlt:{ light: "#78350f", dark: "#fbbf24" },
  // Blue/Info Boxen
  blueBg:      { light: "#eff6ff", dark: "#1a2a3a" },
  blueBorder:  { light: "#bfdbfe", dark: "#1e3a5a" },
  blueText:    { light: "#1d4ed8", dark: "#93c5fd" },
  blueBadgeBg: { light: "#3b82f6", dark: "#1e3a6e" },
  // Error/Red Boxen
  redBg:       { light: "#fff1f2", dark: "#3a1a1a" },
  redBorder:   { light: "#fecdd3", dark: "#7a2a2a" },
  redText:     { light: "#ef4444", dark: "#f87171" },
  redTextDark: { light: "#991b1b", dark: "#f87171" },
  // Green/Success Boxen
  greenBg:     { light: "#dcfce7", dark: "#1a2a1a" },
  greenBorder: { light: "#86efac", dark: "#2d6a4a" },
  greenText:   { light: "#15803d", dark: "#4ade80" },
  greenTextAlt:{ light: "#16a34a", dark: "#34D399" },
  // Purple (Admin-Badge)
  purpleBg:    { light: "#f3e8ff", dark: "#2e1a4a" },
  purpleText:  { light: "#7e22ce", dark: "#c084fc" },
  // Gold-Tint (Level-Cards, Achievements)
  goldBg:      { light: "#FFF8E1", dark: "#2A2518" },
  goldBorder:  { light: "rgba(238,167,27,0.3)", dark: "#3A3520" },
  // Indigo (Stats)
  indigo:      "#6366f1",
  // Dark-Mode Border (Chats, Cards)
  darkBorder:  { light: "#E2E8F0", dark: "#2A2A35" },
  // Selected/Hover Hintergrund (Chat-Items)
  selectedBg:  { light: "#F0F4FF", dark: "#1E1E2C" },
} as const;

// Helper: Farbe basierend auf isDark auswählen
export function sem(pair: { light: string; dark: string }, isDark: boolean): string {
  return isDark ? pair.dark : pair.light;
}

// Lockerer Typ für Theme-Farben
export type ThemeColors = {
  [K in keyof typeof LIGHT_COLORS]: string;
};

export default {
  light: {
    text: COLORS.primary,
    background: COLORS.bg,
    tint: COLORS.primary,
    tabIconDefault: COLORS.tertiary,
    tabIconSelected: COLORS.primary,
  },
  dark: {
    text: COLORS.white,
    background: COLORS.primary,
    tint: COLORS.white,
    tabIconDefault: COLORS.tertiary,
    tabIconSelected: COLORS.white,
  },
};
