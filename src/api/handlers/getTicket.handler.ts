import { PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";

export default class GetTicketHandler {
    private db: PrismaClient;
    private ticketId: string;

    constructor(ticketId: string, db: PrismaClient = prisma) {
        this.ticketId = ticketId;
        this.db = db;
    }

    async handle() {
        const ticket = await this.db.ticket.findUnique({
            where: { id: this.ticketId },
            include: { codebase: true },
        });
        if (!ticket) {
            throw new Error("Ticket not found");
        }
        return ticket;
    }
}
