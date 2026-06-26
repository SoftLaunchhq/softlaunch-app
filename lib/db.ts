// ─────────────────────────────────────────────────────────────
// lib/db.ts
// Production-hardened Prisma client singleton.
// ─────────────────────────────────────────────────────────────

import { PrismaClient } from "@prisma/client"
import { validateEnv } from "./env"

// Validate env vars once on module load (throws in dev, warns in prod)
validateEnv()

// ── Singleton pattern (required for Next.js hot-reload in dev) ────────────
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
    // Explicit datasource URL lets us catch missing vars early and log clearly
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  })

  // In development, log a redacted version of the DB host on first connection
  if (process.env.NODE_ENV === "development") {
    const url = process.env.DATABASE_URL ?? ""
    let host = "unknown"
    try {
      host = new URL(url).hostname
    } catch {
      host = "unparseable URL"
    }
    console.log(`[prisma] Client created → host: ${host}`)
  }

  return client
}

export const db = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db
}
