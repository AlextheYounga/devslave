import * as path from "path";
import { paths } from "../../constants";
import { runUtilityCommand } from "./runUtilityCommand";

export default class OpenVsCodeHandler {
    private scriptPath: string;

    constructor(repoRoot = paths.repoRoot) {
        this.scriptPath = path.join(repoRoot, "docker", "vscode-remote.sh");
    }

    async handle() {
        await runUtilityCommand(this.scriptPath);
        return { message: "VS Code launched for the agent container." };
    }
}
