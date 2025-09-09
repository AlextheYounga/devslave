import { JobQueue } from "./queue";

const jobQueue = new JobQueue();

export class Worker {
  async process() {
    while (true) {
        const nextJob = await jobQueue.dequeue();
        if (nextJob) {
            console.log(`Processing job ${nextJob.id} of type ${nextJob.type}`);
            // Simulate job processing with a delay
            await new Promise(resolve => setTimeout(resolve, 2000));
            await jobQueue.complete(nextJob.id);
            console.log(`Completed job ${nextJob.id}`);
        } else {
            console.log("No jobs to process, waiting...");
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
  }
}