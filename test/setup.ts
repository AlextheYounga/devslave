import prisma from "./client";
import { refreshDatabase } from "./utils";

//Sometimes useful for testing purposes.
const noRefreshDB = process.argv[4] === "--no-refresh-db" || false;

beforeAll(async () => {
  await prisma.$connect();
  await refreshDatabase();
});

if (noRefreshDB === false) {
  afterEach(async () => {
    await refreshDatabase();
  });
} else {
  console.log("Not refreshing database after each test.");
}

afterAll(async () => {
  await prisma.$disconnect();
});
