/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "media",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        // Primary brand
        primary: "#2563eb",
        "primary-hover": "#1d4ed8",
        "primary-light": "#eff6ff",
        // Secondary
        secondary: "#64748b",
        "secondary-hover": "#475569",
        "secondary-light": "#f1f5f9",
        // Slate neutrals
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          600: "#475569",
          700: "#334155",
          900: "#0f172a",
        },
        // Semantic
        success: "#16a34a",
        "success-light": "#dcfce7",
        warning: "#ca8a04",
        "warning-light": "#fef3c7",
        danger: "#dc2626",
        "danger-light": "#fee2e2",
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "Helvetica", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
}
