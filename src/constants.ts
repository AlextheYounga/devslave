import {resolve} from "path";
import * as os from "os";

export const REPO_ROOT = resolve(__dirname, "../");
export const SENTINEL = "<<!_SESSION_DONE_!>>"
export const AGENT_FOLDER="agent"
export const DEV_WORKSPACE = process?.env?.NODE_ENV == 'test' ? os.tmpdir() : "/app/dev/"
export const SCRIPT_PATH = process.env.SCRIPT_PATH || "src/scripts";

export type Role = "developer" | "architect" | "qa" | "manager";