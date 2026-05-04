import { fetchFxRate } from "../fxRate";

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    quote: jest.fn(),
  })),
}));

describe("fetchFxRate", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("fetches and returns rate from Yahoo", async () => {
    const YF = require("yahoo-finance2").default;
    YF.mockImplementation(() => ({
      quote: jest.fn().mockResolvedValue({ regularMarketPrice: 1.3642 }),
    }));
    const { fetchFxRate } = require("../fxRate");
    const rate = await fetchFxRate("USD", "CAD");
    expect(rate).toBe(1.3642);
  });

  it("throws when Yahoo returns no price", async () => {
    const YF = require("yahoo-finance2").default;
    YF.mockImplementation(() => ({
      quote: jest.fn().mockResolvedValue({ regularMarketPrice: null }),
    }));
    const { fetchFxRate } = require("../fxRate");
    await expect(fetchFxRate("USD", "CAD")).rejects.toThrow();
  });
});
