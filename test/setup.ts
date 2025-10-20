import prisma from "./client";
import { refreshDatabase } from "./utils";
import dotenv from "dotenv";

// Load test environment variables
dotenv.config({ path: ".env.test" });

//Sometimes useful for testing purposes.
const noRefreshDB = process.argv[4] === "--no-refresh-db" || false;

beforeAll(async () => {
  await prisma.$connect();
});

if (noRefreshDB === false) {
  beforeEach(async () => {
    await refreshDatabase();
  });
} else {
  console.log("Not refreshing database after each test.");
}

afterAll(async () => {
  await prisma.$disconnect();
});
