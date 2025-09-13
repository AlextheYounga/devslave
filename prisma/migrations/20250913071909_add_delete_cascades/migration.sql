-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_branches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codebaseId" TEXT NOT NULL,
    "ticketId" TEXT,
    "name" TEXT NOT NULL,
    "worktree" TEXT NOT NULL,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "branches_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "branches_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_branches" ("codebaseId", "createdAt", "data", "id", "name", "ticketId", "worktree") SELECT "codebaseId", "createdAt", "data", "id", "name", "ticketId", "worktree" FROM "branches";
DROP TABLE "branches";
ALTER TABLE "new_branches" RENAME TO "branches";
CREATE TABLE "new_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jobId" TEXT NOT NULL,
    "codebaseId" TEXT NOT NULL,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "events_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "events_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_events" ("codebaseId", "data", "id", "jobId", "parentId", "timestamp", "type") SELECT "codebaseId", "data", "id", "jobId", "parentId", "timestamp", "type" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
CREATE TABLE "new_tickets" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "codebaseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tickets_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_tickets" ("codebaseId", "createdAt", "description", "id", "priority", "status", "title", "updatedAt") SELECT "codebaseId", "createdAt", "description", "id", "priority", "status", "title", "updatedAt" FROM "tickets";
DROP TABLE "tickets";
ALTER TABLE "new_tickets" RENAME TO "tickets";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
