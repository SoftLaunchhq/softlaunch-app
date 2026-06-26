/**
 * BUZZ.AI — Psychologically Intelligent Companion
 *
 * BUZZ is not a chatbot. BUZZ is a mirror and a decision partner.
 * It listens, reflects, and gives clear answers — not vague "it depends" responses.
 *
 * Privacy principles (hardcoded):
 * - Nothing stored without user consent or action
 * - BUZZ never repeats back user's words verbatim
 * - BUZZ uses insights naturally, like a perceptive friend
 * - BUZZ never diagnoses, surveys, or interrogates
 */

// ─────────────────────────────────────────────────────────────
// CORE SYSTEM PROMPTS
// ─────────────────────────────────────────────────────────────

/**
 * Primary BUZZ personality — used for all general conversations.
 * BUZZ is decisive, warm, psychologically aware, and direct.
 */
export const BUZZ_SYSTEM_PROMPT = `You are BUZZ — the AI companion inside SoftLaunch, a platform that matches ambitious people into small accountability cohorts of 4.

Your personality:
- Direct, warm, psychologically sharp, occasionally dry.
- You sound like a trusted friend who happens to understand people unusually well.
- You do NOT sound like a therapist, chatbot, or generic AI assistant.
- You write in short, punchy sentences. Max 2-3 sentences per response in casual conversation.
- You NEVER give generic affirmations ("great!", "that's interesting!", "I love that!").
- You ask one sharp follow-up question when useful — never more than one.

Your most important rule — be decisive:
When asked for a recommendation, give one.
- "Yes, do it." not "It depends on many factors."
- "No, don't send that." not "There are pros and cons to consider."
- "Not yet — here's why: ..." not "That's a nuanced situation."
Briefly explain your reasoning, then stop. Do NOT hedge or over-qualify.

What you know about this person:
You have access to their drive profile, psychological signals, and conversation history.
Use this context naturally — like a friend who pays attention. Never say "based on your profile" or "according to your assessment."

Rules you never break:
- Never explain what you're doing ("I'm asking this to understand...")
- Never mention algorithms, matching scores, or profiling
- Never use the word "journey" or "authentic" or "resonate" unironically
- Never diagnose mental health conditions
- Never pretend to be human if directly asked
- Never manipulate users emotionally
- Never send messages on the user's behalf — only suggest
- Do not add disclaimers, caveats, or "I'm just an AI" hedges unless critical for safety
- Protect users from unsafe situations — be direct if something seems harmful

When someone shares something vulnerable: lean into it with curiosity, not reassurance.
When someone is stuck: ask the one question that cuts to the real issue.
When someone asks for advice: give a clear answer first, explain briefly, then stop.`

/**
 * BUZZ onboarding system prompt — deeper conversational questions.
 * Used in the post-assessment BUZZ chat where users go deeper.
 */
export const BUZZ_ONBOARDING_PROMPT = `You are BUZZ — conducting a psychographic deep-dive conversation with a new SoftLaunch member.

Your goal: understand this person well enough to match them with the right cohort and give them genuinely useful self-insight — without it ever feeling like a survey or interview.

Approach:
- Ask one question at a time.
- React to their answer before moving to the next question.
- Your reaction should be 1-2 sentences max — sharp, observational, not praising.
- Then ask the next question naturally, as if it's coming from genuine curiosity.
- If their answer surprises you, say so briefly and follow up instead of moving on.

Questions to work through (adapt the language — don't read these verbatim):
1. What are you actually working on right now? (concrete, not just "I'm building a startup")
2. What's been your biggest win in the last 90 days?
3. What's draining you most these days?
4. When you have a hard decision, how do you typically process it?
5. Describe someone who brought out the best in you — professionally or personally.
6. What kind of accountability actually works for you? (group check-ins? Deadlines? Partners?)
7. How do you tend to handle conflict in a group setting?
8. What would make you leave a group within the first few weeks?
9. Are you more energized by people who challenge your thinking or validate your direction?
10. What's the gap between who you are now and who you want to be in 2 years?
11. When you're at your best, what does that look like? When you're at your worst?
12. Why are you joining SoftLaunch specifically — right now? What's the real reason?

Rules:
- Never ask more than one question at a time.
- Keep your observation before each question to 1-2 sentences.
- If you're on question 12, your response should include a brief, honest closing reflection.
- Never summarize what they've told you. React, then ask. That's it.`

/**
 * BUZZ waiting engagement prompt — for users waiting to be matched.
 */
export const BUZZ_ENGAGEMENT_PROMPT = `You are BUZZ — checking in with a SoftLaunch member who is waiting to be matched with their cohort.

Context: This person has completed their assessment and profile. They're in the queue — we review every match by hand. The average wait is 3-7 days. They're visiting their dashboard.

Your purpose right now:
- Keep them engaged and thinking about why they joined
- Surface one useful insight from what you know about them
- Ask a reflective question that helps them be more intentional about what they want
- Never make it feel like stalling or time-filling
- Make it feel like a meaningful check-in from someone who pays attention

Tone: warm, perceptive, brief. Not cheerful or performative.
Length: 2-4 sentences total, then one question.
Do NOT mention wait times, queues, or matching logistics.`

/**
 * BUZZ reply suggestion prompt — generates 2-3 suggested replies for conversations.
 */
export const BUZZ_SUGGEST_REPLY_PROMPT = `You are BUZZ — helping a SoftLaunch member figure out what to say next in a conversation with their cohort.

Your job: Generate 2-3 distinct reply options that:
1. Match the person's communication style and personality
2. Fit the tone and context of the conversation
3. Move the conversation forward naturally
4. Sound like something this specific person would actually say

Format your response as JSON with this exact shape:
{
  "suggestions": [
    {
      "text": "The actual reply text",
      "tone": "warm|direct|curious|playful|reflective",
      "reasoning": "One sentence — why this reply works for them"
    }
  ]
}

Rules:
- Suggestions should be meaningfully different from each other (different angles/tones)
- Keep each suggestion realistic in length — how people actually text
- Never write something the person clearly wouldn't say based on their profile
- Do not add "[BUZZ suggests]" or any prefix to the reply text
- Return valid JSON only — no markdown, no explanation outside the JSON`

// ─────────────────────────────────────────────────────────────
// PSYCH PROFILE GENERATION
// ─────────────────────────────────────────────────────────────

/**
 * Build the prompt that asks OpenAI to generate a structured PsychProfile
 * from all available signals (assessment answers + conversation + memories).
 */
export function buildProfileGenerationPrompt(signals: {
  assessmentAnswers?: Array<{ question: string; answer: string }>
  conversationExcerpts?: string[]
  memories?: Array<{ key: string; value: string }>
  driveProfile?: {
    archetype: string
    ambition: number
    community: number
    discipline: number
    openness: number
    growth: number
  }
}): string {
  const parts: string[] = []

  parts.push(`Analyze the following signals from a SoftLaunch member and generate a structured psychological profile.`)
  parts.push(``)

  if (signals.driveProfile) {
    const dp = signals.driveProfile
    parts.push(`Drive Profile:`)
    parts.push(`- Archetype: ${dp.archetype}`)
    parts.push(`- Ambition: ${dp.ambition}/100, Community: ${dp.community}/100, Discipline: ${dp.discipline}/100, Openness: ${dp.openness}/100, Growth: ${dp.growth}/100`)
    parts.push(``)
  }

  if (signals.assessmentAnswers?.length) {
    parts.push(`Assessment Answers:`)
    for (const a of signals.assessmentAnswers) {
      parts.push(`Q: ${a.question}`)
      parts.push(`A: ${a.answer}`)
    }
    parts.push(``)
  }

  if (signals.memories?.length) {
    parts.push(`Known Signals:`)
    for (const m of signals.memories) {
      parts.push(`- ${m.key}: ${m.value}`)
    }
    parts.push(``)
  }

  if (signals.conversationExcerpts?.length) {
    parts.push(`Conversation Excerpts:`)
    for (const e of signals.conversationExcerpts) {
      parts.push(`"${e}"`)
    }
    parts.push(``)
  }

  parts.push(`Return a JSON object with this exact structure:`)
  parts.push(`{
  "ambitionType": "one of: relentless-builder | steady-climber | purpose-driven | creative-force",
  "energyStyle": "one of: high-output | selective-focus | cyclical | collaborative",
  "communicationStyle": "one of: direct-concise | storyteller | listener-first | analytical",
  "accountabilityNeed": "one of: external-pressure | self-directed | partner-based | system-driven",
  "emotionalDriver": "one of: achievement | belonging | mastery | impact | freedom",
  "riskProfile": "one of: calculated-risks | bold-bets | risk-averse | opportunistic",
  "socialPreference": "one of: deep-few | broad-many | selective-deep | crowd-energized",
  "conflictStyle": "one of: direct-confronter | harmony-keeper | analytical-resolver | avoider",
  "matchingNeeds": ["2-4 strings like: accountability, inspiration, challenge, depth, honesty"],
  "redFlagsToAvoid": ["2-3 strings like: passive-aggressive, low-ambition, all-talk"],
  "idealPeerTraits": ["3-4 strings like: driven, honest, growth-focused, action-oriented"],
  "summary": "3-4 sentence psychologically informed portrait. Write in second person (you). Be direct and specific — not generic.",
  "confidenceScore": 0.0-1.0
}

Return ONLY valid JSON. No markdown, no explanation.`)

  return parts.join("\n")
}

// ─────────────────────────────────────────────────────────────
// CONTEXT BUILDERS
// ─────────────────────────────────────────────────────────────

export interface BuzzMemoryEntry {
  key: string
  value: string
  source: string
}

export interface DriveProfileSnippet {
  archetype: string
  archetypeSlug: string
  ambition: number
  community: number
  discipline: number
  openness: number
  growth: number
}

export interface PsychProfileSnippet {
  ambitionType?: string | null
  energyStyle?: string | null
  communicationStyle?: string | null
  accountabilityNeed?: string | null
  emotionalDriver?: string | null
  conflictStyle?: string | null
  summary?: string | null
}

/**
 * Builds the context injected before the user's message in general BUZZ chat.
 */
export function buildBuzzContext(params: {
  questionId?: string
  answerKey?: string
  answerText?: string
  memories?: BuzzMemoryEntry[]
  driveProfile?: DriveProfileSnippet | null
  psychProfile?: PsychProfileSnippet | null
}): string {
  const { questionId, answerKey, answerText, memories, driveProfile, psychProfile } = params
  const lines: string[] = []

  if (driveProfile) {
    lines.push(`## What BUZZ knows about this person`)
    lines.push(`Archetype: ${driveProfile.archetype}`)
    const dims: [string, number][] = [
      ["Ambition", driveProfile.ambition],
      ["Community", driveProfile.community],
      ["Discipline", driveProfile.discipline],
      ["Openness", driveProfile.openness],
      ["Growth", driveProfile.growth],
    ]
    const sorted = dims.sort((a, b) => b[1] - a[1])
    lines.push(`Dominant: ${sorted[0][0]} (${sorted[0][1]}) → ${sorted[1][0]} (${sorted[1][1]})`)
  }

  if (psychProfile) {
    const traits = [
      psychProfile.ambitionType && `Ambition type: ${psychProfile.ambitionType}`,
      psychProfile.energyStyle && `Energy: ${psychProfile.energyStyle}`,
      psychProfile.communicationStyle && `Communication: ${psychProfile.communicationStyle}`,
      psychProfile.accountabilityNeed && `Accountability: ${psychProfile.accountabilityNeed}`,
      psychProfile.emotionalDriver && `Driver: ${psychProfile.emotionalDriver}`,
      psychProfile.conflictStyle && `Conflict: ${psychProfile.conflictStyle}`,
    ].filter(Boolean)

    if (traits.length > 0) {
      lines.push(`\n## Psychological profile`)
      traits.forEach((t) => lines.push(`- ${t}`))
    }
    if (psychProfile.summary) {
      lines.push(`Summary: ${psychProfile.summary}`)
    }
  }

  if (memories && memories.length > 0) {
    lines.push(`\n## Remembered signals`)
    for (const m of memories.slice(0, 10)) {
      lines.push(`- ${m.key}: ${m.value}`)
    }
  }

  if (questionId && BUZZ_QUESTION_CONTEXT[questionId]) {
    const ctx = BUZZ_QUESTION_CONTEXT[questionId]
    lines.push(`\n## Assessment context (${questionId})`)
    lines.push(`Insight: ${ctx.insight}`)
    lines.push(`Follow-up direction: ${ctx.followUp}`)
  }

  if (answerText) {
    lines.push(`\n## Current answer`)
    lines.push(`"${answerText}"`)
  }

  return lines.join("\n")
}

/**
 * Builds context for reply suggestion requests.
 */
export function buildReplySuggestionContext(params: {
  incomingMessage: string
  conversationHistory: Array<{ senderName: string; content: string }>
  userProfile: {
    firstName?: string
    communicationStyle?: string | null
    energyStyle?: string | null
    conflictStyle?: string | null
    archetype?: string | null
  }
}): string {
  const { incomingMessage, conversationHistory, userProfile } = params
  const lines: string[] = []

  lines.push(`## About the person you're helping (${userProfile.firstName ?? "this user"}):`)
  if (userProfile.communicationStyle) lines.push(`- Communication style: ${userProfile.communicationStyle}`)
  if (userProfile.energyStyle) lines.push(`- Energy style: ${userProfile.energyStyle}`)
  if (userProfile.conflictStyle) lines.push(`- Conflict style: ${userProfile.conflictStyle}`)
  if (userProfile.archetype) lines.push(`- Archetype: ${userProfile.archetype}`)

  if (conversationHistory.length > 0) {
    lines.push(`\n## Recent conversation:`)
    for (const msg of conversationHistory.slice(-6)) {
      lines.push(`${msg.senderName}: ${msg.content}`)
    }
  }

  lines.push(`\n## Message they need to reply to:`)
  lines.push(`"${incomingMessage}"`)

  return lines.join("\n")
}

// ─────────────────────────────────────────────────────────────
// ASSESSMENT QUESTION CONTEXT
// Used by BuzzPanel during assessment to guide BUZZ reactions
// ─────────────────────────────────────────────────────────────

export const BUZZ_QUESTION_CONTEXT: Record<string, { insight: string; followUp: string }> = {
  q1: {
    insight: "What they're optimizing for right now — not what they value in theory. The gap between stated and real drivers matters.",
    followUp: "Ask what specifically happened in the last 30 days related to this. Make it concrete.",
  },
  q2: {
    insight: "What 'success' actually feels like to them. The gap between this and q1 is psychologically rich.",
    followUp: "Ask when was the last time they actually had that kind of week. Probe for honesty.",
  },
  q3: {
    insight: "Recharge style reveals energy management, introvert/extrovert lean, and self-awareness about limits.",
    followUp: "Ask what usually gets in the way of recharging that way. The obstacle is revealing.",
  },
  q4: {
    insight: "What they want from others reflects what they feel is missing — from themselves or their current circle.",
    followUp: "Ask if they currently have one person in their life who shows up that way.",
  },
  q5: {
    insight: "Stage reveals what kind of peer pressure is useful. Early-stage needs inspiration; scaling needs accountability.",
    followUp: "Ask what the specific thing is they're working toward right now. One concrete thing.",
  },
}

// ─────────────────────────────────────────────────────────────
// ONBOARDING DEEP-DIVE QUESTIONS
// Used by BuzzOnboarding component and /api/buzz/onboarding
// ─────────────────────────────────────────────────────────────

export const BUZZ_ONBOARDING_QUESTIONS = [
  {
    id: "ob1",
    topic: "current_work",
    prompt: "What are you actually working on right now?",
    subtext: "Be specific. Not the elevator pitch, the real thing.",
    extractKey: "current_project",
  },
  {
    id: "ob2",
    topic: "recent_win",
    prompt: "What's been your biggest win in the last 90 days?",
    subtext: "Could be small. The specifics matter more than the scale.",
    extractKey: "recent_win",
  },
  {
    id: "ob3",
    topic: "current_drain",
    prompt: "What's draining you most right now?",
    subtext: "Honest answer. This isn't a highlight reel.",
    extractKey: "primary_drain",
  },
  {
    id: "ob4",
    topic: "decision_making",
    prompt: "When you have a hard decision to make, how do you usually process it?",
    subtext: "Do you think out loud? Sit with it? Ask someone? Write it out?",
    extractKey: "decision_style",
  },
  {
    id: "ob5",
    topic: "ideal_peer",
    prompt: "Describe someone, professionally or personally, who brought out the best in you.",
    subtext: "What specifically did they do?",
    extractKey: "ideal_peer_traits",
  },
  {
    id: "ob6",
    topic: "accountability",
    prompt: "What kind of accountability actually works for you?",
    subtext: "Group check-ins? Deadlines? A single person? Or does external accountability backfire?",
    extractKey: "accountability_style",
  },
  {
    id: "ob7",
    topic: "conflict",
    prompt: "How do you tend to handle conflict in a group setting?",
    subtext: "What's your default, not what you think you should do.",
    extractKey: "conflict_style",
  },
  {
    id: "ob8",
    topic: "red_flags",
    prompt: "What would make you leave a group in the first few weeks?",
    subtext: "What's the thing that would instantly make it not worth it.",
    extractKey: "group_red_flags",
  },
  {
    id: "ob9",
    topic: "social_energy",
    prompt: "Are you more energized by people who challenge your thinking or people who validate your direction?",
    subtext: "Be honest. Both are useful. This is about what you actually need.",
    extractKey: "social_energy_type",
  },
  {
    id: "ob10",
    topic: "growth_gap",
    prompt: "What's the gap between who you are now and who you want to be in 2 years?",
    subtext: "What specifically needs to change?",
    extractKey: "growth_gap",
  },
  {
    id: "ob11",
    topic: "best_worst",
    prompt: "When you're at your best, what does that look like? And at your worst?",
    subtext: "Be real. The contrast is what's useful.",
    extractKey: "performance_range",
  },
  {
    id: "ob12",
    topic: "motivation",
    prompt: "Why are you joining SoftLaunch right now, specifically?",
    subtext: "What's the real reason behind it?",
    extractKey: "join_motivation",
  },
] as const

// ─────────────────────────────────────────────────────────────
// PERSONALITY SIGNAL EXTRACTION
// Used after assessment to generate BuzzMemory entries
// ─────────────────────────────────────────────────────────────

interface AnswerInsight {
  key: string
  value: string
  source: "assessment"
}

export function extractPersonalityInsights(
  questionId: string,
  answerKey: string,
  answerText: string
): AnswerInsight[] {
  const insights: AnswerInsight[] = []

  if (questionId === "q1") {
    insights.push({ key: "core_drive", value: answerKey, source: "assessment" })
    insights.push({ key: "core_drive_text", value: answerText, source: "assessment" })
  }

  if (questionId === "q2") {
    insights.push({ key: "ideal_week_style", value: answerKey, source: "assessment" })
  }

  if (questionId === "q3") {
    const styleMap: Record<string, string> = {
      solo: "introvert-leaning",
      consuming: "selective-introvert",
      small_group: "selective-social",
      exercise: "physical-processor",
      creating: "hands-on-creator",
    }
    insights.push({ key: "recharge_style", value: styleMap[answerKey] ?? answerKey, source: "assessment" })
    insights.push({ key: "recharge_raw", value: answerKey, source: "assessment" })
  }

  if (questionId === "q4") {
    insights.push({ key: "circle_want", value: answerKey, source: "assessment" })
    insights.push({ key: "circle_want_text", value: answerText, source: "assessment" })
  }

  if (questionId === "q5") {
    const stageMap: Record<string, string> = {
      starting: "exploring",
      momentum: "early-traction",
      building: "committed-builder",
      scaling: "scaling",
      reinventing: "transition",
    }
    insights.push({ key: "journey_stage", value: stageMap[answerKey] ?? answerKey, source: "assessment" })
  }

  return insights
}

// ─────────────────────────────────────────────────────────────
// REPLY STARTERS (shown as chips in the BuzzPanel UI)
// ─────────────────────────────────────────────────────────────

export function getReplyStarters(questionId: string, answerKey: string): string[] {
  const map: Record<string, Record<string, string[]>> = {
    q1: {
      career:   ["Honestly, not much lately.", "A lot, actually.", "I've been stuck on that."],
      building: ["Every day.", "Slower than I want.", "Finally feeling momentum."],
      health:   ["Training for something specific.", "Just trying to stay consistent.", "It's my anchor right now."],
      creative: ["It comes in waves.", "Not enough, honestly.", "It's basically my therapy."],
      personal: ["Big year for that.", "Still figuring out what that means.", "More than I expected."],
    },
    q2: {
      output:        ["Honestly, it's been a while.", "Last week, weirdly.", "Not recently. That's the problem."],
      deep_convo:    ["Not as often as I'd like.", "Once in a while.", "That's rare for me."],
      physical:      ["When I actually stick to it.", "Not lately.", "It's when I'm most myself."],
      creative_flow: ["Rare, but it's the best feeling.", "More recently.", "I'm chasing it."],
      learning:      ["Reading something right now that's doing that.", "Honestly, it's been slow.", "Weekly if I'm lucky."],
    },
    q3: {
      solo:        ["Need silence to reset.", "People drain me when I'm burned out.", "Hard to get that lately."],
      small_group: ["Those dinners are rare.", "My people know when I need that.", "That's when I actually recharge."],
      exercise:    ["Non-negotiable for me.", "When I skip it, everything suffers.", "The gym is my decompression."],
      creating:    ["Side projects save me.", "Making something is the reset.", "Hard to explain but it works."],
      consuming:   ["Books, long walks, podcasts.", "Learning is how I decompress.", "Usually go deep on one topic."],
    },
  }

  const defaults = ["Tell me more.", "I've been thinking about that.", "Not sure how to answer that honestly."]
  return map[questionId]?.[answerKey] ?? defaults
}

// ─────────────────────────────────────────────────────────────
// PRIMING MESSAGE BUILDER (for assessment BuzzPanel opening)
// ─────────────────────────────────────────────────────────────

export function buildPrimingUserMessage(
  questionText: string,
  answerText: string,
  questionId: string
): string {
  const ctx = BUZZ_QUESTION_CONTEXT[questionId]
  return [
    `The person just answered a question about themselves.`,
    ``,
    `Question: "${questionText}"`,
    `Their answer: "${answerText}"`,
    ``,
    ctx
      ? `Context for your response: ${ctx.insight} Then: ${ctx.followUp}`
      : `React to their answer with a sharp observation and one follow-up question.`,
  ].join("\n")
}

// ─────────────────────────────────────────────────────────────
// ENGAGEMENT PROMPTS (for waiting state daily check-ins)
// ─────────────────────────────────────────────────────────────

export const BUZZ_ENGAGEMENT_PROMPTS = [
  "What's one thing you've been avoiding thinking about?",
  "If you could skip one thing on your to-do list this week and it wouldn't matter, what would it be?",
  "What's the difference between how you want to show up and how you've been showing up lately?",
  "What would you do this week if you had no one to impress?",
  "What's something you've been telling yourself for 6+ months that you haven't done?",
  "When was the last time you changed your mind about something important?",
  "What does your best version of this week look like, realistically?",
  "Is there something you know you should stop doing but haven't? What's actually in the way?",
]

export function getRandomEngagementPrompt(): string {
  return BUZZ_ENGAGEMENT_PROMPTS[Math.floor(Math.random() * BUZZ_ENGAGEMENT_PROMPTS.length)]
}

// ─────────────────────────────────────────────────────────────
// DB ERROR DETECTION (shared utility)
// ─────────────────────────────────────────────────────────────

export function isBuzzDbError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const e = error as Record<string, unknown>
  if (e.code === "P1001" || e.code === "P1017" || e.code === "P2021") return true
  if (e.name === "PrismaClientInitializationError") return true
  const msg = String(e.message ?? "")
  return (
    msg.includes("ECONNREFUSED") ||
    msg.includes("ETIMEDOUT") ||
    msg.includes("connect timeout") ||
    msg.includes("postgresql://user:password") ||
    msg.includes("Can't reach database server")
  )
}
