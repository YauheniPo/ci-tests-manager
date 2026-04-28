import request from "supertest";
import { createApp } from "../app";

const mockFind = jest.fn();

jest.mock("../db", () => ({
  getFiltersCollection: () => ({
    find: mockFind,
  }),
}));

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("POST /resolve", () => {
  it("returns disabled tests for MASTER (includes MASTER + PROD filters)", async () => {
    mockFind.mockReturnValue({
      toArray: jest
        .fn()
        .mockResolvedValue([
          { testId: "TP000002" },
          { testId: "TP000001" },
          { testId: "TP000003" },
        ]),
    });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.targetBranch).toBe("MASTER");
    expect(res.body.disabledTests).toEqual([
      "TP000001",
      "TP000002",
      "TP000003",
    ]);
    expect(res.body.resolvedAt).toBeDefined();
    expect(res.body.fallback).toBeUndefined();

    expect(mockFind).toHaveBeenCalledWith(
      { targetBranch: { $in: ["MASTER", "PROD"] } },
      { projection: { testId: 1, _id: 0 } },
    );
  });

  it("returns disabled tests for PROD (includes only PROD filters)", async () => {
    mockFind.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([{ testId: "TP000010" }]),
    });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "PROD" });

    expect(res.status).toBe(200);
    expect(res.body.targetBranch).toBe("PROD");
    expect(res.body.disabledTests).toEqual(["TP000010"]);

    expect(mockFind).toHaveBeenCalledWith(
      { targetBranch: { $in: ["PROD"] } },
      { projection: { testId: 1, _id: 0 } },
    );
  });

  it("deduplicates test IDs", async () => {
    mockFind.mockReturnValue({
      toArray: jest
        .fn()
        .mockResolvedValue([
          { testId: "TP000001" },
          { testId: "TP000001" },
          { testId: "TP000002" },
        ]),
    });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.body.disabledTests).toEqual(["TP000001", "TP000002"]);
  });

  it("returns sorted test IDs", async () => {
    mockFind.mockReturnValue({
      toArray: jest
        .fn()
        .mockResolvedValue([
          { testId: "TP000003" },
          { testId: "TP000001" },
          { testId: "TP000002" },
        ]),
    });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.body.disabledTests).toEqual([
      "TP000001",
      "TP000002",
      "TP000003",
    ]);
  });

  it("returns empty list when no filters exist", async () => {
    mockFind.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    });

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual([]);
    expect(res.body.fallback).toBeUndefined();
  });

  it("returns fallback:true on database failure (fail-open)", async () => {
    mockFind.mockReturnValue({
      toArray: jest.fn().mockRejectedValue(new Error("db down")),
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual([]);
    expect(res.body.fallback).toBe(true);

    consoleSpy.mockRestore();
  });

  it("returns 400 for missing targetBranch", async () => {
    const res = await request(app).post("/resolve").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body).toHaveProperty("details");
  });

  it("returns 400 for invalid targetBranch", async () => {
    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "STAGING" });
    expect(res.status).toBe(400);
  });

  it("returns fallback:true when find() throws synchronously", async () => {
    mockFind.mockImplementation(() => {
      throw new TypeError("unexpected");
    });

    const consoleSpy = jest.spyOn(console, "error").mockImplementation();

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    expect(res.status).toBe(200);
    expect(res.body.disabledTests).toEqual([]);
    expect(res.body.fallback).toBe(true);

    consoleSpy.mockRestore();
  });

  it("returns 500 when response building throws", async () => {
    mockFind.mockReturnValue({
      toArray: jest.fn().mockResolvedValue([]),
    });

    const original = Date.prototype.toISOString;
    Date.prototype.toISOString = () => {
      throw new Error("toISOString failed");
    };

    const res = await request(app)
      .post("/resolve")
      .send({ targetBranch: "MASTER" });

    Date.prototype.toISOString = original;

    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});
