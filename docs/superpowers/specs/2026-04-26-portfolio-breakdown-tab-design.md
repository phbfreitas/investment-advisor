# Portfolio Breakdown Tab — Design Spec

**Status:** Draft
**Author:** Paulo (with Claude)
**Date:** 2026-04-26

---

## 1. Background

The "My Investment Portfolio" page (`/dashboard`) currently shows a single 1062-line client component with a holdings table — list of every asset with filters, sorting, and inline edit. The product owner has requested a complementary **breakdown view**: portfolio composition presented as charts, plus factual takeaways.

The reference screenshot from the product owner shows six donut charts (Region, Sector, Strategy, Asset Type, Risk, Currency). The user — who accesses the app **primarily on mobile** — also wants the feature to go beyond donuts and provide concentration analysis and drift signals as additional value.

This spec is for v1 of that feature.

---

## 2. Goals & Non-Goals

### Goals

- Add a second sub-tab to `/dashboard` named **"Breakdown"** alongside the existing **"Holdings"** view.
- Surface portfolio composition through six donut charts mapping to existing `Asset` fields.
- Add concentration insights: top-10 holdings bar chart and a weighted dividend yield card.
- Surface factual concentration alerts (no advisory tone) using hardcoded heuristic thresholds.
- Mobile-first: the product owner's primary device is a phone.
- Pure derivation — no new API endpoints, no new DynamoDB writes. All computed client-side from existing `assets[]` state.

### Non-goals (explicitly out of scope for v1)

- Time-series / historical snapshots (would require snapshot infrastructure).
- AI-narrated commentary (the original "Layer C"). Advisory content lives elsewhere in the app and shouldn't overlap.
- User-configurable thresholds (Settings UI). Hardcoded for v1; comment in code says "make configurable if users complain."
- Target allocations & target-vs-actual drift (would require new data model).
- Cross-tab filter linking (tap a chart → filter Holdings). Plausible follow-up but not v1.
- Treemap visualizations.

---

## 3. User Experience Model

The Breakdown tab presents three sections, each with a distinct purpose. The clear separation of concerns is the explicit design intent — the user must always know which mental mode they're in:

1. **Composition** — *What do I own?* Six donut charts.
2. **Concentration** — *How concentrated am I?* Top-10 holdings bar + Weighted yield card.
3. **Drift Signals** — *What needs my attention?* Factual heuristic alerts.

All content is **factual** — no advice, no recommendations. Advisory content belongs in other parts of the app (e.g., AI Guidance Engine).

---

## 4. Architecture

### 4.1 Routing & tab structure

- Page stays at `/dashboard`. Header still reads "My Investment Portfolio".
- Two sub-tabs directly below the page header:
  - **Holdings** (default; current table view; no functional changes)
  - **Breakdown** (new)
- Tab state persisted via `?tab=holdings|breakdown` query parameter for deep-linkability. Defaults to `holdings`.
- Tab UI: simple text buttons with bottom-border active indicator. ARIA `role="tab"`, `aria-selected`, full keyboard support (←/→ to navigate, Enter/Space to activate).

### 4.2 File layout

```
src/app/dashboard/
  DashboardClient.tsx          # refactored — wraps children in PortfolioTabs shell, no other behavior change
  PortfolioTabs.tsx            # NEW — renders the 2 tab buttons, manages active state via query param
  HoldingsTab.tsx              # NEW — extracted from DashboardClient (the existing holdings table)
  breakdown/
    BreakdownTab.tsx           # NEW — orchestrates the 3 sections + empty/loading/error states
    CompositionSection.tsx     # NEW — 6 donuts grid
    ConcentrationSection.tsx   # NEW — Top 10 bar + Weighted Yield card
    DriftSignalsSection.tsx    # NEW — heuristic alerts list
    lib/
      computeBreakdowns.ts     # NEW — pure: assets[] → grouped { dimension: { label, value, percent }[] }
      computeTopHoldings.ts    # NEW — pure: assets[] → sorted holdings with "+ other" rollup
      computeWeightedYield.ts  # NEW — pure: assets[] → { yieldPct, projectedAnnualIncome, incomeVsCapital }
      computeDriftSignals.ts   # NEW — pure: assets[] → DriftSignal[]
      thresholds.ts            # NEW — hardcoded threshold constants + base-currency/region detection
      colors.ts                # NEW — shared 12-color palette, deterministic mapping (string → color)
```

The split also serves a targeted improvement: `DashboardClient.tsx` is already 1062 lines doing too much. Adding the breakdown inline would push it past 1500. Extracting `HoldingsTab.tsx` cleanly along the tab boundary keeps each file focused.

### 4.3 Chart library

Add **[Recharts](https://recharts.org)** as a dependency.

- Most popular React charting library; declarative; first-class touch tooltip support (matters for the mobile-first requirement).
- Tailwind-friendly (composes with `className`).
- Trade-off: ~95KB gzipped — acceptable for a feature this central. Lazy-load the breakdown route if bundle growth becomes a concern.
- Alternatives considered: Tremor (overkill — adds a layer of opinionated components for primitives we don't need); pure SVG/CSS donuts (rebuilding tooltips, legends, accessibility, and responsive sizing is incidental work that bloats the feature).

### 4.4 Data computation

- All client-side. Pure functions in `breakdown/lib/`. Each consumes `Asset[]` and returns a deterministic view model.
- All derivations memoized in `BreakdownTab` via `useMemo`, keyed on the `assets` reference. No re-computation on tab switches.
- No new API endpoint, no new DynamoDB write paths.

---

## 5. Section-by-section design

### 5.1 Composition section

Heading: "**1 · Composition**".

**Six donut charts** — each grouped on an existing `Asset` field, sliced by **value** (sum of `asset.value` per group ÷ portfolio total). Weighting by value, not asset count, prevents one penny stock from distorting the chart.

| # | Title | Field |
|---|---|---|
| 1 | By Region | `asset.market` |
| 2 | By Sector | `asset.sector` |
| 3 | By Strategy | `asset.call` |
| 4 | By Asset Type | `asset.securityType` |
| 5 | By Risk | `asset.risk` |
| 6 | By Currency | `asset.currency` |

**Per-donut anatomy:**
- Title (e.g. "By Sector").
- Donut chart with center hole. The hole always shows the **portfolio total $** (consistent across hover/tap states). Slice details ($ + %) appear in a Recharts tooltip on hover (desktop) or tap (mobile).
- Legend — beside the donut on desktop, below on mobile.
- A single factual bullet under the chart, generated mechanically: *"Largest: USA · 50% · $122,500"*. Strictly factual, never advisory.

**Layout (responsive grid):**
- Desktop ≥1024px: 3 columns × 2 rows.
- Tablet 640–1023px: 2 columns × 3 rows.
- Mobile <640px: 1 column × 6 rows.

**Edge cases:**
- Empty/null field on an asset → grouped under "Uncategorized" (gray slice).
- Single-slice donut (e.g. 100% USD) → solid ring, one legend entry. No special "monolith" state.
- Empty portfolio → entire Breakdown tab shows the empty state (§5.4).

### 5.2 Concentration section

Heading: "**2 · Concentration**". Two complementary views: which positions matter (Top 10 bar) and what they yield (Weighted Yield card).

**Top 10 Holdings — horizontal bar chart.**

Horizontal bars chosen because ticker labels read flat without rotation/truncation on mobile.

- Sorted descending by `asset.value`.
- Each bar shows: ticker (left), value bar, $ value + % of portfolio (right).
- Bar color reflects the holding's `call` (Dividend / Growth / Mix), using `colors.ts`. Gives an at-a-glance secondary read.
- Tap a bar → bottom sheet with full detail (account, sector, currency, full $ value). Bottom sheet, not modal — feels native on mobile, dismissible by swipe-down.
- Holdings beyond top 10 → summed into a final "+ N other holdings" gray bar. Keeps totals honest.
- Bars ≥36px tall for thumb tap targets.
- Fewer than 10 holdings → render whatever exists, no "+ other" footer.

**Weighted Yield card.**

Stacks below the bar chart on mobile (full-width); sits to the right of it on desktop.

- Big number: weighted dividend yield. Example: **3.2%**.
- Subtitle: *"Projected annual income: **$3,920**"* — computed from `Σ(asset.value × asset.dividendYield)`.
- Secondary stat: *"Income vs Growth split: **$3,920 income / $118,580 capital**"* — dollar breakdown of the strategy donut.
- If no holdings have a yield → card shows "No yield data" and the projected income line is hidden (zero is misleading, not informative).

### 5.3 Drift Signals section

Heading: "**3 · Drift Signals**". Color-accented amber to mark the boundary between factual breakdown and "things to look at."

**Alert anatomy.** Each alert is a single tappable row, sorted by severity (red → amber → gray). Row contains:
- Severity icon (red dot / amber triangle / gray circle).
- One-line title — declarative fact, not advice. Examples: *"AAPL is 14% of portfolio"*, *"Banking sector concentrated at 35%"*.
- Threshold reference in muted text (*"threshold: 10% (red), 5% (warn)"*) — transparency about what triggered.
- Tap → expand in place to show contributing assets (ticker + $ + %). Accordion, not navigation, not modal.

**Severity tiers and thresholds.**

| Tier | Rule | Threshold |
|---|---|---|
| Red flag | Single stock concentration | holding > 10% of portfolio total |
| Red flag | Sector concentration | sector > 40% of portfolio total |
| Warning | Single stock concentration | holding > 5% of portfolio total |
| Warning | Sector concentration | sector > 25% of portfolio total |
| Warning | Region concentration | region > 70% of portfolio total |
| Warning | Currency exposure | non-base currency > 30% of portfolio total |
| Informational | Account skew | single account > 80% of portfolio total |
| Informational | Cash drag | Defensive sectors > 40% of portfolio total |

**"Base" detection.** Since there's no "home currency" or "home region" setting, the **largest-weighted** currency is treated as base; same for region. Documented in `thresholds.ts` for transparency. Catches dual-exposure FX risk meaningfully.

**"Defensive sectors" definition.** A constant `DEFENSIVE_SECTORS` in `thresholds.ts` matches `asset.sector` values case-insensitively against `["Cash", "Bond", "Bonds", "Money Market", "Treasury", "Treasuries"]`. The list is documented inline so the rule is transparent and easily extended. If a user's portfolio uses a different label (e.g., "Fixed Income"), the alert simply won't fire — acceptable for v1; the constant can be expanded as labels surface.

**Empty state — no alerts triggered.** Single positive note: *"No concentration risks detected at current thresholds"* with the active thresholds listed underneath. **Not** an "all clear, you're done" message — it's "the rules we check didn't fire," which is more honest.

**Edge cases.**
- Empty portfolio → entire Breakdown tab shows the empty state (§5.4); Drift Signals not rendered.
- Portfolio total = $0 (e.g., all market values zero) → Drift Signals skipped with section-level note "Insufficient market data."
- Asset with `value = null` or `NaN` → excluded from concentration math; logged via existing `auditToast` infrastructure.

### 5.4 Cross-cutting states

| State | Trigger | Render |
|---|---|---|
| Loading | `isLoading === true` | Same skeleton style as Holdings tab — keeps tab transitions calm |
| Empty | `assets.length === 0` | Centered card: *"Your portfolio is empty. Import holdings on the Holdings tab to see your breakdown."* with a tab-switch button |
| Stale market data | Existing market-data warning logic fires | Section-level subtle banner under the tab bar: *"Some values may be stale — refresh on Holdings tab"* |
| Healthy | Assets present, market data present | Full Composition + Concentration + Drift Signals |

---

## 6. Mobile-first specifics

The product owner accesses the app primarily on mobile. Across the entire tab:

- **Tap-to-reveal** over hover-only interactions (donut tooltips, bar details, alert expansion).
- All tap targets ≥44px (WCAG).
- Vertical stacking by default. Multi-column grids only where they help.
- Bottom-sheet pattern for detail views, not centered modals.
- No drag/swipe gestures required to surface any primary content.
- Text scales with system settings; donut/bar sizes use viewport-relative units where appropriate.
- Visual review during implementation will use the `frontend-design` skill to ensure polish and avoid generic dashboard aesthetics.

---

## 7. Accessibility

- Each donut/bar chart paired with a hidden `<table>` containing the same data, keyboard-reachable for screen readers.
- Tab buttons: `role="tab"` + `aria-selected`, full keyboard nav (←/→, Enter/Space).
- Alert rows: `<button>` with `aria-expanded` reflecting accordion state.
- Color is never the only signal — severity icons differ in shape, not just color.
- Focus styles use existing `focus-visible:ring-teal-500` token.

---

## 8. Testing

### Unit tests (Jest, pure functions)

- `computeBreakdowns.test.ts` — happy path; missing fields → "Uncategorized"; value weighting (not count); empty input.
- `computeTopHoldings.test.ts` — ≤10 holdings; >10 holdings (verifies "+ N other" rollup); tied values; zero-value handling.
- `computeWeightedYield.test.ts` — mixed-yield holdings; all-zero yield; missing yield fields; division-by-zero guards.
- `computeDriftSignals.test.ts` — each threshold tier individually; combined fires; empty portfolio; well-diversified portfolio (no fires); base-currency/region auto-detection.

### Component tests (React Testing Library)

- `PortfolioTabs.test.tsx` — switching tabs updates query param; initial state from query param; keyboard navigation between tabs.
- `BreakdownTab.test.tsx` — empty state, loading state, healthy state with fixture data.
- `DriftSignalsSection.test.tsx` — alert sort order by severity; accordion expand/collapse; empty-state message.

### Mobile smoke (manual, before merge)

- Open in mobile viewport (Chrome DevTools mobile emulation + real device check).
- Tap-test every interaction: donut slices, bar rows, alert rows.
- Verify bottom-sheet dismissal, accordion state retention, tab switching.

---

## 9. Future iterations

Listed here so v1 boundary stays explicit and these don't sneak into the implementation plan:

- Time-series / historical snapshots — portfolio value trend, allocation drift over time, realized vs unrealized gain/loss breakdown.
- User-configurable thresholds in Settings.
- Target allocations & target-vs-actual drift indicators.
- Cross-tab filter linking (tap a sector slice → opens Holdings tab filtered to that sector).
- Treemap visualization (sector × company).
- Account skew breakdown for tax-aware decisions (TFSA / RRSP / Margin etc.).

---

## 10. Open questions

None — all design decisions are settled. Implementation plan can be drafted directly from this spec.
