import { Request, Response } from "express";
import OpenAppShellHandler from "../handlers/utilities/openAppShell.handler";
import OpenVsCodeHandler from "../handlers/utilities/openVsCode.handler";
import CodexLoginHandler from "../handlers/utilities/codexLogin.handler";

export default class UtilityController {
    private req: Request;
    private res: Response;

    constructor(req: Request, res: Response) {
        this.req = req;
        this.res = res;
    }

    async openAppShell() {
        try {
            const handler = new OpenAppShellHandler();
            const result = await handler.handle();
            return this.res.status(200).json({
                success: true,
                message: result.message,
            });
        } catch (error: any) {
            console.error("Error in UtilityController->openAppShell:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async openVsCode() {
        try {
            const handler = new OpenVsCodeHandler();
            const result = await handler.handle();
            return this.res.status(200).json({
                success: true,
                message: result.message,
            });
        } catch (error: any) {
            console.error("Error in UtilityController->openVsCode:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }

    async loginCodex() {
        try {
            const handler = new CodexLoginHandler();
            const result = await handler.handle();
            return this.res.status(200).json({
                success: true,
                message: result.message,
            });
        } catch (error: any) {
            console.error("Error in UtilityController->loginCodex:", error);
            return this.res.status(500).json({
                success: false,
                error: error?.message ?? String(error),
            });
        }
    }
}
