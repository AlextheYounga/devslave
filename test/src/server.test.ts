import request from "supertest";
import express from "express";
import cors from "cors";
import routes from "../../src/routes";
import { describe, it, expect } from "@jest/globals";

// Build an in-memory Express app similar to src/server.ts
function buildApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use("/", routes);
  return app;
}

describe("GET /health", () => {
  const app = buildApp();

  it("returns 200 with status ok and a timestamp", async () => {
    const res = await request(app).get("/health").expect(200);

    expect(res.body).toEqual(
      expect.objectContaining({
        status: "ok",
        timestamp: expect.any(String),
      })
    );

    // Validate timestamp looks like an ISO string
    const ts: string = res.body.timestamp;
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(new Date(ts).toString()).not.toBe("Invalid Date");
  });
});
