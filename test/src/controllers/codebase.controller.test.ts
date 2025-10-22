import CodebaseController from "../../../src/controllers/codebase.controller";
import GetCodebaseHandler from "../../../src/handlers/getCodebase.handler";
import SetupCodebaseHandler from "../../../src/handlers/setupCodebase.handler";

jest.mock("../../../src/handlers/getCodebase.handler");
jest.mock("../../../src/handlers/setupCodebase.handler");

type MockResponse = {
  status: jest.Mock;
  json: jest.Mock;
};

const makeResponse = (): MockResponse => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const GetCodebaseHandlerMock =
  GetCodebaseHandler as jest.MockedClass<typeof GetCodebaseHandler>;
const SetupCodebaseHandlerMock =
  SetupCodebaseHandler as jest.MockedClass<typeof SetupCodebaseHandler>;

describe("CodebaseController", () => {
  const getHandle = jest.fn();
  const setupHandle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    getHandle.mockReset();
    setupHandle.mockReset();

    GetCodebaseHandlerMock.mockImplementation(() => ({ handle: getHandle }) as any);
    SetupCodebaseHandlerMock.mockImplementation(() => ({ handle: setupHandle }) as any);
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
      codebaseId: "code-1",
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
      codebaseId: "code-1",
      folderName: "folder",
      prompt: "boot",
    };
    const req: any = { body: payload };
    const res = makeResponse();

    await new CodebaseController(req, res as any).setup();

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].success).toBe(false);
  });
});
