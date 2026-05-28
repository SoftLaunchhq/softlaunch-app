import type { Config } from "tailwindcss"

/**
 * SoftLaunch Design System — CSS-variable-powered theming
 *
 * All brand colors are defined as CSS custom properties (--sl-*)
 * in globals.css. Tailwind references them via rgb(var(--sl-*))
 * so Tailwind opacity modifiers like bg-brand-bg/90 work correctly.
 *
 * Dark mode (default) + Light/Cream mode values live in globals.css:
 *   :root      → dark theme values
 *   .light     → cream theme values
 *
 * Logo gradient reference:
 *   Deep teal (#0F535E) → Teal-green (#1A9E82) → Lime green (#72B860) → Amber-orange (#EE9F52)
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          // ── Backgrounds ─────────────────────────────────────
          bg:                  "rgb(var(--sl-bg)            / <alpha-value>)",
          surface:             "rgb(var(--sl-surface)       / <alpha-value>)",
          "surface-elevated":  "rgb(var(--sl-surface-el)   / <alpha-value>)",

          // ── Text ────────────────────────────────────────────
          text:                "rgb(var(--sl-text)          / <alpha-value>)",
          "text-muted":        "rgb(var(--sl-text-muted)   / <alpha-value>)",
          "text-subtle":       "rgb(var(--sl-text-subtle)  / <alpha-value>)",

          // ── Primary — logo teal-green ────────────────────────
          primary:             "rgb(var(--sl-primary)       / <alpha-value>)",
          "primary-hover":     "rgb(var(--sl-primary-h)    / <alpha-value>)",
          "primary-light":     "rgb(var(--sl-primary-l)    / <alpha-value>)",

          // ── Secondary — logo lime green ──────────────────────
          secondary:           "rgb(var(--sl-secondary)     / <alpha-value>)",
          "secondary-dark":    "rgb(var(--sl-secondary-d)  / <alpha-value>)",

          // ── Accent — logo amber-orange ───────────────────────
          accent:              "rgb(var(--sl-accent)        / <alpha-value>)",
          "accent-light":      "rgb(var(--sl-accent-l)     / <alpha-value>)",

          // ── Borders ─────────────────────────────────────────
          border:              "rgb(var(--sl-border)        / <alpha-value>)",
          "border-light":      "rgb(var(--sl-border-l)     / <alpha-value>)",

          // ── Semantic ─────────────────────────────────────────
          error:               "rgb(var(--sl-error)         / <alpha-value>)",
          warning:             "rgb(var(--sl-warning)       / <alpha-value>)",
          success:             "rgb(var(--sl-success)       / <alpha-value>)",
        },
      },

      backgroundImage: {
        // Logo gradient — unchanged across themes
        "brand-gradient":
          "linear-gradient(135deg, #0F535E 0%, #1A9E82 35%, #72B860 68%, #EE9F52 100%)",
        "brand-cta":
          "linear-gradient(135deg, #1DB896 0%, #7CC455 60%, #EE9F52 100%)",
        "brand-glow":
          "radial-gradient(ellipse at 35% 15%, rgba(29,184,150,0.16) 0px, transparent 58%), " +
          "radial-gradient(ellipse at 75% 65%, rgba(124,196,85,0.12) 0px, transparent 58%), " +
          "radial-gradient(ellipse at 10% 85%, rgba(238,159,82,0.10) 0px, transparent 50%)",
        "grid-texture":
          "linear-gradient(rgba(29,184,150,0.04) 1px, transparent 1px), " +
          "linear-gradient(90deg, rgba(29,184,150,0.04) 1px, transparent 1px)",
      },

      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans:    ["var(--font-inter)", "system-ui", "sans-serif"],
      },

      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },

      boxShadow: {
        "brand-glow":    "0 0 28px rgba(29,184,150,0.40), 0 0 60px rgba(29,184,150,0.14)",
        "brand-glow-sm": "0 0 14px rgba(29,184,150,0.28)",
        "amber-glow":    "0 0 24px rgba(238,159,82,0.35)",
        panel:           "0 1px 3px rgba(0,0,0,0.65), 0 4px 16px rgba(0,0,0,0.35)",
        "panel-lg":      "0 2px 8px rgba(0,0,0,0.60), 0 16px 40px rgba(0,0,0,0.36)",
      },

      animation: {
        "fade-in":    "fadeIn 0.4s ease-out forwards",
        "slide-up":   "slideUp 0.4s ease-out forwards",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        float:        "float 6s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%":      { transform: "translateY(-8px)" },
        },
      },

      backgroundSize: {
        grid: "32px 32px",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
