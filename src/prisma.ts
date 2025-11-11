import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

// Configure SQLite for better concurrency when running many parallel workflows.
// These PRAGMAs are safe no-ops for non-SQLite databases (we guard by URL prefix).
async function configureSQLitePragmas() {
    const dbUrl = process.env.DATABASE_URL || "";
    // Only attempt PRAGMA tweaks for SQLite (e.g., file:./dev.db)
    if (!dbUrl.startsWith("file:")) {
        return;
    }
    try {
        // Enable better concurrent readers/writers
        await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
        // Wait briefly instead of failing immediately on transient locks
        await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
        // Trade a bit of durability for speed; appropriate for local/workflow use
        await prisma.$queryRawUnsafe("PRAGMA synchronous = NORMAL");
        // Keep WAL size under control
        await prisma.$queryRawUnsafe("PRAGMA wal_autocheckpoint = 1000");
    } catch (e) {
        // Do not crash the app if PRAGMAs cannot be set (e.g., read-only FS)
        console.warn("SQLite PRAGMA configuration skipped:", e);
    }
}

// Fire-and-forget initialization; queries will proceed regardless.
configureSQLitePragmas();
