import inquirer from "inquirer";

export type AgentWorkflowKey = "architect" | "project-manager" | "development";

export const WORKFLOW_CONFIG: Record<
    AgentWorkflowKey,
    { label: string; envVar: string; role: string }
> = {
    architect: {
        label: "Architect Agent",
        envVar: "N8N_ARCHITECT_WEBHOOK_URL",
        role: "architect",
    },
    "project-manager": {
        label: "Project Manager Agent",
        envVar: "N8N_PM_WEBHOOK_URL",
        role: "manager",
    },
    development: {
        label: "Development Agents",
        envVar: "N8N_DEVELOPMENT_WEBHOOK_URL",
        role: "developer",
    },
};

export const SETUP_OPTIONS = [
    "default",
    "node",
    "python",
    "rust",
    "laravel",
    "vue",
];

const MAIN_MENU_CHOICES = [
    { name: "Create Project", value: "create-project" },
    { name: "Start Agent Workflow", value: "start-agent-workflow" },
    { name: "Utilities", value: "utilities" },
    { name: "Exit", value: "exit" },
];

const UTILITY_CHOICES = [
    { name: "Open Shell in App Container", value: "app-shell" },
    { name: "Open Agent Container on VSCode", value: "open-vscode" },
    { name: "Start Docker", value: "start-docker" },
    { name: "Open n8n", value: "open-n8n" },
    { name: "Download Project", value: "download-project" },
    { name: "Back to Main Menu", value: "back" },
];

const WORKFLOW_CHOICES = [
    { name: "Architect Agent", value: "architect" },
    { name: "Project Manager Agent", value: "project-manager" },
    { name: "Development Agents", value: "development" },
    { name: "Back to Main Menu", value: "back" },
];

export async function promptMainMenu(): Promise<string> {
    const { action } = await inquirer.prompt<{ action: string }>([
        {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: MAIN_MENU_CHOICES,
        },
    ]);
    return action;
}

export async function promptUtilitiesMenu(): Promise<string> {
    const { utility } = await inquirer.prompt<{ utility: string }>([
        {
            type: "list",
            name: "utility",
            message: "Utilities",
            choices: UTILITY_CHOICES,
        },
    ]);
    return utility;
}

export async function promptWorkflowMenu(): Promise<string> {
    const { workflow } = await inquirer.prompt<{ workflow: string }>([
        {
            type: "list",
            name: "workflow",
            message: "Select a workflow:",
            choices: WORKFLOW_CHOICES,
        },
    ]);
    return workflow;
}
