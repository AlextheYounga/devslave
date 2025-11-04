#!/usr/bin/env tsx

import inquirer from "inquirer";
import { spawn } from "child_process";
import { join } from "path";
import { homedir } from "os";
import { prisma } from "./prisma";

const choices = [
    { name: "App Shell", value: "app-shell" },
    { name: "Start Docker", value: "start-docker" },
    { name: "Open n8n", value: "open-n8n" },
    { name: "Open Agent Container on VSCode", value: "open-vscode" },
    { name: "Download Project", value: "download-project" },
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
        await runCommand("docker", [
            "cp",
            `devslave-app-1:${containerZipPath}`,
            hostDestination,
        ]);

        console.log(`\n🧹 Cleaning up temporary files...`);
        await runCommand("docker", [
            "exec",
            "devslave-app-1",
            "rm",
            containerZipPath,
        ]);

        console.log(
            `\n✅ Project downloaded successfully to: ${hostDestination}\n`,
        );
    } catch (error) {
        console.error("\n❌ Download failed:", (error as Error).message);
        throw error;
    }
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

        case "open-vscode":
            console.log("\n💻 Opening Agent Container in VS Code...\n");
            await runCommand(join(rootDir, "docker/vscode-remote.sh"));
            break;

        case "download-project":
            console.log("\n📦 Download Project...\n");
            await handleDownloadProject();
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
