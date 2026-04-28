import { z, ZodError } from "zod";
import { ObjectId } from "mongodb";
import { config } from "./config";

export const TargetBranchSchema = z.enum(config.validBranches);
export type TargetBranch = z.infer<typeof TargetBranchSchema>;

export const CreateFilterBodySchema = z.object({
  testId: z
    .string({ error: "testId is required and must be a string" })
    .regex(
      config.testIdPattern,
      "testId must match pattern TP######, e.g. TP000001",
    ),
  targetBranch: TargetBranchSchema,
  reason: z
    .string({ error: "reason is required and must be a non-empty string" })
    .trim()
    .min(1, "reason is required and must be a non-empty string"),
  author: z
    .string({ error: "author is required and must be a non-empty string" })
    .trim()
    .min(1, "author is required and must be a non-empty string"),
});
export type CreateFilterBody = z.infer<typeof CreateFilterBodySchema>;

export const UpdateFilterBodySchema = z
  .object({
    reason: z
      .string()
      .trim()
      .min(1, "reason must be a non-empty string")
      .optional(),
    author: z
      .string()
      .trim()
      .min(1, "author must be a non-empty string")
      .optional(),
  })
  .refine((d) => d.reason !== undefined || d.author !== undefined, {
    message: "At least one field (reason, author) must be provided",
    path: ["body"],
  });
export type UpdateFilterBody = z.infer<typeof UpdateFilterBodySchema>;

export const ResolveBodySchema = z.object({
  targetBranch: TargetBranchSchema,
});
export type ResolveBody = z.infer<typeof ResolveBodySchema>;

export const ListFiltersQuerySchema = z.object({
  targetBranch: TargetBranchSchema,
  reason: z
    .string()
    .refine(
      (v) => {
        try {
          new RegExp(v);
          return true;
        } catch {
          return false;
        }
      },
      { message: "reason is not a valid regexp" },
    )
    .optional(),
});

export interface ValidationError {
  field: string;
  message: string;
}

export function formatZodErrors(error: ZodError): ValidationError[] {
  return error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
}

export interface FilterDoc {
  _id: ObjectId;
  testId: string;
  targetBranch: TargetBranch;
  reason: string;
  author: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ResolveResponse {
  targetBranch: TargetBranch;
  disabledTests: string[];
  resolvedAt: string;
  fallback?: true;
}
