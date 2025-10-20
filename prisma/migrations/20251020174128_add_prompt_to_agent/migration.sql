/*
  Warnings:

  - You are about to drop the column `context` on the `agents` table. All the data in the column will be lost.
  - You are about to drop the column `inputs` on the `agents` table. All the data in the column will be lost.

*/
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
    "prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_agents" ("createdAt", "executionId", "id", "logFile", "role", "sessionId", "status", "tmuxSession", "updatedAt") SELECT "createdAt", "executionId", "id", "logFile", "role", "sessionId", "status", "tmuxSession", "updatedAt" FROM "agents";
DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
