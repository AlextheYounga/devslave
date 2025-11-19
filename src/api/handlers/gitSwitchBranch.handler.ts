import {
    GitSwitchBranchCompleted,
    GitSwitchBranchFailed,
    GitSwitchBranchStarted,
} from "../../events";
import { runGitScript } from "../utils/runGitScript";

export type GitSwitchBranchParams = {
    codebaseId: string;
    branchName: string;
};

export default class GitSwitchBranchHandler {
    private params: GitSwitchBranchParams;

    constructor(params: GitSwitchBranchParams) {
        this.params = params;
    }

    async handle() {
        new GitSwitchBranchStarted(this.params).publish();

        try {
            const stdout = runGitScript("checkout_branch.sh", [
                this.params.codebaseId,
                this.params.branchName,
            ]);
            const payload = {
                ...this.params,
                stdout,
            };

            new GitSwitchBranchCompleted(payload).publish();

            return payload;
        } catch (error: any) {
            new GitSwitchBranchFailed({
                ...this.params,
                error: error?.message ?? String(error),
            }).publish();
            throw error;
        }
    }
}
