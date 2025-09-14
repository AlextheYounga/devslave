import { Worker } from "../../src/worker";
import { JobQueue } from "../../src/queue";
import { prisma } from "../../src/prisma";
import StartProjectJob from "../../src/jobs/startProject.job";

describe("Worker", () => {
  let worker: Worker;
  let jobQueue: JobQueue;

  beforeEach(() => {
    worker = new Worker();
    jobQueue = new JobQueue();
  });

  describe("process", () => {
    it("should process a startProject job successfully", async () => {
      // Arrange
      const jobData = {
        name: "test-project",
        projectPath: "/tmp/test-project"
      };

      const job = await jobQueue.enqueue("startProject", JSON.stringify(jobData));

      // Mock the perform method to avoid actual file system operations
      const performSpy = jest.spyOn(StartProjectJob.prototype, "perform");
      performSpy.mockResolvedValue(undefined);

      // Act
      await worker.processSingleJob();

      // Assert
      const processedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(processedJob?.status).toBe("completed");
      expect(performSpy).toHaveBeenCalled();
    });

    it("should handle job processing failure", async () => {
      // Arrange
      const jobData = {
        name: "test-project",
        projectPath: "/tmp/test-project"
      };

      const job = await jobQueue.enqueue("startProject", JSON.stringify(jobData));

      // Mock the perform method to throw an error
      const performSpy = jest.spyOn(StartProjectJob.prototype, "perform");
      performSpy.mockRejectedValue(new Error("Processing failed"));

      // Act
      await worker.processSingleJob();

      // Assert
      const processedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(processedJob?.status).toBe("failed");
      expect(performSpy).toHaveBeenCalled();
    });

    it("should handle unknown job types gracefully", async () => {
      // Arrange
      const job = await jobQueue.enqueue("unknownJobType", JSON.stringify({}));

      // Act
      await worker.processSingleJob();

      // Assert
      const processedJob = await prisma.job.findUnique({ where: { id: job.id } });
      expect(processedJob?.status).toBe("failed");
    });
  });
});
