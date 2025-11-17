import { Role } from "../../constants";
import StartAgentHandler from "./startAgent.handler";
import WatchAgentHandler from "./watchAgent.handler";
import { AgentCallbackRequestSent, AgentCompleted, AgentFailed } from "../../events";

type StartAgentWithCallbackParams = {
    executionId: string;
    callbackUrl: string;
    codebaseId: string;
    prompt: string;
    role: Role;
    debugMode?: boolean;
};

export default class StartAgentAndNotifyHandler {
    public params: StartAgentWithCallbackParams;
    public callbackUrl: string;

    constructor(params: StartAgentWithCallbackParams) {
        this.params = params;
        this.callbackUrl = this.dockerUrlContext(params.callbackUrl);
    }

    async handle(): Promise<void> {
        // Start the agent process
        const agentHandler = new StartAgentHandler(this.params);
        const startAgentResult = await agentHandler.handle();

        if (this.params.debugMode) {
            // In debug mode, we do not watch the agent; just send back the start result
            await this.sendCallback(startAgentResult);
            return;
        }

        // Watch the agent until completion
        const agentId = startAgentResult.agentId;
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
            console.log(`Sending callback to ${this.callbackUrl} with data:`, data);
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
                console.error(`Callback request failed: ${response.status} ${response.statusText}`);
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

    private dockerUrlContext(url: string): string {
        // If webhook URL is pointing to N8N, we should use the Docker internal hostname
        if (url.includes("localhost:5678")) {
            return url.replace("localhost:5678", "n8n:5678");
        }
        return url;
    }
}
