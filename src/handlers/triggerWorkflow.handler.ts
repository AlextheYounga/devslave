import { prisma } from "../prisma";
import { PrismaClient } from "@prisma/client";
import { WorkflowTriggerFailed, WorkflowTriggerStarted, WorkflowTriggerSucceeded } from "../events";
import { AGENT_FOLDER_NAME, WEBHOOK_URL } from "../constants";

export type TriggerWorkflowParams = {
    codebaseId: string;
    model?: string | undefined;
    debugMode: boolean;
};

type WebhookPayload = TriggerWorkflowParams & {
    codebaseId: string;
    codebaseName: string;
    codebasePath: string;
    model?: string | undefined;
    debugMode: boolean;
    agentFolderName: string;
};

export class TriggerWorkflowHandler {
    private params: TriggerWorkflowParams;
    private db: PrismaClient;

    constructor(params: TriggerWorkflowParams) {
        this.db = prisma;
        this.params = params;
    }

    async handle(): Promise<unknown> {
        const codebase = await this.db.codebase.findUniqueOrThrow({
            where: { id: this.params.codebaseId },
        });

        const payload: WebhookPayload = {
            ...this.params,
            codebaseName: codebase.name,
            codebasePath: codebase.path,
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

    private async postWebhook(payload: WebhookPayload): Promise<unknown> {
        const response = await fetch(WEBHOOK_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
        });

        const rawBody = await response.text();

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
