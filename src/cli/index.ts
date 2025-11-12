import dotenv from "dotenv";
import inquirer from "inquirer";
import { spawn } from "child_process";
import { join } from "path";
import { homedir, tmpdir } from "os";
import { promises as fs } from "fs";
import { AgentStatus, TicketStatus } from "@prisma/client";
import { prisma } from "../prisma";
import { promptMainMenu, promptUtilitiesMenu } from "./menus";
import { handleAgentWorkflow, handleCreateProjectFlow } from "./workflows";
import { eventMatchesAgentIdentifiers, formatEventsForLogFile } from "./logs";

dotenv.config();

async function runCommand(command: string, args: string[] = [], options = {}): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: "inherit",
            shell: true,
            ...options,
        });

        proc.on("close", (code) => {
            if (code !== 0) {
                reject(new Error(`Command exited with code ${code}`));
            } else {
                resolve();
            }
        });

        proc.on("error", (err) => {
            reject(err);
        });
    });
}

async function handleDownloadProject(): Promise<void> {
    try {
        const codebases = await prisma.codebase.findMany();

        if (codebases.length === 0) {
            console.log("\n⚠️  No codebases found in the database.\n");
            return;
        }

        const codebaseChoices = codebases.map((cb) => ({
            name: `${cb.name} (${cb.path})`,
            value: cb,
        }));

        const { selectedCodebase } = await inquirer.prompt([
            {
                type: "list",
                name: "selectedCodebase",
                message: "Select a codebase to download:",
                choices: codebaseChoices,
            },
        ]);

        const projectName = selectedCodebase.name.replace(/\s+/g, "-");
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const zipFileName = `${projectName}-${timestamp}.zip`;
        const containerZipPath = `/tmp/${zipFileName}`;
        const hostDestination = join(homedir(), zipFileName);

        console.log(`\n📦 Creating archive of ${selectedCodebase.name}...`);
        await runCommand("docker", [
            "exec",
            "devslave-app-1",
            "zip",
            "-r",
            containerZipPath,
            selectedCodebase.path,
            "-q",
        ]);

        console.log(`\n📥 Copying to ${hostDestination}...`);
        await runCommand("docker", ["cp", `devslave-app-1:${containerZipPath}`, hostDestination]);

        console.log(`\n🧹 Cleaning up temporary files...`);
        await runCommand("docker", ["exec", "devslave-app-1", "rm", containerZipPath]);

        console.log(`\n✅ Project downloaded successfully to: ${hostDestination}\n`);
    } catch (error) {
        console.error("\n❌ Download failed:", (error as Error).message);
        throw error;
    }
}

type AgentMetadata = {
    codebaseId?: string;
    codebaseName?: string;
};

type AgentWithCodebase = Awaited<ReturnType<typeof prisma.agent.findMany>>[number];

function extractAgentMetadata(agent: { data: unknown }): AgentMetadata {
    if (!agent?.data || typeof agent.data !== "object") {
        return {};
    }

    const data = agent.data as Record<string, unknown>;
    const nestedCodebase =
        data["codebase"] && typeof data["codebase"] === "object"
            ? (data["codebase"] as Record<string, unknown>)
            : undefined;

    const codebaseId =
        typeof data["codebaseId"] === "string"
            ? (data["codebaseId"] as string)
            : typeof nestedCodebase?.["id"] === "string"
              ? (nestedCodebase["id"] as string)
              : undefined;

    const codebaseName =
        typeof data["codebaseName"] === "string"
            ? (data["codebaseName"] as string)
            : typeof nestedCodebase?.["name"] === "string"
              ? (nestedCodebase["name"] as string)
              : undefined;

    const metadata: AgentMetadata = {};
    if (codebaseId) {
        metadata.codebaseId = codebaseId;
    }
    if (codebaseName) {
        metadata.codebaseName = codebaseName;
    }
    return metadata;
}

type AgentActionChoice = "tmux" | "logs" | "back";

async function promptAgentAction(agentLabel: string): Promise<AgentActionChoice> {
    const { action } = await inquirer.prompt<{ action: AgentActionChoice }>([
        {
            type: "list",
            name: "action",
            message: `${agentLabel}\nWhat would you like to do?`,
            choices: [
                { name: "View tmux session", value: "tmux" },
                { name: "View logs", value: "logs" },
                { name: "Back to running agents", value: "back" },
            ],
        },
    ]);
    return action;
}

async function attachToAgentTmux(agent: AgentWithCodebase): Promise<void> {
    const sessionName = agent.tmuxSession?.trim() || `agent_${agent.id}`;

    console.log(`\n🔌 Attaching to tmux session ${sessionName}...\n`);

    try {
        await runCommand("docker", [
            "exec",
            "-it",
            "devslave-app-1",
            "tmux",
            "attach",
            "-t",
            sessionName,
        ]);
    } catch (error) {
        console.error("\n❌ Failed to attach to tmux session:", (error as Error).message);
    }
}

async function viewAgentLogs(agent: AgentWithCodebase): Promise<void> {
    const executionId = agent.executionId;

    console.log("\n📜 Gathering event logs...\n");
    const events = await prisma.events.findMany({
        orderBy: { timestamp: "asc" },
    });

    const relevantEvents = events.filter((event) =>
        eventMatchesAgentIdentifiers(event.data, agent.id, executionId),
    );

    if (!relevantEvents.length) {
        console.log("\n⚠️  No events found for this agent.\n");
        return;
    }

    const logFilePath = join(tmpdir(), `devslave-agent-${agent.id}-${Date.now()}.log`);
    const logContent = formatEventsForLogFile(relevantEvents);

    await fs.writeFile(logFilePath, logContent, "utf-8");

    try {
        await runCommand("less", [logFilePath]);
    } catch (error) {
        console.error("\n❌ Failed to open log viewer:", (error as Error).message);
    } finally {
        await fs.unlink(logFilePath).catch(() => {});
    }
}

async function handleViewRunningAgents(): Promise<void> {
    const runningStatuses = [AgentStatus.PREPARING, AgentStatus.LAUNCHED, AgentStatus.RUNNING];

    const agents = await prisma.agent.findMany({
        where: {
            status: {
                in: runningStatuses,
            },
        },
        orderBy: {
            createdAt: "desc",
        },
        include: {
            codebase: {
                select: {
                    id: true,
                    name: true,
                },
            },
        },
    });

    if (agents.length === 0) {
        console.log("\n⚠️  No running agents found.\n");
        return;
    }

    const codebaseIds = Array.from(
        new Set(agents.map((agent) => agent.codebaseId).filter((id): id is string => Boolean(id))),
    );

    const activeTicketMap = new Map<string, Awaited<ReturnType<typeof prisma.ticket.findFirst>>>();

    if (codebaseIds.length) {
        const tickets = await Promise.all(
            codebaseIds.map((codebaseId) =>
                prisma.ticket.findFirst({
                    where: {
                        codebaseId,
                        status: { not: TicketStatus.CLOSED },
                    },
                    orderBy: {
                        createdAt: "asc",
                    },
                }),
            ),
        );

        tickets.forEach((ticket, index) => {
            if (ticket) {
                activeTicketMap.set(codebaseIds[index]!, ticket);
            }
        });
    }

    const agentLabelMap = new Map<string, string>();

    const agentChoices = agents.map((agent) => {
        const metadata = extractAgentMetadata(agent);

        const resolvedCodebaseId = agent.codebaseId ?? metadata.codebaseId;
        const resolvedCodebaseName =
            agent.codebase?.name ??
            metadata.codebaseName ??
            (resolvedCodebaseId ? `Codebase ${resolvedCodebaseId}` : null) ??
            "unknown codebase";

        const ticket = resolvedCodebaseId ? activeTicketMap.get(resolvedCodebaseId) : undefined;
        const ticketLabel = ticket ? ` • Ticket ${ticket.ticketId}` : "";

        const label = `[${agent.status}] ${agent.role ?? "unknown role"} • ${resolvedCodebaseName}${ticketLabel} (${agent.id})`;
        agentLabelMap.set(agent.id, label);

        return {
            name: label,
            value: agent.id,
        };
    });

    agentChoices.push({
        name: "Back to Main Menu",
        value: "back",
    });

    const { selectedAgentId } = await inquirer.prompt<{
        selectedAgentId: string;
    }>([
        {
            type: "list",
            name: "selectedAgentId",
            message: "Select an agent to attach:",
            choices: agentChoices,
        },
    ]);

    if (selectedAgentId === "back") {
        return;
    }

    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);

    if (!selectedAgent) {
        console.log("\n❌ Selected agent not found.\n");
        return;
    }

    const agentLabel =
        agentLabelMap.get(selectedAgent.id) ??
        `[${selectedAgent.status}] ${selectedAgent.role ?? "Agent"} (${selectedAgent.id})`;

    while (true) {
        const action = await promptAgentAction(agentLabel);
        if (action === "back") {
            return;
        }

        if (action === "tmux") {
            await attachToAgentTmux(selectedAgent);
            return;
        }

        if (action === "logs") {
            await viewAgentLogs(selectedAgent);
        }
    }
}

async function handleUtilityChoice(choice: string): Promise<void> {
    const rootDir = join(__dirname, "..", "..");

    switch (choice) {
        case "app-shell":
            console.log("\n🐚 Launching App Shell...\n");
            await runCommand(join(rootDir, "docker/dev-container.sh"));
            break;

        case "start-docker":
            console.log("\n🐳 Starting Docker...\n");
            await runCommand(join(rootDir, "docker/start.sh"));
            break;

        case "open-n8n":
            console.log("\n🌐 Opening n8n...\n");
            await runCommand("open", ["http://127.0.0.1:5678/"]);
            break;

        case "open-vscode":
            console.log("\n💻 Opening Agent Container in VS Code...\n");
            await runCommand(join(rootDir, "docker/vscode-remote.sh"));
            break;

        case "download-project":
            console.log("\n📦 Download Project...\n");
            await handleDownloadProject();
            break;

        default:
            console.log("Unknown utility option");
    }
}

async function handleUtilitiesMenu(): Promise<void> {
    const choice = await promptUtilitiesMenu();
    if (choice === "back") {
        return;
    }
    await handleUtilityChoice(choice);
}

export async function startCli(): Promise<void> {
    console.log("\n🛠️  DevSlave CLI\n");

    while (true) {
        const action = await promptMainMenu();

        try {
            switch (action) {
                case "create-project":
                    await handleCreateProjectFlow();
                    break;
                case "view-running-agents":
                    await handleViewRunningAgents();
                    break;
                case "start-agent-workflow":
                    await handleAgentWorkflow();
                    break;
                case "utilities":
                    await handleUtilitiesMenu();
                    break;
                case "exit":
                    console.log("\n👋 Goodbye!\n");
                    process.exit(0);
                default:
                    console.log("Unknown option");
            }
        } catch (error) {
            console.error("\n❌ Error:", (error as Error).message);
        }
    }
}
