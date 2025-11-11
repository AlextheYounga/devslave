import dotenv from "dotenv";
import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { paths } from "../constants";

if (process.env.NODE_ENV !== "test") {
    dotenv.config();
}

export type ExecutionLogsResult = {
    executionId: string;
    logFile: string;
    entries: number;
    lines: string[];
};

type GetLogsOptions = {
    unique?: boolean; // when true, de-duplicate lines in-memory
    skipWrite?: boolean; // when true, do not write to filesystem
};

export default class GetExecutionLogsHandler {
    private executionId: string;
    private options: GetLogsOptions;

    constructor(executionId: string, options: GetLogsOptions = {}) {
        this.executionId = executionId;
        this.options = options;
    }

    async handle(): Promise<ExecutionLogsResult> {
        const base = process.env.N8N_BASE_URL?.replace(/\/+$/, "");
        const apiKey = process.env.N8N_API_KEY;

        const missing: string[] = [];
        if (!base) missing.push("N8N_BASE_URL");
        if (!apiKey) missing.push("N8N_API_KEY");
        if (missing.length) {
            throw new Error(`Missing required env vars: ${missing.join(", ")}`);
        }

        const url = `${base}/api/v1/executions/${this.executionId}?includeData=true`;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);

        let response: any;
        try {
            response = await fetch(url, {
                method: "GET",
                headers: { "X-N8N-API-KEY": apiKey! },
                signal: controller.signal,
            } as RequestInit);
        } catch (err: any) {
            clearTimeout(timeout);
            const reason =
                err?.name === "AbortError" ? "timeout" : err?.message;
            throw new Error(
                `Failed to fetch n8n execution ${this.executionId} from ${base}: ${reason}`,
            );
        }

        clearTimeout(timeout);

        if (!response || response.ok !== true) {
            let body = "";
            try {
                if (response && typeof response.text === "function") {
                    body = await response.text();
                }
            } catch {
                // ignore body read errors
            }
            const suffix = body ? ` ${body}` : "";
            throw new Error(
                `Request to ${url} failed${
                    response
                        ? ` with status ${response.status} ${response.statusText}.`
                        : "."
                }${suffix}`,
            );
        }

        let payload: any;
        try {
            payload = await response.json();
        } catch {
            throw new Error("Invalid JSON response from n8n");
        }

        const runData: Record<string, any[]> | undefined =
            payload?.data?.resultData?.runData;

        const lines: string[] = [];
        if (runData && typeof runData === "object") {
            for (const [nodeName, executions] of Object.entries(runData)) {
                if (!Array.isArray(executions)) continue;
                for (const item of executions) {
                    const status = item?.executionStatus ?? "unknown";
                    const startTime =
                        item?.startTime !== undefined &&
                        item?.startTime !== null
                            ? String(item.startTime)
                            : "";
                    lines.push(`${nodeName} ${status} ${startTime}`.trim());
                }
            }
        }

        const outputLines = this.options.unique
            ? Array.from(new Set(lines))
            : lines;

        const logDir = join(paths.repoRoot, "logs");
        try {
            mkdirSync(logDir, { recursive: true });
        } catch {
            // best effort; writeFileSync will throw if directory truly invalid
        }

        const logFile = join(logDir, `execution-${this.executionId}.log`);
        if (!this.options.skipWrite) {
            writeFileSync(logFile, outputLines.join("\n"), "utf-8");
        }

        return {
            executionId: this.executionId,
            logFile,
            entries: outputLines.length,
            lines: outputLines,
        };
    }
}
