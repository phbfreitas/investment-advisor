# Phase 5 Prioritization Breakdown — Design

**Date:** 2026-05-03
**Author:** Paulo + Claude (brainstorming session)
**Status:** Approved breakdown; per-sprint plans to follow via `superpowers:writing-plans`

## Purpose

Decompose Simone's eight-module PO list into six independently-shippable sub-projects (5A–5F), with explicit scope, dependencies, and sequencing. 5G already shipped (exchange-aware ticker routing).

This document is the canonical breakdown. It replaces any prior chat-only breakdown that did not survive in a durable artifact.

## Source material

Simone's eight-module list (verbatim from her 2026-04-27 PO feedback):

1. **Module 1** — Holdings Table (sticky header, first-row filters, true inline editing, global decimal removal with exceptions, tablet layout fit)
2. **Module 2** — Multi-Currency Logic (USD assets stay USD in rows; only top totals convert to CAD; daily FX rate)
3. **Module 3** — Dividend Summary (per-ticker breakdown, 12-month projection chart, Finance Summary auto-sync)
4. **Module 4** — My Blueprint / Investment Strategy (sector & geography categories synced from Holdings, geographic nomenclature standardization, Target vs Actual)
5. **Module 5** — Visual Identity and Charts (full chart sync with Holdings, central donut alignment, privacy button, mandatory color palette)
6. **Module 6** — Intelligence and Guru (Guru reads complete strategy, Global News stale-2024 bug fix, maximize option for tablet reading)
7. **Module 7** — System Bug Fixes (PDF import wrong quantities #1; live price doubled #2 SHIPPED; Concentration sum #3 SHIPPED)
8. **Module 8** — Source of Truth (Holdings Table is the only basis; all charts derive from it)

Folded-in backlog items from prior sprints:

- **3A deferred follow-ups** (4 items surfaced during 5G adversarial-review cycle):
  - Item 1 — Edit-mode PUT bypasses optimistic concurrency (HIGH, ~3-4h)
  - Item 2 — `EncryptedDocumentClient` advertises Update support but bypasses encryption (HIGH forward-looking, ~1-2h runtime guard / 4-6h full handling)
  - Item 3 — Ticker lookup carries old symbol's data into new symbol (HIGH, ~1-2h)
  - Item 4 — Lock PATCH returns 500 after the write committed (MEDIUM, ~1h)

## Prioritization approach chosen

**Approach 2 — Reshuffled by code area** (chosen over "one module per sprint alphabetical" and "two big phases").

Key insight: the natural cuts in Simone's modules are by **code area**, not by alphabetical label.

- Module 1 (Holdings UX) and Module 2 (Multi-currency display) live in the same React component cluster — bundling avoids touching the same file in two separate sprints with two separate reviews.
- Module 8 (Source of Truth) and the 3A backlog all touch the data-trust layer — bundling buys one comprehensive correctness audit instead of two partial ones.
- Module 4 (Blueprint sync) touches Strategy-page code, not Holdings code, so it gets its own sprint.
- Module 5 (Visual Identity) depends on canonical categories from Module 4 (Blue=US, Red=Canada, Grey=Other are semantic), so 5D follows 5C.

## Sprint mapping

| Sprint | Label | Underlying modules | Code area |
|--------|-------|--------------------|-----------|
| **5A** | Foundations | Module 8 + Module 7 #1 + 3A backlog (4 items) | Data-trust layer |
| **5B** | Holdings Table | Module 1 + Module 2 | `HoldingsTab`, `DashboardClient`, decimal-formatting helpers |
| **5C** | Blueprint Sync | Module 4 | Strategy/profile page |
| **5D** | Visual Identity | Module 5 | `breakdown/lib/colors.ts`, all chart components, dashboard chrome |
| **5E** | Dividends | Module 3 | New dividend section + Finance Summary integration |
| **5F** | Guru | Module 6 | `/api/guidance`, `/api/global-radar`, `src/lib/news.ts`, prompt templates |
| ✅ 5G | (shipped) | — | exchange-aware ticker routing |

## Per-sprint scope

### 5A — Foundations (data trust layer) — GATING

**Goal:** Make the numbers correct and the source-of-truth wiring complete. Everything downstream relies on this.

**In scope:**

| Item | Source | Severity / Size |
|------|--------|-----------------|
| Module 8 — Holdings Table is the only source for charts | Module 8 | Wiring + audit |
| Module 7 #1 — PDF import quantity bug (VGT etc.) | Module 7 | HIGH, ~3-5h |
| 3A Item 3 — Ticker lookup carries old symbol's data into new symbol | Backlog | HIGH, ~1-2h |
| 3A Item 1 — Edit-mode PUT bypasses optimistic concurrency | Backlog | HIGH, ~3-4h |
| 3A Item 2 — `EncryptedDocumentClient` advertises Update support but bypasses encryption | Backlog | HIGH (forward-looking), ~1-2h runtime guard / ~4-6h full |
| 3A Item 4 — Lock PATCH returns 500 after the write committed | Backlog | MEDIUM, ~1h |

**Source-of-truth audit deliverables:**

- Verify `BreakdownTab` and all donut/pie/bar charts read from the same `assets[]` array as `HoldingsTab`.
- No chart reaches into a parallel data store, derived snapshot, or stale memo.
- Document the data flow (API → page → both tabs → charts) in this specs folder.

**Out of scope (defer):** Holdings UX changes (5B), categorical sync rules (5C), color/visual changes (5D).

**Definition of done:**

- All six items above land green with adversarial-review pass.
- Short data-flow doc lives in `docs/superpowers/specs/` for future contributors.
- No new HIGH-severity adversarial findings in the data-trust layer.

**Estimated effort:** 2-3 days implementation + adversarial-review cycle.

### 5B — Holdings Table (UX + Multi-Currency)

**Goal:** Make the Holdings table itself feel right. Inline editing for everything, filters in the header row, decimals controlled, currency preserved.

**In scope — Module 1:**

| Item | Notes |
|------|-------|
| Sticky header / freeze row | Verify current state; lock title row to viewport top during vertical scroll |
| First-row filters | Search input or dropdown selector per column directly in title row |
| True inline editing | Edit qty, prices, all editable fields directly in cells. No "edit mode" detour. (Exchange already does this — extend the pattern) |
| Global decimal rule | App-wide: 0 decimals on prices, quantities, totals |
| Decimal exceptions | Yield %, 1YR Return %, 3YR Return % → 1 decimal (`4.5%`); Total Return & Avg Dividend Yield at top → 2 decimals |
| Tablet fit | Total Market Value boxes at top must contain their numbers cleanly on tablet widths (no overflow) |

**In scope — Module 2:**

| Item | Notes |
|------|-------|
| USD assets stay USD | American holdings show Book Cost and Market Value in native currency in every row. No auto-CAD-conversion at row level |
| Top totals convert to CAD | The single "Total Market Value" badge at top of Holdings is the only place that aggregates to CAD using daily FX |
| Daily FX rate | Reuse `src/lib/fxRate.ts` shipped in 5G |

**Already partially shipped (verify, don't redo):**

- `computePortfolioTotals` with CAD/USD split (commit `fa7db0e`)
- FX rate utility (commit `4cb5656`)
- Exchange column inline edit pattern (commit `079c501`)
- Manage Columns popover (commit `65d26a2`)

**Out of scope (defer):** Chart synchronization (5A), color palette (5D), categorical re-naming (5C).

**Definition of done:**

- Every column is filterable, sortable, or both.
- Tapping any editable cell on phone/tablet enters inline edit, no detour through "edit mode."
- Decimal rules audited across the app (Finance Summary, Breakdown tooltips, Strategy page) — separate sub-task.
- Total Market Value box renders cleanly at iPad-portrait width.
- USD assets show USD in their rows; CAD-equivalent only at the top.

**Estimated effort:** 3-4 days. Filter UI is the largest piece.

### 5C — Blueprint Sync (Strategy page)

**Goal:** Make the My Blueprint / Investment Strategy page reflect Holdings Table reality with standardized category names and a Target vs Actual that uses the same data as everything else.

**In scope — Module 4:**

| Item | Notes |
|------|-------|
| Sector synchronization | Sector Allocation breakdown on Strategy page derives from Holdings (same categorical pipeline 5A wired up). User-defined Targets stay user-controlled; Actuals come from Holdings |
| Geographic synchronization | Same rule for Geographic Exposure |
| Geographic nomenclature standardization | Canonical category set in **Strategy Breakdown**: `US`, `Canada`, `Global`, `North America`. Replace `Global Mix` → `Global` everywhere |
| "Other" rollup | In Strategy Breakdown only, anything outside the four canonical categories sums into a single `Other` bucket |
| Other allocation categories elsewhere | Four-category rule is **specific to Strategy Breakdown**. Other charts may keep richer category sets |
| Target vs Actual chart | Actual column pulled from Holdings Breakdown — same `computeBreakdowns` output 5A wires up. No parallel calculation |

**Out of scope (defer):** Color palette tied to these categories (5D), general visual polish (5D), privacy button (5D).

**Dependencies on 5A:** Module 8 source-of-truth wiring must be done.

**Definition of done:**

- Strategy page shows Sector Actuals + Geo Actuals computed from Holdings.
- Strategy Breakdown only ever shows the four canonical geographic categories + `Other`.
- `Global Mix` is gone from the codebase and the UI.
- Adversarial review confirms user-defined Target inputs aren't accidentally wired to Holdings (Targets remain editable user state).

**Estimated effort:** 2-3 days.

### 5D — Visual Identity (charts + colors)

**Goal:** Apply Simone's mandatory color palette across every chart, fix the donut centering bug on tablets, add a privacy toggle, and confirm chart re-render reactivity now that 5A wired everything to Holdings.

**In scope — Module 5:**

#### Mandatory color palette

The palette is **hybrid**: four colors are **semantic** (locked to specific labels regardless of slice rank); the remaining six are **rank-based** (assigned to non-semantic slices in size-descending order).

**Semantic colors (always applied when the label appears):**

| Color | Reserved for | Notes |
|-------|--------------|-------|
| Blue | `US` | applies anywhere a slice is labeled `US` |
| Red | `Canada` | applies anywhere a slice is labeled `Canada` |
| Orange | `Not Found` | mandatory; applies anywhere `Not Found` appears |
| Grey | `Other` | mandatory; applies to the `Other` rollup bucket (5C's Strategy Breakdown rollup, the existing `<5%` `Others` rollup, etc.) |

**Rank-based colors (applied to remaining slices in size-descending order):**

| Rank among non-semantic slices | Color |
|-------------------------------|-------|
| 1st (largest) | Dark Green |
| 2nd | Pink |
| 3rd | Purple |
| 4th | Dark Yellow |
| 5th | Light Blue |
| 6th | Light Green |

**Reference to Simone's original spec:** the 10-color order Simone provided maps to the canonical positions Blue (1), Red (2), Dark Green (3), Orange (4), Pink (5), Purple (6), Dark Yellow (7), Grey (8), Light Blue (9), Light Green (10). The hybrid rule above preserves all four semantic anchors and walks the remaining six in rank order.

**Implementation rule:**
1. For each chart, identify slices whose label is `US`, `Canada`, `Not Found`, or `Other` and assign them their semantic color.
2. Sort remaining slices by value descending.
3. Assign Dark Green → Pink → Purple → Dark Yellow → Light Blue → Light Green to the sorted remaining slices.
4. Never repeat or use near-shades within a single chart.

This replaces both `paletteFor` (hash-based, can collide) and `paletteByIndex` (sequential, ignores semantics) in `src/app/dashboard/breakdown/lib/colors.ts`.

**Constraint:** charts with only 4 or 5 slices must use clearly distinct hues — no near-shades in the same chart. Tests will assert this.

#### Donut centering

| Item | Notes |
|------|-------|
| Center alignment fix | Total portfolio value text in donut center is misaligned on tablet widths. Likely an absolute-positioning / flex-centering bug specific to viewports between phone and desktop. Repro on iPad-portrait, fix the CSS |

#### Privacy button

| Item | Notes |
|------|-------|
| Hide-values toggle | Eye-icon button that masks every dollar/currency amount in the dashboard: donut-center totals, Top Holdings dollar amounts, Total Market Value at the top of Holdings, table cells in Book Cost / Market Value / Profit-Loss / Expected Annual Dividends columns. Percentage values (yield %, return %, slice %, allocation %) remain visible — they don't disclose net worth. State is per-session, not persisted (closing/reopening the app shows real numbers by default) |

#### Chart sync verification

| Item | Notes |
|------|-------|
| Reactivity audit | After 5A merged Holdings as source-of-truth, edit a value in the Holdings table and verify EVERY chart updates without a page refresh: Sector, Geography, Concentration, Strategy, Currency, Asset Type, Call. Add an integration test for at least one chart |

**Out of scope (defer):** Strategy page categorical synchronization (5C), dividend chart (5E).

**Dependencies on 5A and 5C.**

**Definition of done:**

- New `colorForSlice(label, position)` function in `colors.ts` implements the hybrid rule. Old `paletteFor` removed.
- Unit tests assert: `US` always blue; `Canada` always red; `Not Found` always orange; `Other` always grey; non-semantic slices walk the positional palette by descending size.
- Donut center renders correctly at iPad-portrait, iPad-landscape, phone-portrait, desktop.
- Privacy toggle hides all dollar amounts; toggling back restores them.
- Manual reactivity check + one integration test prove charts re-render on Holdings edits.

**Estimated effort:** 3-4 days.

### 5E — Dividends

**Goal:** Add a detailed dividend section to the Portfolio dashboard, project dividends month-by-month for the next 12 months, and auto-populate the Finance Summary's Dividends field from the portfolio's monthly average.

**In scope — Module 3:**

#### Per-ticker dividend breakdown

| Item | Notes |
|------|-------|
| Asset-level breakdown view | New section on Holdings dashboard showing each ticker with: ticker, expected annual dividend ($), expected monthly average ($), payment frequency. Sorted by annual dividend descending. Only includes tickers with non-zero `expectedAnnualDividends` |
| Total row | Sum at the bottom: total annual dividends + total monthly average |

#### 12-month projection chart

| Item | Notes |
|------|-------|
| Line chart | X-axis: next 12 calendar months starting from current month + 1 (per Simone's example: in April, show May → April of next year). Y-axis: total expected dividends across all holdings for that month |
| Per-asset payment schedule | Each asset projects dividends into months using `expectedAnnualDividends`, `exDividendDate`, and inferred frequency |
| Stack visualization | Optional — line chart alone is the must-have. If straightforward, color each month by top 5 contributing tickers + Other. Defer if it adds complexity |

#### Finance Summary synchronization

| Item | Notes |
|------|-------|
| Auto-populate `budgetDividends` | Finance Summary > Income > Dividends becomes a derived display tied to `Total Annual Dividends / 12` from the portfolio |
| Override behavior | User can still manually override; manual-override flag preserves user input on portfolio refresh. Default behavior is auto-populate |
| UX cue | Indicate "Auto-populated from portfolio" beside the field when tracking; show a small "reset to auto" link when manually overridden |

**Open question — payment frequency inference:**

Yahoo Finance returns annual dividend amount but not always frequency. Three approaches for the 12-month projection:

- **(a) Heuristic by security type** — quarterly for individual stocks, monthly for income ETFs, annual for some funds. Cheap, ~80% accurate. **Default for first ship.**
- **(b) Infer from dividend history** — call `yahoo-finance2` historical-dividends endpoint, detect cadence from past 12-24 months. More accurate, more code, more API calls.
- **(c) User-editable per-asset frequency field** — add a `dividendFrequency` column the user can set; default heuristic with override. Most accurate long-term, more UI work.

Default to **(a)** for first ship; (c) as fast-follow if Simone calls out missed projections; (b) is overkill for a first cut. Lock the choice during writing-plans.

**Out of scope (defer):** Tax-aware after-tax dividend projections; currency-aware projections (mirror Holdings table currency rule); dividend reinvestment modeling.

**Dependencies on 5A.**

**Definition of done:**

- Per-ticker dividend breakdown table renders below or beside the Holdings table.
- 12-month projection chart renders with at least heuristic frequency inference (approach a).
- Finance Summary's Dividends field auto-populates from portfolio monthly average; manual override preserved across refreshes.
- Tests cover: monthly projection math, leap-year edge case, ex-dividend date in past month, frequency-fallback for missing data.

**Estimated effort:** 4-5 days.

### 5F — Guru (Intelligence)

**Goal:** Make the Guru actually read Simone's strategy before opining, fix the stale-news bug, and let reports go fullscreen on tablets.

**In scope — Module 6:**

#### Guru reads complete Investment Strategy

| Item | Notes |
|------|-------|
| Strategy injection audit | `/api/guidance/route.ts` already builds `buildFullUserContext` and pulls META profile. Verify what subset of the strategy actually lands in the prompt. Particularly: detailed strategy sub-fields (target sector allocation, target geographic allocation, value-based criteria, event-driven criteria, risk tolerance) must all be in the system prompt, not just summarized |
| Mandatory inclusion contract | Strategy section becomes a non-negotiable block in the prompt template. Guru is instructed that recommendations contradicting the user's stated strategy must be flagged or refused, not silently overridden |
| Test | Assert the strategy block is present in the assembled prompt for at least the 6 directives we ship today |

#### Global News stale-2024 bug

| Item | Notes |
|------|-------|
| Root-cause investigation | `src/lib/news.ts` calls NewsData.io's `latest` endpoint with a `q=` query. Candidates for staleness: cached `news#YYYY-MM-DD` row from 2024 not invalidating; NewsData.io returning stale results for sparse keywords; date filter or fallback path silently returning old data |
| Fix and verify | Whatever the root cause, fix must include a date-bounded check that rejects articles older than N days, and a cache-key sanity test (`getCachedOrFreshNews` shouldn't serve a 2-year-old cache row as "today") |
| Real-world content check | Simone called out the Iran war as current reality the news isn't reflecting. Manually verify the radar surfaces topical 2026 content for at least three currently-active geopolitical/financial themes after the fix |

#### Maximize option for reports

| Item | Notes |
|------|-------|
| Fullscreen toggle | All Guru directive outputs and Global Radar reports get a "maximize" / "expand" button. On click, panel takes the full viewport with a close-X. Optimized for tablet readability — Simone's primary device |
| Scope | Apply consistently to every long-form report surface: directives, market commentary, strategy reviews, anything currently rendered in a modal or constrained container |

**Out of scope (defer):** New AI directives beyond the existing 6; news-source migration (only consider if root-cause fix doesn't hold); persona work (separate track).

**Dependencies on 5A and 5C** (soft — strategy block reads cleanest after categorical names settle, but can run in parallel with 5C if the block is field-agnostic).

**Definition of done:**

- Strategy block appears verbatim in every assembled directive prompt; integration test locks this in.
- Global News surfaces fresh (≤7-day-old) articles consistently; cache-row date stamps verified.
- Every report surface has a fullscreen toggle; manual QA pass on iPad-portrait + iPad-landscape.

**Estimated effort:** 2-3 days.

## Dependencies and sequencing

### Dependency graph

```
            ┌──────────────┐
            │5A Foundations│  ◀── GATING
            └──────┬───────┘
                   │
        ┌──────────┼──────────┬──────────┐
        ▼          ▼          ▼          ▼
   ┌────────┐ ┌─────────┐ ┌────────┐ ┌────────┐
   │5B      │ │5C       │ │5E      │ │5F      │
   │Holdings│ │Blueprint│ │Dividend│ │Guru    │
   └────────┘ └────┬────┘ └────────┘ └────────┘
                   │
                   ▼
              ┌─────────┐
              │5D       │
              │Visual   │
              └─────────┘
```

**Hard dependencies:**

- 5A blocks everything (data trust, source-of-truth wiring).
- 5C blocks 5D (semantic colors need canonical category names).

**Soft dependencies (nice-to-have order, not blocking):**

- 5B before 5D — easier to test chart reactivity once table is final.
- 5C before 5F — Guru strategy block reads cleanest after categorical names settle, but 5F can run in parallel if the Guru block is field-agnostic.

### Recommended serial order

**5A → 5B → 5C → 5D → 5E → 5F**

Dependency-respecting and matches the alphabetical labels. Safe default if only one sprint runs at a time.

### Recommended parallel order (Codex track)

```
Track 1 (Paulo): 5A → 5B → 5D → ...
Track 2 (Codex):     wait for 5A → 5C → 5E → 5F
```

5A must finish before any parallel track starts. Two tracks both editing data-trust code = merge hell.

### Adversarial-review cadence

Per global instructions (`/codex:adversarial-review` at end of every implementation cycle): one review pass at the end of each of the six sprints. 5A's review is the most consequential — adversarial findings on the data layer block downstream sprints from starting.

## Parking lot (explicitly out of scope)

Only items raised during this brainstorm or already-active backlog land here. Speculative future-extensions of these features are NOT listed — adding them would dilute the parking lot and create false work-shaped objects.

| Item | Why parked | Where it might live later |
|------|------------|---------------------------|
| Total Return timeline filter (item 5.2 from 2026-04-27 PO triage) | Requires daily portfolio snapshots + historical price ingestion + time-weighted return — multi-week heavy lift on its own | Future Phase 6 |
| Per-asset `dividendFrequency` user-editable field | 5E first ship uses heuristic frequency inference; user-editable is the fast-follow if heuristic accuracy is poor in production | 5E.2 (contingent) |
| Stack visualization on dividend projection chart | Line chart is the must-have for 5E; per-month stacked-by-ticker visualization is nice-to-have | 5E.2 (optional) |

## Process notes

- Each sprint runs the standard cycle: writing-plans → executing-plans (or subagent-driven-development) → adversarial-review → ship.
- The full design here is the prioritization spec. Each sprint will get its own design spec when its turn comes (e.g., `2026-MM-DD-5a-foundations-design.md`).
- 5G already shipped as the "exchange-aware ticker routing" sprint and is referenced as prior work for 5B (FX utility, exchange column, column visibility).

## Cross-references

- Prior PO triage: `docs/superpowers/triage/2026-04-27-po-feedback-triage.md`
- 3A deferred follow-ups: `docs/superpowers/triage/2026-04-30-3A-deferred-followups.md`
- 5G design and plan: `docs/superpowers/specs/2026-05-03-exchange-aware-ticker-routing-design.md`, `docs/superpowers/plans/2026-05-03-exchange-aware-ticker-routing.md`
- Memory: `project_phase5_breakdown.md`, `feedback_persist_breakdown_artifacts.md`

## Plain-language summary for Simone

Hi Simone — here are the parts of this plan in everyday words.

### What we're doing, in order

1. **5A — Make the numbers right.** Fix the PDF import bringing in wrong share quantities, fix some rare bugs that can corrupt data when you edit on phone and laptop at the same time, and make sure every chart reads the same numbers as the Holdings table. Without this, every other improvement is built on shaky ground.

2. **5B — Make the Holdings table feel right.** Sticky header that stays put when you scroll. Search/filter directly in the title row. Edit any cell directly without going to "edit mode." Fewer decimals everywhere (whole numbers for prices and totals, 1 decimal for yield/return percentages, 2 decimals for top-of-page totals). USD stocks stay in USD in their rows; only the big "Total Market Value" at the top converts to Canadian dollars. Make Total Market Value fit cleanly in its box on the iPad.

3. **5C — Sync your Strategy page with your Holdings.** Sector and Geography categories on the Strategy page come from your actual Holdings, not a parallel store. Standardize the four geographic names (US, Canada, Global, North America) and roll everything else into "Other." Target vs Actual chart pulls Actuals from Holdings.

4. **5D — Apply the chart colors and polish the look.** Mandatory color rules: Blue=US, Red=Canada, Orange=Not Found, Grey=Other. The other colors fill in by size order (Dark Green, Pink, Purple, Dark Yellow, Light Blue, Light Green). Fix the donut chart center-text alignment on tablets. Add a privacy button to hide dollar amounts when you want to show your portfolio without showing your net worth.

5. **5E — Dividend section.** A new table showing each stock's expected dividend (annual + monthly average). A 12-month projection chart showing what you'll receive each month for the next year. Auto-fill the Dividends income field on Finance Summary from your portfolio's monthly average.

6. **5F — Guru and News.** Make the Guru read your full Investment Strategy before giving advice (no ignoring your stated rules). Fix the news showing 2024 stories in 2026. Add a maximize button so reports are easy to read on the iPad.

### What we're saving for later — in plain English

Three items only. We don't pad this list with speculative ideas — only things that came up during planning and have a clear reason to wait.

1. **Showing how the portfolio did last week / month / year.** Right now we only show "all time" return. Showing "last 3 months" needs us to save a daily price snapshot for every stock for every account. We don't have that history yet. Big project on its own — Phase 6.

2. **Manually setting dividend frequency per stock.** First version of the dividend feature guesses payment frequency (monthly / quarterly) based on the type of stock. If our guesses are wrong often once you start using it, we'll add a way for you to override per ticker. Fast-follow if needed.

3. **Fancier dividend chart with stacked colored bars.** First version is a simple line showing total monthly dividends. A fancier version would show "$X from JEPQ, $Y from VFV" per month with colors. Basic first; fancy later only if you want it.
