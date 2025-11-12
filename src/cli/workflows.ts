import inquirer from "inquirer";
import { promises as fsPromises, existsSync, statSync } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import { spawn } from "child_process";
import {
    OllamaModel,
    CodebaseSummary,
    WorkflowPreflightHandler,
} from "../handlers/workflowPreflight.handler";
import { TriggerWorkflowHandler } from "../handlers/triggerWorkflow.handler";
import {
    AGENT_FOLDER_NAME,
    N8N_URL,
    APP_CONTAINER_NAME,
    paths,
    DEFAULT_APP_BASE_URL,
} from "../constants";
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

async function promptAgentForm(codebases: CodebaseSummary[], models: OllamaModel[]) {
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

function sanitizeProjectFolder(folder: string): string {
    return folder.replace(/^\/+/, "").replace(/\/+$/, "");
}

function expandUserPath(sourcePath: string): string {
    if (!sourcePath) {
        return sourcePath;
    }
    if (sourcePath === "~") {
        return os.homedir();
    }
    if (sourcePath.startsWith("~/")) {
        return path.join(os.homedir(), sourcePath.slice(2));
    }
    return sourcePath;
}

function escapeForDoubleQuotes(value: string): string {
    return value.replace(/["$`\\]/g, "\\$&");
}

export function buildContainerProjectPath(
    projectFolder: string,
    workspaceRoot = paths.devWorkspace,
): string {
    const workspace = workspaceRoot.replace(/\/+$/, "");
    const sanitizedFolder = sanitizeProjectFolder(projectFolder);
    return `${workspace}/${sanitizedFolder}`;
}

export async function ensureImportSourceDirectory(sourcePath: string): Promise<string> {
    const expandedPath = expandUserPath(sourcePath);
    const resolvedPath = path.resolve(expandedPath);
    const stats = await fsPromises.stat(resolvedPath).catch(() => null);

    if (!stats || !stats.isDirectory()) {
        throw new Error(`Import folder "${sourcePath}" does not exist or is not a directory.`);
    }

    return resolvedPath;
}

export async function handleAgentWorkflow(): Promise<void> {
    console.log(`\n🚦 Running pre-flight checks for Master Workflow...\n`);
    const preflightHandler = new WorkflowPreflightHandler();
    const { codebases, models } = await preflightHandler.handle();

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
        model: answers.model || undefined,
        debugMode: answers.debugMode,
    };

    console.log(`\n📨 Sending workflow payload to Master Workflow webhook...`);
    const triggerWorkflowHandler = new TriggerWorkflowHandler(payload);
    const response = await triggerWorkflowHandler.handle();
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
            await execAsync(`${openCommand} http://${executionData.executionUrl}`);
            console.log("\n");
        } catch (error) {
            console.warn("⚠️  Could not open browser automatically.");
        }
    }
}

async function runCommand(command: string, args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, args, {
            stdio: "inherit",
        });

        proc.on("close", (code) => {
            if (code && code !== 0) {
                reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
            } else {
                resolve();
            }
        });

        proc.on("error", (error) => reject(error));
    });
}

async function importProjectFromHost(sourcePath: string, projectFolder: string): Promise<void> {
    const resolvedSource = await ensureImportSourceDirectory(sourcePath);
    const contentsPath = path.join(resolvedSource, ".");
    const containerProjectPath = buildContainerProjectPath(projectFolder);
    const tempContainerPath = `/tmp/import-${randomUUID()}`;
    const nestedFolderName = path.basename(resolvedSource) || "";

    console.log("\n📂 Importing project files from host folder...\n");

    await runCommand("docker", ["exec", APP_CONTAINER_NAME, "mkdir", "-p", tempContainerPath]);

    try {
        await runCommand("docker", [
            "cp",
            contentsPath,
            `${APP_CONTAINER_NAME}:${tempContainerPath}`,
        ]);

        const scriptArgs = [
            tempContainerPath,
            nestedFolderName,
            AGENT_FOLDER_NAME,
            containerProjectPath,
        ].map(escapeForDoubleQuotes);

        await runCommand("docker", [
            "exec",
            APP_CONTAINER_NAME,
            "bash",
            "/app/src/scripts/import-project-files.sh",
            ...scriptArgs,
        ]);
    } finally {
        await runCommand("docker", [
            "exec",
            APP_CONTAINER_NAME,
            "rm",
            "-rf",
            tempContainerPath,
        ]).catch(() => {});
    }

    console.log("\n✅ Project files imported successfully.\n");
}

export async function handleCreateProjectFlow(): Promise<void> {
    console.log("\n🆕 Create Project\n");
    const answers = await inquirer.prompt<{
        name: string;
        projectFolder: string;
        setup: string;
        masterPrompt: string;
        importFromFolder: boolean;
        importFolderPath?: string;
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
            message: "Master prompt (an editor will open; save and exit to continue):",
            validate: requireInput("Master prompt"),
            filter: (input: string) => input.trim(),
        },
        {
            type: "confirm",
            name: "importFromFolder",
            message: "Import files from an existing host folder?",
            default: false,
        },
        {
            type: "input",
            name: "importFolderPath",
            message: "Path to host folder:",
            when: (response) => response.importFromFolder,
            filter: (input: string) => input.trim(),
            validate: (input: string) => {
                if (!input.trim()) {
                    return "Import folder path is required.";
                }
                const resolved = path.resolve(input.trim());
                if (!existsSync(resolved)) {
                    return `Folder not found: ${resolved}`;
                }
                const stats = statSync(resolved);
                if (!stats.isDirectory()) {
                    return "Import path must be a directory.";
                }
                return true;
            },
        },
    ]);

    const importSourcePath =
        answers.importFromFolder && answers.importFolderPath
            ? await ensureImportSourceDirectory(answers.importFolderPath)
            : null;

    const payload = {
        name: answers.name,
        folderName: answers.projectFolder,
        prompt: answers.masterPrompt,
        setup: answers.setup,
    };

    console.log("\n🔧 Setting up project...\n");

    const setupUrl = `${DEFAULT_APP_BASE_URL}/api/codebase/setup`;
    const response = await fetch(setupUrl, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Setup failed with status ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    const message = `Project "${payload.name}" setup successfully.`;
    console.log(`\n✅ ${message}\n`);
    if (result?.stdout) {
        console.log(result.stdout);
    }

    if (importSourcePath) {
        await importProjectFromHost(importSourcePath, answers.projectFolder);
    }
}
