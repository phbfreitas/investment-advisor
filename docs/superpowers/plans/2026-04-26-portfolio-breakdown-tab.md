# Portfolio Breakdown Tab Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second sub-tab "Breakdown" to `/dashboard` (My Investment Portfolio) showing portfolio composition donuts, top-10 concentration view, weighted yield, and heuristic drift signals — all client-derived from existing assets state.

**Architecture:** Refactor `DashboardClient` to host two sub-tabs (Holdings, Breakdown) with `?tab=` query-param routing. Extract the existing table to `HoldingsTab.tsx`. Introduce a `breakdown/` folder with three section components and pure computation functions in `breakdown/lib/`. Recharts powers all charts. No new API endpoints, no DynamoDB writes — all derivations memoized client-side.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Recharts (new), Jest, React Testing Library (new for component tests).

**Spec:** [docs/superpowers/specs/2026-04-26-portfolio-breakdown-tab-design.md](../specs/2026-04-26-portfolio-breakdown-tab-design.md)

---

## Phase 1 — Foundation

### Task 1: Install dependencies and configure Jest for component tests

**Files:**
- Modify: `package.json`
- Modify: `jest.config.ts`
- Create: `jest.setup.ts`

- [ ] **Step 1: Install Recharts**

Run: `npm install recharts@^3.2.0`
Expected: package added under `dependencies`.

- [ ] **Step 2: Install React Testing Library + jsdom**

Run: `npm install -D @testing-library/react @testing-library/jest-dom @testing-library/user-event jest-environment-jsdom`
Expected: four packages added under `devDependencies`.

- [ ] **Step 3: Update jest.config.ts to allow .tsx tests and load setup**

Replace the entire contents of `jest.config.ts` with:

```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/**/*.test.{ts,tsx}'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
};

export default config;
```

Note: `testEnvironment` stays `node`. Component tests opt in per-file via a `@jest-environment jsdom` docblock so existing node-flavored tests don't change behavior.

- [ ] **Step 4: Create jest.setup.ts**

Create `jest.setup.ts` at the repo root:

```typescript
import '@testing-library/jest-dom';
```

- [ ] **Step 5: Verify existing tests still pass**

Run: `npm test`
Expected: all existing tests pass (encryption suites). No new tests yet.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json jest.config.ts jest.setup.ts
git commit -m "chore: add Recharts and React Testing Library for portfolio breakdown tab"
```

---

### Task 2: Extract HoldingsTab from DashboardClient (no behavior change)

The existing `DashboardClient.tsx` is 1062 lines. Before adding the breakdown tab, extract the holdings UI to its own component. This is a pure refactor — every click, fetch, edit, and toast must behave identically afterward.

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`
- Create: `src/app/dashboard/HoldingsTab.tsx`

- [ ] **Step 1: Create HoldingsTab.tsx as a pass-through component**

Create `src/app/dashboard/HoldingsTab.tsx`:

```tsx
"use client";

import type { Asset, MarketData } from "@/types";

interface HoldingsTabProps {
  assets: Asset[];
  isLoading: boolean;
  marketData: Record<string, MarketData>;
  isMarketLoading: boolean;
  // The existing DashboardClient passes its full set of handlers/state down.
  // For the initial extraction, we accept everything as props rather than
  // dual-managing state. This keeps the diff a pure cut-and-paste.
  children: React.ReactNode;
}

export function HoldingsTab({ children }: HoldingsTabProps) {
  return <>{children}</>;
}
```

- [ ] **Step 2: Wrap the existing `<main>` body of DashboardClient in HoldingsTab**

In `src/app/dashboard/DashboardClient.tsx`, locate the `return (...)` block (around line 460). Wrap the entire `<main>...</main>` in `<HoldingsTab>`:

```tsx
import { HoldingsTab } from "./HoldingsTab";
// ...
return (
  <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
    <header /* ... unchanged ... */>
      {/* unchanged header */}
    </header>
    <HoldingsTab
      assets={assets}
      isLoading={isLoading}
      marketData={marketData}
      isMarketLoading={isMarketLoading}
    >
      <main /* ...existing main contents unchanged... */>
        {/* ...everything that was already here... */}
      </main>
    </HoldingsTab>
  </div>
);
```

The wrapper is currently a no-op pass-through. We're not moving logic yet — just establishing the boundary that PortfolioTabs will switch against in Task 3.

- [ ] **Step 3: Run dev server, verify Holdings page works identically**

Run: `npm run dev`
Open: `http://localhost:3000/dashboard`
Expected: page loads, table renders, all filters/sorts/edits work as before. No visual regression.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: no new warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/dashboard/HoldingsTab.tsx
git commit -m "refactor: wrap dashboard holdings UI in HoldingsTab boundary"
```

---

### Task 3: Build PortfolioTabs with query-param routing

**Files:**
- Create: `src/app/dashboard/PortfolioTabs.tsx`
- Create: `src/app/dashboard/__tests__/PortfolioTabs.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/__tests__/PortfolioTabs.test.tsx`:

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioTabs } from "../PortfolioTabs";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));

const mockSearch = { value: "" };

describe("PortfolioTabs", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearch.value = "";
  });

  it("renders Holdings as default active tab when query param missing", () => {
    render(
      <PortfolioTabs>
        <div data-testid="holdings-pane">HOLDINGS</div>
        <div data-testid="breakdown-pane">BREAKDOWN</div>
      </PortfolioTabs>
    );
    const holdings = screen.getByRole("tab", { name: /holdings/i });
    expect(holdings).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("holdings-pane")).toBeVisible();
  });

  it("activates Breakdown tab when ?tab=breakdown", () => {
    mockSearch.value = "tab=breakdown";
    render(
      <PortfolioTabs>
        <div data-testid="holdings-pane">HOLDINGS</div>
        <div data-testid="breakdown-pane">BREAKDOWN</div>
      </PortfolioTabs>
    );
    const breakdown = screen.getByRole("tab", { name: /breakdown/i });
    expect(breakdown).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("breakdown-pane")).toBeVisible();
  });

  it("calls router.replace with new tab when user clicks", async () => {
    render(
      <PortfolioTabs>
        <div>HOLDINGS</div>
        <div>BREAKDOWN</div>
      </PortfolioTabs>
    );
    await userEvent.click(screen.getByRole("tab", { name: /breakdown/i }));
    expect(mockReplace).toHaveBeenCalledWith("/dashboard?tab=breakdown", { scroll: false });
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- PortfolioTabs`
Expected: FAIL — module `../PortfolioTabs` not found.

- [ ] **Step 3: Implement PortfolioTabs**

Create `src/app/dashboard/PortfolioTabs.tsx`:

```tsx
"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type TabId = "holdings" | "breakdown";
const TAB_IDS: TabId[] = ["holdings", "breakdown"];

interface PortfolioTabsProps {
  /** Two children expected, in order: HoldingsTab content, then BreakdownTab content. */
  children: [ReactNode, ReactNode];
}

export function PortfolioTabs({ children }: PortfolioTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active: TabId = useMemo(() => {
    const v = searchParams.get("tab");
    return v === "breakdown" ? "breakdown" : "holdings";
  }, [searchParams]);

  const setTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "holdings") params.delete("tab");
      else params.set("tab", id);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const idx = TAB_IDS.indexOf(active);
    const next = TAB_IDS[(idx + (e.key === "ArrowRight" ? 1 : TAB_IDS.length - 1)) % TAB_IDS.length];
    setTab(next);
    e.preventDefault();
  };

  const [holdingsPane, breakdownPane] = children;

  return (
    <div className="flex flex-col flex-1">
      <div
        role="tablist"
        aria-label="Portfolio views"
        className="flex border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-[4rem] z-[5]"
        onKeyDown={onKeyDown}
      >
        {TAB_IDS.map((id) => {
          const selected = active === id;
          return (
            <button
              key={id}
              role="tab"
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(id)}
              className={[
                "min-h-[44px] px-4 md:px-6 text-sm font-medium transition-colors border-b-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
                selected
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
              ].join(" ")}
            >
              {id === "holdings" ? "Holdings" : "Breakdown"}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" hidden={active !== "holdings"} className={active !== "holdings" ? "hidden" : undefined}>
        {holdingsPane}
      </div>
      <div role="tabpanel" hidden={active !== "breakdown"} className={active !== "breakdown" ? "hidden" : undefined}>
        {breakdownPane}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test, expect pass**

Run: `npm test -- PortfolioTabs`
Expected: 3/3 pass.

- [ ] **Step 5: Wire PortfolioTabs into DashboardClient with a placeholder breakdown pane**

In `src/app/dashboard/DashboardClient.tsx`, replace the single `<HoldingsTab>...</HoldingsTab>` with:

```tsx
import { PortfolioTabs } from "./PortfolioTabs";
// ...
<PortfolioTabs>
  <HoldingsTab assets={assets} isLoading={isLoading} marketData={marketData} isMarketLoading={isMarketLoading}>
    <main /* ...existing main contents unchanged... */>
      {/* ... */}
    </main>
  </HoldingsTab>
  <div className="p-8 text-center text-neutral-500">Breakdown coming soon…</div>
</PortfolioTabs>
```

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`
Open: `http://localhost:3000/dashboard`
Expected: two tabs render under the header. Clicking "Breakdown" updates URL to `?tab=breakdown` and shows the placeholder. Browser back/forward switches tabs. Refresh keeps tab.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/PortfolioTabs.tsx src/app/dashboard/__tests__/PortfolioTabs.test.tsx src/app/dashboard/DashboardClient.tsx
git commit -m "feat: add PortfolioTabs shell with query-param routing"
```

---

## Phase 2 — Pure Computation

### Task 4: Define thresholds, colors, and shared types

**Files:**
- Create: `src/app/dashboard/breakdown/lib/thresholds.ts`
- Create: `src/app/dashboard/breakdown/lib/colors.ts`
- Create: `src/app/dashboard/breakdown/lib/types.ts`
- Create: `src/app/dashboard/breakdown/lib/__tests__/colors.test.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export type DriftSeverity = "red" | "warning" | "info";

export interface DriftSignal {
  id: string;
  severity: DriftSeverity;
  title: string;
  thresholdLabel: string;
  /** Tickers (or labels) of contributing assets, for accordion expansion. */
  contributors: Array<{ label: string; value: number; percent: number }>;
}

export interface BreakdownSlice {
  label: string;
  value: number;
  percent: number;
}

export interface DimensionBreakdown {
  /** Display title, e.g. "By Sector". */
  title: string;
  /** Field key the breakdown was computed from, e.g. "sector". */
  field: string;
  slices: BreakdownSlice[];
  totalValue: number;
}

export interface TopHoldings {
  top: Array<{ ticker: string; marketValue: number; percent: number; call: string; account: string; sector: string; currency: string }>;
  /** Aggregated "+ N other" entry. Null when N = 0. */
  others: { count: number; marketValue: number; percent: number } | null;
  totalValue: number;
}

export interface WeightedYield {
  /** Portfolio-weighted yield as a percent, e.g. 3.2. */
  yieldPct: number;
  /** Σ(marketValue × yield/100). */
  projectedAnnualIncome: number;
  /** Total marketValue. */
  capital: number;
  hasYieldData: boolean;
}
```

- [ ] **Step 2: Create thresholds.ts**

```typescript
export const DEFENSIVE_SECTORS: ReadonlyArray<string> = [
  "Cash",
  "Bond",
  "Bonds",
  "Money Market",
  "Treasury",
  "Treasuries",
];

export const THRESHOLDS = {
  singleStockRed: 0.10,    // > 10% → red flag
  singleStockWarn: 0.05,   // > 5%  → warning
  sectorRed: 0.40,         // > 40% → red flag
  sectorWarn: 0.25,        // > 25% → warning
  regionWarn: 0.70,        // > 70% → warning
  currencyNonBaseWarn: 0.30, // > 30% non-base → warning
  accountSkewInfo: 0.80,   // > 80% in one account → informational
  cashDragInfo: 0.40,      // > 40% in defensive sectors → informational
} as const;

/** Determines the largest-weighted bucket in a value-sum map; treated as "base" for currency/region. */
export function dominantKey(weightedSums: Record<string, number>): string | null {
  let best: string | null = null;
  let bestVal = -Infinity;
  for (const [k, v] of Object.entries(weightedSums)) {
    if (v > bestVal) {
      bestVal = v;
      best = k;
    }
  }
  return best;
}
```

- [ ] **Step 3: Write failing test for colors.ts**

Create `src/app/dashboard/breakdown/lib/__tests__/colors.test.ts`:

```typescript
import { paletteFor } from "../colors";

describe("paletteFor", () => {
  it("returns the same color for the same input", () => {
    expect(paletteFor("USA")).toBe(paletteFor("USA"));
  });

  it("returns different colors for different inputs (low collision)", () => {
    const a = paletteFor("USA");
    const b = paletteFor("Canada");
    expect(a).not.toBe(b);
  });

  it("treats null/undefined/empty as Uncategorized gray", () => {
    expect(paletteFor("")).toBe(paletteFor(undefined));
    expect(paletteFor(null as unknown as string)).toBe(paletteFor(undefined));
  });

  it("returns a hex string", () => {
    expect(paletteFor("USA")).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
```

- [ ] **Step 4: Run test, expect failure**

Run: `npm test -- colors`
Expected: FAIL — module `../colors` not found.

- [ ] **Step 5: Implement colors.ts**

```typescript
const PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#6366f1", "#f59e0b",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#fbbf24",
];
const UNCATEGORIZED = "#9ca3af";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function paletteFor(label: string | null | undefined): string {
  if (!label) return UNCATEGORIZED;
  return PALETTE[hash(label) % PALETTE.length];
}

export const COLORS = {
  uncategorized: UNCATEGORIZED,
  severityRed: "#ef4444",
  severityWarn: "#f59e0b",
  severityInfo: "#9ca3af",
} as const;
```

- [ ] **Step 6: Run test, expect pass**

Run: `npm test -- colors`
Expected: 4/4 pass.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/breakdown/lib/
git commit -m "feat: add breakdown thresholds, colors, and shared types"
```

---

### Task 5: computeBreakdowns (TDD)

**Files:**
- Create: `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts`
- Create: `src/app/dashboard/breakdown/lib/computeBreakdowns.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import type { Asset } from "@/types";
import { computeBreakdowns } from "../computeBreakdowns";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "", ticker: "", securityType: "", strategyType: "",
  call: "", sector: "", market: "", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeBreakdowns", () => {
  it("groups by all six dimensions weighted by marketValue", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "Banking", market: "USA", call: "Dividend", securityType: "Company", risk: "Yes", currency: "USD", marketValue: 100 }),
      a({ ticker: "Y", sector: "IT",      market: "Canada", call: "Growth", securityType: "ETF",     risk: "No",  currency: "CAD", marketValue: 300 }),
    ];
    const result = computeBreakdowns(assets);
    const sectorPercents = Object.fromEntries(result.sector.slices.map(s => [s.label, s.percent]));
    expect(sectorPercents).toEqual({ Banking: 25, IT: 75 });
    expect(result.market.totalValue).toBe(400);
  });

  it("groups missing fields under 'Uncategorized'", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "",        marketValue: 50 }),
      a({ ticker: "Y", sector: "Banking", marketValue: 50 }),
    ];
    const sector = computeBreakdowns(assets).sector;
    const labels = sector.slices.map(s => s.label).sort();
    expect(labels).toEqual(["Banking", "Uncategorized"]);
  });

  it("ignores assets with zero or NaN marketValue", () => {
    const assets: Asset[] = [
      a({ ticker: "X", sector: "Banking", marketValue: 0 }),
      a({ ticker: "Y", sector: "IT",      marketValue: NaN }),
      a({ ticker: "Z", sector: "Banking", marketValue: 100 }),
    ];
    const sector = computeBreakdowns(assets).sector;
    expect(sector.slices).toHaveLength(1);
    expect(sector.slices[0].label).toBe("Banking");
  });

  it("returns empty slices for empty input", () => {
    const result = computeBreakdowns([]);
    expect(result.sector.slices).toEqual([]);
    expect(result.sector.totalValue).toBe(0);
  });

  it("sorts slices descending by value", () => {
    const assets: Asset[] = [
      a({ ticker: "A", sector: "Small", marketValue: 10 }),
      a({ ticker: "B", sector: "Big",   marketValue: 90 }),
    ];
    const labels = computeBreakdowns(assets).sector.slices.map(s => s.label);
    expect(labels).toEqual(["Big", "Small"]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- computeBreakdowns`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeBreakdowns.ts**

```typescript
import type { Asset } from "@/types";
import type { DimensionBreakdown } from "./types";

const DIMENSIONS = [
  { key: "market" as const,       title: "By Region" },
  { key: "sector" as const,       title: "By Sector" },
  { key: "call" as const,         title: "By Strategy" },
  { key: "securityType" as const, title: "By Asset Type" },
  { key: "risk" as const,         title: "By Risk" },
  { key: "currency" as const,     title: "By Currency" },
];

export interface AllBreakdowns {
  market: DimensionBreakdown;
  sector: DimensionBreakdown;
  call: DimensionBreakdown;
  securityType: DimensionBreakdown;
  risk: DimensionBreakdown;
  currency: DimensionBreakdown;
}

function group(assets: Asset[], field: keyof Asset): DimensionBreakdown {
  const sums: Record<string, number> = {};
  let total = 0;
  for (const asset of assets) {
    const mv = asset.marketValue;
    if (!Number.isFinite(mv) || mv <= 0) continue;
    const raw = asset[field];
    const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Uncategorized";
    sums[label] = (sums[label] ?? 0) + mv;
    total += mv;
  }
  const slices = Object.entries(sums)
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
  const dim = DIMENSIONS.find(d => d.key === field);
  return {
    title: dim?.title ?? `By ${String(field)}`,
    field: String(field),
    slices,
    totalValue: total,
  };
}

export function computeBreakdowns(assets: Asset[]): AllBreakdowns {
  return {
    market:       group(assets, "market"),
    sector:       group(assets, "sector"),
    call:         group(assets, "call"),
    securityType: group(assets, "securityType"),
    risk:         group(assets, "risk"),
    currency:     group(assets, "currency"),
  };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- computeBreakdowns`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/breakdown/lib/computeBreakdowns.ts src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts
git commit -m "feat: add computeBreakdowns pure function for portfolio composition"
```

---

### Task 6: computeTopHoldings (TDD)

**Files:**
- Create: `src/app/dashboard/breakdown/lib/__tests__/computeTopHoldings.test.ts`
- Create: `src/app/dashboard/breakdown/lib/computeTopHoldings.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import type { Asset } from "@/types";
import { computeTopHoldings } from "../computeTopHoldings";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "Brokerage", ticker: "", securityType: "Company", strategyType: "",
  call: "Mix", sector: "Mixed", market: "USA", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeTopHoldings", () => {
  it("returns all holdings sorted descending when count <= 10", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100 }),
      a({ ticker: "BBB", marketValue: 300 }),
      a({ ticker: "CCC", marketValue: 200 }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top.map(h => h.ticker)).toEqual(["BBB", "CCC", "AAA"]);
    expect(r.others).toBeNull();
    expect(r.totalValue).toBe(600);
  });

  it("rolls up holdings beyond top 10 into 'others'", () => {
    const assets = Array.from({ length: 12 }, (_, i) =>
      a({ ticker: `T${i}`, marketValue: 100 - i })
    );
    const r = computeTopHoldings(assets);
    expect(r.top).toHaveLength(10);
    expect(r.others).toEqual({
      count: 2,
      marketValue: 89 + 88,
      percent: ((89 + 88) / r.totalValue) * 100,
    });
  });

  it("computes percent of portfolio for each holding", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 250 }),
      a({ ticker: "BBB", marketValue: 750 }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top[0].percent).toBeCloseTo(75, 5);
    expect(r.top[1].percent).toBeCloseTo(25, 5);
  });

  it("excludes assets with zero or NaN marketValue", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100 }),
      a({ ticker: "BBB", marketValue: 0 }),
      a({ ticker: "CCC", marketValue: NaN }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top).toHaveLength(1);
    expect(r.top[0].ticker).toBe("AAA");
  });

  it("returns empty result for empty input", () => {
    const r = computeTopHoldings([]);
    expect(r.top).toEqual([]);
    expect(r.others).toBeNull();
    expect(r.totalValue).toBe(0);
  });

  it("preserves call/account/sector/currency on each holding", () => {
    const assets = [
      a({ ticker: "AAA", marketValue: 100, call: "Dividend", account: "TFSA", sector: "Banking", currency: "CAD" }),
    ];
    const r = computeTopHoldings(assets);
    expect(r.top[0]).toMatchObject({ call: "Dividend", account: "TFSA", sector: "Banking", currency: "CAD" });
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- computeTopHoldings`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeTopHoldings.ts**

```typescript
import type { Asset } from "@/types";
import type { TopHoldings } from "./types";

const TOP_N = 10;

export function computeTopHoldings(assets: Asset[]): TopHoldings {
  const valid = assets.filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0);
  const total = valid.reduce((s, a) => s + a.marketValue, 0);
  const sorted = [...valid].sort((a, b) => b.marketValue - a.marketValue);

  const topAssets = sorted.slice(0, TOP_N);
  const tail = sorted.slice(TOP_N);

  const top = topAssets.map(a => ({
    ticker: a.ticker,
    marketValue: a.marketValue,
    percent: total > 0 ? (a.marketValue / total) * 100 : 0,
    call: a.call,
    account: a.account,
    sector: a.sector,
    currency: a.currency,
  }));

  const tailValue = tail.reduce((s, a) => s + a.marketValue, 0);
  const others = tail.length > 0
    ? { count: tail.length, marketValue: tailValue, percent: total > 0 ? (tailValue / total) * 100 : 0 }
    : null;

  return { top, others, totalValue: total };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- computeTopHoldings`
Expected: 6/6 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/breakdown/lib/computeTopHoldings.ts src/app/dashboard/breakdown/lib/__tests__/computeTopHoldings.test.ts
git commit -m "feat: add computeTopHoldings with top-10 rollup"
```

---

### Task 7: computeWeightedYield (TDD)

**Files:**
- Create: `src/app/dashboard/breakdown/lib/__tests__/computeWeightedYield.test.ts`
- Create: `src/app/dashboard/breakdown/lib/computeWeightedYield.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import type { Asset } from "@/types";
import { computeWeightedYield } from "../computeWeightedYield";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "", ticker: "", securityType: "", strategyType: "",
  call: "", sector: "", market: "", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeWeightedYield", () => {
  it("computes value-weighted yield across holdings", () => {
    const assets = [
      a({ marketValue: 100, yield: 4 }),
      a({ marketValue: 100, yield: 0 }),
    ];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBeCloseTo(2, 5);
    expect(r.projectedAnnualIncome).toBeCloseTo(4, 5);
    expect(r.capital).toBe(200);
    expect(r.hasYieldData).toBe(true);
  });

  it("returns hasYieldData=false when no holding has yield", () => {
    const assets = [
      a({ marketValue: 100, yield: 0 }),
      a({ marketValue: 100, yield: 0 }),
    ];
    expect(computeWeightedYield(assets).hasYieldData).toBe(false);
  });

  it("ignores NaN/missing yield values gracefully", () => {
    const assets = [
      a({ marketValue: 100, yield: NaN }),
      a({ marketValue: 100, yield: 5 }),
    ];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBeCloseTo(2.5, 5);
    expect(r.projectedAnnualIncome).toBeCloseTo(5, 5);
  });

  it("returns zeros for empty input without throwing", () => {
    const r = computeWeightedYield([]);
    expect(r.yieldPct).toBe(0);
    expect(r.projectedAnnualIncome).toBe(0);
    expect(r.capital).toBe(0);
    expect(r.hasYieldData).toBe(false);
  });

  it("handles all-zero marketValue without divide-by-zero", () => {
    const assets = [a({ marketValue: 0, yield: 5 }), a({ marketValue: 0, yield: 3 })];
    const r = computeWeightedYield(assets);
    expect(r.yieldPct).toBe(0);
    expect(r.capital).toBe(0);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- computeWeightedYield`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeWeightedYield.ts**

```typescript
import type { Asset } from "@/types";
import type { WeightedYield } from "./types";

export function computeWeightedYield(assets: Asset[]): WeightedYield {
  let capital = 0;
  let projectedAnnualIncome = 0;
  let hasYieldData = false;

  for (const asset of assets) {
    const mv = asset.marketValue;
    if (!Number.isFinite(mv) || mv <= 0) continue;
    capital += mv;
    const y = Number.isFinite(asset.yield) ? asset.yield : 0;
    if (y > 0) hasYieldData = true;
    projectedAnnualIncome += mv * (y / 100);
  }

  const yieldPct = capital > 0 ? (projectedAnnualIncome / capital) * 100 : 0;
  return { yieldPct, projectedAnnualIncome, capital, hasYieldData };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- computeWeightedYield`
Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/breakdown/lib/computeWeightedYield.ts src/app/dashboard/breakdown/lib/__tests__/computeWeightedYield.test.ts
git commit -m "feat: add computeWeightedYield with hasYieldData guard"
```

---

### Task 8: computeDriftSignals (TDD)

This is the most logic-heavy module. Tests cover each tier individually plus combined fires.

**Files:**
- Create: `src/app/dashboard/breakdown/lib/__tests__/computeDriftSignals.test.ts`
- Create: `src/app/dashboard/breakdown/lib/computeDriftSignals.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
import type { Asset } from "@/types";
import { computeDriftSignals } from "../computeDriftSignals";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "Brokerage", ticker: "", securityType: "Company", strategyType: "",
  call: "Mix", sector: "Mixed", market: "USA", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("computeDriftSignals", () => {
  it("flags a single stock > 10% as red", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 150 }),
      a({ ticker: "X", marketValue: 850 }),
    ];
    const sigs = computeDriftSignals(assets);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.severity).toBe("red");
  });

  it("flags a single stock between 5% and 10% as warning", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 70 }),
      a({ ticker: "X", marketValue: 930 }),
    ];
    const sigs = computeDriftSignals(assets);
    expect(sigs.find(s => s.title.includes("AAPL"))?.severity).toBe("warning");
  });

  it("flags sector > 40% as red and 25-40% as warning", () => {
    const red = computeDriftSignals([
      a({ ticker: "X", sector: "Banking", marketValue: 500 }),
      a({ ticker: "Y", sector: "IT",      marketValue: 500 }),
    ]).find(s => s.title.includes("Banking"));
    expect(red?.severity).toBe("red");

    const warn = computeDriftSignals([
      a({ ticker: "X", sector: "Banking", marketValue: 300 }),
      a({ ticker: "Y", sector: "IT",      marketValue: 700 }),
    ]).find(s => s.title.includes("Banking"));
    expect(warn?.severity).toBe("warning");
  });

  it("flags region concentration > 70%", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", market: "USA",    marketValue: 800 }),
      a({ ticker: "Y", market: "Canada", marketValue: 200 }),
    ]);
    const usa = sigs.find(s => s.title.toLowerCase().includes("usa"));
    expect(usa?.severity).toBe("warning");
  });

  it("flags non-base currency exposure > 30%", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", currency: "USD", marketValue: 600 }),
      a({ ticker: "Y", currency: "CAD", marketValue: 400 }),
    ]);
    const cad = sigs.find(s => s.title.includes("CAD"));
    expect(cad?.severity).toBe("warning");
  });

  it("flags account skew > 80% as informational", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", account: "TFSA", marketValue: 850 }),
      a({ ticker: "Y", account: "RRSP", marketValue: 150 }),
    ]);
    const skew = sigs.find(s => s.title.includes("TFSA"));
    expect(skew?.severity).toBe("info");
  });

  it("flags cash drag (defensive sectors > 40%) as informational", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "X", sector: "Bond", marketValue: 500 }),
      a({ ticker: "Y", sector: "IT",   marketValue: 500 }),
    ]);
    const drag = sigs.find(s => s.title.toLowerCase().includes("defensive"));
    expect(drag?.severity).toBe("info");
  });

  it("returns empty for a well-diversified portfolio", () => {
    const assets = Array.from({ length: 25 }, (_, i) =>
      a({
        ticker: `T${i}`,
        sector: `S${i % 6}`,
        market: i % 2 === 0 ? "USA" : "Canada",
        currency: i % 2 === 0 ? "USD" : "CAD",
        account: i % 3 === 0 ? "TFSA" : i % 3 === 1 ? "RRSP" : "Margin",
        marketValue: 40,
      })
    );
    const sigs = computeDriftSignals(assets);
    expect(sigs).toEqual([]);
  });

  it("sorts results red → warning → info", () => {
    const assets = [
      a({ ticker: "AAPL", marketValue: 150 }),                          // red (single stock 15%)
      a({ ticker: "X", sector: "Bond", marketValue: 425, currency: "EUR" }), // info + currency warning
      a({ ticker: "Y", sector: "IT",   marketValue: 425 }),
    ];
    const sigs = computeDriftSignals(assets);
    const order = sigs.map(s => s.severity);
    const reds = order.indexOf("red");
    const warns = order.indexOf("warning");
    const infos = order.indexOf("info");
    if (reds >= 0 && warns >= 0) expect(reds).toBeLessThan(warns);
    if (warns >= 0 && infos >= 0) expect(warns).toBeLessThan(infos);
  });

  it("attaches contributing assets to each signal", () => {
    const sigs = computeDriftSignals([
      a({ ticker: "AAPL", marketValue: 150 }),
      a({ ticker: "X", marketValue: 850 }),
    ]);
    const aapl = sigs.find(s => s.title.includes("AAPL"));
    expect(aapl?.contributors[0]).toMatchObject({ label: "AAPL" });
  });

  it("returns empty for empty input", () => {
    expect(computeDriftSignals([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- computeDriftSignals`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement computeDriftSignals.ts**

```typescript
import type { Asset } from "@/types";
import type { DriftSignal, DriftSeverity } from "./types";
import { THRESHOLDS, DEFENSIVE_SECTORS, dominantKey } from "./thresholds";

const SEVERITY_ORDER: Record<DriftSeverity, number> = { red: 0, warning: 1, info: 2 };

function pct(n: number) {
  return Math.round(n * 1000) / 10;
}

function fmtPctLabel(value: number): string {
  return `${pct(value)}%`;
}

function sumByField<K extends keyof Asset>(assets: Asset[], field: K): { sums: Record<string, number>; total: number } {
  const sums: Record<string, number> = {};
  let total = 0;
  for (const asset of assets) {
    if (!Number.isFinite(asset.marketValue) || asset.marketValue <= 0) continue;
    const raw = asset[field];
    const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Uncategorized";
    sums[label] = (sums[label] ?? 0) + asset.marketValue;
    total += asset.marketValue;
  }
  return { sums, total };
}

function contributorsForField<K extends keyof Asset>(
  assets: Asset[], field: K, value: string, total: number
) {
  return assets
    .filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0 && (a[field] || "Uncategorized") === value)
    .map(a => ({
      label: a.ticker,
      value: a.marketValue,
      percent: total > 0 ? (a.marketValue / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeDriftSignals(assets: Asset[]): DriftSignal[] {
  const valid = assets.filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0);
  const total = valid.reduce((s, a) => s + a.marketValue, 0);
  if (total <= 0) return [];

  const signals: DriftSignal[] = [];

  // Single-stock concentration
  for (const asset of valid) {
    const ratio = asset.marketValue / total;
    if (ratio > THRESHOLDS.singleStockRed) {
      signals.push({
        id: `stock-red-${asset.ticker}`,
        severity: "red",
        title: `${asset.ticker} is ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.singleStockRed)}% (red), ${pct(THRESHOLDS.singleStockWarn)}% (warn)`,
        contributors: [{ label: asset.ticker, value: asset.marketValue, percent: ratio * 100 }],
      });
    } else if (ratio > THRESHOLDS.singleStockWarn) {
      signals.push({
        id: `stock-warn-${asset.ticker}`,
        severity: "warning",
        title: `${asset.ticker} is ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.singleStockRed)}% (red), ${pct(THRESHOLDS.singleStockWarn)}% (warn)`,
        contributors: [{ label: asset.ticker, value: asset.marketValue, percent: ratio * 100 }],
      });
    }
  }

  // Sector concentration
  const sectors = sumByField(valid, "sector");
  for (const [sector, sum] of Object.entries(sectors.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.sectorRed) {
      signals.push({
        id: `sector-red-${sector}`,
        severity: "red",
        title: `${sector} sector concentrated at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.sectorRed)}% (red), ${pct(THRESHOLDS.sectorWarn)}% (warn)`,
        contributors: contributorsForField(valid, "sector", sector, total),
      });
    } else if (ratio > THRESHOLDS.sectorWarn) {
      signals.push({
        id: `sector-warn-${sector}`,
        severity: "warning",
        title: `${sector} sector concentrated at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.sectorRed)}% (red), ${pct(THRESHOLDS.sectorWarn)}% (warn)`,
        contributors: contributorsForField(valid, "sector", sector, total),
      });
    }
  }

  // Region concentration
  const regions = sumByField(valid, "market");
  for (const [region, sum] of Object.entries(regions.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.regionWarn) {
      signals.push({
        id: `region-warn-${region}`,
        severity: "warning",
        title: `${region} concentration at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.regionWarn)}% (warn)`,
        contributors: contributorsForField(valid, "market", region, total),
      });
    }
  }

  // Currency exposure (non-base)
  const currencies = sumByField(valid, "currency");
  const baseCurrency = dominantKey(currencies.sums);
  for (const [code, sum] of Object.entries(currencies.sums)) {
    if (code === baseCurrency) continue;
    const ratio = sum / total;
    if (ratio > THRESHOLDS.currencyNonBaseWarn) {
      signals.push({
        id: `currency-warn-${code}`,
        severity: "warning",
        title: `${code} exposure: ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.currencyNonBaseWarn)}% (warn) for non-base currency (base: ${baseCurrency ?? "n/a"})`,
        contributors: contributorsForField(valid, "currency", code, total),
      });
    }
  }

  // Account skew
  const accounts = sumByField(valid, "account");
  for (const [acct, sum] of Object.entries(accounts.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.accountSkewInfo) {
      signals.push({
        id: `account-info-${acct}`,
        severity: "info",
        title: `${acct} holds ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.accountSkewInfo)}% (info — tax-shelter underuse?)`,
        contributors: contributorsForField(valid, "account", acct, total),
      });
    }
  }

  // Cash drag (defensive sectors)
  const defensiveSet = new Set(DEFENSIVE_SECTORS.map(s => s.toLowerCase()));
  const defensiveValid = valid.filter(a => defensiveSet.has((a.sector || "").toLowerCase()));
  const defensiveSum = defensiveValid.reduce((s, a) => s + a.marketValue, 0);
  const defensiveRatio = total > 0 ? defensiveSum / total : 0;
  if (defensiveRatio > THRESHOLDS.cashDragInfo) {
    signals.push({
      id: "defensive-info",
      severity: "info",
      title: `Defensive sectors at ${fmtPctLabel(defensiveRatio)}`,
      thresholdLabel: `threshold: ${pct(THRESHOLDS.cashDragInfo)}% (info — possible cash drag)`,
      contributors: defensiveValid
        .map(a => ({ label: a.ticker, value: a.marketValue, percent: (a.marketValue / total) * 100 }))
        .sort((x, y) => y.value - x.value),
    });
  }

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return signals;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- computeDriftSignals`
Expected: 11/11 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/breakdown/lib/computeDriftSignals.ts src/app/dashboard/breakdown/lib/__tests__/computeDriftSignals.test.ts
git commit -m "feat: add computeDriftSignals with severity-tier heuristic alerts"
```

---

## Phase 3 — UI Sections

### Task 9: BreakdownTab shell with state handling

**Files:**
- Create: `src/app/dashboard/breakdown/BreakdownTab.tsx`
- Create: `src/app/dashboard/breakdown/__tests__/BreakdownTab.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { BreakdownTab } from "../BreakdownTab";
import type { Asset } from "@/types";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "Brokerage", ticker: "AAA", securityType: "Company", strategyType: "",
  call: "Mix", sector: "Mixed", market: "USA", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 100,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("BreakdownTab", () => {
  it("renders a loading skeleton when isLoading", () => {
    render(<BreakdownTab assets={[]} isLoading={true} onSwitchToHoldings={() => {}} />);
    expect(screen.getByTestId("breakdown-loading")).toBeInTheDocument();
  });

  it("renders the empty state with a switch-to-holdings button when no assets", () => {
    const onSwitch = jest.fn();
    render(<BreakdownTab assets={[]} isLoading={false} onSwitchToHoldings={onSwitch} />);
    expect(screen.getByText(/portfolio is empty/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /import|holdings/i }).click();
    expect(onSwitch).toHaveBeenCalled();
  });

  it("renders all three sections when healthy", () => {
    render(<BreakdownTab assets={[a({})]} isLoading={false} onSwitchToHoldings={() => {}} />);
    expect(screen.getByText(/composition/i)).toBeInTheDocument();
    expect(screen.getByText(/concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/drift signals/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- BreakdownTab`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement BreakdownTab.tsx (with placeholder section bodies)**

```tsx
"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { Asset } from "@/types";
import { computeBreakdowns } from "./lib/computeBreakdowns";
import { computeTopHoldings } from "./lib/computeTopHoldings";
import { computeWeightedYield } from "./lib/computeWeightedYield";
import { computeDriftSignals } from "./lib/computeDriftSignals";

interface BreakdownTabProps {
  assets: Asset[];
  isLoading: boolean;
  onSwitchToHoldings: () => void;
}

export function BreakdownTab({ assets, isLoading, onSwitchToHoldings }: BreakdownTabProps) {
  const breakdowns   = useMemo(() => computeBreakdowns(assets),   [assets]);
  const topHoldings  = useMemo(() => computeTopHoldings(assets),  [assets]);
  const weightedYield = useMemo(() => computeWeightedYield(assets), [assets]);
  const driftSignals = useMemo(() => computeDriftSignals(assets), [assets]);

  if (isLoading) {
    return (
      <div data-testid="breakdown-loading" className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
        <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
          Your portfolio is empty
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 max-w-md">
          Your portfolio is empty. Import holdings on the Holdings tab to see your breakdown.
        </p>
        <button
          onClick={onSwitchToHoldings}
          className="min-h-[44px] px-4 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          Go to Holdings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 md:p-8 space-y-8">
      <section aria-labelledby="composition-heading">
        <h2 id="composition-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          1 · Composition
        </h2>
        <div data-testid="composition-placeholder">[CompositionSection — see Task 10] {breakdowns.sector.slices.length} sectors</div>
      </section>

      <section aria-labelledby="concentration-heading">
        <h2 id="concentration-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          2 · Concentration
        </h2>
        <div data-testid="concentration-placeholder">[ConcentrationSection — see Task 11] {topHoldings.top.length} top holdings, {weightedYield.yieldPct.toFixed(2)}% yield</div>
      </section>

      <section aria-labelledby="drift-heading">
        <h2 id="drift-heading" className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          3 · Drift Signals
        </h2>
        <div data-testid="drift-placeholder">[DriftSignalsSection — see Task 12] {driftSignals.length} signals</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- BreakdownTab`
Expected: 3/3 pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/breakdown/BreakdownTab.tsx src/app/dashboard/breakdown/__tests__/BreakdownTab.test.tsx
git commit -m "feat: add BreakdownTab shell with loading/empty/healthy states"
```

---

### Task 10: CompositionSection — six donuts

**Files:**
- Create: `src/app/dashboard/breakdown/CompositionSection.tsx`
- Modify: `src/app/dashboard/breakdown/BreakdownTab.tsx`

- [ ] **Step 1: Implement CompositionSection.tsx**

```tsx
"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { AllBreakdowns } from "./lib/computeBreakdowns";
import type { DimensionBreakdown } from "./lib/types";
import { paletteFor, COLORS } from "./lib/colors";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface DonutProps {
  dim: DimensionBreakdown;
}

function Donut({ dim }: DonutProps) {
  const data = dim.slices.map(s => ({ name: s.label, value: s.value, percent: s.percent }));
  const largest = dim.slices[0];

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
      <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">{dim.title}</h3>
      <div className="relative" style={{ width: "100%", height: 220 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={1}
              isAnimationActive={false}
            >
              {data.map((entry) => (
                <Cell
                  key={entry.name}
                  fill={entry.name === "Uncategorized" ? COLORS.uncategorized : paletteFor(entry.name)}
                />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string, props: { payload?: { percent?: number } }) => {
                const p = props.payload?.percent ?? 0;
                return [`${fmtCurrency(value)} · ${p.toFixed(1)}%`, name];
              }}
              contentStyle={{ borderRadius: 6, fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              wrapperStyle={{ fontSize: 11, marginTop: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-hidden>
          <div className="text-center">
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">Total</div>
            <div className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{fmtCurrency(dim.totalValue)}</div>
          </div>
        </div>
      </div>
      {largest && (
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
          Largest: {largest.label} · {largest.percent.toFixed(1)}% · {fmtCurrency(largest.value)}
        </p>
      )}
      {/* Hidden table for screen readers */}
      <table className="sr-only">
        <caption>{dim.title}</caption>
        <thead><tr><th>Label</th><th>Value</th><th>Percent</th></tr></thead>
        <tbody>
          {dim.slices.map(s => (
            <tr key={s.label}><td>{s.label}</td><td>{s.value}</td><td>{s.percent.toFixed(2)}%</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface CompositionSectionProps {
  breakdowns: AllBreakdowns;
}

export function CompositionSection({ breakdowns }: CompositionSectionProps) {
  const order: Array<keyof AllBreakdowns> = ["market", "sector", "call", "securityType", "risk", "currency"];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {order.map(key => (
        <Donut key={key} dim={breakdowns[key]} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Wire CompositionSection into BreakdownTab**

In `src/app/dashboard/breakdown/BreakdownTab.tsx`, replace the composition placeholder:

```tsx
import { CompositionSection } from "./CompositionSection";
// ...
<section aria-labelledby="composition-heading">
  <h2 id="composition-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
    1 · Composition
  </h2>
  <CompositionSection breakdowns={breakdowns} />
</section>
```

- [ ] **Step 3: Manual smoke**

Run: `npm run dev`
Open: `http://localhost:3000/dashboard?tab=breakdown` (with at least a few imported holdings)
Expected: six donuts in a responsive grid (3 cols desktop, 2 cols tablet, 1 col mobile). Tapping a slice shows tooltip on mobile. Center text shows total.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/breakdown/CompositionSection.tsx src/app/dashboard/breakdown/BreakdownTab.tsx
git commit -m "feat: add CompositionSection with six responsive donut charts"
```

---

### Task 11: ConcentrationSection — top 10 bar + weighted yield card

**Files:**
- Create: `src/app/dashboard/breakdown/ConcentrationSection.tsx`
- Modify: `src/app/dashboard/breakdown/BreakdownTab.tsx`

- [ ] **Step 1: Implement ConcentrationSection.tsx**

```tsx
"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import type { TopHoldings, WeightedYield } from "./lib/types";
import { paletteFor, COLORS } from "./lib/colors";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

interface ConcentrationSectionProps {
  topHoldings: TopHoldings;
  weightedYield: WeightedYield;
}

interface DetailSheetState {
  open: boolean;
  ticker: string;
  marketValue: number;
  percent: number;
  account: string;
  sector: string;
  currency: string;
  call: string;
}

export function ConcentrationSection({ topHoldings, weightedYield }: ConcentrationSectionProps) {
  const [sheet, setSheet] = useState<DetailSheetState | null>(null);

  const rows = [
    ...topHoldings.top.map(h => ({ ...h, isOther: false })),
    ...(topHoldings.others
      ? [{
          ticker: `+ ${topHoldings.others.count} other holdings`,
          marketValue: topHoldings.others.marketValue,
          percent: topHoldings.others.percent,
          call: "",
          account: "",
          sector: "",
          currency: "",
          isOther: true as const,
        }]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Top 10 Holdings</h3>
        <div style={{ width: "100%", height: Math.max(36 * rows.length + 40, 200) }}>
          <ResponsiveContainer>
            <BarChart data={rows} layout="vertical" margin={{ left: 0, right: 24, top: 8, bottom: 8 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="ticker" width={110} tick={{ fontSize: 12 }} />
              <Tooltip
                cursor={{ fill: "rgba(0,0,0,0.04)" }}
                formatter={(value: number, _name: string, props: { payload?: { percent?: number } }) => {
                  const p = props.payload?.percent ?? 0;
                  return [`${fmtCurrency(value)} · ${p.toFixed(1)}%`, "Value"];
                }}
                contentStyle={{ borderRadius: 6, fontSize: 12 }}
              />
              <Bar
                dataKey="marketValue"
                onClick={(payload) => {
                  if (payload.isOther) return;
                  setSheet({ open: true, ...payload, ticker: payload.ticker });
                }}
                cursor="pointer"
                radius={[0, 4, 4, 0]}
                barSize={28}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.ticker}
                    fill={row.isOther ? COLORS.uncategorized : paletteFor(row.call || row.ticker)}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4 flex flex-col">
        <h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Weighted Yield</h3>
        <div className="text-3xl font-semibold text-teal-500">{weightedYield.yieldPct.toFixed(1)}%</div>
        {weightedYield.hasYieldData ? (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Projected annual income: <span className="font-medium text-neutral-800 dark:text-neutral-200">{fmtCurrency(weightedYield.projectedAnnualIncome)}</span>
            </p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              {fmtCurrency(weightedYield.projectedAnnualIncome)} income / {fmtCurrency(weightedYield.capital - weightedYield.projectedAnnualIncome)} capital
            </p>
          </>
        ) : (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">No yield data</p>
        )}
      </div>

      {sheet?.open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${sheet.ticker} details`}
          className="fixed inset-0 z-30 flex items-end md:items-center md:justify-center bg-black/40"
          onClick={() => setSheet(null)}
        >
          <div
            className="w-full md:max-w-md rounded-t-2xl md:rounded-2xl bg-white dark:bg-[#0a0a0a] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-base font-medium">{sheet.ticker}</h4>
              <button
                onClick={() => setSheet(null)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                aria-label="Close"
              >×</button>
            </div>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-neutral-500">Value</dt><dd>{fmtCurrency(sheet.marketValue)}</dd>
              <dt className="text-neutral-500">% of portfolio</dt><dd>{sheet.percent.toFixed(2)}%</dd>
              <dt className="text-neutral-500">Account</dt><dd>{sheet.account || "—"}</dd>
              <dt className="text-neutral-500">Sector</dt><dd>{sheet.sector || "—"}</dd>
              <dt className="text-neutral-500">Currency</dt><dd>{sheet.currency || "—"}</dd>
              <dt className="text-neutral-500">Strategy</dt><dd>{sheet.call || "—"}</dd>
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire ConcentrationSection into BreakdownTab**

In `src/app/dashboard/breakdown/BreakdownTab.tsx`, replace the concentration placeholder:

```tsx
import { ConcentrationSection } from "./ConcentrationSection";
// ...
<section aria-labelledby="concentration-heading">
  <h2 id="concentration-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
    2 · Concentration
  </h2>
  <ConcentrationSection topHoldings={topHoldings} weightedYield={weightedYield} />
</section>
```

- [ ] **Step 3: Manual smoke (mobile + desktop)**

Run: `npm run dev`
Open: `http://localhost:3000/dashboard?tab=breakdown` in mobile viewport (Chrome DevTools mobile emulation).
Expected: bar chart stacks above yield card on mobile. Tap a bar → bottom sheet slides up with detail. Tap backdrop or × → sheet closes. Yield card shows percent, projected income, capital split. "+ N other holdings" bar at bottom is non-interactive.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/breakdown/ConcentrationSection.tsx src/app/dashboard/breakdown/BreakdownTab.tsx
git commit -m "feat: add ConcentrationSection with top-10 bar and weighted yield card"
```

---

### Task 12: DriftSignalsSection — heuristic alerts

**Files:**
- Create: `src/app/dashboard/breakdown/DriftSignalsSection.tsx`
- Create: `src/app/dashboard/breakdown/__tests__/DriftSignalsSection.test.tsx`
- Modify: `src/app/dashboard/breakdown/BreakdownTab.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { DriftSignalsSection } from "../DriftSignalsSection";
import type { DriftSignal } from "../lib/types";

const sig = (over: Partial<DriftSignal>): DriftSignal => ({
  id: "x", severity: "warning", title: "warn", thresholdLabel: "th", contributors: [],
  ...over,
});

const THRESHOLDS_LIST = "Active thresholds";

describe("DriftSignalsSection", () => {
  it("shows the empty-state message when no signals fire", () => {
    render(<DriftSignalsSection signals={[]} />);
    expect(screen.getByText(/no concentration risks detected/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(THRESHOLDS_LIST, "i"))).toBeInTheDocument();
  });

  it("renders signals in given order with severity icons", () => {
    const signals: DriftSignal[] = [
      sig({ id: "1", severity: "red", title: "AAPL is 14%" }),
      sig({ id: "2", severity: "warning", title: "Banking 35%" }),
      sig({ id: "3", severity: "info", title: "TFSA 85%" }),
    ];
    render(<DriftSignalsSection signals={signals} />);
    expect(screen.getByText(/AAPL is 14%/)).toBeInTheDocument();
    expect(screen.getByText(/Banking 35%/)).toBeInTheDocument();
    expect(screen.getByText(/TFSA 85%/)).toBeInTheDocument();
  });

  it("expands and collapses contributors on tap", () => {
    const signals: DriftSignal[] = [
      sig({ id: "1", severity: "red", title: "AAPL is 14%", contributors: [
        { label: "AAPL", value: 1400, percent: 14 },
      ] }),
    ];
    render(<DriftSignalsSection signals={signals} />);
    const row = screen.getByRole("button", { name: /AAPL is 14%/i });
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- DriftSignalsSection`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement DriftSignalsSection.tsx**

```tsx
"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react";
import type { DriftSignal, DriftSeverity } from "./lib/types";
import { THRESHOLDS } from "./lib/thresholds";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const SEVERITY_STYLES: Record<DriftSeverity, { icon: typeof AlertCircle; cls: string; iconCls: string }> = {
  red:     { icon: AlertCircle,    cls: "border-l-red-500 bg-red-500/5",       iconCls: "text-red-500" },
  warning: { icon: AlertTriangle,  cls: "border-l-amber-500 bg-amber-500/5",   iconCls: "text-amber-500" },
  info:    { icon: Info,           cls: "border-l-neutral-400 bg-neutral-500/5", iconCls: "text-neutral-500" },
};

interface DriftSignalsSectionProps {
  signals: DriftSignal[];
}

export function DriftSignalsSection({ signals }: DriftSignalsSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          No concentration risks detected at current thresholds.
        </p>
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer">Active thresholds</summary>
          <ul className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 list-disc list-inside space-y-1">
            <li>Single stock: warn &gt; {THRESHOLDS.singleStockWarn * 100}%, red &gt; {THRESHOLDS.singleStockRed * 100}%</li>
            <li>Sector: warn &gt; {THRESHOLDS.sectorWarn * 100}%, red &gt; {THRESHOLDS.sectorRed * 100}%</li>
            <li>Region: warn &gt; {THRESHOLDS.regionWarn * 100}%</li>
            <li>Non-base currency: warn &gt; {THRESHOLDS.currencyNonBaseWarn * 100}%</li>
            <li>Account skew: info &gt; {THRESHOLDS.accountSkewInfo * 100}%</li>
            <li>Defensive sectors: info &gt; {THRESHOLDS.cashDragInfo * 100}%</li>
          </ul>
        </details>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {signals.map(s => {
        const { icon: Icon, cls, iconCls } = SEVERITY_STYLES[s.severity];
        const isOpen = !!expanded[s.id];
        return (
          <li key={s.id} className={`rounded-r-lg border-l-4 ${cls}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
              className="w-full flex items-center gap-3 min-h-[44px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <Icon className={`h-5 w-5 flex-none ${iconCls}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{s.title}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{s.thresholdLabel}</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {isOpen && s.contributors.length > 0 && (
              <ul className="px-3 pb-3 pt-1 border-t border-neutral-200 dark:border-neutral-800 space-y-1">
                {s.contributors.map(c => (
                  <li key={c.label} className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <span>{c.label}</span>
                    <span>{fmtCurrency(c.value)} · {c.percent.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- DriftSignalsSection`
Expected: 3/3 pass.

- [ ] **Step 5: Wire DriftSignalsSection into BreakdownTab**

In `src/app/dashboard/breakdown/BreakdownTab.tsx`, replace the drift placeholder:

```tsx
import { DriftSignalsSection } from "./DriftSignalsSection";
// ...
<section aria-labelledby="drift-heading">
  <h2 id="drift-heading" className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
    3 · Drift Signals
  </h2>
  <DriftSignalsSection signals={driftSignals} />
</section>
```

- [ ] **Step 6: Manual smoke**

Run: `npm run dev`
Expected: with a concentrated test portfolio (e.g., one holding > 10%), the section shows red/amber/gray rows. Tap a row → contributors expand. Tap again → collapse. With a diversified portfolio: shows the empty state with thresholds list.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/breakdown/DriftSignalsSection.tsx src/app/dashboard/breakdown/__tests__/DriftSignalsSection.test.tsx src/app/dashboard/breakdown/BreakdownTab.tsx
git commit -m "feat: add DriftSignalsSection with severity-tier accordion alerts"
```

---

## Phase 4 — Integration & QA

### Task 13: Wire BreakdownTab into DashboardClient

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Replace the placeholder pane with the real BreakdownTab**

In `src/app/dashboard/DashboardClient.tsx`:

```tsx
import { BreakdownTab } from "./breakdown/BreakdownTab";
import { useRouter, usePathname } from "next/navigation";
// ... inside the component:
const router = useRouter();
const pathname = usePathname();
const switchToHoldings = useCallback(() => {
  router.replace(pathname, { scroll: false });
}, [router, pathname]);

// ... inside the return, replace the placeholder div:
<PortfolioTabs>
  <HoldingsTab assets={assets} isLoading={isLoading} marketData={marketData} isMarketLoading={isMarketLoading}>
    <main /* ...existing main contents unchanged... */>
      {/* ... */}
    </main>
  </HoldingsTab>
  <BreakdownTab
    assets={assets}
    isLoading={isLoading}
    onSwitchToHoldings={switchToHoldings}
  />
</PortfolioTabs>
```

- [ ] **Step 2: Manual smoke — full integration**

Run: `npm run dev`
Open: `http://localhost:3000/dashboard`
Expected:
1. Land on Holdings tab. Click Breakdown → URL becomes `?tab=breakdown`. All three sections render.
2. From the empty state (no holdings), the "Go to Holdings" button switches tabs and clears the query param.
3. Refresh on `?tab=breakdown` → still on Breakdown.
4. Browser back/forward navigates between tabs.
5. Loading: refresh and observe — Breakdown shows skeleton while assets are fetching.

- [ ] **Step 3: Run full test suite**

Run: `npm test`
Expected: all tests pass (existing + new).

- [ ] **Step 4: Run lint and build**

Run: `npm run lint && npm run build`
Expected: no errors, no new warnings.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat: wire Breakdown tab into Dashboard with tab-switch handoff"
```

---

### Task 14: Mobile QA pass with frontend-design polish

This task uses the `frontend-design` skill to apply distinctive visual polish to the new tab — review color choices, spacing rhythm, typography hierarchy, and avoid generic dashboard aesthetics. Mobile-first.

**Files:**
- Modify (likely): `src/app/dashboard/breakdown/CompositionSection.tsx`
- Modify (likely): `src/app/dashboard/breakdown/ConcentrationSection.tsx`
- Modify (likely): `src/app/dashboard/breakdown/DriftSignalsSection.tsx`

- [ ] **Step 1: Invoke the frontend-design skill**

In a fresh subagent or session: `Skill(frontend-design)`. Provide the rendered Breakdown tab as input — both empty and populated states — and request polish review focused on: color palette cohesion, density/whitespace rhythm, type hierarchy across the three sections, mobile interactions feeling native (sheet, accordion).

- [ ] **Step 2: Apply suggested refinements**

Apply the polish changes the skill recommends. Each change should be small (palette swap, padding adjustment, typography tweak) — not structural. If the skill recommends structural changes, surface those for design review before applying.

- [ ] **Step 3: Mobile manual smoke checklist**

Open Chrome DevTools mobile emulator (iPhone 14 Pro or similar) AND a real device on the same network. Verify:

- [ ] Tab switching feels snappy. URL updates. Back button works.
- [ ] Donut tooltips appear on tap (not hover). Tap outside dismisses.
- [ ] Top-10 bar rows are tall enough for thumb taps. Tap shows bottom sheet.
- [ ] Bottom sheet covers full width. Tap backdrop or × dismisses.
- [ ] Drift Signal rows expand/collapse on tap. Visual state matches `aria-expanded`.
- [ ] Empty state ("no signals") shows positive note + thresholds list.
- [ ] Empty portfolio state shows tab-switch button. Button switches to Holdings.
- [ ] No horizontal scroll at any width 320–428px.
- [ ] Dark mode renders correctly across all three sections.
- [ ] Stale market data banner appears when applicable (existing logic).

- [ ] **Step 4: Run full test suite + build**

Run: `npm test && npm run lint && npm run build`
Expected: green across the board.

- [ ] **Step 5: Commit**

```bash
git add -p src/app/dashboard/breakdown/
git commit -m "polish: refine Breakdown tab visual hierarchy and mobile interactions"
```

---

## Final Verification

- [ ] All 14 tasks committed.
- [ ] `npm test` passes.
- [ ] `npm run lint` clean.
- [ ] `npm run build` succeeds.
- [ ] Manual smoke on mobile and desktop verified per Task 14 checklist.
- [ ] Spec section coverage verified — every requirement in [the design spec](../specs/2026-04-26-portfolio-breakdown-tab-design.md) maps to a task.

**Per global instructions, before declaring this sprint ready for merge: recommend running `/codex:adversarial-review`** to catch design/security/race issues that per-task TDD doesn't surface.
