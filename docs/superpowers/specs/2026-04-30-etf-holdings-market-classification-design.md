# ETF Holdings Market Classification — Design Spec

**Date:** 2026-04-30
**Source triage:** [docs/superpowers/triage/2026-04-27-po-feedback-triage.md](../triage/2026-04-27-po-feedback-triage.md)
**Scope:** Phase 3, sub-project 3C — PO feedback item 2.3
**Decision baseline:** Brainstorming session 2026-04-30. PO confirmed all five design decisions in turn (lazy compute, top-10 + name-guard, any-presence NA rule, 1-year TTL, recurse one level deep).
**Companion:** [2026-04-30-etf-holdings-market-classification-PO.md](2026-04-30-etf-holdings-market-classification-PO.md) (plain-English version for product-owner review).

## Goal

Replace the current "ETFs and Funds always classify as Not Found" behavior with a classifier that reads each fund's top-10 holdings via Yahoo Finance and produces one of the canonical Market values (USA / Canada / North America / Global / Not Found).

The classifier runs lazily inline in `researchTicker`, caches its result on the asset record for 365 days, recurses one level into all-in-one funds-of-funds, and respects the manual-override lock from sub-project 3A.

## Non-Goals

- **Background / scheduled re-classification** — no cron, no eager batch on dashboard load. The 1-year TTL is enforced on the natural touch (next `researchTicker` call after expiry).
- **Global cross-household ticker cache** — no new DynamoDB SK prefix. Each household's asset record is the cache. A future optimization if user count grows.
- **Force-re-classify button** — not added. Workaround is lock + manual edit + unlock + refresh, which is rare in practice.
- **New "loading classification..." UI** — the classifier rides under the existing refresh-row spinner. Optimistic sub-status is YAGNI until real-world testing shows visible jank.
- **Reasoning visible to user** — no "we classified this as USA because of X" explanation panel. The hover tooltip on Not Found cells is the only feedback surface.
- **Recursion deeper than one level** — fund-of-fund-of-fund is treated as Unknown at depth ≥ 2.
- **Coverage-percentage threshold** — top-10 unanimity is the rule; the % of fund weight covered by top-10 doesn't drive the decision (the name/category guard from Q2 handles the false-positive case).
- **Migration of existing assets** — `marketComputedAt` is optional; existing rows have it `undefined` (= treated as expired) and pick up the new classifier on next touch.

## Design

### 1. Lifecycle

**Inline classifier call inside `researchTicker`:**

```
researchTicker(symbol, existingAsset?):
  ... existing work (quote, summary, sector, etc.)
  market = normalizeMarket(quote.exchange, securityType)

  if (
    market === "Not Found" &&
    (securityType === "ETF" || securityType === "Fund") &&
    !existingAsset?.userOverrides?.market &&            // 3A lock check
    isExpired(existingAsset?.marketComputedAt)           // 3C TTL check
  ):
    market = await classifyMarketByHoldings(symbol, depth = 0)
    marketComputedAt = new Date().toISOString()
  else:
    marketComputedAt = existingAsset?.marketComputedAt ?? null

  return { ..., market, marketComputedAt }
```

`isExpired(ts)` is `ts == null || ts === undefined || (Date.now() - Date.parse(ts)) > 365 * 24 * 3600 * 1000`. A fresh timestamp short-circuits the helper; an explicit `null` (manual-set sentinel — see Section 3) means "expired."

**Skip the helper entirely when locked.** No Yahoo call, no work, no token spend. The lock check happens before the TTL check so a locked field never triggers a `topHoldings` request.

**`marketComputedAt` is recorded even on "Not Found".** When the classifier returns "Not Found" (Yahoo empty, name-guard hit, all holdings unresolvable), we still write `marketComputedAt = now()`. This avoids re-hammering Yahoo on every refresh of an unclassifiable ETF. The PO sets Market manually with the 3A lock; her manual value sticks.

### 2. Algorithm

The new helper `classifyMarketByHoldings(symbol, depth)` lives in `src/lib/classification/holdings-market.ts`. It returns a canonical `Market` value. An internal helper `resolveHoldingCountry` returns a richer per-holding bucket used during aggregation.

**Type sketch:**

- `classifyMarketByHoldings(symbol, depth) → Market` (one of `"USA" | "Canada" | "North America" | "Global" | "Not Found"`).
- `resolveHoldingCountry(symbol, quoteType, parentDepth) → Country` (internal type: `"USA" | "Canada" | "Both" | "Other" | "Unknown"`). Never escapes the module.

The internal `"Unknown"` sentinel is used in aggregation to mark holdings we couldn't pin down; the public surface only ever returns a canonical `Market` value.

```
classifyMarketByHoldings(symbol, depth):
  # depth ∈ {0, 1}: 0 = parent fund, 1 = sub-fund recursed once
  if depth > 1:
    return "Not Found"   # safety net; should not be reached in practice

  summary = await quoteSummary(symbol, modules: ['topHoldings', 'price', 'fundProfile'])
  holdings = summary.topHoldings?.holdings ?? []
  if holdings is empty:
    return "Not Found"

  # Step 2.1 — name/category guard (Q2). Only at depth=0 (parent fund's identity).
  if depth === 0:
    fundName = lowercase(summary.price.shortName + " " + summary.price.longName)
    fundCategory = lowercase(summary.fundProfile?.categoryName ?? "")
    if anyTokenIn(fundName + " " + fundCategory, GUARD_TOKENS):
      return "Not Found"

  # Step 2.2 — batch-detect ETF-ness for the top-10 (one Yahoo call covers all).
  # Used to decide whether to recurse into a sub-fund or fall back to suffix.
  symbols = holdings.map(h => h.symbol)
  quotes = await yahooFinance.quote(symbols).catch(() => [])
  quoteTypeBySymbol = new Map(quotes.map(q => [q.symbol, q.quoteType]))

  # Step 2.3 — resolve each top-10 holding's country.
  countries = []
  for h in holdings:
    qt = quoteTypeBySymbol.get(h.symbol) ?? "EQUITY"
    countries.push(await resolveHoldingCountry(h.symbol, qt, depth))

  # Step 2.4 — aggregate (Q3 any-presence).
  resolved = countries.filter(c => c !== "Unknown")
  if resolved is empty:
    return "Not Found"

  hasUS    = resolved.some(c => c === "USA"    || c === "Both")
  hasCA    = resolved.some(c => c === "Canada" || c === "Both")
  hasOther = resolved.some(c => c === "Other")

  if hasOther:        return "Global"
  if hasUS && hasCA:  return "North America"
  if hasUS:           return "USA"
  if hasCA:           return "Canada"
  return "Not Found"
```

**`GUARD_TOKENS` (substring match, case-insensitive):**

```
[
  "global", "world", "international", "intl",
  "emerging", "foreign", "ex-us", "ex us", "ex-usa",
  "developed", "all-country", "all country",
  "msci eafe", "acwi",
]
```

Tokens are matched as substrings against the concatenated lowercase fund name + category. The list is conservative — it errs toward suppressing classification (returning Not Found) on any geography-broadening signal. The PO can refine the list as edge cases surface.

**`resolveHoldingCountry(symbol, quoteType, parentDepth):`**

```
resolveHoldingCountry(symbol, quoteType, parentDepth):
  isFund = (quoteType === "ETF" || quoteType === "MUTUALFUND")

  # Step A — recursion FIRST for sub-funds (Q5: only when parent is at depth 0).
  # Reason: a sub-ETF's exchange suffix tells us where it's *listed*, not what it
  # *holds*. Example: VEQT.TO holds VIU.TO, which is .TO-suffixed but invests
  # internationally — its country bucket is Global, not Canada.
  if isFund && parentDepth < 1:
    sub = await classifyMarketByHoldings(symbol, parentDepth + 1)
    if sub === "USA":            return "USA"
    if sub === "Canada":         return "Canada"
    if sub === "North America":  return "Both"     # contributes both signals to parent
    if sub === "Global":         return "Other"
    # sub === "Not Found" → fall through to suffix as a last resort

  # Step B — exchange-suffix classification (for stocks, or sub-funds we couldn't recurse into).
  if symbol matches /\.(TO|V|NE|CN)$/i:    return "Canada"
  if symbol matches /\.US$/i:              return "USA"
  if symbol has no dot:                    return "USA"   # implicit US tickers
  if symbol matches /\.[A-Z]{1,4}$/:       return "Other" # any other recognized suffix → outside NA

  return "Unknown"
```

**Cost model.** A typical S&P 500 ETF classification: 1 `quoteSummary({topHoldings,...})` + 1 batched `quote([10 symbols])` = 2 Yahoo round-trips. An all-in-one ETF (VBAL/VEQT) on first encounter: 2 round-trips for the parent + 2 round-trips per sub-fund × ~4–10 sub-funds. Worst case ≈ 22 round-trips for one all-in-one classification. Paid once per 365 days per asset.

**Batch `quote()` failure handling.** If the batched `quote` call fails or returns partial results, missing entries default to `quoteType = "EQUITY"` — meaning the holding is treated as a stock and classified by suffix. Graceful degradation: a fund-of-funds whose sub-funds are listed on `.TO` or with no suffix still classifies (less accurately) by listing exchange.

**Within-request memoization.** Inside a single classification request (parent + recursion), a `Map<string, Country>` deduplicates `resolveHoldingCountry` calls per symbol. Handles the unlikely case where the same sub-ETF appears multiple times in a recursion sweep. Internal implementation detail.

### 3. Data Model

**One new optional field on `Asset`:**

```typescript
export interface Asset {
  // ... existing fields, including userOverrides from 3A
  marketComputedAt?: string | null;  // ISO 8601 timestamp, or null when manually set
}
```

**Semantics:**

| Value | Meaning |
|---|---|
| `undefined` | Never auto-classified (legacy assets pre-3C, or fresh ticker-lookup with no existing record). Treated as expired → classifier runs. |
| ISO timestamp `< 365 days` old | Fresh. Classifier skipped. |
| ISO timestamp `≥ 365 days` old | Expired. Classifier runs on next touch. |
| `null` | Explicit "manual-set" sentinel. The user manually edited Market via inline edit; the value did not come from the classifier. Treated as expired (so unlock self-heals — see Section 4). |

**Encryption.** `marketComputedAt` is **not** added to the `ASSET#` `encryptedFields` list in `src/lib/encryption/field-classification.ts`. It is metadata (a timestamp), not financial data — same rationale as the `userOverrides` map from 3A.

**No new SK prefix, no migration.** The cache lives on the asset record itself. Existing assets get auto-classified on next `researchTicker` touch; no backfill script is needed.

### 4. 3A Lock Integration

The 3A spec established the manual-override contract. 3C piggybacks on it with two additions.

**(a) Lock check happens before the classifier call.** If `existingAsset.userOverrides.market === true`, the classifier helper is not invoked at all. No Yahoo call, no work. This is the first check inside the `researchTicker` lifecycle gate (Section 1).

**(b) `marketComputedAt = null` is the manual-set sentinel.** The 3A `setFieldWithLock` helper, when called for the `market` field, additionally sets `marketComputedAt = null`. Semantics: "this value did not come from the classifier."

The unlock flow then self-heals:

1. Day 0: classifier runs → `market = "USA"`, `marketComputedAt = 2026-04-30`.
2. Day 1: PO disagrees, sets `market = "Canada"` manually → `userOverrides.market = true`, `marketComputedAt = null`.
3. Day 200: PO taps lock icon → `userOverrides.market = false` (or removed).
4. Next `researchTicker`: `marketComputedAt` is null → expired → classifier re-runs from scratch with current Yahoo data.

If the helper instead kept the old timestamp through the manual edit, step 4 would skip classification (TTL still fresh by clock) and Market would stay stuck. The `null` sentinel is what makes unlock work.

**Refresh-button behavior:**

- Live data (price, yield, returns) refreshes as today, regardless of lock or TTL.
- Market: refreshes only if both lock is off *and* TTL is expired (or `marketComputedAt` is null/undefined).
- "Force re-classify" is not a button. Workaround: lock + change value + unlock + refresh.

**Other 3A locked fields (sector, currency, etc.) are not touched by 3C.** This sub-project only adds machinery around `market`.

### 5. UX

**Not Found cell tooltip (desktop).** Market cells that render as "Not Found" *and* whose row has `securityType ∈ {ETF, Fund}` *and* whose `marketComputedAt` is non-null get an HTML `title` attribute:

```
"Couldn't determine from top holdings. Set manually if needed."
```

On desktop, hovering shows the message. On mobile, no tooltip — but the lock + manual edit affordance (already in 3A) is the universal correction path. The PO doesn't need a reason code; she needs a fix path, and 3A provides it.

If `marketComputedAt` is null/undefined, no tooltip — because the system genuinely hasn't tried yet, and a refresh might fix it.

**No new icon, no badge, no row-level styling change.** The "Not Found" cell uses whatever existing visual treatment Phase 2's `naIndicator` helper produces today.

**Loading state.** The existing refresh-row spinner covers the extra `topHoldings` round trip. For all-in-one ETFs, recursion may add up to ~10 sub-ETF lookups (worst case ~50 sub-Yahoo calls on first encounter). After the first classification, the cache hit is instant (one DynamoDB read).

If real-world QA on all-in-one ETFs reveals visible jank, an optimistic "classifying holdings..." sub-status can be added in a follow-up.

### 6. Files Affected

**New:**

- `src/lib/classification/holdings-market.ts` — `classifyMarketByHoldings` + `resolveHoldingCountry`. Pure module, no DynamoDB access.
- `src/lib/classification/__tests__/holdings-market.test.ts` — algorithm unit tests with mocked Yahoo responses.

**Modified:**

| File | Change |
|---|---|
| `src/types/index.ts` | Add `marketComputedAt?: string \| null` to `Asset`. |
| `src/lib/ticker-research.ts` | Accept optional `existingAsset?: Asset`; gate the classifier call on lock + TTL; add `marketComputedAt` to `TickerMetadata`. |
| `src/app/api/ticker-lookup/route.ts` | Look up the household's asset by symbol (single GSI / scan as appropriate to existing patterns); pass to `researchTicker`. |
| `src/app/api/portfolio-pdf/route.ts` | When upserting on re-import, pass the matched existing asset to `researchTicker`. |
| `src/app/api/assets/route.ts` (and any sibling create/patch routes) | Accept `marketComputedAt` in POST/PATCH bodies; persist to DynamoDB. |
| `src/lib/audit/assetSnapshot.ts` | Include `marketComputedAt` in before/after snapshots so audit-log diffs render it. |
| `src/app/dashboard/DashboardClient.tsx` | (a) `handleTickerLookup` preserves `data.marketComputedAt` into form state; (b) form initialization reads `asset.marketComputedAt`; (c) `setFieldWithLock` extension: when called for `market`, also sets `marketComputedAt = null`; (d) `title` attribute on Not Found Market cells per Section 5; (e) save handler sends `marketComputedAt` back. |

**Not modified:**

- `src/lib/classification/allowlists.ts` — `MARKET_VALUES` is unchanged. `normalizeMarket` is unchanged; it remains the canonical first-pass entry point. The new classifier is a downstream refinement that runs only when `normalizeMarket` returns "Not Found" for ETFs/Funds.
- `src/lib/encryption/field-classification.ts` — `marketComputedAt` is metadata, not encrypted.
- DynamoDB SK schema — no new prefix.

The trace-full-data-flow check from project memory is satisfied by the eight-point file list above. The implementation plan must explicitly walk each file and confirm `marketComputedAt` flows through correctly (API output → client form state → API input → DB).

## Testing Strategy

### Unit tests — `classifyMarketByHoldings`

- All top-10 stocks (quoteType=EQUITY), all US-suffixed → returns "USA".
- All top-10 stocks, all `.TO`-suffixed → returns "Canada".
- Mixed US + `.TO` stocks → "North America".
- US stock + `.L` (London) stock → "Global".
- Empty `topHoldings` → "Not Found".
- Name-guard hits ("Vanguard Total **World** Stock") with all-US top-10 → "Not Found".
- Category-guard hits (categoryName contains "Foreign Large Blend") → "Not Found".
- Name guard does NOT fire when called recursively (depth > 0): a sub-fund classified within its parent must use its own holdings rather than its name. Verified by passing a "Total World" sub-fund recursively and confirming it classifies by holdings.
- Yahoo `quoteSummary` errors → "Not Found", does not throw.
- Yahoo batch `quote` errors / returns partial → missing entries treated as EQUITY (suffix path).
- Recursion depth=2 (caller passed depth=2) → returns "Not Found" immediately without a Yahoo call.
- Sub-fund recursion: parent's top-10 contains a holding with quoteType=ETF and a US suffix → recurses → suffix path of the sub-fund's stocks resolves correctly.
- Sub-fund that itself classifies as North America → contributes "Both" to parent aggregation, parent receives the right NA count.
- All-in-one fund (VEQT-style): top-10 = 4 sub-ETFs, all `.TO`-suffixed, but sub-ETFs cover US, Canada, international, emerging — parent classifies as **Global** (NOT North America). This is the regression test for the suffix-first bug caught in spec self-review.

### Unit tests — `resolveHoldingCountry`

- quoteType=EQUITY, `.TO`/`.V`/`.NE`/`.CN` → "Canada".
- quoteType=EQUITY, no suffix or `.US` → "USA".
- quoteType=EQUITY, `.L`/`.DE`/`.T`/`.HK` → "Other".
- quoteType=ETF at parentDepth=0, classifier returns "USA" → "USA".
- quoteType=ETF at parentDepth=0, classifier returns "North America" → "Both".
- quoteType=ETF at parentDepth=0, classifier returns "Global" → "Other".
- quoteType=ETF at parentDepth=0, classifier returns "Not Found" → falls through to suffix.
- quoteType=ETF at parentDepth=1 (already recursed once) → no further recursion; classified by suffix.
- Garbage / unparseable symbol → "Unknown".

### Integration tests — `researchTicker` orchestration

Yahoo is mocked; existing asset is passed in as a fixture.

- ETF, no `existingAsset` → classifier runs; result includes fresh `marketComputedAt`.
- ETF, `marketComputedAt` < 365 days old → classifier skipped; result preserves existing market + timestamp.
- ETF, `marketComputedAt` > 365 days old → classifier runs; refreshes timestamp.
- ETF, `userOverrides.market === true` → classifier skipped regardless of TTL; market and timestamp untouched.
- Company (non-ETF/Fund) → classifier never runs; existing exchange-suffix logic applies.

### Component tests — `DashboardClient`

- Editing the Market dropdown sets `userOverrides.market = true` AND `marketComputedAt = null`.
- After save, persisted Asset has both fields.
- Subsequent ticker lookup on a locked-Market asset doesn't change Market or `marketComputedAt`.
- Unlock + refresh → classifier re-runs; new value and fresh timestamp written.

### Manual verification (mobile-first, per project memory)

- Re-import the TFSA PDF: ETF rows that previously showed "Not Found" should classify (likely "USA" for US ETFs, "Canada" for `.TO` ETFs).
- All-in-one ETF (e.g., **VBAL** or **VEQT** if held): expect "North America" or "Global" depending on its actual exposure.
- Hover tooltip on a Not Found ETF cell: shows the explanatory message on desktop.
- Phone view (375px), tablet (768px), desktop (1440px): no row-layout regression.
- Set Market manually to "Canada", refresh — value sticks, lock icon visible (3A behavior intact).
- Tap the lock icon in display mode, then tap refresh — new classifier value writes; old timestamp replaced.

## Known Limitations

### ADRs and dotless foreign symbols (Codex round-2 finding #3)

`resolveByExchangeSuffix` defaults every symbol without a `.`-suffix to "USA". This is correct for the common case — Yahoo returns major US-exchange tickers (AAPL, MSFT, NVDA, GOOGL, etc.) without suffixes — but it breaks for **ADRs of foreign companies** that trade unsuffixed on NYSE/NASDAQ. Examples:

- `TSM` → Taiwan Semiconductor, ADR on NYSE, but underlying is Taiwanese.
- `BABA` → Alibaba, ADR on NYSE, underlying is Chinese.
- `BIDU`, `JD`, `NIO` → Chinese companies, US-listed ADRs.
- `RIO`, `BHP` → Australian/British miners, US-listed ADRs.

When such ADRs appear in an ETF's top-10 holdings, this classifier counts them as USA exposure. A fund with significant ADR exposure (e.g., a "US Total Stock Market" ETF that includes BABA, or an emerging-markets fund whose top-10 are all ADRs) may classify as USA when the underlying companies are largely foreign.

**Why we accept this limitation for now:**

- Fixing properly requires per-holding `quoteSummary({modules: ['assetProfile']})` lookups to read the company's country of incorporation. That's ~10 extra Yahoo round-trips per parent classification (a 5x cost increase on an already rate-limited API).
- The simpler workaround (a hard-coded ADR allowlist) is brittle and ages poorly as new ADRs list.
- The case is uncommon for the PO's actual portfolio: she primarily holds broad-market US/Canadian ETFs and Canadian-listed funds. Funds with heavy foreign-ADR top-10 (emerging market ETFs especially) typically already trip the name guard ("Emerging Markets", "International", etc.).
- The 3A lock is the user-side escape hatch: when this surfaces in QA, the PO sets Market manually once and the classifier never runs again on that asset.

**When to revisit:**

- If the PO reports a real-world misclassification on a fund she holds.
- If the user base ever expands beyond Simone (other users may have ADR-heavy portfolios).

**Mitigation if revisited:**

The cleanest fix is per-holding `assetProfile.country` lookups, batched alongside the existing `quote()` batch in `classifyMarketByHoldings`. Cost is acceptable on the 1-year TTL cadence (lookup happens once per asset per year). Implementation is straightforward but out of scope for the 3C sprint.

## Acceptance

- A re-import of a brokerage PDF containing ETFs produces classified Market values where Yahoo's holdings data permits it (typical US/Canadian ETFs).
- Ambiguous funds (Total World, Emerging Markets) correctly fall back to "Not Found" via the name/category guard.
- The 1-year TTL is honored: a fresh classification is not re-run on subsequent refreshes within 365 days.
- The 3A lock continues to work: manually setting Market suppresses the classifier; tapping the lock icon and then refreshing produces a fresh classification.
- All-in-one ETFs (VBAL, VEQT, etc.) classify correctly via one-level recursion.
- Audit log shows `marketComputedAt` transitions on classification events.
- All Jest tests pass; `npx tsc --noEmit` clean; build compiles.
- No DynamoDB schema migration required.
