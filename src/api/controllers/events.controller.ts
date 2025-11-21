import { Request, Response } from "express";
import ListEventsHandler from "../handlers/listEvents.handler";

const DEFAULT_EVENT_LIMIT = 50;
const MAX_EVENT_LIMIT = 100;

export default class EventsController {
    private req: Request;
    private res: Response;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
    }

    async list() {
        try {
            const { agentId, ticketId, codebaseId } = this.req.query;
            const limitParam = this.req.query.limit as string | undefined;

            let limit = DEFAULT_EVENT_LIMIT;
            if (limitParam !== undefined) {
                const parsed = parseInt(limitParam, 10);
                if (Number.isNaN(parsed) || parsed <= 0) {
                    return this.res.status(400).json({
                        success: false,
                        error: "Limit must be a positive integer",
                    });
                }
                limit = Math.min(parsed, MAX_EVENT_LIMIT);
            }

            const filters: Record<string, any> = { limit };
            if (agentId) filters.agentId = agentId;
            if (ticketId) filters.ticketId = ticketId;
            if (codebaseId) filters.codebaseId = codebaseId;

            const handler = new ListEventsHandler(filters);
            const events = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Events retrieved successfully",
                data: { events },
            });
        } catch (error: any) {
            console.error("Error in EventsController->list:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
