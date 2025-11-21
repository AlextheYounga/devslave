import { Request, Response } from "express";
import { TicketStatus } from "@prisma/client";
import { validateRequiredFields } from "../utils/validation";
import ScanAllTicketsHandler from "../handlers/scanAllTickets.handler";
import ScanTicketHandler from "../handlers/scanTicket.handler";
import ListTicketsHandler, { ListTicketsFilters } from "../handlers/listTickets.handler";
import GetTicketHandler from "../handlers/getTicket.handler";

const DEFAULT_TICKET_LIMIT = 50;
const MAX_TICKET_LIMIT = 100;

export default class TicketsController {
    private req: Request;
    private res: Response;
    private data: any;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.data = this.req.body;
    }

    async scanTicket() {
        try {
            const ticketId = this.req.params.id!;
            const debugMode = this.req?.query?.debugMode
                ? this.req.query.debugMode === "true"
                : false;
            const scanTicketsHandler = new ScanTicketHandler(ticketId, debugMode);
            const ticket = await scanTicketsHandler.handle();

            return this.res.status(200).json({
                success: true,
                message: `Tickets scanned successfully`,
                data: { ticket },
            });
        } catch (error: any) {
            console.error("Error in TicketsController->scan:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async getById() {
        try {
            const ticketId = this.req.params.id!;
            const handler = new GetTicketHandler(ticketId);
            const ticket = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Ticket retrieved successfully",
                data: { ticket },
            });
        } catch (error: any) {
            console.error("Error in TicketsController->getById:", error);
            const status = error?.message?.includes("not found") ? 404 : 500;
            return this.res.status(status).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async list() {
        try {
            const statusParam = this.req.query.status as string | undefined;
            const limitParam = this.req.query.limit as string | undefined;
            const codebaseId = this.req.query.codebaseId as string | undefined;

            const allowedStatuses = new Set(Object.values(TicketStatus));
            let statuses: TicketStatus[] | undefined;

            if (statusParam) {
                const parsed = statusParam
                    .split(",")
                    .map((value) => value.trim().toUpperCase())
                    .filter(Boolean)
                    .filter((value): value is TicketStatus =>
                        allowedStatuses.has(value as TicketStatus),
                    );

                if (!parsed.length) {
                    return this.res.status(400).json({
                        success: false,
                        error: "Invalid status filter provided",
                    });
                }

                statuses = parsed;
            }

            let limit = DEFAULT_TICKET_LIMIT;
            if (limitParam !== undefined) {
                const parsedLimit = parseInt(limitParam, 10);
                if (Number.isNaN(parsedLimit) || parsedLimit <= 0) {
                    return this.res.status(400).json({
                        success: false,
                        error: "Limit must be a positive integer",
                    });
                }
                limit = Math.min(parsedLimit, MAX_TICKET_LIMIT);
            }

            const params: ListTicketsFilters = { limit };
            if (statuses) params.statuses = statuses;
            if (codebaseId) params.codebaseId = codebaseId;

            const listHandler = new ListTicketsHandler(params);

            const tickets = await listHandler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Tickets retrieved successfully",
                data: { tickets },
            });
        } catch (error: any) {
            console.error("Error in TicketsController->list:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
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
            const scanTicketsHandler = new ScanAllTicketsHandler(this.data);
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
