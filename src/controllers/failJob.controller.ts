import { Request, Response } from "express";
import { JOB_QUEUE } from "../queue";

async function failJobController(req: Request, res: Response) {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        error: "Job ID is required",
      });
    }

    const job = await JOB_QUEUE.fail(id);
    res.json({ success: true, data: job });
  } catch (error) {
    console.error("Error failing job:", error);
    res.status(500).json({
      success: false,
      error: "Failed to mark job as failed",
    });
  }
}

export default failJobController;