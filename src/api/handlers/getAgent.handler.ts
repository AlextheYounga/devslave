import { PrismaClient } from "@prisma/client";
import { prisma } from "../../prisma";

export default class GetAgentHandler {
    private db: PrismaClient;
    private agentId: string;

    constructor(agentId: string, db: PrismaClient = prisma) {
        this.agentId = agentId;
        this.db = db;
    }

    async handle() {
        const agent = await this.db.agent.findUnique({
            where: { id: this.agentId },
            include: { codebase: true },
        });
        if (!agent) {
            throw new Error("Agent not found");
        }
        return agent;
    }
}
