-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionId" TEXT NOT NULL,
    "sessionId" TEXT,
    "tmuxSession" TEXT,
    "role" TEXT,
    "pid" INTEGER,
    "logFile" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PREPARING',
    "inputs" JSONB,
    "context" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_agents" ("context", "createdAt", "executionId", "id", "inputs", "logFile", "pid", "role", "sessionId", "status") SELECT "context", "createdAt", "executionId", "id", "inputs", "logFile", "pid", "role", "sessionId", "status" FROM "agents";
DROP TABLE "agents";
ALTER TABLE "new_agents" RENAME TO "agents";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
