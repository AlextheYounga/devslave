import prisma from "./client";

export async function refreshDatabase() {
  if (process.env.NODE_ENV === "test") {
    // Delete in order to respect foreign key constraints
    await prisma.events.deleteMany();
    await prisma.agent.deleteMany();
    await prisma.ticket.deleteMany();
    await prisma.codebase.deleteMany();
  }
}
