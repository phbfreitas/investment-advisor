# Exchange-Aware Ticker Routing & Column Visibility Design

**Date:** 2026-05-03  
**Status:** Approved  
**Triggered by:** Simone (P.O.) bug report — multi-market ticker collisions causing wrong pricing for Canadian holdings

---

## Problem Summary

The application treats ticker symbols as globally unique identifiers. Wealthsimple portfolios contain duplicate symbols representing different assets on different national exchanges (e.g., `JEPQ` exists as both a Canadian-listed ETF at ~$26.56 CAD and a US-listed ETF at ~$55.52 USD). Because the app defaults to US exchanges, Canadian holdings receive incorrect USD pricing, corrupting market value totals and Dividend Snowball calculations.

Root causes identified (full investigation in conversation context):
1. PDF parser deduplicates holdings by ticker alone — second occurrence of a collision ticker is silently dropped
2. `researchTicker` queries Yahoo with a bare symbol; the `.TO` fallback only fires on exception, not on currency mismatch
3. No mismatch validation — Yahoo's returned currency is never compared against the stored asset currency
4. `applyLookupRespectingLocks` overwrites currency and price unconditionally when unlocked
5. No per-asset exchange field — users have no way to specify which listing to query

---

## Scope

This sprint delivers all three of Simone's functional requirements (4.A, 4.B, 4.C) plus two P.O.-requested UX improvements (column visibility, FX-converted portfolio totals).

**In scope:**
- Exchange suffix field (`exchangeSuffix`, `exchangeName`) on Asset with lock support
- PDF parser dedup fix (composite key: ticker + currency)
- `researchTicker` exchange-aware routing + mismatch detection
- "Exchange" column in the holdings table with inline override and auto-lock
- Column visibility (show/hide any column, persisted to DynamoDB)
- FX portfolio totals (CAD subtotal + USD subtotal + grand total in CAD via daily USDCAD=X rate)

**Out of scope:**
- Per-row FX conversion in the holdings table (only portfolio-level aggregates)
- Support for currencies other than CAD and USD (edge cases logged, not displayed)
- Automatic exchange suffix guessing (explicitly rejected by P.O. — per-asset specification only)

---

## Section 1 — Data Model

### New fields on `Asset` (`src/types/index.ts`)

| Field | Type | Purpose |
|---|---|---|
| `exchangeSuffix` | `string` | Yahoo query suffix: `""` (US), `".TO"` (TSX), `".NE"` (Cboe Canada), `".V"` (TSX Venture) |
| `exchangeName` | `string` | Human-readable display: `"Nasdaq"`, `"NYSE"`, `"TSX"`, `"Cboe Canada"` |
| `needsExchangeReview` | `boolean \| undefined` | Set `true` on PDF import when a currency mismatch is detected; cleared on user resolution |

### LockableField addition

Add `"exchange"` to the `LockableField` union in `src/types/index.ts`. Both `exchangeSuffix` and `exchangeName` share this single lock key — they travel as a pair.

When `userOverrides.exchange === true`:
- `researchTicker` uses the stored `exchangeSuffix` as-is for Yahoo queries
- Neither `exchangeSuffix` nor `exchangeName` is overwritten by lookup results
- The lock icon is shown in the Exchange table column

### Exchange code → suffix + name mapping

New lookup table in `src/lib/classification/allowlists.ts`:

| Yahoo `quote.exchange` | `exchangeSuffix` | `exchangeName` |
|---|---|---|
| `NMS`, `NGM`, `NCM` | `""` | `"Nasdaq"` |
| `NYQ` | `""` | `"NYSE"` |
| `ASE`, `PCX` | `""` | `"NYSE American"` |
| `TOR` | `".TO"` | `"TSX"` |
| `CVE` | `".V"` | `"TSX Venture"` |
| `NEO` | `".NE"` | `"Cboe Canada"` |
| `VAN` | `".V"` | `"Vancouver"` |
| (unknown) | `""` | Yahoo `fullExchangeName` verbatim |

Export as `EXCHANGE_CODE_MAP: Record<string, { suffix: string; name: string }>` and a helper `resolveExchange(code: string, fallbackName: string): { exchangeSuffix: string; exchangeName: string }`.

### Column visibility preferences

Stored in the existing `HOUSEHOLD#{id}` / SK `"META"` DynamoDB item as a new field:

```ts
columnVisibility: Record<string, boolean>
```

Only user-modified columns are stored — defaults are defined as a client-side constant. No new DynamoDB key patterns required.

### FX rate

Not persisted. Fetched server-side from Yahoo (`USDCAD=X`) with a 1-hour module-level in-memory cache. The `GET /api/portfolio` route fetches it alongside assets.

---

## Section 2 — PDF Parser Fix

**File:** `src/app/api/portfolio-pdf/parseHoldings.ts`

Change the dedup guard from ticker-only to composite `(ticker, currency)`:

```ts
// Before
if (!holdings.some(h => h.ticker === ticker))

// After
if (!holdings.some(h => h.ticker === ticker && h.currency === currency))
```

Apply to both match sites (lines ~137 and ~172).

**File:** `src/app/api/portfolio-pdf/route.ts`

Three downstream sites also use ticker-only matching — all updated to composite key:

| Line (approx) | Current | Fixed |
|---|---|---|
| ~181 (candidate filter) | `.filter(a => a.ticker === h.ticker)` | `.filter(a => a.ticker === h.ticker && a.currency === h.currency)` |
| ~403 (sync-pass) | `holdings.some(h => h.ticker === asset.ticker)` | `holdings.some(h => h.ticker === asset.ticker && h.currency === asset.currency)` |

**`tickerCache` key change:**

Currently keyed by `h.ticker`. With collision tickers surviving, two rows with the same ticker but different currencies would share the same cache entry and contaminate each other. Fix: skip the cache for any ticker that appears more than once in the parsed holdings list (collision tickers). Non-collision tickers continue to use the cache as before.

```ts
const collisionTickers = new Set(
  holdings
    .map(h => h.ticker)
    .filter((t, _, arr) => arr.filter(x => x === t).length > 1)
);

// In the enrichment loop:
const canCache = existing == null && !collisionTickers.has(h.ticker);
if (canCache && tickerCache.has(h.ticker)) {
  enrichedData = tickerCache.get(h.ticker);
} else {
  enrichedData = await researchTicker(h.ticker, existing);
  if (canCache) tickerCache.set(h.ticker, enrichedData);
}
```

---

## Section 3 — Exchange Lookup, Yahoo Routing & Mismatch Detection

### `researchTicker` signature (`src/lib/ticker-research.ts`)

Extend the `existingAsset` pick to include `exchangeSuffix` and `currency`:

```ts
export async function researchTicker(
  symbol: string,
  existingAsset?: Pick<Asset,
    "userOverrides" | "marketComputedAt" | "market" | "exchangeSuffix" | "currency"
  > | null,
): Promise<Partial<TickerMetadata> | null>
```

### Yahoo query routing

At the start of `researchTicker`, before the existing quote call:

```
1. Exchange LOCKED (userOverrides.exchange === true):
   → Build querySymbol = symbol + existingAsset.exchangeSuffix
   → Query Yahoo with querySymbol directly
   → Skip auto-detection

2. Exchange NOT locked:
   → Query bare symbol (existing behaviour preserved)
   → Read quote.exchange from response
   → Call resolveExchange(quote.exchange, quote.fullExchangeName)
   → Store { exchangeSuffix, exchangeName } in result
   → Existing .TO length-based fallback (on exception) preserved unchanged
```

### Mismatch detection

After a successful quote, when exchange is not locked:

```ts
const currencyMismatch =
  existingAsset?.currency != null &&
  existingAsset.currency !== "Not Found" &&
  quote.currency !== existingAsset.currency;
```

`researchTicker` does not throw on mismatch — it returns the result with the flag. Callers decide behaviour.

### `TickerMetadata` additions

```ts
exchangeSuffix: string;
exchangeName: string;
currencyMismatch?: boolean;
detectedCurrency?: string;   // only present when currencyMismatch is true
```

### Caller responses to `currencyMismatch`

**`GET /api/ticker-lookup` (interactive edit):**
Pass `currencyMismatch` and `detectedCurrency` through in the JSON response unchanged. The client (`DashboardClient`) inspects the response:
- If `currencyMismatch === true`: block applying the lookup data to the form; show inline prompt: *"Yahoo returned [USD] for this ticker but this asset is [CAD]. Select the correct exchange to continue."*
- User selects exchange from dropdown → client re-calls `/api/ticker-lookup?symbol=JEPQ&assetId=xxx&exchangeSuffix=.NE` → loop until currencies match or user cancels

**Wiring `exchangeSuffix` in the route:**
`findExistingAssetById` must be extended to also return `exchangeSuffix` and `currency` (in addition to the current `userOverrides`, `marketComputedAt`, `market`). When `exchangeSuffix` is present as a query param, the route builds an override object before calling `researchTicker`:

```ts
const suffixOverride = request.nextUrl.searchParams.get('exchangeSuffix');
const existing = assetId ? await findExistingAssetById(householdId, assetId, symbol) : null;
const assetForLookup = suffixOverride
  ? { ...existing, exchangeSuffix: suffixOverride, userOverrides: { ...existing?.userOverrides, exchange: true } }
  : existing;
const data = await researchTicker(symbol, assetForLookup);
```

This forces the locked-suffix path in `researchTicker` for the duration of the resolution call only — the actual lock is not persisted until the user confirms via the asset PATCH.

**`POST /api/portfolio-pdf` (batch import):**
- Do not block the import
- Write the asset with `currency` from the PDF (Wealthsimple is ground truth)
- Set `needsExchangeReview: true` on the item
- The holdings table shows an amber ⚠ badge in the Exchange cell for flagged assets

### `applyLookupRespectingLocks` additions (`src/app/dashboard/lib/applyLookupRespectingLocks.ts`)

```ts
exchangeSuffix: isLocked("exchange") ? prev.exchangeSuffix : (data.exchangeSuffix ?? prev.exchangeSuffix ?? ""),
exchangeName:   isLocked("exchange") ? prev.exchangeName  : (data.exchangeName  ?? prev.exchangeName  ?? ""),
```

`liveTickerPrice` remains "never locked" — but the mismatch gate in the client ensures a wrong-currency price never reaches the form unless the user explicitly resolves the exchange first.

---

## Section 4 — Holdings Table UI

### Exchange column

- **Position:** after the `Currency` column
- **Display:** `exchangeName` (e.g., `"TSX"`, `"Cboe Canada"`, `"Nasdaq"`)
- **Lock indicator:** small lock icon beside the name when `userOverrides.exchange === true`
- **Mismatch indicator:** amber `⚠ Review` badge when `needsExchangeReview === true`; clicking opens the exchange resolution flow

**Inline edit flow:**
1. User clicks the Exchange cell → dropdown appears
2. Options: Nasdaq, NYSE, NYSE American, TSX, TSX Venture, Cboe Canada, Other
3. "Other" reveals a free-text suffix input (`.XX` format) for unlisted exchanges
4. On confirm → PATCH to existing `/api/assets/[id]` with `{ exchangeSuffix, exchangeName, userOverrides: { exchange: true } }`
5. Lock icon appears immediately; subsequent ticker lookups honour the lock

No new API routes required.

### Column visibility

**Trigger:** "Manage Columns" icon button in the holdings table header (top-right area)

**UI:** Popover checklist with all column names and toggle switches. Changes persist immediately via `PATCH /api/preferences/columns` — no explicit save button.

**New route:** `PATCH /api/preferences/columns`
- Reads `HOUSEHOLD#{id}` / `"META"` item
- Merges `{ columnVisibility: { [columnKey]: boolean } }` into the item
- Writes back with `updatedAt`

**Default visibility:**

| Visible by default | Hidden by default |
|---|---|
| Account, Ticker, Quantity, Book Cost, Market Value, Live Price, P/L, Yield, Security Type, Strategy Type, Sector, Market, Currency, Exchange, Management Fee, 1YR Return | Management Style, Call, Beta, Volatility, Risk, External Rating, 3YR Return, Ex-Div Date, Analyst Consensus |

Defaults are a client-side constant defined in `src/app/dashboard/HoldingsTab.tsx`; only user deviations from those defaults are stored in DynamoDB.

---

## Section 5 — FX Portfolio Totals

### `src/lib/fxRate.ts` (new file)

```ts
export async function fetchFxRate(from: string, to: string): Promise<number>
```

- Calls `yahooFinance.quote(`${from}${to}=X`)` and reads `regularMarketPrice`
- Module-level cache: one stored `{ rate: number; fetchedAt: number }` per pair; returns cached value if age < 1 hour
- On failure: throws, so callers can degrade gracefully

### Portfolio analytics (`src/lib/portfolio-analytics.ts`)

New function:

```ts
export function computePortfolioTotals(
  assets: Asset[],
  usdToCadRate: number | null,
): PortfolioTotals
```

```ts
interface PortfolioTotals {
  cadTotal: number;
  usdTotal: number;
  grandTotalCad: number;
  usdToCadRate: number | null;
  fxUnavailable: boolean;
}
```

- `cadTotal`: sum of `marketValue` for assets where `currency === "CAD"`
- `usdTotal`: sum of `marketValue` for assets where `currency === "USD"`
- `grandTotalCad`: `cadTotal + (usdTotal × usdToCadRate)` when rate is available; equals `cadTotal` only when `fxUnavailable`
- Assets with neither CAD nor USD currency are bucketed into CAD at rate 1 and logged as a warning

### `GET /api/portfolio` route

Fetches `fetchFxRate("USD", "CAD")` in parallel with the existing assets query. On failure, passes `null` as the rate — the analytics function sets `fxUnavailable: true`.

### Display (portfolio summary card)

```
CAD Portfolio      $xxx,xxx CAD
USD Portfolio       $xx,xxx USD
────────────────────────────────
Total              $xxx,xxx CAD
           at 1 USD = 1.3642 CAD  ·  as of today
```

When `fxUnavailable`:
> *FX rate unavailable — showing per-currency subtotals only*

**Dividend Snowball:** same split — dividends summed per currency, grand total in CAD using same rate.

**Individual asset rows:** no change — each row shows its native currency. FX conversion applies only to portfolio-level aggregates.

---

## Error Handling & Edge Cases

| Scenario | Behaviour |
|---|---|
| Yahoo returns unknown exchange code | `exchangeSuffix: ""`, `exchangeName` = Yahoo's `fullExchangeName` verbatim |
| FX rate fetch fails | `fxUnavailable: true`; subtotals shown; grand total omitted |
| PDF has collision ticker and both rows are new assets | Both written to DB; `tickerCache` bypassed for collision tickers |
| Asset currency is `"Not Found"` | Mismatch detection skipped (no reliable baseline to compare against) |
| User selects "Other" exchange with empty suffix | Treated as US listing (`""`) — no suffix applied |
| `needsExchangeReview` asset is locked by user | The existing `PATCH /api/assets/[id]` route clears `needsExchangeReview` whenever `userOverrides.exchange` is set to `true`; badge disappears on next render |

---

## Testing Approach

Following the project's TDD pattern — failing tests first, then implementation.

| Test file | New cases |
|---|---|
| `parseHoldings.test.ts` | Two JEPQ rows (CAD + USD) both survive; collision ticker dedup; CAD-only ticker still deduplicated correctly |
| `ticker-research.test.ts` | Locked suffix used for query; mismatch flag returned; exchange code mapping; `.TO` fallback unchanged |
| `applyLookupRespectingLocks.test.ts` | `exchangeSuffix`/`exchangeName` respect `"exchange"` lock; `needsExchangeReview` not touched by lookup |
| `portfolio-analytics.test.ts` | CAD/USD split; grand total with mocked rate; `fxUnavailable` path |
| `fxRate.test.ts` (new) | Cache hit within 1h; cache miss after 1h; failure throws |
| `route.test.ts` (preferences) | `PATCH /api/preferences/columns` merges correctly; unauthorized rejected |

---

## Affected Files

| File | Change |
|---|---|
| `src/types/index.ts` | Add `exchangeSuffix`, `exchangeName`, `needsExchangeReview` to `Asset`; add `"exchange"` to `LockableField` |
| `src/lib/classification/allowlists.ts` | Add `EXCHANGE_CODE_MAP` and `resolveExchange()` |
| `src/lib/ticker-research.ts` | Extended `existingAsset` pick; exchange routing; mismatch detection; return new fields |
| `src/lib/fxRate.ts` | New file — FX rate fetch with 1h cache |
| `src/lib/portfolio-analytics.ts` | `computePortfolioTotals()` with CAD/USD split |
| `src/app/api/portfolio-pdf/parseHoldings.ts` | Composite dedup key |
| `src/app/api/portfolio-pdf/route.ts` | Composite match keys; collision-aware cache; `needsExchangeReview` flag |
| `src/app/api/ticker-lookup/route.ts` | Extend `findExistingAssetById` return type to include `exchangeSuffix` and `currency`; accept `exchangeSuffix` query param and build override object before calling `researchTicker`; pass mismatch fields through in response |
| `src/app/api/portfolio/route.ts` | Fetch FX rate; pass `PortfolioTotals` to client |
| `src/app/api/preferences/columns/route.ts` | New route — `PATCH` column visibility |
| `src/app/dashboard/lib/applyLookupRespectingLocks.ts` | Add `exchangeSuffix`, `exchangeName` with `"exchange"` lock |
| `src/app/dashboard/DashboardClient.tsx` | Mismatch prompt; exchange resolution flow; column visibility state |
| `src/app/dashboard/HoldingsTab.tsx` | Exchange column; ⚠ badge; Manage Columns button + popover |
| `src/components/AddAssetModal.tsx` | No change (exchange auto-detected on first lookup after save) |
