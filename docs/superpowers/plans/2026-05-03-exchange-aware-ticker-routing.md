# Exchange-Aware Ticker Routing & Column Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix multi-market ticker collisions (e.g. JEPQ CAD vs JEPQ USD) by adding a per-asset exchange suffix field, exchange-aware Yahoo routing, currency mismatch detection, a hideable Exchange column in the holdings table, column visibility controls, and FX-converted portfolio totals.

**Architecture:** New `exchangeSuffix`/`exchangeName` fields (+ `"exchange"` LockableField) drive Yahoo query construction; PDF parser dedup key becomes `(ticker, currency)`; `researchTicker` consults the stored suffix when locked and emits a `currencyMismatch` flag when Yahoo returns the wrong currency; the UI shows an Exchange column with inline override that auto-locks on confirm; column visibility is persisted to DynamoDB in the household META item; portfolio totals split into CAD/USD subtotals with a grand total in CAD via a `USDCAD=X` Yahoo fetch.

**Tech Stack:** Next.js 15 App Router, TypeScript, yahoo-finance2, DynamoDB (aws-sdk v3), Jest, React 19, Tailwind CSS v4.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/index.ts` | Modify | Add `exchangeSuffix`, `exchangeName`, `needsExchangeReview` to `Asset`; add `"exchange"` to `LockableField` |
| `src/lib/classification/allowlists.ts` | Modify | Add `EXCHANGE_CODE_MAP` and `resolveExchange()` |
| `src/lib/ticker-research.ts` | Modify | Exchange-aware Yahoo routing, mismatch detection, new return fields |
| `src/app/dashboard/lib/applyLookupRespectingLocks.ts` | Modify | Add `exchangeSuffix`/`exchangeName` respecting `"exchange"` lock |
| `src/app/api/ticker-lookup/route.ts` | Modify | Extend `findExistingAssetById` return; accept `exchangeSuffix` query param |
| `src/app/api/portfolio-pdf/parseHoldings.ts` | Modify | Composite dedup key `(ticker, currency)` |
| `src/app/api/portfolio-pdf/route.ts` | Modify | Composite match keys; collision-aware cache; `needsExchangeReview` flag |
| `src/app/api/assets/[id]/route.ts` | Modify | Pass-through `exchangeSuffix`, `exchangeName`; auto-clear `needsExchangeReview` when exchange locked |
| `src/lib/fxRate.ts` | Create | FX rate fetch from Yahoo with 1-hour in-memory cache |
| `src/lib/portfolio-analytics.ts` | Modify | Add `computePortfolioTotals()` splitting assets by currency |
| `src/app/api/profile/route.ts` | Modify | Fetch FX rate in parallel; include `portfolioTotals` + `columnVisibility` in GET response |
| `src/app/api/preferences/columns/route.ts` | Create | `PATCH` route to persist column visibility to META item |
| `src/app/dashboard/HoldingsTab.tsx` | Modify | Exchange column; inline exchange edit + lock; `⚠ Review` badge; column visibility constant + Manage Columns popover |
| `src/app/dashboard/DashboardClient.tsx` | Modify | `handleTickerLookup` mismatch gate; exchange resolution state; `LOCKABLE_FIELD_LABELS` entry; `addNewRow` init; FX totals display |

---

## Task 1: Data Types + Exchange Code Mapping

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/classification/allowlists.ts`
- Test: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Add fields to `Asset` and `LockableField` in `src/types/index.ts`**

In the `LockableField` union (line 1), add `"exchange"`:
```ts
export type LockableField =
    | "sector"
    | "market"
    | "securityType"
    | "strategyType"
    | "call"
    | "managementStyle"
    | "currency"
    | "managementFee"
    | "exchange";
```

In the `Asset` interface, after `marketComputedAt`:
```ts
    exchangeSuffix?: string;
    exchangeName?: string;
    needsExchangeReview?: boolean;
```

- [ ] **Step 2: Add `EXCHANGE_CODE_MAP` and `resolveExchange` to `src/lib/classification/allowlists.ts`**

After the `US_EXCHANGES` and `CA_EXCHANGES` sets (around line 125), add:
```ts
export const EXCHANGE_CODE_MAP: Record<string, { suffix: string; name: string }> = {
  nms:  { suffix: "",    name: "Nasdaq" },
  ngm:  { suffix: "",    name: "Nasdaq" },
  ncm:  { suffix: "",    name: "Nasdaq" },
  nyq:  { suffix: "",    name: "NYSE" },
  ase:  { suffix: "",    name: "NYSE American" },
  pcx:  { suffix: "",    name: "NYSE American" },
  bats: { suffix: "",    name: "CBOE" },
  tor:  { suffix: ".TO", name: "TSX" },
  cve:  { suffix: ".V",  name: "TSX Venture" },
  neo:  { suffix: ".NE", name: "Cboe Canada" },
  van:  { suffix: ".V",  name: "Vancouver" },
};

export function resolveExchange(
  code: string,
  fallbackName: string,
): { exchangeSuffix: string; exchangeName: string } {
  const mapped = EXCHANGE_CODE_MAP[code.toLowerCase()];
  if (mapped) return { exchangeSuffix: mapped.suffix, exchangeName: mapped.name };
  return { exchangeSuffix: "", exchangeName: fallbackName || "Unknown" };
}
```

- [ ] **Step 3: Write failing tests for `resolveExchange`**

In `src/lib/classification/__tests__/allowlists.test.ts`, add a new `describe` block at the end of the file:
```ts
describe("resolveExchange", () => {
  it("maps NYSE code to empty suffix and NYSE name", () => {
    const result = resolveExchange("NYQ", "New York Stock Exchange");
    expect(result).toEqual({ exchangeSuffix: "", exchangeName: "NYSE" });
  });

  it("maps TSX code to .TO suffix", () => {
    const result = resolveExchange("TOR", "Toronto Stock Exchange");
    expect(result).toEqual({ exchangeSuffix: ".TO", exchangeName: "TSX" });
  });

  it("maps NEO (Cboe Canada) code to .NE suffix", () => {
    const result = resolveExchange("NEO", "Cboe Canada");
    expect(result).toEqual({ exchangeSuffix: ".NE", exchangeName: "Cboe Canada" });
  });

  it("falls back to fallbackName and empty suffix for unknown code", () => {
    const result = resolveExchange("XYZ", "Some Exchange");
    expect(result).toEqual({ exchangeSuffix: "", exchangeName: "Some Exchange" });
  });

  it("is case-insensitive for exchange codes", () => {
    const result = resolveExchange("tor", "Toronto");
    expect(result).toEqual({ exchangeSuffix: ".TO", exchangeName: "TSX" });
  });
});
```

- [ ] **Step 4: Run failing tests**

```bash
npx jest --testPathPattern="allowlists" --no-coverage
```
Expected: FAIL — `resolveExchange is not a function` (not yet exported from allowlists)

- [ ] **Step 5: Verify tests pass after Step 2 changes**

```bash
npx jest --testPathPattern="allowlists" --no-coverage
```
Expected: All `resolveExchange` tests PASS. Existing allowlist tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(types): add exchange fields to Asset and resolveExchange mapping"
```

---

## Task 2: PDF Parser Composite Dedup Key

**Files:**
- Modify: `src/app/api/portfolio-pdf/parseHoldings.ts`
- Test: `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`

- [ ] **Step 1: Write failing tests for collision ticker survival**

In `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`, add:
```ts
describe("collision ticker handling", () => {
  it("keeps both JEPQ rows when one is CAD and one is USD", () => {
    const text = `
Canadian Equities and Alternatives
JEPQ 6205.6905 6205.6905 0.0000 $164823.13 $168562.69 CAD

US Equities and Alternatives
JEPQ 92.7690 7.7690 85.0000 $5150.53 $5309.07 USD
`.trim();

    const holdings = parseHoldings(text);
    const cadJepq = holdings.find(h => h.ticker === "JEPQ" && h.currency === "CAD");
    const usdJepq = holdings.find(h => h.ticker === "JEPQ" && h.currency === "USD");

    expect(cadJepq).toBeDefined();
    expect(usdJepq).toBeDefined();
    expect(holdings.filter(h => h.ticker === "JEPQ")).toHaveLength(2);
  });

  it("still deduplicates same ticker with same currency appearing twice", () => {
    const text = `
Canadian Equities and Alternatives
JEPQ 6205.6905 6205.6905 0.0000 $164823.13 $168562.69 CAD
JEPQ 100.0000 100.0000 0.0000 $2656.00 $2700.00 CAD
`.trim();

    const holdings = parseHoldings(text);
    expect(holdings.filter(h => h.ticker === "JEPQ")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="parseHoldings" --no-coverage
```
Expected: FAIL — both JEPQ rows not found (second is dropped).

- [ ] **Step 3: Fix dedup guard in `parseHoldings.ts`**

Both dedup guards (the `holdingPattern` match around line 137 and the `wsQtyPattern` match around line 172) use ticker-only. Change both to composite `(ticker, currency)`.

For the `holdingPattern` match block:
```ts
// Before:
if (!holdings.some(h => h.ticker === ticker)) {
// After:
const currency = detectInlineCurrency(line) ?? sectionCurrency ?? documentDefault;
if (!holdings.some(h => h.ticker === ticker && h.currency === currency)) {
```

For the `wsQtyPattern` match block (the currency variable is already computed in the push call; extract it before the guard):
```ts
// Before (inside wsQtyPattern block):
if (!holdings.some(h => h.ticker === ticker)) {
    holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency: detectInlineCurrency(line) ?? sectionCurrency ?? documentDefault });
}
// After:
const rowCurrency = detectInlineCurrency(line) ?? sectionCurrency ?? documentDefault;
if (!holdings.some(h => h.ticker === ticker && h.currency === rowCurrency)) {
    holdings.push({ ticker, quantity, bookCost, marketValue, accountNumber, accountType, currency: rowCurrency });
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="parseHoldings" --no-coverage
```
Expected: All tests PASS including new collision tests.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio-pdf/parseHoldings.ts src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts
git commit -m "fix(pdf-parser): dedup by (ticker, currency) to preserve cross-market collisions"
```

---

## Task 3: `researchTicker` Exchange Routing + Mismatch Detection

**Files:**
- Modify: `src/lib/ticker-research.ts`
- Test: `src/lib/__tests__/ticker-research.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/__tests__/ticker-research.test.ts`, add a new `describe` block. The file already mocks `yahoo-finance2` — follow the existing mock pattern. Add after existing tests:

```ts
describe("exchange routing", () => {
  it("uses stored exchangeSuffix when exchange is locked", async () => {
    const mockQuote = jest.fn().mockResolvedValue({
      regularMarketPrice: 26.56,
      currency: "CAD",
      exchange: "NEO",
      fullExchangeName: "Cboe Canada",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ Active ETF",
    });
    // Mock the yahoo-finance2 module quote method for this test
    const yf = require("yahoo-finance2");
    yf.default.prototype.quote = mockQuote;

    const result = await researchTicker("JEPQ", {
      userOverrides: { exchange: true },
      exchangeSuffix: ".NE",
      currency: "CAD",
      market: "Canada",
      marketComputedAt: null,
    });

    // Should have called Yahoo with JEPQ.NE
    expect(mockQuote).toHaveBeenCalledWith("JEPQ.NE");
    expect(result?.exchangeSuffix).toBe(".NE");
    expect(result?.exchangeName).toBe("Cboe Canada");
    expect(result?.currencyMismatch).toBeUndefined();
  });

  it("sets currencyMismatch when Yahoo returns different currency than stored", async () => {
    const mockQuote = jest.fn().mockResolvedValue({
      regularMarketPrice: 55.52,
      currency: "USD",
      exchange: "NMS",
      fullExchangeName: "Nasdaq",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ ETF",
    });
    const yf = require("yahoo-finance2");
    yf.default.prototype.quote = mockQuote;

    const result = await researchTicker("JEPQ", {
      userOverrides: {},
      exchangeSuffix: "",
      currency: "CAD",
      market: "Not Found",
      marketComputedAt: null,
    });

    expect(result?.currencyMismatch).toBe(true);
    expect(result?.detectedCurrency).toBe("USD");
    expect(result?.exchangeSuffix).toBe("");
    expect(result?.exchangeName).toBe("Nasdaq");
  });

  it("does not set currencyMismatch when currencies match", async () => {
    const mockQuote = jest.fn().mockResolvedValue({
      regularMarketPrice: 55.52,
      currency: "USD",
      exchange: "NMS",
      fullExchangeName: "Nasdaq",
      quoteType: "ETF",
      shortName: "JPMorgan NASDAQ ETF",
    });
    const yf = require("yahoo-finance2");
    yf.default.prototype.quote = mockQuote;

    const result = await researchTicker("JEPQ", {
      userOverrides: {},
      exchangeSuffix: "",
      currency: "USD",
      market: "USA",
      marketComputedAt: null,
    });

    expect(result?.currencyMismatch).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="ticker-research" --no-coverage
```
Expected: FAIL — `currencyMismatch` and `exchangeSuffix` not on result.

- [ ] **Step 3: Update `researchTicker` signature and add `TickerMetadata` fields in `src/lib/ticker-research.ts`**

Update the `existingAsset` pick type on line ~116:
```ts
export async function researchTicker(
  symbol: string,
  existingAsset?: Pick<Asset,
    "userOverrides" | "marketComputedAt" | "market" | "exchangeSuffix" | "currency"
  > | null,
): Promise<Partial<TickerMetadata> | null>
```

Add to `TickerMetadata` interface (after `currency: string`):
```ts
  exchangeSuffix: string;
  exchangeName: string;
  currencyMismatch?: boolean;
  detectedCurrency?: string;
```

- [ ] **Step 4: Implement exchange routing inside `researchTicker`**

Replace the existing `let quote; try { quote = await yahooFinance.quote(ticker); } catch ...` block with:

```ts
let ticker = symbol.toUpperCase();
const exchangeLocked = existingAsset?.userOverrides?.exchange === true;
const storedSuffix = existingAsset?.exchangeSuffix ?? "";

let quote;
if (exchangeLocked && storedSuffix !== undefined) {
  // Use stored suffix — skip auto-detection entirely
  ticker = `${symbol.toUpperCase()}${storedSuffix}`;
  quote = await yahooFinance.quote(ticker);
} else {
  // Default path: bare query with .TO fallback on exception
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
}
```

- [ ] **Step 5: Resolve exchange fields and detect mismatch**

After the `quote` is obtained (before the `quoteSummary` call), add:

```ts
import { resolveExchange } from "./classification/allowlists";

// Resolve exchange fields
const { exchangeSuffix, exchangeName } = exchangeLocked
  ? { exchangeSuffix: storedSuffix, exchangeName: existingAsset?.exchangeName ?? "" }
  : resolveExchange(
      (quote as any).exchange ?? "",
      (quote as any).fullExchangeName ?? "",
    );

// Mismatch detection: only when exchange is not locked
const storedCurrency = existingAsset?.currency;
const currencyMismatch =
  !exchangeLocked &&
  storedCurrency != null &&
  storedCurrency !== "Not Found" &&
  quote.currency !== storedCurrency;
```

Then in the returned `result` object, add alongside the existing fields:
```ts
  exchangeSuffix,
  exchangeName,
  ...(currencyMismatch ? { currencyMismatch: true as const, detectedCurrency: quote.currency } : {}),
```

- [ ] **Step 6: Run tests**

```bash
npx jest --testPathPattern="ticker-research" --no-coverage
```
Expected: All tests PASS including new exchange routing tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/ticker-research.ts src/lib/__tests__/ticker-research.test.ts
git commit -m "feat(ticker-research): exchange-aware Yahoo routing and currency mismatch detection"
```

---

## Task 4: `applyLookupRespectingLocks` Exchange Fields

**Files:**
- Modify: `src/app/dashboard/lib/applyLookupRespectingLocks.ts`
- Test: `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`, add:
```ts
describe("exchange field locking", () => {
  it("preserves exchangeSuffix and exchangeName when exchange is locked", () => {
    const prev: Partial<Asset> = {
      exchangeSuffix: ".NE",
      exchangeName: "Cboe Canada",
      userOverrides: { exchange: true },
    };
    const data = { exchangeSuffix: ".TO", exchangeName: "TSX" };
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".NE");
    expect(result.exchangeName).toBe("Cboe Canada");
  });

  it("overwrites exchangeSuffix and exchangeName when exchange is not locked", () => {
    const prev: Partial<Asset> = {
      exchangeSuffix: "",
      exchangeName: "Nasdaq",
      userOverrides: {},
    };
    const data = { exchangeSuffix: ".NE", exchangeName: "Cboe Canada" };
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".NE");
    expect(result.exchangeName).toBe("Cboe Canada");
  });

  it("falls back to prev values when data fields are absent", () => {
    const prev: Partial<Asset> = { exchangeSuffix: ".TO", exchangeName: "TSX", userOverrides: {} };
    const data = {};
    const result = applyLookupRespectingLocks(prev, data);
    expect(result.exchangeSuffix).toBe(".TO");
    expect(result.exchangeName).toBe("TSX");
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="applyLookupRespectingLocks" --no-coverage
```
Expected: FAIL — `exchangeSuffix` and `exchangeName` not returned.

- [ ] **Step 3: Add fields to `LookupData` and update return in `applyLookupRespectingLocks.ts`**

In the `LookupData` type, add:
```ts
  exchangeSuffix?: string;
  exchangeName?: string;
```

In the returned object from `applyLookupRespectingLocks`, add after the `marketComputedAt` line:
```ts
    exchangeSuffix: isLocked("exchange") ? prev.exchangeSuffix : (data.exchangeSuffix ?? prev.exchangeSuffix ?? ""),
    exchangeName:   isLocked("exchange") ? prev.exchangeName   : (data.exchangeName   ?? prev.exchangeName   ?? ""),
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="applyLookupRespectingLocks" --no-coverage
```
Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/lib/applyLookupRespectingLocks.ts src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts
git commit -m "feat(lookup): add exchangeSuffix/exchangeName respecting exchange lock"
```

---

## Task 5: `findExistingAssetById` Extension + Ticker-Lookup Route Wiring

**Files:**
- Modify: `src/app/api/ticker-lookup/route.ts`
- Test: `src/app/api/ticker-lookup/__tests__/findExistingAssetById.test.ts`

- [ ] **Step 1: Write failing test for the extended return type**

In `src/app/api/ticker-lookup/__tests__/findExistingAssetById.test.ts`, add:
```ts
it("returns exchangeSuffix and currency from stored asset", async () => {
  // Mock the DynamoDB GetCommand to return an item with exchangeSuffix
  jest.mocked(db.send).mockResolvedValueOnce({
    Item: {
      ticker: "JEPQ",
      market: "Canada",
      exchangeSuffix: ".NE",
      currency: "CAD",
      marketComputedAt: null,
      userOverrides: { exchange: true },
    },
  } as any);

  const result = await findExistingAssetById("household1", "asset1", "JEPQ");
  expect(result?.exchangeSuffix).toBe(".NE");
  expect(result?.currency).toBe("CAD");
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="findExistingAssetById" --no-coverage
```
Expected: FAIL — `exchangeSuffix` and `currency` not in returned object.

- [ ] **Step 3: Update `findExistingAssetById` in `src/app/api/ticker-lookup/route.ts`**

Change the return type on line ~13:
```ts
): Promise<Pick<Asset, "userOverrides" | "marketComputedAt" | "market" | "exchangeSuffix" | "currency"> | null>
```

Add to the returned object (after `market:`):
```ts
    exchangeSuffix: typeof Item.exchangeSuffix === "string" ? Item.exchangeSuffix : "",
    currency: typeof Item.currency === "string" ? Item.currency : "",
```

- [ ] **Step 4: Add `exchangeSuffix` query param wiring in the `GET` handler**

In the `GET` function, after the `const assetId = ...` line, add:
```ts
const exchangeSuffixParam = request.nextUrl.searchParams.get('exchangeSuffix');
```

Replace the `const existing = ...` and `const data = ...` lines with:
```ts
const existing = assetId
  ? await findExistingAssetById(session.user.householdId, assetId, symbol)
  : null;

const assetForLookup = exchangeSuffixParam !== null
  ? {
      ...existing,
      exchangeSuffix: exchangeSuffixParam,
      userOverrides: { ...(existing?.userOverrides ?? {}), exchange: true as const },
    }
  : existing;

const data = await researchTicker(symbol, assetForLookup);
```

- [ ] **Step 5: Run tests**

```bash
npx jest --testPathPattern="findExistingAssetById" --no-coverage
```
Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/ticker-lookup/route.ts src/app/api/ticker-lookup/__tests__/findExistingAssetById.test.ts
git commit -m "feat(ticker-lookup): extend asset fetch + wire exchangeSuffix override param"
```

---

## Task 6: PDF Import Route — Composite Keys, Collision Cache, Mismatch Flag

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`
- Test: `src/app/api/portfolio-pdf/__tests__/shouldEnrichHolding.test.ts`

- [ ] **Step 1: Add collision ticker detection before the enrichment loop**

After `const tickerCache = new Map<string, any>();` (around line 176), add:
```ts
// Detect tickers that appear more than once in the parsed holdings (collision tickers).
// Cache is bypassed for these to prevent cross-currency contamination.
const tickerCount = new Map<string, number>();
holdings.forEach(h => tickerCount.set(h.ticker, (tickerCount.get(h.ticker) ?? 0) + 1));
const collisionTickers = new Set(
  [...tickerCount.entries()].filter(([, c]) => c > 1).map(([t]) => t)
);
```

- [ ] **Step 2: Update the cache guard inside the enrichment loop**

Replace (around line 211):
```ts
if (existing == null && tickerCache.has(h.ticker)) {
    enrichedData = tickerCache.get(h.ticker);
} else {
    try {
        enrichedData = await researchTicker(h.ticker, existing);
        if (existing == null) {
            tickerCache.set(h.ticker, enrichedData);
        }
    } catch (e) {
        console.warn(`[portfolio-pdf] AI Enrichment failed for ${h.ticker}:`, e);
    }
}
```
With:
```ts
const canCache = existing == null && !collisionTickers.has(h.ticker);
if (canCache && tickerCache.has(h.ticker)) {
    enrichedData = tickerCache.get(h.ticker);
} else {
    try {
        enrichedData = await researchTicker(h.ticker, existing);
        if (canCache) {
            tickerCache.set(h.ticker, enrichedData);
        }
    } catch (e) {
        console.warn(`[portfolio-pdf] AI Enrichment failed for ${h.ticker}:`, e);
    }
}
```

- [ ] **Step 3: Fix candidate filter (line ~181) to use composite key**

```ts
// Before:
const allMatches = existingAssets.filter((a: any) => a.ticker === h.ticker);
// After:
const allMatches = existingAssets.filter((a: any) =>
    a.ticker === h.ticker &&
    (a.currency === h.currency || !a.currency || a.currency === "Not Found")
);
```

- [ ] **Step 4: Fix sync-pass ticker check (line ~403) to use composite key**

```ts
// Before:
const stillHoldsIt = holdings.some(h => h.ticker === asset.ticker);
// After:
const stillHoldsIt = holdings.some(h => {
    if (h.ticker !== asset.ticker) return false;
    if (!asset.currency || asset.currency === "Not Found") return true;
    return h.currency === asset.currency;
});
```

- [ ] **Step 5: Add `needsExchangeReview` and new exchange fields to `baseItem`**

In the `baseItem` object, after `marketComputedAt:`, add:
```ts
exchangeSuffix: pickWithLock(existing, "exchange" as any, existing?.exchangeSuffix, enrichedData?.exchangeSuffix ?? existing?.exchangeSuffix ?? "") ?? "",
exchangeName:   pickWithLock(existing, "exchange" as any, existing?.exchangeName,   enrichedData?.exchangeName   ?? existing?.exchangeName   ?? "") ?? "",
needsExchangeReview: enrichedData?.currencyMismatch === true
    ? true
    : (existing?.needsExchangeReview ?? undefined),
```

Note: `pickWithLock` uses `"exchange"` as the lock field key — both `exchangeSuffix` and `exchangeName` are locked together via `userOverrides.exchange`.

- [ ] **Step 6: Run existing PDF route tests**

```bash
npx jest --testPathPattern="shouldEnrichHolding|portfolio-pdf" --no-coverage
```
Expected: All existing tests still PASS.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts
git commit -m "fix(pdf-import): composite match keys, collision cache, needsExchangeReview flag"
```

---

## Task 7: `PUT /api/assets/[id]` — Exchange Fields + Auto-Clear `needsExchangeReview`

**Files:**
- Modify: `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: Add `exchangeSuffix`, `exchangeName`, `needsExchangeReview` to the `merged` object**

In the `merged` object inside the `PUT` handler (after `marketComputedAt:`), add:
```ts
exchangeSuffix: data.exchangeSuffix !== undefined ? String(data.exchangeSuffix) : (existingAsset.exchangeSuffix ?? ""),
exchangeName:   data.exchangeName   !== undefined ? String(data.exchangeName)   : (existingAsset.exchangeName   ?? ""),
// Auto-clear needsExchangeReview when the exchange field is being locked
needsExchangeReview: (data.userOverrides?.exchange === true)
    ? false
    : (data.needsExchangeReview !== undefined ? data.needsExchangeReview : existingAsset.needsExchangeReview),
```

- [ ] **Step 2: Smoke-test manually**

Start the dev server (`npm run dev`) and use the browser DevTools to `PUT /api/assets/<id>` with `{ exchangeSuffix: ".NE", exchangeName: "Cboe Canada", userOverrides: { exchange: true } }`. Verify the response asset has `needsExchangeReview: false`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assets/[id]/route.ts
git commit -m "feat(assets-put): pass through exchange fields, auto-clear needsExchangeReview on lock"
```

---

## Task 8: FX Rate Utility

**Files:**
- Create: `src/lib/fxRate.ts`
- Create: `src/lib/__tests__/fxRate.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/__tests__/fxRate.test.ts`:
```ts
import { fetchFxRate } from "../fxRate";

jest.mock("yahoo-finance2", () => ({
  default: jest.fn().mockImplementation(() => ({
    quote: jest.fn(),
  })),
}));

function getYfMock() {
  const YF = require("yahoo-finance2").default;
  return new YF();
}

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
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="fxRate" --no-coverage
```
Expected: FAIL — module not found.

- [ ] **Step 3: Create `src/lib/fxRate.ts`**

```ts
import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance();

interface CachedRate {
  rate: number;
  fetchedAt: number;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const rateCache = new Map<string, CachedRate>();

export async function fetchFxRate(from: string, to: string): Promise<number> {
  const key = `${from}${to}`;
  const cached = rateCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.rate;
  }

  const symbol = `${from}${to}=X`;
  const quote = await yahooFinance.quote(symbol);
  const rate = (quote as any).regularMarketPrice;
  if (!rate || typeof rate !== "number") {
    throw new Error(`Failed to get FX rate for ${symbol}: no price returned`);
  }

  rateCache.set(key, { rate, fetchedAt: Date.now() });
  return rate;
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="fxRate" --no-coverage
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fxRate.ts src/lib/__tests__/fxRate.test.ts
git commit -m "feat(fx): add FX rate utility with 1-hour in-memory cache"
```

---

## Task 9: Portfolio Analytics — `computePortfolioTotals`

**Files:**
- Modify: `src/lib/portfolio-analytics.ts`
- Test: `src/lib/__tests__/portfolio-analytics.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/__tests__/portfolio-analytics.test.ts`, add:
```ts
import { computePortfolioTotals } from "../portfolio-analytics";
import type { Asset } from "@/types";

function makeAsset(overrides: Partial<Asset>): Asset {
  return {
    PK: "HOUSEHOLD#h1", SK: "ASSET#a1", id: "a1", profileId: "HOUSEHOLD#h1",
    type: "ASSET", account: "", ticker: "X", securityType: "ETF",
    strategyType: "Growth", call: "No", sector: "IT", market: "USA",
    currency: "USD", managementStyle: "Passive", externalRating: "",
    managementFee: null, quantity: 1, liveTickerPrice: 100,
    bookCost: 90, marketValue: 100, profitLoss: 10, yield: null,
    oneYearReturn: null, fiveYearReturn: null, threeYearReturn: null,
    exDividendDate: "", analystConsensus: "", beta: 1, riskFlag: "Normal",
    accountNumber: "", accountType: "", risk: "", volatility: 0,
    expectedAnnualDividends: 0, updatedAt: "",
    ...overrides,
  };
}

describe("computePortfolioTotals", () => {
  it("splits assets by currency and converts USD to CAD for grand total", () => {
    const assets = [
      makeAsset({ id: "a1", currency: "CAD", marketValue: 100_000 }),
      makeAsset({ id: "a2", currency: "USD", marketValue: 10_000 }),
    ];
    const result = computePortfolioTotals(assets, 1.36);
    expect(result.cadTotal).toBe(100_000);
    expect(result.usdTotal).toBe(10_000);
    expect(result.grandTotalCad).toBeCloseTo(113_600);
    expect(result.fxUnavailable).toBe(false);
  });

  it("sets fxUnavailable and grandTotalCad equals cadTotal when rate is null", () => {
    const assets = [
      makeAsset({ id: "a1", currency: "CAD", marketValue: 50_000 }),
      makeAsset({ id: "a2", currency: "USD", marketValue: 5_000 }),
    ];
    const result = computePortfolioTotals(assets, null);
    expect(result.fxUnavailable).toBe(true);
    expect(result.grandTotalCad).toBe(50_000);
  });

  it("handles all-CAD portfolio", () => {
    const assets = [makeAsset({ id: "a1", currency: "CAD", marketValue: 75_000 })];
    const result = computePortfolioTotals(assets, 1.36);
    expect(result.cadTotal).toBe(75_000);
    expect(result.usdTotal).toBe(0);
    expect(result.grandTotalCad).toBe(75_000);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx jest --testPathPattern="portfolio-analytics" --no-coverage
```
Expected: FAIL — `computePortfolioTotals` not exported.

- [ ] **Step 3: Add `computePortfolioTotals` to `src/lib/portfolio-analytics.ts`**

At the end of the file, add:
```ts
export interface PortfolioTotals {
  cadTotal: number;
  usdTotal: number;
  grandTotalCad: number;
  usdToCadRate: number | null;
  fxUnavailable: boolean;
}

export function computePortfolioTotals(
  assets: Asset[],
  usdToCadRate: number | null,
): PortfolioTotals {
  let cadTotal = 0;
  let usdTotal = 0;

  for (const asset of assets) {
    const mv = asset.marketValue || 0;
    if (asset.currency === "CAD") {
      cadTotal += mv;
    } else if (asset.currency === "USD") {
      usdTotal += mv;
    } else {
      // Unknown currency: bucket into CAD at 1:1 and log
      console.warn(`[portfolio-totals] Unknown currency "${asset.currency}" for asset ${asset.id} — bucketing as CAD`);
      cadTotal += mv;
    }
  }

  const fxUnavailable = usdToCadRate === null;
  const grandTotalCad = fxUnavailable
    ? cadTotal
    : cadTotal + usdTotal * usdToCadRate!;

  return { cadTotal, usdTotal, grandTotalCad, usdToCadRate, fxUnavailable };
}
```

- [ ] **Step 4: Run tests**

```bash
npx jest --testPathPattern="portfolio-analytics" --no-coverage
```
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/portfolio-analytics.ts src/lib/__tests__/portfolio-analytics.test.ts
git commit -m "feat(analytics): add computePortfolioTotals with CAD/USD currency split"
```

---

## Task 10: Profile API — FX Totals + Column Visibility in GET Response

**Files:**
- Modify: `src/app/api/profile/route.ts`

- [ ] **Step 1: Import `fetchFxRate` and `computePortfolioTotals` in `src/app/api/profile/route.ts`**

At the top, add:
```ts
import { fetchFxRate } from "@/lib/fxRate";
import { computePortfolioTotals } from "@/lib/portfolio-analytics";
import type { Asset } from "@/types";
```

- [ ] **Step 2: Fetch FX rate in parallel with assets in the `GET` handler**

Replace the current asset query and response construction (lines ~31–43):
```ts
// Fetch assets and FX rate in parallel
const [assetsResult, fxRate] = await Promise.all([
    db.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": PROFILE_KEY,
            ":skPrefix": "ASSET#",
        },
    })),
    fetchFxRate("USD", "CAD").catch(() => null),   // null = unavailable
]);

const assets = (assetsResult.Items || []) as Asset[];
const portfolioTotals = computePortfolioTotals(assets, fxRate);

const responseData = profile
    ? {
        ...profile,
        assets,
        portfolioTotals,
        columnVisibility: profile.columnVisibility ?? {},
      }
    : {};
return NextResponse.json(responseData);
```

- [ ] **Step 3: Smoke-test**

Run `npm run dev` and call `GET /api/profile` in the browser (or curl). Verify the response includes `portfolioTotals: { cadTotal, usdTotal, grandTotalCad, fxUnavailable }` and `columnVisibility: {}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/profile/route.ts
git commit -m "feat(profile-api): include portfolioTotals and columnVisibility in GET response"
```

---

## Task 11: Preferences Columns API Route

**Files:**
- Create: `src/app/api/preferences/columns/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/preferences/columns/route.ts`:
```ts
import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;
        const body = await request.json();
        const { columnVisibility } = body;

        if (!columnVisibility || typeof columnVisibility !== "object" || Array.isArray(columnVisibility)) {
            return NextResponse.json({ error: "columnVisibility must be an object" }, { status: 400 });
        }

        // Validate: all values must be boolean
        for (const [key, val] of Object.entries(columnVisibility)) {
            if (typeof val !== "boolean") {
                return NextResponse.json({ error: `columnVisibility["${key}"] must be a boolean` }, { status: 400 });
            }
        }

        const { Item: meta } = await db.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: PROFILE_KEY, SK: "META" },
        }));

        if (!meta) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        await db.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                ...meta,
                columnVisibility: { ...(meta.columnVisibility ?? {}), ...columnVisibility },
                updatedAt: new Date().toISOString(),
            },
        }));

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Failed to update column visibility:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Smoke-test the route**

`npm run dev`, then:
```bash
curl -X PATCH http://localhost:3000/api/preferences/columns \
  -H "Content-Type: application/json" \
  -d '{"columnVisibility":{"call":false,"beta":false}}'
```
Expected: `{"ok":true}` (if authenticated) or 401 (if not).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/preferences/columns/route.ts
git commit -m "feat(api): PATCH /api/preferences/columns persists column visibility to DynamoDB"
```

---

## Task 12: Holdings Table — Exchange Column + Inline Edit + Mismatch Badge + Column Visibility Constant

**Files:**
- Modify: `src/app/dashboard/HoldingsTab.tsx`

- [ ] **Step 1: Add `DEFAULT_COLUMN_VISIBILITY` constant at the top of `HoldingsTab.tsx`**

After imports, before the component function, add:
```ts
export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  account: true,
  ticker: true,
  securityType: true,
  strategyType: true,
  call: false,
  sector: true,
  market: true,
  currency: true,
  exchange: true,
  managementStyle: false,
  managementFee: true,
  quantity: true,
  liveTickerPrice: true,
  bookCost: true,
  marketValue: true,
  weightPct: true,
  profitLoss: true,
  yield: true,
  oneYearReturn: true,
  threeYearReturn: false,
  exDividendDate: false,
  analystConsensus: false,
  externalRating: false,
  beta: false,
  riskFlag: false,
  volatility: false,
  expectedAnnualDividends: true,
  accountNumber: false,
  accountType: false,
};

const KNOWN_EXCHANGES = [
  { label: "Nasdaq",        suffix: "",    name: "Nasdaq" },
  { label: "NYSE",          suffix: "",    name: "NYSE" },
  { label: "NYSE American", suffix: "",    name: "NYSE American" },
  { label: "TSX",           suffix: ".TO", name: "TSX" },
  { label: "TSX Venture",   suffix: ".V",  name: "TSX Venture" },
  { label: "Cboe Canada",   suffix: ".NE", name: "Cboe Canada" },
  { label: "Other",         suffix: null,  name: "Other" },
] as const;
```

- [ ] **Step 2: Add `columnVisibility` prop to `HoldingsTab`**

Find the `HoldingsTab` props interface (or type). Add:
```ts
columnVisibility: Record<string, boolean>;
onColumnVisibilityChange: (key: string, visible: boolean) => void;
```

- [ ] **Step 3: Add a helper to determine if a column is visible**

Inside the component, add:
```ts
const isVisible = (key: string): boolean =>
  columnVisibility[key] !== undefined
    ? columnVisibility[key]
    : (DEFAULT_COLUMN_VISIBILITY[key] ?? true);
```

- [ ] **Step 4: Add the Exchange column header**

In the table `<thead>`, after the Currency column header, add:
```tsx
{isVisible("exchange") && (
  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap">
    Exchange
  </th>
)}
```

- [ ] **Step 5: Add the Exchange column cell for each asset row**

After the Currency cell in the row render, add:
```tsx
{isVisible("exchange") && (
  <td className="px-3 py-2 whitespace-nowrap text-sm">
    <ExchangeCell asset={asset} onSave={onExchangeSave} />
  </td>
)}
```

- [ ] **Step 6: Implement `ExchangeCell` component inside `HoldingsTab.tsx`**

Add before the `HoldingsTab` function:
```tsx
function ExchangeCell({
  asset,
  onSave,
}: {
  asset: Asset;
  onSave: (assetId: string, suffix: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedSuffix, setSelectedSuffix] = useState(asset.exchangeSuffix ?? "");
  const [customSuffix, setCustomSuffix] = useState("");
  const [selectedName, setSelectedName] = useState(asset.exchangeName ?? "");
  const isLocked = asset.userOverrides?.exchange === true;
  const needsReview = asset.needsExchangeReview === true;

  if (needsReview && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium"
        title="Currency mismatch detected — click to set exchange"
      >
        ⚠ Review
      </button>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1">
        {isLocked && <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />}
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-neutral-700 dark:text-neutral-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          {asset.exchangeName || "—"}
        </button>
      </div>
    );
  }

  const handleConfirm = () => {
    const isOther = selectedName === "Other";
    const finalSuffix = isOther ? customSuffix : selectedSuffix;
    const finalName = isOther ? `Custom (${customSuffix})` : selectedName;
    onSave(asset.id, finalSuffix, finalName);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={selectedName}
        onChange={e => {
          const opt = KNOWN_EXCHANGES.find(x => x.name === e.target.value);
          setSelectedName(e.target.value);
          setSelectedSuffix(opt?.suffix ?? "");
        }}
        className="text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-900"
      >
        {KNOWN_EXCHANGES.map(ex => (
          <option key={ex.label} value={ex.name}>{ex.label}</option>
        ))}
      </select>
      {selectedName === "Other" && (
        <input
          type="text"
          placeholder=".XX"
          value={customSuffix}
          onChange={e => setCustomSuffix(e.target.value)}
          className="text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 w-16 bg-white dark:bg-neutral-900"
        />
      )}
      <div className="flex gap-1">
        <button onClick={handleConfirm} className="text-xs text-teal-600 dark:text-teal-400 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Add `onExchangeSave` prop to `HoldingsTab`**

Add `onExchangeSave: (assetId: string, suffix: string, name: string) => void` to the props interface.

- [ ] **Step 8: Commit**

```bash
git add src/app/dashboard/HoldingsTab.tsx
git commit -m "feat(holdings-table): Exchange column with inline edit, lock icon, and mismatch badge"
```

---

## Task 13: Holdings Table — Column Visibility "Manage Columns" Popover

**Files:**
- Modify: `src/app/dashboard/HoldingsTab.tsx`

- [ ] **Step 1: Add "Manage Columns" button in the table toolbar area**

Find where the table header toolbar is rendered in `HoldingsTab.tsx` (sort/filter controls area). Add a "Manage Columns" button at the end of that row:
```tsx
const [showColumnManager, setShowColumnManager] = useState(false);

// In JSX, in the toolbar area:
<div className="relative">
  <button
    onClick={() => setShowColumnManager(v => !v)}
    className="flex items-center gap-1 text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 border border-neutral-200 dark:border-neutral-700 rounded px-2 py-1 transition-colors"
    title="Show/hide columns"
  >
    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
    Columns
  </button>
  {showColumnManager && (
    <ColumnManagerPopover
      columnVisibility={columnVisibility}
      onToggle={(key, visible) => {
        onColumnVisibilityChange(key, visible);
      }}
      onClose={() => setShowColumnManager(false)}
    />
  )}
</div>
```

- [ ] **Step 2: Implement `ColumnManagerPopover`**

Add before `HoldingsTab`:
```tsx
const COLUMN_LABELS: Record<string, string> = {
  account: "Account", ticker: "Ticker", securityType: "Type",
  strategyType: "Strategy", call: "Call", sector: "Sector",
  market: "Market", currency: "Currency", exchange: "Exchange",
  managementStyle: "Mgmt Style", managementFee: "Mgmt Fee",
  quantity: "Qty", liveTickerPrice: "Live Price", bookCost: "Book Cost",
  marketValue: "Market Value", weightPct: "Weight %", profitLoss: "P/L",
  yield: "Yield %", oneYearReturn: "1YR Return", threeYearReturn: "3YR Return",
  exDividendDate: "Ex-Div Date", analystConsensus: "Analyst",
  externalRating: "Ext. Rating", beta: "Beta", riskFlag: "Risk Flag",
  volatility: "Volatility", expectedAnnualDividends: "Exp. Dividends",
  accountNumber: "Acct #", accountType: "Acct Type",
};

function ColumnManagerPopover({
  columnVisibility,
  onToggle,
  onClose,
}: {
  columnVisibility: Record<string, boolean>;
  onToggle: (key: string, visible: boolean) => void;
  onClose: () => void;
}) {
  const isVisible = (key: string) =>
    columnVisibility[key] !== undefined
      ? columnVisibility[key]
      : (DEFAULT_COLUMN_VISIBILITY[key] ?? true);

  return (
    <div className="absolute right-0 top-8 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 w-64 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Manage Columns</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">✕</button>
      </div>
      <div className="space-y-2">
        {Object.keys(COLUMN_LABELS).map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible(key)}
              onChange={e => onToggle(key, e.target.checked)}
              className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{COLUMN_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/HoldingsTab.tsx
git commit -m "feat(holdings-table): Manage Columns popover for show/hide any column"
```

---

## Task 14: `DashboardClient` — Mismatch Resolution, Column Visibility, FX Totals Display

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add `"exchange"` to `LOCKABLE_FIELD_LABELS` (line ~29)**

```ts
const LOCKABLE_FIELD_LABELS: Record<LockableField, string> = {
  sector: "Sector",
  market: "Market",
  securityType: "Type",
  strategyType: "Strategy",
  call: "Call",
  managementStyle: "Mgmt Style",
  currency: "Currency",
  managementFee: "Mgmt Fee",
  exchange: "Exchange",   // ← add this
};
```

- [ ] **Step 2: Add exchange fields to `addNewRow` initialiser (line ~400)**

Inside `addNewRow`, add to `editForm`:
```ts
exchangeSuffix: "",
exchangeName: "",
```

- [ ] **Step 3: Add column visibility state + persistence**

Add state declarations after existing state:
```ts
const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
const [portfolioTotals, setPortfolioTotals] = useState<{
  cadTotal: number; usdTotal: number; grandTotalCad: number;
  usdToCadRate: number | null; fxUnavailable: boolean;
} | null>(null);
```

In `fetchAssets`, after `setAssets(fresh)`, add:
```ts
if (data.portfolioTotals) setPortfolioTotals(data.portfolioTotals);
if (data.columnVisibility) setColumnVisibility(data.columnVisibility);
```

Add a handler for column visibility changes:
```ts
const handleColumnVisibilityChange = async (key: string, visible: boolean) => {
  const patch = { [key]: visible };
  setColumnVisibility(prev => ({ ...prev, ...patch }));
  try {
    await fetch("/api/preferences/columns", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ columnVisibility: patch }),
    });
  } catch {
    // Revert on failure
    setColumnVisibility(prev => ({ ...prev, [key]: !visible }));
  }
};
```

- [ ] **Step 4: Add `onExchangeSave` handler**

```ts
const handleExchangeSave = async (assetId: string, suffix: string, name: string) => {
  try {
    const asset = assets.find(a => a.id === assetId);
    if (!asset) return;
    const res = await fetch(`/api/assets/${assetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...asset,
        exchangeSuffix: suffix,
        exchangeName: name,
        userOverrides: { ...asset.userOverrides, exchange: true },
      }),
    });
    if (!res.ok) throw new Error("Failed to save exchange");
    fetchAssets();
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to save exchange";
    setMessage({ text: msg, type: "error" });
  }
};
```

- [ ] **Step 5: Add mismatch gate to `handleTickerLookup`**

Replace the current `handleTickerLookup` (lines ~492–522) with:
```ts
const [mismatchState, setMismatchState] = useState<{
  symbol: string; detectedCurrency: string; storedCurrency: string;
} | null>(null);

const handleTickerLookup = async (symbol: string, exchangeSuffixOverride?: string) => {
  if (!symbol.trim()) return;
  try {
    const assetIdParam = editingId && editingId !== "NEW" ? `&assetId=${encodeURIComponent(editingId)}` : "";
    const suffixParam = exchangeSuffixOverride != null ? `&exchangeSuffix=${encodeURIComponent(exchangeSuffixOverride)}` : "";
    const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}${assetIdParam}${suffixParam}`);
    if (!res.ok) return;
    const data = await res.json();

    if (data.currencyMismatch) {
      setMismatchState({
        symbol,
        detectedCurrency: data.detectedCurrency ?? "Unknown",
        storedCurrency: editForm.currency ?? "Unknown",
      });
      return; // Do NOT apply data — wrong listing
    }

    setMismatchState(null);
    const qty = editForm.quantity || 0;
    const price = data.currentPrice || 0;
    const yieldForCalc = data.dividendYield ?? 0;
    const bookCostNum = editForm.bookCost || 0;

    setEditForm(prev => {
      const lookupPatch = applyLookupRespectingLocks(prev, data);
      return {
        ...prev,
        ...lookupPatch,
        marketValue: qty > 0 && price > 0 ? qty * price : prev.marketValue,
        profitLoss: qty > 0 && price > 0 ? (qty * price) - bookCostNum : prev.profitLoss,
        expectedAnnualDividends: qty > 0 && price > 0 && yieldForCalc > 0 ? qty * price * yieldForCalc : 0,
      };
    });
  } catch (err) {
    console.error("Ticker lookup failed:", err);
  }
};
```

- [ ] **Step 6: Render mismatch prompt when `mismatchState` is set**

Find where the edit form is rendered and add below the ticker input (around line ~986):
```tsx
{mismatchState && (
  <div className="col-span-full mt-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
    <p className="text-xs text-amber-800 dark:text-amber-300 mb-2">
      Yahoo returned <strong>{mismatchState.detectedCurrency}</strong> for this ticker, but this asset is{" "}
      <strong>{mismatchState.storedCurrency}</strong>. Select the correct exchange to continue.
    </p>
    <div className="flex gap-2 flex-wrap">
      {[
        { label: "TSX (.TO)", suffix: ".TO" },
        { label: "Cboe Canada (.NE)", suffix: ".NE" },
        { label: "TSX Venture (.V)", suffix: ".V" },
      ].map(opt => (
        <button
          key={opt.suffix}
          onClick={() => handleTickerLookup(mismatchState.symbol, opt.suffix)}
          className="text-xs px-2 py-1 rounded bg-white dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-600 hover:border-teal-500 transition-colors"
        >
          {opt.label}
        </button>
      ))}
      <button
        onClick={() => setMismatchState(null)}
        className="text-xs px-2 py-1 text-neutral-500 hover:text-neutral-700"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Wire props to `HoldingsTab`**

Find where `<HoldingsTab>` is rendered and add:
```tsx
columnVisibility={columnVisibility}
onColumnVisibilityChange={handleColumnVisibilityChange}
onExchangeSave={handleExchangeSave}
```

- [ ] **Step 8: Add FX portfolio totals display**

Find where the portfolio summary / total market value is displayed in `DashboardClient`. Add alongside it:
```tsx
{portfolioTotals && (
  <div className="flex flex-col gap-1 text-sm">
    <div className="flex justify-between gap-8">
      <span className="text-neutral-500 dark:text-neutral-400">CAD Portfolio</span>
      <span className="font-medium">${portfolioTotals.cadTotal.toLocaleString("en-CA", { maximumFractionDigits: 0 })} CAD</span>
    </div>
    <div className="flex justify-between gap-8">
      <span className="text-neutral-500 dark:text-neutral-400">USD Portfolio</span>
      <span className="font-medium">${portfolioTotals.usdTotal.toLocaleString("en-US", { maximumFractionDigits: 0 })} USD</span>
    </div>
    <div className="border-t border-neutral-200 dark:border-neutral-700 pt-1 flex justify-between gap-8">
      <span className="text-neutral-700 dark:text-neutral-300 font-medium">Total</span>
      <span className="font-semibold">
        {portfolioTotals.fxUnavailable
          ? "FX rate unavailable"
          : `$${portfolioTotals.grandTotalCad.toLocaleString("en-CA", { maximumFractionDigits: 0 })} CAD`}
      </span>
    </div>
    {!portfolioTotals.fxUnavailable && portfolioTotals.usdToCadRate && (
      <p className="text-xs text-neutral-400">
        at 1 USD = {portfolioTotals.usdToCadRate.toFixed(4)} CAD · as of today
      </p>
    )}
    {portfolioTotals.fxUnavailable && (
      <p className="text-xs text-neutral-400">Showing per-currency subtotals only</p>
    )}
  </div>
)}
```

- [ ] **Step 9: Run all tests**

```bash
npx jest --no-coverage
```
Expected: All tests PASS.

- [ ] **Step 10: Start dev server and verify end-to-end**

```bash
npm run dev
```

Check in browser:
- Holdings table shows "Exchange" column with values populated from Yahoo
- Clicking an Exchange cell opens dropdown
- Selecting an exchange and saving locks it (lock icon appears, field doesn't change on next ticker lookup)
- Asset with `needsExchangeReview: true` shows ⚠ badge; resolving it clears the badge
- "Manage Columns" button toggles the popover; toggling a column hides/shows it; preference persists after page refresh
- Portfolio summary shows CAD/USD breakdown + grand total in CAD with FX rate noted

- [ ] **Step 11: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): exchange mismatch gate, column visibility wiring, FX portfolio totals display"
```

---

## Final Integration Commit

- [ ] **Run full test suite one last time**

```bash
npx jest --no-coverage
```
Expected: All PASS, no regressions.

- [ ] **Recommend adversarial review**

Implementation complete — recommend running `/codex:adversarial-review` before marking this ready for merge.
