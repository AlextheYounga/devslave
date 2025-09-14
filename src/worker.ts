import { JobQueue } from "./queue";
import { JobRegistry } from "./registry";
import { prisma } from "./prisma";
import type { Job } from "@prisma/client";

const jobQueue = new JobQueue();

export class Worker {
  async process() {
    while (true) {
        const nextJob = await jobQueue.dequeue();
        if (nextJob) {
            console.log(`Processing job ${nextJob.id} of type ${nextJob.type}`);
            
            try {
                await this.processJob(nextJob);
                await jobQueue.complete(nextJob.id);
                console.log(`Completed job ${nextJob.id}`);
            } catch (error) {
                console.error(`Failed to process job ${nextJob.id}:`, error);
                await jobQueue.fail(nextJob.id);
                console.log(`Failed job ${nextJob.id}`);
            }
        } else {
            console.log("No jobs to process, waiting...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
  }

  // Method for testing - processes a single job
  async processSingleJob() {
    const nextJob = await jobQueue.dequeue();
    if (nextJob) {
        console.log(`Processing job ${nextJob.id} of type ${nextJob.type}`);
        
        try {
            await this.processJob(nextJob);
            await jobQueue.complete(nextJob.id);
            console.log(`Completed job ${nextJob.id}`);
        } catch (error) {
            console.error(`Failed to process job ${nextJob.id}:`, error);
            await jobQueue.fail(nextJob.id);
            console.log(`Failed job ${nextJob.id}`);
        }
    }
  }

  private async processJob(job: Job) {
    const jobData = JSON.parse(job.payload as string);

    // Get the job class dynamically
    const JobClass = await JobRegistry.getJobClass(job.type);
    
    if (!JobClass) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Instantiate and execute the job
    const jobInstance = new JobClass(jobData);
    await jobInstance.perform();

    // Save an event for successful job completion
    await this.saveJobEvent(job.id, "job_completed", { message: `Job ${job.type} completed successfully` });
  }

  private async saveJobEvent(jobId: string, type: string, data?: any) {
    // Find the codebase associated with this job if any
    // For now, we'll use a default codebase or make it optional
    const codebase = await prisma.codebase.findFirst();
    if (codebase) {
      await prisma.events.create({
        data: {
          jobId,
          codebaseId: codebase.id,
          type,
          data,
        },
      });
    }
  }
}