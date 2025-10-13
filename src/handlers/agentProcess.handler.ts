import { REPO_ROOT } from "../constants";
import { execSync } from "child_process";
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
    const scriptFolder = process.env.SCRIPT_PATH || "src/scripts";
    const scriptFile = `${REPO_ROOT}/${scriptFolder}/launch-agent.sh`;
    const agentRecord = await this.createAgentRecord();
    this.tmuxSession = `agent_${agentRecord.id}`;

    // Quote args for safety and reliability across shells/paths with spaces
    execSync(`bash "${scriptFile}" "${projectPath}" "${prompt}" "${this.tmuxSession}"`);

    this.pid = this.getAgentPid();
    const logFile = this.getAgentLogFile();
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

  getAgentPid() {
    const panePid = this.getTmuxPanePid();
    // Use default timeouts for stability in production
    return this.waitForChildPidByPattern(panePid, "tail");
  }

  getAgentLogFile() {
    const out = this.waitForProcessOpenFile(this.pid!, "sessions");
    return this.parseLogFilePathFromLsofOutput(out);
  }

  // Helpers
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

  private waitForChildPidByPattern(
    parentPid: number,
    pattern: string,
    timeoutMs = 5000,
    intervalMs = 100
  ): number {
    const deadline = Date.now() + timeoutMs;
    let lastErr: any;
    while (Date.now() < deadline) {
      try {
        const cmd = `pgrep -n -P ${parentPid} -f ${pattern}`;
        const pidStr = execSync(cmd, { stdio: "pipe" }).toString().trim();
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid) && pid > 0) return pid;
      } catch (err) {
        lastErr = err;
      }
      AgentProcessHandler.sleepMs(intervalMs);
    }
    throw (
      lastErr ??
      new Error(`No child process matching '${pattern}' for parent ${parentPid}`)
    );
  }

  private waitForProcessOpenFile(
    pid: number,
    grepPattern: string,
    timeoutMs = 5000,
    intervalMs = 100
  ): string {
    const deadline = Date.now() + timeoutMs;
    let last = "";
    while (Date.now() < deadline) {
      try {
        const out = execSync(`lsof -p ${pid} | grep ${grepPattern}`, {
          stdio: "pipe",
        }).toString();
        if (out.trim().length > 0) {
          last = out;
          break;
        }
      } catch {
        // ignore and retry
      }
      AgentProcessHandler.sleepMs(intervalMs);
    }
    if (!last)
      throw new Error(`No open file matching '${grepPattern}' found for pid ${pid}`);
    return last;
  }

  private parseLogFilePathFromLsofOutput(out: string): string {
    const lines = out.trim().split("\n");
    const lastLine = lines[lines.length - 1]?.trim() ?? "";
    const cols = lastLine.split(/\s+/);
    const pathCol = cols[cols.length - 1];
    if (!pathCol || !pathCol.includes("/sessions/")) {
      throw new Error(`Unable to parse sessions log file from lsof output: ${lastLine}`);
    }
    return pathCol;
  }

  private static sleepMs(ms: number) {
    // Synchronous sleep using Atomics; avoids async refactors
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
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
