# Phase 2 — Boundary-Layer Fixes Design

**Date:** 2026-04-27
**Source triage:** [docs/superpowers/triage/2026-04-27-po-feedback-triage.md](../triage/2026-04-27-po-feedback-triage.md)
**Phase 2 scope:** Items 1.1, 1.2, 2.1, 2.2, 2.4, 2.5, 4.3, 4.4

## Goal

Stop the system from silently corrupting classification data with values from external APIs, and stop it from silently zeroing out missing numbers. Make the dashboard honest: if we don't know a value, it shows up as a yellow "Not Found" cell so the user can act on it.

## Non-Goals

The following are explicitly out of scope for Phase 2 and are deferred to Phase 3+:

- **Item 1.3 / 1.4** — Per-row currency in the PDF parser, manual-override protection
- **Item 2.3** — Strict market classification via ETF holdings lookup (Phase 2 uses best-effort exchange mapping)
- **Item 5.1** — Collapsible sidebar
- **Item 5.2** — Time-weighted timeline filter

## Design

### 1. The Fixed Allowlists

Seven canonical category lists. Anything not on the allowlist becomes `"Not Found"` (text fields) or `null` (number fields).

| Field | Canonical values |
|---|---|
| `strategyType` | `Dividend`, `Growth`, `Mix`, `Not Found` |
| `securityType` | `Company`, `ETF`, `Fund`, `Not Found` |
| `call` | `Yes`, `No` |
| `sector` | `Financials`, `Healthcare`, `IT`, `Energy`, `Real Estate`, `Consumer Discretionary`, `Consumer Staples`, `Materials`, `Industrials`, `Communication`, `Utilities`, `Diversified`, `Not Found` |
| `market` | `USA`, `Canada`, `North America`, `Global`, `Not Found` |
| `currency` | `USD`, `CAD` (canonical); other ISO 4217 codes (`EUR`, `GBP`, `BRL`, etc.) accepted when reported by the broker; everything else → `Not Found` |
| `managementStyle` | `Active`, `Passive`, `N/A` |

**Strategy classifier label change:** The current `classifyStrategyType` returns `"Pure Dividend" / "Pure Growth" / "The Mix"`. These are renamed to `"Dividend" / "Growth" / "Mix"` to match the canonical labels. The classification *logic* (the four paths and yield/beta thresholds) is preserved.

### 2. Sector Consolidation Rules

Raw values from Yahoo Finance and existing data map to canonical sectors as follows:

| Raw value (case-insensitive, partial-match where listed) | Canonical |
|---|---|
| Banking, Bank, Financial Services, Financials, Insurance | `Financials` |
| Healthcare, Health Care, Pharmaceutical, Biotechnology | `Healthcare` |
| Technology, IT, Information Technology, Software, Semiconductor, Tech | `IT` |
| Energy, Oil, Gas, Renewable | `Energy` |
| Real Estate, REIT, Realty | `Real Estate` |
| Consumer Discretionary, Cyclical, Retail | `Consumer Discretionary` |
| Consumer Staples, Defensive | `Consumer Staples` |
| Mining, Gold, Precious Metals, Materials, Basic Materials | `Materials` |
| Industrials, Industrial | `Industrials` |
| Communication, Communication Services, Telecom | `Communication` |
| Utilities, Utility | `Utilities` |
| Mix, Diversified, Multi-sector | `Diversified` |
| plain "Consumer" (no qualifier) | `Consumer Discretionary` (default for ambiguous) |
| Global, Other, anything not matched | `Not Found` |

### 3. Market Classification (Phase 2 Best-Effort)

Phase 2 sets the allowlist; the *strict* holdings-based rule is Phase 3.

For Phase 2, market is determined as follows:

1. **For Companies (individual stocks):** Map the Yahoo exchange code to a country.
   - `NYQ`, `NMS`, `NCM`, `NGM`, `ASE`, `PCX`, `BATS` → `USA`
   - `TOR`, `VAN`, `CVE`, `NEO` → `Canada`
   - Anything else → `Global`
   - Empty/missing → `Not Found`
2. **For ETFs and Funds:** Default to `Not Found`. Holdings lookup arrives in Phase 3.

### 4. "Company" Auto-Defaults

When `securityType === "Company"` at write time, force:

- `call` = `"No"`
- `managementStyle` = `"N/A"`
- `managementFee` = `0` (legitimate zero, not null — stocks have no management fee)

These rules apply on every write path: PDF import, ticker auto-lookup, and manual edit. If the user later changes `securityType` to `"ETF"` or `"Fund"`, the fields unlock and accept new values.

### 5. Missing-Data Handling

**Text fields** (`strategyType`, `securityType`, `sector`, `market`, `managementStyle`):
- If the value can't be determined from raw data → store as `"Not Found"`.
- Display: yellow background, italic, with the literal text "Not Found".

**Number fields** (`yield`, `oneYearReturn`, `threeYearReturn`, `managementFee`):
- If Yahoo doesn't return the value → store as `null` (not `0`).
- Display: yellow background, italic, with the literal text "Not Found".
- This requires updating the `Asset` TypeScript type so these fields become `number | null`.

**Edge case for `managementFee`:**
For `securityType === "Company"`, a value of `0` is *legitimate* and is rendered normally as `"0.00%"`. Only for `ETF` / `Fund` does `null` (truly unknown) render as "Not Found".

**Item 4.3 specific fix:** `oneYearReturn` and `threeYearReturn` currently come from `summary.fundPerformance?.trailingReturns?.{oneYear,threeYear} || 0`. Change to:
```ts
oneYearReturn: summary.fundPerformance?.trailingReturns?.oneYear ?? null
```
This preserves the missing signal through the write pipeline. The migration script (Section 7) cleans up existing zeroed-out rows.

### 6. Visual Treatment for "Not Found"

A new shared component handles all "Not Found" rendering:

- **Background:** yellow (`bg-yellow-100 dark:bg-yellow-900/30`)
- **Text color:** dark yellow (`text-yellow-800 dark:text-yellow-200`)
- **Style:** italic
- **Tooltip on hover:** "Value not found in market data — please review"

The existing `naIndicator` helper in `DashboardClient.tsx` is updated/replaced with this new treatment so all "missing" cells (text and number) look identical.

### 7. Migration Script

**File:** `scripts/migrate-cleanup-allowlist.ts`

A one-time, idempotent cleanup script run once after Commits 1 and 2 deploy.

**Behavior:**

1. Query every asset in DynamoDB (`PK = HOUSEHOLD#*, SK begins_with ASSET#`).
2. For each asset, for each text field on the allowlist:
   - Run the value through `normalizeX(raw)`.
   - If the normalized value is `"Not Found"`, write it back as such.
3. For number fields (`yield`, `oneYearReturn`, `threeYearReturn`, `managementFee`):
   - If `oneYearReturn === 0` → set to `null`
   - If `threeYearReturn === 0` → set to `null`
   - If `yield === 0` → set to `null`
   - If `managementFee === 0` AND `securityType !== "Company"` → set to `null` (Company keeps 0; for ETF/Fund a 0 fee is suspicious)
   - Rationale: silent-zero is the dominant failure mode in Yahoo's data; if the PO has a real 0% return she can verify and re-enter. Audit log enables rollback.
4. Each modified asset gets an audit log entry with `MIGRATION_PHASE2_CLEANUP` action so it can be rolled back.
5. Re-classification with new logic is *not* done by this script — it happens lazily when:
   - User re-imports a PDF (re-runs `researchTicker`)
   - User manually edits a row
   - User triggers per-ticker refresh

**Why lazy re-classification:** Avoids overwriting fields the user has manually corrected.

### 8. Code Architecture

**New file:** `src/lib/classification/allowlists.ts`

Single source of truth. Exports:

```ts
export const STRATEGY_TYPES = ['Dividend', 'Growth', 'Mix', 'Not Found'] as const;
export const SECURITY_TYPES = ['Company', 'ETF', 'Fund', 'Not Found'] as const;
export const CALL_VALUES = ['Yes', 'No'] as const;
export const SECTOR_VALUES = [/* 12 + Not Found */] as const;
export const MARKET_VALUES = ['USA', 'Canada', 'North America', 'Global', 'Not Found'] as const;
export const CANONICAL_CURRENCIES = ['USD', 'CAD'] as const;
export const MGMT_STYLES = ['Active', 'Passive', 'N/A'] as const;

export const SECTOR_CONSOLIDATION_MAP: Record<string, Sector> = { /* ... */ };

export function normalizeStrategyType(raw: string | null | undefined): StrategyType;
export function normalizeSecurityType(raw: string | null | undefined): SecurityType;
export function normalizeSector(raw: string | null | undefined): Sector;
export function normalizeMarket(raw: string | null | undefined, exchange?: string, securityType?: SecurityType): Market;
export function normalizeCurrency(raw: string | null | undefined): string;  // permissive: any ISO 4217 OK
export function normalizeManagementStyle(raw: string | null | undefined): ManagementStyle;
export function normalizeCall(raw: string | null | undefined): Call;

export function applyCompanyAutoDefaults<T extends Partial<Asset>>(asset: T): T;
```

**Type updates:** `src/types/index.ts`
- Update `Asset` so `yield`, `oneYearReturn`, `threeYearReturn`, `managementFee` are `number | null`.
- Add string-literal union types for the canonical category fields (`StrategyType`, `SecurityType`, `Sector`, etc.) for compile-time safety.

**Touched files:**

| File | Change |
|---|---|
| `src/lib/classification/allowlists.ts` (new) | Source of truth for allowlists + normalizers |
| `src/lib/ticker-research.ts` | Output canonical values; preserve `null` for missing returns |
| `src/types/index.ts` | Update `Asset` interface for `number \| null` fields and category unions |
| `src/app/api/assets/route.ts` (POST) | Run inputs through normalizers before write |
| `src/app/api/assets/[id]/route.ts` (PUT) | Run inputs through normalizers; reapply Company defaults |
| `src/app/api/portfolio-pdf/route.ts` (POST) | Run enrichment results through normalizers |
| `src/app/dashboard/DashboardClient.tsx` | Read dropdown options from `allowlists.ts`, not derived from data; use new "Not Found" component for all missing values; handle `null` numbers |
| `src/app/dashboard/breakdown/lib/computeBreakdowns.ts` | Render `"Not Found"` slices in neutral gray (so PO can see how much of the portfolio is unclassified at a glance) — never silently filter out |
| `scripts/migrate-cleanup-allowlist.ts` (new) | One-time DynamoDB cleanup |

### 9. Implementation Order (Three Commits)

**Commit 1: Allowlists + boundary enforcement**
- Add `src/lib/classification/allowlists.ts` with all lists, maps, normalizers, and `applyCompanyAutoDefaults`.
- Wire normalizers into the three write paths.
- Update `researchTicker` to output canonical values.
- Update `DashboardClient` dropdown options to read from allowlists.
- Add the shared "Not Found" rendering component.
- Push to main when green.

**Commit 2: Null-preserving missing-data handling**
- Update `Asset` interface (yield/returns/mgmtFee → `number | null`).
- Update `researchTicker` to return `null` for unknown numbers.
- Update API write paths to preserve `null` (drop `|| 0`, use `??`).
- Update display: yield/return/mgmtFee cells call the shared "Not Found" component for `null`.
- Push to main when green.

**Commit 3: One-time migration script**
- Add `scripts/migrate-cleanup-allowlist.ts`.
- Add audit-log entries with action `MIGRATION_PHASE2_CLEANUP`.
- Test on local DynamoDB clone before running on prod.
- Run on prod, verify a sample of cleaned rows, push the script file to main.

### 10. Testing Strategy

**Unit tests** (`src/lib/classification/__tests__/allowlists.test.ts`):
- Each normalizer: known inputs → expected canonical outputs
- Sector consolidation: each row of the mapping table
- `applyCompanyAutoDefaults`: forces call/mgmtStyle/mgmtFee for Company; leaves other types unchanged

**Integration tests:**
- POST `/api/assets` with `securityType: "ecnquote"` → stored as `"Not Found"`
- POST `/api/assets` with `securityType: "Company"` and `call: "Yes"` → stored with `call: "No"` (auto-default wins)
- PDF import roundtrip: a Yahoo response with sector `"Banking"` → persisted as `"Financials"`
- Manual edit roundtrip: setting yield to empty → stored as `null`, displayed as yellow "Not Found"

**Manual smoke test on prod after each commit:**
- Open dashboard, verify dropdowns show only canonical values (no "ecnquote")
- Verify yellow "Not Found" cells where expected
- Test ticker auto-lookup with a known stock (AAPL) → Company auto-defaults applied
- Test PDF import with an existing CIBC statement
- Verify breakdown charts handle "Not Found" sensibly

### 11. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Migration script overwrites manually-corrected values | Lazy re-classification only; migration only flags unknowns, doesn't reclassify |
| `Asset.yield = null` breaks downstream calculations (e.g., expectedAnnualDividends) | Audit every consumer of `yield`; treat `null` as 0 in calculations but not in display |
| Strategy label change breaks existing charts/filters | `classifyStrategyType` returns new labels; check all consumers (`computeBreakdowns`, table render, audit snapshots) |
| Existing dropdown filters reference old values like "ecnquote" | Filter state is in-memory only; clears on refresh |
| Yahoo returns a sector we haven't mapped (new business) | `normalizeSector` falls through to `"Not Found"` — fail safe |

### 12. Definition of Done

- [ ] All three commits pushed to main, deployed to prod
- [ ] Migration script run once on prod, audit log shows MIGRATION_PHASE2_CLEANUP entries
- [ ] PO confirms dropdowns no longer contain garbage values
- [ ] PO confirms yellow "Not Found" cells appear where data is genuinely missing
- [ ] Adversarial review (`/codex:adversarial-review`) run after merge, findings triaged
