import { Request, Response } from "express";
import { validateRequiredFields } from "../utils/validation";
import ScanTicketsHandler from "../handlers/scanTickets.handler";

export default class TicketsController {
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.req = req;
    this.res = res;
    this.data = this.req.body;
  }

  async scan() {
    try {
      const requiredFields = ["executionId", "codebaseId"];
      const validation = validateRequiredFields(this.data, requiredFields);
      if (!validation.isValid) {
        return this.res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      // Scan tickets
      const scanTicketsHandler = new ScanTicketsHandler(this.data);
      const result = await scanTicketsHandler.handle();

      return this.res.status(200).json({
        success: true,
        message: `Tickets scanned successfully`,
        data: { ...this.data, ...result },
      });
    } catch (error: any) {
      console.error("Error in TicketsController->scan:", error);
      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }
}
