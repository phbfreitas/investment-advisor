import { validateMarketComputedAt } from "../route";

describe("validateMarketComputedAt — Codex round-4 #3", () => {
  it("accepts null (manual-set sentinel)", () => {
    expect(validateMarketComputedAt(null)).toBeNull();
  });

  it("accepts a recent past ISO string", () => {
    const recent = new Date(Date.now() - 60 * 86_400_000).toISOString();
    expect(validateMarketComputedAt(recent)).toBe(recent);
  });

  it("accepts a near-now ISO string (within 60s future skew)", () => {
    const nearFuture = new Date(Date.now() + 30_000).toISOString();
    expect(validateMarketComputedAt(nearFuture)).toBe(nearFuture);
  });

  it("rejects a far-future ISO string", () => {
    expect(validateMarketComputedAt("2099-01-01T00:00:00Z")).toBeUndefined();
  });

  it("rejects a future ISO string beyond 60s skew tolerance", () => {
    const tooFar = new Date(Date.now() + 5 * 60_000).toISOString();
    expect(validateMarketComputedAt(tooFar)).toBeUndefined();
  });

  it("rejects an ISO string older than 2x TTL (>730 days)", () => {
    const ancient = new Date(Date.now() - 800 * 86_400_000).toISOString();
    expect(validateMarketComputedAt(ancient)).toBeUndefined();
  });

  it("accepts an ISO string within 2x TTL (700 days old)", () => {
    const oldButValid = new Date(Date.now() - 700 * 86_400_000).toISOString();
    expect(validateMarketComputedAt(oldButValid)).toBe(oldButValid);
  });

  it("rejects non-string non-null values", () => {
    expect(validateMarketComputedAt(123)).toBeUndefined();
    expect(validateMarketComputedAt({})).toBeUndefined();
    expect(validateMarketComputedAt(true)).toBeUndefined();
    expect(validateMarketComputedAt([])).toBeUndefined();
  });

  it("rejects unparseable strings", () => {
    expect(validateMarketComputedAt("not a date")).toBeUndefined();
    expect(validateMarketComputedAt("2026-13-99T99:99:99Z")).toBeUndefined();
  });

  it("rejects empty string", () => {
    expect(validateMarketComputedAt("")).toBeUndefined();
  });
});
