import { Request, Response } from 'express';
import { JOB_QUEUE } from '../queue';

async function createJobController(req: Request, res: Response) {
  try {
    const { type, payload, priority = 0 } = req.body;
    
    if (!type) {
      return res.status(400).json({ 
        success: false, 
        error: 'Job type is required' 
      });
    }
    
    const job = await JOB_QUEUE.enqueue(type, JSON.stringify(payload), priority);
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