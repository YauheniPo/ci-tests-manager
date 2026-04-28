const mockCreateIndex = jest.fn().mockResolvedValue(undefined);
const mockCollection = jest
  .fn()
  .mockReturnValue({ createIndex: mockCreateIndex });
const mockDb = jest.fn().mockReturnValue({ collection: mockCollection });
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockClose = jest.fn().mockResolvedValue(undefined);

jest.mock("mongodb", () => ({
  MongoClient: jest.fn().mockImplementation(() => ({
    connect: mockConnect,
    db: mockDb,
    close: mockClose,
  })),
}));

let connectDb: typeof import("../db").connectDb;
let disconnectDb: typeof import("../db").disconnectDb;
let getDb: typeof import("../db").getDb;
let getFiltersCollection: typeof import("../db").getFiltersCollection;

function loadModule() {
  const mod = require("../db");
  connectDb = mod.connectDb;
  disconnectDb = mod.disconnectDb;
  getDb = mod.getDb;
  getFiltersCollection = mod.getFiltersCollection;
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules();

  jest.mock("mongodb", () => ({
    MongoClient: jest.fn().mockImplementation(() => ({
      connect: mockConnect,
      db: mockDb,
      close: mockClose,
    })),
  }));
});

describe("connectDb", () => {
  it("creates a client, connects, and creates indexes", async () => {
    loadModule();
    const logSpy = jest.spyOn(console, "log").mockImplementation();

    await connectDb();

    const { MongoClient } = require("mongodb");
    expect(MongoClient).toHaveBeenCalledTimes(1);
    expect(mockConnect).toHaveBeenCalledTimes(1);
    expect(mockDb).toHaveBeenCalledWith("test_filter_service");
    expect(mockCreateIndex).toHaveBeenCalledTimes(2);
    expect(mockCreateIndex).toHaveBeenCalledWith(
      { testId: 1, targetBranch: 1 },
      { unique: true, name: "unique_testId_targetBranch" },
    );
    expect(mockCreateIndex).toHaveBeenCalledWith(
      { targetBranch: 1 },
      { name: "idx_targetBranch" },
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Connected to MongoDB"),
    );

    logSpy.mockRestore();
  });
});

describe("disconnectDb", () => {
  it("closes the client when connected", async () => {
    loadModule();
    jest.spyOn(console, "log").mockImplementation();

    await connectDb();
    await disconnectDb();

    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("does nothing when client is not initialized", async () => {
    loadModule();

    await disconnectDb();

    expect(mockClose).not.toHaveBeenCalled();
  });
});

describe("getDb", () => {
  it("throws when database is not connected", () => {
    loadModule();

    expect(() => getDb()).toThrow(
      "Database not connected. Call connectDb() first.",
    );
  });

  it("returns db instance after connecting", async () => {
    loadModule();
    jest.spyOn(console, "log").mockImplementation();

    await connectDb();
    const db = getDb();

    expect(db).toBeDefined();
    expect(db.collection).toBeDefined();
  });
});

describe("getFiltersCollection", () => {
  it("returns the filters collection", async () => {
    loadModule();
    jest.spyOn(console, "log").mockImplementation();

    await connectDb();
    const col = getFiltersCollection();

    expect(mockCollection).toHaveBeenCalledWith("filters");
    expect(col).toBeDefined();
  });

  it("throws when not connected", () => {
    loadModule();

    expect(() => getFiltersCollection()).toThrow("Database not connected");
  });
});
