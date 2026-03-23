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

// Dark Theme Farbpalette
export const DARK_COLORS = {
  // Backgrounds
  background: "#1A1B2E",
  card: "#232540",
  elevated: "#232540",
  // Text
  text: "#E8E8ED",
  textSecondary: "#9A9AB0",
  textTertiary: "#6B6B85",
  // Borders
  border: "#2E3050",
  // Brand (unveränderlich)
  primary: "#0A3A5A",
  primaryDark: "#012A46",
  accent: "#EEA71B",
  // Semantic
  success: "#27ae60",
  error: "#dc2626",
  link: "#818CF8",
  // Misc
  white: "#E8E8ED",
  black: "#1A1B2E",
  tabBar: "#1E1F35",
  tabBarBorder: "#2E3050",
  tabIconActive: "#E8E8ED",
  tabIconInactive: "#6B6B85",
  headerBackground: "#1E1F35",
  headerText: "#E8E8ED",
  statItem: "#1A1B2E",
  input: "#2A2C48",
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
