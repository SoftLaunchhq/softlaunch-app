"use client"

import { createContext, useContext, useEffect, useState, ReactNode } from "react"

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type Theme = "dark" | "light"

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

// ─────────────────────────────────────────────────────────────
// Context
// ─────────────────────────────────────────────────────────────

const ThemeContext = createContext<ThemeContextValue>({
  theme: "dark",
  toggleTheme: () => {},
})

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext)
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = "sl-theme"

function applyTheme(t: Theme) {
  const root = document.documentElement
  if (t === "light") {
    root.classList.add("light")
    root.classList.remove("dark")
  } else {
    root.classList.remove("light")
    root.classList.add("dark")
  }
}

// ─────────────────────────────────────────────────────────────
// Provider
// ─────────────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Default to light — matches server render and no-flash inline script.
  // Stored preference overrides this on hydration via the useEffect below.
  const [theme, setTheme] = useState<Theme>("light")

  useEffect(() => {
    // Read stored preference; fall back to "light" if nothing is stored.
    let stored: Theme = "light"
    try {
      const val = localStorage.getItem(STORAGE_KEY)
      if (val === "light" || val === "dark") stored = val
    } catch {
      // localStorage unavailable (SSR / private browsing)
    }
    setTheme(stored)
    applyTheme(stored)
  }, [])

  function toggleTheme() {
    const next: Theme = theme === "dark" ? "light" : "dark"
    setTheme(next)
    applyTheme(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}
