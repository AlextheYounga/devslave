import * as path from "path";
import * as os from "os";

export const SENTINEL = "<<!_SESSION_DONE_!>>"
export const AGENT_FOLDER="agent"

const repoRoot = path.resolve(__dirname, "../");
const scriptsPath = process.env.SCRIPT_PATH || path.join(repoRoot, "src", "scripts")

export const paths = {
  home: os.homedir(),
  repoRoot: repoRoot,
  devWorkspace: process?.env?.NODE_ENV == 'test' ? os.tmpdir() : "/app/dev/",
  scripts: scriptsPath,
  stubs: path.join(scriptsPath, 'stubs'),
};

export type Role = "developer" | "architect" | "qa" | "manager";