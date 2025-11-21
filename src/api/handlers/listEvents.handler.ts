import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";

export type ListEventsFilters = {
    agentId?: string;
    ticketId?: string;
    codebaseId?: string;
    limit?: number;
};

export default class ListEventsHandler {
    private db: PrismaClient;
    private filters: ListEventsFilters;

    constructor(filters: ListEventsFilters, db: PrismaClient = prisma) {
        this.filters = filters;
        this.db = db;
    }

    async handle() {
        const conditions: Prisma.EventsWhereInput[] = [];

        if (this.filters.agentId) {
            conditions.push(
                { data: { path: ["agentId"], equals: this.filters.agentId } },
                { data: { path: ["agent", "id"], equals: this.filters.agentId } },
            );
        }

        if (this.filters.ticketId) {
            conditions.push(
                { data: { path: ["ticketId"], equals: this.filters.ticketId } },
                { data: { path: ["ticket", "id"], equals: this.filters.ticketId } },
            );
        }

        if (this.filters.codebaseId) {
            conditions.push(
                { data: { path: ["codebaseId"], equals: this.filters.codebaseId } },
                { data: { path: ["codebase", "id"], equals: this.filters.codebaseId } },
            );
        }

        const query: Prisma.EventsFindManyArgs = {
            orderBy: { timestamp: Prisma.SortOrder.desc },
            take: this.filters.limit ?? 50,
        };

        if (conditions.length > 0) {
            query.where = { OR: conditions };
        }

        return this.db.events.findMany(query);
    }
}
