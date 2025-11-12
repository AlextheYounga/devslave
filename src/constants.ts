import * as path from "path";
import * as os from "os";
import fs from "fs";
import dotenv from "dotenv";
dotenv.config();

export type Role = "developer" | "architect" | "qa" | "manager";

export const SENTINEL = "<<!_SESSION_DONE_!>>";
export const AGENT_FOLDER_NAME = process.env.AGENT_FOLDER_NAME || ".agent";
export const N8N_URL = process.env.N8N_URL || "http://localhost:5678";

const repoRoot = path.resolve(__dirname, "../");
const scriptsPath = process.env.SCRIPT_PATH || path.join(repoRoot, "src", "scripts");

export const paths = {
    home: os.homedir(),
    repoRoot: repoRoot,
    devWorkspace: process?.env?.NODE_ENV == "test" ? os.tmpdir() : "/app/dev/",
    scripts: scriptsPath,
    prompts: path.join(repoRoot, "src", "prompts"),
    handoffs: path.join(repoRoot, "src", "prompts", "handoffs"),
    stubs: path.join(scriptsPath, "stubs"),
};

const getSystemPrompt = (filename: string) => {
    const systemPromptTemplates = path.join(paths.prompts, "system");
    const template = fs.readFileSync(path.join(systemPromptTemplates, filename), "utf-8");
    return template.replace(/{{AGENT_FOLDER_NAME}}/g, AGENT_FOLDER_NAME);
};

export const systemPrompts = {
    architect: getSystemPrompt("architect.md"),
    developer: getSystemPrompt("developer.md"),
    qa: getSystemPrompt("qa.md"),
    pm: getSystemPrompt("pm.md"),
};
