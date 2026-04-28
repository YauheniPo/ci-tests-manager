import request from "supertest";
import { ObjectId } from "mongodb";
import { createApp } from "../app";

const mockFind = jest.fn();
const mockFindOne = jest.fn();
const mockInsertOne = jest.fn();
const mockFindOneAndUpdate = jest.fn();
const mockDeleteOne = jest.fn();

jest.mock("../db", () => ({
  getFiltersCollection: () => ({
    find: mockFind,
    findOne: mockFindOne,
    insertOne: mockInsertOne,
    findOneAndUpdate: mockFindOneAndUpdate,
    deleteOne: mockDeleteOne,
  }),
}));

const app = createApp();

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /filters", () => {
  it("returns filters for a valid targetBranch", async () => {
    const filters = [
      {
        _id: new ObjectId(),
        testId: "TP000001",
        targetBranch: "MASTER",
        reason: "flaky",
        author: "dev",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    mockFind.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ toArray: jest.fn().mockResolvedValue(filters) }),
    });

    const res = await request(app).get("/filters?targetBranch=MASTER");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].testId).toBe("TP000001");
  });

  it("passes reason as regex to MongoDB query", async () => {
    mockFind.mockReturnValue({
      sort: jest
        .fn()
        .mockReturnValue({ toArray: jest.fn().mockResolvedValue([]) }),
    });

    await request(app).get("/filters?targetBranch=MASTER&reason=JIRA-1234");

    expect(mockFind).toHaveBeenCalledWith({
      targetBranch: "MASTER",
      reason: { $regex: "JIRA-1234", $options: "i" },
    });
  });

  it("returns 400 for missing targetBranch", async () => {
    const res = await request(app).get("/filters");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body).toHaveProperty("details");
  });

  it("returns 400 for invalid targetBranch", async () => {
    const res = await request(app).get("/filters?targetBranch=DEVELOP");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid reason regex", async () => {
    const res = await request(app).get(
      "/filters?targetBranch=MASTER&reason=[invalid",
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 on database error", async () => {
    mockFind.mockImplementation(() => {
      throw new Error("db down");
    });

    const res = await request(app).get("/filters?targetBranch=MASTER");
    expect(res.status).toBe(500);
    expect(res.body.error).toBe("Internal server error");
  });
});

describe("GET /filters/:id", () => {
  it("returns a filter by valid ObjectId", async () => {
    const id = new ObjectId();
    const filter = {
      _id: id,
      testId: "TP000001",
      targetBranch: "MASTER",
      reason: "flaky",
      author: "dev",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockFindOne.mockResolvedValue(filter);

    const res = await request(app).get(`/filters/${id.toHexString()}`);
    expect(res.status).toBe(200);
    expect(res.body.testId).toBe("TP000001");
  });

  it("returns 400 for invalid ObjectId", async () => {
    const res = await request(app).get("/filters/not-an-id");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid id format");
  });

  it("returns 404 when filter not found", async () => {
    mockFindOne.mockResolvedValue(null);

    const res = await request(app).get(
      `/filters/${new ObjectId().toHexString()}`,
    );
    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Filter not found");
  });

  it("returns 500 on database error", async () => {
    mockFindOne.mockRejectedValue(new Error("db down"));

    const res = await request(app).get(
      `/filters/${new ObjectId().toHexString()}`,
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /filters", () => {
  const validBody = {
    testId: "TP000001",
    targetBranch: "MASTER",
    reason: "flaky test",
    author: "dev",
  };

  it("creates a filter and returns 201", async () => {
    const insertedId = new ObjectId();
    mockInsertOne.mockResolvedValue({ insertedId });

    const res = await request(app).post("/filters").send(validBody);

    expect(res.status).toBe(201);
    expect(res.body.testId).toBe("TP000001");
    expect(res.body.targetBranch).toBe("MASTER");
    expect(res.body._id).toBe(insertedId.toHexString());
  });

  it("returns 400 for invalid body", async () => {
    const res = await request(app).post("/filters").send({ testId: "BAD" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body).toHaveProperty("details");
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app).post("/filters").send({});
    expect(res.status).toBe(400);
  });

  it("returns 409 on duplicate key error", async () => {
    const duplicateError = Object.assign(new Error("duplicate"), {
      code: 11000,
    });
    mockInsertOne.mockRejectedValue(duplicateError);

    const res = await request(app).post("/filters").send(validBody);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already exists");
  });

  it("returns 500 on non-duplicate db error", async () => {
    mockInsertOne.mockRejectedValue(new Error("some db error"));

    const res = await request(app).post("/filters").send(validBody);
    expect(res.status).toBe(500);
  });
});

describe("PATCH /filters/:id", () => {
  it("updates reason and returns updated filter", async () => {
    const id = new ObjectId();
    const updated = {
      _id: id,
      testId: "TP000001",
      targetBranch: "MASTER",
      reason: "updated reason",
      author: "dev",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockFindOneAndUpdate.mockResolvedValue(updated);

    const res = await request(app)
      .patch(`/filters/${id.toHexString()}`)
      .send({ reason: "updated reason" });

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("updated reason");
  });

  it("updates author", async () => {
    const id = new ObjectId();
    mockFindOneAndUpdate.mockResolvedValue({
      _id: id,
      testId: "TP000001",
      targetBranch: "MASTER",
      reason: "flaky",
      author: "new-author",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await request(app)
      .patch(`/filters/${id.toHexString()}`)
      .send({ author: "new-author" });

    expect(res.status).toBe(200);
    expect(res.body.author).toBe("new-author");
  });

  it("returns 400 for invalid ObjectId", async () => {
    const res = await request(app)
      .patch("/filters/bad-id")
      .send({ reason: "x" });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid id format");
  });

  it("returns 400 when no fields provided", async () => {
    const id = new ObjectId();
    const res = await request(app)
      .patch(`/filters/${id.toHexString()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body).toHaveProperty("details");
  });

  it("returns 404 when filter not found", async () => {
    const id = new ObjectId();
    mockFindOneAndUpdate.mockResolvedValue(null);

    const res = await request(app)
      .patch(`/filters/${id.toHexString()}`)
      .send({ reason: "new" });

    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    const id = new ObjectId();
    mockFindOneAndUpdate.mockRejectedValue(new Error("db down"));

    const res = await request(app)
      .patch(`/filters/${id.toHexString()}`)
      .send({ reason: "x" });

    expect(res.status).toBe(500);
  });
});

describe("DELETE /filters/:id", () => {
  it("deletes a filter and returns 204", async () => {
    const id = new ObjectId();
    mockDeleteOne.mockResolvedValue({ deletedCount: 1 });

    const res = await request(app).delete(`/filters/${id.toHexString()}`);
    expect(res.status).toBe(204);
  });

  it("returns 400 for invalid ObjectId", async () => {
    const res = await request(app).delete("/filters/bad-id");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid id format");
  });

  it("returns 404 when filter not found", async () => {
    const id = new ObjectId();
    mockDeleteOne.mockResolvedValue({ deletedCount: 0 });

    const res = await request(app).delete(`/filters/${id.toHexString()}`);
    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    const id = new ObjectId();
    mockDeleteOne.mockRejectedValue(new Error("db down"));

    const res = await request(app).delete(`/filters/${id.toHexString()}`);
    expect(res.status).toBe(500);
  });
});
