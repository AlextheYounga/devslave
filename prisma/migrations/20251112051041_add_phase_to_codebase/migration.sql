-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_codebases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "setup" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "phase" TEXT NOT NULL DEFAULT 'DESIGN',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_codebases" ("active", "createdAt", "data", "id", "name", "path", "setup", "updatedAt") SELECT "active", "createdAt", "data", "id", "name", "path", "setup", "updatedAt" FROM "codebases";
DROP TABLE "codebases";
ALTER TABLE "new_codebases" RENAME TO "codebases";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
