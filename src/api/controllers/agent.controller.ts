import { Request, Response } from "express";
import { AgentStatus } from "@prisma/client";
import { validateRequiredFields } from "../utils/validation";
import StartAgentHandler from "../handlers/startAgent.handler";
import WatchAgentHandler from "../handlers/watchAgent.handler";
import StartAgentAndWaitHandler from "../handlers/startAgentAndWait.handler";
import StartAgentAndNotifyHandler from "../handlers/startAgentAndNotify.handler";
import GetAgentStatusHandler from "../handlers/getAgentStatus.handler";
import KillAgentHandler from "../handlers/killAgent.handler";
import ListAgentsHandler from "../handlers/listAgents.handler";
import GetDashboardStatsHandler from "../handlers/getDashboardStats.handler";
import GetAgentHandler from "../handlers/getAgent.handler";

const DEFAULT_AGENT_STATUSES: AgentStatus[] = [
    AgentStatus.PREPARING,
    AgentStatus.LAUNCHED,
    AgentStatus.RUNNING,
];
const DEFAULT_AGENT_LIMIT = 25;
const MAX_AGENT_LIMIT = 100;

export default class AgentController {
    private req: Request;
    private res: Response;
    private data: any;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.data = this.req.body;
    }

    async list() {
        try {
            const statusParam = this.req.query.status as string | undefined;
            const limitParam = this.req.query.limit as string | undefined;

            const allowedStatuses = new Set(Object.values(AgentStatus));
            let statuses: AgentStatus[] = DEFAULT_AGENT_STATUSES;

            if (statusParam) {
                const parsed = statusParam
                    .split(",")
                    .map((value) => value.trim().toUpperCase())
                    .filter(Boolean)
                    .filter((value): value is AgentStatus =>
                        allowedStatuses.has(value as AgentStatus),
                    );

                if (!parsed.length) {
                    return this.res.status(400).json({
                        success: false,
                        error: "Invalid status filter provided",
                    });
                }

                statuses = parsed;
            }

            let limit = DEFAULT_AGENT_LIMIT;
            if (limitParam !== undefined) {
                const parsedLimit = parseInt(limitParam, 10);
                if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
                    return this.res.status(400).json({
                        success: false,
                        error: "Limit must be a positive integer",
                    });
                }
                limit = Math.min(parsedLimit, MAX_AGENT_LIMIT);
            }

            const listHandler = new ListAgentsHandler({
                statuses,
                limit,
            });
            const statsHandler = new GetDashboardStatsHandler();

            const [agents, stats] = await Promise.all([
                listHandler.handle(),
                statsHandler.handle(),
            ]);

            return this.res.status(200).json({
                success: true,
                message: "Agents retrieved successfully",
                data: { agents, stats },
            });
        } catch (error: any) {
            console.error("Error in AgentController->list:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async ping() {
        try {
            const agentId = this.req.params.id!;
            const debugMode = this.req?.query?.debugMode
                ? this.req.query.debugMode === "true"
                : false;
            const executionId = this.req?.query?.executionId as string | undefined;
            const params: any = { agentId, debugMode };
            if (executionId) params.executionId = executionId;

            const agentHandler = new GetAgentStatusHandler(params);
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
            const requiredFields = ["prompt", "codebaseId", "executionId", "role"];
            const validation = validateRequiredFields(this.data, requiredFields);
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
            const requiredFields = ["prompt", "codebaseId", "executionId", "role"];
            const validation = validateRequiredFields(this.data, requiredFields);
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
            const requiredFields = ["prompt", "codebaseId", "callbackUrl", "executionId", "role"];
            const validation = validateRequiredFields(this.data, requiredFields);
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

    async kill() {
        try {
            const agentId = this.req.params.id!;
            const handler = new KillAgentHandler({
                agentId,
                reason: this.data?.reason,
            });
            const result = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Agent terminated",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in AgentController->kill:", error);
            const status = error?.message?.includes("not found") ? 404 : 500;
            return this.res.status(status).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async getById() {
        try {
            const agentId = this.req.params.id!;
            const handler = new GetAgentHandler(agentId);
            const agent = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Agent retrieved successfully",
                data: { agent },
            });
        } catch (error: any) {
            console.error("Error in AgentController->getById:", error);
            const status = error?.message?.includes("not found") ? 404 : 500;
            return this.res.status(status).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
