import { NextRequest, NextResponse } from "next/server"
import { Webhook } from "svix"
import { db } from "@/lib/db"

export const runtime = "nodejs"

// POST /api/webhooks/clerk — Clerk user lifecycle events
export async function POST(req: NextRequest) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET

  if (!WEBHOOK_SECRET) {
    console.error("CLERK_WEBHOOK_SECRET is not set")
    return NextResponse.json({ error: "No webhook secret configured" }, { status: 500 })
  }

  // Svix verification headers
  const svix_id = req.headers.get("svix-id")
  const svix_timestamp = req.headers.get("svix-timestamp")
  const svix_signature = req.headers.get("svix-signature")

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 })
  }

  const body = await req.text()
  const wh = new Webhook(WEBHOOK_SECRET)
  let evt: any

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    })
  } catch (err) {
    console.error("Clerk webhook verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  const { type, data } = evt

  try {
    switch (type) {
      case "user.created": {
        const email = data.email_addresses?.[0]?.email_address?.toLowerCase()?.trim()
        if (!email) break

        const adminEmails = (process.env.ADMIN_EMAILS || "")
          .split(",")
          .map((e: string) => e.trim().toLowerCase())
          .filter(Boolean)
        const role = adminEmails.includes(email) ? "ADMIN" : "USER"

        await db.user.upsert({
          where: { clerkId: data.id },
          create: {
            clerkId: data.id,
            email,
            role,
            onboardingStep: "WELCOME",
            onboardingComplete: false,
          },
          update: { email },
        })

        // If on waitlist, mark as converted
        await db.waitlist.updateMany({
          where: { email },
          data: { convertedAt: new Date() },
        })

        console.log(`✅ User created in DB: ${email}`)
        break
      }

      case "user.updated": {
        const rawEmail = data.email_addresses?.[0]?.email_address
        if (rawEmail) {
          const email = rawEmail.toLowerCase().trim()
          const adminEmails = (process.env.ADMIN_EMAILS || "")
            .split(",")
            .map((e: string) => e.trim().toLowerCase())
            .filter(Boolean)

          // Promote to ADMIN if email is in the list.
          // Never downgrade an existing ADMIN/FOUNDER — only promote.
          const updateData: Record<string, unknown> = { email }
          if (adminEmails.includes(email)) {
            updateData.role = "ADMIN"
          }

          await db.user.updateMany({
            where: { clerkId: data.id },
            data: updateData,
          })

          if (adminEmails.includes(email)) {
            console.log(`✅ Admin role ensured for updated user: ${email}`)
          }
        }
        break
      }

      case "user.deleted": {
        // Soft-delete: unlink Clerk ID but keep history
        await db.user.updateMany({
          where: { clerkId: data.id },
          data: { clerkId: null },
        })
        break
      }
    }
  } catch (dbError) {
    // Log DB errors but return 200 to Clerk (so it doesn't retry indefinitely)
    console.error("Clerk webhook DB error:", dbError)
  }

  return NextResponse.json({ received: true })
}
