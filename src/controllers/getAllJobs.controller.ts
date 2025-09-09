import { Response } from "express";
import { JobQueue } from '../queue';

const queue = new JobQueue();

async function getAllJobsController(res: Response) {
  try {
    const jobs = await queue.getJobs();
    res.json({ success: true, data: jobs });
  } catch (error) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch jobs",
    });
  }
}

export default getAllJobsController;
