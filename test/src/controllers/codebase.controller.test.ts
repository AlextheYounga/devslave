import CodebaseController from "../../../src/api/controllers/codebase.controller";
import GetCodebaseHandler from "../../../src/api/handlers/getCodebase.handler";
import GetAllCodebasesHandler from "../../../src/api/handlers/getAllCodebases.handler";
import SetupCodebaseHandler from "../../../src/api/handlers/setupCodebase.handler";
import CloneCodebaseHandler from "../../../src/api/handlers/cloneCodebase.handler";

jest.mock("../../../src/api/handlers/getCodebase.handler");
jest.mock("../../../src/api/handlers/getAllCodebases.handler");
jest.mock("../../../src/api/handlers/setupCodebase.handler");
jest.mock("../../../src/api/handlers/cloneCodebase.handler");

type MockResponse = {
    status: jest.Mock;
    json: jest.Mock;
};

const makeResponse = (): MockResponse => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
});

const GetCodebaseHandlerMock = GetCodebaseHandler as jest.MockedClass<typeof GetCodebaseHandler>;
const GetAllCodebasesHandlerMock = GetAllCodebasesHandler as jest.MockedClass<
    typeof GetAllCodebasesHandler
>;
const SetupCodebaseHandlerMock = SetupCodebaseHandler as jest.MockedClass<
    typeof SetupCodebaseHandler
>;
const CloneCodebaseHandlerMock = CloneCodebaseHandler as jest.MockedClass<
    typeof CloneCodebaseHandler
>;

describe("CodebaseController", () => {
    const getHandle = jest.fn();
    const getAllHandle = jest.fn();
    const setupHandle = jest.fn();
    const cloneHandle = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();
        getHandle.mockReset();
        getAllHandle.mockReset();
        setupHandle.mockReset();
        cloneHandle.mockReset();

        GetCodebaseHandlerMock.mockImplementation(() => ({ handle: getHandle }) as any);
        GetAllCodebasesHandlerMock.mockImplementation(() => ({ handle: getAllHandle }) as any);
        SetupCodebaseHandlerMock.mockImplementation(() => ({ handle: setupHandle }) as any);
        CloneCodebaseHandlerMock.mockImplementation(() => ({ handle: cloneHandle }) as any);
    });

    it("returns codebase when handler succeeds", async () => {
        getHandle.mockResolvedValue({ id: "code-1" });
        const req: any = { params: { id: "code-1" }, body: {} };
        const res = makeResponse();

        await new CodebaseController(req, res as any).get();

        expect(GetCodebaseHandlerMock).toHaveBeenCalledWith("code-1");
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.codebase.id).toBe("code-1");
    });

    it("returns 500 when get handler throws", async () => {
        getHandle.mockRejectedValue(new Error("fail"));
        const req: any = { params: { id: "missing" }, body: {} };
        const res = makeResponse();

        await new CodebaseController(req, res as any).get();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });

    it("returns all codebases when handler succeeds", async () => {
        const list = [{ id: "code-1" }];
        getAllHandle.mockResolvedValue(list);
        const req: any = { body: {} };
        const res = makeResponse();

        await new CodebaseController(req, res as any).getAll();

        expect(GetAllCodebasesHandlerMock).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.codebases).toEqual(list);
    });

    it("returns 500 when getAll handler throws", async () => {
        getAllHandle.mockRejectedValue(new Error("fail"));
        const req: any = { body: {} };
        const res = makeResponse();

        await new CodebaseController(req, res as any).getAll();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });

    it("validates setup payload", async () => {
        const req: any = { body: { executionId: "exec" } };
        const res = makeResponse();

        await new CodebaseController(req, res as any).setup();

        expect(res.status).toHaveBeenCalledWith(400);
        expect(SetupCodebaseHandlerMock).not.toHaveBeenCalled();
    });

    it("delegates setup work to handler", async () => {
        setupHandle.mockResolvedValue({ stdout: "done" });
        const payload = {
            executionId: "exec-1",
            name: "code-1",
            folderName: "folder",
            prompt: "boot",
        };
        const req: any = { body: payload };
        const res = makeResponse();

        await new CodebaseController(req, res as any).setup();

        expect(SetupCodebaseHandlerMock).toHaveBeenCalledWith(payload);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.stdout).toBe("done");
    });

    it("returns 500 when setup handler fails", async () => {
        setupHandle.mockRejectedValue(new Error("boom"));
        const payload = {
            executionId: "exec-1",
            name: "code-1",
            folderName: "folder",
            prompt: "boot",
        };
        const req: any = { body: payload };
        const res = makeResponse();

        await new CodebaseController(req, res as any).setup();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });

    it("clones a codebase via handler", async () => {
        cloneHandle.mockResolvedValue({ targetPath: "/tmp/foo" });
        const req: any = { params: { id: "code-1" }, body: { targetPath: "/tmp/foo" } };
        const res = makeResponse();

        await new CodebaseController(req, res as any).clone();

        expect(CloneCodebaseHandlerMock).toHaveBeenCalledWith({
            codebaseId: "code-1",
            targetPath: "/tmp/foo",
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json.mock.calls[0][0].data.targetPath).toBe("/tmp/foo");
    });

    it("returns error status when clone fails", async () => {
        cloneHandle.mockRejectedValue(new Error("fail"));
        const req: any = { params: { id: "code-1" }, body: {} };
        const res = makeResponse();

        await new CodebaseController(req, res as any).clone();

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].success).toBe(false);
    });
});
