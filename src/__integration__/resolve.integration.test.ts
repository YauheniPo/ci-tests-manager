import {
  setupIntegration,
  teardownIntegration,
  clearCollection,
  request,
} from "./setup";
import { Express } from "express";

let app: Express;

beforeAll(async () => {
  const ctx = await setupIntegration();
  app = ctx.app;
});

afterAll(async () => {
  await teardownIntegration();
});

beforeEach(async () => {
  await clearCollection();
});

async function createFilter(overrides: Record<string, string> = {}) {
  const defaults = {
    testId: "TP000001",
    targetBranch: "MASTER",
    reason: "flaky",
    author: "dev",
  };
  return request(app)
    .post("/filters")
    .send({ ...defaults, ...overrides });
}

describe("POST /resolve", () => {
  it("returns empty list when no filters exist", async () => {
    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.targetBranch).toBe("MASTER");
    expect(res.body.disabledTests).toEqual([]);
    expect(res.body.resolvedAt).toBeDefined();
    expect(res.body.fallback).toBeUndefined();
  });

  it("returns MASTER filters for MASTER target", async () => {
    await createFilter({ testId: "TP000001", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000002", targetBranch: "MASTER" });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual(["TP000001", "TP000002"]);
  });

  it("includes PROD filters when resolving MASTER", async () => {
    await createFilter({ testId: "TP000001", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000002", targetBranch: "PROD" });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual(["TP000001", "TP000002"]);
  });

  it("excludes MASTER filters when resolving PROD", async () => {
    await createFilter({ testId: "TP000001", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000002", targetBranch: "PROD" });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "PROD" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual(["TP000002"]);
  });

  it("deduplicates tests present on both MASTER and PROD", async () => {
    await createFilter({ testId: "TP000001", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000001", targetBranch: "PROD" });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.body.disabledTests).toEqual(["TP000001"]);
  });

  it("returns sorted test IDs", async () => {
    await createFilter({ testId: "TP000003", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000001", targetBranch: "MASTER" });
    await createFilter({ testId: "TP000002", targetBranch: "MASTER" });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.body.disabledTests).toEqual([
      "TP000001",
      "TP000002",
      "TP000003",
    ]);
  });

  it("reflects filter deletion immediately", async () => {
    const created = await createFilter({
      testId: "TP000001",
      targetBranch: "MASTER",
    });

    let res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });
    expect(res.body.disabledTests).toContain("TP000001");

    await request(app).delete(`/filters/${created.body._id}`);

    res = await request(app).post("/resolve").send({ targetBranch: "MASTER" });
    expect(res.body.disabledTests).not.toContain("TP000001");
  });

  it("reflects filter creation immediately", async () => {
    let res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });
    expect(res.body.disabledTests).toEqual([]);

    await createFilter({ testId: "TP000005", targetBranch: "MASTER" });

    res = await request(app).post("/resolve").send({ targetBranch: "MASTER" });
    expect(res.body.disabledTests).toEqual(["TP000005"]);
  });

  it("returns 400 for invalid targetBranch", async () => {
    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "STAGING" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 for missing body", async () => {
    const res = await request(app).post("/resolve").send({});
    expect(res.status).toBe(400);
  });

  it("handles concurrent /resolve requests deterministically", async () => {
    const { config } = await import("../config");
    const concurrency = config.mongo.maxPoolSize;

    const testIds = Array.from({ length: concurrency }, (_, i) => {
      const id = String(i + 1).padStart(6, "0");
      return `TP${id}`;
    });

    for (let i = 0; i < testIds.length; i++) {
      await createFilter({
        testId: testIds[i],
        targetBranch: i % 2 === 0 ? "MASTER" : "PROD",
      });
    }

    const results = await Promise.all(
      Array.from({ length: concurrency }, () =>
        request(app).post("/resolve").send({ targetBranch: "MASTER" }),
      ),
    );

    const expected = [...testIds].sort();

    results.forEach((res) => {
      expect(res.status).toBe(200);
      expect(res.body.disabledTests).toEqual(expected);
      expect(res.body.fallback).toBeUndefined();
    });
  });

  it("returns resolvedAt as a valid ISO timestamp", async () => {
    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    const date = new Date(res.body.resolvedAt);
    expect(date.toISOString()).toBe(res.body.resolvedAt);
  });
});
