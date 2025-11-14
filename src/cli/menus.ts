import inquirer from "inquirer";

export const SETUP_OPTIONS = ["default", "node", "python", "rust", "laravel", "vue"];

const MAIN_MENU_CHOICES = [
    { name: "Create Project", value: "create-project" },
    { name: "View Running Agents", value: "view-running-agents" },
    { name: "Start Workflow", value: "start-agent-workflow" },
    { name: "Utilities", value: "utilities" },
    { name: "Exit", value: "exit" },
];

const UTILITY_CHOICES = [
    { name: "Open Shell in App Container", value: "app-shell" },
    { name: "Open Agent Container on VSCode", value: "open-vscode" },
    { name: "Start Docker", value: "start-docker" },
    { name: "Open n8n", value: "open-n8n" },
    { name: "Clone Project", value: "clone-project" },
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
