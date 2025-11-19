import { GitCommitCompleted, GitCommitFailed, GitCommitStarted } from "../../events";
import { runGitScript } from "../utils/runGitScript";

export type GitCommitParams = {
    codebaseId: string;
    message: string;
};

export default class GitCommitHandler {
    private params: GitCommitParams;

    constructor(params: GitCommitParams) {
        this.params = params;
    }

    async handle() {
        new GitCommitStarted(this.params).publish();

        try {
            const stdout = runGitScript("git_commit.sh", [
                this.params.codebaseId,
                this.params.message,
            ]);
            const payload = {
                ...this.params,
                stdout,
            };

            new GitCommitCompleted(payload).publish();

            return payload;
        } catch (error: any) {
            new GitCommitFailed({
                ...this.params,
                error: error?.message ?? String(error),
            }).publish();
            throw error;
        }
    }
}
