import {
    GitCompleteFeatureCompleted,
    GitCompleteFeatureFailed,
    GitCompleteFeatureStarted,
} from "../../events";
import { runGitScript } from "../utils/runGitScript";

export type GitCompleteFeatureParams = {
    codebaseId: string;
};

export default class GitCompleteFeatureHandler {
    private params: GitCompleteFeatureParams;

    constructor(params: GitCompleteFeatureParams) {
        this.params = params;
    }

    async handle() {
        new GitCompleteFeatureStarted(this.params).publish();

        try {
            const stdout = runGitScript("complete_feature.sh", [this.params.codebaseId]);
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
