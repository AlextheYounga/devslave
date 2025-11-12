import { prisma } from "../prisma";
import type { ProjectPhase } from "@prisma/client";
import { PrismaClient } from "@prisma/client";
import { ProjectPhaseTransition } from "../events";

type UpdatePhaseParams = {
    codebaseId: string;
    executionId: string;
    phase: ProjectPhase;
};

export default class UpdatePhaseHandler {
    private db: PrismaClient;
    private params: UpdatePhaseParams;

    constructor(params: UpdatePhaseParams) {
        this.db = prisma;
        this.params = params;
    }

    async handle() {
        const codebase = await this.db.codebase.findUniqueOrThrow({
            where: { id: this.params.codebaseId },
        });

        if (codebase.phase === this.params.phase) {
            return codebase; // No change needed
        }

        await new ProjectPhaseTransition({
            codebaseId: this.params.codebaseId,
            executionId: this.params.executionId,
            oldPhase: codebase.phase,
            newPhase: this.params.phase,
        }).publish();

        return await this.db.codebase.update({
            where: { id: this.params.codebaseId },
            data: { phase: this.params.phase },
        });
    }
}
