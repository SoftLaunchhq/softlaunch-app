"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Check, X, Loader2, ChevronDown, Link2, Play } from "lucide-react"
import type { Cohort } from "@prisma/client"

interface Props {
  cohort: Cohort
}

export function CohortAdminActions({ cohort }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [linksOpen, setLinksOpen] = useState(false)
  const [links, setLinks] = useState({
    whatsappGroupLink: cohort.whatsappGroupLink || "",
    notionDocLink: cohort.notionDocLink || "",
    calendlyLink: cohort.calendlyLink || "",
  })

  const updateCohort = async (updates: Record<string, any>, action: string) => {
    setLoading(action)
    try {
      const res = await fetch(`/api/cohorts/${cohort.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (!res.ok) throw new Error("Update failed")
      router.refresh()
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status badge */}
      <span className={`text-xs px-2.5 py-1 rounded-full font-medium border ${
        cohort.status === "ACTIVE" ? "bg-emerald-500/10 text-brand-success border-emerald-500/20" :
        cohort.status === "PENDING_APPROVAL" ? "bg-amber-500/10 text-brand-warning border-amber-500/20" :
        cohort.status === "APPROVED" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
        "bg-brand-border text-brand-text-muted border-transparent"
      }`}>
        {cohort.status}
      </span>

      {/* Approve button */}
      {(cohort.status === "PENDING_APPROVAL" || cohort.status === "FORMING") && (
        <button
          onClick={() => updateCohort({ status: "APPROVED" }, "approve")}
          disabled={loading === "approve"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-success/10 border border-brand-success/20 text-brand-success text-xs font-medium hover:bg-brand-success/20 transition-all disabled:opacity-60"
        >
          {loading === "approve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Approve
        </button>
      )}

      {/* Activate (start Week 1) */}
      {cohort.status === "APPROVED" && (
        <button
          onClick={() => updateCohort({ status: "ACTIVE", currentWeek: 1 }, "activate")}
          disabled={loading === "activate"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-medium hover:bg-brand-primary/20 transition-all disabled:opacity-60"
        >
          {loading === "activate" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Start Week 1
        </button>
      )}

      {/* Advance week */}
      {cohort.status === "ACTIVE" && cohort.currentWeek < 4 && (
        <button
          onClick={() => updateCohort({ currentWeek: cohort.currentWeek + 1 }, "advance")}
          disabled={loading === "advance"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-brand-text-muted text-xs font-medium hover:border-brand-primary/30 hover:text-brand-primary transition-all disabled:opacity-60"
        >
          {loading === "advance" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          → Week {cohort.currentWeek + 1}
        </button>
      )}

      {/* Add links */}
      <div className="relative">
        <button
          onClick={() => setLinksOpen(!linksOpen)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-surface border border-brand-border text-brand-text-muted text-xs font-medium hover:border-brand-border-light transition-all"
        >
          <Link2 className="w-3.5 h-3.5" />
          Links
          <ChevronDown className={`w-3 h-3 transition-transform ${linksOpen ? "rotate-180" : ""}`} />
        </button>

        {linksOpen && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-brand-surface border border-brand-border rounded-xl p-4 shadow-xl z-20 space-y-3">
            {[
              { key: "whatsappGroupLink", label: "WhatsApp Group Link" },
              { key: "notionDocLink", label: "Notion Doc Link" },
              { key: "calendlyLink", label: "Calendly Link" },
            ].map((field) => (
              <div key={field.key}>
                <label className="text-xs text-brand-text-subtle mb-1 block">{field.label}</label>
                <input
                  value={links[field.key as keyof typeof links]}
                  onChange={(e) => setLinks({ ...links, [field.key]: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-3 py-2 text-xs rounded-lg bg-brand-bg border border-brand-border text-brand-text focus:border-brand-primary focus:outline-none transition-colors"
                />
              </div>
            ))}
            <button
              onClick={() => {
                updateCohort(links, "links")
                setLinksOpen(false)
              }}
              disabled={loading === "links"}
              className="w-full py-2 rounded-lg bg-brand-primary text-white text-xs font-medium hover:bg-brand-primary-hover transition-all disabled:opacity-60"
            >
              {loading === "links" ? "Saving..." : "Save links"}
            </button>
          </div>
        )}
      </div>

      {/* Dissolve */}
      {cohort.status !== "DISSOLVED" && cohort.status !== "COMPLETED" && (
        <button
          onClick={() => {
            if (confirm("Are you sure you want to dissolve this cohort?")) {
              updateCohort({ status: "DISSOLVED" }, "dissolve")
            }
          }}
          disabled={loading === "dissolve"}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-brand-error/30 text-brand-error text-xs font-medium hover:bg-brand-error/10 transition-all disabled:opacity-60"
        >
          {loading === "dissolve" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
          Dissolve
        </button>
      )}
    </div>
  )
}
