import { Worker } from "../../src/worker";
import { JobQueue } from "../../src/queue";
import { prisma } from "../../src/prisma";
import { JobRegistry } from "../../src/registry";

interface Job {
  perform(): Promise<void>;
}

type TestJobData = {
  id: string;
  payload: {
    message: string;
  };
};

class TestJob implements Job {
  public id: string;
  public payload: TestJobData["payload"];

  constructor(data: TestJobData) {
    this.id = data.id;
    this.payload = data.payload;
  }

  async perform(): Promise<void> {
    console.log(this.payload.message);
  }
}

describe("Worker", () => {
  let worker: Worker;
  let jobQueue: JobQueue;

  beforeEach(() => {
    worker = new Worker(true);
    jobQueue = new JobQueue();
  });

  describe("job processing behavior", () => {
    it("should process a test job successfully", async () => {
      // Arrange
      const jobData = {
        message: "I love you",
      };

      const job = await jobQueue.enqueue("TestJob", JSON.stringify(jobData));

      // Mock JobRegistry to return our TestJob
      const getJobClassSpy = jest.spyOn(JobRegistry, "getJobClass");
      getJobClassSpy.mockResolvedValue(TestJob);

      // Mock the perform method to track execution
      const performSpy = jest.spyOn(TestJob.prototype, "perform");
      performSpy.mockResolvedValue();

      // Act - process jobs until empty
      await worker.process();

      // Assert
      const processedJob = await prisma.job.findUnique({
        where: { id: job.id },
      });
      expect(processedJob?.status).toBe("completed");
      expect(performSpy).toHaveBeenCalled();
      expect(getJobClassSpy).toHaveBeenCalledWith("TestJob");

      // Cleanup
      performSpy.mockRestore();
      getJobClassSpy.mockRestore();
    });

    it("should handle job processing failure", async () => {
      // Arrange
      const jobData = {
        message: "This will fail",
      };

      const job = await jobQueue.enqueue("TestJob", JSON.stringify(jobData));

      // Mock JobRegistry to return our TestJob
      const getJobClassSpy = jest.spyOn(JobRegistry, "getJobClass");
      getJobClassSpy.mockResolvedValue(TestJob);

      // Mock the perform method to throw an error
      const performSpy = jest.spyOn(TestJob.prototype, "perform");
      performSpy.mockRejectedValue(new Error("Processing failed"));

      // Act
      await worker.process();

      // Assert
      const processedJob = await prisma.job.findUnique({
        where: { id: job.id },
      });
      expect(processedJob?.status).toBe("failed");
      expect(performSpy).toHaveBeenCalled();

      // Cleanup
      performSpy.mockRestore();
      getJobClassSpy.mockRestore();
    });

    it("should handle unknown job types gracefully", async () => {
      // Arrange
      const job = await jobQueue.enqueue("unknownJobType", JSON.stringify({}));

      // Mock JobRegistry to return null for unknown job type
      const getJobClassSpy = jest.spyOn(JobRegistry, "getJobClass");
      getJobClassSpy.mockResolvedValue(null);

      // Act
      await worker.process();

      // Assert
      const processedJob = await prisma.job.findUnique({
        where: { id: job.id },
      });
      expect(processedJob?.status).toBe("failed");
      expect(getJobClassSpy).toHaveBeenCalledWith("unknownJobType");

      // Cleanup
      getJobClassSpy.mockRestore();
    });

    it("should stop when no jobs are available and stopOnEmpty is true", async () => {
      // Act - worker should stop immediately since there are no jobs
      await worker.process();

      // Assert - worker should complete without processing any jobs
      expect(true).toBe(true); // Test passes if process() completes without hanging
    });

    it("should fail jobs that have exceeded max retries", async () => {
      // Arrange
      const jobData = { message: "This job will exceed retries" };
      const job = await jobQueue.enqueue("TestJob", JSON.stringify(jobData));

      // Manually set the job to have exceeded retries
      await prisma.job.update({
        where: { id: job.id },
        data: { retries: 3 },
      });

      // Act
      await worker.process();

      // Assert
      const processedJob = await prisma.job.findUnique({
        where: { id: job.id },
      });
      expect(processedJob?.status).toBe("failed");
    });

    it("should handle blocking jobs synchronously", async () => {
      // Arrange
      const jobData = { message: "Blocking job message" };
      const job = await jobQueue.enqueue("TestJob", JSON.stringify(jobData));

      // Set job as blocking
      await prisma.job.update({
        where: { id: job.id },
        data: { blocking: true },
      });

      // Mock JobRegistry to return our TestJob
      const getJobClassSpy = jest.spyOn(JobRegistry, "getJobClass");
      getJobClassSpy.mockResolvedValue(TestJob);

      const performSpy = jest.spyOn(TestJob.prototype, "perform");
      performSpy.mockResolvedValue();

      // Act
      await worker.process();

      // Assert
      const processedJob = await prisma.job.findUnique({
        where: { id: job.id },
      });
      expect(processedJob?.status).toBe("completed");
      expect(performSpy).toHaveBeenCalled();

      // Cleanup
      performSpy.mockRestore();
      getJobClassSpy.mockRestore();
    });
  });
});
