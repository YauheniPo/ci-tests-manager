import { MongoMemoryServer } from "mongodb-memory-server";
import { MongoClient } from "mongodb";
import request from "supertest";
import { Express } from "express";

let mongod: MongoMemoryServer;
let client: MongoClient;
let app: Express;

export async function setupIntegration() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.DB_NAME = "test_integration";

  const { connectDb } = await import("../db");
  await connectDb();

  const { createApp } = await import("../app");
  app = createApp();

  client = new MongoClient(mongod.getUri());
  await client.connect();

  return { app, client, mongod };
}

export async function teardownIntegration() {
  const { disconnectDb } = await import("../db");
  await disconnectDb();
  if (client) await client.close();
  if (mongod) await mongod.stop();
}

export async function clearCollection(colName = "filters") {
  const db = client.db(process.env.DB_NAME);
  await db.collection(colName).deleteMany({});
}

export { request };
