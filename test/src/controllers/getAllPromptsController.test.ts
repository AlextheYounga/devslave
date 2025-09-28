import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from "@jest/globals";
import { Request, Response } from "express";
import GetAllPromptsController from "../../../src/controllers/getAllPrompts.controller";
import path from "path";

const fixturesPromptsDir = path.join(__dirname, "../../fixtures/prompts");
const originalResolve = path.resolve;
let resolveSpy: jest.SpiedFunction<typeof path.resolve>;

describe("getAllPromptsController", () => {
  let mockResponse: Partial<Response>;
  let mockRequest: Partial<Request>;
  let jsonSpy: jest.MockedFunction<any>;
  let statusSpy: jest.MockedFunction<any>;

  beforeAll(() => {
    resolveSpy = jest
      .spyOn(path, "resolve")
      .mockImplementation((...segments: string[]) => {
        const lastSegment = segments[segments.length - 1];
        if (lastSegment === "../prompts") {
          return fixturesPromptsDir;
        }

        return originalResolve(...segments);
      });
  });

  afterAll(() => {
    resolveSpy.mockRestore();
  });

  beforeEach(() => {
    // Setup mock response
    jsonSpy = jest.fn();
    statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    mockResponse = {
      json: jsonSpy as any,
      status: statusSpy as any,
    };
    mockRequest = { };
  });

  describe("successful retrieval", () => {
    it("should return all prompt files with correct structure", async () => {
      await new GetAllPromptsController(
        mockRequest as Request,
        mockResponse as Response
      ).handleRequest();

      const callArgs = jsonSpy.mock.calls[0]?.[0] as any;
      expect(callArgs.success).toBe(true);
      expect(Array.isArray(callArgs.data)).toBe(true);

      // Check that each item has the expected nested structure
      callArgs.data.forEach((prompt: any) => {
        expect(prompt).toHaveProperty("success", true);
        expect(prompt).toHaveProperty("data");
        expect(prompt.data).toHaveProperty("id");
        expect(prompt.data).toHaveProperty("filename");
        expect(prompt.data).toHaveProperty("content");
      });
    });

    it("should extract correct id from filename", async () => {
      await new GetAllPromptsController(
        mockRequest as Request,
        mockResponse as Response
      ).handleRequest();

      const callArgs = jsonSpy.mock.calls[0]?.[0] as any;
      const prompts = callArgs?.data;

      prompts.forEach((prompt: any) => {
        expect(prompt.success).toBe(true);
        expect(prompt.data.id).toBe(prompt.data.filename.split(".")[0]);
      });
    });
  });

  describe("response format validation", () => {
    it("should always return success boolean", async () => {
      await new GetAllPromptsController(
        mockRequest as Request,
        mockResponse as Response
      ).handleRequest();

      const callArgs = jsonSpy.mock.calls[0]?.[0] as any;
      expect(typeof callArgs?.success).toBe("boolean");
    });

    it("should return data array on success", async () => {
      await new GetAllPromptsController(
        mockRequest as Request,
        mockResponse as Response
      ).handleRequest();

      const callArgs = jsonSpy.mock.calls[0]?.[0] as any;
      expect(Array.isArray(callArgs?.data)).toBe(true);
    });

    it("should have proper nested structure for each prompt", async () => {
      await new GetAllPromptsController(
        mockRequest as Request,
        mockResponse as Response
      ).handleRequest();

      const callArgs = jsonSpy.mock.calls[0]?.[0] as any;
      const prompts = callArgs?.data;

      prompts.forEach((prompt: any) => {
        expect(prompt).toHaveProperty("success");
        expect(prompt).toHaveProperty("data");
        expect(typeof prompt.success).toBe("boolean");
        expect(typeof prompt.data).toBe("object");
        expect(prompt.data).toHaveProperty("id");
        expect(prompt.data).toHaveProperty("filename");
        expect(prompt.data).toHaveProperty("content");
      });
    });
  });
});
