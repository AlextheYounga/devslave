import { SetupCodebaseHandler } from "../handlers/setupCodebaseHandler";
import {
  CodebaseSetupStartedEvent,
  CodebaseSetupCompletedEvent,
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
  perform(): Promise<CodebaseSetupCompletedEvent>;
}

export default class StartAgentJob implements Job {
  public id: string;
  public payload: StartProjectJobData["payload"];

  constructor(data: StartProjectJobData) {
    this.id = data.id;
    this.payload = data.payload;
  }

  async perform() {
    const { name, projectPath, params } = this.payload;

    new CodebaseSetupStartedEvent({ jobId: this.id, name, projectPath, params }).fire();

    const codebaseHandler = new SetupCodebaseHandler(name, projectPath, params);
    const result = await codebaseHandler.handle();

    return new CodebaseSetupCompletedEvent({
      jobId: this.id,
      codebaseId: result.codebaseId,
      branchId: result.branchId,
      name,
      projectPath,
      params,
    }).fire();
  }
}
