import { Request, Response } from "express";
import { validateRequiredFields } from "../utils/validation";
import GetCodebaseHandler from "../handlers/getCodebase.handler";
import SetupCodebaseHandler from "../handlers/setupCodebase.handler";

export default class CodebaseController {
  private req: Request;
  private res: Response;
  private data: any;

  constructor(req: Request, res: Response) {
    this.req = req;
    this.res = res;
    this.data = this.req.body;
  }

  async get() {
    try {
      const codebaseId = this.req.params.id!;
      const codebase = await new GetCodebaseHandler(codebaseId).handle();

      return this.res.status(200).json({
        success: true,
        message: "Codebase retrieved successfully",
        data: { codebase },
      });
    } catch (error: any) {
      console.error("Error in CodebaseController->scan:", error);
      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }

  async setup() {
    try {
      const requiredFields = ["executionId", "codebaseId", "folderName", "prompt"];
      const validation = validateRequiredFields(this.data, requiredFields);
      if (!validation.isValid) {
        return this.res.status(400).json({
          success: false,
          error: validation.error,
        });
      }

      // Scan tickets
      const setupHandler = new SetupCodebaseHandler(this.data);
      const result = await setupHandler.handle();

      return this.res.status(200).json({
        success: true,
        message: `Tickets scanned successfully`,
        data: { ...this.data, ...result },
      });
    } catch (error: any) {
      console.error("Error in CodebaseController->scan:", error);
      return this.res.status(500).json({
        success: false,
        error: error?.message ?? String(error),
      });
    }
  }
}
