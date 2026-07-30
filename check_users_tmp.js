const { PrismaClient } = require("@prisma/client")
const fs = require("fs")

// Load .env.local manually
const envFile = fs.readFileSync(".env.local", "utf8")
for (const line of envFile.split("\n")) {
  const eq = line.indexOf("=")
  if (eq > 0 && !line.startsWith("#")) {
    const key = line.slice(0, eq).trim()
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, "")
    if (!process.env[key]) process.env[key] = val
  }
}

const db = new PrismaClient()

async function main() {
  const targets = ["choudhary31777@gmail.com", "alexvanpoole@gmail.com"]

  for (const email of targets) {
    const user = await db.user.findFirst({
      where: { email: { equals: email, mode: "insensitive" } },
      select: { id: true, email: true, role: true, clerkId: true, createdAt: true, onboardingComplete: true },
    })

    const mask = e => e.replace(/^(.{3}).*(@.*)$/, "$1***$2")

    if (!user) {
      console.log(`\n[${email}] ← NOT FOUND in DB`)
      const partial = await db.user.findMany({
        where: { email: { contains: email.split("@")[0] } },
        select: { email: true, role: true, clerkId: true },
      })
      if (partial.length) {
        console.log(`  Partial username matches:`)
        partial.forEach(u => console.log(`    ${mask(u.email)} | role=${u.role} | clerkId=${u.clerkId ? "PRESENT" : "NULL"}`))
      } else {
        console.log(`  No partial matches found.`)
      }
    } else {
      console.log(`\n[${email}]`)
      console.log(`  DB email (masked):  ${mask(user.email)}`)
      console.log(`  Exact match:        ${user.email === email}`)
      console.log(`  Lowercase match:    ${user.email.toLowerCase() === email.toLowerCase()}`)
      console.log(`  role:               ${user.role}`)
      console.log(`  clerkId present:    ${!!user.clerkId}`)
      console.log(`  createdAt:          ${user.createdAt.toISOString()}`)
      console.log(`  onboardingComplete: ${user.onboardingComplete}`)
    }
  }

  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "FOUNDER"] } },
    select: { email: true, role: true },
  })
  console.log(`\n--- ADMIN/FOUNDER users in DB (${admins.length}) ---`)
  admins.forEach(a => console.log(`  ${mask(a.email)} — ${a.role}`))

  const total = await db.user.count()
  console.log(`\nTotal users in DB: ${total}`)

  await db.$disconnect()
}

async function mask(e) { return e.replace(/^(.{3}).*(@.*)$/, "$1***$2") }

main().catch(e => { console.error("\nDB ERROR:", e.message); process.exit(1) })
