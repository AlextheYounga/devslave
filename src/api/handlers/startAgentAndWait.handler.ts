import { Role } from "../../constants";
import { AgentStatus } from "@prisma/client";
import StartAgentHandler from "./startAgent.handler";
import WatchAgentHandler from "./watchAgent.handler";

type StartAgentParams = {
    executionId: string;
    codebaseId: string;
    prompt: string;
    role: Role;
    debugMode?: boolean;
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

        // In debug mode, we do not watch the agent; just send back the start result
        if (this.params.debugMode) {
            return {
                ...startAgentResult,
                status: AgentStatus.COMPLETED,
            };
        }

        // Watch the agent until completion
        const agentId = startAgentResult.agentId;
        const watchHandler = new WatchAgentHandler(agentId);
        const result = await watchHandler.handle();

        return {
            ...startAgentResult,
            ...result,
        };
    }
}
