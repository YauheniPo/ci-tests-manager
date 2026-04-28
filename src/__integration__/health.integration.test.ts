import { setupIntegration, teardownIntegration, request } from "./setup";
import { Express } from "express";

let app: Express;

beforeAll(async () => {
  const ctx = await setupIntegration();
  app = ctx.app;
});

afterAll(async () => {
  await teardownIntegration();
});

describe("GET /health", () => {
  it("returns ok status", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.timestamp).toBeDefined();
  });

  it("returns a valid ISO timestamp", async () => {
    const res = await request(app).get("/health");

    const date = new Date(res.body.timestamp);
    expect(date.toISOString()).toBe(res.body.timestamp);
  });
});

describe("Unknown routes", () => {
  it("returns 404 for non-existent endpoints", async () => {
    const res = await request(app).get("/non-existent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for wrong HTTP method on known routes", async () => {
    const res = await request(app).put("/filters");
    expect(res.status).toBe(404);
  });
});
