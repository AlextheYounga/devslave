import { PrismaClient, Job } from "@prisma/client";

export class JobQueue {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  async enqueue(type: string, payload: string, priority = 0): Promise<Job> {
    return this.prisma.job.create({
      data: { type, payload, priority },
    });
  }

  async dequeue(): Promise<Job | null> {
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

  async complete(jobId: string): Promise<Job> {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: "completed" },
    });
  }

  async fail(jobId: string): Promise<Job> {
    return this.prisma.job.update({
      where: { id: jobId },
      data: { status: "failed" },
    });
  }

  async getJobs(): Promise<Job[]> {
    return this.prisma.job.findMany({
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  }

  async getJobById(jobId: string): Promise<Job | null> {
    return this.prisma.job.findUnique({
      where: { id: jobId },
    });
  }

  async close(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

export default JobQueue;
export const JOB_QUEUE = new JobQueue();