# ETF Holdings Market Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "ETFs always show Not Found" behavior with a holdings-based classifier that produces canonical Market values (USA / Canada / North America / Global / Not Found), runs lazily, caches per-asset for 365 days, recurses one level into all-in-one funds, and respects the 3A manual-override lock.

**Architecture:** Pure helper module (`src/lib/classification/holdings-market.ts`) called inline from `researchTicker` when an ETF/Fund's market is otherwise "Not Found", the 3A lock is off, and the cached `marketComputedAt` is expired. Cache is a single `marketComputedAt?: string | null` field on the `Asset` record — no new DynamoDB SK prefix, no migration. Manual edits via 3A's `setFieldWithLock` clear `marketComputedAt = null` so the unlock flow self-heals on the next refresh.

**Tech Stack:** TypeScript, Next.js (App Router), Jest + ts-jest for testing, `yahoo-finance2` SDK for `quoteSummary({modules: ['topHoldings', ...]})` and batched `quote([symbols])`, AWS DynamoDB via `@aws-sdk/lib-dynamodb` (encrypted via Blind Admin), `@/types/index.ts` and `@/types/audit.ts` for shared types.

**Spec:** [docs/superpowers/specs/2026-04-30-etf-holdings-market-classification-design.md](../specs/2026-04-30-etf-holdings-market-classification-design.md)

---

## File Map

**New:**
- `src/lib/classification/holdings-market.ts` — `classifyMarketByHoldings`, `resolveHoldingCountry`, `isClassificationExpired`, `GUARD_TOKENS`. Pure module; no DynamoDB.
- `src/lib/classification/__tests__/holdings-market.test.ts` — algorithm unit tests (Yahoo mocked).

**Modified:**
- `src/types/index.ts` — add `marketComputedAt?: string | null` to `Asset`.
- `src/types/audit.ts` — add `marketComputedAt?: string | null` to `AssetSnapshot`.
- `src/lib/assetSnapshot.ts` — include `marketComputedAt` in snapshot output.
- `src/lib/ticker-research.ts` — accept optional `existingAsset?`, gate classifier on lock + TTL, return `marketComputedAt`.
- `src/app/api/ticker-lookup/route.ts` — query the household's existing asset by ticker; pass to `researchTicker`.
- `src/app/api/portfolio-pdf/route.ts` — pass `existing` to `researchTicker`; persist `marketComputedAt` lock-respectingly.
- `src/app/api/assets/route.ts` — accept `marketComputedAt` and `userOverrides` in POST body.
- `src/app/api/assets/[id]/route.ts` — accept `marketComputedAt` in PUT body.
- `src/app/dashboard/lib/applyLookupRespectingLocks.ts` — add `marketComputedAt` to `LookupData` and pass through with lock-respect.
- `src/app/dashboard/DashboardClient.tsx` — extend `setFieldWithLock` to clear `marketComputedAt` when market is set; add `title` attribute on Not Found Market cells.

---

## Task 1: Add `marketComputedAt` to types and audit snapshot

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/audit.ts`
- Modify: `src/lib/assetSnapshot.ts`

This is a pure type change with the snapshot helper extension. No tests added in this task — the type is exercised by all subsequent tasks. Commit alone so the diff is small and reversible.

- [ ] **Step 1: Add `marketComputedAt` to the `Asset` interface**

Edit `src/types/index.ts`. Add the new field at the bottom of the `Asset` interface, right after `userOverrides`:

```typescript
export interface Asset {
    PK: string;
    SK: string;
    id: string;
    profileId: string;
    type: "ASSET";
    account: string;
    ticker: string;
    securityType: string;
    strategyType: string;
    call: string;
    sector: string;
    market: string;
    currency: string;
    managementStyle: string;
    externalRating: string;
    managementFee: number | null;
    quantity: number;
    liveTickerPrice: number;
    bookCost: number;
    marketValue: number;
    profitLoss: number;
    yield: number | null;
    oneYearReturn: number | null;
    fiveYearReturn: number | null;
    threeYearReturn: number | null;
    exDividendDate: string;
    analystConsensus: string;
    beta: number;
    riskFlag: string;
    accountNumber: string;
    accountType: string;
    risk: string;
    volatility: number;
    expectedAnnualDividends: number;
    updatedAt: string;
    userOverrides?: Partial<Record<LockableField, boolean>>;
    marketComputedAt?: string | null;
}
```

- [ ] **Step 2: Add `marketComputedAt` to `AssetSnapshot`**

Edit `src/types/audit.ts`. Add the new field to the `AssetSnapshot` interface alongside `userOverrides`:

```typescript
export interface AssetSnapshot {
  quantity: number;
  marketValue: number;
  bookCost: number;
  profitLoss: number;
  liveTickerPrice: number;
  currency: string;
  account: string;
  accountNumber: string;
  accountType: string;
  sector: string;
  market: string;
  securityType: string;
  strategyType: string;
  call: string;
  managementStyle: string;
  externalRating: string;
  managementFee: number | null;
  yield: number | null;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  fiveYearReturn: number | null;
  exDividendDate: string;
  analystConsensus: string;
  beta: number;
  riskFlag: string;
  risk: string;
  volatility: number;
  expectedAnnualDividends: number;
  importSource: string;
  createdAt: string;
  updatedAt: string;
  userOverrides?: Partial<Record<"sector" | "market" | "securityType" | "strategyType" | "call" | "managementStyle" | "currency" | "managementFee", boolean>>;
  marketComputedAt?: string | null;
}
```

- [ ] **Step 3: Extend `toSnapshot` to read `marketComputedAt`**

Edit `src/lib/assetSnapshot.ts`. Add the field at the end of the returned object, just before the closing brace:

```typescript
import type { AssetSnapshot } from "@/types/audit";

const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined ? null : Number(v);

export function toSnapshot(asset: Record<string, unknown>): AssetSnapshot {
  return {
    quantity: Number(asset.quantity) || 0,
    marketValue: Number(asset.marketValue) || 0,
    bookCost: Number(asset.bookCost) || 0,
    profitLoss: Number(asset.profitLoss) || 0,
    liveTickerPrice: Number(asset.liveTickerPrice) || 0,
    currency: String(asset.currency || ""),
    account: String(asset.account || ""),
    accountNumber: String(asset.accountNumber || ""),
    accountType: String(asset.accountType || ""),
    sector: String(asset.sector || ""),
    market: String(asset.market || ""),
    securityType: String(asset.securityType || ""),
    strategyType: String(asset.strategyType || ""),
    call: String(asset.call || ""),
    managementStyle: String(asset.managementStyle || ""),
    externalRating: String(asset.externalRating || ""),
    managementFee: numOrNull(asset.managementFee),
    yield: numOrNull(asset.yield),
    oneYearReturn: numOrNull(asset.oneYearReturn),
    threeYearReturn: numOrNull(asset.threeYearReturn),
    fiveYearReturn: numOrNull(asset.fiveYearReturn),
    exDividendDate: String(asset.exDividendDate || ""),
    analystConsensus: String(asset.analystConsensus || ""),
    beta: Number(asset.beta) || 0,
    riskFlag: String(asset.riskFlag || ""),
    risk: String(asset.risk || ""),
    volatility: Number(asset.volatility) || 0,
    expectedAnnualDividends: Number(asset.expectedAnnualDividends) || 0,
    importSource: String(asset.importSource || ""),
    createdAt: String(asset.createdAt || ""),
    updatedAt: String(asset.updatedAt || ""),
    userOverrides: (asset.userOverrides && typeof asset.userOverrides === "object")
        ? (asset.userOverrides as unknown) as AssetSnapshot["userOverrides"]
        : undefined,
    marketComputedAt:
      typeof asset.marketComputedAt === "string"
        ? asset.marketComputedAt
        : asset.marketComputedAt === null
          ? null
          : undefined,
  };
}
```

- [ ] **Step 4: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean output, no errors. Existing call sites that don't yet pass `marketComputedAt` are fine because the field is optional.

- [ ] **Step 5: Commit**

```bash
git add src/types/index.ts src/types/audit.ts src/lib/assetSnapshot.ts
git commit -m "feat(types): add marketComputedAt to Asset + AssetSnapshot

Optional ISO-timestamp field used by the ETF holdings classifier (3C)
to cache per-asset Market classification with a 365-day TTL. null is
the explicit 'manual-set' sentinel used by the 3A unlock self-heal flow."
```

---

## Task 2: Pure classifier module — happy paths and aggregation

**Files:**
- Create: `src/lib/classification/holdings-market.ts`
- Create: `src/lib/classification/__tests__/holdings-market.test.ts`

This task lays down the module skeleton with the simplest classifier behavior: stocks-only top-10 with exchange-suffix country resolution + the any-presence aggregation rule from Q3. Subsequent tasks layer on the name guard, sub-fund recursion, and error handling.

- [ ] **Step 1: Write the failing test for stocks-only happy paths**

Create `src/lib/classification/__tests__/holdings-market.test.ts`. The test file uses module-level mock fns shared with the `jest.mock` factory — variables prefixed with `mock` are jest's documented escape hatch from the hoisting that would otherwise make them undefined at factory invocation time.

```typescript
const mockQuoteSummary = jest.fn();
const mockQuote = jest.fn();

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: class {
    quoteSummary = mockQuoteSummary;
    quote = mockQuote;
  },
}));

import { classifyMarketByHoldings } from "../holdings-market";

// Helper: build a mock quoteSummary response.
function holdingsFor(symbols: string[], category = "Large Blend") {
  return {
    topHoldings: { holdings: symbols.map(s => ({ symbol: s, holdingName: s, holdingPercent: 0.05 })) },
    price: { shortName: "Mocked Fund", longName: "Mocked Fund Long" },
    fundProfile: { categoryName: category },
  };
}

// Helper: build a mock batch quote response treating every symbol as a stock.
function stocksFor(symbols: string[]) {
  return symbols.map(s => ({ symbol: s, quoteType: "EQUITY" as const }));
}

describe("classifyMarketByHoldings — stocks-only happy paths", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("returns USA when all top-10 holdings have no suffix or .US", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "NVDA", "AMZN"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "NVDA", "AMZN"]));

    expect(await classifyMarketByHoldings("VOO", 0)).toBe("USA");
  });

  it("returns Canada when all top-10 are .TO/.V/.NE/.CN", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["RY.TO", "TD.TO", "ENB.TO", "BNS.TO"]));
    mockQuote.mockResolvedValue(stocksFor(["RY.TO", "TD.TO", "ENB.TO", "BNS.TO"]));

    expect(await classifyMarketByHoldings("XIU.TO", 0)).toBe("Canada");
  });

  it("returns North America when top-10 mixes US and Canadian holdings", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "RY.TO", "TD.TO"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "RY.TO", "TD.TO"]));

    expect(await classifyMarketByHoldings("ZNA.TO", 0)).toBe("North America");
  });

  it("returns Global when any top-10 holding is on a non-NA exchange (.L)", async () => {
    mockQuoteSummary.mockResolvedValue(holdingsFor(["AAPL", "MSFT", "BARC.L", "HSBA.L"]));
    mockQuote.mockResolvedValue(stocksFor(["AAPL", "MSFT", "BARC.L", "HSBA.L"]));

    expect(await classifyMarketByHoldings("VT", 0)).toBe("Global");
  });

  it("returns Not Found when topHoldings is empty", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [] },
      price: { shortName: "X", longName: "X" },
      fundProfile: { categoryName: "Large Blend" },
    });

    expect(await classifyMarketByHoldings("XYZ", 0)).toBe("Not Found");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: FAIL — `Cannot find module '../holdings-market'`.

- [ ] **Step 3: Implement the minimal classifier**

Create `src/lib/classification/holdings-market.ts`:

```typescript
import YahooFinance from "yahoo-finance2";
import type { Market } from "./allowlists";

const yahooFinance = new YahooFinance();

type Country = "USA" | "Canada" | "Both" | "Other" | "Unknown";

const CA_SUFFIX_RE = /\.(TO|V|NE|CN)$/i;
const US_EXPLICIT_RE = /\.US$/i;
const ANY_SUFFIX_RE = /\.[A-Z]{1,4}$/;

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

export function isClassificationExpired(ts: string | null | undefined): boolean {
  if (ts == null) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ONE_YEAR_MS;
}

function resolveByExchangeSuffix(symbol: string): Country {
  if (CA_SUFFIX_RE.test(symbol)) return "Canada";
  if (US_EXPLICIT_RE.test(symbol)) return "USA";
  if (!symbol.includes(".")) return "USA";
  if (ANY_SUFFIX_RE.test(symbol)) return "Other";
  return "Unknown";
}

async function resolveHoldingCountry(
  symbol: string,
  _quoteType: string,
  _parentDepth: number,
): Promise<Country> {
  // Recursion is added in Task 4. For now, every holding resolves by suffix.
  return resolveByExchangeSuffix(symbol);
}

export async function classifyMarketByHoldings(
  symbol: string,
  depth: number,
): Promise<Market> {
  if (depth > 1) return "Not Found";

  let summary: any;
  try {
    summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["topHoldings", "price", "fundProfile"],
    });
  } catch {
    return "Not Found";
  }

  const holdings = summary?.topHoldings?.holdings ?? [];
  if (!Array.isArray(holdings) || holdings.length === 0) return "Not Found";

  const symbols: string[] = holdings.map((h: any) => String(h.symbol)).filter(Boolean);

  let quoteTypeBySymbol = new Map<string, string>();
  try {
    const quotes = await yahooFinance.quote(symbols);
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    quoteTypeBySymbol = new Map(arr.map((q: any) => [String(q.symbol), String(q.quoteType ?? "EQUITY")]));
  } catch {
    // Fall back to treating everything as EQUITY.
  }

  const countries: Country[] = [];
  for (const sym of symbols) {
    const qt = quoteTypeBySymbol.get(sym) ?? "EQUITY";
    countries.push(await resolveHoldingCountry(sym, qt, depth));
  }

  const resolved = countries.filter(c => c !== "Unknown");
  if (resolved.length === 0) return "Not Found";

  const hasUS = resolved.some(c => c === "USA" || c === "Both");
  const hasCA = resolved.some(c => c === "Canada" || c === "Both");
  const hasOther = resolved.some(c => c === "Other");

  if (hasOther) return "Global";
  if (hasUS && hasCA) return "North America";
  if (hasUS) return "USA";
  if (hasCA) return "Canada";
  return "Not Found";
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/holdings-market.ts src/lib/classification/__tests__/holdings-market.test.ts
git commit -m "feat(classification): pure holdings-market classifier (stocks-only)

Implements classifyMarketByHoldings + isClassificationExpired with
the any-presence NA aggregation rule from spec Q3. Recursion stub +
name guard land in subsequent tasks. Yahoo SDK is mocked in tests."
```

---

## Task 3: Name and category guard

**Files:**
- Modify: `src/lib/classification/holdings-market.ts`
- Modify: `src/lib/classification/__tests__/holdings-market.test.ts`

Add the GUARD_TOKENS check from spec Q2: a fund whose name or category contains tokens like "Global", "World", "International", etc., suppresses classification (returns "Not Found") regardless of top-10 unanimity. Guard fires only at `depth === 0` (the parent fund's identity).

- [ ] **Step 1: Add failing tests for the guard**

Append to `src/lib/classification/__tests__/holdings-market.test.ts`:

```typescript
describe("classifyMarketByHoldings — name/category guard", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("returns Not Found when fund name contains 'World' even if top-10 is all-US", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Vanguard Total World", longName: "Vanguard Total World ETF" },
      fundProfile: { categoryName: "Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("VT", 0)).toBe("Not Found");
  });

  it("returns Not Found when category contains 'Foreign Large Blend'", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Mocked", longName: "Mocked Fund" },
      fundProfile: { categoryName: "Foreign Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("VEA", 0)).toBe("Not Found");
  });

  it("returns Not Found when name contains 'Emerging Markets'", async () => {
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "TSM", holdingName: "TSMC", holdingPercent: 0.06 }] },
      price: { shortName: "Vanguard Emerging Markets", longName: "Vanguard FTSE Emerging Markets ETF" },
      fundProfile: { categoryName: "Diversified Emerging Markets" },
    });
    mockQuote.mockResolvedValue(stocksFor(["TSM"]));

    expect(await classifyMarketByHoldings("VWO", 0)).toBe("Not Found");
  });

  it("guard does NOT fire at depth > 0 (sub-fund classified by its own holdings)", async () => {
    // A 'World'-named sub-fund encountered during recursion should classify by
    // its top-10 holdings, not be killed by the guard. Verified once recursion
    // is wired in Task 4 — for now we just confirm the guard checks depth.
    mockQuoteSummary.mockResolvedValue({
      topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
      price: { shortName: "Sub World Fund", longName: "Sub World Fund" },
      fundProfile: { categoryName: "Large Blend" },
    });
    mockQuote.mockResolvedValue(stocksFor(["AAPL"]));

    expect(await classifyMarketByHoldings("SUBW", 1)).toBe("USA");
  });
});
```

- [ ] **Step 2: Run tests to confirm guard tests fail**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: 3 of the new 4 tests FAIL (the depth-guard test passes coincidentally because guard isn't yet implemented).

- [ ] **Step 3: Implement the guard**

Edit `src/lib/classification/holdings-market.ts`. Add `GUARD_TOKENS` near the top of the file (after the `Country` type) and update `classifyMarketByHoldings` to apply the guard at `depth === 0`:

```typescript
import YahooFinance from "yahoo-finance2";
import type { Market } from "./allowlists";

const yahooFinance = new YahooFinance();

type Country = "USA" | "Canada" | "Both" | "Other" | "Unknown";

const GUARD_TOKENS = [
  "global", "world", "international", "intl",
  "emerging", "foreign", "ex-us", "ex us", "ex-usa",
  "developed", "all-country", "all country",
  "msci eafe", "acwi",
];

const CA_SUFFIX_RE = /\.(TO|V|NE|CN)$/i;
const US_EXPLICIT_RE = /\.US$/i;
const ANY_SUFFIX_RE = /\.[A-Z]{1,4}$/;

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

export function isClassificationExpired(ts: string | null | undefined): boolean {
  if (ts == null) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ONE_YEAR_MS;
}

function resolveByExchangeSuffix(symbol: string): Country {
  if (CA_SUFFIX_RE.test(symbol)) return "Canada";
  if (US_EXPLICIT_RE.test(symbol)) return "USA";
  if (!symbol.includes(".")) return "USA";
  if (ANY_SUFFIX_RE.test(symbol)) return "Other";
  return "Unknown";
}

function nameOrCategoryMatchesGuard(name: string, category: string): boolean {
  const haystack = (name + " " + category).toLowerCase();
  return GUARD_TOKENS.some(t => haystack.includes(t));
}

async function resolveHoldingCountry(
  symbol: string,
  _quoteType: string,
  _parentDepth: number,
): Promise<Country> {
  return resolveByExchangeSuffix(symbol);
}

export async function classifyMarketByHoldings(
  symbol: string,
  depth: number,
): Promise<Market> {
  if (depth > 1) return "Not Found";

  let summary: any;
  try {
    summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["topHoldings", "price", "fundProfile"],
    });
  } catch {
    return "Not Found";
  }

  const holdings = summary?.topHoldings?.holdings ?? [];
  if (!Array.isArray(holdings) || holdings.length === 0) return "Not Found";

  // Name/category guard fires only at the parent fund (depth=0).
  if (depth === 0) {
    const fundName = String(summary?.price?.shortName ?? "") + " " + String(summary?.price?.longName ?? "");
    const fundCategory = String(summary?.fundProfile?.categoryName ?? "");
    if (nameOrCategoryMatchesGuard(fundName, fundCategory)) return "Not Found";
  }

  const symbols: string[] = holdings.map((h: any) => String(h.symbol)).filter(Boolean);

  let quoteTypeBySymbol = new Map<string, string>();
  try {
    const quotes = await yahooFinance.quote(symbols);
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    quoteTypeBySymbol = new Map(arr.map((q: any) => [String(q.symbol), String(q.quoteType ?? "EQUITY")]));
  } catch {
    // Fall back to treating everything as EQUITY.
  }

  const countries: Country[] = [];
  for (const sym of symbols) {
    const qt = quoteTypeBySymbol.get(sym) ?? "EQUITY";
    countries.push(await resolveHoldingCountry(sym, qt, depth));
  }

  const resolved = countries.filter(c => c !== "Unknown");
  if (resolved.length === 0) return "Not Found";

  const hasUS = resolved.some(c => c === "USA" || c === "Both");
  const hasCA = resolved.some(c => c === "Canada" || c === "Both");
  const hasOther = resolved.some(c => c === "Other");

  if (hasOther) return "Global";
  if (hasUS && hasCA) return "North America";
  if (hasUS) return "USA";
  if (hasCA) return "Canada";
  return "Not Found";
}
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/holdings-market.ts src/lib/classification/__tests__/holdings-market.test.ts
git commit -m "feat(classification): name/category guard for holdings-market

Suppresses classification when the fund name or fundProfile category
matches Global/World/International/Emerging/Foreign/etc. tokens.
Guard fires only at depth=0 so sub-funds classified during recursion
still use their own holdings."
```

---

## Task 4: Sub-fund recursion (one level deep)

**Files:**
- Modify: `src/lib/classification/holdings-market.ts`
- Modify: `src/lib/classification/__tests__/holdings-market.test.ts`

Implement the recursion-first logic from spec Section 2. When a top-10 holding has `quoteType === "ETF"` or `"MUTUALFUND"` and `parentDepth < 1`, classify it via a recursive `classifyMarketByHoldings` call **before** falling back to suffix. Map the sub-fund's classification onto the parent's aggregation: USA→USA, Canada→Canada, North America→Both, Global→Other, Not Found→fallback to suffix.

- [ ] **Step 1: Add failing tests for recursion**

Append to `src/lib/classification/__tests__/holdings-market.test.ts`:

```typescript
describe("classifyMarketByHoldings — sub-fund recursion", () => {
  beforeEach(() => {
    mockQuoteSummary.mockReset();
    mockQuote.mockReset();
  });

  it("recurses one level when top-10 contains ETFs", async () => {
    // VBAL.TO holds VTI (US-stock ETF) and VAB.TO (CA-bond ETF).
    mockQuoteSummary
      // First call: VBAL.TO fetched at depth=0
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "VTI", holdingName: "Vanguard US", holdingPercent: 0.5 },
          { symbol: "VAB.TO", holdingName: "Vanguard CA Bonds", holdingPercent: 0.5 },
        ]},
        price: { shortName: "Vanguard Balanced", longName: "Vanguard Balanced ETF Portfolio" },
        fundProfile: { categoryName: "Allocation--40% to 60% Equity" },
      })
      // Second call: VTI fetched recursively at depth=1
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 },
          { symbol: "MSFT", holdingName: "Microsoft", holdingPercent: 0.06 },
        ]},
        price: { shortName: "Vanguard Total US", longName: "Vanguard Total Stock Market ETF" },
        fundProfile: { categoryName: "Large Blend" },
      })
      // Third call: VAB.TO fetched recursively at depth=1
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "GOC.TO", holdingName: "Govt of Canada", holdingPercent: 0.1 },
          { symbol: "TD.TO", holdingName: "TD Corp Bond", holdingPercent: 0.05 },
        ]},
        price: { shortName: "Vanguard CA Bond", longName: "Vanguard Canadian Aggregate Bond" },
        fundProfile: { categoryName: "Canadian Fixed Income" },
      });

    mockQuote
      // batch quote for VBAL.TO's top-10
      .mockResolvedValueOnce([
        { symbol: "VTI", quoteType: "ETF" },
        { symbol: "VAB.TO", quoteType: "ETF" },
      ])
      // batch quote for VTI's top-10 (stocks)
      .mockResolvedValueOnce([
        { symbol: "AAPL", quoteType: "EQUITY" },
        { symbol: "MSFT", quoteType: "EQUITY" },
      ])
      // batch quote for VAB.TO's top-10 (stocks/bonds — quoteType irrelevant for suffix)
      .mockResolvedValueOnce([
        { symbol: "GOC.TO", quoteType: "EQUITY" },
        { symbol: "TD.TO", quoteType: "EQUITY" },
      ]);

    // VBAL holds a US fund (USA) and a Canadian fund (Canada) → North America
    expect(await classifyMarketByHoldings("VBAL.TO", 0)).toBe("North America");
  });

  it("VEQT-style global all-equity classifies as Global, not North America", async () => {
    // Regression test for spec self-review bug: suffix-first would have
    // returned "North America" because all sub-ETFs are .TO-suffixed.
    // The fix recurses INTO each sub-ETF and discovers VIU.TO holds
    // international stocks (.L, .DE) → contributes "Other" → parent = Global.
    mockQuoteSummary
      // VEQT.TO at depth=0
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "VTI", holdingName: "VTI", holdingPercent: 0.45 },
          { symbol: "VCN.TO", holdingName: "VCN", holdingPercent: 0.30 },
          { symbol: "VIU.TO", holdingName: "VIU", holdingPercent: 0.20 },
          { symbol: "VEE.TO", holdingName: "VEE", holdingPercent: 0.05 },
        ]},
        price: { shortName: "Vanguard All-Equity", longName: "Vanguard All-Equity ETF Portfolio" },
        fundProfile: { categoryName: "Allocation--85% to 100% Equity" },
      })
      // VTI recursion → classifies as USA
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "AAPL", holdingName: "Apple", holdingPercent: 0.07 }] },
        price: { shortName: "Vanguard US", longName: "Vanguard Total Stock Market" },
        fundProfile: { categoryName: "Large Blend" },
      })
      // VCN.TO recursion → classifies as Canada
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "RY.TO", holdingName: "Royal Bank", holdingPercent: 0.07 }] },
        price: { shortName: "Vanguard Canada", longName: "Vanguard FTSE Canada All Cap" },
        fundProfile: { categoryName: "Canada Equity" },
      })
      // VIU.TO recursion → classifies as Global (London + Frankfurt holdings)
      .mockResolvedValueOnce({
        topHoldings: { holdings: [
          { symbol: "BARC.L", holdingName: "Barclays", holdingPercent: 0.02 },
          { symbol: "SAP.DE", holdingName: "SAP", holdingPercent: 0.02 },
        ]},
        price: { shortName: "Vanguard FTSE Developed", longName: "Vanguard FTSE Developed All Cap" },
        fundProfile: { categoryName: "International" },
      })
      // VEE.TO recursion → classifies as Global
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "TSM", holdingName: "TSMC", holdingPercent: 0.06 }] },
        price: { shortName: "Vanguard Emerging", longName: "Vanguard Emerging Markets" },
        fundProfile: { categoryName: "Emerging" },
      });

    mockQuote
      // VEQT batch
      .mockResolvedValueOnce([
        { symbol: "VTI", quoteType: "ETF" },
        { symbol: "VCN.TO", quoteType: "ETF" },
        { symbol: "VIU.TO", quoteType: "ETF" },
        { symbol: "VEE.TO", quoteType: "ETF" },
      ])
      // VTI batch
      .mockResolvedValueOnce([{ symbol: "AAPL", quoteType: "EQUITY" }])
      // VCN.TO batch
      .mockResolvedValueOnce([{ symbol: "RY.TO", quoteType: "EQUITY" }])
      // VIU.TO batch
      .mockResolvedValueOnce([
        { symbol: "BARC.L", quoteType: "EQUITY" },
        { symbol: "SAP.DE", quoteType: "EQUITY" },
      ])
      // VEE.TO batch
      .mockResolvedValueOnce([{ symbol: "TSM", quoteType: "EQUITY" }]);

    // Note: VIU and VEE recurse but their PARENT fund names contain
    // guard tokens — but guard only fires at depth=0, so during recursion
    // they classify by holdings: VIU's stocks → "Other" → Global; VEE's
    // TSM (no suffix) → USA but TSM is unrecognized — actually TSM has
    // no suffix in our mock so it resolves as USA. Adjust expectation:
    // VEQT receives USA (VTI), Canada (VCN), Global (VIU), USA (VEE) →
    // hasUS && hasCA && hasOther → Global.
    expect(await classifyMarketByHoldings("VEQT.TO", 0)).toBe("Global");
  });

  it("does not recurse beyond depth=1", async () => {
    // Depth=2 returns Not Found immediately.
    expect(await classifyMarketByHoldings("ANY", 2)).toBe("Not Found");
    expect(mockQuoteSummary).not.toHaveBeenCalled();
  });

  it("falls back to suffix when sub-fund classification returns Not Found", async () => {
    // Parent's top-10 = one ETF whose own classification returns Not Found
    // (because of guard). Should fall through to suffix → "Canada" (.TO).
    mockQuoteSummary
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "VEE.TO", holdingName: "Emerging", holdingPercent: 1.0 }]},
        price: { shortName: "Test Parent", longName: "Test Parent ETF" },
        fundProfile: { categoryName: "Allocation" },
      })
      // VEE.TO recursion: name guard fires → Not Found
      .mockResolvedValueOnce({
        topHoldings: { holdings: [{ symbol: "TSM", holdingName: "TSMC", holdingPercent: 0.06 }] },
        price: { shortName: "Vanguard Emerging", longName: "Vanguard FTSE Emerging Markets" },
        fundProfile: { categoryName: "Emerging Markets" },
      });

    mockQuote
      .mockResolvedValueOnce([{ symbol: "VEE.TO", quoteType: "ETF" }])
      .mockResolvedValueOnce([{ symbol: "TSM", quoteType: "EQUITY" }]);

    // After recursion fallback: VEE.TO suffix → Canada → parent = Canada
    expect(await classifyMarketByHoldings("TESTPARENT.TO", 0)).toBe("Canada");
  });
});
```

- [ ] **Step 2: Run tests to confirm new ones fail**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: 3 of the 4 new tests FAIL (depth-overrun test passes — guard already returns Not Found at depth>1).

- [ ] **Step 3: Implement recursion in `resolveHoldingCountry`**

Edit `src/lib/classification/holdings-market.ts`. Replace the stub `resolveHoldingCountry` with the recursive version. The full file should now read:

```typescript
import YahooFinance from "yahoo-finance2";
import type { Market } from "./allowlists";

const yahooFinance = new YahooFinance();

type Country = "USA" | "Canada" | "Both" | "Other" | "Unknown";

const GUARD_TOKENS = [
  "global", "world", "international", "intl",
  "emerging", "foreign", "ex-us", "ex us", "ex-usa",
  "developed", "all-country", "all country",
  "msci eafe", "acwi",
];

const CA_SUFFIX_RE = /\.(TO|V|NE|CN)$/i;
const US_EXPLICIT_RE = /\.US$/i;
const ANY_SUFFIX_RE = /\.[A-Z]{1,4}$/;

const ONE_YEAR_MS = 365 * 24 * 3600 * 1000;

export function isClassificationExpired(ts: string | null | undefined): boolean {
  if (ts == null) return true;
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > ONE_YEAR_MS;
}

function resolveByExchangeSuffix(symbol: string): Country {
  if (CA_SUFFIX_RE.test(symbol)) return "Canada";
  if (US_EXPLICIT_RE.test(symbol)) return "USA";
  if (!symbol.includes(".")) return "USA";
  if (ANY_SUFFIX_RE.test(symbol)) return "Other";
  return "Unknown";
}

function nameOrCategoryMatchesGuard(name: string, category: string): boolean {
  const haystack = (name + " " + category).toLowerCase();
  return GUARD_TOKENS.some(t => haystack.includes(t));
}

async function resolveHoldingCountry(
  symbol: string,
  quoteType: string,
  parentDepth: number,
): Promise<Country> {
  const isFund = quoteType === "ETF" || quoteType === "MUTUALFUND";

  // Recursion FIRST for sub-funds — their suffix tells where they're
  // listed, not what they hold.
  if (isFund && parentDepth < 1) {
    const sub = await classifyMarketByHoldings(symbol, parentDepth + 1);
    if (sub === "USA") return "USA";
    if (sub === "Canada") return "Canada";
    if (sub === "North America") return "Both";
    if (sub === "Global") return "Other";
    // sub === "Not Found" → fall through to suffix.
  }

  return resolveByExchangeSuffix(symbol);
}

export async function classifyMarketByHoldings(
  symbol: string,
  depth: number,
): Promise<Market> {
  if (depth > 1) return "Not Found";

  let summary: any;
  try {
    summary = await yahooFinance.quoteSummary(symbol, {
      modules: ["topHoldings", "price", "fundProfile"],
    });
  } catch {
    return "Not Found";
  }

  const holdings = summary?.topHoldings?.holdings ?? [];
  if (!Array.isArray(holdings) || holdings.length === 0) return "Not Found";

  if (depth === 0) {
    const fundName = String(summary?.price?.shortName ?? "") + " " + String(summary?.price?.longName ?? "");
    const fundCategory = String(summary?.fundProfile?.categoryName ?? "");
    if (nameOrCategoryMatchesGuard(fundName, fundCategory)) return "Not Found";
  }

  const symbols: string[] = holdings.map((h: any) => String(h.symbol)).filter(Boolean);

  let quoteTypeBySymbol = new Map<string, string>();
  try {
    const quotes = await yahooFinance.quote(symbols);
    const arr = Array.isArray(quotes) ? quotes : [quotes];
    quoteTypeBySymbol = new Map(arr.map((q: any) => [String(q.symbol), String(q.quoteType ?? "EQUITY")]));
  } catch {
    // Fall back to treating everything as EQUITY.
  }

  const countries: Country[] = [];
  for (const sym of symbols) {
    const qt = quoteTypeBySymbol.get(sym) ?? "EQUITY";
    countries.push(await resolveHoldingCountry(sym, qt, depth));
  }

  const resolved = countries.filter(c => c !== "Unknown");
  if (resolved.length === 0) return "Not Found";

  const hasUS = resolved.some(c => c === "USA" || c === "Both");
  const hasCA = resolved.some(c => c === "Canada" || c === "Both");
  const hasOther = resolved.some(c => c === "Other");

  if (hasOther) return "Global";
  if (hasUS && hasCA) return "North America";
  if (hasUS) return "USA";
  if (hasCA) return "Canada";
  return "Not Found";
}
```

- [ ] **Step 4: Run all tests**

Run: `npx jest src/lib/classification/__tests__/holdings-market.test.ts`
Expected: all 13 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/holdings-market.ts src/lib/classification/__tests__/holdings-market.test.ts
git commit -m "feat(classification): one-level recursion for sub-funds

When a top-10 holding has quoteType ETF/MUTUALFUND and parent depth=0,
classify the sub-fund via recursion BEFORE falling back to exchange
suffix. Fixes the VEQT-style false positive where all-.TO-listed
all-in-ones would mistakenly classify as North America."
```

---

## Task 5: Wire classifier into `researchTicker` (with integration tests)

**Files:**
- Modify: `src/lib/ticker-research.ts`
- Create: `src/lib/__tests__/ticker-research.test.ts`

Add the classifier orchestration around the existing `researchTicker` body. The function gains an optional `existingAsset?` parameter; when the asset is an ETF/Fund whose `normalizeMarket` returned "Not Found", the lock is off, and `marketComputedAt` is expired, run `classifyMarketByHoldings` and capture the timestamp. Integration tests cover the five orchestration paths from the spec.

- [ ] **Step 1: Write the failing orchestration tests**

Create `src/lib/__tests__/ticker-research.test.ts`. The Yahoo mock uses module-level shared `mock`-prefixed fns (the same pattern as Task 2's holdings-market test). The classifier helper (`./classification/holdings-market`) is also mocked so we can spy on `classifyMarketByHoldings` calls without going through Yahoo a second time.

```typescript
const mockYahooQuote = jest.fn();
const mockYahooQuoteSummary = jest.fn();
const mockClassifyMarketByHoldings = jest.fn();

jest.mock("yahoo-finance2", () => ({
  __esModule: true,
  default: class {
    quote = mockYahooQuote;
    quoteSummary = mockYahooQuoteSummary;
  },
}));

jest.mock("../classification/holdings-market", () => ({
  __esModule: true,
  classifyMarketByHoldings: mockClassifyMarketByHoldings,
  isClassificationExpired: jest.requireActual("../classification/holdings-market").isClassificationExpired,
}));

import { researchTicker } from "../ticker-research";

// Build a baseline Yahoo response that resolves an ETF on a US exchange with
// market = "Not Found" (the trigger for the new classifier path).
function mockEtfResponses() {
  mockYahooQuote.mockResolvedValue({
    quoteType: "ETF",
    exchange: "PCX",  // not in US_EXCHANGES set in normalizeMarket → returns Not Found for ETFs
    regularMarketPrice: 100,
    currency: "USD",
    shortName: "Test ETF",
  });
  mockYahooQuoteSummary.mockImplementation(async (_sym: string, opts: any) => {
    // researchTicker calls quoteSummary first with the full module list.
    if (opts?.modules?.includes("summaryDetail")) {
      return {
        summaryDetail: { dividendYield: 0.02, managementFee: null },
        assetProfile: { longBusinessSummary: "" },
        fundProfile: {},
        defaultKeyStatistics: { beta: 1.0 },
        recommendationTrend: { trend: [{ recommendationMean: "Buy" }] },
      };
    }
    return {};
  });
}

describe("researchTicker orchestration — 3C classifier integration", () => {
  beforeEach(() => {
    mockYahooQuote.mockReset();
    mockYahooQuoteSummary.mockReset();
    mockClassifyMarketByHoldings.mockReset();
  });

  it("ETF with no existingAsset → calls classifier; returns fresh marketComputedAt", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");

    const result = await researchTicker("VOO");

    expect(mockClassifyMarketByHoldings).toHaveBeenCalledWith("VOO", 0);
    expect(result?.market).toBe("USA");
    expect(typeof result?.marketComputedAt).toBe("string");
    expect(Date.parse(result!.marketComputedAt as string)).toBeGreaterThan(Date.now() - 5000);
  });

  it("ETF with fresh marketComputedAt (< 365 days) → classifier skipped", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const fresh = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();  // 60 days old

    const result = await researchTicker("VOO", { userOverrides: undefined, marketComputedAt: fresh });

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    // market falls back to normalizeMarket result (Not Found for ETFs on PCX); marketComputedAt echoes back.
    expect(result?.market).toBe("Not Found");
    expect(result?.marketComputedAt).toBe(fresh);
  });

  it("ETF with expired marketComputedAt (> 365 days) → classifier runs", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const stale = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VOO", { userOverrides: undefined, marketComputedAt: stale });

    expect(mockClassifyMarketByHoldings).toHaveBeenCalledWith("VOO", 0);
    expect(result?.market).toBe("USA");
    expect(result?.marketComputedAt).not.toBe(stale);
  });

  it("ETF with userOverrides.market === true → classifier skipped", async () => {
    mockEtfResponses();
    mockClassifyMarketByHoldings.mockResolvedValue("USA");
    const stale = new Date(Date.now() - 400 * 24 * 3600 * 1000).toISOString();

    const result = await researchTicker("VOO", {
      userOverrides: { market: true },
      marketComputedAt: stale,
    });

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.marketComputedAt).toBe(stale);
  });

  it("Company (non-ETF/Fund) → classifier never runs", async () => {
    mockYahooQuote.mockResolvedValue({
      quoteType: "EQUITY",
      exchange: "NYQ",
      regularMarketPrice: 150,
      currency: "USD",
      shortName: "Apple",
    });
    mockYahooQuoteSummary.mockResolvedValue({
      summaryDetail: { dividendYield: 0.005 },
      assetProfile: { longBusinessSummary: "Apple makes phones." },
      fundProfile: {},
      defaultKeyStatistics: { beta: 1.2 },
      recommendationTrend: { trend: [{ recommendationMean: "Buy" }] },
    });
    mockClassifyMarketByHoldings.mockResolvedValue("USA");

    const result = await researchTicker("AAPL");

    expect(mockClassifyMarketByHoldings).not.toHaveBeenCalled();
    expect(result?.market).toBe("USA");  // exchange-suffix path for Companies
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx jest src/lib/__tests__/ticker-research.test.ts`
Expected: FAIL — `marketComputedAt` not in `TickerMetadata`, `researchTicker` doesn't accept `existingAsset`.

- [ ] **Step 3: Update `TickerMetadata` and `researchTicker` signature**

Edit `src/lib/ticker-research.ts`. At the top of the file, import the new classifier and the Asset type, then extend `TickerMetadata`:

```typescript
import YahooFinance from 'yahoo-finance2';
import {
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
  type StrategyType,
  type SecurityType,
  type Sector,
  type Market,
  type ManagementStyle,
  type CallValue,
} from "./classification/allowlists";
import { classifyMarketByHoldings, isClassificationExpired } from "./classification/holdings-market";
import type { Asset } from "@/types";

const yahooFinance = new YahooFinance();

const PASSIVE_FAMILIES = [
  'vanguard', 'ishares', 'spdr', 'bmo', 'horizons',
  'invesco', 'schwab', 'fidelity index',
];

export interface TickerMetadata {
  name: string;
  symbol: string;
  securityType: SecurityType;
  strategyType: StrategyType;
  call: CallValue;
  sector: Sector;
  market: Market;
  managementStyle: ManagementStyle;
  managementFee: number | null;
  dividendYield: number | null;
  exDividendDate: string;
  oneYearReturn: number | null;
  threeYearReturn: number | null;
  analystConsensus: string;
  externalRating: string;
  beta: number;
  volatility: number;
  riskFlag: string;
  currency: string;
  currentPrice: number;
  marketComputedAt: string | null;
}
```

- [ ] **Step 4: Modify the `researchTicker` body to call the classifier**

Replace the existing `researchTicker` function in `src/lib/ticker-research.ts` with:

```typescript
export async function researchTicker(
  symbol: string,
  existingAsset?: Pick<Asset, "userOverrides" | "marketComputedAt"> | null,
): Promise<Partial<TickerMetadata> | null> {
  let ticker = symbol.toUpperCase();
  try {
    let quote;
    try {
      quote = await yahooFinance.quote(ticker);
    } catch (e) {
      if (!ticker.includes('.') && (ticker.length === 3 || ticker.length === 4)) {
        ticker = `${ticker}.TO`;
        quote = await yahooFinance.quote(ticker);
      } else {
        throw e;
      }
    }

    let summary: any = {};
    try {
      summary = await yahooFinance.quoteSummary(ticker, {
        modules: ['summaryDetail', 'assetProfile', 'fundProfile', 'calendarEvents', 'fundPerformance', 'recommendationTrend', 'defaultKeyStatistics'],
      });
    } catch (e) {
      try {
        summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'assetProfile'] });
      } catch (e2) {
        if (!ticker.includes('.')) {
          ticker = `${ticker}.TO`;
          summary = await yahooFinance.quoteSummary(ticker, { modules: ['summaryDetail', 'assetProfile'] });
        } else {
          throw e2;
        }
      }
    }

    const summaryDetail = summary.summaryDetail;
    const assetProfile = summary.assetProfile;
    const fundProfile = summary.fundProfile;

    const dividendYield = summaryDetail?.dividendYield ?? summaryDetail?.yield ?? summary.defaultKeyStatistics?.yield ?? null;
    const description = (assetProfile?.longBusinessSummary) || (fundProfile?.description) || '';
    const quoteType = quote.quoteType || '';
    const beta = summary.defaultKeyStatistics?.beta3Year || summary.defaultKeyStatistics?.beta || 0;

    const name = (quote.shortName || quote.longName || ticker);
    const isCallInName = /covered.?call|covered.?option/i.test(name);
    const isCallInDesc = /covered.?call|option.?writing|call.?options|yield.?enhancement/i.test(description);

    const securityType = normalizeSecurityType(quoteType);
    const strategyType: StrategyType = securityType === "Not Found"
      ? "Not Found"
      : classifyStrategyType(dividendYield ?? 0, beta, description, securityType, name);

    let market = normalizeMarket(quote.exchange, securityType);
    let marketComputedAt: string | null = existingAsset?.marketComputedAt ?? null;

    // 3C: holdings-based classification for ETFs/Funds when not locked + cache expired.
    const marketLocked = existingAsset?.userOverrides?.market === true;
    const cacheExpired = isClassificationExpired(existingAsset?.marketComputedAt);
    if (
      market === "Not Found" &&
      (securityType === "ETF" || securityType === "Fund") &&
      !marketLocked &&
      cacheExpired
    ) {
      market = await classifyMarketByHoldings(ticker, 0);
      marketComputedAt = new Date().toISOString();
    }

    const result = {
      name,
      symbol: ticker,
      currentPrice: quote.regularMarketPrice || 0,
      dividendYield,
      securityType,
      strategyType,
      call: ((securityType === "Fund" || securityType === "ETF") && (isCallInName || isCallInDesc)) ? "Yes" as const : "No" as const,
      sector: inferSector(description, assetProfile?.sector),
      market,
      marketComputedAt,
      managementStyle: normalizeManagementStyle(
        (assetProfile?.longBusinessSummary || "").toLowerCase().includes("index") ? "Passive" : "Active"
      ),
      managementFee: summaryDetail?.managementFee ?? null,
      exDividendDate: summaryDetail?.exDividendDate?.toISOString() || "",
      oneYearReturn: summary.fundPerformance?.trailingReturns?.oneYear ?? null,
      threeYearReturn: summary.fundPerformance?.trailingReturns?.threeYear ?? null,
      analystConsensus: summary.recommendationTrend?.trend?.[0]?.recommendationMean || "N/A",
      volatility: 0,
      riskFlag: "Normal",
      currency: normalizeCurrency(quote.currency || "USD"),
    };

    return applyCompanyAutoDefaults(result);
  } catch (error) {
    console.error(`Error researching ${ticker}:`, error);
    return null;
  }
}
```

The PASSIVE_FAMILIES const stays where it is (just before TickerMetadata). The `classifyStrategyType` and `inferSector` functions are unchanged from the existing file.

- [ ] **Step 5: Verify type-check passes**

Run: `npx tsc --noEmit`
Expected: clean. Existing call sites that don't pass `existingAsset` are still valid (the parameter is optional).

- [ ] **Step 6: Run all tests**

Run: `npx jest`
Expected: all tests pass — including the 5 new orchestration tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ticker-research.ts src/lib/__tests__/ticker-research.test.ts
git commit -m "feat(ticker-research): inline holdings-market classifier for ETFs

researchTicker now accepts an optional existingAsset and runs
classifyMarketByHoldings when securityType is ETF/Fund, market is
otherwise Not Found, the 3A market lock is off, and the cached
marketComputedAt is older than 365 days (or null/undefined). Returns
the new marketComputedAt timestamp in TickerMetadata. Integration
tests cover the five orchestration paths (no existingAsset, fresh
cache, expired cache, market locked, non-ETF)."
```

---

## Task 6: Pass existing asset from `ticker-lookup` route

**Files:**
- Modify: `src/app/api/ticker-lookup/route.ts`

The `/api/ticker-lookup` route currently calls `researchTicker(symbol)` with no context about the household's existing asset. To make the classifier respect the 3A lock and the TTL, the route must query DynamoDB for any asset matching the ticker in the current household and forward it.

- [ ] **Step 1: Modify the route handler**

Replace the entire content of `src/app/api/ticker-lookup/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { researchTicker } from '@/lib/ticker-research';
import { db, TABLE_NAME } from '@/lib/db';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import type { Asset } from '@/types';

async function findExistingAssetByTicker(
  householdId: string,
  ticker: string,
): Promise<Pick<Asset, "userOverrides" | "marketComputedAt"> | null> {
  try {
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :prefix)",
        ExpressionAttributeValues: {
          ":pk": `HOUSEHOLD#${householdId}`,
          ":prefix": "ASSET#",
        },
      })
    );
    const upper = ticker.toUpperCase();
    const match = (Items ?? []).find((a: any) => String(a.ticker ?? "").toUpperCase() === upper);
    if (!match) return null;
    return {
      userOverrides: match.userOverrides as Asset["userOverrides"],
      marketComputedAt: typeof match.marketComputedAt === "string" || match.marketComputedAt === null
        ? (match.marketComputedAt as string | null)
        : undefined,
    };
  } catch (e) {
    console.warn(`[ticker-lookup] Failed to load existing asset for ${ticker}:`, e);
    return null;
  }
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.householdId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  try {
    const existing = await findExistingAssetByTicker(session.user.householdId, symbol);
    const data = await researchTicker(symbol, existing);
    if (!data) {
      return NextResponse.json({ error: `Could not find ticker: ${symbol}` }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error(`[ticker-lookup] Error for ${symbol}:`, error);
    return NextResponse.json(
      { error: `Could not find ticker: ${symbol}` },
      { status: 404 }
    );
  }
}
```

- [ ] **Step 2: Verify build / type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ticker-lookup/route.ts
git commit -m "feat(ticker-lookup): pass household's existing asset to researchTicker

Loads the current household's asset matching the requested symbol (if
any) and forwards userOverrides + marketComputedAt to researchTicker.
This is what makes the 3A market lock and the 3C 365-day TTL fire on
the lookup path. A missing or unmatched asset is still valid (treated
as a fresh classification)."
```

---

## Task 7: Wire `marketComputedAt` through the PDF re-import path

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`

The PDF route already passes `existing` through `pickWithLock` for the `market` field. Two changes:

1. Pass the `existing` asset into `researchTicker` so the classifier respects the lock + TTL on PDF re-import.
2. Persist `marketComputedAt` on the new item, lock-respectingly. When market is locked, preserve the existing timestamp; when unlocked, use the timestamp returned by `researchTicker` (which itself either ran the classifier or echoed back the existing value).

- [ ] **Step 1: Update the `researchTicker` call site**

In `src/app/api/portfolio-pdf/route.ts`, find the enrichment block around line 167-177 and update it to pass `existing`:

```typescript
            if (needsMetadata) {
                if (tickerCache.has(h.ticker)) {
                    enrichedData = tickerCache.get(h.ticker);
                } else {
                    try {
                        enrichedData = await researchTicker(h.ticker, existing);
                        tickerCache.set(h.ticker, enrichedData);
                    } catch (e) {
                        console.warn(`[portfolio-pdf] AI Enrichment failed for ${h.ticker}:`, e);
                    }
                }
            }
```

(Only the `await researchTicker(h.ticker, existing)` line changes — `existing` is already in scope from line 140-150.)

- [ ] **Step 2: Persist `marketComputedAt` on the new item**

In the same file, locate the `baseItem` object construction (currently around line 192-282) and add a new property right after the `market` field (around line 252):

```typescript
                market: normalizeMarket(
                    pickWithLock(
                        existing,
                        "market",
                        existing?.market,
                        (existing?.market && existing.market !== "" && existing.market !== "Not Found") ? existing.market : enrichedData?.market,
                    ),
                    securityType,
                ),
                marketComputedAt: existing?.userOverrides?.market === true
                    ? (existing?.marketComputedAt ?? null)
                    : (enrichedData?.marketComputedAt ?? existing?.marketComputedAt ?? null),
```

The lock-respecting rule:
- If `market` is locked → keep the existing timestamp (the manual-set sentinel `null`, or whatever was there).
- If unlocked → take whatever `researchTicker` returned (either fresh classification timestamp or echoed-existing).

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts
git commit -m "feat(portfolio-pdf): thread marketComputedAt through PDF re-import

Passes the matching existing asset into researchTicker so the 3C
classifier respects the 3A market lock and the 365-day TTL on
re-import. Persists marketComputedAt on the new item with lock-aware
fallback (locked → preserve existing; unlocked → use researchTicker's
returned timestamp)."
```

---

## Task 8: Accept `marketComputedAt` in asset POST and PUT routes

**Files:**
- Modify: `src/app/api/assets/route.ts`
- Modify: `src/app/api/assets/[id]/route.ts`

The asset routes don't currently know about `marketComputedAt`. POST (new asset) needs to accept it from the body so a freshly-classified ETF carries its timestamp into DynamoDB. PUT (update) needs to accept it so the client can clear it to `null` (manual-set sentinel) when the user manually edits market.

- [ ] **Step 1: Add `marketComputedAt` and `userOverrides` to POST**

In `src/app/api/assets/route.ts`, locate the `baseAsset` construction and append the two new fields just before `updatedAt`:

```typescript
        const securityType = normalizeSecurityType(data.securityType);
        const baseAsset = {
            PK: PROFILE_KEY,
            SK: assetSK,
            id: assetId,
            profileId: PROFILE_KEY,
            type: "ASSET" as const,

            account: data.account || "",
            ticker: data.ticker || "",
            securityType,
            strategyType: normalizeStrategyType(data.strategyType),
            call: normalizeCall(data.call),
            sector: normalizeSector(data.sector),
            market: normalizeMarket(data.market, securityType),
            currency: normalizeCurrency(data.currency),
            managementStyle: normalizeManagementStyle(data.managementStyle),
            externalRating: data.externalRating || "",

            managementFee: data.managementFee != null && data.managementFee !== "" ? parseFloat(data.managementFee) : null,
            quantity: parseFloat(data.quantity) || 0,
            liveTickerPrice: parseFloat(data.liveTickerPrice) || 0,
            bookCost: parseFloat(data.bookCost) || 0,
            marketValue: parseFloat(data.marketValue) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0),
            profitLoss: parseFloat(data.profitLoss) || ((parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0)) - (parseFloat(data.bookCost) || 0),
            yield: data.yield != null && data.yield !== "" ? parseFloat(data.yield) : null,
            oneYearReturn: data.oneYearReturn != null && data.oneYearReturn !== "" ? parseFloat(data.oneYearReturn) : null,
            fiveYearReturn: data.fiveYearReturn != null && data.fiveYearReturn !== "" ? parseFloat(data.fiveYearReturn) : null,
            threeYearReturn: data.threeYearReturn != null && data.threeYearReturn !== "" ? parseFloat(data.threeYearReturn) : null,
            exDividendDate: data.exDividendDate || "",
            analystConsensus: data.analystConsensus || "",
            beta: parseFloat(data.beta) || 0,
            riskFlag: data.riskFlag || "",
            accountNumber: data.accountNumber || "",
            accountType: data.accountType || "",
            risk: data.risk || "",
            volatility: parseFloat(data.volatility) || 0,
            expectedAnnualDividends: parseFloat(data.expectedAnnualDividends) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0) * (parseFloat(data.yield) || 0),

            userOverrides: data.userOverrides && typeof data.userOverrides === "object" ? data.userOverrides : undefined,
            marketComputedAt: typeof data.marketComputedAt === "string" || data.marketComputedAt === null ? data.marketComputedAt : undefined,

            updatedAt: new Date().toISOString(),
        };
```

Note: this also closes the 3A pre-existing gap where POST didn't accept `userOverrides`. New manually-added rows now correctly preserve any locks the user set during the create flow.

- [ ] **Step 2: Add `marketComputedAt` to PUT**

In `src/app/api/assets/[id]/route.ts`, find the `merged` object construction. Locate the line `userOverrides: data.userOverrides !== undefined ? data.userOverrides : existingAsset.userOverrides,` (around line 153) and add the `marketComputedAt` field directly after it:

```typescript
            userOverrides: data.userOverrides !== undefined ? data.userOverrides : existingAsset.userOverrides,
            marketComputedAt: data.marketComputedAt !== undefined ? data.marketComputedAt : existingAsset.marketComputedAt,
            updatedAt: new Date().toISOString(),
        };
```

- [ ] **Step 3: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assets/route.ts src/app/api/assets/[id]/route.ts
git commit -m "feat(api/assets): accept marketComputedAt + userOverrides

POST now accepts marketComputedAt and userOverrides from the request
body so freshly-classified ETFs and locked fields persist correctly
on create. PUT accepts marketComputedAt so the client can clear it to
null when the user manually edits Market (3C unlock self-heal flow)."
```

---

## Task 9: Lookup-side handling of `marketComputedAt`

**Files:**
- Modify: `src/app/dashboard/lib/applyLookupRespectingLocks.ts`
- Create: `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`

The client helper that merges a ticker-lookup response into the edit form must:
1. Forward `marketComputedAt` from the lookup response into the form when market is unlocked.
2. Preserve the existing form value of `marketComputedAt` when market is locked.

- [ ] **Step 1: Write failing tests for the marketComputedAt handling**

Create `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`:

```typescript
import { applyLookupRespectingLocks } from "../applyLookupRespectingLocks";
import type { Asset } from "@/types";

describe("applyLookupRespectingLocks — marketComputedAt", () => {
  it("forwards data.marketComputedAt when market is unlocked", async () => {
    const prev: Partial<Asset> = {
      market: "Not Found",
      marketComputedAt: undefined,
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: "2026-04-30T12:00:00Z",
    });

    expect(result.market).toBe("USA");
    expect(result.marketComputedAt).toBe("2026-04-30T12:00:00Z");
  });

  it("preserves prev.marketComputedAt when market is locked", async () => {
    const prev: Partial<Asset> = {
      market: "Canada",
      marketComputedAt: null,  // manual-set sentinel
      userOverrides: { market: true },
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: "2026-04-30T12:00:00Z",
    });

    expect(result.market).toBe("Canada");
    expect(result.marketComputedAt).toBeNull();
  });

  it("when unlocked and lookup omits marketComputedAt, falls back to prev", async () => {
    const prev: Partial<Asset> = {
      market: "USA",
      marketComputedAt: "2026-01-01T00:00:00Z",
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      // marketComputedAt omitted from lookup response
    });

    expect(result.marketComputedAt).toBe("2026-01-01T00:00:00Z");
  });

  it("when unlocked and lookup explicitly sends null, writes null", async () => {
    const prev: Partial<Asset> = {
      market: "USA",
      marketComputedAt: "2026-01-01T00:00:00Z",
      userOverrides: {},
    };
    const result = applyLookupRespectingLocks(prev, {
      market: "USA",
      marketComputedAt: null,
    });

    expect(result.marketComputedAt).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `npx jest src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`
Expected: FAIL — `marketComputedAt` not handled by the function.

- [ ] **Step 3: Add `marketComputedAt` to `LookupData` and the function output**

Replace the entire content of `src/app/dashboard/lib/applyLookupRespectingLocks.ts` with:

```typescript
import type { Asset, LockableField } from "@/types";

const LOCKABLE_FIELDS: readonly LockableField[] = [
    "sector",
    "market",
    "securityType",
    "strategyType",
    "call",
    "managementStyle",
    "currency",
    "managementFee",
] as const;

export type LookupData = {
    sector?: string;
    market?: string;
    securityType?: string;
    strategyType?: string;
    call?: string;
    managementStyle?: string;
    currency?: string;
    managementFee?: number | null;
    currentPrice?: number;
    dividendYield?: number | null;
    oneYearReturn?: number | null;
    threeYearReturn?: number | null;
    exDividendDate?: string;
    analystConsensus?: string;
    externalRating?: string;
    beta?: number;
    riskFlag?: string;
    marketComputedAt?: string | null;
};

/**
 * Returns the patch to apply to editForm in response to a ticker lookup,
 * skipping any field that the user has explicitly locked.
 */
export function applyLookupRespectingLocks(
    prev: Partial<Asset>,
    data: LookupData,
): Partial<Asset> {
    const overrides = prev.userOverrides ?? {};
    const isLocked = (field: LockableField) => overrides[field] === true;

    return {
        sector: isLocked("sector") ? prev.sector : (data.sector || prev.sector),
        market: isLocked("market") ? prev.market : (data.market || prev.market),
        securityType: isLocked("securityType") ? prev.securityType : (data.securityType || prev.securityType),
        strategyType: isLocked("strategyType") ? prev.strategyType : (data.strategyType || prev.strategyType),
        call: isLocked("call") ? prev.call : (data.call || prev.call),
        managementStyle: isLocked("managementStyle") ? prev.managementStyle : (data.managementStyle || prev.managementStyle),
        currency: isLocked("currency") ? prev.currency : (data.currency || prev.currency),
        managementFee: isLocked("managementFee") ? prev.managementFee : (data.managementFee ?? prev.managementFee),

        // 3C: marketComputedAt rides with the market field's lock. Locked → keep
        // prev timestamp; unlocked → take whatever researchTicker returned (a
        // fresh ISO timestamp on classification, or echoed-existing on cache hit).
        marketComputedAt: isLocked("market")
            ? (prev.marketComputedAt ?? null)
            : (data.marketComputedAt !== undefined ? data.marketComputedAt : (prev.marketComputedAt ?? null)),

        // Live data — never locked. Lookup wins when it returns a value;
        // otherwise the previous edit-form value is preserved (so a
        // partial lookup doesn't wipe manually-entered values).
        liveTickerPrice: data.currentPrice ?? prev.liveTickerPrice ?? 0,
        yield: data.dividendYield ?? prev.yield ?? null,
        oneYearReturn: data.oneYearReturn ?? prev.oneYearReturn ?? null,
        threeYearReturn: data.threeYearReturn ?? prev.threeYearReturn ?? null,
        exDividendDate: data.exDividendDate ?? prev.exDividendDate ?? "",
        analystConsensus: data.analystConsensus ?? prev.analystConsensus ?? "",
        externalRating: data.externalRating ?? prev.externalRating ?? "",
        beta: data.beta ?? prev.beta ?? 0,
        riskFlag: data.riskFlag ?? prev.riskFlag ?? "",

        // userOverrides itself is never written by the lookup.
    };
}

export { LOCKABLE_FIELDS };
```

- [ ] **Step 4: Run tests to confirm all pass**

Run: `npx jest src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/lib/applyLookupRespectingLocks.ts src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts
git commit -m "feat(client): apply marketComputedAt lock-respectingly on lookup

When market is locked, marketComputedAt stays at its prev edit-form
value. When unlocked, the lookup's marketComputedAt overrides (so a
fresh classification or echoed-existing timestamp lands in form
state alongside the new market value). Unit tests cover unlocked
forward, locked preserve, lookup-omits-fallback, and explicit-null."
```

---

## Task 10: Client-side `setFieldWithLock` clears `marketComputedAt` for market

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

Per spec Section 4(b), when the user manually edits market via the inline form, `marketComputedAt` must be set to `null` (the "manual-set" sentinel). This makes the unlock flow self-heal: tapping the lock icon later flips `userOverrides.market = false`, and the next refresh sees `marketComputedAt === null`, treats it as expired, and re-classifies.

- [ ] **Step 1: Extend `setFieldWithLock`**

In `src/app/dashboard/DashboardClient.tsx`, locate the `setFieldWithLock` definition (around line 310) and replace it with:

```typescript
  const setFieldWithLock = <F extends LockableField>(field: F, value: Asset[F]) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value,
      userOverrides: { ...prev.userOverrides, [field]: true },
      // 3C: manual edit of `market` clears the cache timestamp so the
      // unlock flow self-heals — next refresh re-classifies.
      ...(field === "market" ? { marketComputedAt: null } : {}),
    }));
  };
```

- [ ] **Step 2: Verify type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): clear marketComputedAt on manual market edit

When the user manually edits Market via setFieldWithLock, set
marketComputedAt to null (the manual-set sentinel). On unlock, the
next researchTicker call sees null marketComputedAt → expired → fresh
classification. Without this, the cached USA timestamp would survive
through unlock and Market would stay stuck at the manually-set value."
```

---

## Task 11: Tooltip on Not Found Market cells

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

Per spec Section 5: an HTML `title` attribute on Market cells that render as "Not Found" *and* have `securityType ∈ {ETF, Fund}` *and* have `marketComputedAt` non-null. On desktop, hovering shows: "Couldn't determine from top holdings. Set manually if needed." On mobile no tooltip — the lock + manual edit affordance from 3A is the universal correction path.

The current `renderField` helper doesn't know about per-field tooltips. The cleanest place to apply the title is on the `<td>` element wrapping the Market cell (line 1001), since `renderField` returns the inner content and we have direct access to `asset` in the row scope.

- [ ] **Step 1: Wrap the Market cell with the conditional tooltip**

Find line 1001 in `src/app/dashboard/DashboardClient.tsx`:

```typescript
                          {/* 9. Market */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("market", true, markets, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
```

Replace with:

```typescript
                          {/* 9. Market */}
                          <td
                            className="px-3 py-3 text-neutral-700 dark:text-neutral-300"
                            title={
                              !isEditing &&
                              asset.market === "Not Found" &&
                              (asset.securityType === "ETF" || asset.securityType === "Fund") &&
                              asset.marketComputedAt
                                ? "Couldn't determine from top holdings. Set manually if needed."
                                : undefined
                            }
                          >
                            {renderField("market", true, markets, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
```

The `title` is `undefined` when the conditions aren't met, which renders no attribute (no tooltip).

- [ ] **Step 2: Verify type-check + build**

Run: `npx tsc --noEmit`
Expected: clean.

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): hover tooltip on Not Found ETF Market cells

Adds a title attribute to the Market <td> when the cell shows
'Not Found' on an ETF/Fund row whose marketComputedAt indicates the
classifier ran (and failed). On desktop, hovering reveals 'Couldn't
determine from top holdings. Set manually if needed.' Mobile shows no
tooltip — manual edit via 3A is the correction path."
```

---

## Task 12: Manual QA pass

**Files:** none

Verify the end-to-end behavior on the running app. This is a manual checklist, not an automated test. Run the dev server and exercise each scenario.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: dev server boots on http://localhost:3000.

- [ ] **Step 2: Verify a US ETF classifies on first encounter**

Open the dashboard. Find a US ETF in your portfolio that previously showed "Not Found" for Market (or add one via "Add Manual Row" → ticker = `VOO`). Click the row → enter edit mode → blur on the ticker field to trigger the lookup → save.

Expected: Market cell shows "USA". The audit log entry shows `marketComputedAt` transitioning from undefined/null → an ISO timestamp.

- [ ] **Step 3: Verify cache hit on subsequent refresh**

On the same row, click "refresh row" (or re-trigger the lookup). The Market should remain "USA" and the timestamp should be unchanged (the classifier should be skipped because the cache is fresh).

To verify the classifier was skipped, check the dev server logs — there should be no second `quoteSummary({modules: ['topHoldings', ...]})` call.

- [ ] **Step 4: Verify Canadian ETF classifies as Canada**

Add or refresh `XIU.TO` (or another all-Canadian ETF). Expected: Market = "Canada".

- [ ] **Step 5: Verify name-guard returns Not Found for global funds**

Add or refresh `VT` (Vanguard Total World) or `VEA` (Vanguard FTSE Developed Markets). Expected: Market = "Not Found" because the guard catches "World" or "Developed."

Hover the Market cell on desktop — the tooltip should read "Couldn't determine from top holdings. Set manually if needed."

- [ ] **Step 6: Verify all-in-one ETF classifies via recursion**

If you hold (or can add) `VBAL.TO`, `VEQT.TO`, `XBAL.TO`, or similar: expected market is "North America" or "Global" depending on the fund's actual mandate. **VEQT.TO** specifically should resolve to "Global", NOT "North America" (regression test for the suffix-first bug).

- [ ] **Step 7: Verify 3A lock interaction**

Pick any ETF row. Manually change Market to a different value (e.g., set "USA" → "Canada"). The lock icon should appear; save.

Click "refresh row". Market should stay "Canada"; lock still visible. The classifier should not have been called (no `topHoldings` request).

Tap the lock icon to unlock. Click "refresh row". Market should re-classify from scratch (you'll see the original USA value return if Yahoo's data is unchanged) and the lock icon should be gone. The dev-server logs should show a fresh `topHoldings` call.

- [ ] **Step 8: Verify mobile layout**

Open the dashboard at 375px width (Chrome DevTools → mobile view → iPhone 12). The Market column should still render correctly with no overflow. The lock icon (when present) should remain tap-friendly.

- [ ] **Step 9: Verify PDF re-import**

If you have a brokerage PDF on hand, re-import it. Existing ETF rows that previously showed "Not Found" for Market should now classify on this import (or stay locked if you set an override). New ETFs in the PDF should classify on first encounter.

- [ ] **Step 10: Mark this task complete**

If all 9 sub-checks pass, this task is done. If any fail, file a bug, fix, and re-run the affected sub-check before marking complete.

---

## Sprint Completion Checklist

After all 12 tasks above are complete:

- [ ] Run the full Jest suite: `npx jest`. Expected: all green.
- [ ] Run TypeScript: `npx tsc --noEmit`. Expected: clean.
- [ ] Run build: `npm run build`. Expected: succeeds.
- [ ] Recommend `/codex:adversarial-review --base <sha-before-task-1>` before marking the sprint ready for merge (per global CLAUDE.md). The slash command has `disable-model-invocation` — only the user can invoke it. Acceptable equivalent: `Agent(subagent_type="codex:codex-rescue", ...)` with explicit adversarial framing.

## Note on Deferred Test Coverage

The spec lists "Component tests — DashboardClient" with four RTL-style tests for the `setFieldWithLock` + lookup + lock-icon interactions. **These are deferred to Task 12 (manual QA)** rather than written as automated tests, because:

- The DashboardClient component is ~1500 lines with no existing RTL test scaffold.
- Task 10 changes one line (`...(field === "market" ? { marketComputedAt: null } : {})`).
- Task 11 changes a conditional `title` attribute.
- Adding component-level RTL infrastructure for a 2-line change is disproportionate.

The pure logic for these interactions IS covered by automated tests:
- `applyLookupRespectingLocks` unit tests (Task 9) cover the lookup → form-merge logic.
- `researchTicker` orchestration tests (Task 5) cover the lock + TTL gate.

The remaining surface (DOM-level event wiring) is verified by Task 12 manual QA on the running dev server. If the manual QA reveals integration bugs that automated tests would have caught, write them as a follow-up before marking the sprint complete.
