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
    CONSTRAINT "branches_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "tickets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "branches_codebaseId_fkey" FOREIGN KEY ("codebaseId") REFERENCES "codebases" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_branches" ("codebaseId", "createdAt", "data", "id", "name", "ticketId", "worktree") SELECT "codebaseId", "createdAt", "data", "id", "name", "ticketId", "worktree" FROM "branches";
DROP TABLE "branches";
ALTER TABLE "new_branches" RENAME TO "branches";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
