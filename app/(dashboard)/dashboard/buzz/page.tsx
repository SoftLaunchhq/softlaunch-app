import { auth } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { db } from "@/lib/db"
import { BuzzPageClient } from "./BuzzPageClient"

/** Fetch user's profiles for BUZZ context */
async function getBuzzPageData(clerkId: string) {
  try {
    const user = await db.user.findUnique({
      where: { clerkId },
      include: {
        profile: true,
        driveProfile: true,
      },
    })
    if (!user) return null

    // Fetch psychProfile — cast because Prisma client may not have new models
    const psychProfile = await (db as any).psychProfile
      .findUnique({ where: { userId: user.id } })
      .catch(() => null)

    return {
      user,
      driveProfile: user.driveProfile,
      psychProfile: psychProfile ?? null,
      firstName: user.profile?.firstName ?? null,
    }
  } catch {
    return null
  }
}

export default async function BuzzPage() {
  const { userId: clerkId } = await auth()
  if (!clerkId) redirect("/sign-in")

  const data = await getBuzzPageData(clerkId)
  if (!data) redirect("/dashboard")

  return (
    <BuzzPageClient
      driveProfile={data.driveProfile}
      psychProfile={data.psychProfile}
      firstName={data.firstName}
    />
  )
}
