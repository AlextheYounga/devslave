import type { PrismaClient, Job } from "@prisma/client";
import { prisma } from "./prisma";

export class JobQueue {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = prisma;
  }

  async enqueue(type: string, payload: any): Promise<Job> {
    // Store payload as JSON in the DB (schema uses Json type)
    return this.prisma.job.create({
      data: { type, payload },
    });
  }

  async dequeue(): Promise<Job | null> {
    return this.prisma.$transaction(async (tx) => {
      const job = await tx.job.findFirst({
        where: { status: "pending" },
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
      orderBy: { createdAt: "desc" },
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