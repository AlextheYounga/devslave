import { PrismaClient } from "./.generated/prisma/index.js";
import type { JobData } from "./types.js";

class JobQueue {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async enqueue(type: string, payload: string, priority = 0): Promise<JobData> {
    return this.prisma.job.create({
      data: { type, payload, priority },
    });
  }

  async dequeue(): Promise<JobData | null> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { status: "pending" },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      });
      if (!job) return null;
      await tx.job.update({
        where: { id: job.id },
        data: { status: "processing" },
      });
      return job;
    });
  }

  async complete(jobId: number): Promise<JobData> {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: "completed" },
    });
  }

  async fail(jobId: number): Promise<JobData> {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: "failed" },
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default JobQueue;
