import {
    GitSwitchBranchCompleted,
    GitSwitchBranchFailed,
    GitSwitchBranchStarted,
} from "../../events";
import { GitHandler } from "./git.handler";

export type GitSwitchBranchParams = {
    codebaseId: string;
    branchName: string;
};

export default class GitSwitchBranchHandler extends GitHandler {
    private params: GitSwitchBranchParams;

    constructor(params: GitSwitchBranchParams) {
        super();
        this.params = params;
    }

    async handle() {
        new GitSwitchBranchStarted(this.params).publish();

        try {
            const stdout = this.runGitScript("checkout_branch.sh", [
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
