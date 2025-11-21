import { PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";

export type ListEventsFilters = {
    query?: string;
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
        const limit = this.filters.limit ?? 50;

        if (this.filters.query) {
            return this.db.$queryRaw`
                SELECT * FROM events 
                WHERE data::text LIKE ${"%" + this.filters.query + "%"}
                ORDER BY timestamp DESC
                LIMIT ${limit}
            `;
        }

        return this.db.$queryRaw`
            SELECT * FROM events 
            ORDER BY timestamp DESC
            LIMIT ${limit}
        `;
    }
}
