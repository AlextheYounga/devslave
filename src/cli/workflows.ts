import inquirer from "inquirer";
import {
    checkDevslaveHealth,
    checkOllamaHealth,
    fetchActiveCodebases,
    fetchOllamaModels,
    setupCodebase,
    triggerWebhook,
    createExecutionId,
    type CodebaseSummary,
    type OllamaModel,
} from "../utils/apiClient";
import { SETUP_OPTIONS } from "./menus";

function requireInput(fieldLabel: string) {
    return (value: string) => {
        if (!value || !value.trim()) {
            return `${fieldLabel} is required.`;
        }
        return true;
    };
}

function modelNames(models: OllamaModel[]): string[] {
    return models
        .map((model) => model.name || model.model)
        .filter((name): name is string => Boolean(name));
}

type AgentFormAnswers = {
    codebaseId: string;
    model: string;
    debugMode: boolean;
};

async function promptAgentForm(
    codebases: CodebaseSummary[],
    models: OllamaModel[],
) {
    const codebaseChoices = codebases.map((cb) => ({
        name: `${cb.name} (${cb.path})`,
        value: cb.id,
    }));

    const modelsList = modelNames(models);
    const modelQuestion =
        modelsList.length > 0
            ? {
                  type: "list",
                  name: "model",
                  message: "Select an Ollama model:",
                  choices: [
                      { name: "Use default model", value: "" },
                      ...modelsList.map((name) => ({
                          name,
                          value: name,
                      })),
                  ],
              }
            : {
                  type: "input",
                  name: "model",
                  message: "Model (leave blank for default):",
                  filter: (input: string) => input.trim(),
              };

    const questions = [
        {
            type: "list",
            name: "codebaseId",
            message: "Select a codebase to work on:",
            choices: codebaseChoices,
        },
        modelQuestion,
        {
            type: "confirm",
            name: "debugMode",
            message: "Enable debug mode?",
            default: false,
        },
    ] as any;

    return inquirer.prompt<AgentFormAnswers>(questions);
}

async function runPreflightWithLogs(): Promise<OllamaModel[]> {
    console.log("🔍 Checking DevSlave API health...");
    await checkDevslaveHealth();
    console.log("✅ DevSlave API is reachable.");

    console.log("🔍 Checking Ollama health...");
    await checkOllamaHealth();
    console.log("✅ Ollama is reachable.");

    console.log("🔍 Fetching Ollama models...");
    const models = await fetchOllamaModels();
    console.log(
        models.length
            ? `✅ Retrieved ${models.length} Ollama model(s).`
            : "⚠️ No Ollama models reported.",
    );
    console.log("");

    return models;
}

const MASTER_WEBHOOK_ENV = "N8N_MASTER_WEBHOOK_URL";

export function getMasterWorkflowWebhookUrl(
    env: NodeJS.ProcessEnv = process.env,
): string {
    const url = env[MASTER_WEBHOOK_ENV]?.trim();
    if (!url) {
        throw new Error(`Missing ${MASTER_WEBHOOK_ENV} environment variable.`);
    }
    return url;
}

export async function handleAgentWorkflow(): Promise<void> {
    console.log(`\n🚦 Running pre-flight checks for Master Workflow...\n`);
    const models = await runPreflightWithLogs();

    const codebases = await fetchActiveCodebases();
    if (!codebases.length) {
        console.log(
            "\n⚠️  No active codebases found. Please create a project before starting agents.\n",
        );
        return;
    }

    const answers = await promptAgentForm(codebases, models);
    const codebase = codebases.find((cb) => cb.id === answers.codebaseId);
    if (!codebase) {
        throw new Error("Selected codebase is no longer available.");
    }

    const payload = {
        codebaseId: codebase.id,
        codebaseName: codebase.name,
        model: answers.model || undefined,
        debugMode: answers.debugMode,
    };

    const webhookUrl = getMasterWorkflowWebhookUrl();
    console.log(`\n📨 Sending workflow payload to Master Workflow webhook...`);
    const response = await triggerWebhook(webhookUrl, payload);
    console.log(`\n✅ Master workflow triggered successfully.`);

    const executionData =
        response && typeof response === "object"
            ? (response as { executionId?: string; executionUrl?: string })
            : {};

    if (executionData.executionUrl) {
        console.log(`Execution URL: ${executionData.executionUrl}`);

        // Open execution URL in system default browser
        const { exec } = await import("child_process");
        const { promisify } = await import("util");
        const execAsync = promisify(exec);

        const openCommand =
            process.platform === "darwin"
                ? "open"
                : process.platform === "win32"
                  ? "start"
                  : "xdg-open";

        try {
            await execAsync(
                `${openCommand} http://${executionData.executionUrl}`,
            );
            console.log("\n");
        } catch (error) {
            console.warn("⚠️  Could not open browser automatically.");
        }
    }
}

export async function handleCreateProjectFlow(): Promise<void> {
    console.log("\n🆕 Create Project\n");
    const answers = await inquirer.prompt<{
        name: string;
        projectFolder: string;
        setup: string;
        masterPrompt: string;
    }>([
        {
            type: "input",
            name: "name",
            message: "Project name:",
            validate: requireInput("Project name"),
            filter: (input: string) => input.trim(),
        },
        {
            type: "input",
            name: "projectFolder",
            message: "Project folder (relative to /app/dev):",
            validate: requireInput("Project folder"),
            filter: (input: string) => input.trim(),
        },
        {
            type: "list",
            name: "setup",
            message: "Setup type:",
            choices: SETUP_OPTIONS,
            default: "default",
        },
        {
            type: "editor",
            name: "masterPrompt",
            message:
                "Master prompt (an editor will open; save and exit to continue):",
            validate: requireInput("Master prompt"),
            filter: (input: string) => input.trim(),
        },
    ]);

    const payload = {
        executionId: createExecutionId("create-project"),
        name: answers.name,
        folderName: answers.projectFolder,
        prompt: answers.masterPrompt,
        setup: answers.setup,
    };

    console.log("\n🔧 Setting up project...\n");
    const response = await setupCodebase(payload);
    const message =
        response?.message ??
        `Project "${payload.name}" setup request submitted successfully.`;
    console.log(`\n✅ ${message}\n`);
    if (response?.data?.stdout) {
        console.log(response.data.stdout);
    }
}
