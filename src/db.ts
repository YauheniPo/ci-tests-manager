import { MongoClient, Db, Collection } from "mongodb";
import { config } from "./config";
import { FilterDoc } from "./types";

let client: MongoClient;
let db: Db;

export async function connectDb(): Promise<void> {
  const { uri, dbName, ...poolOpts } = config.mongo;

  client = new MongoClient(uri, poolOpts);
  await client.connect();
  db = client.db(dbName);

  await ensureIndexes();

  console.log(`Connected to MongoDB: ${uri}/${dbName}`);
}

export async function disconnectDb(): Promise<void> {
  if (client) {
    await client.close();
  }
}

export function getDb(): Db {
  if (!db) {
    throw new Error("Database not connected. Call connectDb() first.");
  }
  return db;
}

export function getFiltersCollection(): Collection<FilterDoc> {
  return getDb().collection<FilterDoc>("filters");
}

async function ensureIndexes(): Promise<void> {
  const col = getDb().collection<FilterDoc>("filters");

  await col.createIndex(
    { testId: 1, targetBranch: 1 },
    {
      unique: true,
      name: "unique_testId_targetBranch",
    },
  );

  await col.createIndex({ targetBranch: 1 }, { name: "idx_targetBranch" });
}
