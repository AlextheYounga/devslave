import { randomUUID } from "crypto";
import { WorkflowTriggerFailed, WorkflowTriggerStarted, WorkflowTriggerSucceeded } from "../events";
import {
    AGENT_FOLDER_NAME,
    DEFAULT_APP_BASE_URL,
    DEFAULT_OLLAMA_BASE_URL,
    WEBHOOK_URL,
} from "../constants";

export type TriggerWorkflowParams = {
    codebaseId: string;
    codebaseName: string;
    codebasePath: string;
    model?: string | undefined;
    debugMode: boolean;
};

type WebhookPayload = TriggerWorkflowParams & {
    agentFolderName: string;
};

export type OllamaModel = {
    name?: string;
    model?: string;
    modified_at?: string;
    size?: number;
};

export type CodebaseSummary = {
    id: string;
    name: string;
    path: string;
};

export type SetupCodebasePayload = {
    executionId: string;
    name: string;
    folderName: string;
    prompt: string;
    setup?: string;
};

async function readBody(response: Response): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "";
    }
}

async function ensureOk(response: Response, url: string): Promise<void> {
    if (!response.ok) {
        const body = await readBody(response);
        const suffix = body ? ` ${body}` : "";
        throw new Error(
            `Request to ${url} failed with status ${response.status} ${response.statusText}.${suffix}`,
        );
    }
}

async function makeRequest(url: string, init: RequestInit): Promise<Response> {
    try {
        return await fetch(url, init);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Request to ${url} failed: ${message}`);
    }
}

export default class TriggerWorkflowHandler {
    private params: TriggerWorkflowParams;

    constructor(params: TriggerWorkflowParams) {
        this.params = params;
    }

    async handle(): Promise<unknown> {
        await this.runAgentPreflight();

        const payload: WebhookPayload = {
            ...this.params,
            agentFolderName: AGENT_FOLDER_NAME,
        };
        const eventContext = {
            webhookUrl: WEBHOOK_URL,
            ...payload,
        };

        await new WorkflowTriggerStarted(eventContext).publish();

        try {
            const response = await this.postWebhook(payload);
            await new WorkflowTriggerSucceeded({
                ...eventContext,
                response,
            }).publish();
            return response;
        } catch (error) {
            await new WorkflowTriggerFailed({
                ...eventContext,
                error: error instanceof Error ? error.message : String(error),
            }).publish();
            throw error;
        }
    }

    private async runAgentPreflight(): Promise<{ models: OllamaModel[] }> {
        await this.checkDevslaveHealth();
        await this.checkOllamaHealth();
        const models = await this.fetchOllamaModels();

        return { models };
    }

    private async setupCodebase(payload: SetupCodebasePayload): Promise<any> {
        const url = `${DEFAULT_APP_BASE_URL}/api/codebase/setup`;
        const response = await makeRequest(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });
        await ensureOk(response, url);
        try {
            return await response.json();
        } catch {
            return undefined;
        }
    }

    private async checkDevslaveHealth(): Promise<void> {
        const url = `${DEFAULT_APP_BASE_URL}/health`;
        const response = await makeRequest(url, { method: "GET" });
        await ensureOk(response, url);
    }

    private async checkOllamaHealth(): Promise<void> {
        const response = await makeRequest(DEFAULT_OLLAMA_BASE_URL, { method: "GET" });
        await ensureOk(response, DEFAULT_OLLAMA_BASE_URL);
    }

    private async fetchActiveCodebases(): Promise<CodebaseSummary[]> {
        const url = `${DEFAULT_APP_BASE_URL}/api/codebases`;
        const response = await makeRequest(url, { method: "GET" });
        await ensureOk(response, url);
        const data = (await response.json()) as { data?: { codebases?: CodebaseSummary[] } };
        return data.data?.codebases ?? [];
    }

    private async fetchOllamaModels(): Promise<OllamaModel[]> {
        const paths = ["/api/tags", "/tags"];
        let lastError: Error | null = null;

        for (const path of paths) {
            const url = `${DEFAULT_OLLAMA_BASE_URL}${path}`;
            let response: Response;
            try {
                response = await makeRequest(url, { method: "GET" });
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error));
                continue;
            }

            if (response.ok) {
                const data = (await response.json()) as { models?: OllamaModel[] };
                return data.models ?? [];
            }

            if (response.status !== 404) {
                const body = await readBody(response);
                const suffix = body ? ` ${body}` : "";
                throw new Error(
                    `Request to ${url} failed with status ${response.status} ${response.statusText}.${suffix}`,
                );
            }

            lastError = new Error(`Request to ${url} failed with status 404 Not Found.`);
        }

        throw lastError ?? new Error("Failed to fetch Ollama models.");
    }

    private async postWebhook(payload: WebhookPayload): Promise<unknown> {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const rawBody = await readBody(response);

        if (!response.ok) {
            const suffix = rawBody ? ` ${rawBody}` : "";
            throw new Error(
                `Webhook request to ${WEBHOOK_URL} failed with status ${response.status} ${response.statusText}.${suffix}`,
            );
        }

        if (!rawBody) {
            return undefined;
        }

        try {
            return JSON.parse(rawBody);
        } catch {
            return rawBody;
        }
    }
}
