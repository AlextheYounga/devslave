import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import dotenv from "dotenv";

// Determine which .env file to load based on Docker marker
export const IS_DOCKER_CONTAINER = fs.existsSync("/.docker-env-marker");
export const ENV_FILE = IS_DOCKER_CONTAINER ? ".env.docker" : ".env";

export const loadEnv = () => {
    // Load the appropriate env file
    const envPath = path.resolve(process.cwd(), ENV_FILE);
    if (fs.existsSync(envPath)) {
        dotenv.config({ path: envPath });
        console.log(`[constants] Loaded environment from: ${ENV_FILE}`);
    } else {
        // Fallback to default .env
        dotenv.config();
        console.log(`[constants] ${ENV_FILE} not found, using default .env`);
    }
};

loadEnv();

export type Role = "developer" | "architect" | "qa" | "manager";
export const MACHINE_CONTEXT = process.env.MACHINE_CONTEXT || "host";
export const SENTINEL = "<<!_SESSION_DONE_!>>";
export const AGENT_FOLDER_NAME = process.env.AGENT_FOLDER_NAME || ".agent";
export const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
export const APP_CONTAINER_NAME = process.env.APP_CONTAINER_NAME || "devslave-app-1";
export const DEFAULT_APP_BASE_URL = process.env.APP_BASE_URL || "http://127.0.0.1:3000";
export const DEFAULT_OLLAMA_BASE_URL = process.env.CODEX_OSS_BASE_URL || "http://127.0.0.1:11434";
export const WEBHOOK_URL =
    process.env.N8N_MASTER_WEBHOOK_URL || "http://localhost:5678/webhook/master";

if (!WEBHOOK_URL) {
    throw new Error(`Missing N8N_MASTER_WEBHOOK_URL environment variable.`);
}

const repoRoot = path.resolve(__dirname, "../");
const scriptsPath = process.env.SCRIPT_PATH || path.join(repoRoot, "src", "", "scripts");

export const paths = {
    home: os.homedir(),
    repoRoot: repoRoot,
    devWorkspace: process.env.NODE_ENV == "test" ? os.tmpdir() : "/app/dev/",
    projectOutputDir: process.env.PROJECT_OUTPUT_DIR || os.homedir(),
    scripts: scriptsPath,
    prompts: path.join(repoRoot, "src", "prompts"),
    handoffs: path.join(repoRoot, "src", "prompts", "handoffs"),
    stubs: path.join(scriptsPath, "stubs"),
};
