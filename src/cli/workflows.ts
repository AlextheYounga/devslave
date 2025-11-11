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
import { AgentWorkflowKey, SETUP_OPTIONS, WORKFLOW_CONFIG } from "./menus";

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

    return models;
}

function getWebhookUrl(key: AgentWorkflowKey): string {
    const config = WORKFLOW_CONFIG[key];
    const url = process.env[config.envVar];
    if (!url) {
        throw new Error(`Missing ${config.envVar} environment variable.`);
    }
    return url;
}

export async function handleAgentWorkflow(
    key: AgentWorkflowKey,
): Promise<void> {
    const config = WORKFLOW_CONFIG[key];
    console.log(`\n🚦 Running pre-flight checks for ${config.label}...\n`);
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
        role: config.role,
    };

    const webhookUrl = getWebhookUrl(key);
    console.log(
        `\n📨 Sending workflow payload to ${config.label} webhook...\n`,
    );
    const response = await triggerWebhook(webhookUrl, payload);
    console.log(`\n✅ ${config.label} workflow triggered successfully.`);

    const executionData =
        response && typeof response === "object"
            ? (response as { executionId?: string; executionUrl?: string })
            : {};
    if (executionData.executionId) {
        console.log(`Execution ID: ${executionData.executionId}`);
    }
    if (executionData.executionUrl) {
        console.log(`Execution URL: ${executionData.executionUrl}`);
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

    console.log("\n🔧 Submitting project setup request...\n");
    const response = await setupCodebase(payload);
    const message =
        response?.message ??
        `Project "${payload.name}" setup request submitted successfully.`;
    console.log(`\n✅ ${message}\n`);
    if (response?.data?.stdout) {
        console.log(response.data.stdout);
    }
}
