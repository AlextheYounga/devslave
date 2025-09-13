import prisma from './client';

export function refreshDatabase() {
  if (process.env.NODE_ENV === 'test') {
    // Delete in order to respect foreign key constraints
    prisma.events.deleteMany();
    prisma.branch.deleteMany();
    prisma.ticket.deleteMany();
    prisma.codebase.deleteMany();
    prisma.job.deleteMany();
  }
}