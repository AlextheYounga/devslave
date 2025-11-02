import dotenv from "dotenv";
import { prisma } from "../prisma";
import { PrismaClient, AgentStatus } from "@prisma/client";
import { exec, spawn } from "child_process";
import { readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import {
    AgentPreparing,
    AgentLaunched,
    AgentLogFileDiscovered,
    AgentLogFileDiscoveryFailed,
} from "../events";
import { Role, paths } from "../constants";
dotenv.config();

type StartAgentParams = {
    executionId: string;
    codebaseId: string;
    prompt: string;
    role: Role;
    model?: string;
    debugMode?: boolean;
};

export default class StartAgentHandler {
    private db: PrismaClient;
    public params: StartAgentParams;
    public tmuxSession: string | undefined;
    public logFiles: string[] | undefined;
    private eventData: any;

    constructor(params: StartAgentParams) {
        this.db = prisma;
        this.params = params;
    }

    async handle() {
        const codebaseId = this.params.codebaseId;
        const scriptFile = `${paths.scripts}/launch-agent.sh`;
        const agentRecord = await this.createAgentRecord();
        if (this.params.debugMode) return this.debugResponse(agentRecord.id);

        this.tmuxSession = `agent_${agentRecord.id}`;
        await this.updateAgentRecord(agentRecord.id, {
            tmuxSession: this.tmuxSession,
        });

        const commandArgs = [scriptFile, codebaseId, agentRecord.id];
        console.log(
            `[AgentProcessHandler] Executing command: bash ${commandArgs.join(" ")}`,
        );

        // Snapshot baseline of session files as close as possible to launch time
        this.logFiles = this.getAllLogFiles();

        spawn("bash", commandArgs, {
            detached: true,
            stdio: "ignore",
        }).unref(); // Allow parent to exit without waiting

        // Verify tmux session actually started
        const sessionStarted = await this.verifyTmuxSession(this.tmuxSession);
        if (!sessionStarted) {
            await this.updateAgentRecord(agentRecord.id, {
                status: AgentStatus.FAILED,
            });
            throw new Error(`Tmux session ${this.tmuxSession} failed to start`);
        }

        new AgentLaunched(this.eventData).publish();

        // Start non-blocking log file discovery
        this.startLogFileDiscovery(agentRecord.id);

        await this.updateAgentRecord(agentRecord.id, {
            status: AgentStatus.LAUNCHED,
        });

        return {
            agentId: agentRecord.id,
            tmuxSession: this.tmuxSession,
        };
    }

    private async verifyTmuxSession(sessionName: string): Promise<boolean> {
        const timeout = Date.now() + 10000; // 10 seconds
        const sleep = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

        while (Date.now() < timeout) {
            const exists = await this.tmuxSessionExists(sessionName);
            if (exists) {
                console.log(
                    `[StartAgentHandler] Tmux session ${sessionName} verified`,
                );
                return true;
            }
            await sleep(500);
        }

        console.error(
            `[StartAgentHandler] Tmux session ${sessionName} verification timeout`,
        );
        return false;
    }

    private tmuxSessionExists(sessionName: string): Promise<boolean> {
        return new Promise((resolve) => {
            exec(`tmux has-session -t ${sessionName} 2>/dev/null`, (error) => {
                resolve(error === null);
            });
        });
    }

    private startLogFileDiscovery(agentId: string) {
        // Fire and forget - runs in background
        this.pollForLogFile(agentId).catch((err) => {
            console.error(
                `[StartAgentHandler] Log file discovery error: ${err.message}`,
            );
        });
    }

    private async pollForLogFile(agentId: string) {
        const timeout = Date.now() + 10000; // 10 seconds from now
        const sleep = (ms: number) =>
            new Promise((resolve) => setTimeout(resolve, ms));

        while (true) {
            const logFilesAfter = this.getAllLogFiles();
            const newLogFile = logFilesAfter.filter(
                (f: string) => !this.logFiles!.includes(f),
            );

            if (newLogFile.length === 1) {
                const logFile = newLogFile[0]!;
                const sessionId = this.extractSessionId(logFile);

                await this.db.agent.update({
                    where: { id: agentId },
                    data: {
                        logFile: logFile ?? null,
                        sessionId: sessionId ?? null,
                    },
                });

                new AgentLogFileDiscovered({
                    agentId,
                    logFile: logFile ?? null,
                    sessionId: sessionId ?? null,
                }).publish();

                return;
            }

            if (Date.now() > timeout) {
                const errorMessage = `Unable to determine new log file for agent. Found ${newLogFile.length} new files.`;
                console.error(errorMessage);
                new AgentLogFileDiscoveryFailed({
                    agentId,
                    error: errorMessage,
                    filesFound: newLogFile.length,
                }).publish();
                return;
            }

            await sleep(500);
        }
    }

    private extractSessionId(filePath: string) {
        // Strict UUID v4-style: 8-4-4-4-12 hex
        const UUID_STRICT =
            /[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/g;
        const matches = filePath.match(UUID_STRICT);
        return matches && matches.length
            ? matches[matches.length - 1]
            : undefined;
    }

    private getAllLogFiles() {
        const files: string[] = [];
        // Mimic: find ~/.codex -name "*.jsonl" (recurse entire ~/.codex tree)
        const roots = [join(process.env.HOME || homedir(), ".codex")];
        const walk = (dir: string) => {
            try {
                const entries = readdirSync(dir, { withFileTypes: true });
                for (const entry of entries) {
                    const full = join(dir, entry.name);
                    if (entry.isDirectory()) walk(full);
                    else if (entry.isFile() && full.endsWith(".jsonl"))
                        files.push(full);
                }
            } catch {
                // ignore missing directories or permission issues
            }
        };
        for (const root of roots) walk(root);
        return files;
    }

    private async createAgentRecord() {
        const record = await this.db.agent.create({
            data: {
                executionId: this.params.executionId,
                role: this.params.role,
                prompt: this.params.prompt,
                model: this.params.model || null,
            },
        });

        this.eventData = {
            agentId: record.id,
            codebaseId: this.params.codebaseId,
            executionId: this.params.executionId,
            role: this.params.role,
            inputs: this.params,
        };

        new AgentPreparing(this.eventData).publish();

        return record;
    }

    private async updateAgentRecord(id: string, data: any) {
        this.eventData = {
            ...this.eventData,
            ...data,
        };

        await this.db.agent.update({
            where: { id: id },
            data: data,
        });
    }

    private debugResponse(agentId: string) {
        return {
            agentId: agentId,
            codebaseId: this.params.codebaseId,
            logFile: "debug-file.jsonl",
            sessionId: "debug-session-id",
            tmuxSession: `agent_${agentId}`,
        };
    }
}
