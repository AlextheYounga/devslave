import * as path from "path";
import { paths } from "../../../constants";
import { runUtilityCommand } from "./runUtilityCommand";

export default class OpenAppShellHandler {
    private scriptPath: string;

    constructor(repoRoot = paths.repoRoot) {
        this.scriptPath = path.join(repoRoot, "docker", "dev-container.sh");
    }

    async handle() {
        await runUtilityCommand(this.scriptPath);
        return { message: "App container shell opened." };
    }
}
