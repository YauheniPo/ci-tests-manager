import swaggerAutogen from "swagger-autogen";
import { swaggerDefinitions } from "./contracts";

const doc = {
  info: {
    title: "Test Filter Service",
    description:
      "Service for managing E2E test disable filters in CI/CD pipelines. " +
      "CI calls POST /resolve before each E2E run to get the list of tests to skip.",
    version: "1.0.0",
  },
  host: "localhost:3000",
  schemes: ["http"],
  tags: [
    { name: "Filters", description: "Manage test disable filters (CRUD)" },
    { name: "Resolve", description: "CI/CD integration — get tests to skip" },
  ],
  definitions: swaggerDefinitions,
};

const outputFile = "../../swagger-output.json";
const routes = ["./src/app.ts"];

swaggerAutogen({ openapi: "3.0.0" })(outputFile, routes, doc);
