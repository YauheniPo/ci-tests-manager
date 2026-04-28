import express, { Request, Response } from "express";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";
import { getDb } from "./db";
import { filtersRouter } from "./routes/filters.router";
import { resolveRouter } from "./routes/resolve.router";
import { errorHandler } from "./middleware";

export function createApp() {
  const app = express();

  app.use(morgan("short"));
  app.use(express.json());

  app.get("/health", async (_req: Request, res: Response) => {
    const timestamp = new Date().toISOString();

    try {
      await getDb().command({ ping: 1 });
      res.json({ status: "ok", mongo: "connected", timestamp });
    } catch {
      res
        .status(503)
        .json({ status: "degraded", mongo: "unavailable", timestamp });
    }
  });

  app.use("/filters", filtersRouter);
  app.use("/resolve", resolveRouter);

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const swaggerOutput = require("../swagger-output.json");
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerOutput));
  } catch {
    console.warn(
      "swagger-output.json not found, /docs endpoint disabled. Run: npm run swagger",
    );
  }

  app.use(errorHandler);

  return app;
}
