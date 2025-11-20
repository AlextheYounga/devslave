import path from "path";
import { execFileSync } from "child_process";
import { paths } from "../../constants";

export class GitHandler {
    gitScriptsDir = path.join(paths.repoRoot, "src", "api", "scripts", "n8n", "git");

    runGitScript = (scriptName: string, args: string[]): string => {
        const scriptFile = path.join(this.gitScriptsDir, scriptName);
        try {
            return execFileSync("bash", [scriptFile, ...args], {
                encoding: "utf-8",
                stdio: "pipe",
                env: {
                    ...process.env,
                    API_REPO: process.env.API_REPO ?? paths.repoRoot,
                },
            });
        } catch (error) {
            throw this.buildScriptError(error);
        }
    };

    private normalizeOutput = (value: unknown): string | null => {
        if (!value) {
            return null;
        }
        if (typeof value === "string") {
            return value;
        }
        if (Buffer.isBuffer(value)) {
            return value.toString("utf-8");
        }
        if (typeof value === "object" && typeof (value as any).toString === "function") {
            return (value as any).toString();
        }
        return null;
    };
    private buildScriptError = (error: unknown): Error => {
        const err = error as { message?: string; stdout?: unknown; stderr?: unknown };
        const stderr = this.normalizeOutput(err?.stderr);
        const stdout = this.normalizeOutput(err?.stdout);
        const parts = [stderr, stdout, err?.message].filter((part): part is string =>
            Boolean(part),
        );
        const message = parts.join("\n") || "Script execution failed";
        const enriched = new Error(message);
        (enriched as any).stdout = err?.stdout;
        (enriched as any).stderr = err?.stderr;
        return enriched;
    };
}
