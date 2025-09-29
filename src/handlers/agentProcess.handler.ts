import { REPO_ROOT } from "../constants";
import { exec, execSync } from "child_process";
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

    exec(`bash ${scriptFile} ${projectPath} "${prompt}" ${this.tmuxSession}`);

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
    const tmuxPid = execSync(
      `tmux list-panes -t ${this.tmuxSession} -F "#{pane_pid}"`
    ).toString();
    const codexPid = execSync(`pgrep -P ${tmuxPid}`);
    return parseInt(codexPid.toString().trim(), 10);
  }

  getAgentLogFile() {
    const lsofOutput = execSync(`lsof -p ${this.pid} | grep sessions`).toString();
    const pathStack = lsofOutput.split("/");
    pathStack.shift();
    const logFilePath = "/" + pathStack.join("/");
    return logFilePath;
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
