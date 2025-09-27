import { SetupCodebaseHandler } from "../handlers/setupCodebaseHandler";
import {
  CodebaseSetupStarted,
  CodebaseSetupCompleted,
  CodebaseSetupFailed,
} from "../events";

type StartProjectJobData = {
  id: string;
  payload: {
    name: string;
    projectPath: string;
    params: any;
  };
};

interface Job {
  perform(): Promise<CodebaseSetupCompleted | CodebaseSetupFailed>;
}

export default class StartProjectJob implements Job {
  public id: string;
  public payload: StartProjectJobData["payload"];

  constructor(data: StartProjectJobData) {
    this.id = data.id;
    this.payload = data.payload;
  }

  async perform() {
    const { name, projectPath, params } = this.payload;

    new CodebaseSetupStarted({
      jobId: this.id,
      name,
      projectPath,
      params,
    }).publish();

    try {
      const codebaseHandler = new SetupCodebaseHandler(
        name,
        projectPath,
        params
      );
      const result = await codebaseHandler.handle();

      return new CodebaseSetupCompleted({
        jobId: this.id,
        codebaseId: result.codebaseId,
        branchId: result.branchId,
        name,
        projectPath,
        params,
        stdout: result.stdout,
      }).publish();
    } catch (error: any) {
      console.error(error.message);
      return new CodebaseSetupFailed({
        jobId: this.id,
        name,
        projectPath,
        params,
        error: error.message,
      }).publish();
    }
  }
}
