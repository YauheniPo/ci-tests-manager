import { z } from "zod";
import {
  CreateFilterBodySchema,
  UpdateFilterBodySchema,
  ResolveBodySchema,
  ResolveResponse,
  ValidationError,
} from "../types";

const createFilterBodyExample = CreateFilterBodySchema.parse({
  testId: "TP000001",
  targetBranch: "MASTER",
  reason: "Flaky due to race condition in auth flow, ticket JIRA-1234",
  author: "john.doe",
});

const updateFilterBodyExample = UpdateFilterBodySchema.parse({
  reason: "Updated reason",
  author: "jane.doe",
});

const resolveBodyExample = ResolveBodySchema.parse({
  targetBranch: "MASTER",
});

const filterExample = {
  _id: "65a1b2c3d4e5f6a7b8c9d0e1",
  ...createFilterBodyExample,
  createdAt: "2024-01-15T10:00:00.000Z",
  updatedAt: "2024-01-15T10:00:00.000Z",
};

const resolveResponseExample: ResolveResponse = {
  targetBranch: "MASTER",
  disabledTests: ["TP000001", "TP000007", "TP000042"],
  resolvedAt: "2024-01-15T10:05:00.000Z",
};

const resolveResponseFallbackExample: ResolveResponse = {
  targetBranch: "MASTER",
  disabledTests: [],
  resolvedAt: "2024-01-15T10:05:00.000Z",
  fallback: true,
};

const validationErrorsExample = {
  error: "Validation failed",
  details: [
    { field: "testId", message: "testId must match pattern TP######" },
  ] satisfies ValidationError[],
};

function withRequired<T extends z.ZodRawShape>(
  schema: z.ZodObject<T>,
  example: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const shape = schema.shape;

  for (const [key, value] of Object.entries(example)) {
    const fieldSchema = shape[key];
    const isOptional = fieldSchema instanceof z.ZodOptional;
    result[isOptional ? key : `$${key}`] = value;
  }

  return result;
}

export const swaggerDefinitions = {
  Filter: filterExample,
  CreateFilterBody: withRequired(
    CreateFilterBodySchema,
    createFilterBodyExample,
  ),
  UpdateFilterBody: updateFilterBodyExample,
  ResolveBody: withRequired(ResolveBodySchema, resolveBodyExample),
  ResolveResponse: resolveResponseExample,
  ResolveResponseFallback: resolveResponseFallbackExample,
  ValidationErrors: validationErrorsExample,
};
