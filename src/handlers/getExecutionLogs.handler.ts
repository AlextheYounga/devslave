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

        // Prepare logs directory for potential debug output
        const logDir = join(paths.repoRoot, "logs");
        try {
            mkdirSync(logDir, { recursive: true });
        } catch {}

        // Read raw body first so we can optionally persist it for debugging
        let raw: string = "";
        try {
            raw = await response.text();
        } catch {
            // ignore text read errors
        }

        let payload: any;
        try {
            payload = raw ? JSON.parse(raw) : {};
        } catch {
            // Save raw body for inspection if JSON parsing fails
            const debugFile = join(
                logDir,
                `execution-${this.executionId}.response.json`,
            );
            try {
                writeFileSync(debugFile, raw || "", "utf-8");
            } catch {}
            throw new Error("Invalid JSON response from n8n");
        }

        // Support multiple n8n response shapes
        const runData: Record<string, any[]> | undefined =
            payload?.data?.resultData?.runData ??
            payload?.data?.executionData?.resultData?.runData ??
            payload?.resultData?.runData ??
            payload?.runData;

        const lines: string[] = [];
        if (runData && typeof runData === "object") {
            for (const [nodeName, executions] of Object.entries(runData)) {
                if (!Array.isArray(executions)) continue;
                for (const item of executions) {
                    const status =
                        item?.executionStatus ?? item?.status ?? "unknown";
                    const startRaw = item?.startTime ?? item?.startedAt ?? "";
                    const startTime =
                        startRaw !== undefined && startRaw !== null
                            ? String(startRaw)
                            : "";
                    lines.push(`${nodeName} ${status} ${startTime}`.trim());
                }
            }
        }

        // If nothing has been recorded in runData yet (common when execution is still running),
        // emit a minimal set of informative lines based on high-level status and current stack.
        if (lines.length === 0) {
            const execStatus: string | undefined = (
                payload?.status || payload?.data?.status
            )?.toString();
            const execStartedAt: string | number | undefined =
                payload?.startedAt || payload?.data?.startedAt;
            if (execStatus) {
                lines.push(
                    `Execution ${execStatus.toUpperCase()} ${execStartedAt ? String(execStartedAt) : ""}`.trim(),
                );
            }

            const stack: any[] | undefined =
                payload?.data?.executionData?.nodeExecutionStack;
            if (Array.isArray(stack)) {
                for (const entry of stack) {
                    const name: string =
                        entry?.node?.name || entry?.node?.id || "node";
                    lines.push(`${name} running`);
                }
            }
        }

        const outputLines = this.options.unique
            ? Array.from(new Set(lines))
            : lines;

        const logFile = join(logDir, `execution-${this.executionId}.log`);
        const shouldSaveResponse =
            String(process.env.N8N_SAVE_RESPONSE || "").toLowerCase() ===
                "true" || String(process.env.N8N_SAVE_RESPONSE) === "1";

        // Optionally save the full response for debugging, or always when no lines parsed
        if (shouldSaveResponse || outputLines.length === 0) {
            const debugFile = join(
                logDir,
                `execution-${this.executionId}.response.json`,
            );
            try {
                writeFileSync(
                    debugFile,
                    raw || JSON.stringify(payload),
                    "utf-8",
                );
            } catch {}
        }

        if (!this.options.skipWrite) {
            if (outputLines.length > 0) {
                writeFileSync(logFile, outputLines.join("\n"), "utf-8");
            } else {
                // Write a helpful placeholder when no entries are found
                const note =
                    `No runData entries found for execution ${this.executionId}. ` +
                    `Saved raw response to execution-${this.executionId}.response.json.`;
                try {
                    writeFileSync(logFile, note + "\n", "utf-8");
                } catch {}
            }
        }

        return {
            executionId: this.executionId,
            logFile,
            entries: outputLines.length,
            lines: outputLines,
        };
    }
}
