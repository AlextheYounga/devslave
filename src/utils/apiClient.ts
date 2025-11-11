import { randomUUID } from "crypto";

export type FetchRequestInit = {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
};

export type HttpResponse = {
    ok: boolean;
    status: number;
    statusText: string;
    json<T = unknown>(): Promise<T>;
    text(): Promise<string>;
};

type Fetcher = (url: string, init?: FetchRequestInit) => Promise<HttpResponse>;

const DEFAULT_APP_BASE_URL =
    process.env.APP_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:3000";
const DEFAULT_OLLAMA_BASE_URL =
    process.env.OLLAMA_BASE_URL?.replace(/\/$/, "") || "http://127.0.0.1:11434";

const nativeFetch =
    typeof fetch !== "undefined"
        ? (fetch.bind(globalThis) as unknown as Fetcher)
        : undefined;

const defaultFetch: Fetcher = async (url, init) => {
    if (!nativeFetch) {
        throw new Error("Fetch API is not available in this environment.");
    }
    return nativeFetch(url, init);
};

const defaultHeaders = {
    "Content-Type": "application/json",
};

function normalizeBaseUrl(base: string): string {
    return base.replace(/\/$/, "");
}

async function readBody(response: HttpResponse): Promise<string> {
    try {
        return await response.text();
    } catch {
        return "";
    }
}

async function requestJson<T>(
    fetcher: Fetcher,
    url: string,
    init: FetchRequestInit,
): Promise<T> {
    const response = await fetcher(url, init);
    if (!response.ok) {
        const body = await readBody(response);
        throw new Error(
            `Request to ${url} failed with status ${response.status} ${response.statusText}. ${body}`,
        );
    }
    return (await response.json()) as T;
}

async function requestJsonWithFallback<T>(
    fetcher: Fetcher,
    baseUrl: string,
    paths: string[],
): Promise<T> {
    let lastError: Error | null = null;

    for (const path of paths) {
        const url = `${baseUrl}${path}`;
        const response = await fetcher(url, { method: "GET" });

        if (response.ok) {
            return (await response.json()) as T;
        }

        const body = await readBody(response);
        const error = new Error(
            `Request to ${url} failed with status ${response.status} ${response.statusText}. ${body}`,
        );

        if (response.status !== 404) {
            throw error;
        }

        lastError = error;
    }

    throw lastError ?? new Error(`No successful response for ${paths.join(", ")}`);
}

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

export const createExecutionId = (prefix = "cli"): string => {
    return `${prefix}-${randomUUID()}`;
};

export async function checkDevslaveHealth(
    fetcher: Fetcher = defaultFetch,
    appBaseUrl = DEFAULT_APP_BASE_URL,
): Promise<void> {
    const base = normalizeBaseUrl(appBaseUrl);
    await requestJson(fetcher, `${base}/health`, { method: "GET" });
}

export async function checkOllamaHealth(
    fetcher: Fetcher = defaultFetch,
    ollamaBaseUrl = DEFAULT_OLLAMA_BASE_URL,
): Promise<void> {
    const base = normalizeBaseUrl(ollamaBaseUrl);
    const response = await fetcher(base, { method: "GET" });
    if (!response.ok) {
        const body = await readBody(response);
        throw new Error(
            `Request to ${base} failed with status ${response.status} ${response.statusText}. ${body}`,
        );
    }
}

export async function fetchOllamaModels(
    fetcher: Fetcher = defaultFetch,
    ollamaBaseUrl = DEFAULT_OLLAMA_BASE_URL,
): Promise<OllamaModel[]> {
    const base = normalizeBaseUrl(ollamaBaseUrl);
    const data = await requestJsonWithFallback<{ models?: OllamaModel[] }>(
        fetcher,
        base,
        ["/api/tags", "/tags"],
    );
    return data.models ?? [];
}

export async function fetchActiveCodebases(
    fetcher: Fetcher = defaultFetch,
    appBaseUrl = DEFAULT_APP_BASE_URL,
): Promise<CodebaseSummary[]> {
    const base = normalizeBaseUrl(appBaseUrl);
    const data = await requestJson<{
        data?: { codebases?: CodebaseSummary[] };
    }>(fetcher, `${base}/api/codebases`, { method: "GET" });
    return data.data?.codebases ?? [];
}

export async function setupCodebase(
    payload: SetupCodebasePayload,
    fetcher: Fetcher = defaultFetch,
    appBaseUrl = DEFAULT_APP_BASE_URL,
): Promise<any> {
    const base = normalizeBaseUrl(appBaseUrl);
    return requestJson(fetcher, `${base}/api/codebase/setup`, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(payload),
    });
}

export async function triggerWebhook(
    url: string,
    payload: Record<string, unknown>,
    fetcher: Fetcher = defaultFetch,
): Promise<void> {
    const response = await fetcher(url, {
        method: "POST",
        headers: defaultHeaders,
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const body = await readBody(response);
        throw new Error(
            `Webhook request to ${url} failed with status ${response.status} ${response.statusText}. ${body}`,
        );
    }
}

export type AgentPreflightOptions = {
    appBaseUrl?: string;
    ollamaBaseUrl?: string;
};

export async function runAgentPreflight(
    fetcher: Fetcher = defaultFetch,
    options: AgentPreflightOptions = {},
): Promise<{ models: OllamaModel[] }> {
    const appBase = options.appBaseUrl ?? DEFAULT_APP_BASE_URL;
    const ollamaBase = options.ollamaBaseUrl ?? DEFAULT_OLLAMA_BASE_URL;

    await checkDevslaveHealth(fetcher, appBase);
    await checkOllamaHealth(fetcher, ollamaBase);
    const models = await fetchOllamaModels(fetcher, ollamaBase);

    return { models };
}
