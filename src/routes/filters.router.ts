import { Router, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { getFiltersCollection } from "../db";
import {
  CreateFilterBodySchema,
  UpdateFilterBodySchema,
  ListFiltersQuerySchema,
  FilterDoc,
  formatZodErrors,
} from "../types";

export const filtersRouter = Router();

filtersRouter.get("/", async (req: Request, res: Response) => {
  // #swagger.tags = ['Filters']
  // #swagger.summary = 'List filters'
  // #swagger.description = 'Returns filters by targetBranch, optionally narrowed by regexp on reason field. Use reason to find all tests disabled for a specific ticket, e.g. reason=JIRA-1234.'
  /* #swagger.parameters['targetBranch'] = {
    in: 'query',
    required: true,
    description: 'Target branch to filter by',
    schema: { '@type': 'string', '@enum': ['MASTER', 'PROD'] }
  } */
  /* #swagger.parameters['reason'] = {
    in: 'query',
    required: false,
    description: 'Regexp to search in reason field. E.g. JIRA-1234 or race.condition',
    schema: { type: 'string' }
  } */
  /* #swagger.responses[200] = {
    description: 'Array of filters sorted by createdAt desc',
    schema: { type: 'array', items: { $ref: '#/definitions/Filter' } }
  } */
  /* #swagger.responses[400] = {
    description: 'Validation error',
    schema: { $ref: '#/definitions/ValidationErrors' }
  } */
  const parsed = ListFiltersQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: formatZodErrors(parsed.error),
    });
    return;
  }

  const { targetBranch, reason } = parsed.data;
  const col = getFiltersCollection();

  const query: Record<string, unknown> = { targetBranch };
  if (reason) {
    query.reason = { $regex: reason, $options: "i" };
  }

  const filters = await col.find(query).sort({ createdAt: -1 }).toArray();
  res.json(filters);
});

filtersRouter.get(
  "/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    // #swagger.tags = ['Filters']
    // #swagger.summary = 'Get filter by ID'
    /* #swagger.parameters['id'] = {
    in: 'path',
    description: 'MongoDB ObjectId of the filter',
    required: true,
    type: 'string'
  } */
    /* #swagger.responses[200] = {
    description: 'Filter found',
    schema: { $ref: '#/definitions/Filter' }
  } */
    /* #swagger.responses[400] = { description: 'Invalid id format' } */
    /* #swagger.responses[404] = { description: 'Filter not found' } */
    if (!ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const col = getFiltersCollection();
    const filter = await col.findOne({ _id: new ObjectId(req.params.id) });

    if (!filter) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    res.json(filter);
  },
);

filtersRouter.post("/", async (req: Request, res: Response) => {
  // #swagger.tags = ['Filters']
  // #swagger.summary = 'Create a filter (disable a test)'
  // #swagger.description = 'testId must match pattern TP######. Each testId+targetBranch pair must be unique.'
  /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: '#/definitions/CreateFilterBody' }
      }
    }
  } */
  /* #swagger.responses[201] = {
    description: 'Filter created',
    schema: { $ref: '#/definitions/Filter' }
  } */
  /* #swagger.responses[400] = {
    description: 'Validation error',
    schema: { $ref: '#/definitions/ValidationErrors' }
  } */
  /* #swagger.responses[409] = { description: 'Filter for this testId + targetBranch already exists' } */
  const parsed = CreateFilterBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation failed",
      details: formatZodErrors(parsed.error),
    });
    return;
  }

  const now = new Date();
  const doc: Omit<FilterDoc, "_id"> = {
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  };

  const col = getFiltersCollection();

  try {
    const result = await col.insertOne(doc as FilterDoc);
    res.status(201).json({ _id: result.insertedId, ...doc });
  } catch (dbErr: unknown) {
    if (isMongoError(dbErr) && dbErr.code === 11000) {
      res.status(409).json({
        error: `Filter for testId '${doc.testId}' on branch '${doc.targetBranch}' already exists`,
      });
      return;
    }
    throw dbErr;
  }
});

filtersRouter.patch(
  "/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    // #swagger.tags = ['Filters']
    // #swagger.summary = 'Update filter reason or author'
    // #swagger.description = 'Only reason and author can be updated. To change testId or targetBranch — delete and recreate.'
    /* #swagger.parameters['id'] = {
    in: 'path',
    description: 'MongoDB ObjectId of the filter',
    required: true,
    type: 'string'
  } */
    /* #swagger.requestBody = {
    required: true,
    content: {
      "application/json": {
        schema: { $ref: '#/definitions/UpdateFilterBody' }
      }
    }
  } */
    /* #swagger.responses[200] = {
    description: 'Updated filter',
    schema: { $ref: '#/definitions/Filter' }
  } */
    /* #swagger.responses[400] = {
    description: 'Validation error',
    schema: { $ref: '#/definitions/ValidationErrors' }
  } */
    /* #swagger.responses[404] = { description: 'Filter not found' } */
    if (!ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const parsed = UpdateFilterBodySchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: "Validation failed",
        details: formatZodErrors(parsed.error),
      });
      return;
    }

    const updateFields: Partial<FilterDoc> = {
      ...parsed.data,
      updatedAt: new Date(),
    };

    const col = getFiltersCollection();
    const result = await col.findOneAndUpdate(
      { _id: new ObjectId(req.params.id) },
      { $set: updateFields },
      { returnDocument: "after" },
    );

    if (!result) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    res.json(result);
  },
);

filtersRouter.delete(
  "/:id",
  async (req: Request<{ id: string }>, res: Response) => {
    // #swagger.tags = ['Filters']
    // #swagger.summary = 'Delete a filter (re-enable a test)'
    /* #swagger.parameters['id'] = {
    in: 'path',
    description: 'MongoDB ObjectId of the filter',
    required: true,
    type: 'string'
  } */
    /* #swagger.responses[204] = { description: 'Filter deleted' } */
    /* #swagger.responses[400] = { description: 'Invalid id format' } */
    /* #swagger.responses[404] = { description: 'Filter not found' } */
    if (!ObjectId.isValid(req.params.id)) {
      res.status(400).json({ error: "Invalid id format" });
      return;
    }

    const col = getFiltersCollection();
    const result = await col.deleteOne({ _id: new ObjectId(req.params.id) });

    if (result.deletedCount === 0) {
      res.status(404).json({ error: "Filter not found" });
      return;
    }

    res.status(204).send();
  },
);

function isMongoError(err: unknown): err is { code: number } {
  return typeof err === "object" && err !== null && "code" in err;
}
