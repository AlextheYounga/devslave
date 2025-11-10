import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { existsSync } from "fs";

export default class GetAllCodebasesHandler {
    private db: PrismaClient;

    constructor() {
        this.db = prisma;
    }

    async handle() {
        const activeCodebases = [];
        const codebases = await this.db.codebase.findMany();

        for (const codebase of codebases) {
            if (codebase.active && existsSync(codebase.path)) {
                activeCodebases.push(codebase);
            }
        }

        return activeCodebases;
    }
}
