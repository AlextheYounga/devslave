import { Request, Response } from 'express';
import { JOB_QUEUE } from '../queue';

async function getJobByIdController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ 
        success: false, 
        error: 'Job ID is required' 
      });
    }
    
    const job = await JOB_QUEUE.getJobById(id);
    
    if (!job) {
      return res.status(404).json({ 
        success: false, 
        error: 'Job not found' 
      });
    }
    
    res.json({ success: true, data: job });
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch job' 
    });
  }
}

export default getJobByIdController;