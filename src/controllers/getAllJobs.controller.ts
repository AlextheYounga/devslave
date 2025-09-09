import { Response } from "express";
import { JOB_QUEUE } from "../queue";

async function getAllJobsController(res: Response) {
  try {
    const jobs = await JOB_QUEUE.getJobs();
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
