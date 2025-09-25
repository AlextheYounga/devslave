import { SetupCodebaseHandler } from "../handlers/setupCodebaseHandler";

type StartProjectJobData = {
  name: string;
  projectPath: string;
};

interface Job {
  perform(): Promise<void>;
}

export default class StartProjectJob implements Job {
  public data: StartProjectJobData;

  constructor(data: StartProjectJobData) {
    this.data = data;
  }

  async perform() {
    const { name, projectPath } = this.data;

    const codebaseHandler = new SetupCodebaseHandler(name, projectPath)
    return await codebaseHandler.handle();
  }
}
