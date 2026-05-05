# 5B Holdings Table Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Holdings table feel right — sticky header anchored to the viewport, every column sortable + filterable from the title-row area, true inline editing on every editable cell (no "edit mode" pencil detour), a single decimal-formatting contract applied app-wide, USD assets that stay USD in their rows, and one Total Market Value badge that converts to CAD using daily FX.

**Architecture:** Five buckets of work executed as discrete tasks. (1) A new pure-helper module `src/lib/decimalFormat.ts` centralizes the global decimal rule and its three exceptions; every render site that emits a number routes through it. (2) The two existing top-of-page totals UIs are unified into a single Total Market Value badge that always converts to CAD. (3) Row-level currency display is locked: USD asset rows render USD with a `US$` symbol, CAD rows render `$` (already the default), and tests guard against drift. (4) `ExchangeCell`'s pattern (per-cell editing state + partial-PUT save) is generalized into `InlineEditableCell`, then applied to every editable column. The pencil/save row controls disappear. (5) Sticky header is reparented above the scroll container; Exchange gets its missing filter + sortable header; iPad-portrait KPI grid is fixed.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Jest 30, Tailwind v4, AWS DynamoDB Document Client, NextAuth. Tailwind responsive breakpoints: `md` = 768px (iPad portrait threshold), `lg` = 1024px (iPad landscape), `xl` = 1280px (desktop).

**Spec references:**
- `docs/superpowers/specs/2026-05-03-phase5-prioritization-breakdown-design.md` § "5B — Holdings Table (UX + Multi-Currency)"
- `docs/superpowers/specs/2026-05-03-5a-data-flow.md` (live-merge contract — must not regress)

---

## File structure

**Created:**
- `src/lib/decimalFormat.ts` — pure helpers: `formatPrice`, `formatQuantity`, `formatTotal`, `formatRowPercent`, `formatTopPercent`, `formatCurrencyAmount`. One module, one source of truth for the decimal rule.
- `src/lib/__tests__/decimalFormat.test.ts`
- `src/app/dashboard/InlineEditableCell.tsx` — generic per-cell editor (text input, number input, or `<select>`); manages local edit state + partial-PUT save with `expectedUpdatedAt`.
- `src/app/dashboard/__tests__/InlineEditableCell.test.tsx`
- `src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx` — locks the row-level currency display contract.
- `src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx` — locks the decimal rules across cells, top KPI, totals row.
- `src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx` — qty / price / classification cells are editable in place; no `editingId` row-mode is entered.
- `src/app/api/assets/[id]/__tests__/PATCH-partial.test.ts` (or extend the existing PUT test if a partial-PUT path already covers this).

**Modified:**
- `src/app/dashboard/DashboardClient.tsx` — remove pencil/save row controls; use `InlineEditableCell` for every editable column; route every numeric render through `decimalFormat`; collapse the duplicate "Total Market Value" KPI + "FX Portfolio Totals" panel into a single badge; reparent the sticky header above the scroll container; render Exchange filter + sortable header; tighten the top-row KPI grid for iPad portrait.
- `src/app/dashboard/HoldingsTab.tsx` — `ExchangeCell` keeps its existing public API but its internal edit state & save logic adopt the same shape `InlineEditableCell` uses (pure refactor — no behavior change).
- `src/app/finance-summary/FinanceSummaryClient.tsx` — route currency renders through `formatTotal` (whole-dollar) for the page-level totals (Total Income, Total Expenses, Net Worth, etc.).
- `src/app/dashboard/breakdown/CompositionSection.tsx`, `ConcentrationSection.tsx`, `DriftSignalsSection.tsx` — adopt `formatRowPercent` for slice-percent labels (1dp), `formatCurrencyAmount` for hovered tooltip dollars (whole-dollar). The local `fmtCurrency` consts are deleted.
- `docs/superpowers/specs/2026-05-03-5a-data-flow.md` — append a "Currency display contract" subsection that locks the rule that USD asset rows display USD natively and only the top badge converts.

---

## Task ordering rationale

Order is strictly bottom-up: pure helpers first → consumer files → biggest UX refactor (inline editing) last so each preceding step is shippable on its own.

1. Decimal helpers (pure, fully testable in isolation, blocks everything downstream).
2. Holdings table cells route through helpers (largest single consumer; the visible payoff).
3. Decimals applied to the rest of the app (Finance Summary + Breakdown tooltips).
4. Multi-currency: collapse two KPIs into one badge + lock row-level currency display.
5. Sticky header + Exchange filter/sort + iPad-portrait KPI fit (CSS-only changes).
6. `InlineEditableCell` — extract the pattern as a standalone component with tests.
7. Apply `InlineEditableCell` across the Holdings table; remove the pencil/edit-mode detour.
8. Documentation — append the currency contract to the data-flow doc.

---

## Task 1: Decimal-formatting helpers

**Files:**
- Create: `src/lib/decimalFormat.ts`
- Create: `src/lib/__tests__/decimalFormat.test.ts`

**Why:** Six call-shapes scattered across DashboardClient, FinanceSummaryClient, three Breakdown sections all hand-roll `toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })` or `toFixed(...)` with inconsistent precisions. The spec mandates one global rule (0 dp on prices/quantities/totals) plus three exceptions: row-level Yield % / 1YR Return % / 3YR Return % at 1 dp, top-of-page Total Return + Avg Dividend Yield at 2 dp. Centralizing the rule in one helper module is the only durable way to enforce it — and to give the inline-editing refactor a stable display contract to call into.

- [ ] **Step 1: Write the failing test**

Create `src/lib/__tests__/decimalFormat.test.ts`:

```ts
import {
  formatPrice,
  formatQuantity,
  formatTotal,
  formatRowPercent,
  formatTopPercent,
  formatCurrencyAmount,
} from "../decimalFormat";

describe("decimalFormat — global 0-decimal rule", () => {
  it("formatPrice renders prices as whole dollars", () => {
    expect(formatPrice(123.456)).toBe("123");
    expect(formatPrice(0)).toBe("0");
    expect(formatPrice(1234567.89)).toBe("1,234,568");
  });

  it("formatQuantity renders quantities as whole numbers", () => {
    expect(formatQuantity(42.7)).toBe("43");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(1500)).toBe("1,500");
  });

  it("formatTotal renders totals with locale separators and 0 decimals", () => {
    expect(formatTotal(1234567)).toBe("1,234,567");
    expect(formatTotal(99.5)).toBe("100");
  });

  it("renders Not Found for null/undefined/non-finite inputs", () => {
    expect(formatPrice(null)).toBe("Not Found");
    expect(formatPrice(undefined)).toBe("Not Found");
    expect(formatPrice(Number.NaN)).toBe("Not Found");
    expect(formatQuantity(null)).toBe("Not Found");
    expect(formatTotal(null)).toBe("Not Found");
  });
});

describe("decimalFormat — row-level percent (1 dp)", () => {
  it("formatRowPercent renders ratios as 1-decimal percents", () => {
    // Yield, oneYearReturn, threeYearReturn are stored as decimals (0.045 = 4.5%)
    expect(formatRowPercent(0.045)).toBe("4.5%");
    expect(formatRowPercent(0.12)).toBe("12.0%");
    expect(formatRowPercent(-0.0123)).toBe("-1.2%");
    expect(formatRowPercent(0)).toBe("0.0%");
  });

  it("renders Not Found for null/undefined/non-finite", () => {
    expect(formatRowPercent(null)).toBe("Not Found");
    expect(formatRowPercent(undefined)).toBe("Not Found");
    expect(formatRowPercent(Number.NaN)).toBe("Not Found");
  });
});

describe("decimalFormat — top-of-page percent (2 dp)", () => {
  it("formatTopPercent renders ratios as 2-decimal percents with sign on positive", () => {
    expect(formatTopPercent(0.0456)).toBe("+4.56%");
    expect(formatTopPercent(-0.0456)).toBe("-4.56%");
    expect(formatTopPercent(0)).toBe("0.00%");
  });

  it("formatTopPercent omits sign when withSign=false", () => {
    expect(formatTopPercent(0.0456, { withSign: false })).toBe("4.56%");
  });

  it("renders Not Found for null/undefined/non-finite", () => {
    expect(formatTopPercent(null)).toBe("Not Found");
    expect(formatTopPercent(undefined)).toBe("Not Found");
  });
});

describe("decimalFormat — currency amount with symbol", () => {
  it("formatCurrencyAmount prefixes the symbol per ISO code (whole dollars)", () => {
    expect(formatCurrencyAmount(1234, "CAD")).toBe("$1,234");
    expect(formatCurrencyAmount(1234, "USD")).toBe("US$1,234");
  });

  it("falls back to bare dollar sign for unknown currency codes", () => {
    expect(formatCurrencyAmount(1234, "EUR")).toBe("$1,234");
    expect(formatCurrencyAmount(1234, undefined)).toBe("$1,234");
  });

  it("renders Not Found for null/undefined/non-finite amounts", () => {
    expect(formatCurrencyAmount(null, "CAD")).toBe("Not Found");
    expect(formatCurrencyAmount(undefined, "USD")).toBe("Not Found");
    expect(formatCurrencyAmount(Number.NaN, "CAD")).toBe("Not Found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/decimalFormat.test.ts -i`
Expected: FAIL — `Cannot find module '../decimalFormat'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/decimalFormat.ts`:

```ts
const NOT_FOUND = "Not Found";

const isMissing = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || !Number.isFinite(Number(v));

export function formatPrice(value: number | null | undefined): string {
  if (isMissing(value)) return NOT_FOUND;
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const formatQuantity = formatPrice;
export const formatTotal = formatPrice;

export function formatRowPercent(value: number | null | undefined): string {
  if (isMissing(value)) return NOT_FOUND;
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatTopPercent(
  value: number | null | undefined,
  opts: { withSign?: boolean } = {},
): string {
  if (isMissing(value)) return NOT_FOUND;
  const { withSign = true } = opts;
  const n = Number(value) * 100;
  const body = `${n.toFixed(2)}%`;
  if (!withSign) return body;
  return n > 0 ? `+${body}` : body;
}

const CURRENCY_PREFIX: Record<string, string> = {
  CAD: "$",
  USD: "US$",
};

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency: string | undefined,
): string {
  if (isMissing(value)) return NOT_FOUND;
  const prefix = currency ? (CURRENCY_PREFIX[currency] ?? "$") : "$";
  return `${prefix}${formatTotal(value)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/decimalFormat.test.ts -i`
Expected: PASS — all assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/decimalFormat.ts src/lib/__tests__/decimalFormat.test.ts
git commit -m "feat(decimalFormat): central helpers for 5B decimal rule + exceptions"
```

---

## Task 2: Apply decimal helpers across the Holdings table

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (multiple call sites — lines 887, 894, 900, 1073, 1080, 1183, 1307, 1450–1453, 1477, 1483, 1532, 1538, 1544, 1562)
- Create: `src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx`

**Why:** Today the Holdings table renders quantities, prices, totals, and percents with a mixture of `toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })`, `toFixed(2)`, and `toLocaleString()`-defaults. Per spec: prices/quantities/totals → 0 dp; row-level Yield % and 1YR/3YR Return % → 1 dp; top-of-page Total Return and Avg Dividend Yield → 2 dp. Routing through Task 1's helpers fixes all of them in one pass.

**Critical: the live-merge contract must not regress.** The Live $ cell currently reads `marketData[asset.id]?.currentPrice ?? asset.liveTickerPrice` (line 1303). It must continue to read from `marketData` first — do not switch the Live $ cell to `liveMergedAssets[i].liveTickerPrice` (the cell-level fallback flow is intentional and tested upstream).

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

// Minimal asset fixture sufficient to render the Holdings table.
const baseAsset = {
  PK: "HOUSEHOLD#h1",
  SK: "ASSET#a1",
  id: "a1",
  profileId: "h1",
  type: "ASSET" as const,
  account: "RRSP",
  ticker: "AAPL",
  securityType: "Stock",
  strategyType: "Growth",
  call: "",
  sector: "IT",
  market: "US",
  currency: "USD",
  managementStyle: "",
  externalRating: "",
  managementFee: null,
  quantity: 100,
  liveTickerPrice: 200,
  bookCost: 15000,
  marketValue: 20000,
  profitLoss: 5000,
  yield: 0.012,
  oneYearReturn: 0.187,
  fiveYearReturn: null,
  threeYearReturn: 0.092,
  exDividendDate: "",
  analystConsensus: "",
  beta: 1.1,
  riskFlag: "",
  accountNumber: "",
  accountType: "RRSP",
  risk: "",
  volatility: 0,
  expectedAnnualDividends: 240,
  updatedAt: "2026-05-04T00:00:00.000Z",
};

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (typeof url === "string" && url.includes("/api/profile")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          assets: [baseAsset],
          portfolioTotals: {
            cadTotal: 0,
            usdTotal: 20000,
            grandTotalCad: 27000,
            usdToCadRate: 1.35,
            fxUnavailable: false,
          },
          columnVisibility: {},
        }),
      }) as unknown as ReturnType<typeof fetch>;
    }
    if (typeof url === "string" && url.includes("/api/market-data")) {
      return Promise.resolve({ ok: true, json: async () => ({ currentPrice: 210 }) }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

describe("Holdings table — decimal rules", () => {
  it("renders quantity as a whole number", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    // quantity 100 → "100" (no decimals)
    const row = screen.getByText("AAPL").closest("tr")!;
    expect(within(row).getByText("100")).toBeInTheDocument();
  });

  it("renders row-level Yield % at 1 decimal", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    // yield 0.012 → "1.2%"
    const row = screen.getByText("AAPL").closest("tr")!;
    expect(within(row).getByText("1.2%")).toBeInTheDocument();
  });

  it("renders row-level 1YR Return % at 1 decimal", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    // oneYearReturn 0.187 → "18.7%"
    const row = screen.getByText("AAPL").closest("tr")!;
    expect(within(row).getByText("18.7%")).toBeInTheDocument();
  });

  it("renders top-of-page Total Return at 2 decimals with sign", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    // totalCostBasis 15000, totalMV 21000 (live merged: 100 × 210)
    // totalReturn = (21000 - 15000) / 15000 = 0.40 → "+40.00%"
    expect(screen.getByText("+40.00%")).toBeInTheDocument();
  });

  it("renders Avg Dividend Yield at 2 decimals", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    // weighted yield = 0.012 (only one holding) → "1.20%"
    expect(screen.getByText("1.20%")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx -i`
Expected: FAIL — assertions for whole-number quantity / 1-dp percents / 2-dp Total Return don't yet match the rendered output (they're currently 2 dp, 2 dp, 2 dp).

- [ ] **Step 3: Update DashboardClient call sites**

Add to the import block at the top of `src/app/dashboard/DashboardClient.tsx`:

```ts
import {
  formatPrice,
  formatQuantity,
  formatTotal,
  formatRowPercent,
  formatTopPercent,
} from "@/lib/decimalFormat";
```

Replace the call sites listed below. Each replacement is a 1-line swap.

| Line | Before | After |
|---|---|---|
| 887 | `${totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` | `${formatTotal(totalMarketValue)}` (the `$` stays as a literal prefix) |
| 894 | `{totalReturn > 0 ? "+" : ""}{totalReturn.toFixed(2)}%` | `{formatTopPercent(totalReturn / 100)}` (note: `totalReturn` is already a percent — divide by 100 to feed the helper a decimal ratio) |
| 900 | `{(portfolioDividendYield * 100).toFixed(2)}%` | `{formatTopPercent(portfolioDividendYield, { withSign: false })}` |
| 1073 | `{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}` | `{formatTotal(value)}{suffix}` (and remove the `decimals` param everywhere `renderNumber` is invoked — they all become whole-dollar) |
| 1080 | `{(value * 100).toFixed(2)}%` | `{formatRowPercent(value)}` |
| 1154 | `{displayValue.toLocaleString()}` (display mode for editable numeric cells) | `{formatTotal(displayValue)}` |
| 1183 | `{typeof value === 'number' ? value.toLocaleString() : value}{suffix}` | `{typeof value === 'number' ? formatTotal(value) : value}{suffix}` |
| 1307 | `$${numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` | `$${formatPrice(numPrice)}` |
| 1451 | `{Number(s.quantity || 0).toLocaleString()}` | `{formatQuantity(Number(s.quantity || 0))}` |
| 1452 | `${Number(s.marketValue || 0).toLocaleString()}` | `${formatTotal(Number(s.marketValue || 0))}` |
| 1453 | `${Number(s.bookCost || 0).toLocaleString()}` | `${formatTotal(Number(s.bookCost || 0))}` |
| 1477 | `${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}` | `${formatTotal(totalMarketValue)}` |
| 1483 | `${totalExpectedDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}` | `${formatTotal(totalExpectedDividends)}` |
| 1532 | `${(totalExpectedDividends / 12 * dividendPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` | `${formatTotal(totalExpectedDividends / 12 * dividendPeriod)}` |
| 1538 | same shape, monthly | `${formatTotal(totalExpectedDividends / 12)}` |
| 1544 | same shape, annual | `${formatTotal(totalExpectedDividends)}` |
| 1562 | per-strategy break-out | `${formatTotal(annual / 12 * dividendPeriod)}` |

The `renderNumber` helper at line 1069 — keep its signature but drop the `decimals` parameter; route the body through `formatTotal`. Update the two call sites that pass a custom `decimals` value (search for `renderNumber(` in the file) so they no longer pass it.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx -i`
Expected: PASS — all five assertions green.

Then run the wider Dashboard test suite to catch regressions:

Run: `npx jest src/app/dashboard -i`
Expected: PASS — all existing Dashboard tests still green (esp. `DashboardClient-409-handling.test.tsx`).

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/dashboard/__tests__/HoldingsTable-decimals.test.tsx
git commit -m "feat(holdings): apply 5B decimal rule across table cells, KPIs, totals"
```

---

## Task 3: Apply decimal helpers across Finance Summary + Breakdown tooltips

**Files:**
- Modify: `src/app/finance-summary/FinanceSummaryClient.tsx` (lines 441, 455, 470, 676, 730, 747, 765, 782)
- Modify: `src/app/dashboard/breakdown/CompositionSection.tsx` (lines 8, 53, 75, 88, 94, 103)
- Modify: `src/app/dashboard/breakdown/ConcentrationSection.tsx` (lines 7, 33, 46, 69, 84, 91)
- Modify: `src/app/dashboard/breakdown/DriftSignalsSection.tsx` (line 8 + slice-percent rendering)

**Why:** Spec definition-of-done: "Decimal rules audited across Holdings table, Finance Summary, Breakdown tooltips, Strategy page." Strategy page renders no currency or numeric percent in `src/app/profile/ProfileClient.tsx` (verified during planning — only ISO timestamps), so it's a no-op. The other three surfaces all hand-roll formatting and must adopt the central helpers.

**Decision: in Finance Summary, use `formatTotal` (whole dollars) for all the displayed totals.** The `formatCurrencyInput` helper at line 16 renders inputs while a user is typing — leave it alone, it's a different concern (input UX). Only the *rendered totals* (lines 441 et al.) move to whole dollars.

**Decision: in Breakdown tooltips, slice-percent labels use `formatRowPercent` (1 dp) and dollar amounts use `formatCurrencyAmount(n, "CAD")`.** Donuts only show CAD-equivalent aggregates today; we keep that rendering and lock in the symbol.

- [ ] **Step 1: Update Finance Summary**

In `src/app/finance-summary/FinanceSummaryClient.tsx`, at the top of the import block:

```ts
import { formatTotal } from "@/lib/decimalFormat";
```

Replace each of these expressions:

```
${X.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
```

with:

```
${formatTotal(X)}
```

at lines 441, 455, 470, 676, 730, 747, 765, 782 (8 sites). Do *not* touch the `formatCurrencyInput` helper at line 16 — that renders raw input strings and is unrelated to display totals.

- [ ] **Step 2: Update Breakdown sections**

In each of `CompositionSection.tsx`, `ConcentrationSection.tsx`, `DriftSignalsSection.tsx`:

Delete the local declaration at the top of the file:

```ts
const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
```

Replace with:

```ts
import { formatRowPercent, formatCurrencyAmount } from "@/lib/decimalFormat";
const fmtCurrency = (n: number) => formatCurrencyAmount(n, "CAD");
```

(Keep the local `fmtCurrency` alias — it lets the rest of each file stay structurally identical. Subagents must not chase a wider rename.)

For percent labels, replace each call shape:

| Pattern | Replacement |
|---|---|
| `${p.toFixed(1)}%` | `${formatRowPercent(p / 100)}` (these `p` are *already-percent* numbers — divide by 100 first) |
| `${pct.toFixed(1)}%` | `${formatRowPercent(pct / 100)}` |
| `e.percent.toFixed(0)%` (CompositionSection.tsx:53) | leave as-is — that's a slice-label render where 0 dp is intentional |
| `s.percent.toFixed(2)%` (CompositionSection.tsx:103) | `${formatRowPercent(s.percent / 100)}` |
| `r.percent.toFixed(2)%` (ConcentrationSection.tsx:91) | `${formatRowPercent(r.percent / 100)}` |
| `largest.percent.toFixed(1)%` | `${formatRowPercent(largest.percent / 100)}` |

The `BreakdownTab.test.tsx`, `ConcentrationSection.test.tsx`, and `DriftSignalsSection.test.tsx` suites reference some of these strings. After editing, run the suite first; only update test expectations to the new format if a test fails specifically on the rendered string. Do not alter test setup or fixtures.

- [ ] **Step 3: Run tests**

Run: `npx jest src/app/finance-summary src/app/dashboard/breakdown -i`
Expected: PASS — any tests that asserted the old "12.50%" / "$1,234.56" strings now need their expected string updated to the new format. Update them as you encounter them; do not invent new test cases.

Run: `npx jest -i` (full suite)
Expected: 323+ tests pass (matches 5A baseline; the new decimal tests add to the total).

- [ ] **Step 4: Commit**

```bash
git add src/app/finance-summary/FinanceSummaryClient.tsx src/app/dashboard/breakdown/CompositionSection.tsx src/app/dashboard/breakdown/ConcentrationSection.tsx src/app/dashboard/breakdown/DriftSignalsSection.tsx
git commit -m "feat(decimals): apply 5B decimal rule to Finance Summary + Breakdown tooltips"
```

---

## Task 4: Single Total Market Value badge + multi-currency row contract

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (lines 882–935 — KPI grid + FX panel)
- Create: `src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx`

**Why:** Today there are two parallel UIs: a "Total Market Value" KPI at line 884 that renders the raw sum of `marketValue` (no FX awareness, no per-currency split) and a separate "FX Portfolio Totals" panel at line 906 that *does* render the CAD/USD split + grand total. Spec: "the SINGLE 'Total Market Value' badge at the top of Holdings is the only place that aggregates to CAD using daily FX." Collapse to one badge. And: "USD assets show USD in their rows; CAD-equivalent only at the top." Lock the row contract with tests.

**The single badge layout:** a stack inside one `glass-panel`:
1. Headline: "Total Market Value" + the CAD grand total (whole dollars).
2. Sub-line 1: per-currency subtotals (CAD subtotal, USD subtotal each in their native currency).
3. Sub-line 2: FX rate footnote ("at 1 USD = X.XXXX CAD · as of today") OR "FX rate unavailable — showing per-currency subtotals only" when `portfolioTotals.fxUnavailable === true`.

The row-level contract: `Book Cost` and `Market Value` cells render in the asset's *native* currency. For a `currency: "USD"` asset, the cell displays `US$X,XXX`; for `currency: "CAD"`, just `$X,XXX`. No FX conversion happens at the row level. Today the cells render with `formatTotal` (no symbol) — switch to `formatCurrencyAmount(value, asset.currency)`.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

const cadAsset = {
  PK: "HOUSEHOLD#h1", SK: "ASSET#cad", id: "cad", profileId: "h1", type: "ASSET" as const,
  account: "TFSA", ticker: "VFV.TO", securityType: "ETF", strategyType: "Index", call: "",
  sector: "IT", market: "Canada", currency: "CAD",
  managementStyle: "", externalRating: "", managementFee: null,
  quantity: 50, liveTickerPrice: 100, bookCost: 4000, marketValue: 5000, profitLoss: 1000,
  yield: 0, oneYearReturn: 0.10, fiveYearReturn: null, threeYearReturn: null,
  exDividendDate: "", analystConsensus: "", beta: 0, riskFlag: "",
  accountNumber: "", accountType: "TFSA", risk: "", volatility: 0, expectedAnnualDividends: 0,
  updatedAt: "2026-05-04T00:00:00.000Z",
};
const usdAsset = {
  ...cadAsset, SK: "ASSET#usd", id: "usd", account: "RRSP", ticker: "AAPL",
  market: "US", currency: "USD",
  quantity: 100, liveTickerPrice: 200, bookCost: 15000, marketValue: 20000, profitLoss: 5000,
};

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (typeof url === "string" && url.includes("/api/profile")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          assets: [cadAsset, usdAsset],
          portfolioTotals: {
            cadTotal: 5000,
            usdTotal: 20000,
            grandTotalCad: 32000, // 5000 + 20000 * 1.35
            usdToCadRate: 1.35,
            fxUnavailable: false,
          },
          columnVisibility: {},
        }),
      }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

describe("Holdings — multi-currency contract", () => {
  it("renders ONE Total Market Value badge with CAD grand total", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("VFV.TO")).toBeInTheDocument();
    // Single badge headline shows CAD grand total
    expect(screen.getByText("$32,000")).toBeInTheDocument();
    // FX rate footnote present
    expect(screen.getByText(/at 1 USD = 1\.3500 CAD/)).toBeInTheDocument();
  });

  it("does NOT render the legacy duplicate FX Portfolio Totals panel", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("VFV.TO")).toBeInTheDocument();
    // The old panel had distinct labels "CAD Portfolio" and "USD Portfolio".
    // After collapse, neither label appears — they're replaced by per-currency subtotals.
    expect(screen.queryByText("CAD Portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("USD Portfolio")).not.toBeInTheDocument();
  });

  it("renders per-currency subtotals inside the same badge", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("VFV.TO")).toBeInTheDocument();
    expect(screen.getByText("$5,000 CAD")).toBeInTheDocument();
    expect(screen.getByText("US$20,000")).toBeInTheDocument();
  });

  it("renders USD asset row Book Cost and Market Value with US$ symbol", async () => {
    render(<DashboardPage />);
    const aaplRow = (await screen.findByText("AAPL")).closest("tr")!;
    expect(within(aaplRow).getByText("US$15,000")).toBeInTheDocument(); // bookCost
    expect(within(aaplRow).getByText("US$20,000")).toBeInTheDocument(); // marketValue
  });

  it("renders CAD asset row Book Cost and Market Value with bare $ symbol", async () => {
    render(<DashboardPage />);
    const vfvRow = (await screen.findByText("VFV.TO")).closest("tr")!;
    expect(within(vfvRow).getByText("$4,000")).toBeInTheDocument();
    expect(within(vfvRow).getByText("$5,000")).toBeInTheDocument();
  });

  it("falls back gracefully when FX is unavailable", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/profile")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            assets: [cadAsset, usdAsset],
            portfolioTotals: { cadTotal: 5000, usdTotal: 20000, grandTotalCad: 5000, usdToCadRate: null, fxUnavailable: true },
            columnVisibility: {},
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<DashboardPage />);
    expect(await screen.findByText("VFV.TO")).toBeInTheDocument();
    expect(screen.getByText(/FX rate unavailable/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx -i`
Expected: FAIL — the legacy "CAD Portfolio" / "USD Portfolio" labels still render; row cells lack the `US$` prefix.

- [ ] **Step 3: Update the KPI grid + the row-level cells**

Replace lines 882–935 (the KPI grid + FX panel) in `src/app/dashboard/DashboardClient.tsx` with:

```tsx
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Total Market Value — single badge, CAD-aggregating */}
            <div className="glass-panel p-4 md:p-6 flex flex-col justify-center min-w-0">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Total Market Value</span>
              <h3 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center break-words">
                {portfolioTotals?.fxUnavailable
                  ? <span className="text-base font-medium">FX rate unavailable</span>
                  : <>${formatTotal(portfolioTotals?.grandTotalCad ?? totalMarketValue)}</>}
                {isMarketLoading && <Loader2 className="h-4 w-4 animate-spin ml-3 text-teal-600" />}
              </h3>
              {portfolioTotals && (
                <div className="mt-3 flex flex-col gap-1 text-xs text-neutral-500 dark:text-neutral-400">
                  <div className="flex justify-between gap-4">
                    <span>CAD subtotal</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">${formatTotal(portfolioTotals.cadTotal)} CAD</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span>USD subtotal</span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">US${formatTotal(portfolioTotals.usdTotal)}</span>
                  </div>
                  {!portfolioTotals.fxUnavailable && portfolioTotals.usdToCadRate && (
                    <span className="text-neutral-400 dark:text-neutral-500">at 1 USD = {portfolioTotals.usdToCadRate.toFixed(4)} CAD · as of today</span>
                  )}
                  {portfolioTotals.fxUnavailable && (
                    <span className="text-neutral-400 dark:text-neutral-500">Showing per-currency subtotals only</span>
                  )}
                </div>
              )}
            </div>
            <div className="glass-panel p-4 md:p-6 flex flex-col justify-center min-w-0">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Total Return</span>
              <h3 className={`text-2xl md:text-3xl font-semibold ${totalReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {formatTopPercent(totalReturn / 100)}
              </h3>
            </div>
            <div className="glass-panel p-4 md:p-6 flex flex-col justify-center min-w-0">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Avg Dividend Yield</span>
              <h3 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                {formatTopPercent(portfolioDividendYield, { withSign: false })}
              </h3>
            </div>
          </div>
```

(That deletes the entire separate "FX Portfolio Totals" panel block at 906–935 — it's gone, folded into the badge.)

Add `formatCurrencyAmount` to the existing import from `@/lib/decimalFormat`.

For row-level Book Cost (line 1330) and Market Value (line 1334) cells: change the *display-mode* render path inside `renderField`. Locate the `'number'` branch in the display path (around lines 1150–1155):

```tsx
if (type === 'number') {
  if (displayValue === null || displayValue === undefined || typeof displayValue !== 'number') {
    content = <NotFoundCell />;
  } else {
    content = <span className={bgClass ? `px-2 py-0.5 rounded ${bgClass}` : ''}>{formatTotal(displayValue)}</span>;
  }
}
```

`renderField` doesn't know which asset it's rendering for, so currency-aware formatting can't live inside it. Instead, replace the two specific cell renders at lines 1330 and 1334 with explicit formatters:

```tsx
{/* 15. Book Cost */}
{isVisible("bookCost") && (
<td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
  {isEditing
    ? renderField("bookCost", false, [], "number")
    : <span>{formatCurrencyAmount(asset.bookCost, asset.currency)}</span>}
</td>
)}
{/* 16. Market Value */}
{isVisible("marketValue") && (
<td className="px-3 py-3 text-neutral-700 dark:text-neutral-300 font-semibold">
  {isEditing
    ? renderField("marketValue", false, [], "number")
    : <span>{formatCurrencyAmount(asset.marketValue, asset.currency)}</span>}
</td>
)}
```

Live $ at line 1303 stays as-is (it already prefixes a bare `$`). When Task 7 lands, this formatter gets reused in the inline-edit path; for now it's display-only.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx -i`
Expected: PASS.

Re-run the full Dashboard suite:

Run: `npx jest src/app/dashboard -i`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/dashboard/__tests__/HoldingsTable-multicurrency.test.tsx
git commit -m "feat(holdings): single Total Market Value badge + native-currency row cells"
```

---

## Task 5: Sticky header + Exchange filter/sort + iPad-portrait KPI fit

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (lines 974–977 sticky header; lines 988–991 Exchange header; line 1022 Exchange filter cell; lines 882–935 KPI grid already touched in Task 4)

**Why:** Spec definition-of-done items: "Sticky header — title row locked to viewport top during vertical scroll", "Every column is filterable, sortable, or both", "Total Market Value box renders cleanly at iPad-portrait width." Today (1) the `<thead>` has `sticky top-0` but its anchor is the table's `max-h-[75vh]` scroll container (line 974) — it pins to the table, not the page viewport. (2) Exchange has neither a sortable header nor a filter input. (3) iPad-portrait at 768px is exactly the `md:` breakpoint — the 3-column KPI grid kicks in but the badge content (now richer thanks to Task 4 sub-totals) may still overflow with the largest values; Task 4 already added `min-w-0` and reduced text size at md, but a manual repro is required.

**Sticky header decision:** the table's outer wrapper has `overflow-x-auto max-h-[75vh]` (line 974). Removing `max-h-[75vh]` lets the page itself scroll, and `<thead>`'s `sticky top-0` becomes viewport-relative because there's no nearer scroll ancestor. The trade-off: very long tables become viewport-tall — that's the desired UX. The header bar above the table (`<header>` at line 788) is *also* sticky (`sticky top-0 z-10`) and remains pinned, so the page scroll has the page header on top + table header just below it. We'll set the table `<thead>` to `sticky top-[4rem]` to clear the 4rem (64px) page header, matching the `min-h-[4rem]` on the header.

**Exchange completeness:** add `renderSortableHeader("Exchange", "exchangeName", ...)` in place of the static `<th>` at line 988–991. (Sorting by `exchangeName` matches the displayed text.) Add `renderFilterInput("exchangeName")` in place of the empty `<td>` at line 1022. Keep the existing `ExchangeCell` body — only the column-chrome wrappers change.

- [ ] **Step 1: Replace the table scroll container line**

In `src/app/dashboard/DashboardClient.tsx` line 974, change:

```tsx
<div className="overflow-x-auto max-h-[75vh]">
```

to:

```tsx
<div className="overflow-x-auto">
```

That removes the inner vertical scroll, so the page itself becomes the scroll context.

- [ ] **Step 2: Reparent the sticky header to viewport coords**

In line 976, change:

```tsx
<thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-medium transition-colors duration-300 sticky top-0 z-20">
```

to:

```tsx
<thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-medium transition-colors duration-300 sticky top-16 z-20">
```

(`top-16` = `top-[4rem]` = 64px, clearing the page header.)

- [ ] **Step 3: Add Exchange sortable header + filter**

In line 988, replace:

```tsx
{isVisible("exchange") && (
  <th className="px-3 py-2 text-left text-xs font-medium text-neutral-500 uppercase tracking-wider whitespace-nowrap">
    Exchange
  </th>
)}
```

with:

```tsx
{isVisible("exchange") && renderSortableHeader("Exchange", "exchangeName")}
```

And in line 1022, replace:

```tsx
{isVisible("exchange") && <td className="px-2 py-2" />}
```

with:

```tsx
{isVisible("exchange") && renderFilterInput("exchangeName")}
```

- [ ] **Step 4: Manual UI repro on iPad portrait**

This is a manual check (no test). Run the dev server (`npm run dev`), open Chrome DevTools, set the viewport to "iPad Mini" (768 × 1024) in portrait, then:

- Total Market Value badge (badge headline + 2 subtotals + FX footnote) fits inside the 1/3-width column without horizontal overflow. The headline `$XX,XXX,XXX` (whole-dollar total) at `text-2xl` should fit a 7-figure value. If a real-world user crosses 8 figures and overflow returns, log a project memory and either drop the headline to `text-xl` at md OR collapse to a single column at md. For the first ship, `text-2xl md:text-3xl` (Task 4 already applied this) is the working choice.
- Total Return and Avg Dividend Yield boxes likewise.
- Holdings table horizontal scroll works; the sticky `<thead>` stays pinned 64px below the page top while scrolling vertically.

Report back what was observed. If overflow is seen, drop `md:text-3xl` to `md:text-2xl` and `text-2xl` to `text-xl` in the three KPI badges (Task 4 lines), then re-screenshot.

- [ ] **Step 5: Run tests + commit**

Run: `npx jest src/app/dashboard -i`
Expected: PASS — no test was looking for `max-h-[75vh]` or the static Exchange `<th>`.

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(holdings): viewport-anchored sticky header + Exchange filter/sort + iPad-portrait fit"
```

---

## Task 6: Extract `InlineEditableCell`

**Files:**
- Create: `src/app/dashboard/InlineEditableCell.tsx`
- Create: `src/app/dashboard/__tests__/InlineEditableCell.test.tsx`

**Why:** Task 7 will replace the row-mode pencil/save flow with per-cell editing on every editable column. To do that without copy-pasting the `ExchangeCell` shape twenty times, we extract a generic `InlineEditableCell` first. It owns: local edit state, click-to-edit, on-save call (the consumer supplies the save fn), on-cancel (Esc / click-away), and display formatting via a render-prop. Every classification cell (sector, market, currency, etc.) is a `<select>` variant; numeric cells (qty, prices, etc.) are an `<input type="number">` variant; free-text cells (account name, ticker) are an `<input type="text">` variant.

**API:** generic over the field type. Single component, mode picked by `kind: "text" | "number" | "select"`.

```ts
interface InlineEditableCellProps<V extends string | number | null> {
  value: V;
  kind: "text" | "number" | "select";
  options?: string[];                     // required when kind === "select"
  display?: (value: V) => React.ReactNode; // optional custom display (else uses sensible default)
  onSave: (next: V) => Promise<void>;     // consumer handles the round-trip
  disabled?: boolean;                     // e.g., locked field cannot be edited
  ariaLabel: string;                      // e.g., "Edit quantity for AAPL"
  inputClassName?: string;                // for width / padding tweaks per column
}
```

Behavior:
- Display mode: render `display(value)` (or the bare value if no `display` prop). Click → enter edit mode.
- Edit mode: render the appropriate input pre-filled with `value`. Save button + Cancel button on a small flex row, like `ExchangeCell`. Pressing Enter (text/number) is equivalent to Save. Pressing Esc is Cancel.
- On save: call `onSave(next)`. If it rejects, stay in edit mode and surface an error indicator (red border for the input).
- `disabled === true`: render display-only (used for locked classification fields whose lock the user must explicitly unlock first).

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/__tests__/InlineEditableCell.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineEditableCell } from "../InlineEditableCell";

describe("InlineEditableCell", () => {
  it("renders display value initially", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("clicks display to enter edit mode and shows the input", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("calls onSave with the new value when Save is clicked", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("world");
  });

  it("returns to display mode after a successful save", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    // After resolution, display mode shows the new value.
    expect(await screen.findByText("world")).toBeInTheDocument();
  });

  it("does NOT call onSave when Cancel is clicked", () => {
    const onSave = jest.fn();
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Esc key cancels edit mode", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.keyDown(screen.getByDisplayValue("hello"), { key: "Escape" });
    expect(screen.queryByDisplayValue("hello")).not.toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Enter key saves in text mode", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.keyDown(screen.getByDisplayValue("world"), { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("world");
  });

  it("number kind parses input to number on save", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="number" value={100} onSave={onSave} ariaLabel="edit-qty" />);
    fireEvent.click(screen.getByText("100"));
    fireEvent.change(screen.getByDisplayValue("100"), { target: { value: "150" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(150);
  });

  it("select kind renders an option list and saves the selected value", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="select" value="A" options={["A", "B", "C"]} onSave={onSave} ariaLabel="edit-class" />);
    fireEvent.click(screen.getByText("A"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "B" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("B");
  });

  it("disabled cell does not enter edit mode on click", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} disabled ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    expect(screen.queryByDisplayValue("hello")).not.toBeInTheDocument();
  });

  it("stays in edit mode if onSave rejects", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("nope"));
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    // Wait one tick for the rejection to settle.
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByDisplayValue("world")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/__tests__/InlineEditableCell.test.tsx -i`
Expected: FAIL — `Cannot find module '../InlineEditableCell'`.

- [ ] **Step 3: Write the implementation**

Create `src/app/dashboard/InlineEditableCell.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";

type CellValue = string | number | null;

interface InlineEditableCellProps {
  value: CellValue;
  kind: "text" | "number" | "select";
  options?: string[];
  display?: (value: CellValue) => React.ReactNode;
  onSave: (next: CellValue) => Promise<void>;
  disabled?: boolean;
  ariaLabel: string;
  inputClassName?: string;
}

export function InlineEditableCell({
  value,
  kind,
  options = [],
  display,
  onSave,
  disabled,
  ariaLabel,
  inputClassName = "",
}: InlineEditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(value === null || value === undefined ? "" : String(value));
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  // Re-sync draft if the parent's value changes while the cell is closed
  // (e.g., after a refetch). When editing is open, leave the draft alone.
  useEffect(() => {
    if (!editing) setDraft(value === null || value === undefined ? "" : String(value));
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const enterEdit = () => {
    if (disabled) return;
    setEditing(true);
    setError(false);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value === null || value === undefined ? "" : String(value));
    setError(false);
  };

  const commit = async () => {
    setSaving(true);
    setError(false);
    try {
      const next: CellValue = kind === "number"
        ? (draft === "" ? null : Number(draft))
        : draft;
      await onSave(next);
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && kind !== "select") {
      e.preventDefault();
      void commit();
    }
  };

  if (!editing) {
    const rendered = display ? display(value) : (value === null || value === undefined || value === "" ? "—" : String(value));
    return (
      <button
        type="button"
        onClick={enterEdit}
        aria-label={ariaLabel}
        className={`text-left ${disabled ? "cursor-not-allowed opacity-70" : "hover:text-teal-600 dark:hover:text-teal-400"} transition-colors`}
        disabled={disabled}
      >
        {rendered}
      </button>
    );
  }

  const errorRing = error ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700";
  const baseInput = `text-xs rounded border ${errorRing} px-1 py-0.5 bg-white dark:bg-neutral-900 ${inputClassName}`;

  return (
    <div className="flex flex-col gap-1">
      {kind === "select" ? (
        <select
          ref={el => (inputRef.current = el)}
          className={baseInput}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
        >
          <option value="" />
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          ref={el => (inputRef.current = el)}
          type={kind === "number" ? "number" : "text"}
          className={baseInput}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
        />
      )}
      <div className="flex gap-1">
        <button onClick={() => void commit()} disabled={saving} className="text-xs text-teal-600 dark:text-teal-400 font-medium disabled:opacity-50">Save</button>
        <button onClick={cancel} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/app/dashboard/__tests__/InlineEditableCell.test.tsx -i`
Expected: PASS — all 11 assertions green.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/InlineEditableCell.tsx src/app/dashboard/__tests__/InlineEditableCell.test.tsx
git commit -m "feat(holdings): InlineEditableCell — generic per-cell editor"
```

---

## Task 7: Apply `InlineEditableCell` across the Holdings table

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (delete `editingId`/`editForm` row-mode state for **existing** rows; replace pencil/save controls; replace each editable cell render with `InlineEditableCell`; keep edit-mode for the "Add Row" path only)
- Create: `src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx`

**Why:** Spec definition-of-done: "Tapping any editable cell on phone/tablet enters inline edit; no 'edit mode' detour." The Exchange column already uses this pattern. Generalizing it across the table eliminates the pencil/save row controls. New row creation still needs row-wide entry (many empty fields at once), so the "Add Row" path continues to use `editingId === "NEW"` mode — only the *existing-row* path changes.

**Save semantics — the partial-PUT contract:** every cell save calls `PUT /api/assets/{id}` with **only the field(s) changed** plus `expectedUpdatedAt: asset.updatedAt`. The route already merges incoming fields onto the existing DB row (5G's exchange-save behavior, line 144 above), and 5A added `expectedUpdatedAt` enforcement on the PUT path. Sending the full row (today's behavior) would race with concurrent edits across cells; sending only the diffed field plus `expectedUpdatedAt` is the right shape and is already what `handleExchangeSave` does. Add a tiny helper `saveAssetField(assetId, patch, expectedUpdatedAt)` that wraps this fetch + 409 handling; reuse for every column.

**Locked classification fields:** `sector`, `market`, `securityType`, `strategyType`, `call`, `managementStyle`, `currency`, `managementFee`, `exchange` are lockable. When `asset.userOverrides?.[field] === true`, the existing UI shows a Lock icon + click-to-unlock. Inline-edit must preserve this: when locked, `InlineEditableCell` is `disabled` and the existing `LockedFieldIcon` renders next to it. When the user unlocks (PATCH `/api/assets/{id}/lock`), the cell becomes editable on the next render. When the user *edits* a lockable cell, the save patch must also set `userOverrides.{field} = true` (matching the existing `setFieldWithLock` semantics at line 404).

**Ticker change special case:** today, editing the ticker triggers an auto-lookup that cascades classification fields (handleTickerLookup at line 607). Inline-cell editing of the ticker keeps that behavior, but it now happens on cell-save (not on input blur during row-edit-mode). The flow: user edits ticker cell → save → server PUT with `{ticker: "NEW"}` → after success, run `handleTickerLookup("NEW")` → that produces a patch (sector, market, security type, etc.) → fire one more PUT with those fields. Two saves in sequence is acceptable; a single transaction is overkill for the first ship.

**Currency mismatch handling:** the existing `mismatchState` flow (line 1408–1440) only triggers from `handleTickerLookup` while in row-edit-mode (`editingId` set). Migrate: after a ticker-cell save triggers a lookup, if the lookup returns `currencyMismatch`, surface the existing mismatch banner *as a toast or inline message at the row* rather than expanding the row. Simplest first ship: render the mismatch UI as part of the row's existing `<Fragment>`, using a piece of local state per row. **Or** — leave the row-mode flow as fallback for currency mismatches (rare, only triggers on cross-exchange lookup) and instruct users to use the row-mode pencil for those edge cases. **Decision: for first ship, treat currency-mismatch as the one path that still uses row-mode.** The pencil button stays available *only* for `needsExchangeReview` rows or after a currency-mismatch is detected during ticker-cell save. Document this as a fast-follow.

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

const baseAsset = {
  PK: "HOUSEHOLD#h1", SK: "ASSET#a1", id: "a1", profileId: "h1", type: "ASSET" as const,
  account: "RRSP", ticker: "AAPL", securityType: "Stock", strategyType: "Growth", call: "",
  sector: "IT", market: "US", currency: "USD", managementStyle: "", externalRating: "",
  managementFee: null, quantity: 100, liveTickerPrice: 200, bookCost: 15000, marketValue: 20000, profitLoss: 5000,
  yield: 0.012, oneYearReturn: 0.187, fiveYearReturn: null, threeYearReturn: 0.092,
  exDividendDate: "", analystConsensus: "", beta: 1.1, riskFlag: "",
  accountNumber: "", accountType: "RRSP", risk: "", volatility: 0, expectedAnnualDividends: 240,
  updatedAt: "2026-05-04T00:00:00.000Z",
};

beforeEach(() => {
  global.fetch = jest.fn((url, init) => {
    if (typeof url === "string" && url.includes("/api/profile")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          assets: [baseAsset],
          portfolioTotals: { cadTotal: 0, usdTotal: 20000, grandTotalCad: 27000, usdToCadRate: 1.35, fxUnavailable: false },
          columnVisibility: {},
        }),
      }) as unknown as ReturnType<typeof fetch>;
    }
    if (typeof url === "string" && url.startsWith("/api/assets/a1") && (init?.method === "PUT")) {
      return Promise.resolve({ ok: true, json: async () => ({ asset: { ...baseAsset } }) }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

describe("Holdings table — inline editing", () => {
  it("does NOT render a row-level pencil/edit button", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    const row = screen.getByText("AAPL").closest("tr")!;
    // The legacy edit pencil's aria-label was implicit; assert by absence of the title.
    expect(within(row).queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();
  });

  it("clicking a quantity cell enters inline edit", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    const row = screen.getByText("AAPL").closest("tr")!;
    const qtyCell = within(row).getByText("100");
    fireEvent.click(qtyCell);
    expect(within(row).getByDisplayValue("100")).toBeInTheDocument();
    expect(within(row).getByText("Save")).toBeInTheDocument();
    expect(within(row).getByText("Cancel")).toBeInTheDocument();
  });

  it("saves a quantity edit via partial-PUT with expectedUpdatedAt", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    const row = screen.getByText("AAPL").closest("tr")!;
    fireEvent.click(within(row).getByText("100"));
    fireEvent.change(within(row).getByDisplayValue("100"), { target: { value: "150" } });
    fireEvent.click(within(row).getByText("Save"));
    // Wait for the save to settle.
    await new Promise(r => setTimeout(r, 0));
    const fetchMock = global.fetch as jest.Mock;
    const putCall = fetchMock.mock.calls.find(([u, init]) => typeof u === "string" && u === "/api/assets/a1" && init?.method === "PUT");
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body).toEqual({
      quantity: 150,
      expectedUpdatedAt: "2026-05-04T00:00:00.000Z",
    });
  });

  it("renders a Lock icon and disables the cell for a locked classification field", async () => {
    const locked = { ...baseAsset, userOverrides: { sector: true } };
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/profile")) {
        return Promise.resolve({ ok: true, json: async () => ({
          assets: [locked],
          portfolioTotals: { cadTotal: 0, usdTotal: 20000, grandTotalCad: 27000, usdToCadRate: 1.35, fxUnavailable: false },
          columnVisibility: {},
        }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    const row = screen.getByText("AAPL").closest("tr")!;
    // Sector cell is locked → click does NOT enter edit mode.
    const sectorCell = within(row).getByText("IT");
    fireEvent.click(sectorCell);
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("editing a lockable field sets userOverrides.{field} = true in the patch", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    const row = screen.getByText("AAPL").closest("tr")!;
    fireEvent.click(within(row).getByText("IT"));
    // Sector dropdown
    fireEvent.change(within(row).getByRole("combobox"), { target: { value: "Healthcare" } });
    fireEvent.click(within(row).getByText("Save"));
    await new Promise(r => setTimeout(r, 0));
    const fetchMock = global.fetch as jest.Mock;
    const putCall = fetchMock.mock.calls.find(([u, init]) => typeof u === "string" && u === "/api/assets/a1" && init?.method === "PUT");
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.sector).toBe("Healthcare");
    expect(body.userOverrides).toEqual({ sector: true });
    expect(body.expectedUpdatedAt).toBe("2026-05-04T00:00:00.000Z");
  });

  it("Add Row still uses row-mode (NEW path unchanged)", async () => {
    render(<DashboardPage />);
    expect(await screen.findByText("AAPL")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Add Row"));
    // Empty new-row UI appears — at least one bare text input renders for ticker.
    // The exact assertion is loose because new-row layout depends on column visibility;
    // assert that a Save button (row-level) appears for the new row.
    const newRow = screen.getAllByRole("row").at(-2)!; // last row before totals
    expect(within(newRow).getByRole("button", { name: /save/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx -i`
Expected: FAIL — pencil button is still present, qty cells don't open `InlineEditableCell`, saves go via the legacy full-row path.

- [ ] **Step 3: Add the partial-save helper**

In `src/app/dashboard/DashboardClient.tsx`, add (near the other handlers, around line 444):

```ts
const saveAssetField = useCallback(
  async (assetId: string, patch: Partial<Asset>, expectedUpdatedAt: string | undefined) => {
    const body = expectedUpdatedAt ? { ...patch, expectedUpdatedAt } : patch;
    const res = await fetch(`/api/assets/${assetId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) {
      setMessage({ text: "This asset was changed in another tab/device. Refreshing now.", type: "error" });
      await fetchAssets();
      throw new Error("conflict");
    }
    if (!res.ok) throw new Error("Failed to save asset");
    await fetchAssets();
  },
  [], // fetchAssets / setMessage are stable enough; lint may suggest deps
);
```

- [ ] **Step 4: Replace each editable cell render with `InlineEditableCell`**

Import the component:

```ts
import { InlineEditableCell } from "./InlineEditableCell";
```

(Tasks 2 and 4 already added the `decimalFormat` imports — they stay as they are.)

For each editable column inside the row map (lines 1186–1407), replace the existing `renderField(...)` invocation with an `<InlineEditableCell>` render. The pattern for a numeric cell:

```tsx
<InlineEditableCell
  kind="number"
  value={asset.quantity}
  display={v => formatQuantity(typeof v === "number" ? v : null)}
  ariaLabel={`Edit quantity for ${asset.ticker}`}
  onSave={async next => {
    await saveAssetField(asset.id, { quantity: next as number }, asset.updatedAt);
  }}
/>
```

For a select cell (lockable classification):

```tsx
const sectorLocked = asset.userOverrides?.sector === true;
return (
  <span className="inline-flex items-center">
    <LockedFieldIcon
      isLocked={sectorLocked}
      onUnlock={() => handleUnlockField(asset, "sector")}
      label={LOCKABLE_FIELD_LABELS.sector}
    />
    <InlineEditableCell
      kind="select"
      value={asset.sector}
      options={sectors}
      disabled={sectorLocked}
      ariaLabel={`Edit sector for ${asset.ticker}`}
      onSave={async next => {
        await saveAssetField(
          asset.id,
          { sector: (next ?? "") as string, userOverrides: { ...asset.userOverrides, sector: true } },
          asset.updatedAt,
        );
      }}
    />
  </span>
);
```

Apply this shape to: `securityType`, `strategyType`, `call`, `sector`, `market`, `currency`, `managementStyle`, `managementFee`. (`exchange` keeps `ExchangeCell` — its lookup-after-save logic is special.)

For non-lockable simple text fields (`account`, `accountType`, `accountNumber`, `externalRating`, `exDividendDate`, `analystConsensus`):

```tsx
<InlineEditableCell
  kind="text"
  value={asset.account}
  ariaLabel={`Edit account for ${asset.ticker}`}
  onSave={async next => {
    await saveAssetField(asset.id, { account: (next ?? "") as string }, asset.updatedAt);
  }}
/>
```

For numeric editable cells (`quantity`, `liveTickerPrice`, `bookCost`, `marketValue`, `profitLoss`, `yield`, `oneYearReturn`, `threeYearReturn`, `beta`, `expectedAnnualDividends`):

```tsx
<InlineEditableCell
  kind="number"
  value={asset.bookCost}
  display={v => formatCurrencyAmount(typeof v === "number" ? v : null, asset.currency)}
  ariaLabel={`Edit book cost for ${asset.ticker}`}
  onSave={async next => {
    await saveAssetField(asset.id, { bookCost: next as number }, asset.updatedAt);
  }}
/>
```

For `yield`, `oneYearReturn`, `threeYearReturn`: `display={v => formatRowPercent(typeof v === "number" ? v : null)}`.

For ticker editing (special — triggers lookup after save):

```tsx
<InlineEditableCell
  kind="text"
  value={asset.ticker}
  display={v => <span className="font-bold">{v ?? "—"}</span>}
  ariaLabel={`Edit ticker for ${asset.ticker}`}
  onSave={async next => {
    const newTicker = String(next ?? "").toUpperCase();
    if (!newTicker) return;
    await saveAssetField(asset.id, { ticker: newTicker }, asset.updatedAt);
    // After persisting, rerun the lookup which produces the classification cascade.
    // handleTickerLookup operates on editForm/editingId today — pull the classification
    // body it builds and apply via saveAssetField. Simplest: dispatch a second fetch
    // to /api/ticker-lookup, then PUT the resulting patch.
    const lookupRes = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(newTicker)}&assetId=${asset.id}`);
    if (lookupRes.ok) {
      const lookup = await lookupRes.json();
      if (lookup.currencyMismatch) {
        setMismatchState({ symbol: newTicker, detectedCurrency: lookup.detectedCurrency ?? "Unknown", storedCurrency: asset.currency ?? "Unknown" });
        return;
      }
      // applyLookupRespectingLocks needs the persisted-prior asset (from server), not the just-saved one.
      const patch = applyLookupRespectingLocks({ ...asset, ticker: asset.ticker /* pre-edit */ }, { ...lookup, symbol: newTicker });
      // Re-fetch so the next save's expectedUpdatedAt is fresh, then apply the patch.
      await fetchAssets();
      const fresh = await fetch("/api/profile").then(r => r.json());
      const refreshed = (fresh.assets as Asset[]).find(a => a.id === asset.id);
      if (refreshed) {
        await saveAssetField(asset.id, patch, refreshed.updatedAt);
      }
    }
  }}
/>
```

(The double-fetch + double-save is verbose; mark this as a candidate for fast-follow consolidation in the parking lot below.)

- [ ] **Step 5: Remove the row-level pencil/save controls for existing rows; keep them for NEW**

In the Actions cell (line 1392–1407), change:

```tsx
<td className="px-3 py-3 text-right">
  <div className="flex items-center justify-end space-x-2">
    {isEditing ? (
      <button onClick={saveEdit} disabled={isSaving} className="text-teal-600 hover:text-teal-700 dark:text-teal-500 p-1">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </button>
    ) : (
      <>
        <button onClick={() => startEdit(asset)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 className="h-4 w-4" /></button>
        <button onClick={() => handleDeleteAsset(asset.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
      </>
    )}
  </div>
</td>
```

to:

```tsx
<td className="px-3 py-3 text-right">
  <div className="flex items-center justify-end space-x-2">
    {isEditing ? (
      <button onClick={saveEdit} disabled={isSaving} className="text-teal-600 hover:text-teal-700 dark:text-teal-500 p-1" aria-label="Save new row">
        {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
      </button>
    ) : (
      <button onClick={() => handleDeleteAsset(asset.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1" aria-label={`Delete ${asset.ticker}`}><Trash2 className="h-4 w-4" /></button>
    )}
  </div>
</td>
```

(Pencil gone for existing rows. Save button only appears for the NEW row. Delete button always available.)

- [ ] **Step 6: Run test to verify it passes**

Run: `npx jest src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx -i`
Expected: PASS — all 6 assertions green.

Run: `npx jest src/app/dashboard -i`
Expected: PASS — Dashboard suite (esp. 409-handling) still green.

Run: `npx jest -i` (full suite)
Expected: 323+ tests pass (5A baseline plus the 5B additions).

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/dashboard/__tests__/HoldingsTable-inline-edit.test.tsx
git commit -m "feat(holdings): inline-edit every editable cell; remove pencil row-mode for existing rows"
```

---

## Task 8: Update the data-flow doc with the 5B currency contract

**Files:**
- Modify: `docs/superpowers/specs/2026-05-03-5a-data-flow.md`

**Why:** The data-flow doc is the durable artifact future contributors will read. Lock the 5B-introduced contract there: row cells render in the asset's native currency; only the top Total Market Value badge converts to CAD.

- [ ] **Step 1: Append the new section**

At the end of `docs/superpowers/specs/2026-05-03-5a-data-flow.md` (after the "Why this contract exists" section), append:

```markdown
## Currency display contract (5B)

- **Row-level cells (Book Cost, Market Value)** render in the asset's *native* currency. A `currency: "USD"` asset shows `US$X,XXX`; `currency: "CAD"` shows `$X,XXX`. No FX conversion happens at the row level. See `formatCurrencyAmount` in `src/lib/decimalFormat.ts`.
- **Top "Total Market Value" badge** is the single place that aggregates to CAD using daily FX. Powered by `computePortfolioTotals(assets, fxRate)` which produces `{cadTotal, usdTotal, grandTotalCad, usdToCadRate, fxUnavailable}`. The badge renders the grand total as the headline and the per-currency subtotals as a sub-line.
- **FX failure mode:** when the daily Yahoo FX call rejects, `fxRate` is `null`, `portfolioTotals.fxUnavailable` is `true`, the headline reads "FX rate unavailable" and the per-currency subtotals are still shown.
- **Decimal rule** (5B): prices, quantities, and totals render at 0 decimals via `src/lib/decimalFormat.ts` helpers. Row-level Yield % / 1YR / 3YR Return % render at 1 decimal. Top-of-page Total Return + Avg Dividend Yield render at 2 decimals.

See `docs/superpowers/specs/2026-05-03-phase5-prioritization-breakdown-design.md` § "5B — Holdings Table (UX + Multi-Currency)" for the originating spec.
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-05-03-5a-data-flow.md
git commit -m "docs(data-flow): lock 5B currency display + decimal contract"
```

---

## Definition of done

After every task lands and the suite is green:

- [ ] Every column has a sortable header AND a filter input (Exchange now does too).
- [ ] Tapping any editable cell on phone/tablet enters inline edit; no detour through "edit mode" except for "Add Row" and the rare currency-mismatch path.
- [ ] Decimal rules audited: Holdings table cells, KPI badges, totals row, dividend summary, Finance Summary totals, Breakdown tooltips. (Strategy page is no-op — verified during planning.)
- [ ] Total Market Value badge renders cleanly at iPad-portrait (768 × 1024) — no horizontal overflow, no clipped FX footnote. Manual check.
- [ ] USD assets render `US$` symbol in their Book Cost / Market Value cells; CAD assets render bare `$`.
- [ ] CAD-equivalent grand total appears only at the top badge, not in row cells.
- [ ] Full Jest suite green (323+ tests) — 5A baseline preserved, 5B test files net-add.
- [ ] Data-flow doc updated with the 5B currency + decimal contract.

## Parking lot (5B-specific)

| Item | Why parked |
|---|---|
| Categorical filter dropdowns (currency, market, securityType selectors instead of free-text filter inputs) | Spec accepts "search input OR dropdown selector"; text inputs ship in 5B and dropdowns are a follow-up if Simone calls out poor UX |
| Single-transaction ticker-change + classification cascade (one PUT instead of two) | Two-PUT shape is functional for first ship; consolidating into one server-side endpoint is cleaner but not blocking |
| Row-mode pencil retirement for currency-mismatch rows | First ship retains row-mode as the fallback for the rare cross-exchange-currency-mismatch flow |
| Total Market Value box drop to single column at md breakpoint if 8-figure portfolios overflow at iPad-portrait | Manual repro in Task 5; if observed, downstream CSS tweak |

## Cross-references

- Spec: `docs/superpowers/specs/2026-05-03-phase5-prioritization-breakdown-design.md` § 5B
- Data-flow contract (5A): `docs/superpowers/specs/2026-05-03-5a-data-flow.md`
- 5G prior art: `docs/superpowers/plans/2026-05-03-exchange-aware-ticker-routing.md` (FX utility, `ExchangeCell`)
- 5A foundations: `docs/superpowers/plans/2026-05-03-5a-foundations.md` (optimistic concurrency PUT, `liveMergeAssets`)
- Branch: `feat/5b-holdings-table` off `feat/5a-foundations`

## Adversarial review

Per global instructions in `~/.claude/CLAUDE.md`, run `/codex:adversarial-review` at the end of the implementation cycle before declaring 5B ready for merge. Particular areas to attack:

- **Race conditions on partial-PUT** — if two cells in the same row are edited in quick succession, the second save's `expectedUpdatedAt` reads from the cached `asset` object, not the row that the first save just refreshed. Confirm `fetchAssets()` after each save closes this window.
- **Lockable-field bypass** — does `userOverrides.{field} = true` always travel with the patch when a user edits a locked-but-unlocked field? Or can the user unlock, edit, and have the lock stay off (intended) vs. accidentally re-lock without intending to?
- **Currency-mismatch fallback** — does the row-mode fallback still work for users on phone, where row-mode UI was already cramped?
- **Sticky header at 1024×768 iPad-landscape** — the 4rem clearance assumes the page header doesn't grow when nav crowds it. Verify visually.
- **Decimal rounding direction** — does `formatTotal(0.5)` round to `0` or `1`? The native `toLocaleString` uses banker's rounding; users watching dividends total at $99.50 → $100 may flag the rounding direction. Spec doesn't dictate — flag for Simone if she notices.
