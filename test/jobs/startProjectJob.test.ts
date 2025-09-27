import StartProjectJob from "../../src/jobs/startProject.job";
import { SetupCodebaseHandler } from "../../src/handlers/setupCodebaseHandler";
import { prisma } from "../../src/prisma";

// Only mock the handler to avoid shell scripts; use real events so they persist to DB
jest.mock("../../src/handlers/setupCodebaseHandler");
const MockedSetupCodebaseHandler =
  SetupCodebaseHandler as jest.MockedClass<typeof SetupCodebaseHandler>;

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
    const mockHandlerInstance = { 
      handle: jest.fn().mockResolvedValue({
        codebaseId: "mockCodebaseId",
        branchId: "mockBranchId",
        stdout: "Mock setup output\nProject setup completed successfully",
      })
    };
    MockedSetupCodebaseHandler.mockImplementation(() => mockHandlerInstance as any);
  });

  // Helper to wait for events to be written since publish() is fire-and-forget
  async function waitForEventCount(expected: number, timeoutMs = 1000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const count = await prisma.events.count();
      if (count >= expected) return;
      await new Promise((r) => setTimeout(r, 25));
    }
    throw new Error(`Timed out waiting for ${expected} events`);
  }

  it("should persist the job and publish CodebaseSetupStarted and CodebaseSetupCompleted events to the DB", async () => {
    // Seed a Job record like the worker would do
    await prisma.job.create({
      data: {
        id: mockJobData.id,
        type: "StartProjectJob",
        payload: mockJobData.payload as any,
        status: "pending",
        blocking: true,
        retries: 0,
      },
    });

    const job = new StartProjectJob(mockJobData);
    await job.perform();

    // Wait for async event publishes to hit the DB
    await waitForEventCount(2);

    // Verify the Job exists in the DB
    const dbJob = await prisma.job.findUnique({ where: { id: mockJobData.id } });
    expect(dbJob).toBeTruthy();
    expect(dbJob?.type).toBe("StartProjectJob");
    expect((dbJob?.payload as any)?.name).toBe(mockJobData.payload.name);
    expect((dbJob?.payload as any)?.projectPath).toBe(
      mockJobData.payload.projectPath
    );

    // Verify SetupCodebaseHandler was created and called with correct parameters
    expect(MockedSetupCodebaseHandler).toHaveBeenCalledWith(
      mockJobData.payload.name,
      mockJobData.payload.projectPath,
      mockJobData.payload.params
    );

    // Fetch and verify events from the DB
    const startedEvents = await prisma.events.findMany({
      where: { type: "CodebaseSetupStarted" },
    });
    const completedEvents = await prisma.events.findMany({
      where: { type: "CodebaseSetupCompleted" },
    });

    expect(startedEvents.length).toBe(1);
    expect(completedEvents.length).toBe(1);

    const started = startedEvents[0]!;
    const completed = completedEvents[0]!;

    // Events store payload as { data: <payload> }
    const startedData = (started.data as any)?.data;
    const completedData = (completed.data as any)?.data;

    expect(startedData).toMatchObject({
      jobId: mockJobData.id,
      name: mockJobData.payload.name,
      projectPath: mockJobData.payload.projectPath,
      params: mockJobData.payload.params,
    });

    expect(completedData).toMatchObject({
      jobId: mockJobData.id,
      codebaseId: "mockCodebaseId",
      branchId: "mockBranchId",
      name: mockJobData.payload.name,
      projectPath: mockJobData.payload.projectPath,
      params: mockJobData.payload.params,
      stdout: "Mock setup output\nProject setup completed successfully",
    });
  });
});