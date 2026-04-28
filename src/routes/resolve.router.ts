import { Router, Request, Response } from "express";
import { getFiltersCollection } from "../db";
import {
  TargetBranch,
  ResolveBodySchema,
  ResolveResponse,
  formatZodErrors,
} from "../types";

export const resolveRouter = Router();

/**
 * Branch inclusion logic:
 *   PR → MASTER  =>  apply filters for MASTER + PROD
 *   PR → PROD    =>  apply filters for PROD only
 *
 * Rationale: PROD is a subset of MASTER.
 * A test disabled for PROD should also be skipped when merging to MASTER,
 * because MASTER changes will eventually reach PROD.
 */
function getBranchesForTarget(targetBranch: TargetBranch): TargetBranch[] {
  if (targetBranch === "MASTER") {
    return ["MASTER", "PROD"];
  }
  return ["PROD"];
}

resolveRouter.post("/", async (req: Request, res: Response) => {
  // #swagger.tags = ['Resolve']
  // #swagger.summary = 'Get disabled tests for a CI run'
  // #swagger.description = 'Called by CI before E2E step. Returns sorted list of test IDs to skip. Branch logic: MASTER includes PROD filters; PROD includes only PROD filters. On MongoDB failure returns empty list with fallback:true (fail-open).'
  /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: '#/definitions/ResolveBody' }
      }
    }
  } */
  /* #swagger.responses[200] = {
    description: 'List of disabled test IDs. disabledTests is empty when nothing is disabled or on DB failure (fallback:true).',
    schema: { $ref: '#/definitions/ResolveResponse' }
  } */
  /* #swagger.responses[400] = {
    description: 'Validation error',
    schema: { $ref: '#/definitions/ValidationErrors' }
  } */
  const parsed = ResolveBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: formatZodErrors(parsed.error),
    });
    return;
  }

  const { targetBranch } = parsed.data;
  const branches = getBranchesForTarget(targetBranch);

  let disabledTests: string[] = [];
  let fallback = false;

  try {
    const col = getFiltersCollection();
    const filters = await col
      .find(
        { targetBranch: { $in: branches } },
        { projection: { testId: 1, _id: 0 } },
      )
      .toArray();

    disabledTests = [...new Set(filters.map((f) => f.testId))].sort();
  } catch (dbErr) {
    console.error(
      "MongoDB unavailable, applying fail-open for /resolve:",
      dbErr,
    );
    fallback = true;
  }

  const response: ResolveResponse = {
    targetBranch,
    disabledTests,
    resolvedAt: new Date().toISOString(),
    ...(fallback && { fallback: true }),
  };

  res.json(response);
});
