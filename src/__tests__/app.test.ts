import request from "supertest";

const mockCommand = jest.fn();

jest.mock("../db", () => ({
  getFiltersCollection: jest.fn(),
  getDb: () => ({ command: mockCommand }),
}));

describe("App", () => {
  let createApp: typeof import("../app").createApp;

  beforeEach(() => {
    jest.resetModules();
    mockCommand.mockReset();
    jest.mock("../db", () => ({
      getFiltersCollection: jest.fn(),
      getDb: () => ({ command: mockCommand }),
    }));
  });

  describe("GET /health", () => {
    beforeEach(() => {
      createApp = require("../app").createApp;
    });

    it("returns 200 with mongo: connected when DB is healthy", async () => {
      mockCommand.mockResolvedValue({ ok: 1 });
      const app = createApp();
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
      expect(res.body.mongo).toBe("connected");
      expect(res.body.timestamp).toBeDefined();
    });

    it("returns 503 with mongo: unavailable when DB is down", async () => {
      mockCommand.mockRejectedValue(new Error("connection refused"));
      const app = createApp();
      const res = await request(app).get("/health");

      expect(res.status).toBe(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.mongo).toBe("unavailable");
      expect(res.body.timestamp).toBeDefined();
    });

    it("returns a valid ISO timestamp", async () => {
      mockCommand.mockResolvedValue({ ok: 1 });
      const app = createApp();
      const res = await request(app).get("/health");

      const date = new Date(res.body.timestamp);
      expect(date.toISOString()).toBe(res.body.timestamp);
    });
  });

  describe("Unknown routes", () => {
    beforeEach(() => {
      createApp = require("../app").createApp;
    });

    it("returns 404 for unknown paths", async () => {
      const app = createApp();
      const res = await request(app).get("/unknown-path");
      expect(res.status).toBe(404);
    });
  });

  describe("Swagger", () => {
    it("mounts /docs when swagger-output.json is available", async () => {
      jest.mock(
        "../../swagger-output.json",
        () => ({ info: { title: "Test" } }),
        { virtual: true },
      );

      createApp = require("../app").createApp;
      const app = createApp();
      const res = await request(app).get("/docs/");

      expect(res.status).not.toBe(404);
    });

    it("logs a warning when swagger-output.json is not found", () => {
      jest.mock(
        "../../swagger-output.json",
        () => {
          throw new Error("Cannot find module");
        },
        { virtual: true },
      );

      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      createApp = require("../app").createApp;
      createApp();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("swagger-output.json not found"),
      );

      warnSpy.mockRestore();
    });
  });
});
