import { DEFAULT_APP_BASE_URL } from "../../../src/constants";
import { killAgent } from "../../../src/cli/index";

describe("killAgent", () => {
    const originalFetch = global.fetch;
    const fetchMock = jest.fn();

    beforeEach(() => {
        fetchMock.mockReset();
        global.fetch = fetchMock as any;
    });

    afterAll(() => {
        global.fetch = originalFetch;
    });

    it("calls the kill endpoint for the agent", async () => {
        fetchMock.mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => "",
        });

        await killAgent({ id: "agent-123" } as any);

        expect(fetchMock).toHaveBeenCalledWith(
            `${DEFAULT_APP_BASE_URL}/api/agent/agent-123/kill`,
            expect.objectContaining({
                method: "POST",
            }),
        );
    });
});
