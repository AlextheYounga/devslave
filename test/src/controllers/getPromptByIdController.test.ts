import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterAll,
  jest,
} from "@jest/globals";
import { Request, Response } from "express";
import path from "path";
import GetPromptByIdController from "../../../src/controllers/getPromptById.controller";

const actualPath = jest.requireActual("path") as typeof path;
const fixturesPromptsDir = actualPath.join(__dirname, "../../fixtures/prompts");
const originalResolve = path.resolve.bind(path);

describe("getPromptByIdController", () => {
  let resolveSpy: jest.SpiedFunction<typeof path.resolve>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let jsonSpy: jest.Mock;
  let statusSpy: jest.Mock;

  beforeAll(() => {
    resolveSpy = jest
      .spyOn(path, "resolve")
      .mockImplementation((...segments: string[]) => {
        if (segments.length >= 1 && segments[segments.length - 1] === "../prompts") {
          return fixturesPromptsDir;
        }

        return originalResolve(...segments);
      });
  });

  afterAll(() => {
    resolveSpy.mockRestore();
  });

  beforeEach(() => {
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });

    mockResponse = {
      json: jsonSpy as unknown as Response["json"],
      status: statusSpy as unknown as Response["status"],
    };

    mockRequest = { params: {} };
  });

  it("returns prompt data when the id exists", async () => {
    mockRequest.params = { id: "sample-prompt" };

    await new GetPromptByIdController(
      mockRequest as Request,
      mockResponse as Response
    ).handleRequest();

    expect(statusSpy).not.toHaveBeenCalled();
    expect(jsonSpy).toHaveBeenCalledWith({
      success: true,
      data: {
        id: "sample-prompt",
        filename: "sample-prompt.md",
        content: expect.stringContaining("# Sample Prompt"),
      },
    });
  });

  it("derives the filename from the id", async () => {
    mockRequest.params = { id: "simple" };

    await new GetPromptByIdController(
      mockRequest as Request,
      mockResponse as Response
    ).handleRequest();

    const payload = jsonSpy.mock.calls[0]?.[0];

    expect(payload).toEqual({
      success: true,
      data: {
        id: "simple",
        filename: "simple.md",
        content: expect.any(String),
      },
    });
  });

  it("returns a 500 when the prompt is missing", async () => {
    mockRequest.params = { id: "does-not-exist" };

    await new GetPromptByIdController(
      mockRequest as Request,
      mockResponse as Response
    ).handleRequest();

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: "Failed to fetch prompt",
    });
  });

  it("returns a 500 when the id param is empty", async () => {
    mockRequest.params = {};

    await new GetPromptByIdController(
      mockRequest as Request,
      mockResponse as Response
    ).handleRequest();

    expect(statusSpy).toHaveBeenCalledWith(500);
    expect(jsonSpy).toHaveBeenCalledWith({
      success: false,
      error: "Failed to fetch prompt",
    });
  });
});
