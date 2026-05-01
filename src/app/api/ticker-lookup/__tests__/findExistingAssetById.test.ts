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
    const result = await findExistingAssetById("hh-1", "asset-id-1");
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
    const result = await findExistingAssetById("hh-1", "asset-id-1");
    expect(result).toEqual({
      userOverrides: { market: true },
      marketComputedAt: "2026-04-01T00:00:00Z",
      market: "Canada",
    });
  });

  it("returns null on DynamoDB error", async () => {
    mockSend.mockRejectedValue(new Error("network"));
    const result = await findExistingAssetById("hh-1", "asset-id-1");
    expect(result).toBeNull();
  });

  it("loads by exact key (no ticker-based scan)", async () => {
    mockSend.mockResolvedValue({ Item: { ticker: "VFV", market: "USA" } });
    await findExistingAssetById("hh-1", "asset-id-1");

    // Verify the Key matches the spec: PK=HOUSEHOLD#hh-1, SK=ASSET#asset-id-1
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Key).toEqual({
      PK: "HOUSEHOLD#hh-1",
      SK: "ASSET#asset-id-1",
    });
  });
});
