import { liveMergeAssets } from "../liveMergeAssets";
import { computeBreakdowns } from "../../breakdown/lib/computeBreakdowns";
import type { Asset } from "@/types";

const baseAsset = (over: Partial<Asset>): Asset => ({
  id: "1", ticker: "AAPL", quantity: 10, liveTickerPrice: 100, bookCost: 800,
  marketValue: 1000, profitLoss: 200, market: "US", sector: "Technology",
  ...over,
} as Asset);

describe("liveMergeAssets", () => {
  it("recomputes marketValue from live price when marketData provides one", () => {
    const assets: Asset[] = [baseAsset({ id: "1", quantity: 10, liveTickerPrice: 100, marketValue: 1000 })];
    const marketData = { "1": { currentPrice: 200 } };
    const merged = liveMergeAssets(assets, marketData);
    expect(merged[0].liveTickerPrice).toBe(200);
    expect(merged[0].marketValue).toBe(2000);
    expect(merged[0].profitLoss).toBe(2000 - 800);
  });

  it("preserves stale marketValue when marketData has no entry for the asset", () => {
    const assets: Asset[] = [baseAsset({ id: "1", marketValue: 1000 })];
    const merged = liveMergeAssets(assets, {});
    expect(merged[0].marketValue).toBe(1000);
  });

  it("falls back to stale price when live price is non-positive (0, NaN, negative)", () => {
    const assets: Asset[] = [baseAsset({ id: "1", liveTickerPrice: 100, marketValue: 1000 })];
    expect(liveMergeAssets(assets, { "1": { currentPrice: 0 } })[0].liveTickerPrice).toBe(100);
    expect(liveMergeAssets(assets, { "1": { currentPrice: NaN } })[0].liveTickerPrice).toBe(100);
    expect(liveMergeAssets(assets, { "1": { currentPrice: -5 } })[0].liveTickerPrice).toBe(100);
  });

  it("preserves all other asset fields verbatim", () => {
    const assets: Asset[] = [baseAsset({ id: "1", sector: "Technology", market: "US", currency: "USD" })];
    const merged = liveMergeAssets(assets, { "1": { currentPrice: 200 } });
    expect(merged[0].sector).toBe("Technology");
    expect(merged[0].market).toBe("US");
    expect(merged[0].currency).toBe("USD");
  });

  it("feeds correct sector breakdown when chained with computeBreakdowns", () => {
    const assets: Asset[] = [
      baseAsset({ id: "1", quantity: 10, liveTickerPrice: 100, marketValue: 1000, sector: "Technology" }),
      baseAsset({ id: "2", quantity: 5, liveTickerPrice: 400, marketValue: 2000, sector: "Diversified" }),
    ];
    const merged = liveMergeAssets(assets, { "1": { currentPrice: 200 } }); // AAPL live = 200, mv -> 2000
    const breakdowns = computeBreakdowns(merged);
    const tech = breakdowns.sector.slices.find(s => s.label === "Technology");
    expect(tech?.value).toBe(2000); // NOT 1000 (the stale value)
  });
});
