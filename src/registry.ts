interface Job {
  perform(): Promise<void>;
}

interface JobConstructor<T = any> {
  new (data: T): Job;
}

export class JobRegistry {
  private static jobMap: Map<string, string> = new Map();

  static register(jobType: string, filePath: string) {
    this.jobMap.set(jobType, filePath);
  }

  static async getJobClass(jobType: string): Promise<JobConstructor | null> {
    const filePath = this.jobMap.get(jobType);
    if (!filePath) return null;

    try {
      const module = await import(filePath) as { default?: JobConstructor; [key: string]: any };
      if (module.default) return module.default; // Assume the default export is the job class
      return null;
    } catch (error) {
      console.error(`Failed to load job class for type ${jobType}:`, error);
      return null;
    }
  }

  static getRegisteredJobs(): string[] {
    return Array.from(this.jobMap.keys());
  }
}

// Register known jobs using class names
JobRegistry.register("StartProjectJob", "./jobs/startProject.job");
JobRegistry.register("StartAgentJob", "./jobs/startAgent.job");
