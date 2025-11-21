import { Request, Response } from "express";
import GetDashboardStatsHandler from "../handlers/getDashboardStats.handler";

export default class DashboardController {
    private req: Request;
    private res: Response;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
    }

    async getDashboardStats() {
        try {
            const handler = new GetDashboardStatsHandler();
            const stats = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Dashboard stats retrieved",
                data: stats,
            });
        } catch (error: any) {
            console.error("Error in DashboardController->getDashboardStats:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
