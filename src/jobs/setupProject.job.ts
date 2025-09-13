import { SetupDevFolderHandler } from "../handlers/setupDevFolderHandler";

type SetupProjectJobData = {
  name: string;
  projectPath: string;
};
export class SetupProjectJob {
  constructor() {}

  perform(data: SetupProjectJobData) {
    const { name, projectPath } = data;
    new SetupDevFolderHandler(name, projectPath).handle();
  }
}
