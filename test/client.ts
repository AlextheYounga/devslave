import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ".env.test", override: true, quiet: true });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
    throw new Error("DATABASE_URL must be defined for tests");
}

const parsed = new URL(dbUrl);
const dbName = parsed.pathname.replace("/", "");

if (dbName !== "devslave_test") {
    throw new Error("Test database must be named devslave_test");
}

const prisma = new PrismaClient();

export default prisma;
