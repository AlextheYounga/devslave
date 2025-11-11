-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tmuxSession" TEXT,
    "codebaseId" TEXT,
    "role" TEXT,
    "logFile" TEXT,
    "prompt" TEXT,
    "model" TEXT NOT NULL DEFAULT 'default',
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agents_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_agents" ("codebaseId", "createdAt", "data", "executionId", "id", "logFile", "model", "prompt", "role", "sessionId", "status", "tmuxSession", "updatedAt") SELECT "codebaseId", "createdAt", "data", "executionId", "id", "logFile", "model", "prompt", "role", "sessionId", "status", "tmuxSession", "updatedAt" FROM "agents";
DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
