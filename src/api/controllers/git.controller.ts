import { Request, Response } from "express";
import { validateRequiredFields } from "../utils/validation";
import GitCommitHandler from "../handlers/gitCommit.handler";
import GitSwitchBranchHandler from "../handlers/gitSwitchBranch.handler";
import GitCompleteFeatureHandler from "../handlers/gitCompleteFeature.handler";

export default class GitController {
    private req: Request;
    private res: Response;
    private data: Record<string, any>;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
        this.data = req.body ?? {};
    }

    async commit() {
        const requiredFields = ["codebaseId", "message"];
        const validation = validateRequiredFields(this.data, requiredFields);
        if (!validation.isValid) {
            return this.res.status(400).json({
                success: false,
                error: validation.error,
            });
        }

        try {
            const handler = new GitCommitHandler({
                codebaseId: this.data.codebaseId,
                message: this.data.message,
            });
            const result = await handler.handle();

            return this.res.status(200).json({
                success: true,
                message: "Git commit executed successfully",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in GitController->commit:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async switchBranch() {
        const requiredFields = ["codebaseId", "branchName"];
        const validation = validateRequiredFields(this.data, requiredFields);
        if (!validation.isValid) {
            return this.res.status(400).json({
                success: false,
                error: validation.error,
            });
        }

        try {
            const handler = new GitSwitchBranchHandler({
                codebaseId: this.data.codebaseId,
                branchName: this.data.branchName,
            });
            const result = await handler.handle();
            return this.res.status(200).json({
                success: true,
                message: "Git branch switch executed successfully",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in GitController->switchBranch:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async completeFeature() {
        const requiredFields = ["codebaseId"];
        const validation = validateRequiredFields(this.data, requiredFields);
        if (!validation.isValid) {
            return this.res.status(400).json({
                success: false,
                error: validation.error,
            });
        }

        try {
            const handler = new GitCompleteFeatureHandler({
                codebaseId: this.data.codebaseId,
            });
            const result = await handler.handle();
            return this.res.status(200).json({
                success: true,
                message: "Git feature completion executed successfully",
                data: result,
            });
        } catch (error: any) {
            console.error("Error in GitController->completeFeature:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
