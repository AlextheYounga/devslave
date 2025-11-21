import * as path from "path";
import { paths } from "../../constants";
import { runUtilityCommand } from "./runUtilityCommand";

export default class CodexLoginHandler {
    private scriptPath: string;

    constructor(repoRoot = paths.repoRoot) {
        this.scriptPath = path.join(repoRoot, "docker", "codex-login.sh");
    }

    async handle() {
        await runUtilityCommand(this.scriptPath);
        return { message: "Codex login initiated." };
    }
}
