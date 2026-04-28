import {
  CreateFilterBodySchema,
  UpdateFilterBodySchema,
  ResolveBodySchema,
  ListFiltersQuerySchema,
  formatZodErrors,
} from "../types";
import { ZodError, ZodIssueCode } from "zod";

describe("CreateFilterBodySchema", () => {
  const validBody = {
    testId: "TP000001",
    targetBranch: "MASTER",
    reason: "flaky test JIRA-1234",
    author: "john.doe",
  };

  it("accepts a valid body", () => {
    const result = CreateFilterBodySchema.safeParse(validBody);
    expect(result.success).toBe(true);
  });

  it("accepts PROD as targetBranch", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      targetBranch: "PROD",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing testId", () => {
    const { testId, ...rest } = validBody;
    const result = CreateFilterBodySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("rejects invalid testId pattern", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      testId: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("rejects testId with wrong digit count", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      testId: "TP0001",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid targetBranch", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      targetBranch: "DEVELOP",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty reason", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects whitespace-only reason", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      reason: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty author", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      author: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing author", () => {
    const { author, ...rest } = validBody;
    const result = CreateFilterBodySchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("trims reason and author", () => {
    const result = CreateFilterBodySchema.safeParse({
      ...validBody,
      reason: "  trimmed reason  ",
      author: "  trimmed author  ",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reason).toBe("trimmed reason");
      expect(result.data.author).toBe("trimmed author");
    }
  });
});

describe("UpdateFilterBodySchema", () => {
  it("accepts reason only", () => {
    const result = UpdateFilterBodySchema.safeParse({ reason: "new reason" });
    expect(result.success).toBe(true);
  });

  it("accepts author only", () => {
    const result = UpdateFilterBodySchema.safeParse({ author: "new author" });
    expect(result.success).toBe(true);
  });

  it("accepts both reason and author", () => {
    const result = UpdateFilterBodySchema.safeParse({
      reason: "new reason",
      author: "new author",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty object (no fields)", () => {
    const result = UpdateFilterBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects empty reason string", () => {
    const result = UpdateFilterBodySchema.safeParse({ reason: "" });
    expect(result.success).toBe(false);
  });

  it("rejects empty author string", () => {
    const result = UpdateFilterBodySchema.safeParse({ author: "" });
    expect(result.success).toBe(false);
  });
});

describe("ResolveBodySchema", () => {
  it("accepts MASTER", () => {
    const result = ResolveBodySchema.safeParse({ targetBranch: "MASTER" });
    expect(result.success).toBe(true);
  });

  it("accepts PROD", () => {
    const result = ResolveBodySchema.safeParse({ targetBranch: "PROD" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid branch", () => {
    const result = ResolveBodySchema.safeParse({ targetBranch: "STAGING" });
    expect(result.success).toBe(false);
  });

  it("rejects missing targetBranch", () => {
    const result = ResolveBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("ListFiltersQuerySchema", () => {
  it("accepts targetBranch only", () => {
    const result = ListFiltersQuerySchema.safeParse({
      targetBranch: "MASTER",
    });
    expect(result.success).toBe(true);
  });

  it("accepts targetBranch with valid reason regex", () => {
    const result = ListFiltersQuerySchema.safeParse({
      targetBranch: "PROD",
      reason: "JIRA-\\d+",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid reason regex", () => {
    const result = ListFiltersQuerySchema.safeParse({
      targetBranch: "MASTER",
      reason: "[invalid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing targetBranch", () => {
    const result = ListFiltersQuerySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("formatZodErrors", () => {
  it("formats Zod issues into ValidationError[]", () => {
    const result = CreateFilterBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      expect(Array.isArray(errors)).toBe(true);
      expect(errors.length).toBeGreaterThan(0);
      errors.forEach((err) => {
        expect(err).toHaveProperty("field");
        expect(err).toHaveProperty("message");
        expect(typeof err.field).toBe("string");
        expect(typeof err.message).toBe("string");
      });
    }
  });

  it('uses "body" when path is empty', () => {
    const result = UpdateFilterBodySchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const errors = formatZodErrors(result.error);
      const bodyError = errors.find((e) => e.field === "body");
      expect(bodyError).toBeDefined();
    }
  });

  it('falls back to "body" when issue.path is an empty array', () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.custom,
        path: [],
        message: "something went wrong",
      },
    ]);
    const errors = formatZodErrors(error);
    expect(errors).toEqual([
      { field: "body", message: "something went wrong" },
    ]);
  });

  it("joins nested path with dots", () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.custom,
        path: ["a", "b", "c"],
        message: "deep error",
      },
    ]);
    const errors = formatZodErrors(error);
    expect(errors).toEqual([{ field: "a.b.c", message: "deep error" }]);
  });
});
