# Live-Price Sanity Gate + Concentration Sum — Design Spec

**Date:** 2026-04-29
**Source feedback:** Phase 5 module 7 ("System Bug Fixes / Error List") — items "Pricing Error (Live Price)" and "Concentration Sum (Top Holdings)"
**Scope:** Phase 5, sub-project **5G** — two narrow, independent fixes shipped as one spec.
**Brainstorm trail:** This session, with the PO's confirmation that (a) live-price 2x bugs were observed across multiple refreshes (not transient), (b) >5% deltas are the operational signal of a bug, (c) she does NOT want a quarantine modal — passive visual flag only.

## Goal

Two correctness fixes the PO requested in her Phase 5 list:

1. **5G.1 — Live-price sanity gate.** When a live-price refresh returns a value ≥10% different from the prior known price, the cell shows a small grey `?` icon. Tapping/hovering reveals "Changed from $X.XX (±Y.Y%)". Every anomaly is logged to DynamoDB (with the full Yahoo response) so we have forensic data the next time a wrong price is reported.
2. **5G.2 — Concentration % sum.** The "Top 10 Holdings" chart's title becomes `Top N Holdings · X.X% of portfolio`, where the percent is the sum of the listed rows' weights.

## Non-Goals

- **Quarantine / accept-reject modal.** Explicitly rejected by the PO ("nightmare accepting everything"). Refresh stays one-click; the `?` is awareness, not gating.
- **UI to browse the anomaly log.** Records live in DynamoDB; surfacing them is a future spec.
- **Per-ticker custom thresholds.** Single global 10%. Adjust later if the log shows it's wrong.
- **Anomaly auto-cleanup / TTL.** Records are tiny and rare; revisit only if storage matters.
- **Retry/queue on log POST failure.** Best-effort instrumentation, not critical path.
- **Auto-correction of wrong-instrument hits** (e.g., Yahoo returning `JEPQ.MX` for `JEPQ`). The raw quote we capture will *reveal* these incidents in forensics; auto-fix is future work.
- **Detection on the PDF-import path or AI-research path.** Only the dashboard refresh and edit-form ticker lookup go through the gate. PDF-import prices come from `marketValue / quantity`, which is broker-authoritative.
- **The other six Phase 5 sub-projects** (5A holdings table, 5B source-of-truth, 5C multi-currency, 5D dividends, 5E visual identity, 5F guru). Each gets its own brainstorm.
- **The 3A regex patch** for Wealthsimple-flavored section headers — see [Adjacent Work](#adjacent-work) below; lands on the in-flight 3A branch, not in 5G.

## Adjacent Work

This spec deliberately does NOT cover, but the implementation team should know about:

**3A hot patch — Wealthsimple section headers.** The current `parseHoldings.ts` `sectionRegex` only matches "Canadian Dollar Holdings" / "U.S. Dollar Holdings" wording. Wealthsimple statements use **`Canadian Equities and Alternatives`** and **`US Equities and Alternatives`**. As-is, after 3A ships, the PO's Wealthsimple imports still mis-tag every USD asset (VGT, COST) as CAD because the section headers are skipped and the doc-default is CAD. Patch: broaden the two `sectionRegex` patterns to:

```ts
sectionRegex: /^Canadian\s+(?:Dollar|Equities|Securities|Stocks|Investments|Holdings)\b/i
sectionRegex: /^U\.?S\.?\s+(?:Dollar|Equities|Securities|Stocks|Investments|Holdings)\b/i
```

…and add `DOC-20260422-WA0045.pdf` (the PO's March 2026 Wealthsimple statement she shared during this brainstorm) as a fixture test. This patch lands on the existing 3A branch before 3A merges. Approximately 10 lines of code + one fixture.

The PO's original "Bug A — VGT/QMAX qty wrong by ~30%" was a misattribution: my trace through the parser on her actual PDF shows quantities parse correctly, but currency tagging mislabels USD assets as CAD. The 1/1.39 ≈ 28% gap she observed matches CAD/USD, not a quantity bug. Landing this patch resolves that perceived issue and clears 5G to focus narrowly on live-price + concentration sum.

## Design

### 1. Architecture

| Concern | Where it lives | Why |
|---|---|---|
| Compute delta vs prior | **Client** (`DashboardClient.tsx`'s `fetchMarketData`) | Already has both prior (`assets[i].liveTickerPrice`) and new (`/api/market-data` response). No round-trip needed. |
| Render `?` icon + tooltip | **Client** (Live $ table cell) | Pure presentation; transient session state. |
| Persist anomaly record | **Server** (new `POST /api/price-anomaly-log`) | Single auth surface; consistent with existing audit-log pattern. |
| Capture raw Yahoo response | **Client → Server** (passed in log payload) | Client receives full response from `/api/market-data`; forwards to log endpoint when delta crosses threshold. |

**`/api/market-data` is unchanged.** It continues to return Yahoo data verbatim. We don't bake "prior price" knowledge into a stateless quote endpoint.

### 2. Detection logic (client-side)

In `fetchMarketData` (currently at `src/app/dashboard/DashboardClient.tsx:91-118`), after each ticker's quote returns:

```ts
const prior = assets.find(a => a.ticker === data.ticker)?.liveTickerPrice ?? 0;
const next  = data.currentPrice ?? 0;

const isAnomaly =
  prior > 0 &&
  next > 0 &&
  Math.abs(next - prior) / prior >= 0.10;

if (isAnomaly) {
  setAnomalies(prev => ({
    ...prev,
    [data.ticker]: { prior, next, deltaPct: ((next - prior) / prior) * 100 },
  }));
  // Fire-and-forget POST to /api/price-anomaly-log
  fetch('/api/price-anomaly-log', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ticker: data.ticker,
      assetId: assets.find(a => a.ticker === data.ticker)?.id,
      priorPrice: prior,
      newPrice: next,
      deltaPct: ((next - prior) / prior) * 100,
      deltaAbs: next - prior,
      source: 'refresh',
      rawYahooQuote: data,
    }),
  }).catch(() => { /* best-effort */ });
}
```

**State:** a new `anomalies: Record<string, { prior: number; next: number; deltaPct: number }>` keyed by ticker, alongside the existing `marketData` state.

**Edge cases — explicitly silent (no flag, no log):**

- `prior === 0` or missing/null (first-time imports, manually cleared prices).
- `next === 0` or missing (Yahoo returned no price — leave display unchanged).
- Sign of delta is irrelevant: `+11%` and `-11%` both flag.
- Boundary: exactly `10%` flags (`>= 0.10`).

**The new price IS applied to display regardless of flag.** The `?` is a passive marker, not a gate. `setMarketData(prev => ({ ...prev, ...newMarketData }))` continues to overwrite as today.

The `anomalies` state is **session-only**. Reload clears it. On subsequent refreshes, the new price becomes the new baseline, so a stable wrong price flags only on the refresh that introduced it.

### 3. UI — Live $ cell

Currently at `DashboardClient.tsx:833`:

```tsx
const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
```

Becomes (sketch):

```tsx
const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
const anomaly = anomalies[asset.ticker];

return (
  <span className="inline-flex items-center gap-1">
    <span>${formatPrice(price)}</span>
    {anomaly && (
      <span
        title={`Changed from $${anomaly.prior.toFixed(2)} (${anomaly.deltaPct >= 0 ? '+' : ''}${anomaly.deltaPct.toFixed(1)}%)`}
        className="text-neutral-400 dark:text-neutral-500 text-xs cursor-help select-none"
        aria-label={`Price changed by ${anomaly.deltaPct.toFixed(1)} percent`}
      >
        ?
      </span>
    )}
  </span>
);
```

**Visual spec:**
- `?` glyph, neutral grey (`text-neutral-400` light / `text-neutral-500` dark).
- Font size one tier smaller than the price (`text-xs` next to `text-sm`).
- 4px gap between price and icon (`gap-1`).
- Tooltip via native `title` attribute (consistent with the rest of the app — same approach used in the collapsible sidebar work).
- Tap target on mobile: the icon's hit area is small intrinsically; surround with `px-1` padding so it's ≥24pt total.
- Tooltip text format: **`Changed from $XX.XX (+YY.Y%)`** — sign always shown, one decimal in delta %, two decimals in price.
- `aria-label` provides the same info for screen readers.

### 4. Anomaly log — server endpoint

**Route:** `POST /api/price-anomaly-log`

**Auth:** standard `getServerSession`; reject if no `householdId`. Same pattern as every other authed endpoint in the app.

**Request body:**

```ts
{
  ticker: string;             // e.g., "JEPQ"
  assetId: string;            // links to the specific asset row
  priorPrice: number;
  newPrice: number;
  deltaPct: number;           // signed (+100.3 or -10.9)
  deltaAbs: number;           // signed dollars
  source: 'refresh' | 'edit-form-lookup';
  rawYahooQuote: object;      // forwarded verbatim from /api/market-data response
}
```

**DynamoDB record (single-table):**

```
PK:   HOUSEHOLD#<householdId>
SK:   ANOMALY#<isoTimestamp>#<ticker>
type: PRICE_ANOMALY
ticker, assetId
priorPrice, newPrice, deltaPct, deltaAbs
source
detectedAt:    <isoTimestamp>
rawYahooQuote: { ... }
```

The composite `SK` (timestamp + ticker) lets the same ticker accumulate multiple records over time and ensures chronological ordering on `Query`.

**Response:** `200 { ok: true }` on success, `200 { ok: false }` on internal failure (best-effort — the client doesn't act on a failure). No retry, no queue.

**Logging on the server:** log a single line to `console.log` on each anomaly write so it appears in CloudWatch alongside other events: `[price-anomaly] JEPQ prior=58.12 new=116.40 delta=+100.3% household=<id>`.

### 5. Two source paths covered

The dashboard has two places that fetch live prices and assign them to `liveTickerPrice`:

| Location | When | Source |
|---|---|---|
| Initial mount + Refresh button | Page load + manual refresh | `fetchMarketData` calls `/api/market-data` for every ticker |
| Editing a ticker in the row form | After 1s debounce on `editForm.ticker` change | `useEffect` at `DashboardClient.tsx:161` |

**Detection + logging runs on both paths.** The edit-form path passes `source: 'edit-form-lookup'` to the log endpoint so forensic data captures both contexts.

**The visual `?` icon renders only on the dashboard table cell, not in the edit form.** The edit form is an interactive context where the user is actively reviewing the value as they type — adding a `?` next to a live `<input>` is noisy and offers no information they're not already seeing. The forensic log is what matters in the edit context; the cell-level flag is what matters in the table context.

### 6. Concentration sum (5G.2)

Single file: `src/app/dashboard/breakdown/ConcentrationSection.tsx`.

Current title (line 30):

```tsx
<h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Top 10 Holdings</h3>
```

Becomes:

```tsx
const totalPercent = rows.reduce((sum, r) => sum + (r.percent ?? 0), 0);

<h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
  Top {rows.length} Holdings
  <span className="text-neutral-500 dark:text-neutral-400 font-normal">
    {' · '}{totalPercent.toFixed(1)}% of portfolio
  </span>
</h3>
```

**Behavior:**

- Title says `Top N Holdings` where `N = rows.length` (handles cases with fewer than 10 holdings).
- Sum is a single decimal (`73.2%`), matching the per-row formatter at line 41 (`p.toFixed(1)`).
- Sum is rendered in a slightly muted weight (`font-normal`, `text-neutral-500`) so the section name stays the dominant element.
- If `rows.length === 0`, the existing chart already renders an empty state (the `ResponsiveContainer` shrinks to `200px`); the title reads `Top 0 Holdings · 0.0% of portfolio`. Acceptable; the empty state is rare (only at fresh-account state).
- On mobile (narrow viewport), if the title wraps, the `·` separator lands at the natural break and reads cleanly stacked.

## Testing

### Unit tests

**`src/app/dashboard/__tests__/priceAnomaly.test.ts` (new)** — pure logic helper extracted for testability:

```ts
function detectAnomaly(prior: number, next: number, threshold = 0.10): {
  isAnomaly: boolean;
  deltaPct: number;
} { ... }
```

Cases:
- prior 0 / null / undefined → not an anomaly regardless of next.
- next 0 / null → not an anomaly.
- prior 100, next 100 → not an anomaly (0%).
- prior 100, next 109 → not an anomaly (9%, just under threshold).
- prior 100, next 110 → IS an anomaly (exactly 10%).
- prior 100, next 90 → IS an anomaly (-10%, sign-agnostic).
- prior 58, next 116 → IS an anomaly (+100%).

### Component tests

**`src/app/dashboard/__tests__/DashboardClient.priceFlag.test.tsx` (new)** — focused on the Live $ cell:

- Renders `?` icon when `anomalies[ticker]` is present.
- No icon when the ticker has no anomaly.
- Tooltip text includes the prior price and signed delta percent.
- `aria-label` is present and matches.

**`src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx` (extend existing)**:

- Title shows `Top 10 Holdings · X.X% of portfolio` when 10 rows present.
- Title shows `Top 8 Holdings · X.X% of portfolio` when 8 rows present.
- Sum is correct to one decimal (rounding boundary check).

### Endpoint test

**`src/app/api/price-anomaly-log/__tests__/route.test.ts` (new)**:

- Authed user can POST a valid payload → 200, record present in DynamoDB mock with correct PK/SK.
- Unauthed request → 401.
- Missing required fields → 400.
- DynamoDB write failure → returns `{ ok: false }`, doesn't crash, doesn't throw.

### Manual QA checklist (staging deploy)

For 5G.1 (live-price gate):

- [ ] Open the dashboard. Note the price of any one asset.
- [ ] Open the row's edit form and manually set `Live $` to half the current value. Save.
- [ ] Click the global Refresh button.
- [ ] Confirm a small grey `?` appears next to the Live $ for that asset.
- [ ] Hover (desktop) / tap (phone) the `?`. Tooltip reads `Changed from $X.XX (+YY.Y%)`.
- [ ] Confirm in DynamoDB (or via console.log on staging) that a `PRICE_ANOMALY` record exists for the household with `rawYahooQuote` populated.
- [ ] Refresh again. The `?` should disappear (new price became the baseline; delta now 0).
- [ ] Reload the page. No `?` visible (state is session-only).
- [ ] Set a fresh asset's `liveTickerPrice` to 0 manually, refresh — confirm NO `?` appears (no baseline).

For 5G.2 (concentration sum):

- [ ] Open the Breakdown tab.
- [ ] Confirm the Top 10 Holdings title reads `Top 10 Holdings · X.X% of portfolio` and X.X equals the sum of the rows' percents.
- [ ] On a household with fewer holdings, confirm the count adapts (e.g., `Top 5 Holdings · 78.3% of portfolio`).
- [ ] On phone, confirm the title doesn't wrap awkwardly. If it does, the wrap point is acceptable (the `·` separator is the natural break).

## Risks & Open Questions

- **False-positive frequency — expected to be low.** Typical monthly-distribution covered-call ETFs (HMAX, QMAX, ZWG, HYLD) drop 1–2% on ex-div day, well under threshold. Even quarterly distributors typically drop 2–3%. Real `?` flags will mostly come from earnings surprises (occasional 10%+ moves on individual stocks like CM/GWO/COST), trading halts, post-split timing windows, and — the reason we're building this — actual data-feed bugs of the kind the PO observed. If after a few weeks of usage the log shows the threshold mis-calibrated for her specific holdings, we can tune up or down with a one-line change.
- **The actual root cause of the JEPQ-style 2x bug is still unknown.** This spec ships *instrumentation and awareness*, not a root-cause fix. Once the log captures a real incident with `rawYahooQuote`, a follow-up spec will diagnose (likely candidates: Yahoo returning a wrong-instrument symbol, a `.TO` lookalike, currency confusion). The follow-up may be no code change at all — just a Yahoo-side bug we have to live with — but at least we'll know.
- **No visibility into log unless someone queries DynamoDB.** Acceptable for now; surface a UI in a future spec if anomalies become a recurring conversation.

## Files Touched

| File | Change |
|---|---|
| `src/app/dashboard/DashboardClient.tsx` | Add `anomalies` state; integrate detection + log POST into `fetchMarketData` and the edit-form `useEffect`; render `?` next to the Live $ value in the **table cell only** (edit form is detect-and-log only). |
| `src/app/dashboard/lib/priceAnomaly.ts` *(new)* | Pure helper exporting `detectAnomaly(prior, next, threshold)`. |
| `src/app/dashboard/__tests__/priceAnomaly.test.ts` *(new)* | Unit tests for the helper. |
| `src/app/dashboard/__tests__/DashboardClient.priceFlag.test.tsx` *(new)* | Component test for the cell render. |
| `src/app/api/price-anomaly-log/route.ts` *(new)* | `POST` endpoint, DynamoDB write. |
| `src/app/api/price-anomaly-log/__tests__/route.test.ts` *(new)* | Endpoint test. |
| `src/app/dashboard/breakdown/ConcentrationSection.tsx` | Title becomes `Top N Holdings · X.X% of portfolio`. |
| `src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx` *(extend or add)* | Title content tests. |
| `src/types/index.ts` (or equivalent) | Add `PriceAnomalyRecord` type if useful for the endpoint. |

## What happens after this ships

The PO refreshes, sees `?` on any wonky tickers, eyeballs, and decides whether to manually correct. Over weeks of normal usage, the anomaly log accumulates real incidents. When the next 2x bug surfaces, the implementer queries DynamoDB for the household's `PRICE_ANOMALY#…` records, finds the relevant entry, and inspects `rawYahooQuote` to identify the actual root cause — at which point a follow-up spec proposes the targeted fix (or, if it's purely a Yahoo upstream bug, documents that we cannot fix it client-side and accept the flag as the permanent mitigation).
