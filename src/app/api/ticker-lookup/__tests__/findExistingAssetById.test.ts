import { findExistingAssetById } from "../route";

const mockSend = jest.fn();
jest.mock("@/lib/db", () => ({
  db: { send: (...args: unknown[]) => mockSend(...args) },
  TABLE_NAME: "test-table",
}));

describe("findExistingAssetById", () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  it("returns null when DynamoDB returns no Item (asset doesn't exist)", async () => {
    mockSend.mockResolvedValue({ Item: undefined });
    const result = await findExistingAssetById("hh-1", "asset-id-1", "VFV");
    expect(result).toBeNull();
  });

  it("returns picked fields when asset exists with all relevant fields", async () => {
    mockSend.mockResolvedValue({
      Item: {
        PK: "HOUSEHOLD#hh-1",
        SK: "ASSET#asset-id-1",
        ticker: "VFV",
        market: "Canada",
        marketComputedAt: "2026-04-01T00:00:00Z",
        userOverrides: { market: true },
      },
    });
    const result = await findExistingAssetById("hh-1", "asset-id-1", "VFV");
    expect(result).toEqual({
      userOverrides: { market: true },
      marketComputedAt: "2026-04-01T00:00:00Z",
      market: "Canada",
      exchangeSuffix: "",
      currency: "",
    });
  });

  it("returns null on DynamoDB error", async () => {
    mockSend.mockRejectedValue(new Error("network"));
    const result = await findExistingAssetById("hh-1", "asset-id-1", "VFV");
    expect(result).toBeNull();
  });

  it("loads by exact key (no ticker-based scan)", async () => {
    mockSend.mockResolvedValue({ Item: { ticker: "VFV", market: "USA" } });
    await findExistingAssetById("hh-1", "asset-id-1", "VFV");

    // Verify the Key matches the spec: PK=HOUSEHOLD#hh-1, SK=ASSET#asset-id-1
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Key).toEqual({
      PK: "HOUSEHOLD#hh-1",
      SK: "ASSET#asset-id-1",
    });
  });

  it("Codex round-3 #1: returns null when stored ticker differs from requested symbol", async () => {
    // The user is editing asset B (originally VOO) and just changed the ticker
    // to VT. The lookup must NOT return VOO's stored market/lock state for the
    // VT lookup — it must return null so researchTicker classifies VT fresh.
    mockSend.mockResolvedValue({
      Item: {
        PK: "HOUSEHOLD#hh-1",
        SK: "ASSET#asset-id-1",
        ticker: "VOO",
        market: "USA",
        marketComputedAt: "2026-04-01T00:00:00Z",
        userOverrides: { market: false },
      },
    });

    const result = await findExistingAssetById("hh-1", "asset-id-1", "VT");

    expect(result).toBeNull();
  });

  it("Codex round-3 #1: case-insensitive ticker comparison", async () => {
    // Stored "vfv", requested "VFV" → match (no null).
    mockSend.mockResolvedValue({
      Item: {
        PK: "HOUSEHOLD#hh-1",
        SK: "ASSET#asset-id-1",
        ticker: "vfv",  // lowercase in DynamoDB
        market: "Canada",
        marketComputedAt: "2026-04-01T00:00:00Z",
      },
    });

    const result = await findExistingAssetById("hh-1", "asset-id-1", "VFV");

    expect(result).toEqual({
      userOverrides: undefined,
      marketComputedAt: "2026-04-01T00:00:00Z",
      market: "Canada",
      exchangeSuffix: "",
      currency: "",
    });
  });

  it("returns exchangeSuffix and currency from stored asset", async () => {
    // Mock the DynamoDB GetCommand to return an item with exchangeSuffix
    mockSend.mockResolvedValueOnce({
      Item: {
        ticker: "JEPQ",
        market: "Canada",
        exchangeSuffix: ".NE",
        currency: "CAD",
        marketComputedAt: null,
        userOverrides: { exchange: true },
      },
    });

    const result = await findExistingAssetById("household1", "asset1", "JEPQ");
    expect(result?.exchangeSuffix).toBe(".NE");
    expect(result?.currency).toBe("CAD");
  });
});
