"use client"

// ─────────────────────────────────────────────────────────────
// hooks/usePartnerTracking.ts
// Drop this into any layout that runs after authentication
// (e.g. dashboard layout, onboarding layout).
// On mount it reads the stored partner source, fires the
// /api/partner/track endpoint, and clears local storage.
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef } from "react"
import { useUser } from "@clerk/nextjs"
import { readPartnerSource, clearPartnerTracking } from "@/lib/partnerTracking"

export function usePartnerTracking() {
  const { isSignedIn, isLoaded } = useUser()
  const hasFired = useRef(false)

  useEffect(() => {
    if (!isLoaded || !isSignedIn || hasFired.current) return

    const { source, code } = readPartnerSource()
    if (!source) return

    hasFired.current = true

    // Fire and forget — we clear optimistically even if request fails
    // (better than re-attributing on every login)
    clearPartnerTracking()

    fetch("/api/partner/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source, code }),
    }).catch(() => {
      // Silently fail — attribution is best-effort
    })
  }, [isLoaded, isSignedIn])
}
