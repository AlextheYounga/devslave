#!/usr/bin/env tsx

import inquirer from "inquirer";
import { spawn } from "child_process";
import { join } from "path";

const choices = [
    { name: "App Shell", value: "app-shell" },
    { name: "Start Docker", value: "start-docker" },
    { name: "Open n8n", value: "open-n8n" },
    { name: "Exit", value: "exit" },
];

async function runCommand(
    command: string,
    args: string[] = [],
    options = {},
): Promise<void> {
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

async function handleChoice(choice: string): Promise<void> {
    const rootDir = join(__dirname, "..");

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

        case "exit":
            console.log("\n👋 Goodbye!\n");
            process.exit(0);
            break;

        default:
            console.log("Unknown option");
    }
}

async function main(): Promise<void> {
    console.log("\n🛠️  DevSlave CLI\n");

    const answers = await inquirer.prompt([
        {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: choices,
        },
    ]);

    try {
        await handleChoice(answers.action);
    } catch (error) {
        console.error("\n❌ Error:", (error as Error).message);
        process.exit(1);
    }
}

main();
