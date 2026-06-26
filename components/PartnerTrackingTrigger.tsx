"use client"

// ─────────────────────────────────────────────────────────────
// components/PartnerTrackingTrigger.tsx
// Invisible client component that fires the partner tracking hook.
// Drop into any server layout that wraps authenticated pages.
// ─────────────────────────────────────────────────────────────

import { usePartnerTracking } from "@/hooks/usePartnerTracking"

export function PartnerTrackingTrigger() {
  usePartnerTracking()
  return null
}
