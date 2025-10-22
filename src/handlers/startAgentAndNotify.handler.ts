import dotenv from "dotenv";
import { Role } from "../constants";
import StartAgentHandler from "./startAgent.handler";
import WatchAgentHandler from "./watchAgent.handler";
import { AgentCallbackRequestSent, AgentCompleted, AgentFailed } from "../events";
dotenv.config();

type StartAgentWithCallbackParams = {
  executionId: string;
  callbackUrl: string;
  codebaseId: string;
  prompt: string;
  role: Role;
};

export default class StartAgentAndNotifyHandler {
  public params: StartAgentWithCallbackParams;
  public callbackUrl: string;

  constructor(params: StartAgentWithCallbackParams) {
    this.params = params;
    this.callbackUrl = params.callbackUrl;
  }

  async handle(): Promise<void> {
    // Start the agent process
    const agentHandler = new StartAgentHandler(this.params);
    const startAgentResult = await agentHandler.handle();
    const agentId = startAgentResult.agentId;

    // Watch the agent until completion
    const watchHandler = new WatchAgentHandler(agentId);
    const result = await watchHandler.handle();

    const agentRunData = {
      ...startAgentResult,
      ...result,
    };

    // Send callback notification
    await this.sendCallback(agentRunData);
  }

  private async sendCallback(data: any): Promise<void> {
    try {
      const response = await fetch(this.callbackUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      new AgentCallbackRequestSent({
        ...this.params,
        statusCode: response.status,
        success: response.ok,
      }).publish();

      if (!response.ok) {
        console.error(
          `Callback request failed: ${response.status} ${response.statusText}`
        );
      }
    } catch (error) {
      console.error("Error sending callback:", error);
      new AgentCallbackRequestSent({
        ...this.params,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }).publish();
    }
  }
}
