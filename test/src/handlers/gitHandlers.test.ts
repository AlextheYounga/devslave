import path from "path";
import { execFileSync } from "child_process";
import GitCommitHandler from "../../../src/api/handlers/gitCommit.handler";
import GitSwitchBranchHandler from "../../../src/api/handlers/gitSwitchBranch.handler";
import GitCompleteFeatureHandler from "../../../src/api/handlers/gitCompleteFeature.handler";

jest.mock("child_process", () => {
    const actual = jest.requireActual("child_process");
    return {
        ...actual,
        execFileSync: jest.fn(),
    };
});

const execFileSyncMock = execFileSync as unknown as jest.Mock;
const repoRoot = process.cwd();
const scriptsDir = path.join(repoRoot, "src", "api", "scripts", "n8n", "git");

describe("GitCommitHandler", () => {
    const originalApiRepo = process.env.API_REPO;

    afterAll(() => {
        if (originalApiRepo) {
            process.env.API_REPO = originalApiRepo;
        } else {
            delete process.env.API_REPO;
        }
    });

    beforeEach(() => {
        delete process.env.API_REPO;
        execFileSyncMock.mockReset();
    });

    it("runs git commit script with provided codebase and message", async () => {
        execFileSyncMock.mockReturnValue("commit complete");
        const handler = new GitCommitHandler({
            codebaseId: "codebase-123",
            message: "feat: add endpoint",
        });

        const result = await handler.handle();

        expect(result).toEqual({
            codebaseId: "codebase-123",
            message: "feat: add endpoint",
            stdout: "commit complete",
        });

        expect(execFileSyncMock).toHaveBeenCalledWith(
            "bash",
            [path.join(scriptsDir, "git_commit.sh"), "codebase-123", "feat: add endpoint"],
            expect.objectContaining({
                encoding: "utf-8",
                stdio: "pipe",
                env: expect.objectContaining({ API_REPO: repoRoot }),
            }),
        );
    });

    it("throws an error that includes script stderr when the script fails", async () => {
        const handler = new GitCommitHandler({
            codebaseId: "codebase-1",
            message: "feat: add endpoint",
        });
        const scriptError = new Error("Command failed");
        (scriptError as any).stderr = Buffer.from("fatal: something bad happened");
        execFileSyncMock.mockImplementation(() => {
            throw scriptError;
        });

        await expect(handler.handle()).rejects.toThrow("fatal: something bad happened");
    });
});

describe("GitSwitchBranchHandler", () => {
    beforeEach(() => {
        execFileSyncMock.mockReset();
    });

    it("runs checkout branch script with codebaseId and branchName", async () => {
        execFileSyncMock.mockReturnValue("switched branch");
        const handler = new GitSwitchBranchHandler({
            codebaseId: "codebase-99",
            branchName: "feature/login",
        });

        const result = await handler.handle();

        expect(result).toEqual({
            codebaseId: "codebase-99",
            branchName: "feature/login",
            stdout: "switched branch",
        });

        expect(execFileSyncMock).toHaveBeenCalledWith(
            "bash",
            [path.join(scriptsDir, "checkout_branch.sh"), "codebase-99", "feature/login"],
            expect.any(Object),
        );
    });

    it("surfaces script stdout when checkout fails", async () => {
        const handler = new GitSwitchBranchHandler({
            codebaseId: "codebase-99",
            branchName: "feature/login",
        });
        const scriptError = new Error("failed");
        (scriptError as any).stdout = "Already on feature/login";
        execFileSyncMock.mockImplementation(() => {
            throw scriptError;
        });

        await expect(handler.handle()).rejects.toThrow("Already on feature/login");
    });
});

describe("GitCompleteFeatureHandler", () => {
    beforeEach(() => {
        execFileSyncMock.mockReset();
    });

    it("runs complete feature script with codebaseId", async () => {
        execFileSyncMock.mockReturnValue("feature done");
        const handler = new GitCompleteFeatureHandler({
            codebaseId: "codebase-42",
        });

        const result = await handler.handle();

        expect(result).toEqual({
            codebaseId: "codebase-42",
            stdout: "feature done",
        });

        expect(execFileSyncMock).toHaveBeenCalledWith(
            "bash",
            [path.join(scriptsDir, "complete_feature.sh"), "codebase-42"],
            expect.any(Object),
        );
    });

    it("throws descriptive error when feature completion script fails", async () => {
        const handler = new GitCompleteFeatureHandler({
            codebaseId: "codebase-42",
        });
        const scriptError = new Error("exit 1");
        (scriptError as any).stderr = "Error: Already on main trunk";
        execFileSyncMock.mockImplementation(() => {
            throw scriptError;
        });

        await expect(handler.handle()).rejects.toThrow("Error: Already on main trunk");
    });
});
