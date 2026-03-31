export const COLORS = {
  primary: "#101828",
  secondary: "#475467",
  tertiary: "#98A2B3",
  gold: "#EEA71B",
  cta: "#27ae60",
  link: "#444CE7",
  gradientStart: "#0A3A5A",
  gradientEnd: "#012A46",
  progressGreen: "#2d802f",
  bg: "#F9FAFB",
  card: "#FFFFFF",
  border: "#e5e7eb",
  error: "#dc2626",
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
    xl: 18,
    xxl: 20,
    xxxl: 24,
    display: 28,
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
  },
  // Letter-Spacing
  letterSpacing: {
    tight: -0.3,
    normal: 0,
    wide: 0.5,
    wider: 1,
    widest: 1.5,
  },
} as const;

// Design-Tokens für konsistentes Spacing & Radii
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
} as const;

// Plattform-übergreifende Schatten
export const SHADOWS = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },
  glow: (color: string) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  }),
} as const;

// Light Theme Farbpalette
export const LIGHT_COLORS = {
  // Backgrounds
  background: "#F5F5F7",
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  // Text
  text: "#101828",
  textSecondary: "#475467",
  textTertiary: "#98A2B3",
  // Borders
  border: "#E5E7EB",
  // Brand
  primary: "#0A3A5A",
  primaryDark: "#012A46",
  accent: "#EEA71B",
  // Semantic
  success: "#27ae60",
  error: "#dc2626",
  link: "#444CE7",
  // Misc
  white: "#FFFFFF",
  black: "#101828",
  tabBar: "#FFFFFF",
  tabBarBorder: "#E5E7EB",
  tabIconActive: "#101828",
  tabIconInactive: "#98A2B3",
  headerBackground: "#FFFFFF",
  headerText: "#101828",
  statItem: "#F9FAFB",
  input: "#FFFFFF",
} as const;

// Dark Theme Farbpalette — SaaS Panel Stil (Alpha Gym Referenz)
export const DARK_COLORS = {
  // Backgrounds — tiefes Blau-Schwarz
  background: "#0E0E14",
  card: "#1A1A24",
  elevated: "#1E1E2A",
  // Text
  text: "#F5F5F7",
  textSecondary: "#8E8E9A",
  textTertiary: "#5E5E6A",
  // Borders
  border: "#2A2A35",
  // Brand (unveränderlich)
  primary: "#0A3A5A",
  primaryDark: "#012A46",
  accent: "#FFCA28",
  // Semantic
  success: "#4CAF50",
  error: "#EF5350",
  link: "#42A5F5",
  // Misc
  white: "#F5F5F7",
  black: "#0E0E14",
  tabBar: "#0D0D12",
  tabBarBorder: "#1A1A24",
  tabIconActive: "#F5F5F7",
  tabIconInactive: "#5E5E6A",
  headerBackground: "#0D0D12",
  headerText: "#F5F5F7",
  statItem: "#1A1A24",
  input: "#1E1E2A",
} as const;

// Lockerer Typ für Theme-Farben (string statt Literal-Typen, damit Light + Dark zuweisbar sind)
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
