import { SetupCodebaseHandler } from "../handlers/setupCodebaseHandler";
import { SetupGitHandler } from "../handlers/setupGitHandler";

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
    const codebaseId = await codebaseHandler.handle();

    const gitHandler = new SetupGitHandler(codebaseId, projectPath)
    await gitHandler.handle();
  }
}
