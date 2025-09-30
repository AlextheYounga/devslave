-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_codebases" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "setup" BOOLEAN NOT NULL DEFAULT false,
    "data" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_codebases" ("createdAt", "data", "id", "name", "path", "updatedAt") SELECT "createdAt", "data", "id", "name", "path", "updatedAt" FROM "codebases";
DROP TABLE "codebases";
ALTER TABLE "new_codebases" RENAME TO "codebases";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
