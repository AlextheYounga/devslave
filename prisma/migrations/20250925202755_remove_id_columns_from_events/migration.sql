/*
  Warnings:

  - You are about to drop the column `codebaseId` on the `events` table. All the data in the column will be lost.
  - You are about to drop the column `jobId` on the `events` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parentId" TEXT,
    "type" TEXT NOT NULL,
    "data" JSONB,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_events" ("data", "id", "parentId", "timestamp", "type") SELECT "data", "id", "parentId", "timestamp", "type" FROM "events";
DROP TABLE "events";
ALTER TABLE "new_events" RENAME TO "events";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
