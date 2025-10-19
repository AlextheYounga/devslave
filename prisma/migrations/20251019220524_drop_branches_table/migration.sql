/*
  Warnings:

  - You are about to drop the `branches` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `pid` on the `agents` table. All the data in the column will be lost.
  - Added the required column `branchName` to the `tickets` table without a default value. This is not possible if the table is not empty.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "branches";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tmuxSession" TEXT,
    "role" TEXT,
    "logFile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "inputs" JSONB,
    "context" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_agents" ("context", "createdAt", "executionId", "id", "inputs", "logFile", "role", "sessionId", "status", "tmuxSession", "updatedAt") SELECT "context", "createdAt", "executionId", "id", "inputs", "logFile", "role", "sessionId", "status", "tmuxSession", "updatedAt" FROM "agents";
DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codebaseId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "branchName" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("codebaseId", "createdAt", "description", "id", "status", "ticketId", "title", "updatedAt") SELECT "codebaseId", "createdAt", "description", "id", "status", "ticketId", "title", "updatedAt" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
