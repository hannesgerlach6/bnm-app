/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        bnm: {
          primary: "#101828",
          secondary: "#475467",
          tertiary: "#98A2B3",
          gold: "#EEA71B",
          cta: "#27ae60",
          link: "#444CE7",
          "gradient-start": "#0A3A5A",
          "gradient-end": "#012A46",
          bg: "#F9FAFB",
          card: "#FFFFFF",
          border: "#e5e7eb",
          success: "#27ae60",
          error: "#dc2626",
          active: "#FFFFFF",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
