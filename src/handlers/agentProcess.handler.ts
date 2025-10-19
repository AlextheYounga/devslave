import { REPO_ROOT, SCRIPT_PATH } from "../constants";
import { execSync, spawn } from "child_process";
import { prisma } from "../prisma";
import { PrismaClient, Codebase, AgentStatus } from "@prisma/client";
import dotenv from "dotenv";
import { AgentPreparing, AgentLaunched } from "../events";

dotenv.config();

type AgentParams = {
  prompt: string;
  role: string;
};

export default class AgentProcessHandler {
  private db: PrismaClient;
  public executionId: string;
  public codebase: Codebase;
  public params: AgentParams;
  public pid: number | undefined;
  public tmuxSession: string | undefined;
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
    const scriptFile = `${REPO_ROOT}/${SCRIPT_PATH}/launch-agent.sh`;
    const agentRecord = await this.createAgentRecord();
    this.tmuxSession = `agent_${agentRecord.id}`;

    console.log(
      `[AgentProcessHandler] Executing command: bash ${scriptFile} ${projectPath} ${this.tmuxSession} ${prompt}`
    );

    spawn("bash", [scriptFile, projectPath, this.tmuxSession, prompt], {
      detached: true,
      stdio: "ignore",
    }).unref(); // Allow parent to exit without waiting

    this.pid = await this.getAgentPid();
    const logFile = await this.getAgentLogFile();
    const sessionId = this.extractSessionId(logFile);
    await this.updateAgentRecord(agentRecord.id, logFile, sessionId);

    return {
      agentId: agentRecord.id,
      pid: this.pid,
      logFile: logFile,
      sessionId: sessionId,
      tmuxSession: this.tmuxSession,
    };
  }

  async getAgentPid() {
    const timeout = Date.now() + 1000; // 1 second from now
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (true) {
      try {
        const tmuxServers = execSync("tmux list-sessions", {
          stdio: ["ignore", "pipe", "pipe"],
        }).toString();
        if (tmuxServers.includes(this.tmuxSession!)) {
          const tmuxPid = this.getTmuxPanePid();
          const codexPid = execSync(`pgrep -P ${tmuxPid}`);
          if (codexPid && codexPid.toString().trim().length > 0) {
            return parseInt(codexPid.toString().trim(), 10);
          }
        }
      } catch (error) {
        // tmux server might not be running yet, continue retrying
        if (Date.now() > timeout) {
          this.killTmuxFailSafe();
          throw new Error(`Failed to get agent log file for pid ${this.pid}: ${error}`);
        }

        await sleep(500); // wait 500ms before retrying
      }
    }
  }

  async getAgentLogFile() {
    const timeout = Date.now() + 1000; // 1 second from now
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    while (true) {
      try {
        const lsofOutput = execSync(`lsof -p ${this.pid} | grep sessions`);
        const pathStack = lsofOutput.toString().split("/");
        pathStack.shift();
        const logFilePath = "/" + pathStack.join("/");
        return logFilePath;
      } catch (error) {
        if (Date.now() > timeout) {
          this.killTmuxFailSafe();
          throw new Error(`Failed to get agent log file for pid ${this.pid}: ${error}`);
        }
        await sleep(500); // wait 500ms before retrying
        continue;
      }
    }
  }

  private getTmuxPanePid(): number {
    const tmuxPanePidStr = execSync(
      `tmux list-panes -t ${this.tmuxSession}:0 -F "#{pane_pid}"`
    )
      .toString()
      .trim();

    const panePid = parseInt(tmuxPanePidStr, 10);
    if (isNaN(panePid) || panePid <= 0) {
      throw new Error(
        `Invalid tmux pane pid for session ${this.tmuxSession}: ${tmuxPanePidStr}`
      );
    }
    return panePid;
  }

  private killTmuxFailSafe() {
    execSync(`tmux kill-session -a`);
  }

  private extractSessionId(filePath: string) {
    // Strict UUID v4-style: 8-4-4-4-12 hex
    const UUID_STRICT = /[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}/g;
    const matches = filePath.match(UUID_STRICT);
    return matches && matches.length ? matches[matches.length - 1] : undefined;
  }

  private async createAgentRecord() {
    const record = await this.db.agent.create({
      data: {
        executionId: this.executionId,
        role: this.params?.role ?? null,
        inputs: this.params,
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
      pid: this.pid ?? null,
      logFile: logFile,
      sessionId: sessionId ?? null,
      tmuxSession: this.tmuxSession ?? null,
    };

    new AgentLaunched(this.eventData).publish();

    await this.db.agent.update({
      where: { id: id },
      data: {
        pid: this.pid ?? null,
        logFile: logFile,
        sessionId: sessionId ?? null,
        tmuxSession: this.tmuxSession ?? null,
        status: AgentStatus.LAUNCHED,
      },
    });
  }
}
