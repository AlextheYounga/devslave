import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.test", override: true, quiet: true });

const databaseName = () => {
    const DB_URL = process.env.DATABASE_URL;
    const DB_NAME = DB_URL?.split("/").pop();
    return DB_NAME;
};

if (databaseName() !== "test.db") {
    throw new Error("Database must be named test.db");
}

const prisma = new PrismaClient();

prisma.$executeRawUnsafe(`PRAGMA journal_mode=WAL`);
prisma.$executeRawUnsafe(`PRAGMA synchronous=FULL`); // FULL for max durability
prisma.$executeRawUnsafe(`PRAGMA busy_timeout=5000`); // ms; lets brief lock conflicts wait instead of error
prisma.$executeRawUnsafe(`PRAGMA wal_autocheckpoint=1000`); // pages; tune to your write rate

export default prisma;
