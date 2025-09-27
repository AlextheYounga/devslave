import StartProjectJob from "../../src/jobs/startProject.job";
import {
  CodebaseSetupStartedEvent,
  CodebaseSetupCompletedEvent,
} from "../../src/events";
import { SetupCodebaseHandler } from "../../src/handlers/setupCodebaseHandler";

// Mock the events module
jest.mock("../../src/events");
jest.mock("../../src/handlers/setupCodebaseHandler");

const MockedCodebaseSetupStartedEvent = CodebaseSetupStartedEvent as jest.MockedClass<typeof CodebaseSetupStartedEvent>;
const MockedCodebaseSetupCompletedEvent = CodebaseSetupCompletedEvent as jest.MockedClass<typeof CodebaseSetupCompletedEvent>;
const MockedSetupCodebaseHandler = SetupCodebaseHandler as jest.MockedClass<typeof SetupCodebaseHandler>;

describe("StartProjectJob", () => {
  const mockJobData = {
    id: "mockJobId",
    payload: {
      name: "mockProject",
      projectPath: "/mock/path",
      params: { setup: "test" },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mocks
    const mockStartedEventInstance = { publish: jest.fn().mockReturnValue(undefined) };
    const mockCompletedEventInstance = { publish: jest.fn().mockReturnValue(undefined) };
    const mockHandlerInstance = { 
      handle: jest.fn().mockResolvedValue({
        codebaseId: "mockCodebaseId",
        branchId: "mockBranchId",
        stdout: "Mock setup output\nProject setup completed successfully",
      })
    };

    MockedCodebaseSetupStartedEvent.mockImplementation(() => mockStartedEventInstance as any);
    MockedCodebaseSetupCompletedEvent.mockImplementation(() => mockCompletedEventInstance as any);
    MockedSetupCodebaseHandler.mockImplementation(() => mockHandlerInstance as any);
  });

  it("should publish CodebaseSetupStartedEvent and CodebaseSetupCompletedEvent", async () => {
    const job = new StartProjectJob(mockJobData);
    await job.perform();

    // Verify CodebaseSetupStartedEvent was created with correct parameters
    expect(MockedCodebaseSetupStartedEvent).toHaveBeenCalledWith({
      jobId: mockJobData.id,
      name: mockJobData.payload.name,
      projectPath: mockJobData.payload.projectPath,
      params: mockJobData.payload.params,
    });

    // Verify SetupCodebaseHandler was created and called with correct parameters
    expect(MockedSetupCodebaseHandler).toHaveBeenCalledWith(
      mockJobData.payload.name,
      mockJobData.payload.projectPath,
      mockJobData.payload.params
    );

    // Verify CodebaseSetupCompletedEvent was created with correct parameters
    expect(MockedCodebaseSetupCompletedEvent).toHaveBeenCalledWith({
      jobId: mockJobData.id,
      codebaseId: "mockCodebaseId",
      branchId: "mockBranchId",
      name: mockJobData.payload.name,
      projectPath: mockJobData.payload.projectPath,
      params: mockJobData.payload.params,
      stdout: "Mock setup output\nProject setup completed successfully",
    });

    // Verify publish methods were called
    const startedEventInstance = MockedCodebaseSetupStartedEvent.mock.results[0]?.value;
    const completedEventInstance = MockedCodebaseSetupCompletedEvent.mock.results[0]?.value;
    const handlerInstance = MockedSetupCodebaseHandler.mock.results[0]?.value;

    expect(startedEventInstance?.publish).toHaveBeenCalled();
    expect(handlerInstance?.handle).toHaveBeenCalled();
    expect(completedEventInstance?.publish).toHaveBeenCalled();
  });
});