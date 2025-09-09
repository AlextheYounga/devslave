import { Request, Response } from "express";
import { JobQueue } from "../queue";

const queue = new JobQueue();

async function completeJobController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Job ID is required",
      });
    }

    const job = await queue.complete(id);
    res.json({ success: true, data: job });
  } catch (error) {
    console.error("Error completing job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to complete job",
    });
  }
}

export default completeJobController;