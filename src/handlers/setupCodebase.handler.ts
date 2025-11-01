import { paths } from "../constants";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
    CodebaseSetupStarted,
    CodebaseSetupCompleted,
    CodebaseSetupFailed,
    CodebaseAlreadySetup,
} from "../events";

dotenv.config();

type CodebaseSetupParams = {
    executionId: string;
    name: string;
    folderName: string;
    prompt: string;
    setup?: string;
};

export default class SetupCodebaseHandler {
    private db: PrismaClient;
    private params: CodebaseSetupParams;

    constructor(params: CodebaseSetupParams) {
        this.db = prisma;
        this.params = params;
    }

    async handle() {
        try {
            new CodebaseSetupStarted(this.params).publish();
            const projectPath = path.join(
                paths.devWorkspace,
                this.params.folderName,
            );

            // Save codebase to DB first so setup script can find it
            const codebase = await this.saveCodebase(
                projectPath,
                this.params.prompt,
            );
            const eventData = {
                ...this.params,
                codebaseId: codebase.id,
            };

            // Idempotency: use DB flag to determine if setup already completed
            if (codebase.setup && fs.existsSync(projectPath)) {
                new CodebaseAlreadySetup(this.params).publish();
                return {
                    ...eventData,
                    stdout: "codebase already set up, skipping initialization",
                };
            }

            // Setup script handles PROJECT.md creation and all setup logic
            const scriptOutput = await this.runSetupScript(codebase.id);

            // Update codebase to mark setup as completed
            await this.db.codebase.update({
                where: { id: codebase.id },
                data: { setup: true },
            });

            new CodebaseSetupCompleted({
                ...eventData,
                stdout: scriptOutput,
            }).publish();

            return {
                ...eventData,
                stdout: scriptOutput,
            };
        } catch (error: any) {
            new CodebaseSetupFailed({
                ...this.params,
                error: error?.message ?? String(error),
            }).publish();
            throw error;
        }
    }

    private async runSetupScript(codebaseId: string) {
        const scriptFile = `${paths.scripts}/setup.sh`;

        // Execute via bash for portability and proper error codes; quote args
        const scriptOutput = execSync(`bash "${scriptFile}" "${codebaseId}"`, {
            stdio: "pipe",
            encoding: "utf-8",
            env: { ...process.env }, // Pass current environment to script
        });
        return scriptOutput;
    }

    private async saveCodebase(projectPath: string, prompt: string) {
        const existing = await this.db.codebase.findFirst({
            where: { path: projectPath },
        });
        if (existing) return existing;
        return await this.db.codebase.create({
            data: {
                name: this.params.name,
                path: projectPath,
                data: {
                    masterPrompt: prompt,
                    setupType: this.params.setup || "default",
                },
            },
        });
    }
}
