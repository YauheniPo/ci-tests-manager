import { config } from "./config";
import { connectDb, disconnectDb } from "./db";
import { createApp } from "./app";

async function main() {
  await connectDb();

  const app = createApp();

  const server = app.listen(config.port, () => {
    console.log(`Test Filter Service is running on port ${config.port}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`Received ${signal}, shutting down...`);

    const forceExit = setTimeout(() => {
      console.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000);
    forceExit.unref();

    server.close(async () => {
      await disconnectDb();
      console.log("Graceful shutdown complete");
      process.exit(0);
    });
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
