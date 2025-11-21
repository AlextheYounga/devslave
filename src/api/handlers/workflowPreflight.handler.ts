import { DEFAULT_APP_BASE_URL, DEFAULT_OLLAMA_BASE_URL } from "../../constants";

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

export class WorkflowPreflightHandler {
    constructor() {}

    async handle(): Promise<{ codebases: CodebaseSummary[]; models: OllamaModel[] }> {
        await this.checkDevslaveHealth();
        await this.checkOllamaHealth();
        const codebases = await this.fetchActiveCodebases();
        const models = await this.fetchOllamaModels();

        console.log(
            models.length
                ? `✅ Retrieved ${models.length} Ollama model(s).`
                : "⚠️ No Ollama models reported.",
        );

        return { codebases, models };
    }

    private async checkDevslaveHealth(): Promise<void> {
        console.log("🔍 Checking DevSlave API health...");
        const url = `${DEFAULT_APP_BASE_URL}/health`;
        const response = await makeRequest(url, { method: "GET" });
        await ensureOk(response, url);
        console.log("✅ DevSlave API is reachable.");
    }

    private async checkOllamaHealth(): Promise<void> {
        console.log("🔍 Checking Ollama health...");
        const response = await makeRequest(DEFAULT_OLLAMA_BASE_URL, { method: "GET" });
        await ensureOk(response, DEFAULT_OLLAMA_BASE_URL);
        console.log("✅ Ollama is reachable.");
    }

    private async fetchActiveCodebases(): Promise<CodebaseSummary[]> {
        console.log("🔍 Fetching Ollama models...");
        const url = `${DEFAULT_APP_BASE_URL}/api/codebases`;
        const response = await makeRequest(url, { method: "GET" });
        await ensureOk(response, url);
        const data = (await response.json()) as { data?: { codebases?: CodebaseSummary[] } };
        return data.data?.codebases ?? [];
    }

    private async fetchOllamaModels(): Promise<OllamaModel[]> {
        console.log("🔍 Fetching Ollama models...");
        const paths = ["/api/tags", "/tags"];
        const candidateBases = this.getOllamaCandidates();
        let lastError: Error | null = null;

        for (const base of candidateBases) {
            for (const path of paths) {
                const url = `${base}${path}`;
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
        }

        throw lastError ?? new Error("Failed to fetch Ollama models.");
    }

    private getOllamaCandidates(): string[] {
        const candidates = new Set<string>();
        candidates.add(DEFAULT_OLLAMA_BASE_URL);

        const normalized = DEFAULT_OLLAMA_BASE_URL.toLowerCase();
        if (normalized.includes("localhost") || normalized.includes("127.0.0.1")) {
            candidates.add("http://ollama:11434");
        } else if (normalized.includes("ollama")) {
            candidates.add("http://127.0.0.1:11434");
            candidates.add("http://localhost:11434");
        }

        return Array.from(candidates);
    }
}
