# PO Feedback Triage — 2026-04-27

Triage of 21 items in PO feedback against actual code in `feature/portfolio-breakdown-tab` (now merged to main at `d41c056`). Verdicts: ✅ correct · ⚠️ partial · ❌ wrong · ❓ needs clarification.

## Summary
- **15 confirmed bugs/gaps** (correct)
- **3 partial / nuance** items
- **2 needs-clarification** (now resolved with PO follow-up)
- **1 heavy lift** (5.2)
- **0 wrong claims**

Two of the bugs were introduced in the breakdown-tab build (3.4 strategy field, 3.6 modal/aggregation), surfaced during her QA.

## Section 1 — Data Integrity & Input Rules

| # | PO Claim | Verdict | Evidence |
|---|---|---|---|
| 1.1 | No strict dropdown enforcement | ⚠️ | `<select>` is used but options are auto-derived from data ([DashboardClient.tsx:63-73](../../../src/app/dashboard/DashboardClient.tsx#L63-L73)). New garbage values get auto-added. |
| 1.2 | System creates new categories | ✅ | No canonical category list. ticker-research returns Yahoo's `quoteType` raw ([ticker-research.ts:139](../../../src/lib/ticker-research.ts#L139)). "ecnquote" is an unmapped Yahoo enum. |
| 1.3 | No manual-override protection | ✅ | `handleTickerLookup` ([DashboardClient.tsx:338-358](../../../src/app/dashboard/DashboardClient.tsx#L338-L358)) overwrites every classification field via `data.X \|\| prev.X`. |
| 1.4 | Currency overwrites to CAD on PDF import | ✅ | Confirmed by PO with screenshot. Root cause: [portfolio-pdf/route.ts:59](../../../src/app/api/portfolio-pdf/route.ts#L59) does single document-level CAD/USD detection. Per-row currency suffix is ignored. |

## Section 2 — Categories & Business Logic

| # | PO Claim | Verdict | Evidence |
|---|---|---|---|
| 2.1 | Strategy Type = Dividend/Growth/Mix | ✅ | No allowlist exists. |
| 2.2 | Security Type = Company/ETF/Fund | ✅ | Per 1.2, quoteType leaks raw. |
| 2.3 | Strict Market classification | ⚠️ | `GEO_NORMALIZE_MAP` exists in [portfolio-analytics.ts:47](../../../src/lib/portfolio-analytics.ts#L47) but maps to internal IDs, not used by dashboard. Strict "exclusively US / mix US+CA / Global" rule needs ETF holdings lookup for diversified funds. |
| 2.4 | Sector consolidation rules | ✅ | No sector mapping at dashboard layer. Banking+Insurance→Finance, Mix→Diversified, Gold→Mining, Cyclical+Defensive→Consumer, drop Global/Diversified. |
| 2.5 | Company auto-defaults | ✅ | `call: 'No'` is currently correct via [ticker-research.ts:148](../../../src/lib/ticker-research.ts#L148) but `managementStyle` is wrongly Active/Passive instead of N/A for Companies. |

## Section 3 — Charts & Visualizations

| # | PO Claim | Verdict | Evidence |
|---|---|---|---|
| 3.1 | Group <5% slices into "Others" | ✅ | No aggregation in [computeBreakdowns.ts:33-39](../../../src/app/dashboard/breakdown/lib/computeBreakdowns.ts#L33-L39). |
| 3.2 | Color contrast | ✅ | Three issues: hash collisions in `paletteFor` (USA + Global both yellow), Top-10 colored by `call` field → only 2 colors, **bonus**: `computeTopHoldings` doesn't aggregate by ticker (JEPQ + QMAX appear twice). |
| 3.3 | Show % labels in slices >15% | ✅ | Currently no slice labels at all, only legend + tooltip. |
| 3.4 | Strategy chart shows Yes/No | ✅ **(my bug)** | [computeBreakdowns.ts:7](../../../src/app/dashboard/breakdown/lib/computeBreakdowns.ts#L7) maps "By Strategy" to `call` field (Yes/No). Should be `strategyType` (Dividend/Growth/Mix). |
| 3.5 | Remove Risk, replace with Call | ✅ | Follows from 3.4 — `call` (Yes/No) becomes its own donut, replacing `risk` which is rarely populated. |
| 3.6 | Top 10 persistent + drop "+ N other" + show $ + % | ✅ **(my bug)** | [ConcentrationSection.tsx:39](../../../src/app/dashboard/breakdown/ConcentrationSection.tsx#L39) uses click-triggered bottom sheet. PO wants always-visible. |

## Section 4 — Calculations & Formatting

| # | PO Claim | Verdict | Evidence |
|---|---|---|---|
| 4.1 | Remove Weighted Yield | ✅ | PO changed her mind from brainstorming approval. |
| 4.2 | Yield/return % bug | ✅ | [DashboardClient.tsx:800](../../../src/app/dashboard/DashboardClient.tsx#L800) and [:804](../../../src/app/dashboard/DashboardClient.tsx#L804): `Number(asset.yield).toFixed(2)%` — no ×100. Yahoo returns yield as decimal (0.06 = 6%). Inconsistent with line 587 which does multiply portfolio yield by 100. TXF's 0.11% is this bug. |
| 4.3 | Many tickers showing 0 returns | ✅ | `oneYearReturn` and `threeYearReturn` come from `summary.fundPerformance?.trailingReturns?.oneYear` ([ticker-research.ts:154-155](../../../src/lib/ticker-research.ts#L154-L155)) — `fundPerformance` is fund-only. For individual stocks it's undefined → `\|\| 0` zeros them. |
| 4.4 | Show "Not Found" instead of 0 | ✅ | `\|\| 0` collapses missing → 0 before display. `naIndicator` helper at [DashboardClient.tsx:722](../../../src/app/dashboard/DashboardClient.tsx#L722) exists for display but never gets a chance because data is already 0. |

## Section 5 — Layout & Mobile

| # | PO Claim | Verdict | Evidence |
|---|---|---|---|
| 5.1 | Collapsible sidebar | ✅ | [Sidebar.tsx](../../../src/components/Sidebar.tsx) is fixed `w-64` desktop, full-width row on phone. **PO clarified: tablet only** (phone is fine). **Decision: Option A — icons-only on desktop and tablet.** |
| 5.2 | Total Return timeline filter | ⚠️ heavy | Needs daily snapshots in DynamoDB + historical price ingestion + time-weighted return + per-asset cash-flow tracking. **Decision: ship with Option A — keep "All-Time Profit" (current simple calc) as a distinct dropdown option, add period filters using TWR.** Filters grow into meaningful values over time. |
| 5.3 | Ticker as 2nd column | ✅ | Currently 4th. |
| 5.4 | Sticky only Account + Ticker | ✅ | Currently 4 cols sticky (290px wide on mobile). |

## Captured Decisions

- **5.1**: Icons-only collapse on both desktop and tablet (Option A)
- **5.2**: Keep both metrics with distinct labels — "All-Time Profit" (simple, current calc) + "Last Week / Month / 3 Months / 6 Months / 1 Year / 3 Years" (time-weighted period returns)

## Implementation Plan (4 Phases)

### Phase 1 — Quick correctness wins (this session)
- 3.4 Strategy chart field swap (`call` → `strategyType`)
- 3.5 Replace "By Risk" with "By Call"
- 3.6 Top-10 persistent + drop "+ N other" + show $ + %
- 3.6 bonus: aggregate Top-10 by ticker (mirror Codex fix on `computeDriftSignals`)
- 3.1 Group <5% slices into "Others"
- 3.2 Color contrast: sequential index assignment within charts
- 3.3 % labels inside slices >15%
- 4.1 Remove Weighted Yield component
- 4.2 ×100 percentage bug on Yield, 1Y, 3Y returns
- 5.3 Reorder columns — Ticker as 2nd
- 5.4 Sticky cleanup — only Account + Ticker

### Phase 2 — Boundary-layer fixes (new session)
- 1.1 + 1.2 + 2.1 + 2.2 Fixed allowlist for Strategy / Security Type / Call / Sector / Market / Currency / Mgmt Style
- 2.4 Sector consolidation map (Banking+Insurance→Finance, Mix→Diversified, Gold→Mining, Cyclical+Defensive→Consumer, drop Global/Diversified)
- 2.5 Company auto-defaults (call=No, mgmtStyle=N/A, mgmtFee=0)
- 4.3 Fix per-ticker yield/return inference — preserve null
- 4.4 Display "Not Found" / "—" / `!` for missing data

### Phase 3 — Structural fixes (each its own brainstorming → spec → plan → execute cycle)
- **Order:**
  - 1.3 + 1.4 Currency overwrite + manual-override protection (per-row currency in PDF parser + per-field user-edit lock flag)
  - 5.1 Collapsible sidebar — icons-only on desktop + tablet
  - 2.3 Strict market classification — ETF holdings lookup

### Phase 4 — Heavy lift (separate spec, multi-week)
- 5.2 Total Return timeline filter — daily snapshots + historical ingestion + TWR + cash-flow tracking
