import { shouldEnrichHolding } from "../route";

describe("shouldEnrichHolding — pre-3C behavior preserved", () => {
  it("returns true when existing is null/undefined (new ticker)", () => {
    expect(shouldEnrichHolding(null)).toBe(true);
    expect(shouldEnrichHolding(undefined)).toBe(true);
  });

  it("returns true when strategyType is missing or 'Not Found'", () => {
    expect(shouldEnrichHolding({ strategyType: "" })).toBe(true);
    expect(shouldEnrichHolding({ strategyType: "Not Found" })).toBe(true);
  });

  it("returns true when sector is missing or 'Not Found'", () => {
    expect(shouldEnrichHolding({
      strategyType: "Mix", sector: "Not Found",
    })).toBe(true);
  });

  it("returns true when securityType is missing or 'Not Found'", () => {
    expect(shouldEnrichHolding({
      strategyType: "Mix", sector: "IT", securityType: "Not Found",
    })).toBe(true);
  });

  it("returns false when all three legacy fields are populated and market is fresh+classified", () => {
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "Company",
      market: "USA",
    })).toBe(false);
  });
});

describe("shouldEnrichHolding — Codex round-4 #1: market staleness", () => {
  it("returns true for legacy ETF with market='Not Found' (the primary fix case)", () => {
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "ETF",
      market: "Not Found",
    })).toBe(true);
  });

  it("returns true for ETF with expired marketComputedAt (>365 days)", () => {
    const stale = new Date(Date.now() - 400 * 86_400_000).toISOString();
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "ETF",
      market: "USA", marketComputedAt: stale,
    })).toBe(true);
  });

  it("returns false for ETF with fresh marketComputedAt (<365 days)", () => {
    const fresh = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "ETF",
      market: "USA", marketComputedAt: fresh,
    })).toBe(false);
  });

  it("returns false for locked-market ETF even with stale state (3A lock respected)", () => {
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "ETF",
      market: "Not Found", marketComputedAt: null,
      userOverrides: { market: true },
    })).toBe(false);
  });

  it("staleness gate does NOT apply to Companies (non-ETF/Fund)", () => {
    expect(shouldEnrichHolding({
      strategyType: "Growth", sector: "IT", securityType: "Company",
      market: "Not Found",
    })).toBe(false);  // Company with all legacy fields populated → no enrichment
  });

  it("Fund with market staleness also triggers enrichment", () => {
    expect(shouldEnrichHolding({
      strategyType: "Mix", sector: "IT", securityType: "Fund",
      market: "Not Found",
    })).toBe(true);
  });
});
