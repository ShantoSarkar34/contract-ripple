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
        // Page-level tokens (theme aware, defined in app/globals.css).
        background: "rgb(var(--background-rgb) / <alpha-value>)",
        foreground: "rgb(var(--foreground-rgb) / <alpha-value>)",
        surface: "rgb(var(--surface-rgb) / <alpha-value>)",
        "surface-muted": "rgb(var(--surface-muted-rgb) / <alpha-value>)",
        "surface-strong": "rgb(var(--surface-strong-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
        "line-strong": "rgb(var(--line-strong-rgb) / <alpha-value>)",
        muted: "rgb(var(--muted-rgb) / <alpha-value>)",
        subtle: "rgb(var(--subtle-rgb) / <alpha-value>)",

        // Brand.
        primary: "rgb(var(--primary-rgb) / <alpha-value>)",
        "primary-hover": "rgb(var(--primary-hover-rgb) / <alpha-value>)",
        "primary-light": "rgb(var(--primary-soft-rgb) / <alpha-value>)",
        // Foreground for solid brand fills; flips to ink in dark mode.
        "on-primary": "rgb(var(--on-primary-rgb) / <alpha-value>)",
        accent: "rgb(var(--accent-rgb) / <alpha-value>)",

        // Secondary aliases kept for existing components.
        secondary: "rgb(var(--subtle-rgb) / <alpha-value>)",
        "secondary-hover": "rgb(var(--muted-rgb) / <alpha-value>)",
        "secondary-light": "rgb(var(--surface-muted-rgb) / <alpha-value>)",

        // Semantic status. The *-light pairs are dark-mode aware so alerts keep
        // readable contrast when the OS theme is dark.
        success: "rgb(var(--success-rgb) / <alpha-value>)",
        "success-light": "rgb(var(--success-soft-rgb) / <alpha-value>)",
        warning: "rgb(var(--warning-rgb) / <alpha-value>)",
        "warning-light": "rgb(var(--warning-soft-rgb) / <alpha-value>)",
        danger: "rgb(var(--danger-rgb) / <alpha-value>)",
        "danger-light": "rgb(var(--danger-soft-rgb) / <alpha-value>)",

        // Fixed dark application sidebar (does not change with the color scheme).
        "sidebar-ink": "#0b1220",
        "sidebar-surface": "#111a2e",
        "sidebar-line": "#1e293b",
        "sidebar-foreground": "#e2e8f0",
        "sidebar-muted": "#94a3b8",
        "sidebar-active": "#1e293b",
      },
      borderRadius: {
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        raised: "0 10px 30px -12px rgb(15 23 42 / 0.25)",
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "Arial", "Helvetica", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};
