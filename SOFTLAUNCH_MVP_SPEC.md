# SoftLaunch — Complete MVP Specification
### Version 1.0 · April 2026 · CTO Blueprint

---

## 1. EXECUTIVE PRODUCT SUMMARY

SoftLaunch is an intentional friendship platform for ambitious people.
The core insight: **ambitious people pay an Ambition Tax** — they outgrow their circles, relocate for opportunity, and end up isolated despite being driven. SoftLaunch solves this through structured 4-week cohorts of 4 compatible people, matched by psychographic drive rather than job titles or photos.

**Business mechanics:**
- Week 1 is free (low-friction first dinner, test the chemistry)
- Weeks 2–4 are paid ($30–50/month, A/B tested)
- Cohorts repeat or remix — users can continue with their group or enter a new one
- Charlotte-only MVP → expands nationally with a Passport feature later

**What makes this fundable and defensible:**
- 22.5% landing page CVR with zero ad spend
- Zero competition on psychographic drive-matching for friendships
- Passport feature creates a real network effect moat (future V2)
- First-mover on "friendship infrastructure for the ambitious"

**MVP success criteria:**
- 20–30 beta users in Charlotte
- 3–5 cohorts formed and running
- Week 2 payment conversion ≥ 60%
- Week 4 completion rate ≥ 70%
- Qualitative NPS ≥ 8/10 from cohort participants

---

## 2. RECOMMENDED TECH STACK

### Why this stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | **Next.js 14 (App Router)** | Full-stack, SSR/SSG, API routes, fastest to ship premium web apps |
| Language | **TypeScript** | Type safety, prevents runtime bugs, scales to team |
| Styling | **Tailwind CSS + shadcn/ui** | Fastest premium UI, fully customizable, industry-standard |
| Animation | **Framer Motion** | Production-quality scroll animations, gestures, layout transitions |
| ORM | **Prisma** | Type-safe DB queries, clean migrations, works perfectly with Supabase |
| Database | **Supabase (PostgreSQL)** | Free tier for MVP, real-time, auth built in, scales to millions |
| Auth | **Clerk** | Fastest auth setup, beautiful pre-built UI, user management dashboard, webhooks |
| Payments | **Stripe** | Industry standard, Billing Portal, webhooks, subscription management |
| Email | **Resend + React Email** | Beautiful transactional emails, developer-first, 3000 free/month |
| Hosting | **Vercel** | Zero-config Next.js deployment, preview URLs, analytics |
| Forms | **React Hook Form + Zod** | Performant validation, type-safe schemas |
| State | **Zustand** | Lightweight client state (onboarding flow, assessment) |
| Date handling | **date-fns** | Lightweight, tree-shakable |

### Stack justification for MVP speed
- Clerk handles auth in < 1 hour of setup
- shadcn/ui gives 40+ polished components out of the box
- Supabase gives DB + real-time + storage for free
- Prisma gives type-safe DB queries without writing raw SQL
- Vercel gives instant deploys with preview URLs per PR
- This stack has the highest "premium feel per hour of development" ratio

---

## 3. SYSTEM ARCHITECTURE

### 3.1 Frontend Architecture

```
app/
├── (marketing)/          # Public pages — landing, about, pricing
├── (auth)/               # Clerk-managed auth pages
├── (onboarding)/         # 4-step onboarding funnel (unauthed → profile complete)
├── (dashboard)/          # Authenticated user area
│   ├── dashboard/        # Main hub — cohort status, prompts, members
│   ├── cohort/[id]/      # Individual cohort detail page
│   ├── profile/          # Edit profile, drive profile view
│   └── billing/          # Stripe billing portal embedded
└── (admin)/              # Admin-only area (role-gated)
    ├── admin/            # Overview stats
    ├── admin/users/      # All users, assessment views
    ├── admin/cohorts/    # Cohort management, approval
    └── admin/matching/   # Run matching engine, review suggestions
```

**Route groups** use Next.js App Router layout nesting:
- Marketing layout: minimal nav, full-bleed sections
- Auth layout: centered card UI
- Onboarding layout: step indicator, progress bar, no main nav
- Dashboard layout: sidebar nav, user avatar, notifications
- Admin layout: full-width table UI, admin badge

### 3.2 Backend Architecture

All backend logic lives in:
1. **Next.js API routes** (`app/api/`) — RESTful endpoints
2. **Server Actions** (inline in Server Components where appropriate)
3. **Stripe Webhooks** (`app/api/webhooks/stripe/`) — subscription events
4. **Clerk Webhooks** (`app/api/webhooks/clerk/`) — user created/deleted events

**API surface:**
```
POST   /api/assessment           → Submit assessment answers
GET    /api/assessment/[userId]  → Get assessment + drive profile
POST   /api/cohorts              → Admin: create cohort
GET    /api/cohorts              → List cohorts (admin) or user's cohorts
PATCH  /api/cohorts/[id]         → Admin: update cohort status
POST   /api/matching/suggest     → Admin: run matching algorithm
POST   /api/feedback             → Submit weekly feedback
POST   /api/attendance           → Confirm attendance
GET    /api/admin/stats          → Admin dashboard statistics
POST   /api/webhooks/stripe      → Stripe billing events
POST   /api/webhooks/clerk       → User lifecycle events
```

### 3.3 Authentication Strategy

**Clerk** handles all auth:
- Email + password (primary for MVP)
- Social login (Google) as secondary option
- Middleware protects all `/dashboard`, `/admin` routes
- Clerk `userId` is stored on the User model via `clerkId`
- On first sign-in, `user.created` webhook fires → creates User + blank Profile in DB
- Admin role set manually in Clerk dashboard (or via DB `role` field)

**Auth middleware (`middleware.ts`):**
```typescript
// Protects routes:
// /dashboard/* → must be signed in
// /admin/*     → must be signed in + role = ADMIN or FOUNDER
// /onboarding/* → must be signed in
// All else: public
```

### 3.4 Cohort Lifecycle

```
WAITLIST
   ↓ (user signs up + completes assessment)
POOL (user is in matching pool)
   ↓ (matching algorithm runs, founder reviews)
PENDING_APPROVAL (cohort suggested, awaiting approval)
   ↓ (founder approves)
APPROVED → ACTIVE (Week 1 starts, WhatsApp group created manually)
   ↓ (end of Week 1)
WEEK 2 PAYWALL (user prompted to subscribe)
   ↓ (user pays)
ACTIVE Weeks 2–4
   ↓ (end of Week 4)
COMPLETED → user can re-enter matching pool or continue with existing group
```

### 3.5 Data Flow: Matching → Cohort → Payment

```
1. User completes assessment → DriveProfile generated
2. User enters matching pool
3. Admin triggers matching run → algorithm scores all pairwise combinations
4. Algorithm outputs ranked cohort suggestions
5. Admin reviews, edits if needed, approves
6. System creates Cohort + CohortMemberships
7. Admin creates WhatsApp group, adds members
8. Week 1 begins — FREE access for all members
9. End of Week 1 → system emails users about Week 2 upgrade
10. User clicks "Continue" → Stripe Checkout opens
11. Successful payment → subscription created, Week 2 access unlocked
12. Week 2-4 active — weekly prompts sent automatically
13. Week 4 ends → re-matching prompt or continue option
```

---

## 4. DATABASE SCHEMA

### Full Prisma Schema

See `prisma/schema.prisma` for the complete schema.

**Key design decisions:**

1. **User ↔ Profile separation**: `User` holds auth + role data. `Profile` holds displayable info. Keeps auth clean.

2. **Assessment versioning**: `version` field on Assessment lets you evolve questions without breaking historical data.

3. **DriveProfile**: Computed layer between raw assessment answers and the displayed archetype. This is where behavior signals get folded in over time.

4. **CohortMembership**: Join table with rich metadata — status, week access level, compatibility score per member. This enables per-member access control for Stripe gating.

5. **Future-proof location**: `currentCity` and `futureCity` on User model now. Adding `city` to Cohort. When Passport launches, add `CityNetwork` model and `LocationIntent` — no schema rewrite needed.

6. **Behavior data**: Feedback + Attendance models create the training data for a future ML matching model. Store now, use later.

7. **AdminAction audit log**: Every admin action is logged with `actionType`, `notes`, `metadata`. Essential for debugging and accountability.

### Enums

```
UserRole:         USER | ADMIN | FOUNDER
CohortStatus:     FORMING | PENDING_APPROVAL | APPROVED | ACTIVE | COMPLETED | DISSOLVED
CohortTheme:      CAREER_GROWTH | FOUNDERS_BUILDERS | FITNESS_DISCIPLINE | ACCOUNTABILITY | CREATIVE_AMBITION | GENERAL
MembershipStatus: PENDING | ACTIVE | PAUSED | CHURNED
PaymentStatus:    FREE | ACTIVE | PAST_DUE | CANCELED | INCOMPLETE
WeekStatus:       UPCOMING | ACTIVE | COMPLETED
FeedbackType:     POST_SESSION | POST_WEEK | EXIT
```

---

## 5. USER JOURNEYS

### Journey 1: New User → Cohort Assigned

```
Landing Page
  → CTA: "Find Your Frequency" or "Apply Now"
  → Sign Up (Clerk) → email verification

Onboarding Step 1: Welcome
  → "You're joining something different."
  → Brief product explanation, tone setting
  → CTA: "Start Your Assessment"

Onboarding Step 2: 5-Question Assessment
  → Q1: What drives you most right now?
     [Career growth, Building something, Health/discipline, Creative work, Personal growth]
  → Q2: What does a great week look like?
     [Lots of output, Deep conversations, Physical challenge, Creative flow, Helping others]
  → Q3: How do you recharge?
     [Solo time, Small group, Exercise, Making/building, Reading/learning]
  → Q4: What do you want more of in your circle?
     [Accountability, Ambition, Creativity, Depth, Honesty]
  → Q5: Where are you in your journey?
     [Starting out, Early momentum, Building seriously, Scaling, Reinventing]
  → Each answer shown as rich option cards, 4–5 per question
  → Progress bar fills across questions
  → Smooth slide transitions between questions

Onboarding Step 3: Drive Profile Reveal
  → Animated reveal: "You are The Builder"
  → 5-dimension radar/bar chart
  → 2-sentence archetype summary
  → CTA: "Complete your profile"

Onboarding Step 4: Profile + Preferences
  → Photo upload
  → First name, last name, headline (e.g., "Founder & Builder")
  → Short bio (140 chars max, optional)
  → Cohort theme preference (multi-select)
  → Availability (days/times, loose)
  → LinkedIn URL (optional)
  → CTA: "I'm ready"

Onboarding Complete: Pending State
  → "You're in the queue."
  → Warm, reassuring copy: "We match by hand. Every cohort is reviewed by a founder."
  → Expected wait: "You'll hear from us within 7 days."
  → Option to share on social (organic growth)
```

### Journey 2: Cohort Assigned → Week 1 Experience

```
Email: "Your cohort is ready."
  → Links to dashboard

Dashboard: Cohort view
  → 4 member cards with photos, names, archetypes
  → Week 1 prompt: "Your first dinner is this week."
  → WhatsApp link (manually created by admin)
  → Calendly link for scheduling
  → No paywall yet — Week 1 is fully free

End of Week 1:
  → Feedback prompt appears in dashboard
  → "How was your first session?"
  → 5-field lightweight form
  → After submission: Week 2 upgrade CTA appears
```

### Journey 3: Week 2 Paywall

```
Dashboard shows: "Week 1 complete. Keep going?"
  → CTA: "Unlock Weeks 2–4 — $XX/month"
  → Stripe Checkout modal / redirect
  → Success → subscription created, week 2 unlocked
  → Failure → retry prompt, friendly error state
  → If user declines → "We'll check in with you in a few days" (email drip)
```

### Journey 4: Weeks 2–4

```
Each week:
  → Weekly prompt delivered to dashboard + email
  → Group meets (WhatsApp/Calendly handles logistics)
  → User submits post-session feedback
  → Progress bar advances

Week 4 Complete:
  → Completion celebration screen
  → "You did it. What's next?"
  → Option A: "Join a new cohort" → re-enters matching pool
  → Option B: "Keep meeting with this group" → cohort marked as "continued"
  → Option C: "Take a break" → subscription pauses, re-engagement email in 30 days
```

### Journey 5: Re-Matching

```
If user joins new cohort:
  → Behavior data from previous cohort folded into drive profile
  → User can update preferences
  → Matching engine gets richer signal
  → New cohort typically better match quality
```

---

## 6. MATCHING ENGINE DESIGN

### 6.1 Input Data

For each user in the matching pool, the engine has:
- `DriveProfile`: 5 dimension scores (ambition, community, discipline, openness, growth)
- `CohortPreferences`: preferred themes, availability
- `Behavior signals` (for returning users): attendance rate, feedback scores, completion history

### 6.2 Compatibility Scoring (Pairwise)

```typescript
function pairwiseScore(userA: DriveProfile, userB: DriveProfile): number {
  // Ambition: similar is better (ambitious people want equals)
  const ambitionSimilarity = 1 - Math.abs(userA.ambition - userB.ambition) / 100;

  // Community: slightly complementary — a super introvert + super extrovert is bad,
  // but a mix of connector + builder is good
  const communitySimilarity = 1 - Math.abs(userA.community - userB.community) / 150;

  // Discipline: similar is better (accountability requires equal drive)
  const disciplineSimilarity = 1 - Math.abs(userA.discipline - userB.discipline) / 100;

  // Openness: complementary (diverse perspectives = richer conversations)
  const opennessSimilarity = 0.5 + 0.5 * (1 - Math.abs(userA.openness - userB.openness) / 100);

  // Growth mindset: similar is better (growth-oriented people bond over this)
  const growthSimilarity = 1 - Math.abs(userA.growth - userB.growth) / 100;

  // Weighted total
  const score =
    ambitionSimilarity * 0.30 +    // Most important
    disciplineSimilarity * 0.25 +  // Second most important
    communitySimilarity * 0.20 +
    growthSimilarity * 0.15 +
    opennessSimilarity * 0.10;

  return score; // 0–1
}
```

### 6.3 Theme Alignment Score

```typescript
function themeAlignmentScore(users: User[]): number {
  // Count shared themes
  const allThemes = users.flatMap(u => u.cohortPrefs.preferredThemes);
  const themeCounts = allThemes.reduce((acc, theme) => {
    acc[theme] = (acc[theme] || 0) + 1;
    return acc;
  }, {});

  // Reward groups where 3+ users share a theme
  const sharedThemes = Object.values(themeCounts).filter(count => count >= 3).length;
  return Math.min(sharedThemes * 0.2, 0.4); // bonus up to 0.4
}
```

### 6.4 Cohort Compatibility Score (Group of 4)

```typescript
function cohortCompatibilityScore(users: User[]): number {
  // All pairwise combinations: C(4,2) = 6 pairs
  const pairs = getPairs(users); // returns all 6 pairs

  const avgPairwiseScore = pairs.reduce((sum, [a, b]) =>
    sum + pairwiseScore(a.driveProfile, b.driveProfile), 0) / pairs.length;

  const themeBonus = themeAlignmentScore(users);

  // Behavior amplifier (for returning users with track record)
  const avgBehaviorScore = users.reduce((sum, u) =>
    sum + (u.driveProfile.behaviorAmplifier || 1.0), 0) / users.length;

  // Ambition ceiling check — if ambition variance > 30 pts, penalize
  const ambitionValues = users.map(u => u.driveProfile.ambition);
  const ambitionVariance = Math.max(...ambitionValues) - Math.min(...ambitionValues);
  const ambitionPenalty = ambitionVariance > 30 ? 0.1 : 0;

  return (avgPairwiseScore + themeBonus) * avgBehaviorScore - ambitionPenalty;
}
```

### 6.5 Optimal Grouping Algorithm

```
Input: N users in matching pool (N = 4 to ~20 for MVP)
Output: List of optimal cohorts of 4

Algorithm:
1. Filter users by city (Charlotte only for MVP)
2. For small N (≤ 8): try all possible combinations, score each
3. For larger N: use greedy + swap optimization
   - Greedy: pick best pair, add best 3rd, add best 4th
   - Swap: try swapping members between groups to improve avg score
4. Sort output by cohort compatibility score (descending)
5. Return top suggestions + scores for admin review
```

### 6.6 Behavior Signal Integration (V1.5 → V2)

Store these signals now, integrate into scoring later:
- **Attendance rate**: % of sessions attended per cohort
- **Response rate**: % of weekly prompts responded to
- **Feedback sentiment**: average rating given + received
- **Cohort completion**: did user complete all 4 weeks?
- **Re-enrollment**: did user join another cohort? (strongest signal)
- **Vibe nominations**: who did they select as "vibed with most" in feedback

Future: weight these into `behaviorAmplifier` on DriveProfile.

### 6.7 Admin Approval Workflow

```
1. Admin navigates to /admin/matching
2. Clicks "Run Matching" → algorithm runs server-side
3. Dashboard shows ranked cohort suggestions:
   - Cohort score (0–100)
   - Member cards with archetype + drive scores
   - Shared themes highlighted
   - Compatibility warnings (if any pair scores < 0.5)
4. Admin can:
   a. Approve as-is → status: APPROVED
   b. Edit: swap one member, remove a member, add a member
   c. Reject: send back to pool
5. On approval:
   - Cohort created in DB
   - CohortMemberships created for all 4 members
   - Email sent to all members: "Your cohort is ready"
   - Admin dashboard task: "Create WhatsApp group for [Cohort Name]"
```

---

## 7. ADMIN DASHBOARD DESIGN

### 7.1 Admin Overview (`/admin`)

**Stats cards:**
- Total users (+ delta this week)
- Users in matching pool
- Active cohorts
- Pending approvals
- Week 2 conversion rate
- Total MRR (from Stripe)

**Action queue (priority tasks):**
- Cohorts pending approval
- Users waiting > 7 days
- Cohorts in Week 4 (needing re-engagement)
- Failed payments (users who need attention)
- Feedback submitted (available for review)

### 7.2 User Management (`/admin/users`)

**Table columns:**
- Name + photo
- Email
- Assessment status (completed / not started)
- Drive archetype
- Cohort status (in pool / in cohort / completed)
- Payment status
- Joined date
- Actions: View assessment, View profile, Add to cohort, Send email

**User detail modal/page:**
- Full assessment answers
- Drive profile visualization
- Cohort history
- Payment history
- Feedback given/received
- Admin notes field

### 7.3 Cohort Management (`/admin/cohorts`)

**Table columns:**
- Cohort name
- Status badge (colored)
- Theme
- Current week
- Members (avatars)
- Match score
- Payment status per member
- Actions: View, Edit, Approve, Send prompt, Dissolve

**Cohort detail page (`/admin/cohorts/[id]`):**
- Members: each card shows drive profile, payment status, attendance
- Weekly prompt sender: select week, customize prompt text, send
- WhatsApp link field (paste group link)
- Notion doc link field
- Timeline: Week 1 → 4 progress
- Feedback summary: aggregate ratings, vibe nominations
- Admin notes
- Actions: Approve, Dissolve, Send re-matching prompt

### 7.4 Matching Engine (`/admin/matching`)

- Pool overview: N users waiting, average wait time
- "Run Matching" button
- Suggested cohorts ranked by score
- Per-suggestion: member cards, score breakdown, theme alignment
- Drag-and-drop member swapping
- Approve button per suggestion
- Manual cohort builder: select any 4 users manually

### 7.5 Prompts Management

Default weekly prompts (customizable per cohort):
- **Week 1**: "Share one thing you're building right now and why it matters to you."
- **Week 2**: "What's a habit you've been struggling to stick with? How can this group help?"
- **Week 3**: "What does success look like for you in the next 90 days?"
- **Week 4**: "What's one thing you learned about yourself this month?"

Admin can override prompts per cohort. Prompts sent via email + appear in dashboard.

---

## 8. UX/UI STRATEGY

### 8.1 Design Language

**Mood:** Premium consumer social × Members club × Startup minimalism

**Visual system:**
- **Typography**: `Inter` for UI, `Fraunces` or `Playfair Display` for editorial headers
- **Color palette**:
  - Background: `#0A0A0F` (near-black, slightly warm)
  - Surface: `#111118` (card backgrounds)
  - Border: `#1E1E2E`
  - Primary: `#8B5CF6` (violet — ambition, depth)
  - Accent: `#EC4899` (pink-magenta — energy, warmth)
  - Muted: `#6B7280`
  - Text: `#F8FAFC` (almost white)
  - Text muted: `#94A3B8`
- **Corner radius**: 12px for cards, 8px for inputs, 6px for badges
- **Spacing system**: 8px base unit (8, 16, 24, 32, 48, 64, 96, 128)
- **Shadows**: subtle glow on hover (`box-shadow: 0 0 30px rgba(139, 92, 246, 0.15)`)

### 8.2 Landing Page Architecture

**Sections (in order):**
1. **Hero** — Full viewport. "Find Your Frequency." Animated headline. Subtext about The Ambition Tax. Single CTA.
2. **The Problem** — "You've worked hard to get here. Now you're surrounded by people who don't get it." Emotional copy, minimal design.
3. **How It Works** — 4-step visual flow (animated). Assessment → Match → Cohort → Friendship.
4. **Why Different** — Comparison table: SoftLaunch vs. Meetup vs. networking apps vs. dating apps. Shows the gap.
5. **Cohort Themes** — Cards for each theme. Shows personality of each bucket.
6. **Social Proof** — First 3 cohort testimonials (beta users), or placeholder authentic quotes.
7. **Final CTA** — "Apply for your cohort." Email capture. Waitlist.

### 8.3 Onboarding UX

**Principles:**
- Every screen feels earned, not rushed
- Assessment feels like self-discovery, not a quiz
- Drive Profile reveal is a moment — treat it as a milestone
- Progress is always visible
- Never ask for information that isn't needed immediately

**Assessment question cards:**
- Large, full-width option cards with icons
- Hover state: subtle glow + scale
- Selected state: filled violet border, checkmark icon
- Question text is large, editorial, personal
- "No right answers" subtext to reduce anxiety

**Drive Profile reveal:**
- Dark screen → animated ring/pulse builds up
- Archetype name appears with fade + scale
- "You are The Builder" — bold, affirming
- Radar chart animates in segment by segment
- 2-line summary below
- Confetti or subtle particle effect

### 8.4 Dashboard UX

**Empty states (pre-cohort):**
- Animated illustration or abstract shape
- Warm copy: "You're in the queue. We match by hand."
- Estimated timeline
- Share CTA (organic growth)

**Cohort view:**
- 4 member cards in a 2×2 grid
- Each card: photo, name, archetype badge, drive score ring
- Week progress: horizontal timeline 1–4 with current week highlighted
- Prompt card: week's question, read + respond inline
- Tools section: WhatsApp button, Calendly button, Notion button

**Feedback form:**
- Slides in as a bottom sheet or modal
- 5 fields max
- Star rating, toggle for attendance, short text
- Completion animation

### 8.5 Information Architecture

```
Public:
  / → Landing
  /about → Brief about page (optional V2)
  /sign-in → Auth
  /sign-up → Auth

Authenticated (user):
  /onboarding → Multi-step flow (assessment → profile → preferences)
  /dashboard → Main hub
  /dashboard/cohort/[id] → Cohort detail
  /dashboard/profile → Edit profile, view drive profile
  /dashboard/billing → Subscription management

Authenticated (admin):
  /admin → Stats overview
  /admin/users → User table + detail modals
  /admin/cohorts → Cohort table + management
  /admin/cohorts/[id] → Cohort detail + controls
  /admin/matching → Run engine, approve suggestions
```

---

## 9. MOTION AND SCROLL DESIGN STRATEGY

### 9.1 Scroll Behavior

**Hero section:**
- Parallax: background elements move at 0.3x scroll speed
- Text "Find Your Frequency" uses a staggered word-by-word entrance on load
- Scroll indicator fades in after 1.5s

**Problem section:**
- Text lines fade-up one by one as user scrolls into view
- Thin horizontal rule animates from left to right

**How It Works section:**
- Each step card appears with a staggered delay (0.1s per card)
- Step number counter animates (opacity + translateY)
- Connecting line draws from top to bottom as user scrolls

**Cohort Themes section:**
- Cards fan in from the bottom with spring physics
- Hover: card lifts with y: -4px, glow intensifies

### 9.2 Animation Principles

**Rules:**
- Duration: 0.3s (micro-interactions) to 0.8s (reveals)
- Easing: `easeOut` for entrances, `easeIn` for exits
- Never animate more than 3 things simultaneously
- Scroll animations only fire once (not on scroll-up)
- Respect `prefers-reduced-motion`

**Specific interactions:**
- Button hover: subtle scale(1.02) + brightness(1.1) — 0.15s
- Card hover: translateY(-4px) + shadow intensify — 0.2s
- CTA button: gradient shimmer on hover (pseudo-element)
- Assessment option select: spring bounce into checked state
- Drive profile radar chart: each axis draws sequentially, 0.6s total
- Cohort member cards: stagger in with 0.1s delay each
- Week progress: bar fills left-to-right with spring easing
- Page transitions: subtle fade + translateY(8px) between routes

### 9.3 Framer Motion Implementation Notes

```typescript
// Standard reveal animation (reusable)
const fadeUpVariant = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
}

// Stagger children
const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } }
}

// Use with useInView for scroll triggers
const { ref, inView } = useInView({ once: true, threshold: 0.2 })
```

---

## 10. FULL SITEMAP

```
/ ──────────────────── Landing page
/sign-up ───────────── Clerk sign up
/sign-in ───────────── Clerk sign in
/onboarding ────────── Redirect to current step
/onboarding/welcome ── Step 1: Welcome screen
/onboarding/assessment Step 2: 5-question assessment
/onboarding/reveal ─── Step 3: Drive profile reveal
/onboarding/profile ── Step 4: Profile + preferences

/dashboard ──────────── User hub (cohort status + prompts)
/dashboard/cohort/[id] ─ Cohort detail
/dashboard/profile ───── View/edit profile + drive profile
/dashboard/billing ────── Stripe billing portal

/admin ──────────────────── Admin overview stats
/admin/users ────────────── All users table
/admin/users/[id] ────────── User detail
/admin/cohorts ──────────── All cohorts table
/admin/cohorts/[id] ─────── Cohort detail + management
/admin/matching ─────────── Run matching, approve cohorts
```

---

## 11. FULL COMPONENT MAP

### Landing Components
- `Hero` — headline, subtext, CTA, animated background
- `ProblemSection` — "The Ambition Tax" editorial section
- `HowItWorks` — 4-step flow with icons + connectors
- `WhyDifferent` — comparison table vs alternatives
- `CohortThemes` — theme cards with icons
- `Testimonials` — quote cards (social proof)
- `WaitlistCTA` — final section with email capture
- `Nav` — floating nav bar with scroll-based opacity change

### Onboarding Components
- `OnboardingLayout` — step progress bar, back button
- `WelcomeScreen` — product intro, tone-setter
- `AssessmentFlow` — stateful question manager
- `QuestionCard` — single question + options
- `OptionCard` — individual selectable option with icon
- `DriveProfileReveal` — archetype reveal animation
- `DriveRadarChart` — 5-axis visualization
- `ProfileForm` — photo upload, bio, headline
- `PreferencesForm` — theme select, availability
- `PendingState` — "You're in the queue" screen

### Dashboard Components
- `DashboardLayout` — sidebar, top bar, notifications
- `Sidebar` — navigation links, user avatar
- `CohortCard` — member cards + week progress
- `MemberCard` — photo, name, archetype badge
- `WeekProgress` — timeline 1-4 with current week
- `PromptCard` — weekly prompt + response input
- `ToolsSection` — WhatsApp, Calendly, Notion buttons
- `FeedbackModal` — post-session feedback form
- `UpgradePrompt` — Week 2 paywall card
- `PendingState` — pre-cohort waiting state
- `EmptyState` — generic empty state component

### Admin Components
- `AdminLayout` — full-width, admin nav
- `StatsGrid` — overview KPI cards
- `ActionQueue` — priority tasks list
- `UserTable` — sortable/filterable user table
- `UserDetailModal` — full user info overlay
- `CohortTable` — cohort management table
- `CohortDetailPage` — full cohort management UI
- `MatchingSuggestions` — algorithm output cards
- `MemberCompatibilityCard` — pairwise score visualization
- `PromptSender` — week selector + custom text + send button
- `WeeklyTimeline` — cohort week progress visualization
- `FeedbackSummary` — aggregate feedback display
- `AttendanceTracker` — per-week attendance grid

### Shared UI Components
- `Button` (primary, secondary, ghost, destructive)
- `Card` (default, elevated, interactive)
- `Badge` (status badge with color coding)
- `Avatar` (with fallback initials)
- `Input`, `Textarea`, `Select`, `Checkbox`
- `Modal` / `Dialog`
- `Toast` notifications
- `Skeleton` loading states
- `ProgressBar`
- `StarRating`
- `DriveBar` — single dimension score bar

---

## 12. FOLDER STRUCTURE

```
softlaunch/
├── .env.example
├── .env.local              (gitignored)
├── .gitignore
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── next.config.ts
├── middleware.ts
│
├── prisma/
│   ├── schema.prisma       ← Full schema
│   └── seed.ts             ← Dev seed data
│
├── app/
│   ├── layout.tsx          ← Root layout (ClerkProvider, fonts)
│   ├── page.tsx            ← Landing page
│   ├── globals.css         ← Tailwind + CSS variables
│   │
│   ├── (auth)/
│   │   ├── sign-in/[[...sign-in]]/page.tsx
│   │   └── sign-up/[[...sign-up]]/page.tsx
│   │
│   ├── (onboarding)/
│   │   ├── layout.tsx
│   │   ├── welcome/page.tsx
│   │   ├── assessment/page.tsx
│   │   ├── reveal/page.tsx
│   │   └── profile/page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── cohort/[id]/page.tsx
│   │   ├── profile/page.tsx
│   │   └── billing/page.tsx
│   │
│   ├── (admin)/
│   │   ├── layout.tsx
│   │   ├── admin/page.tsx
│   │   ├── admin/users/page.tsx
│   │   ├── admin/users/[id]/page.tsx
│   │   ├── admin/cohorts/page.tsx
│   │   ├── admin/cohorts/[id]/page.tsx
│   │   └── admin/matching/page.tsx
│   │
│   └── api/
│       ├── assessment/
│       │   └── route.ts
│       ├── cohorts/
│       │   ├── route.ts
│       │   └── [id]/route.ts
│       ├── feedback/
│       │   └── route.ts
│       ├── attendance/
│       │   └── route.ts
│       ├── matching/
│       │   └── suggest/route.ts
│       ├── admin/
│       │   └── stats/route.ts
│       └── webhooks/
│           ├── stripe/route.ts
│           └── clerk/route.ts
│
├── lib/
│   ├── db.ts               ← Prisma client singleton
│   ├── matching.ts         ← Matching engine
│   ├── stripe.ts           ← Stripe helpers
│   ├── email.ts            ← Resend email helpers
│   ├── auth.ts             ← Clerk helpers
│   └── utils.ts            ← cn() and misc utils
│
├── components/
│   ├── landing/
│   │   ├── Hero.tsx
│   │   ├── ProblemSection.tsx
│   │   ├── HowItWorks.tsx
│   │   ├── WhyDifferent.tsx
│   │   ├── CohortThemes.tsx
│   │   ├── Testimonials.tsx
│   │   ├── WaitlistCTA.tsx
│   │   └── Nav.tsx
│   │
│   ├── onboarding/
│   │   ├── AssessmentFlow.tsx
│   │   ├── QuestionCard.tsx
│   │   ├── OptionCard.tsx
│   │   ├── DriveProfileReveal.tsx
│   │   ├── DriveRadarChart.tsx
│   │   └── PreferencesForm.tsx
│   │
│   ├── dashboard/
│   │   ├── CohortView.tsx
│   │   ├── MemberCard.tsx
│   │   ├── WeekProgress.tsx
│   │   ├── PromptCard.tsx
│   │   ├── FeedbackModal.tsx
│   │   ├── UpgradePrompt.tsx
│   │   └── PendingCohortState.tsx
│   │
│   ├── admin/
│   │   ├── StatsGrid.tsx
│   │   ├── ActionQueue.tsx
│   │   ├── UserTable.tsx
│   │   ├── CohortTable.tsx
│   │   ├── MatchingSuggestions.tsx
│   │   └── PromptSender.tsx
│   │
│   └── ui/
│       ├── button.tsx
│       ├── card.tsx
│       ├── badge.tsx
│       ├── avatar.tsx
│       ├── input.tsx
│       ├── modal.tsx
│       ├── toast.tsx
│       ├── skeleton.tsx
│       ├── progress.tsx
│       └── drive-bar.tsx
│
├── hooks/
│   ├── useAssessment.ts    ← Assessment state management
│   ├── useCohort.ts        ← Cohort data fetching
│   └── useSubscription.ts  ← Billing state
│
├── types/
│   └── index.ts            ← Global TypeScript types
│
└── styles/
    └── fonts.ts            ← Font configuration
```

---

## 13. BILLING LOGIC

### Stripe Products Setup

```
Product: SoftLaunch Cohort Subscription
Price 1: $30/month (Price ID: price_30_monthly)
Price 2: $50/month (Price ID: price_50_monthly) — A/B test
```

### Payment Flow

```
Week 1: FREE
  - User is in cohort, no payment required
  - subscription.status = FREE on User

End of Week 1:
  - System (or admin manual trigger) sets cohort.currentWeek = 2
  - Dashboard shows UpgradePrompt component
  - Email sent: "Your cohort is starting Week 2"

User clicks "Continue":
  - POST /api/billing/create-checkout
  - Creates Stripe Checkout Session
  - metadata: { userId, cohortId }
  - success_url: /dashboard?payment=success
  - cancel_url: /dashboard?payment=canceled

Stripe Checkout Success:
  - Webhook: checkout.session.completed
  - Creates/updates Subscription in DB
  - Updates membership.weekAccessLevel = 4
  - Sends "Welcome to Week 2" email

Week 2–4 Access Control:
  - Middleware checks subscription.status === 'ACTIVE'
  - If not active: dashboard shows UpgradePrompt, prompts locked

Failed Payment:
  - Webhook: invoice.payment_failed
  - subscription.status = PAST_DUE
  - Email: "Your payment failed" with update link
  - Dashboard: soft lock (can see prompts, can't submit responses)
  - After 3 failures: subscription.status = CANCELED

Subscription Canceled:
  - User sees cancellation confirmation
  - Re-enrollment option after 30 days
  - Data retained for re-matching

Billing Portal:
  - /dashboard/billing → Stripe Customer Portal (update card, cancel)
```

---

## 14. LAUNCH CHECKLIST

### Week 1–2: Foundation
- [ ] Set up Supabase project, get connection string
- [ ] Initialize Next.js project with TypeScript + Tailwind
- [ ] Install and configure shadcn/ui
- [ ] Set up Clerk authentication
- [ ] Configure Prisma with schema, run first migration
- [ ] Deploy to Vercel (staging environment)
- [ ] Set up Stripe account, create product/prices
- [ ] Set up Resend account, configure sending domain
- [ ] Configure all environment variables

### Week 2–3: Core Features
- [ ] Build landing page (all sections, animations)
- [ ] Build onboarding flow (assessment, reveal, profile)
- [ ] Build Prisma queries (assessment submission, profile creation)
- [ ] Build matching engine (scoring + grouping algorithm)
- [ ] Build admin dashboard (stats, user table, cohort management)
- [ ] Build matching approval flow (suggest → admin review → approve)
- [ ] Build user dashboard (cohort view, prompts, member cards)
- [ ] Build weekly feedback form
- [ ] Set up Stripe webhook handler
- [ ] Build Week 2 paywall flow

### Week 3–4: Polish + Beta
- [ ] Add Framer Motion animations throughout
- [ ] Mobile responsiveness audit (every page)
- [ ] Error states and validation on all forms
- [ ] Email templates (welcome, cohort matched, week 2 prompt, payment)
- [ ] Admin prompt sender functionality
- [ ] Beta testing with 5 internal users
- [ ] Fix all bugs from beta
- [ ] Performance audit (Core Web Vitals)
- [ ] Set up error monitoring (Sentry free tier)
- [ ] Set up basic analytics (Vercel Analytics or Posthog)

### Pre-Launch
- [ ] Final security review (auth middleware, admin gating)
- [ ] Stripe test mode → live mode
- [ ] Custom domain setup (softlaunchhq.com)
- [ ] Privacy policy + terms of service pages
- [ ] First 5 real users onboarded manually
- [ ] First cohort manually approved and launched
- [ ] WhatsApp groups created for beta cohorts

---

## 15. V2 ROADMAP

### V1.5 (Month 2–3)
- Behavior signal integration into matching (attendance + feedback → driveProfile update)
- AI-generated drive profile summaries (GPT-4o API, ~$0.02/user)
- Mobile-optimized PWA (add to home screen)
- Referral system (1 free month for referring a friend who completes cohort)
- Email drip sequences (Resend sequences for waitlist → onboarding → retention)
- Multiple cohort themes running simultaneously
- Expand to Raleigh, Durham, Atlanta

### V2 (Month 4–6): The Passport Feature
- `CityNetwork` table + `LocationIntent` model
- Users can tag `futureCity` and desired move timeline
- Matching engine creates "pre-relocation cohorts" across cities
- Users meet virtually before relocating
- Becomes the first social product specifically for ambitious relocators
- This is the moat — no competitor exists in this space

### V3 (Month 6–12): Scale
- Mobile apps (React Native with Expo)
- In-app chat (replace WhatsApp dependency)
- AI-powered matching with behavioral ML model
- Cohort alumni network (discover past cohort members)
- Company partnerships (HR/People teams buy cohorts for new employees)
- International expansion

---

*SoftLaunch MVP Spec v1.0 — Built for launch, designed to scale.*
