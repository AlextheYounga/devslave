import { Request, Response } from "express";
import { validateRequiredFields } from "../utils/validation";
import StartAgentHandler from "../handlers/startAgent.handler";
import WatchAgentHandler from "../handlers/watchAgent.handler";
import StartAgentAndWaitHandler from "../handlers/startAgentAndWait.handler";
import StartAgentAndNotifyHandler from "../handlers/startAgentAndNotify.handler";
import GetAgentStatusHandler from "../handlers/getAgentStatus.handler";

export default class AgentController {
    private req: Request;
    private res: Response;
    private data: any;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.data = this.req.body;
    }

    async ping() {
        try {
            const agentId = this.req.params.id!;
            const debugMode = this.req?.query?.debugMode
                ? this.req.query.debugMode === "true"
                : false;
            const executionId = this.req?.query?.executionId as
                | string
                | undefined;

            const agentHandler = new GetAgentStatusHandler({
                agentId,
                debugMode,
                executionId,
            });
            const result = await agentHandler.handle();

            return this.res.status(200).json({
                success: true,
                message: `Agent status: ${result.status}`,
                data: { ...this.data, ...result },
            });
        } catch (error: any) {
            console.error("Error in AgentController->ping:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async start() {
        try {
            const requiredFields = [
                "prompt",
                "codebaseId",
                "executionId",
                "role",
            ];
            const validation = validateRequiredFields(
                this.data,
                requiredFields,
            );
            if (!validation.isValid) {
                return this.res.status(400).json({
                    success: false,
                    error: validation.error,
                });
            }

            // Start the agent process
            const agentHandler = new StartAgentHandler(this.data);
            const result = await agentHandler.handle();

            return this.res.status(202).json({
                success: true,
                message: "Agent started",
                data: { ...this.data, ...result },
            });
        } catch (error: any) {
            console.error("Error in AgentController->start:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async watch() {
        try {
            const agentId = this.req.params.id!;
            const watchHandler = new WatchAgentHandler(agentId);
            const result = await watchHandler.handle();

            return this.res.status(202).json({
                success: true,
                message: `Agent completed with status: ${result.status}`,
                data: { ...this.data, ...result },
            });
        } catch (error: any) {
            console.error("Error in AgentController->watch:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async startAndWait() {
        try {
            const requiredFields = [
                "prompt",
                "codebaseId",
                "executionId",
                "role",
            ];
            const validation = validateRequiredFields(
                this.data,
                requiredFields,
            );
            if (!validation.isValid) {
                return this.res.status(400).json({
                    success: false,
                    error: validation.error,
                });
            }

            // Start the agent process
            const agentHandler = new StartAgentAndWaitHandler(this.data);
            const result = await agentHandler.handle();

            return this.res.status(202).json({
                success: true,
                message: `Agent completed with status: ${result.status}`,
                data: { ...this.data, ...result },
            });
        } catch (error: any) {
            console.error("Error in AgentController->startAndWait:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async startAndNotify() {
        try {
            const requiredFields = [
                "prompt",
                "codebaseId",
                "callbackUrl",
                "executionId",
                "role",
            ];
            const validation = validateRequiredFields(
                this.data,
                requiredFields,
            );
            if (!validation.isValid) {
                return this.res.status(400).json({
                    success: false,
                    error: validation.error,
                });
            }

            const agentHandler = new StartAgentAndNotifyHandler(this.data);
            agentHandler.handle();

            return this.res.status(202).json({
                success: true,
                message: "Agent started and will call webhook on completion.",
                data: this.data,
            });
        } catch (error: any) {
            console.error("Error in AgentController->startAndNotify:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
