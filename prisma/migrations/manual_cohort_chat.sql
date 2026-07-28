-- CohortMessage table migration
-- Run this via the Supabase SQL editor or `prisma db push` on a machine with network access.
-- This is applied automatically on Vercel deploy via `prisma generate && prisma db push`.

CREATE TABLE IF NOT EXISTS "CohortMessage" (
  "id"         TEXT        NOT NULL,
  "cohortId"   TEXT        NOT NULL,
  "senderId"   TEXT,
  "senderType" TEXT        NOT NULL DEFAULT 'MEMBER',
  "senderName" TEXT,
  "content"    TEXT        NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CohortMessage_pkey"
    PRIMARY KEY ("id"),

  CONSTRAINT "CohortMessage_cohortId_fkey"
    FOREIGN KEY ("cohortId")
    REFERENCES "Cohort"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT "CohortMessage_senderId_fkey"
    FOREIGN KEY ("senderId")
    REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CohortMessage_cohortId_createdAt_idx"
  ON "CohortMessage" ("cohortId", "createdAt");

CREATE INDEX IF NOT EXISTS "CohortMessage_senderId_idx"
  ON "CohortMessage" ("senderId");
