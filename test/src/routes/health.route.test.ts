import routes from "../../../src/routes";
import HealthController from "../../../src/controllers/health.controller";

describe("Health route", () => {
    const findHealthRoute = () =>
        routes.stack.find((layer: any) => layer.route?.path === "/health");

    const makeResponse = () => ({
        json: jest.fn(),
    });

    it("registers GET /health on the router", () => {
        const layer = findHealthRoute();
        expect(layer).toBeDefined();
        const methods = Object.keys((layer!.route as any).methods);
        expect(methods).toContain("get");
    });

    it("returns ok payload with ISO timestamp", () => {
        const res = makeResponse();
        const controller = new HealthController({} as any, res as any);

        controller.check();

        expect(res.json).toHaveBeenCalledTimes(1);
        const payload = res.json.mock.calls[0][0];
        expect(payload.status).toBe("ok");
        expect(typeof payload.timestamp).toBe("string");
        expect(() => new Date(payload.timestamp)).not.toThrow();
    });
});
