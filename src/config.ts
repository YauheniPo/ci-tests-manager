export const config = {
  port: parseInt(process.env.PORT || "3000", 10),

  mongo: {
    uri: process.env.MONGO_URI || "mongodb://localhost:27017",
    dbName: process.env.DB_NAME || "test_filter_service",
    connectTimeoutMS: 5_000,
    serverSelectionTimeoutMS: 5_000,
    socketTimeoutMS: 10_000,
    maxPoolSize: 50,
    minPoolSize: 2,
  },

  testIdPattern: /^TP\d{6}$/,
  validBranches: ["MASTER", "PROD"] as const,
} as const;
