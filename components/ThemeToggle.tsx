"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "./ThemeProvider"

// ─────────────────────────────────────────────────────────────
// ThemeToggle — polished moon/sun pill button for the Navbar.
//
// Uses inline CSS-var styles for its own background/border so
// it's always visually correct regardless of Tailwind compilation
// state (avoids the "invisible button in light mode" issue).
// ─────────────────────────────────────────────────────────────

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === "dark"

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/40"
      style={{
        border: "1px solid rgb(var(--sl-border))",
        backgroundColor: "rgb(var(--sl-surface) / 0.6)",
        color: "rgb(var(--sl-text-muted))",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget
        el.style.borderColor = "rgb(var(--sl-border-l))"
        el.style.backgroundColor = "rgb(var(--sl-surface))"
        el.style.color = "rgb(var(--sl-text))"
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.borderColor = "rgb(var(--sl-border))"
        el.style.backgroundColor = "rgb(var(--sl-surface) / 0.6)"
        el.style.color = "rgb(var(--sl-text-muted))"
      }}
    >
      {isDark ? (
        <>
          <Sun className="h-3 w-3 flex-shrink-0" />
          <span className="hidden sm:inline">Light</span>
        </>
      ) : (
        <>
          <Moon className="h-3 w-3 flex-shrink-0" />
          <span className="hidden sm:inline">Dark</span>
        </>
      )}
    </button>
  )
}
