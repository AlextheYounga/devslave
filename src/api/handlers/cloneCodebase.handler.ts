import { PrismaClient } from "@prisma/client";
import { execFile } from "child_process";
import { basename, join } from "path";
import { promisify } from "util";
import { existsSync } from "fs";
import { prisma } from "../../prisma";
import { paths } from "../../constants";

const execFileAsync = promisify(execFile);

type CloneCodebaseParams = {
    codebaseId: string;
    targetPath?: string;
};

type CloneResult = {
    codebaseId: string;
    targetPath: string;
};

export default class CloneCodebaseHandler {
    private db: PrismaClient;
    private params: CloneCodebaseParams;

    constructor(params: CloneCodebaseParams, db: PrismaClient = prisma) {
        this.params = params;
        this.db = db;
    }

    async handle(): Promise<CloneResult> {
        const codebase = await this.db.codebase.findUnique({
            where: { id: this.params.codebaseId },
        });
        if (!codebase) {
            throw new Error("Codebase not found");
        }

        const scriptPath = join(paths.repoRoot, "docker", "clone.sh");
        if (!existsSync(scriptPath)) {
            throw new Error("clone.sh script not found");
        }

        const targetPath =
            this.params.targetPath ?? join(paths.projectOutputDir, basename(codebase.path));

        await execFileAsync(scriptPath, [codebase.path, targetPath], {
            cwd: paths.repoRoot,
        });

        return {
            codebaseId: codebase.id,
            targetPath,
        };
    }
}
