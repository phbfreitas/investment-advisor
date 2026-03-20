# Strategy Configuration Feedback Refinements

**Status:** Draft
**Date:** 2026-03-19

## Overview

User feedback on the strategy configuration system requires six areas of improvement: expanded sector/geographic options, a risk tolerance slider, an "Other" asset type, a full investment portfolio table with Yahoo Finance auto-lookup and Excel export, and pre-built guru prompt templates for the Advisory Board chat.

## 1. Sector Allocation Changes

Add two new sector categories to the existing 11:

- **S&P 500** — for holdings that track the S&P 500 index
- **Other** — for sectors not covered by the existing categories

All 13 sectors must sum to 100%. The `SECTORS` constant in `src/types/index.ts` gains two entries. The drift detection in `portfolio-analytics.ts` maps unclassified assets to "other" instead of counting them separately.

**Auto-clear behavior:** Number inputs clear to empty (showing placeholder "0") when the user focuses and starts typing, preventing the need to manually select-all before entering a value. Implemented via `onFocus` selecting all text.

## 2. Geographic Exposure Changes

Add three new geographic regions to the existing 5:

- **USA Only** — US-listed equities specifically
- **Canada Only** — Canadian-listed equities specifically
- **Global Mix** — diversified global allocation

All 8 regions must sum to 100%. The `GEOGRAPHIC_REGIONS` constant gains three entries. The geographic normalization map in `portfolio-analytics.ts` is updated: US-exchange tickers map to "usa" (not "na"), TSX tickers map to "canada" (not "na"). The existing "na" (North America) region remains for assets that span both or are unspecified. This is a semantic change — existing drift calculations that grouped US and CA under "na" will now distinguish them when the user sets targets for the new granular regions.

## 3. Risk Tolerance Slider

Replace the current string dropdown (`"Conservative"`, `"Moderate"`, `"Aggressive"`, `"Speculative"`) with a 1–10 integer slider.

- **1–3:** Conservative
- **4–6:** Moderate
- **7–9:** Aggressive
- **10:** Very Aggressive

Stored as `riskTolerance: number` (integer 1–10) on the profile, replacing the current string enum. The label is derived client-side from the value. The slider uses a gradient background (green → yellow → orange → red) with the current value displayed below.

Server-side validation: reject values outside 1–10.

**Backward compatibility:** Existing DynamoDB records may contain string values (e.g., `"Conservative"`). The profile loading code must handle both formats during transition: if the stored value is a string, map it to a numeric equivalent (`"Conservative"` → 2, `"Moderate"` → 5, `"Aggressive"` → 8, `"Speculative"` → 10). On next save, the integer value overwrites the old string. No batch migration needed.

## 4. Finance Summary — "Other" Asset Type

The finance summary's wealth section uses individual named fields (`wealthAssetCash`, `wealthAssetCar`, `wealthAssetPrimaryResidence`, `wealthAssetRentalProperties`). Add a new `wealthAssetOther: number` field following the same pattern. This covers miscellaneous assets (collectibles, crypto, private equity, etc.) that don't fit the existing categories.

The `FinanceSummaryClient.tsx` form gains one new row for "Other Assets" with the same currency input pattern as the existing wealth fields. The `WealthData` interface in `src/types/index.ts` gains the `wealthAssetOther` property.

## 5. Investment Portfolio Table

This enhances the existing asset management system. The app already has an `AddAssetModal` component, `/api/assets` endpoint, and an `Asset` interface with many fields (strategyType, managementStyle, externalRating, volatility, etc.). The portfolio table is a new **read/edit view** on the profile page that surfaces the most important columns from existing Asset records. It does not replace the existing `AddAssetModal` or `/api/assets` endpoint — it uses them.

- The "+ Add Holding" button opens the existing `AddAssetModal` (or a simplified version of it)
- The table reads from the same Asset records already fetched by the profile API
- Yahoo Finance auto-lookup enriches fields on the existing Asset schema
- Fields not shown in the table (strategyType, managementFee, etc.) retain their existing values when editing via the table

### 5A. Table Columns

| Column | Source | Editable |
|--------|--------|----------|
| Account | User input (autofill from existing accounts) | Yes |
| Ticker | User input | Yes |
| Security Type | Yahoo Finance auto-lookup | Overridable |
| Sector | Yahoo Finance auto-lookup | Overridable |
| Market | Yahoo Finance auto-lookup | Overridable |
| Quantity | User input | Yes |
| Book Cost/Share | User input | Yes |
| Market Value | Calculated: current price × quantity | No |
| Weight % | Calculated: market value / total portfolio value | No |
| P/L | Calculated: (current price - book cost) × quantity | No |
| Actions | Edit / Delete buttons | — |

**Totals row** in the table footer: sum of book cost, market value, weight (100%), and P/L.

### 5B. Add Holding Flow

1. User clicks "+ Add Holding"
2. Inline form or modal with Account (autofill dropdown from existing account names) and Ticker fields
3. On ticker blur/enter, call Yahoo Finance API (`yahoo-finance2` npm package) to auto-populate: sector, market, security type, current price, dividend yield, 1yr/5yr returns
4. User enters quantity and book cost per share
5. Auto-filled fields are overridable if Yahoo data is wrong
6. Save persists to DynamoDB as an Asset record

### 5C. Account Autofill

The Account field shows a dropdown of previously used account names (extracted from existing assets). User can also type a new account name. Implemented as a `<datalist>` or combobox pattern.

### 5D. Yahoo Finance Integration

New server-side API endpoint: `GET /api/ticker-lookup?symbol=AAPL`

- Uses `yahoo-finance2` package to fetch quote summary
- Returns: `{ sector, market, securityType, currentPrice, dividendYield, oneYearReturn, fiveYearReturn }`
- Called client-side on ticker input blur
- Graceful fallback: if lookup fails, fields remain editable and empty
- No caching needed — lookups are infrequent (only on add/edit)

### 5E. Auto-Calculated Fields

Computed client-side, never stored in DB:

- **Weight %** = holding market value / sum of all holdings' market values
- **P/L** = (current price − book cost per share) × quantity
- **Market Value** = current price × quantity
- **Totals** = column sums across all holdings

These calculations feed into the existing drift detection (sector/geographic actual vs. target).

### 5F. Sticky Header

The table container has `max-height` with `overflow-y: auto`. The `<thead>` uses `position: sticky; top: 0` so column headers remain visible while scrolling.

### 5G. Excel Export

Client-side CSV generation using native JavaScript (`Blob` + `URL.createObjectURL`). No external library needed.

- Filename: `portfolio-YYYY-MM-DD.csv`
- Includes all visible columns plus a totals row
- Triggered by an "Export CSV" button in the section header
- CSV opens natively in Excel

## 6. Guru Prompt Templates

Four pre-built prompt buttons displayed as pill chips in the chat input area on the home page. They replace the existing quick prompts on the welcome/empty state.

### 6A. Prompt Definitions

Defined as a `PROMPT_TEMPLATES` constant array in a shared location (e.g., `src/lib/prompt-templates.ts`):

1. **Investment Suggestions** (💡): "Based on my investment strategy and your core philosophy, suggest specific tickers to buy or sell. Consider my current holdings, sector targets, and risk tolerance."

2. **Comprehensive Financial Analysis** (📊): "Analyze my entire financial situation — investments, net worth, and cash flow (budget vs. actual). Identify strengths, risks, and suggest adjustments."

3. **Portfolio Rebalancing** (⚖️): "Review my portfolio against my target allocations and suggest specific buy/sell orders to rebalance. Prioritize actions by impact and alignment with my strategy."

4. **Full Financial Health Audit** (🏥): "Perform a complete financial health audit — assets beyond investments, total net worth, cash flow (budgeted vs. actual), debt ratios, and emergency fund adequacy. Recommend changes."

### 6B. UI Behavior

- Displayed as horizontal scrollable pill buttons with emoji + label
- Clicking a pill fills the chat input textarea with the prompt text
- User can edit the pre-filled text before sending
- Works with whichever personas are currently selected
- No guru-specific variants — the advisor's system prompt, RAG context, and user profile provide all personalization

### 6C. Placement

The prompt pills appear in the welcome/empty state area where the existing quick prompts ("Analyze my portfolio", "Critique my strategy") currently live. They replace those prompts entirely.

## Data Model Changes

### StrategyConfig Updates

```typescript
// Sector allocation — add 2 new keys
sectorAllocation: {
  // existing 11 keys...
  sp500: number;    // NEW
  other: number;    // NEW
};

// Geographic exposure — add 3 new keys
geographicExposure: {
  // existing 5 keys...
  usa: number;      // NEW
  canada: number;   // NEW
  globalMix: number; // NEW
};

// Risk tolerance — change type
riskTolerance: number; // was string enum, now 1-10 integer
```

### Asset Type

Add `"Other"` to the union type or constant array for asset types in the finance summary.

## New Files

- `src/lib/prompt-templates.ts` — PROMPT_TEMPLATES constant array
- `src/app/api/ticker-lookup/route.ts` — Yahoo Finance lookup endpoint

## Modified Files

- `src/types/index.ts` — updated constants and types
- `src/lib/portfolio-analytics.ts` — updated normalization maps, drift calculation
- `src/app/profile/ProfileClient.tsx` — risk slider, new sector/geo fields, portfolio table, Excel export
- `src/app/finance-summary/FinanceSummaryClient.tsx` — add "Other Assets" field to wealth section
- `src/app/HomeClient.tsx` — replace quick prompts with guru prompt templates
- `src/app/api/profile/route.ts` — updated validation for new fields, risk tolerance range check
- `src/app/user-guide/UserGuideClient.tsx` — document new features
- `USER_GUIDE.md` — document new features
- `package.json` — add `yahoo-finance2` dependency

## Out of Scope

- Real-time price streaming or WebSocket connections
- Automated trading or order execution
- Historical portfolio value tracking over time
- Import from brokerage CSV files (future enhancement)
- Push notifications for drift alerts
