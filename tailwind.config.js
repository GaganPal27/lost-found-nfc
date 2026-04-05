/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#06b6d4",
        secondary: "#0e7490",
        accent: "#22d3ee",
        darkBg: "#0f172a",
        darkCard: "#1e293b",
        darkBorder: "#334155",
        darkText: "#f1f5f9",
        darkMuted: "#94a3b8",
      }
    },
  },
  plugins: [],
}
