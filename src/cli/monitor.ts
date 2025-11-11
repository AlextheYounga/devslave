import inquirer from "inquirer";
import { prisma } from "../prisma";
import { Agent, AgentStatus } from "@prisma/client";
import GetExecutionLogsHandler from "../handlers/getExecutionLogs.handler";

export async function fetchRunningAgents(): Promise<Agent[]> {
    return prisma.agent.findMany({
        where: {
            status: {
                in: [
                    AgentStatus.PREPARING,
                    AgentStatus.LAUNCHED,
                    AgentStatus.RUNNING,
                ],
            },
        },
        orderBy: { createdAt: "desc" },
    });
}

type StreamOptions = {
    pollMs?: number;
    signal?: AbortSignal;
    onLines?: (lines: string[]) => void;
    onError?: (err: Error) => void;
};

/**
 * Polls GetExecutionLogsHandler and emits only new unique lines via onLines callback.
 * Resolves when the provided AbortSignal is aborted.
 */
export async function streamAgentLogs(
    executionId: string,
    options: StreamOptions = {},
): Promise<void> {
    const pollMs = options.pollMs ?? 2000;
    const seen = new Set<string>();
    let interval: NodeJS.Timeout | null = null;
    let inFlight = false;
    let stopped = false;

    const tick = async () => {
        if (stopped || inFlight) return;
        inFlight = true;
        try {
            const { lines } = await new GetExecutionLogsHandler(
                executionId,
            ).handle();
            const fresh = lines.filter((l) => {
                if (seen.has(l)) return false;
                seen.add(l);
                return true;
            });
            if (fresh.length && options.onLines) options.onLines(fresh);
        } catch (err: any) {
            if (options.onError) options.onError(err);
        } finally {
            inFlight = false;
        }
    };

    return new Promise<void>((resolve) => {
        const stop = () => {
            if (stopped) return;
            stopped = true;
            if (interval) clearInterval(interval);
            resolve();
        };

        if (options.signal) {
            if (options.signal.aborted) {
                stop();
                return;
            }
            options.signal.addEventListener("abort", stop, { once: true });
        }

        // Kick off immediately, then on interval
        void tick();
        interval = setInterval(tick, pollMs);
    });
}

export async function startMonitorAgentsFlow(): Promise<void> {
    const agents = await fetchRunningAgents();
    if (!agents.length) {
        console.log("\n⚠️  No running agents found.\n");
        return;
    }

    const choices = agents.map((a) => ({
        name: `${a.role ?? "unknown"} ${a.status} ${a.createdAt.toISOString()} (exec: ${a.executionId})`,
        value: a.id,
    }));

    const { agentId } = await inquirer.prompt<{ agentId: string }>([
        {
            type: "list",
            name: "agentId",
            message: "Select an agent to view logs:",
            choices: [
                ...choices,
                new inquirer.Separator(),
                { name: "Back", value: "__back" },
            ],
        },
    ]);

    if (agentId === "__back") return;

    const selected = agents.find((a) => a.id === agentId);
    if (!selected) {
        console.log("\n⚠️  Selected agent is no longer available.\n");
        return;
    }

    console.log("\n📜 Streaming logs (Ctrl+C to stop)\n");
    const ac = new AbortController();

    // Handle Ctrl+C to stop streaming and return to menu
    const onSig = () => {
        ac.abort();
        process.off("SIGINT", onSig);
    };
    process.on("SIGINT", onSig);

    await streamAgentLogs(selected.executionId, {
        pollMs: 2000,
        signal: ac.signal,
        onLines: (lines) => {
            for (const l of lines) console.log(l);
        },
        onError: (err) => {
            console.error("Error while fetching logs:", err.message);
        },
    });

    console.log("\n⏹️  Stopped streaming.\n");
}
