import { Request, Response } from "express";
import { WorkflowPreflightHandler } from "../handlers/workflowPreflight.handler";
import { TriggerWorkflowHandler } from "../handlers/triggerWorkflow.handler";
import { validateRequiredFields } from "../utils/validation";

export default class WorkflowController {
    private req: Request;
    private res: Response;
    private data: any;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.data = req.body;
    }

    async preflight() {
        try {
            const handler = new WorkflowPreflightHandler();
            const result = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Workflow preflight completed",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in WorkflowController->preflight:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async start() {
        try {
            const requiredFields = ["codebaseId"];
            const validation = validateRequiredFields(this.data, requiredFields);
            if (!validation.isValid) {
                return this.res.status(400).json({
                    success: false,
                    error: validation.error,
                });
            }

            if (this.data.debugMode !== undefined && typeof this.data.debugMode !== "boolean") {
                return this.res.status(400).json({
                    success: false,
                    error: "debugMode must be a boolean",
                });
            }

            const payload = {
                codebaseId: this.data.codebaseId as string,
                model:
                    typeof this.data.model === "string" && this.data.model.trim()
                        ? (this.data.model as string).trim()
                        : undefined,
                debugMode: this.data.debugMode === true,
            };

            const handler = new TriggerWorkflowHandler(payload);
            const result = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Workflow started successfully",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in WorkflowController->start:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
