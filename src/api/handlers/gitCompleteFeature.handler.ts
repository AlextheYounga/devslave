import {
    GitCompleteFeatureCompleted,
    GitCompleteFeatureFailed,
    GitCompleteFeatureStarted,
} from "../../events";
import { GitHandler } from "./git.handler";

export type GitCompleteFeatureParams = {
    codebaseId: string;
};

export default class GitCompleteFeatureHandler extends GitHandler {
    private params: GitCompleteFeatureParams;

    constructor(params: GitCompleteFeatureParams) {
        super();
        this.params = params;
    }

    async handle() {
        new GitCompleteFeatureStarted(this.params).publish();

        try {
            const stdout = this.runGitScript("complete_feature.sh", [this.params.codebaseId]);
            const payload = {
                ...this.params,
                stdout,
            };

            new GitCompleteFeatureCompleted(payload).publish();

            return payload;
        } catch (error: any) {
            new GitCompleteFeatureFailed({
                ...this.params,
                error: error?.message ?? String(error),
            }).publish();
            throw error;
        }
    }
}
