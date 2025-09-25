import { JobQueue } from "./queue";
import { JobRegistry } from "./registry";
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
    const jobData = {
      id: job.id,
      payload: JSON.parse(job.payload as string)
    };

    // Get the job class dynamically
    const JobClass = await JobRegistry.getJobClass(job.type);
    
    if (!JobClass) {
      throw new Error(`Unknown job type: ${job.type}`);
    }

    // Instantiate and execute the job
    const jobInstance = new JobClass(jobData);
    await jobInstance.perform();
  }
}