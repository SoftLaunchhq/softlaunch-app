/**
 * __tests__/cohortChat.test.ts
 *
 * Static analysis tests for the Cohort Chat feature.
 * Verifies: API routes, BUZZ facilitation, UI component, security patterns.
 *
 * These tests do NOT start a server or hit a real database.
 * They read source files and verify structural correctness.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"
import * as fs from "node:fs"
import * as path from "node:path"

const ROOT = path.resolve(__dirname, "..")

function exists(relPath: string): boolean {
  return fs.existsSync(path.join(ROOT, relPath))
}

function readFile(relPath: string): string {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), "utf-8")
  } catch {
    return ""
  }
}

// ─────────────────────────────────────────────────────────────
// PRISMA SCHEMA — CohortMessage model
// ─────────────────────────────────────────────────────────────

describe("Prisma schema — CohortMessage", () => {
  const schema = readFile("prisma/schema.prisma")

  it("CohortMessage model exists in schema", () => {
    assert.ok(
      schema.includes("model CohortMessage {"),
      "prisma/schema.prisma must define CohortMessage model"
    )
  })

  it("CohortMessage has cohortId field", () => {
    assert.ok(
      schema.includes("cohortId") && schema.includes("model CohortMessage"),
      "CohortMessage must have cohortId"
    )
  })

  it("CohortMessage has senderType field", () => {
    assert.ok(
      schema.includes("senderType"),
      "CohortMessage must have senderType to distinguish MEMBER vs BUZZ"
    )
  })

  it("CohortMessage senderId is optional (null for BUZZ)", () => {
    // senderId String? — the ? makes it optional
    const modelSection = schema.slice(schema.indexOf("model CohortMessage {"))
    const senderIdLine = modelSection
      .split("\n")
      .find((l) => l.trim().startsWith("senderId"))
    assert.ok(
      senderIdLine && senderIdLine.includes("String?"),
      "CohortMessage.senderId must be optional (String?) since BUZZ has no userId"
    )
  })

  it("CohortMessage has senderName (denormalized display name)", () => {
    assert.ok(
      schema.includes("senderName"),
      "CohortMessage must store senderName as a snapshot"
    )
  })

  it("Cohort model has chatMessages relation", () => {
    const cohortSection = schema.slice(
      schema.indexOf("model Cohort {"),
      schema.indexOf("model CohortMembership {")
    )
    assert.ok(
      cohortSection.includes("chatMessages"),
      "Cohort model must have chatMessages relation to CohortMessage"
    )
  })

  it("User model has chatMessages relation", () => {
    const userSection = schema.slice(
      schema.indexOf("model User {"),
      schema.indexOf("model Profile {")
    )
    assert.ok(
      userSection.includes("chatMessages"),
      "User model must have chatMessages relation (for member messages)"
    )
  })

  it("SQL migration file exists", () => {
    assert.ok(
      exists("prisma/migrations/manual_cohort_chat.sql"),
      "Manual SQL migration file must exist for environments without prisma db push"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// MESSAGES API — GET + POST
// ─────────────────────────────────────────────────────────────

describe("GET /api/cohorts/[id]/messages — security", () => {
  const src = readFile("app/api/cohorts/[id]/messages/route.ts")

  it("messages route file exists", () => {
    assert.ok(
      exists("app/api/cohorts/[id]/messages/route.ts"),
      "Messages API route must exist"
    )
  })

  it("exports GET handler", () => {
    assert.ok(
      src.includes("export async function GET"),
      "Messages route must export GET handler"
    )
  })

  it("exports POST handler", () => {
    assert.ok(
      src.includes("export async function POST"),
      "Messages route must export POST handler"
    )
  })

  it("calls auth() from Clerk", () => {
    assert.ok(
      src.includes("auth()"),
      "Messages route must call auth() to verify user identity"
    )
  })

  it("returns 401 for unauthenticated requests", () => {
    assert.ok(
      src.includes('status: 401') || src.includes("{ status: 401 }"),
      "Messages route must return 401 for unauthenticated users"
    )
  })

  it("returns 403 for non-members", () => {
    assert.ok(
      src.includes('status: 403') || src.includes("{ status: 403 }"),
      "Messages route must return 403 for users who are not active cohort members"
    )
  })

  it("checks ACTIVE membership status (not just any membership)", () => {
    assert.ok(
      src.includes('"ACTIVE"') || src.includes("'ACTIVE'"),
      "Messages route must verify membership status is ACTIVE"
    )
  })

  it("cohortId comes from URL params, not request body", () => {
    // cohortId should come from params.id, never from req.body
    assert.ok(
      src.includes("params.id"),
      "cohortId must come from URL params"
    )
    // The POST body schema should only have content, not cohortId
    assert.ok(
      src.includes("z.object") && src.includes("content"),
      "POST body schema must exist"
    )
    // Extract just the z.object({...}) block from PostSchema definition
    const schemaStart = src.indexOf("PostSchema = z.object({")
    const schemaEnd = src.indexOf("})", schemaStart) + 2
    const schemaBlock = src.slice(schemaStart, schemaEnd)
    assert.ok(
      !schemaBlock.includes("cohortId"),
      "z.object schema definition must NOT include cohortId (prevents cohortId injection via body)"
    )
  })

  it("senderId is always set from authenticated user, never from request body", () => {
    // The API reads userId from authResult, not from req.body
    assert.ok(
      src.includes("authResult") && src.includes("userId"),
      "senderId must be derived from authenticated user, not request body"
    )
    // Verify senderId isn't taken from request body
    const postBodySection = src.slice(src.indexOf("PostSchema"), src.indexOf("db") + 50)
    assert.ok(
      !postBodySection.includes("body.senderId"),
      "senderId must never come from request body"
    )
  })

  it("senderType is hardcoded to MEMBER in POST (users cannot post as BUZZ)", () => {
    assert.ok(
      src.includes('"MEMBER"') && src.includes("senderType"),
      "POST handler must hardcode senderType as MEMBER — users cannot impersonate BUZZ"
    )
  })

  it("admins cannot post to cohort chat (read-only)", () => {
    assert.ok(
      src.includes("Admins cannot post"),
      "Admin users must be blocked from posting to cohort chat"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// BUZZ COHORT API
// ─────────────────────────────────────────────────────────────

describe("POST /api/cohorts/[id]/buzz — BUZZ facilitation", () => {
  const src = readFile("app/api/cohorts/[id]/buzz/route.ts")

  it("buzz route file exists", () => {
    assert.ok(
      exists("app/api/cohorts/[id]/buzz/route.ts"),
      "BUZZ cohort API route must exist"
    )
  })

  it("exports POST handler", () => {
    assert.ok(
      src.includes("export async function POST"),
      "BUZZ route must export POST handler"
    )
  })

  it("calls auth() to verify identity", () => {
    assert.ok(src.includes("auth()"), "BUZZ route must authenticate request")
  })

  it("returns 401 for unauthenticated", () => {
    assert.ok(src.includes("status: 401"), "BUZZ route must return 401 for unauthed requests")
  })

  it("returns 403 for non-members", () => {
    assert.ok(src.includes("status: 403"), "BUZZ route must return 403 for non-members")
  })

  it("has social BUZZ prompts", () => {
    assert.ok(
      src.includes("SOCIAL_BUZZ_PROMPTS"),
      "BUZZ route must have social-specific prompt pool"
    )
  })

  it("has professional BUZZ prompts", () => {
    assert.ok(
      src.includes("PROFESSIONAL_BUZZ_PROMPTS"),
      "BUZZ route must have professional-specific prompt pool"
    )
  })

  it("derives cohortIntent from member data (social vs professional)", () => {
    assert.ok(
      src.includes("cohortIntent"),
      "BUZZ route must derive cohort intent from member cohortIntent fields"
    )
  })

  it("has local fallback when OpenAI is unavailable", () => {
    assert.ok(
      src.includes("getLocalBuzzPrompt") || src.includes("LOCAL"),
      "BUZZ route must have local fallback when OpenAI is unavailable"
    )
  })

  it("rate limits BUZZ posts (prevents spam)", () => {
    assert.ok(
      src.includes("429") || src.includes("Rate limit"),
      "BUZZ route must rate-limit repeated calls"
    )
  })

  it("saves BUZZ message with senderType BUZZ (not MEMBER)", () => {
    const createSection = src.slice(src.indexOf("cohortMessage.create"), src.indexOf("cohortMessage.create") + 400)
    assert.ok(
      createSection.includes('"BUZZ"') || createSection.includes("'BUZZ'"),
      "BUZZ messages must be saved with senderType BUZZ"
    )
  })

  it("senderId is null for BUZZ messages (BUZZ is not a User)", () => {
    const createSection = src.slice(src.indexOf("cohortMessage.create"), src.indexOf("cohortMessage.create") + 400)
    assert.ok(
      createSection.includes("senderId: null"),
      "BUZZ messages must have null senderId since BUZZ is not a DB User"
    )
  })

  it("BUZZ system prompt includes Social vs Professional context", () => {
    assert.ok(
      src.includes("SOCIAL cohort") || src.includes("social cohort"),
      "BUZZ cohort system prompt must reference social intent context"
    )
    assert.ok(
      src.includes("PROFESSIONAL cohort") || src.includes("professional cohort"),
      "BUZZ cohort system prompt must reference professional intent context"
    )
  })

  it("does NOT expose OpenAI key in response", () => {
    assert.ok(
      !src.includes("openai_api_key") && !src.includes("OPENAI_API_KEY: process.env"),
      "BUZZ route must never expose the API key in a response"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// COHORT CHAT COMPONENT
// ─────────────────────────────────────────────────────────────

describe("CohortChat component", () => {
  const src = readFile("components/dashboard/CohortChat.tsx")

  it("CohortChat component file exists", () => {
    assert.ok(
      exists("components/dashboard/CohortChat.tsx"),
      "CohortChat component must exist"
    )
  })

  it("is a client component ('use client')", () => {
    assert.ok(
      src.includes('"use client"') || src.includes("'use client'"),
      "CohortChat must be a client component"
    )
  })

  it("polls for messages (setInterval or polling mechanism)", () => {
    assert.ok(
      src.includes("setInterval") || src.includes("polling"),
      "CohortChat must poll for new messages"
    )
  })

  it("has empty state with BUZZ prompt option", () => {
    assert.ok(
      src.includes("EmptyState") || src.includes("Start the conversation"),
      "CohortChat must show an empty state when no messages exist"
    )
  })

  it("renders BUZZ messages differently from member messages", () => {
    assert.ok(
      src.includes("BuzzMessage") || (src.includes("BUZZ") && src.includes("MemberMessage")),
      "CohortChat must render BUZZ and member messages differently"
    )
  })

  it("shows weekly prompt banner when activePrompt is provided", () => {
    assert.ok(
      src.includes("activePrompt") && src.includes("promptText"),
      "CohortChat must display active weekly prompt as a banner"
    )
  })

  it("has an Ask BUZZ button in the UI", () => {
    assert.ok(
      src.includes("Ask BUZZ") || src.includes("handleBuzzPrompt"),
      "CohortChat must have a button to trigger BUZZ"
    )
  })

  it("uses optimistic updates for sent messages", () => {
    assert.ok(
      src.includes("optimistic"),
      "CohortChat must use optimistic updates for better UX"
    )
  })

  it("does not expose any secret or API key", () => {
    assert.ok(
      !src.includes("OPENAI_API_KEY") && !src.includes("process.env"),
      "CohortChat client component must not reference server-only env vars"
    )
  })

  it("message content has max length (prevents oversized messages)", () => {
    // The POST schema in the API route has max(2000) — verify API enforces it
    const apiSrc = readFile("app/api/cohorts/[id]/messages/route.ts")
    assert.ok(
      apiSrc.includes(".max(2000)") || apiSrc.includes("max(2000)"),
      "Message API must enforce max content length"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// COHORT VIEW INTEGRATION
// ─────────────────────────────────────────────────────────────

describe("CohortView — Chat tab integration", () => {
  const src = readFile("components/dashboard/CohortView.tsx")

  it("CohortView imports CohortChat", () => {
    assert.ok(
      src.includes("CohortChat"),
      "CohortView must import and use CohortChat component"
    )
  })

  it("CohortView has a chat tab", () => {
    assert.ok(
      src.includes('"chat"') || src.includes("'chat'"),
      "CohortView must include a chat tab"
    )
  })

  it("CohortView overview tab has a chat CTA", () => {
    assert.ok(
      src.includes("Open Group Chat") || src.includes("setActiveTab") && src.includes('"chat"'),
      "CohortView overview tab must have a CTA to open chat"
    )
  })

  it("CohortView does NOT add a 3rd cohort type", () => {
    // cohortIntent should only be social or professional
    const forbidden = ['"networking"', '"dating"', '"romantic"', '"creative"', '"health"', '"fitness"']
    for (const type of forbidden) {
      assert.ok(
        !src.includes(type),
        `CohortView must not introduce a new cohort type: ${type}`
      )
    }
  })
})

// ─────────────────────────────────────────────────────────────
// ADMIN VISIBILITY
// ─────────────────────────────────────────────────────────────

describe("Admin cohort detail — chat visibility", () => {
  const src = readFile("app/(admin)/admin/cohorts/[id]/page.tsx")

  it("admin cohort detail page imports MessageCircle or Zap for chat section", () => {
    assert.ok(
      src.includes("MessageCircle") || src.includes("Zap"),
      "Admin cohort detail must include chat section icons"
    )
  })

  it("admin page fetches chatMessages", () => {
    assert.ok(
      src.includes("chatMessages") || src.includes("cohortMessage"),
      "Admin cohort detail must fetch and display chat messages"
    )
  })

  it("admin chat view is read-only (no composer)", () => {
    assert.ok(
      src.includes("Read-only") || src.includes("read-only") || src.includes("admin view"),
      "Admin chat view must be read-only"
    )
  })

  it("admin page handles missing CohortMessage table gracefully", () => {
    // The try/catch around the chatMessages fetch means DB errors won't crash the admin page
    const sectionIdx = src.indexOf("chatMessages")
    const surroundingCode = src.slice(Math.max(0, sectionIdx - 50), sectionIdx + 300)
    assert.ok(
      surroundingCode.includes("try") || surroundingCode.includes("catch"),
      "Admin chat fetch must handle errors gracefully (table may not exist yet)"
    )
  })
})

// ─────────────────────────────────────────────────────────────
// SECURITY: No data leakage
// ─────────────────────────────────────────────────────────────

describe("Security: no sensitive data exposure in chat", () => {
  const messagesSrc = readFile("app/api/cohorts/[id]/messages/route.ts")
  const buzzSrc = readFile("app/api/cohorts/[id]/buzz/route.ts")

  it("messages API does not return driveProfile or psychProfile scores", () => {
    const selectSection = messagesSrc.slice(
      messagesSrc.indexOf("select:"),
      messagesSrc.indexOf("select:") + 400
    )
    assert.ok(
      !selectSection.includes("driveProfile") && !selectSection.includes("psychProfile"),
      "Messages API must not expose personality profile data"
    )
  })

  it("messages API does not return behavioralSignals", () => {
    assert.ok(
      !messagesSrc.includes("behavioralSignal"),
      "Messages API must not expose behavioral signals"
    )
  })

  it("messages API does not return compatibilityScore", () => {
    assert.ok(
      !messagesSrc.includes("compatibilityScore"),
      "Messages API must not expose matching compatibility scores to chat participants"
    )
  })

  it("BUZZ API does not expose member assessment answers in BUZZ message content", () => {
    // BUZZ uses intent context, not raw assessment answers
    assert.ok(
      !buzzSrc.includes("assessmentAnswers") && !buzzSrc.includes("answerKey"),
      "BUZZ chat API must not expose raw assessment data"
    )
  })
})
