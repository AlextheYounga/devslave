import { JobQueue } from './jobs/index.js';

async function main() {
  const queue = new JobQueue();

  // Example: Enqueue a job
  const job = await queue.enqueue('example', JSON.stringify({ message: 'Hello World' }));
  console.log('Enqueued job:', job);

  // Example: Dequeue a job
  const dequeued = await queue.dequeue();
  if (dequeued) {
    console.log('Dequeued job:', dequeued);
    // Process the job here
    // Then mark as complete
    await queue.complete(dequeued.id);
  }

  await queue.close();
}

main().catch(console.error);
