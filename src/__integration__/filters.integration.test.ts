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

const validFilter = {
  testId: "TP000001",
  targetBranch: "MASTER",
  reason: "Flaky auth test JIRA-1234",
  author: "john.doe",
};

describe("POST /filters", () => {
  it("creates a filter and persists it in the database", async () => {
    const res = await request(app).post("/filters").send(validFilter);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      testId: "TP000001",
      targetBranch: "MASTER",
      reason: "Flaky auth test JIRA-1234",
      author: "john.doe",
    });
    expect(res.body._id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.updatedAt).toBeDefined();

    const getRes = await request(app).get(`/filters/${res.body._id}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.testId).toBe("TP000001");
  });

  it("returns 409 on duplicate testId + targetBranch", async () => {
    await request(app).post("/filters").send(validFilter);

    const res = await request(app).post("/filters").send(validFilter);
    expect(res.status).toBe(409);
    expect(res.body.error).toContain("already exists");
  });

  it("allows same testId on different branches", async () => {
    const res1 = await request(app).post("/filters").send(validFilter);
    const res2 = await request(app)
      .post("/filters")
      .send({ ...validFilter, targetBranch: "PROD" });

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });

  it("returns 400 for invalid testId format", async () => {
    const res = await request(app)
      .post("/filters")
      .send({ ...validFilter, testId: "INVALID" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Validation failed");
    expect(res.body.details).toBeDefined();
  });

  it("returns 400 for missing required fields", async () => {
    const res = await request(app).post("/filters").send({});
    expect(res.status).toBe(400);
  });

  it("trims whitespace from reason and author", async () => {
    const res = await request(app)
      .post("/filters")
      .send({
        ...validFilter,
        reason: "  padded reason  ",
        author: "  padded  ",
      });

    expect(res.status).toBe(201);
    expect(res.body.reason).toBe("padded reason");
    expect(res.body.author).toBe("padded");
  });
});

describe("GET /filters", () => {
  beforeEach(async () => {
    await request(app).post("/filters").send(validFilter);
    await request(app)
      .post("/filters")
      .send({
        ...validFilter,
        testId: "TP000002",
        targetBranch: "PROD",
        reason: "JIRA-5678 perf issue",
      });
    await request(app)
      .post("/filters")
      .send({
        ...validFilter,
        testId: "TP000003",
        reason: "JIRA-1234 race condition",
      });
  });

  it("returns filters by targetBranch", async () => {
    const res = await request(app).get("/filters?targetBranch=MASTER");

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    res.body.forEach((f: { targetBranch: string }) => {
      expect(f.targetBranch).toBe("MASTER");
    });
  });

  it("filters by reason regex", async () => {
    const res = await request(app).get(
      "/filters?targetBranch=MASTER&reason=JIRA-1234",
    );

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });

  it("returns empty array when no matches", async () => {
    const res = await request(app).get(
      "/filters?targetBranch=MASTER&reason=NONEXISTENT",
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns filters sorted by createdAt desc", async () => {
    const res = await request(app).get("/filters?targetBranch=MASTER");

    expect(res.status).toBe(200);
    const dates = res.body.map((f: { createdAt: string }) =>
      new Date(f.createdAt).getTime(),
    );
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });

  it("returns 400 for missing targetBranch", async () => {
    const res = await request(app).get("/filters");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid reason regex", async () => {
    const res = await request(app).get(
      "/filters?targetBranch=MASTER&reason=[invalid",
    );
    expect(res.status).toBe(400);
  });
});

describe("GET /filters/:id", () => {
  it("returns a filter by ID", async () => {
    const created = await request(app).post("/filters").send(validFilter);
    const res = await request(app).get(`/filters/${created.body._id}`);

    expect(res.status).toBe(200);
    expect(res.body.testId).toBe("TP000001");
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await request(app).get("/filters/aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed ID", async () => {
    const res = await request(app).get("/filters/not-valid");
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("Invalid id format");
  });
});

describe("PATCH /filters/:id", () => {
  let filterId: string;

  beforeEach(async () => {
    const created = await request(app).post("/filters").send(validFilter);
    filterId = created.body._id;
  });

  it("updates reason", async () => {
    const res = await request(app)
      .patch(`/filters/${filterId}`)
      .send({ reason: "Updated reason" });

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("Updated reason");
    expect(res.body.author).toBe("john.doe");
  });

  it("updates author", async () => {
    const res = await request(app)
      .patch(`/filters/${filterId}`)
      .send({ author: "jane.doe" });

    expect(res.status).toBe(200);
    expect(res.body.author).toBe("jane.doe");
  });

  it("updates both reason and author", async () => {
    const res = await request(app)
      .patch(`/filters/${filterId}`)
      .send({ reason: "new reason", author: "new author" });

    expect(res.status).toBe(200);
    expect(res.body.reason).toBe("new reason");
    expect(res.body.author).toBe("new author");
  });

  it("sets updatedAt to a newer date", async () => {
    const before = await request(app).get(`/filters/${filterId}`);

    await new Promise((r) => setTimeout(r, 50));

    const res = await request(app)
      .patch(`/filters/${filterId}`)
      .send({ reason: "bump" });

    expect(new Date(res.body.updatedAt).getTime()).toBeGreaterThan(
      new Date(before.body.updatedAt).getTime(),
    );
  });

  it("returns 400 when no fields provided", async () => {
    const res = await request(app).patch(`/filters/${filterId}`).send({});
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await request(app)
      .patch("/filters/aaaaaaaaaaaaaaaaaaaaaaaa")
      .send({ reason: "x" });
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed ID", async () => {
    const res = await request(app)
      .patch("/filters/bad-id")
      .send({ reason: "x" });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /filters/:id", () => {
  it("deletes a filter and it becomes inaccessible", async () => {
    const created = await request(app).post("/filters").send(validFilter);
    const id = created.body._id;

    const delRes = await request(app).delete(`/filters/${id}`);
    expect(delRes.status).toBe(204);

    const getRes = await request(app).get(`/filters/${id}`);
    expect(getRes.status).toBe(404);
  });

  it("returns 404 for non-existent ID", async () => {
    const res = await request(app).delete("/filters/aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(res.status).toBe(404);
  });

  it("returns 400 for malformed ID", async () => {
    const res = await request(app).delete("/filters/bad-id");
    expect(res.status).toBe(400);
  });

  it("allows re-creating a filter after deletion", async () => {
    const created = await request(app).post("/filters").send(validFilter);
    await request(app).delete(`/filters/${created.body._id}`);

    const recreated = await request(app).post("/filters").send(validFilter);
    expect(recreated.status).toBe(201);
  });
});
