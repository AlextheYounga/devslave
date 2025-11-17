import { AgentStatus, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../prisma";

export type ListAgentsFilters = {
    statuses?: AgentStatus[];
    limit?: number;
};

export default class ListAgentsHandler {
    private db: PrismaClient;
    private filters: ListAgentsFilters;

    constructor(filters: ListAgentsFilters = {}, db: PrismaClient = prisma) {
        this.filters = filters;
        this.db = db;
    }

    async handle() {
        const where = this.filters.statuses?.length
            ? ({ status: { in: this.filters.statuses } } satisfies Prisma.AgentWhereInput)
            : undefined;

        const query: Prisma.AgentFindManyArgs = {
            include: {
                codebase: true,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: this.filters.limit ?? 25,
        };

        if (where) {
            query.where = where;
        }

        return this.db.agent.findMany(query);
    }
}
