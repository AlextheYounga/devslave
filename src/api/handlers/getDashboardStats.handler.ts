import { AgentStatus, PrismaClient, TicketStatus } from "@prisma/client";
import { prisma } from "../../prisma";

export type DashboardStats = {
    runningAgents: number;
    totalAgents: number;
    completedTickets: number;
    openTickets: number;
};

const OPEN_TICKET_STATUSES: TicketStatus[] = [
    TicketStatus.OPEN,
    TicketStatus.IN_PROGRESS,
    TicketStatus.QA_REVIEW,
    TicketStatus.QA_CHANGES_REQUESTED,
];

export default class GetDashboardStatsHandler {
    private db: PrismaClient;

    constructor(db: PrismaClient = prisma) {
        this.db = db;
    }

    async handle(): Promise<DashboardStats> {
        const [runningAgents, totalAgents, completedTickets, openTickets] = await Promise.all([
            this.db.agent.count({
                where: { status: AgentStatus.RUNNING },
            }),
            this.db.agent.count(),
            this.db.ticket.count({
                where: {
                    status: TicketStatus.CLOSED,
                    codebase: { active: true },
                },
            }),
            this.db.ticket.count({
                where: {
                    status: { in: OPEN_TICKET_STATUSES },
                    codebase: { active: true },
                },
            }),
        ]);

        return {
            runningAgents,
            totalAgents,
            completedTickets,
            openTickets,
        };
    }
}
