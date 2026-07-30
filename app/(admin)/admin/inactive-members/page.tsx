/**
 * Admin Inactive Members — /admin/inactive-members
 *
 * Shows cohort members who appear to be inactive based on:
 *   - Last message sent to cohort chat
 *   - Poll participation (voted or not)
 *   - Availability last updated
 *   - Meetup confirmation status
 *
 * Inactivity is defined as: no CohortMessage from the user in the last 48 hours
 * OR the cohort meetup is past TIME_PROPOSED state and the user hasn't voted.
 *
 * Authorization: enforced by the admin layout (ADMIN | FOUNDER only).
 */

import { db } from "@/lib/db"
import { format, formatDistanceToNow } from "date-fns"
import Link from "next/link"
import { AlertTriangle, Clock, MessageCircle, Vote, Calendar, CheckCircle2 } from "lucide-react"

type InactiveMemberRow = {
  userId: string
  cohortId: string
  memberName: string
  memberEmail: string | null
  cohortName: string
  lastMessageAt: Date | null
  daysInactive: number
  hasVotedInPoll: boolean
  availabilityUpdatedAt: Date | null
  meetupState: string | null
  meetupConfirmed: boolean
}

async function getInactiveMembers(): Promise<InactiveMemberRow[]> {
  try {
    const now = new Date()
    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000)

    // Get all active memberships
    const memberships = await db.cohortMembership.findMany({
      where: { status: "ACTIVE" },
      select: {
        userId: true,
        cohortId: true,
        user: {
          select: {
            id: true,
            email: true,
            profile: { select: { firstName: true, lastName: true } },
            cohortPrefs: { select: { updatedAt: true } },
          },
        },
        cohort: {
          select: { id: true, name: true },
        },
      },
    })

    if (memberships.length === 0) return []

    // Get the last message per user per cohort
    const userCohortPairs = memberships.map((m) => ({ userId: m.userId, cohortId: m.cohortId }))

    // Get all messages sent by members in the last 7 days
    const recentMessages = await db.$queryRaw<Array<{
      senderId: string; cohortId: string; maxCreatedAt: Date;
    }>>`
      SELECT "senderId", "cohortId", MAX("createdAt") as "maxCreatedAt"
      FROM "CohortMessage"
      WHERE "senderType" = 'USER'
        AND "createdAt" > NOW() - INTERVAL '7 days'
      GROUP BY "senderId", "cohortId"
    `

    const lastMessageMap: Record<string, Date> = {}
    for (const msg of recentMessages) {
      if (msg.senderId) {
        lastMessageMap[`${msg.senderId}_${msg.cohortId}`] = new Date(msg.maxCreatedAt)
      }
    }

    // Get meetup states and poll vote status per cohort
    const cohortIds = [...new Set(memberships.map((m) => m.cohortId))]

    const meetups = await db.$queryRaw<Array<{
      cohortId: string; state: string; id: string;
    }>>`
      SELECT "cohortId","state","id" FROM "CohortMeetup"
      WHERE "cohortId" = ANY(${cohortIds}::text[])
    `
    const meetupMap: Record<string, { state: string; meetupId: string }> = {}
    for (const m of meetups) {
      meetupMap[m.cohortId] = { state: m.state, meetupId: m.id }
    }

    // Get poll votes per cohort
    const polls = await db.$queryRaw<Array<{ meetupId: string; id: string }>>`
      SELECT "meetupId","id" FROM "MeetupPoll"
      WHERE "meetupId" = ANY(${meetups.map((m) => m.id)}::text[])
    `
    const pollMeetupMap: Record<string, string> = {}
    for (const p of polls) {
      pollMeetupMap[p.meetupId] = p.id
    }

    const votes = polls.length > 0
      ? await db.$queryRaw<Array<{ pollId: string; userId: string }>>`
          SELECT "pollId","userId" FROM "MeetupVote"
          WHERE "pollId" = ANY(${polls.map((p) => p.id)}::text[])
        `
      : []

    const voteSet = new Set(votes.map((v) => `${v.pollId}_${v.userId}`))

    // Build inactive member list
    const inactiveRows: InactiveMemberRow[] = []

    for (const m of memberships) {
      const lastMsgAt = lastMessageMap[`${m.userId}_${m.cohortId}`] ?? null
      const daysInactive = lastMsgAt
        ? Math.floor((now.getTime() - lastMsgAt.getTime()) / 86_400_000)
        : 999

      const meetupInfo = meetupMap[m.cohortId] ?? null
      const pollId = meetupInfo ? pollMeetupMap[meetupInfo.meetupId] : null
      const hasVotedInPoll = pollId ? voteSet.has(`${pollId}_${m.userId}`) : true // no poll = not applicable

      const ACTIVE_MEETUP_STATES = ["TIME_PROPOSED", "TIME_CONFIRMED", "CHECKING_LOCATION", "ASKING_EXISTING_LOCATION", "POLL_ACTIVE"]
      const meetupIsActive = meetupInfo ? ACTIVE_MEETUP_STATES.includes(meetupInfo.state) : false
      const meetupConfirmed = meetupInfo?.state === "MEETUP_CONFIRMED" || meetupInfo?.state === "COMPLETED"

      // Flag as inactive if:
      // - No message in last 48h AND meetup planning is active
      // - OR hasn't voted in an active poll
      const isInactive =
        (daysInactive > 2 && meetupIsActive) ||
        (!hasVotedInPoll && meetupInfo?.state === "POLL_ACTIVE")

      if (!isInactive) continue

      inactiveRows.push({
        userId: m.userId,
        cohortId: m.cohortId,
        memberName: m.user.profile
          ? `${m.user.profile.firstName} ${m.user.profile.lastName}`.trim()
          : m.user.email ?? m.userId,
        memberEmail: m.user.email,
        cohortName: m.cohort.name,
        lastMessageAt: lastMsgAt,
        daysInactive,
        hasVotedInPoll,
        availabilityUpdatedAt: (m.user.cohortPrefs as any)?.updatedAt ?? null,
        meetupState: meetupInfo?.state ?? null,
        meetupConfirmed,
      })
    }

    return inactiveRows.sort((a, b) => b.daysInactive - a.daysInactive)
  } catch (err: any) {
    console.error("[admin/inactive-members]", err?.message?.slice(0, 300))
    return []
  }
}

export default async function AdminInactiveMembersPage() {
  const rows = await getInactiveMembers()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">Inactive Members</h1>
        <p className="mt-1 text-sm text-brand-text-muted">
          Members who haven't sent a message in 48+ hours while their cohort's meetup is in progress,
          or who haven't voted in an active location poll.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          {
            label: "Total inactive",
            value: rows.length,
            icon: AlertTriangle,
            color: "text-amber-300",
          },
          {
            label: "Unvoted polls",
            value: rows.filter((r) => !r.hasVotedInPoll).length,
            icon: Vote,
            color: "text-rose-300",
          },
          {
            label: "Availability missing",
            value: rows.filter((r) => !r.availabilityUpdatedAt).length,
            icon: Calendar,
            color: "text-brand-text-muted",
          },
          {
            label: "> 5 days silent",
            value: rows.filter((r) => r.daysInactive > 5).length,
            icon: Clock,
            color: "text-rose-300",
          },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="neon-panel p-4">
            <Icon className={`mb-2 h-4 w-4 ${color}`} />
            <p className="text-2xl font-bold text-brand-text">{value}</p>
            <p className="mt-0.5 text-xs text-brand-text-muted">{label}</p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="neon-panel p-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-400" />
          <p className="text-brand-text-muted">No inactive members detected. Everyone is engaged!</p>
        </div>
      ) : (
        <div className="neon-panel overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-brand-border/60">
                  {["Member", "Cohort", "Last message", "Poll voted?", "Availability", "Meetup state"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-brand-text-subtle">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/40">
                {rows.map((row) => (
                  <tr key={`${row.userId}_${row.cohortId}`} className="transition-colors hover:bg-brand-surface/30">
                    <td className="px-4 py-3">
                      <p className="font-medium text-brand-text">{row.memberName}</p>
                      {row.memberEmail && (
                        <p className="mt-0.5 text-xs text-brand-text-subtle">{row.memberEmail}</p>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/cohorts/${row.cohortId}`}
                        className="text-brand-text transition-colors hover:text-brand-primary"
                      >
                        {row.cohortName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {row.lastMessageAt ? (
                        <div>
                          <p className="text-brand-text-muted">
                            {formatDistanceToNow(row.lastMessageAt, { addSuffix: true })}
                          </p>
                          <p className="mt-0.5 text-[10px] text-brand-text-subtle">
                            {format(row.lastMessageAt, "MMM d, h:mm a")}
                          </p>
                        </div>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-rose-300">
                          <MessageCircle className="h-3 w-3" />
                          Never
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.hasVotedInPoll ? (
                        <span className="flex items-center gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Voted
                        </span>
                      ) : row.meetupState === "POLL_ACTIVE" ? (
                        <span className="flex items-center gap-1 text-xs text-rose-300">
                          <Vote className="h-3 w-3" />
                          Pending
                        </span>
                      ) : (
                        <span className="text-xs text-brand-text-subtle">N/A</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.availabilityUpdatedAt ? (
                        <p className="text-xs text-brand-text-muted">
                          {format(new Date(row.availabilityUpdatedAt), "MMM d")}
                        </p>
                      ) : (
                        <span className="text-xs text-rose-300">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {row.meetupState ? (
                        <span className="inline-flex items-center rounded-full border border-brand-border/40 bg-brand-surface/60 px-2 py-0.5 text-[10px] font-medium text-brand-text-muted">
                          {row.meetupState.replace(/_/g, " ").toLowerCase()}
                        </span>
                      ) : (
                        <span className="text-xs text-brand-text-subtle">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
