import prisma from "../../client";
import GetCodebaseHandler from "../../../src/handlers/getCodebase.handler";

describe("GetCodebaseHandler", () => {
  it("returns the codebase when it exists", async () => {
    const codebase = await prisma.codebase.create({
      data: {
        name: "existing",
        path: "/tmp/existing",
        setup: true,
      },
    });

    const handler = new GetCodebaseHandler(codebase.id);
    const result = await handler.handle();

    expect(result).toMatchObject({
      id: codebase.id,
      name: codebase.name,
      path: codebase.path,
    });
  });

  it("throws when the codebase cannot be found", async () => {
    const handler = new GetCodebaseHandler("missing-id");

    await expect(handler.handle()).rejects.toThrow();
  });
});
