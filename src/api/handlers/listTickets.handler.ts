import { Prisma, PrismaClient, TicketStatus } from "@prisma/client";
import { prisma } from "../../prisma";

export type ListTicketsFilters = {
    statuses?: TicketStatus[];
    codebaseId?: string;
    limit?: number;
};

export default class ListTicketsHandler {
    private db: PrismaClient;
    private filters: ListTicketsFilters;

    constructor(filters: ListTicketsFilters = {}, db: PrismaClient = prisma) {
        this.filters = filters;
        this.db = db;
    }

    async handle() {
        const where: Prisma.TicketWhereInput = {};

        if (this.filters.codebaseId) {
            where.codebaseId = this.filters.codebaseId;
        }
        if (this.filters.statuses?.length) {
            where.status = { in: this.filters.statuses };
        }

        const query: Prisma.TicketFindManyArgs = {
            include: {
                codebase: true,
            },
            orderBy: { updatedAt: "desc" },
            take: this.filters.limit ?? 50,
        };

        if (Object.keys(where).length) {
            query.where = where;
        }

        return this.db.ticket.findMany(query);
    }
}
