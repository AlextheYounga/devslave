import { Request, Response } from 'express';
import { JobQueue } from '../queue';

const queue = new JobQueue();

type JobRequestBody = {
  type: string;
  payload: Record<string, any>;
  priority?: number;
};  

async function createJobController(req: Request, res: Response) {
  try {
    const requestBody: JobRequestBody = req.body;
    const { type, payload, priority = 0 } = requestBody;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Job type is required' 
      });
    }
    
  const job = await queue.enqueue(type, payload, priority);
    res.status(201).json({ success: true, data: job });
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to create job' 
    });
  }
}

export default createJobController;