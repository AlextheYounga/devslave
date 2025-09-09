import { Request, Response } from "express";
import { JOB_QUEUE } from "../queue";

async function completeJobController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Job ID is required",
      });
    }

    const job = await JOB_QUEUE.complete(id);
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