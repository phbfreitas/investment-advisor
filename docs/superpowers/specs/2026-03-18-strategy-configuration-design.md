# Strategy Configuration System — Design Spec

**Date:** 2026-03-18
**Status:** Draft

## Context

The Investment Advisory Board currently accepts free-text strategy descriptions and a risk tolerance selector as profile input. Users have no structured way to define their investment philosophy, asset allocation targets, trading preferences, or performance goals. The advisors receive narrative context but lack the precise, quantitative constraints needed to give targeted advice.

This feature adds a structured strategy configuration system to the profile page, enabling users to define:
- Asset mix percentages (Growth / Income / Mixed)
- Investment philosophies and core principles
- Account types and trading methodologies
- Sector and geographic allocation targets with inline drift detection
- Performance targets with portfolio-based projections

The structured config supplements (does not replace) the existing free-text profile fields. Advisors receive both narrative and structured context.

## Architecture

### Approach: Flat Profile Extension

All new fields are added directly to the existing DynamoDB profile record (`HOUSEHOLD#{id}`, SK `META`). No new tables, sort keys, or API routes.

**Rationale:** The strategy config is user preferences that advisors need alongside existing profile data. DynamoDB is schema-less (no migration needed), the profile record stays well under the 400KB limit, and the chat API's existing profile fetch automatically includes new fields.

## Data Model

New fields on the profile DynamoDB record (all optional, defaulting to empty/zero):

```typescript
interface StrategyConfig {
  // Section 1: Asset Strategy & Philosophy
  assetMixGrowth: number;          // 0-100, must sum to 100 with Income + Mixed
  assetMixIncome: number;          // 0-100
  assetMixMixed: number;           // 0-100

  philosophies: string[];          // Multi-select from predefined list
  // Values: "regular-value" | "deep-value" | "mispriced-situations" | "fundamental-value"
  //       | "event-driven" | "indexing" | "buy-the-dip" | "contrarian"
  //       | "technical-analysis" | "socially-responsible" | "long-term-growth"

  corePrinciples: string[];        // Multi-select
  // Values: "diversification" | "discipline-rebalancing" | "cost-minimization"

  // Section 2: Account & Execution
  accountTypes: string[];          // "registered-tfsa" | "registered-rrsp" | "non-registered"
  tradingMethodologies: string[];  // "buy-and-hold" | "trend-following" | "value-averaging"
                                   // | "sector-rotation" | "swing-trading"

  // Section 3: Portfolio Constraints
  sectorAllocation: Record<string, number>;   // Must sum to 100
  // Keys: "it" | "financials" | "healthcare" | "consumer-discretionary"
  //      | "communication-services" | "industrials" | "staples"
  //      | "energy-utilities" | "real-estate" | "materials" | "metals"

  geographicExposure: Record<string, number>; // Must sum to 100
  // Keys: "na" | "europe" | "asia" | "em" | "frontier"

  // Section 4: Performance Targets
  targetAnnualReturn: number;      // Percentage (e.g., 8.5)
  targetMonthlyDividend: number;   // Dollar amount (e.g., 500)
}
```

## UI Layout

New sections added to the profile page between Risk Tolerance (existing) and Budget (existing). Each section is collapsible (closed by default on first visit).

**Section order:**
1. Investment Strategy *(existing — textarea)*
2. Financial Goals *(existing — textarea)*
3. Risk Tolerance *(existing — select)*
4. **Asset Mix** — three number inputs + visual stacked bar chart (Growth/Income/Mixed), must sum to 100%
5. **Investment Philosophies** — grouped toggle pills, color-coded by category (Value-Based: purple, Strategy-Based: teal, Style-Based: amber)
6. **Core Principles** — checkboxes with brief descriptions
7. **Account Types** — checkboxes (TFSA, RRSP, Non-Registered)
8. **Trading Methodology** — checkboxes
9. **Sector Allocation** — 11 number inputs + drift table (Target | Actual | Drift columns), must sum to 100%
10. **Geographic Exposure** — 5 number inputs + drift table, must sum to 100%
11. **Performance Targets** — two number inputs with inline projection estimates
12. Budget *(existing)*
13. Wealth *(existing)*

### Drift Display

Sector and geographic sections show a three-column table: Target %, Actual %, Drift %. Drift values > 5% absolute are highlighted in red with a warning icon. A summary alert below the table lists all sectors/regions exceeding the threshold.

### Performance Projections

- **Annual return estimate:** Weighted average of `oneYearReturn` across holdings, weighted by `marketValue`
- **Monthly dividend estimate:** Sum of `expectedAnnualDividends` / 12 across all holdings
- Shown as colored info boxes below each input (amber if target exceeds estimate, green if on track)

## Drift Calculation

New utility: `src/lib/portfolio-analytics.ts`

```typescript
function calculatePortfolioDrift(
  targetSectors: Record<string, number>,
  targetGeo: Record<string, number>,
  assets: Asset[]
): {
  sectorDrift: Array<{ sector: string; target: number; actual: number; drift: number; warning: boolean }>;
  geoDrift: Array<{ region: string; target: number; actual: number; drift: number; warning: boolean }>;
  unclassifiedCount: number;
}
```

- **Sector actuals:** Sum `marketValue` per unique `sector`, divide by total portfolio value
- **Geographic actuals:** Sum `marketValue` per unique `market`, divide by total portfolio value
- **Warning threshold:** 5% absolute drift
- **Unclassified assets:** Excluded from calculation; count shown as "X holdings unclassified"
- Runs client-side on profile page load
- **Sector key mapping:** Asset `sector` free-text values must be normalized to config keys. Define a canonical map (e.g., `"Information Technology"` -> `"it"`, `"Financials"` -> `"financials"`, `"Consumer Discretionary"` -> `"consumer-discretionary"`, etc.). Assets whose `sector` doesn't match any key are counted as unclassified.
- **Geographic key mapping:** Asset `market` values mapped similarly (e.g., `"US"` / `"Canada"` -> `"na"`, `"UK"` / `"Germany"` -> `"europe"`, etc.).

## API Changes

### Profile API (`/api/profile`)
- **GET:** No changes (returns full document, new fields included automatically)
- **POST:** Extend to destructure and persist new `StrategyConfig` fields from request body. Add server-side validation: percentage groups must sum to 100.

### Chat API (`/api/chat`)
- Extend context string builder to append structured config after existing narrative fields:
  ```
  ASSET MIX TARGETS: Growth 60%, Income 30%, Mixed 10%
  INVESTMENT PHILOSOPHIES: Deep Value, Indexing, Long-term Growth
  CORE PRINCIPLES: Diversification, Discipline/Rebalancing
  ACCOUNT TYPES: TFSA, RRSP
  TRADING METHODOLOGY: Buy and Hold, Value Averaging
  SECTOR TARGETS: IT 25%, Financials 20%, Healthcare 15%, ...
  GEOGRAPHIC TARGETS: North America 60%, Europe 20%, Asia 15%, EM 5%
  PERFORMANCE TARGETS: 8.5% annual return, $500/mo dividend income
  ```

### Guidance API (`/api/guidance`)
- Extend cache fingerprint to include a hash of the full `StrategyConfig` object so cached guidance invalidates when any config field changes

## Validation

### Client-side
- Asset Mix: three inputs must sum to 100%. Real-time "Remaining: X%" indicator. Save disabled if not 100%.
- Sector Allocation: 11 inputs must sum to 100%. Same pattern.
- Geographic Exposure: 5 inputs must sum to 100%. Same pattern.
- Performance Targets: must be non-negative. No upper bound (projections serve as reality check).

### Server-side
- Validate percentage sums in POST handler. Return 400 with specific error if sums != 100.

## Edge Cases

- **Empty/new profile:** All new fields default to empty/zero. Sections show placeholder ("Set your targets to enable drift tracking").
- **No assets yet:** Drift and projection columns show "N/A — add holdings first".
- **Asset missing sector/market:** Excluded from drift calculation. Note: "X holdings unclassified".

## Scope Boundaries (Explicitly Out)

- No automated trading or order execution
- No email/push notification for drift alerts (inline only)
- No historical tracking of strategy changes over time
- No stock screening based on philosophies (philosophies are advisory context only for now)

## Files to Modify

| File | Change |
|------|--------|
| `src/types/index.ts` | Add `StrategyConfig` interface |
| `src/app/api/profile/route.ts` | Extend POST to persist new fields, add validation |
| `src/app/api/chat/route.ts` | Extend context string with structured config |
| `src/app/api/guidance/route.ts` | Extend cache fingerprint |
| `src/app/profile/ProfileClient.tsx` | Add 8 new collapsible sections with forms |
| `src/lib/portfolio-analytics.ts` | **NEW** — drift calculation and projection utilities |

## Verification

1. **Profile persistence:** Save strategy config, refresh page, verify all fields persisted
2. **Validation:** Try saving asset mix that doesn't sum to 100%, verify error shown
3. **Drift display:** Add assets with known sectors, set targets, verify drift calculates correctly
4. **Projections:** Check annual return estimate matches weighted average of holdings
5. **Chat context:** Ask an advisor a question, check debug logs for structured config in context string
6. **Guidance cache:** Change a strategy config field, verify guidance cache invalidates
7. **Empty state:** New user with no assets sees proper placeholder messages
