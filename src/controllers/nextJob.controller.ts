
import { Request, Response } from 'express';
import { JobQueue } from '../queue';

const queue = new JobQueue();

async function nextJobController(req: Request, res: Response) {
  try {
    const job = await queue.dequeue();
    
    if (!job) {
      return res.json({ 
        success: true, 
        message: 'No jobs available to process',
        data: null 
      });
    }
    
    // Here you would typically process the job
    // For now, we'll just return the job that was dequeued
    res.json({ 
      success: true, 
      message: 'Job dequeued for processing',
      data: job 
    });
  } catch (error) {
    console.error('Error processing job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process job' 
    });
  }
}

export default nextJobController;