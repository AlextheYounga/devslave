import { JobQueue } from "./queue";
import { JobRegistry } from "./registry";
import type { Job } from "@prisma/client";

const jobQueue = new JobQueue();

// TODO: Implement retry system

export class Worker {
  private stopOnEmpty: boolean = false;

  constructor(stopOnEmpty: boolean = false) {
    this.stopOnEmpty = stopOnEmpty;
  }

  async process() {
    while (true) {
      const nextJob = await jobQueue.dequeue();

      if (!nextJob || nextJob === null) {
        console.log("No jobs to process, waiting...");
        if (this.stopOnEmpty) break;
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      console.log(`Processing job ${nextJob.id} of type ${nextJob.type}`);

      if (nextJob.retries >= 3) {
        console.log(`Job ${nextJob.id} has exceeded max retries, marking as failed.`);
        await jobQueue.fail(nextJob.id);
        continue;
      }

      if (nextJob.blocking) {
        await this.processJob(nextJob);
      } else {
        this.processJob(nextJob);
      }

      console.log(`Completed job ${nextJob.id}`);
    }
  }

  private async processJob(job: Job) {
    try {
      const jobData = {
        id: job.id,
        payload: JSON.parse(job.payload as string),
      };

      // Get the job class dynamically
      const JobClass = await JobRegistry.getJobClass(job.type);

      if (!JobClass) {
        throw new Error(`Unknown job type: ${job.type}`);
      }

      // Instantiate and execute the job
      const jobInstance = new JobClass(jobData);
      await jobInstance.perform();
      await jobQueue.complete(job.id);
    } catch (error) {
      console.error(`Failed to process job ${job.id}:`, error);
      await jobQueue.fail(job.id);
      console.log(`Failed job ${job.id}`);
    }
  }
}
