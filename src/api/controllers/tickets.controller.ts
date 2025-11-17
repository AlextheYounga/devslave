import { Request, Response } from "express";
import { validateRequiredFields } from "../utils/validation";
import ScanAllTicketsHandler from "../handlers/scanAllTickets.handler";
import ScanTicketHandler from "../handlers/scanTicket.handler";

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
