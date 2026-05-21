/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./app/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#6366f1", // Modern Vibrant Indigo
        secondary: "#8b5cf6", // Modern Vibrant Purple
        accent: "#ec4899", // Pink
        darkBg: "#f8f9ff", // Very light airy background
        darkCard: "#ffffff",
        darkBorder: "#f1f5f9",
        darkText: "#0f172a",
        darkMuted: "#64748b",
      }
    },
  },
  plugins: [],
}
