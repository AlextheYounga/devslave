import dotenv from "dotenv";
import { Role } from "../constants";
import StartAgentHandler from "./startAgent.handler";
import WatchAgentHandler from "../handlers/watchAgent.handler";
dotenv.config();

type StartAgentParams = {
  executionId: string;
  codebaseId: string;
  prompt: string;
  role: Role;
};

export default class StartAgentAndWaitHandler {
  public params: StartAgentParams;

  constructor(params: StartAgentParams) {
    this.params = params;
  }

  async handle() {
    // Start the agent process
    const agentHandler = new StartAgentHandler(this.params);
    const startAgentResult = await agentHandler.handle();
    const agentId = startAgentResult.agentId;
    
    // Watch the agent until completion
    const watchHandler = new WatchAgentHandler(agentId);
    const result = await watchHandler.handle();

    return {
        ...startAgentResult,
        ...result,
    }
  }
}
