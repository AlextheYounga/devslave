import prisma from "./client";

export function refreshDatabase() {
  if (process.env.NODE_ENV === "test") {
    // Delete in order to respect foreign key constraints
    prisma.events.deleteMany();
    prisma.ticket.deleteMany();
    prisma.agent.deleteMany();
    prisma.codebase.deleteMany();
  }
}
