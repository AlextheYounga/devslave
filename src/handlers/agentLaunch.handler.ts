import { paths } from "../constants";
import { exec, spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { prisma } from "../prisma";
import { PrismaClient, Codebase, AgentStatus } from "@prisma/client";
import dotenv from "dotenv";
import { AgentPreparing, AgentLaunched } from "../events";

dotenv.config();

type AgentParams = {
  prompt: string;
  role: string;
};

export default class AgentLaunchHandler {
  private db: PrismaClient;
  public executionId: string;
  public codebase: Codebase;
  public params: AgentParams;
  public tmuxSession: string | undefined;
  public logFiles: string[] | undefined;
  private eventData: any;

  constructor(executionId: string, codebase: Codebase, params: AgentParams) {
    this.db = prisma;
    this.executionId = executionId;
    this.codebase = codebase;
    this.params = params;
  }

  async launch() {
    const projectPath = this.codebase.path;
    const prompt = this.params.prompt;
    const scriptFile = `${paths.scripts}/launch-agent.sh`;
    const agentRecord = await this.createAgentRecord();
    this.tmuxSession = `agent_${agentRecord.id}`;

    console.log(
      `[AgentProcessHandler] Executing command: bash ${scriptFile} ${projectPath} ${this.tmuxSession} ${prompt}`
    );

    // Snapshot baseline of session files as close as possible to launch time
    this.logFiles = this.getAllLogFiles();

    spawn("bash", [scriptFile, projectPath, this.tmuxSession, prompt], {
      detached: true,
      stdio: "ignore",
    }).unref(); // Allow parent to exit without waiting

    const logFile = await this.getAgentLogFile();
    const sessionId = this.extractSessionId(logFile!);
    await this.updateAgentRecord(agentRecord.id, logFile!, sessionId);

    return {
      agentId: agentRecord.id,
      logFile: logFile,
      sessionId: sessionId,
      tmuxSession: this.tmuxSession,
    };
  }

  // Good-enough strategy for getting session files. This is straightforward using lsof
  // on the MacOS version of codex, but on Linux it's more complicated.
  async getAgentLogFile() {
    const timeout = Date.now() + 10000; // 10 seconds from now
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (true) {
      const logFilesAfter = this.getAllLogFiles();
      const newLogFile = logFilesAfter.filter((f) => !this.logFiles!.includes(f));

      if (newLogFile.length === 0 || newLogFile.length > 1) {
        if (Date.now() > timeout) {
          this.killTmuxFailSafe();
          throw new Error(
            `Unable to determine new log file for agent. Found ${newLogFile.length} new files.`
          );
        }
        // Wait a bit and retry
        await sleep(500);
        continue;
      }

      return newLogFile[0];
    }
  }

  private extractSessionId(filePath: string) {
    // Strict UUID v4-style: 8-4-4-4-12 hex
    const UUID_STRICT = /[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/g;
    const matches = filePath.match(UUID_STRICT);
    return matches && matches.length ? matches[matches.length - 1] : undefined;
  }

  private getAllLogFiles() {
    const files: string[] = [];
    // Mimic: find ~/.codex -name "*.jsonl" (recurse entire ~/.codex tree)
    const roots = [path.join(process.env.HOME || os.homedir(), ".codex")];
    const walk = (dir: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else if (entry.isFile() && full.endsWith(".jsonl")) files.push(full);
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
        executionId: this.executionId,
        role: this.params?.role ?? null,
        prompt: this.params.prompt,
      },
    });

    this.eventData = {
      agentId: record.id,
      codebaseId: this.codebase.id,
      executionId: this.executionId,
      role: this.params?.role ?? null,
      inputs: this.params,
    };

    new AgentPreparing(this.eventData).publish();

    return record;
  }

  private async updateAgentRecord(
    id: string,
    logFile: string,
    sessionId: string | undefined
  ) {
    this.eventData = {
      ...this.eventData,
      logFile: logFile,
      sessionId: sessionId ?? null,
      tmuxSession: this.tmuxSession ?? null,
    };

    new AgentLaunched(this.eventData).publish();

    await this.db.agent.update({
      where: { id: id },
      data: {
        logFile: logFile,
        sessionId: sessionId ?? null,
        tmuxSession: this.tmuxSession ?? null,
        status: AgentStatus.LAUNCHED,
      },
    });
  }

  private killTmuxFailSafe() {
    exec(`tmux kill-session -t ${this.tmuxSession}`);
  }
}
