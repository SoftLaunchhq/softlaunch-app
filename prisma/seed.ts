/**
 * SoftLaunch Development Seed
 * Creates realistic test data for development + beta testing
 *
 * Run: npm run db:seed
 */

import { PrismaClient, UserRole, CohortStatus, CohortTheme } from "@prisma/client"
import { generateDriveProfile } from "../lib/matching"

const db = new PrismaClient()

async function main() {
  console.log("🌱 Seeding SoftLaunch database...")

  // Clean existing data
  await db.adminAction.deleteMany()
  await db.attendance.deleteMany()
  await db.feedback.deleteMany()
  await db.weeklyResponse.deleteMany()
  await db.weeklyPrompt.deleteMany()
  await db.cohortMembership.deleteMany()
  await db.cohort.deleteMany()
  await db.cohortPreferences.deleteMany()
  await db.driveProfile.deleteMany()
  await db.assessmentAnswer.deleteMany()
  await db.assessment.deleteMany()
  await db.subscription.deleteMany()
  await db.profile.deleteMany()
  await db.user.deleteMany()
  await db.waitlist.deleteMany()

  // ─── ADMIN USER ───────────────────────────────────────────
  const admin = await db.user.create({
    data: {
      email: "mallika@softlaunchhq.com",
      role: UserRole.FOUNDER,
      onboardingComplete: true,
      currentCity: "Charlotte, NC",
      profile: {
        create: {
          firstName: "Mallika",
          lastName: "Choudhary",
          headline: "CEO & Co-Founder, SoftLaunch",
          bio: "Building the infrastructure for intentional friendship.",
        },
      },
    },
  })
  console.log("✅ Admin user created")

  // ─── TEST USERS (Beta) ────────────────────────────────────
  const testUsers = [
    {
      email: "marcus@test.com",
      firstName: "Marcus",
      lastName: "Thompson",
      headline: "Founder, FinTech startup",
      answers: [
        { questionId: "q1", answerKey: "building" },
        { questionId: "q2", answerKey: "output" },
        { questionId: "q3", answerKey: "exercise" },
        { questionId: "q4", answerKey: "accountability" },
        { questionId: "q5", answerKey: "building" },
      ],
      themes: [CohortTheme.FOUNDERS_BUILDERS, CohortTheme.ACCOUNTABILITY],
    },
    {
      email: "aaliyah@test.com",
      firstName: "Aaliyah",
      lastName: "Robinson",
      headline: "VP Marketing at a Series B",
      answers: [
        { questionId: "q1", answerKey: "career" },
        { questionId: "q2", answerKey: "deep_convo" },
        { questionId: "q3", answerKey: "small_group" },
        { questionId: "q4", answerKey: "ambition" },
        { questionId: "q5", answerKey: "scaling" },
      ],
      themes: [CohortTheme.CAREER_GROWTH, CohortTheme.ACCOUNTABILITY],
    },
    {
      email: "jordan@test.com",
      firstName: "Jordan",
      lastName: "Kim",
      headline: "Product Designer · Freelance",
      answers: [
        { questionId: "q1", answerKey: "creative" },
        { questionId: "q2", answerKey: "creative_flow" },
        { questionId: "q3", answerKey: "creating" },
        { questionId: "q4", answerKey: "creativity" },
        { questionId: "q5", answerKey: "momentum" },
      ],
      themes: [CohortTheme.CREATIVE_AMBITION, CohortTheme.FOUNDERS_BUILDERS],
    },
    {
      email: "david@test.com",
      firstName: "David",
      lastName: "Chen",
      headline: "Software Engineer → Founder",
      answers: [
        { questionId: "q1", answerKey: "building" },
        { questionId: "q2", answerKey: "output" },
        { questionId: "q3", answerKey: "solo" },
        { questionId: "q4", answerKey: "honesty" },
        { questionId: "q5", answerKey: "building" },
      ],
      themes: [CohortTheme.FOUNDERS_BUILDERS, CohortTheme.FITNESS_DISCIPLINE],
    },
  ]

  const createdUsers = []
  for (const userData of testUsers) {
    const { answers, themes, firstName, lastName, headline, email } = userData

    const driveProfileData = generateDriveProfile("placeholder", answers)

    const user = await db.user.create({
      data: {
        email,
        role: UserRole.USER,
        onboardingComplete: true,
        currentCity: "Charlotte, NC",
        profile: {
          create: { firstName, lastName, headline },
        },
        assessment: {
          create: {
            completedAt: new Date(),
            version: 1,
          },
        },
        cohortPrefs: {
          create: {
            preferredThemes: themes,
            preferredDays: ["tuesday", "thursday"],
            preferredTime: "evenings",
          },
        },
      },
      include: { profile: true },
    })

    // Create drive profile with actual userId
    await db.driveProfile.create({
      data: {
        ...generateDriveProfile(user.id, answers),
        userId: user.id,
      },
    })

    createdUsers.push(user)
    console.log(`✅ User created: ${firstName} ${lastName}`)
  }

  // ─── ACTIVE COHORT ────────────────────────────────────────
  const cohort = await db.cohort.create({
    data: {
      name: "CLT-001",
      theme: CohortTheme.FOUNDERS_BUILDERS,
      status: CohortStatus.ACTIVE,
      currentWeek: 1,
      city: "Charlotte, NC",
      matchScore: 78.5,
      startDate: new Date(),
      whatsappGroupLink: null,
      notionDocLink: null,
      approvedBy: admin.id,
      approvedAt: new Date(),
      weeklyPrompts: {
        create: {
          weekNumber: 1,
          title: "Week 1: Introductions",
          promptText:
            "Share one thing you're currently building, working on, or trying to figure out — and why it matters to you.",
          status: "ACTIVE",
          sentAt: new Date(),
        },
      },
    },
  })

  // Add all 4 users to cohort
  await db.cohortMembership.createMany({
    data: createdUsers.map((user) => ({
      cohortId: cohort.id,
      userId: user.id,
      status: "ACTIVE" as const,
      joinedAt: new Date(),
      weekAccessLevel: 1,
      currentWeek: 1,
      compatibilityScore: 78 + Math.random() * 10,
    })),
  })

  console.log(`✅ Active cohort created: ${cohort.name}`)

  // ─── WAITLIST ENTRIES ─────────────────────────────────────
  const waitlistEmails = [
    "sarah.jones@gmail.com",
    "mike.wilson@gmail.com",
    "priya.patel@gmail.com",
    "james.brown@gmail.com",
    "emma.davis@gmail.com",
  ]

  await db.waitlist.createMany({
    data: waitlistEmails.map((email) => ({
      email,
      source: "landing_page",
      city: "Charlotte, NC",
    })),
  })

  console.log(`✅ ${waitlistEmails.length} waitlist entries created`)

  console.log("\n🎉 Seed complete!")
  console.log(`
  Summary:
  - 1 admin (mallika@softlaunchhq.com)
  - ${createdUsers.length} test users with drive profiles
  - 1 active cohort (CLT-001) with Week 1 prompt
  - ${waitlistEmails.length} waitlist entries

  Run: npm run db:studio to explore the data
  `)
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
