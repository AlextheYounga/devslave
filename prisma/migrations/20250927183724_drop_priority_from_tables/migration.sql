/*
  Warnings:

  - You are about to drop the column `priority` on the `jobs` table. All the data in the column will be lost.
  - You are about to drop the column `priority` on the `tickets` table. All the data in the column will be lost.
  - Added the required column `ticketId` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_jobs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "blocking" BOOLEAN NOT NULL DEFAULT true,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_jobs" ("blocking", "createdAt", "id", "payload", "retries", "status", "type", "updatedAt") SELECT "blocking", "createdAt", "id", "payload", "retries", "status", "type", "updatedAt" FROM "jobs";
DROP TABLE "jobs";
ALTER TABLE "new_jobs" RENAME TO "jobs";
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codebaseId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("codebaseId", "createdAt", "description", "id", "status", "title", "updatedAt") SELECT "codebaseId", "createdAt", "description", "id", "status", "title", "updatedAt" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
