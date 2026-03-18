export const COLORS = {
  primary: "#101828",
  secondary: "#475467",
  tertiary: "#98A2B3",
  gold: "#EEA71B",
  cta: "#27ae60",
  link: "#444CE7",
  gradientStart: "#0A3A5A",
  gradientEnd: "#012A46",
  bg: "#F9FAFB",
  card: "#FFFFFF",
  border: "#e5e7eb",
  error: "#dc2626",
  white: "#FFFFFF",
} as const;

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
