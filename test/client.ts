import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import dd from "./dd"

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
export default prisma;
