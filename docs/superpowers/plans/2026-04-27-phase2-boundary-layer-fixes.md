# Phase 2 — Boundary-Layer Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce a fixed allowlist of category values at every write path, preserve `null` for genuinely missing numbers, and surface unknowns as yellow "Not Found" cells in the UI. Stop the system from silently zeroing out missing data or leaking Yahoo enum values like `"ecnquote"` into the dashboard.

**Architecture:** A new single-file source of truth (`src/lib/classification/allowlists.ts`) holds the canonical category lists, sector/market consolidation maps, and per-field `normalizeX` functions. Every write path (`POST /api/assets`, `PUT /api/assets/[id]`, `POST /api/portfolio-pdf`, `researchTicker`) runs values through the normalizers before saving. The dashboard reads dropdown options from the allowlists module instead of deriving them from existing data. A one-time migration script cleans up legacy bad values.

**Tech Stack:** TypeScript, Next.js 16 App Router, DynamoDB (single-table), Jest + ts-jest, Tailwind. Test pattern: `src/**/__tests__/*.test.{ts,tsx}` (jest.config.ts).

**Spec:** [docs/superpowers/specs/2026-04-27-phase2-boundary-layer-fixes-design.md](../specs/2026-04-27-phase2-boundary-layer-fixes-design.md)

**Push points:** Three logical groupings push to main:
- **Push 1** after Task 11 — allowlists module + boundary enforcement complete
- **Push 2** after Task 16 — display layer surfaces "Not Found" correctly
- **Push 3** after Task 19 — one-time migration runs on prod

After Push 3, recommend `/codex:adversarial-review`.

---

## File Structure

**New files:**
| Path | Responsibility |
|---|---|
| `src/lib/classification/allowlists.ts` | Canonical lists, type unions, consolidation maps, `normalizeX` functions, `applyCompanyAutoDefaults` |
| `src/lib/classification/__tests__/allowlists.test.ts` | Unit tests for normalizers and Company defaults |
| `src/components/NotFoundCell.tsx` | Shared yellow "Not Found" cell component |
| `scripts/migrate-cleanup-allowlist.ts` | One-time DynamoDB cleanup, dry-run capable |

**Modified files:**
| Path | Change |
|---|---|
| `src/types/index.ts` | Add category union types; `Asset` yield/oneYearReturn/threeYearReturn/managementFee become `number \| null` |
| `src/lib/ticker-research.ts` | Normalize outputs to canonical values; preserve `null` for missing returns |
| `src/app/api/assets/route.ts` | Normalize inputs before write |
| `src/app/api/assets/[id]/route.ts` | Normalize inputs; reapply Company auto-defaults |
| `src/app/api/portfolio-pdf/route.ts` | Normalize enriched results before write |
| `src/app/dashboard/DashboardClient.tsx` | Dropdowns read from allowlists; null-number cells render via `NotFoundCell` |
| `src/app/dashboard/breakdown/lib/computeBreakdowns.ts` | Render `"Not Found"` slices in neutral gray, never silently filter |
| `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts` | Update fixture builder for `number \| null` fields |
| `src/types/audit.ts` | Add `MIGRATION_PHASE2_CLEANUP` action constant if not already permissive |

---

## Group 1 — Allowlists Module (Tasks 1–6)

### Task 1: Scaffold `allowlists.ts` with constants, types, and barrel test

**Files:**
- Create: `src/lib/classification/allowlists.ts`
- Create: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/classification/__tests__/allowlists.test.ts
import {
  STRATEGY_TYPES,
  SECURITY_TYPES,
  CALL_VALUES,
  SECTOR_VALUES,
  MARKET_VALUES,
  CANONICAL_CURRENCIES,
  MGMT_STYLES,
  NOT_FOUND,
} from "../allowlists";

describe("allowlists barrel", () => {
  it("exposes the canonical category values", () => {
    expect(NOT_FOUND).toBe("Not Found");
    expect(STRATEGY_TYPES).toEqual(["Dividend", "Growth", "Mix", "Not Found"]);
    expect(SECURITY_TYPES).toEqual(["Company", "ETF", "Fund", "Not Found"]);
    expect(CALL_VALUES).toEqual(["Yes", "No"]);
    expect(SECTOR_VALUES).toEqual([
      "Financials", "Healthcare", "IT", "Energy", "Real Estate",
      "Consumer Discretionary", "Consumer Staples", "Materials",
      "Industrials", "Communication", "Utilities", "Diversified",
      "Not Found",
    ]);
    expect(MARKET_VALUES).toEqual(["USA", "Canada", "North America", "Global", "Not Found"]);
    expect(CANONICAL_CURRENCIES).toEqual(["USD", "CAD"]);
    expect(MGMT_STYLES).toEqual(["Active", "Passive", "N/A"]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts`
Expected: FAIL — `Cannot find module '../allowlists'`

- [ ] **Step 3: Implement the module**

```ts
// src/lib/classification/allowlists.ts
export const NOT_FOUND = "Not Found" as const;

export const STRATEGY_TYPES = ["Dividend", "Growth", "Mix", "Not Found"] as const;
export const SECURITY_TYPES = ["Company", "ETF", "Fund", "Not Found"] as const;
export const CALL_VALUES = ["Yes", "No"] as const;
export const SECTOR_VALUES = [
  "Financials", "Healthcare", "IT", "Energy", "Real Estate",
  "Consumer Discretionary", "Consumer Staples", "Materials",
  "Industrials", "Communication", "Utilities", "Diversified",
  "Not Found",
] as const;
export const MARKET_VALUES = ["USA", "Canada", "North America", "Global", "Not Found"] as const;
export const CANONICAL_CURRENCIES = ["USD", "CAD"] as const;
export const MGMT_STYLES = ["Active", "Passive", "N/A"] as const;

export type StrategyType = typeof STRATEGY_TYPES[number];
export type SecurityType = typeof SECURITY_TYPES[number];
export type CallValue = typeof CALL_VALUES[number];
export type Sector = typeof SECTOR_VALUES[number];
export type Market = typeof MARKET_VALUES[number];
export type ManagementStyle = typeof MGMT_STYLES[number];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts`
Expected: PASS — 1 test

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): scaffold allowlists module with canonical category constants"
```

---

### Task 2: Membership-only normalizers (Strategy, SecurityType, Call, MgmtStyle)

These four normalizers share the same shape: case-insensitive membership check, default to a sentinel.

**Files:**
- Modify: `src/lib/classification/allowlists.ts`
- Modify: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// Append to src/lib/classification/__tests__/allowlists.test.ts
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeCall,
  normalizeManagementStyle,
} from "../allowlists";

describe("normalizeStrategyType", () => {
  it("returns canonical when input is canonical", () => {
    expect(normalizeStrategyType("Dividend")).toBe("Dividend");
    expect(normalizeStrategyType("Growth")).toBe("Growth");
    expect(normalizeStrategyType("Mix")).toBe("Mix");
  });
  it("matches case-insensitively", () => {
    expect(normalizeStrategyType("dividend")).toBe("Dividend");
    expect(normalizeStrategyType("MIX")).toBe("Mix");
  });
  it("maps legacy 'Pure X' / 'The Mix' labels to canonical", () => {
    expect(normalizeStrategyType("Pure Dividend")).toBe("Dividend");
    expect(normalizeStrategyType("Pure Growth")).toBe("Growth");
    expect(normalizeStrategyType("The Mix")).toBe("Mix");
  });
  it("returns Not Found for unknown / null / empty", () => {
    expect(normalizeStrategyType("ecnquote")).toBe("Not Found");
    expect(normalizeStrategyType(null)).toBe("Not Found");
    expect(normalizeStrategyType(undefined)).toBe("Not Found");
    expect(normalizeStrategyType("")).toBe("Not Found");
  });
});

describe("normalizeSecurityType", () => {
  it("returns canonical when input is canonical", () => {
    expect(normalizeSecurityType("Company")).toBe("Company");
    expect(normalizeSecurityType("ETF")).toBe("ETF");
    expect(normalizeSecurityType("Fund")).toBe("Fund");
  });
  it("maps Yahoo quoteType enums to canonical", () => {
    expect(normalizeSecurityType("EQUITY")).toBe("Company");
    expect(normalizeSecurityType("CLOSED_END_FUND")).toBe("Company");
    expect(normalizeSecurityType("MUTUALFUND")).toBe("Fund");
    expect(normalizeSecurityType("ETF")).toBe("ETF");
  });
  it("returns Not Found for ecnquote / unknown / null", () => {
    expect(normalizeSecurityType("ecnquote")).toBe("Not Found");
    expect(normalizeSecurityType("INDEX")).toBe("Not Found");
    expect(normalizeSecurityType(null)).toBe("Not Found");
  });
});

describe("normalizeCall", () => {
  it("returns Yes/No when canonical (case-insensitive)", () => {
    expect(normalizeCall("Yes")).toBe("Yes");
    expect(normalizeCall("yes")).toBe("Yes");
    expect(normalizeCall("No")).toBe("No");
    expect(normalizeCall("NO")).toBe("No");
  });
  it("defaults to No for unknown / null / empty", () => {
    expect(normalizeCall("maybe")).toBe("No");
    expect(normalizeCall(null)).toBe("No");
    expect(normalizeCall("")).toBe("No");
  });
});

describe("normalizeManagementStyle", () => {
  it("returns canonical when input is canonical (case-insensitive)", () => {
    expect(normalizeManagementStyle("Active")).toBe("Active");
    expect(normalizeManagementStyle("passive")).toBe("Passive");
    expect(normalizeManagementStyle("N/A")).toBe("N/A");
    expect(normalizeManagementStyle("n/a")).toBe("N/A");
  });
  it("returns N/A for unknown / null / empty", () => {
    expect(normalizeManagementStyle("Hybrid")).toBe("N/A");
    expect(normalizeManagementStyle(null)).toBe("N/A");
    expect(normalizeManagementStyle("")).toBe("N/A");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts`
Expected: FAIL — normalize functions are not exported

- [ ] **Step 3: Implement the four normalizers**

Append to `src/lib/classification/allowlists.ts`:

```ts
function casefold(raw: string | null | undefined): string {
  return (raw ?? "").trim().toLowerCase();
}

export function normalizeStrategyType(raw: string | null | undefined): StrategyType {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  if (v === "dividend" || v === "pure dividend") return "Dividend";
  if (v === "growth" || v === "pure growth") return "Growth";
  if (v === "mix" || v === "the mix") return "Mix";
  return NOT_FOUND;
}

export function normalizeSecurityType(raw: string | null | undefined): SecurityType {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  if (v === "company" || v === "equity" || v === "closed_end_fund") return "Company";
  if (v === "etf") return "ETF";
  if (v === "fund" || v === "mutualfund") return "Fund";
  return NOT_FOUND;
}

export function normalizeCall(raw: string | null | undefined): CallValue {
  const v = casefold(raw);
  if (v === "yes") return "Yes";
  return "No";
}

export function normalizeManagementStyle(raw: string | null | undefined): ManagementStyle {
  const v = casefold(raw);
  if (v === "active") return "Active";
  if (v === "passive") return "Passive";
  return "N/A";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts`
Expected: PASS — all assertions across the four normalizers

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): add membership-based normalizers (Strategy, SecurityType, Call, MgmtStyle)"
```

---

### Task 3: `normalizeSector` with consolidation map

**Files:**
- Modify: `src/lib/classification/allowlists.ts`
- Modify: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to test file:

```ts
import { normalizeSector } from "../allowlists";

describe("normalizeSector consolidation", () => {
  const cases: Array<[string, string]> = [
    // Financials
    ["Banking", "Financials"],
    ["Bank", "Financials"],
    ["Financial Services", "Financials"],
    ["Financials", "Financials"],
    ["Insurance", "Financials"],
    // Healthcare
    ["Healthcare", "Healthcare"],
    ["Health Care", "Healthcare"],
    ["Pharmaceutical", "Healthcare"],
    ["Biotechnology", "Healthcare"],
    // IT
    ["Technology", "IT"],
    ["IT", "IT"],
    ["Information Technology", "IT"],
    ["Software", "IT"],
    ["Semiconductor", "IT"],
    ["Tech", "IT"],
    // Energy
    ["Energy", "Energy"],
    ["Oil", "Energy"],
    ["Gas", "Energy"],
    ["Renewable", "Energy"],
    // Real Estate
    ["Real Estate", "Real Estate"],
    ["REIT", "Real Estate"],
    ["Realty", "Real Estate"],
    // Consumer Discretionary
    ["Consumer Discretionary", "Consumer Discretionary"],
    ["Cyclical", "Consumer Discretionary"],
    ["Retail", "Consumer Discretionary"],
    // Consumer Staples
    ["Consumer Staples", "Consumer Staples"],
    ["Defensive", "Consumer Staples"],
    // Materials
    ["Mining", "Materials"],
    ["Gold", "Materials"],
    ["Precious Metals", "Materials"],
    ["Materials", "Materials"],
    ["Basic Materials", "Materials"],
    // Industrials
    ["Industrials", "Industrials"],
    ["Industrial", "Industrials"],
    // Communication
    ["Communication", "Communication"],
    ["Communication Services", "Communication"],
    ["Telecom", "Communication"],
    // Utilities
    ["Utilities", "Utilities"],
    ["Utility", "Utilities"],
    // Diversified
    ["Mix", "Diversified"],
    ["Diversified", "Diversified"],
    ["Multi-sector", "Diversified"],
  ];

  it.each(cases)("maps %s to %s", (raw, expected) => {
    expect(normalizeSector(raw)).toBe(expected);
  });

  it("defaults plain 'Consumer' (no qualifier) to Consumer Discretionary", () => {
    expect(normalizeSector("Consumer")).toBe("Consumer Discretionary");
  });

  it("returns Not Found for Global, Other, unknown, null, empty", () => {
    expect(normalizeSector("Global")).toBe("Not Found");
    expect(normalizeSector("Other")).toBe("Not Found");
    expect(normalizeSector("Random Garbage")).toBe("Not Found");
    expect(normalizeSector(null)).toBe("Not Found");
    expect(normalizeSector("")).toBe("Not Found");
  });

  it("matches case-insensitively", () => {
    expect(normalizeSector("banking")).toBe("Financials");
    expect(normalizeSector("CONSUMER STAPLES")).toBe("Consumer Staples");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeSector"`
Expected: FAIL — normalizeSector not exported

- [ ] **Step 3: Implement `normalizeSector`**

Append to `allowlists.ts`:

```ts
const SECTOR_CONSOLIDATION_MAP: Record<string, Sector> = {
  // Financials
  "banking": "Financials",
  "bank": "Financials",
  "financial services": "Financials",
  "financials": "Financials",
  "financial": "Financials",
  "insurance": "Financials",
  // Healthcare
  "healthcare": "Healthcare",
  "health care": "Healthcare",
  "pharmaceutical": "Healthcare",
  "biotechnology": "Healthcare",
  // IT
  "technology": "IT",
  "it": "IT",
  "information technology": "IT",
  "software": "IT",
  "semiconductor": "IT",
  "tech": "IT",
  // Energy
  "energy": "Energy",
  "oil": "Energy",
  "gas": "Energy",
  "renewable": "Energy",
  // Real Estate
  "real estate": "Real Estate",
  "reit": "Real Estate",
  "realty": "Real Estate",
  // Consumer Discretionary
  "consumer discretionary": "Consumer Discretionary",
  "cyclical": "Consumer Discretionary",
  "retail": "Consumer Discretionary",
  "consumer": "Consumer Discretionary", // ambiguous default
  // Consumer Staples
  "consumer staples": "Consumer Staples",
  "defensive": "Consumer Staples",
  // Materials
  "mining": "Materials",
  "gold": "Materials",
  "precious metals": "Materials",
  "materials": "Materials",
  "basic materials": "Materials",
  // Industrials
  "industrials": "Industrials",
  "industrial": "Industrials",
  // Communication
  "communication": "Communication",
  "communication services": "Communication",
  "telecom": "Communication",
  // Utilities
  "utilities": "Utilities",
  "utility": "Utilities",
  // Diversified
  "mix": "Diversified",
  "diversified": "Diversified",
  "multi-sector": "Diversified",
};

export function normalizeSector(raw: string | null | undefined): Sector {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;
  return SECTOR_CONSOLIDATION_MAP[v] ?? NOT_FOUND;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeSector"`
Expected: PASS — every row of the table passes plus edge cases

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): add sector consolidation map and normalizer"
```

---

### Task 4: `normalizeMarket` with exchange-code mapping

**Files:**
- Modify: `src/lib/classification/allowlists.ts`
- Modify: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { normalizeMarket } from "../allowlists";

describe("normalizeMarket", () => {
  it("passes through canonical values", () => {
    expect(normalizeMarket("USA")).toBe("USA");
    expect(normalizeMarket("Canada")).toBe("Canada");
    expect(normalizeMarket("North America")).toBe("North America");
    expect(normalizeMarket("Global")).toBe("Global");
  });

  it("maps Yahoo US exchange codes to USA", () => {
    expect(normalizeMarket("NYQ")).toBe("USA");
    expect(normalizeMarket("NMS")).toBe("USA");
    expect(normalizeMarket("NCM")).toBe("USA");
    expect(normalizeMarket("NGM")).toBe("USA");
    expect(normalizeMarket("ASE")).toBe("USA");
    expect(normalizeMarket("PCX")).toBe("USA");
    expect(normalizeMarket("BATS")).toBe("USA");
  });

  it("maps Canadian exchange codes to Canada", () => {
    expect(normalizeMarket("TOR")).toBe("Canada");
    expect(normalizeMarket("VAN")).toBe("Canada");
    expect(normalizeMarket("CVE")).toBe("Canada");
    expect(normalizeMarket("NEO")).toBe("Canada");
  });

  it("returns Global for non-NA exchanges", () => {
    expect(normalizeMarket("LSE")).toBe("Global");
    expect(normalizeMarket("FRA")).toBe("Global");
    expect(normalizeMarket("HKG")).toBe("Global");
  });

  it("returns Not Found for empty/null", () => {
    expect(normalizeMarket(null)).toBe("Not Found");
    expect(normalizeMarket("")).toBe("Not Found");
  });

  it("for ETF/Fund types, defaults to Not Found regardless of exchange", () => {
    // Phase 2: ETFs need Phase-3 holdings lookup. Until then they show Not Found.
    expect(normalizeMarket("NYQ", "ETF")).toBe("Not Found");
    expect(normalizeMarket("TOR", "Fund")).toBe("Not Found");
  });

  it("for Company type, uses exchange-based mapping", () => {
    expect(normalizeMarket("NYQ", "Company")).toBe("USA");
    expect(normalizeMarket("TOR", "Company")).toBe("Canada");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeMarket"`
Expected: FAIL — normalizeMarket not exported

- [ ] **Step 3: Implement `normalizeMarket`**

Append:

```ts
const US_EXCHANGES = new Set(["nyq", "nms", "ncm", "ngm", "ase", "pcx", "bats"]);
const CA_EXCHANGES = new Set(["tor", "van", "cve", "neo"]);

const MARKET_CANONICAL: Record<string, Market> = {
  "usa": "USA",
  "canada": "Canada",
  "north america": "North America",
  "global": "Global",
};

export function normalizeMarket(
  raw: string | null | undefined,
  securityType?: string | null,
): Market {
  const v = casefold(raw);
  if (!v) return NOT_FOUND;

  // Canonical pass-through
  if (MARKET_CANONICAL[v]) return MARKET_CANONICAL[v];

  // For ETFs/Funds, exchange-based heuristic is unreliable (Phase 3 needs holdings lookup).
  const sec = casefold(securityType);
  if (sec === "etf" || sec === "fund" || sec === "mutualfund") return NOT_FOUND;

  // Company / unspecified: best-effort exchange mapping.
  if (US_EXCHANGES.has(v)) return "USA";
  if (CA_EXCHANGES.has(v)) return "Canada";

  // Recognized exchange code shape but unknown country → Global.
  // Otherwise (truly empty/garbage) → Not Found.
  if (/^[a-z]{2,5}$/.test(v)) return "Global";
  return NOT_FOUND;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeMarket"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): add normalizeMarket with exchange-code mapping"
```

---

### Task 5: `normalizeCurrency` (permissive ISO 4217)

**Files:**
- Modify: `src/lib/classification/allowlists.ts`
- Modify: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { normalizeCurrency } from "../allowlists";

describe("normalizeCurrency", () => {
  it("returns canonical USD/CAD as-is", () => {
    expect(normalizeCurrency("USD")).toBe("USD");
    expect(normalizeCurrency("CAD")).toBe("CAD");
    expect(normalizeCurrency("usd")).toBe("USD");
    expect(normalizeCurrency("cad")).toBe("CAD");
  });

  it("accepts other valid ISO 4217 3-letter codes", () => {
    expect(normalizeCurrency("EUR")).toBe("EUR");
    expect(normalizeCurrency("GBP")).toBe("GBP");
    expect(normalizeCurrency("BRL")).toBe("BRL");
    expect(normalizeCurrency("JPY")).toBe("JPY");
    expect(normalizeCurrency("eur")).toBe("EUR");
  });

  it("returns Not Found for empty/null/garbage", () => {
    expect(normalizeCurrency(null)).toBe("Not Found");
    expect(normalizeCurrency("")).toBe("Not Found");
    expect(normalizeCurrency("dollars")).toBe("Not Found");
    expect(normalizeCurrency("XX")).toBe("Not Found");
    expect(normalizeCurrency("ABCDE")).toBe("Not Found");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeCurrency"`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export function normalizeCurrency(raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toUpperCase();
  if (!v) return NOT_FOUND;
  if (/^[A-Z]{3}$/.test(v)) return v; // any valid 3-letter ISO 4217
  return NOT_FOUND;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "normalizeCurrency"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): add normalizeCurrency (permissive ISO 4217)"
```

---

### Task 6: `applyCompanyAutoDefaults` rule

**Files:**
- Modify: `src/lib/classification/allowlists.ts`
- Modify: `src/lib/classification/__tests__/allowlists.test.ts`

- [ ] **Step 1: Write the failing tests**

Append:

```ts
import { applyCompanyAutoDefaults } from "../allowlists";

describe("applyCompanyAutoDefaults", () => {
  it("forces call=No, managementStyle=N/A, managementFee=0 for Company", () => {
    const input = {
      securityType: "Company",
      call: "Yes",
      managementStyle: "Active",
      managementFee: 0.5,
    };
    expect(applyCompanyAutoDefaults(input)).toEqual({
      securityType: "Company",
      call: "No",
      managementStyle: "N/A",
      managementFee: 0,
    });
  });

  it("does not modify ETF / Fund", () => {
    const etf = {
      securityType: "ETF",
      call: "Yes",
      managementStyle: "Passive",
      managementFee: 0.06,
    };
    expect(applyCompanyAutoDefaults(etf)).toEqual(etf);
    const fund = {
      securityType: "Fund",
      call: "No",
      managementStyle: "Active",
      managementFee: 1.5,
    };
    expect(applyCompanyAutoDefaults(fund)).toEqual(fund);
  });

  it("does not modify when securityType is missing or Not Found", () => {
    const input = { securityType: "Not Found", call: "Yes", managementStyle: "Active", managementFee: 1 };
    expect(applyCompanyAutoDefaults(input)).toEqual(input);
  });

  it("preserves other fields untouched", () => {
    const input = {
      ticker: "AAPL",
      securityType: "Company",
      call: "Yes",
      managementStyle: "Active",
      managementFee: 0,
      sector: "IT",
      yield: 0.005,
    } as const;
    const result = applyCompanyAutoDefaults({ ...input });
    expect(result.ticker).toBe("AAPL");
    expect(result.sector).toBe("IT");
    expect(result.yield).toBe(0.005);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts -t "applyCompanyAutoDefaults"`
Expected: FAIL

- [ ] **Step 3: Implement**

```ts
export function applyCompanyAutoDefaults<
  T extends { securityType?: string | null; call?: string | null; managementStyle?: string | null; managementFee?: number | null },
>(asset: T): T {
  if (asset.securityType !== "Company") return asset;
  return {
    ...asset,
    call: "No",
    managementStyle: "N/A",
    managementFee: 0,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/classification/__tests__/allowlists.test.ts`
Expected: PASS — entire allowlists test file green

- [ ] **Step 5: Commit**

```bash
git add src/lib/classification/allowlists.ts src/lib/classification/__tests__/allowlists.test.ts
git commit -m "feat(classification): add applyCompanyAutoDefaults rule"
```

---

## Group 2 — Boundary Enforcement (Tasks 7–11)

### Task 7: Update `Asset` interface — null number fields and category union types

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts` (fixture builder)

- [ ] **Step 1: Update `Asset` interface**

Edit `src/types/index.ts:1-37`. Change these field types:

```ts
// Before:  yield: number;
// After:   yield: number | null;
yield: number | null;
oneYearReturn: number | null;
fiveYearReturn: number | null;
threeYearReturn: number | null;
managementFee: number | null;
```

Leave other numbers (`quantity`, `liveTickerPrice`, `bookCost`, `marketValue`, `profitLoss`, `expectedAnnualDividends`, `beta`, `volatility`) unchanged — they aren't candidates for "Not Found" treatment.

- [ ] **Step 2: Update the breakdown test fixture**

Edit `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts:4-15`. Change the four affected fields in the fixture builder default:

```ts
const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "", ticker: "", securityType: "", strategyType: "",
  call: "", sector: "", market: "", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: null,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 0,
  profitLoss: 0, yield: null, oneYearReturn: null, fiveYearReturn: null,
  threeYearReturn: null, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});
```

- [ ] **Step 3: Run typecheck and tests**

Run: `npx tsc --noEmit && npx jest`
Expected: TypeScript reports errors at every site that does `asset.yield * x` etc. without null-handling, and at sites that compare the field against `0`. Note these errors — they get fixed in the next tasks.

If errors are limited to files we will edit later (`DashboardClient.tsx`, `route.ts` files, `ticker-research.ts`), that's expected. If errors appear in unrelated files, fix them with `?? 0` so calculations still work but display layer can detect null.

- [ ] **Step 4: Apply minimal fix to non-display calculation sites**

Search for arithmetic on these fields and apply `?? 0` where the value is being used in a calculation (not a display):

Run: `grep -rn "asset\.\(yield\|oneYearReturn\|threeYearReturn\|fiveYearReturn\|managementFee\)" src/lib src/app/api src/app/strategy 2>/dev/null | head -30`

Apply minimal `?? 0` fixes to any sites that aren't part of the upcoming task list (POST/PUT routes, ticker-research, DashboardClient — those get full treatment later). Document each fix in the commit.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest`
Expected: PASS — existing tests still pass with `null` defaults in the fixture (since `marketValue` is the only thing that affects breakdown output)

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts
# plus any other files touched by Step 4
git commit -m "feat(types): allow null for yield/return/managementFee on Asset"
```

---

### Task 8: Update `ticker-research.ts` to output canonical values + null returns

**Files:**
- Modify: `src/lib/ticker-research.ts`
- Create: `src/lib/__tests__/ticker-research.test.ts`

- [ ] **Step 1: Write a failing integration test**

```ts
// src/lib/__tests__/ticker-research.test.ts
import {
  classifyStrategyType,
} from "../ticker-research";

describe("classifyStrategyType returns canonical labels", () => {
  it("returns 'Growth' for low-yield index fund", () => {
    expect(classifyStrategyType(0.01, 1.1, "S&P 500 index fund", "Fund", "VOO")).toBe("Growth");
  });
  it("returns 'Mix' for high-yield options fund", () => {
    expect(classifyStrategyType(0.10, 0.9, "covered call options strategy", "ETF", "JEPQ")).toBe("Mix");
  });
  it("returns 'Dividend' for moderate-yield, low-beta dividend stock", () => {
    expect(classifyStrategyType(0.04, 0.8, "dividend bank stock", "Company", "BAC")).toBe("Dividend");
  });
  it("falls back to 'Mix' for ambiguous", () => {
    expect(classifyStrategyType(0.04, 1.2, "tech growth", "Company", "AAPL")).toBe("Mix");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/ticker-research.test.ts`
Expected: FAIL — current classifier returns `"Pure Growth"` etc.

- [ ] **Step 3: Update `classifyStrategyType` and `researchTicker`**

In `src/lib/ticker-research.ts`:

A. Import normalizers at the top:

```ts
import {
  normalizeSecurityType,
  normalizeStrategyType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
  type StrategyType,
  type SecurityType,
  type Sector,
  type Market,
  type ManagementStyle,
  type CallValue,
} from "./classification/allowlists";
```

B. Replace the return strings in `classifyStrategyType` (lines 34–75):
- `"Pure Growth"` → `"Growth"`
- `"The Mix"` → `"Mix"`
- `"Pure Dividend"` → `"Dividend"`

Update the function signature return type to `StrategyType`.

C. Update `inferSector` — replace the function body so its output goes through `normalizeSector`:

```ts
export function inferSector(description: string = '', currentSector: string = ''): Sector {
  if (currentSector && currentSector.trim() !== '' && currentSector !== 'N/A') {
    const normalized = normalizeSector(currentSector);
    if (normalized !== "Not Found") return normalized;
  }
  const desc = description.toLowerCase();
  if (/nasdaq.?100|technology|software|semiconductor|computing/i.test(desc)) return "IT";
  if (/financial services|banks?|insurance|investment/i.test(desc)) return "Financials";
  if (/healthcare|biotechnology|pharmaceutical/i.test(desc)) return "Healthcare";
  if (/energy|oil|gas|renewable/i.test(desc)) return "Energy";
  if (/real estate|reit/i.test(desc)) return "Real Estate";
  if (/consumer staples|defensive/i.test(desc)) return "Consumer Staples";
  if (/consumer|retail|cyclical/i.test(desc)) return "Consumer Discretionary";
  if (/mining|metals|gold/i.test(desc)) return "Materials";
  if (/utility|utilities/i.test(desc)) return "Utilities";
  if (/telecom|communication/i.test(desc)) return "Communication";
  if (/industrial/i.test(desc)) return "Industrials";
  return "Not Found";
}
```

D. Update the return object inside `researchTicker` (lines 141-160). Wrap each classification field with its normalizer, change `|| 0` to `?? null` for the return fields, then run the whole asset through `applyCompanyAutoDefaults`:

```ts
const securityType = normalizeSecurityType(quoteType);
const strategyType = securityType === "Not Found"
  ? "Not Found"
  : classifyStrategyType(dividendYield, beta, description, securityType, name);

const result = {
  name,
  symbol: ticker,
  currentPrice: quote.regularMarketPrice || 0,
  dividendYield: dividendYield || null,
  securityType,
  strategyType,
  call: (securityType === "Fund" && (isCallInName || isCallInDesc)) ? "Yes" as const : "No" as const,
  sector: inferSector(description, assetProfile?.sector),
  market: normalizeMarket(quote.exchange, securityType),
  managementStyle: normalizeManagementStyle(
    (assetProfile?.longBusinessSummary || "").toLowerCase().includes("index") ? "Passive" : "Active"
  ),
  managementFee: summaryDetail?.managementFee ?? null,
  exDividendDate: summaryDetail?.exDividendDate?.toISOString() || "",
  oneYearReturn: summary.fundPerformance?.trailingReturns?.oneYear ?? null,
  threeYearReturn: summary.fundPerformance?.trailingReturns?.threeYear ?? null,
  analystConsensus: summary.recommendationTrend?.trend?.[0]?.recommendationMean || "N/A",
  volatility: 0,
  riskFlag: "Normal",
  currency: normalizeCurrency(quote.currency || "USD"),
};

return applyCompanyAutoDefaults(result);
```

E. Update the `TickerMetadata` interface (lines 11–32) to reflect new types:
- `securityType: SecurityType`
- `strategyType: StrategyType`
- `call: CallValue`
- `sector: Sector`
- `market: Market`
- `managementStyle: ManagementStyle`
- `dividendYield: number | null`
- `oneYearReturn: number | null`
- `threeYearReturn: number | null`
- `managementFee: number | null`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/lib/__tests__/ticker-research.test.ts && npx jest src/lib/classification`
Expected: PASS — strategy classifier returns canonical labels; allowlists tests still green.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: errors only in callers we update next (route handlers, dashboard).

- [ ] **Step 6: Commit**

```bash
git add src/lib/ticker-research.ts src/lib/__tests__/ticker-research.test.ts
git commit -m "feat(ticker-research): output canonical category values, preserve null for missing returns"
```

---

### Task 9: Wire normalizers into `POST /api/assets`

**Files:**
- Modify: `src/app/api/assets/route.ts`

- [ ] **Step 1: Import normalizers and apply to inputs**

Edit `src/app/api/assets/route.ts`. Add imports at the top:

```ts
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
} from "@/lib/classification/allowlists";
```

Replace the asset object construction (lines 37–76). Run each category field through its normalizer, change `parseFloat(...)|| 0` to `parseFloat(...) ?? null` for nullable numbers, then apply Company defaults:

```ts
const securityType = normalizeSecurityType(data.securityType);
const baseAsset = {
  PK: PROFILE_KEY,
  SK: assetSK,
  id: assetId,
  profileId: PROFILE_KEY,
  type: "ASSET" as const,

  account: data.account || "",
  ticker: data.ticker || "",
  securityType,
  strategyType: normalizeStrategyType(data.strategyType),
  call: normalizeCall(data.call),
  sector: normalizeSector(data.sector),
  market: normalizeMarket(data.market, securityType),
  currency: normalizeCurrency(data.currency),
  managementStyle: normalizeManagementStyle(data.managementStyle),
  externalRating: data.externalRating || "",

  managementFee: data.managementFee != null && data.managementFee !== "" ? parseFloat(data.managementFee) : null,
  quantity: parseFloat(data.quantity) || 0,
  liveTickerPrice: parseFloat(data.liveTickerPrice) || 0,
  bookCost: parseFloat(data.bookCost) || 0,
  marketValue: parseFloat(data.marketValue) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0),
  profitLoss: parseFloat(data.profitLoss) || ((parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0)) - (parseFloat(data.bookCost) || 0),
  yield: data.yield != null && data.yield !== "" ? parseFloat(data.yield) : null,
  oneYearReturn: data.oneYearReturn != null && data.oneYearReturn !== "" ? parseFloat(data.oneYearReturn) : null,
  fiveYearReturn: data.fiveYearReturn != null && data.fiveYearReturn !== "" ? parseFloat(data.fiveYearReturn) : null,
  threeYearReturn: data.threeYearReturn != null && data.threeYearReturn !== "" ? parseFloat(data.threeYearReturn) : null,
  exDividendDate: data.exDividendDate || "",
  analystConsensus: data.analystConsensus || "",
  beta: parseFloat(data.beta) || 0,
  riskFlag: data.riskFlag || "",
  accountNumber: data.accountNumber || "",
  accountType: data.accountType || "",
  risk: data.risk || "",
  volatility: parseFloat(data.volatility) || 0,
  expectedAnnualDividends: parseFloat(data.expectedAnnualDividends) || (parseFloat(data.quantity) || 0) * (parseFloat(data.liveTickerPrice) || 0) * (parseFloat(data.yield) || 0),

  updatedAt: new Date().toISOString(),
};

const asset = applyCompanyAutoDefaults(baseAsset);
```

- [ ] **Step 2: Manual smoke test (curl or from the app)**

Start dev server: `npm run dev`

Open the dashboard, click + Add Manual Asset, enter:
- Ticker: TEST
- Security Type: ecnquote (deliberately bad)
- Strategy Type: Pure Dividend (legacy label)
- Sector: Banking
- Market: NYQ

Save. Re-fetch the asset (refresh dashboard). Verify:
- securityType = "Not Found"
- strategyType = "Dividend"
- sector = "Financials"
- market = "Not Found" (because securityType is "Not Found", not "Company")

Then enter another row with Security Type = Company:
- call should be saved as "No"
- managementStyle as "N/A"
- managementFee as 0

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assets/route.ts
git commit -m "feat(api/assets): normalize category inputs and apply Company defaults at POST"
```

---

### Task 10: Wire normalizers into `PUT /api/assets/[id]`

**Files:**
- Modify: `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: Import and apply normalizers in the merge**

Edit `src/app/api/assets/[id]/route.ts:84-118`. Add imports at the top (mirror Task 9). Wrap each category field on the merge with its normalizer, treating `data.X !== undefined` as the gate for whether to renormalize. Use the new normalized `securityType` for `normalizeMarket`. Apply `applyCompanyAutoDefaults` after merge:

```ts
const incomingSecurityType = data.securityType !== undefined
  ? normalizeSecurityType(data.securityType)
  : normalizeSecurityType(existingAsset.securityType);

const merged = {
  ...existingAsset,
  account: data.account !== undefined ? data.account : existingAsset.account,
  ticker: data.ticker !== undefined ? data.ticker : existingAsset.ticker,
  securityType: incomingSecurityType,
  strategyType: data.strategyType !== undefined
    ? normalizeStrategyType(data.strategyType)
    : normalizeStrategyType(existingAsset.strategyType),
  call: data.call !== undefined
    ? normalizeCall(data.call)
    : normalizeCall(existingAsset.call),
  sector: data.sector !== undefined
    ? normalizeSector(data.sector)
    : normalizeSector(existingAsset.sector),
  market: data.market !== undefined
    ? normalizeMarket(data.market, incomingSecurityType)
    : normalizeMarket(existingAsset.market, incomingSecurityType),
  currency: data.currency !== undefined
    ? normalizeCurrency(data.currency)
    : normalizeCurrency(existingAsset.currency),
  managementStyle: data.managementStyle !== undefined
    ? normalizeManagementStyle(data.managementStyle)
    : normalizeManagementStyle(existingAsset.managementStyle),
  externalRating: data.externalRating !== undefined ? data.externalRating : existingAsset.externalRating,

  managementFee: data.managementFee !== undefined
    ? (data.managementFee === "" || data.managementFee == null ? null : parseFloat(data.managementFee))
    : (existingAsset.managementFee ?? null),
  quantity: data.quantity !== undefined ? parseFloat(data.quantity) : existingAsset.quantity,
  liveTickerPrice: data.liveTickerPrice !== undefined ? parseFloat(data.liveTickerPrice) : existingAsset.liveTickerPrice,
  bookCost: data.bookCost !== undefined ? parseFloat(data.bookCost) : existingAsset.bookCost,
  marketValue: data.marketValue !== undefined ? parseFloat(data.marketValue) : existingAsset.marketValue,
  profitLoss: data.profitLoss !== undefined ? parseFloat(data.profitLoss) : existingAsset.profitLoss,
  yield: data.yield !== undefined
    ? (data.yield === "" || data.yield == null ? null : parseFloat(data.yield))
    : (existingAsset.yield ?? null),
  oneYearReturn: data.oneYearReturn !== undefined
    ? (data.oneYearReturn === "" || data.oneYearReturn == null ? null : parseFloat(data.oneYearReturn))
    : (existingAsset.oneYearReturn ?? null),
  fiveYearReturn: data.fiveYearReturn !== undefined
    ? (data.fiveYearReturn === "" || data.fiveYearReturn == null ? null : parseFloat(data.fiveYearReturn))
    : (existingAsset.fiveYearReturn ?? null),
  threeYearReturn: data.threeYearReturn !== undefined
    ? (data.threeYearReturn === "" || data.threeYearReturn == null ? null : parseFloat(data.threeYearReturn))
    : (existingAsset.threeYearReturn ?? null),
  exDividendDate: data.exDividendDate !== undefined ? data.exDividendDate : (existingAsset.exDividendDate ?? ""),
  analystConsensus: data.analystConsensus !== undefined ? data.analystConsensus : (existingAsset.analystConsensus ?? ""),
  beta: data.beta !== undefined ? parseFloat(data.beta) : (existingAsset.beta ?? 0),
  riskFlag: data.riskFlag !== undefined ? data.riskFlag : (existingAsset.riskFlag ?? ""),
  accountNumber: data.accountNumber !== undefined ? data.accountNumber : (existingAsset.accountNumber ?? ""),
  accountType: data.accountType !== undefined ? data.accountType : (existingAsset.accountType ?? ""),
  risk: data.risk !== undefined ? data.risk : existingAsset.risk,
  volatility: data.volatility !== undefined ? parseFloat(data.volatility) : existingAsset.volatility,
  expectedAnnualDividends: data.expectedAnnualDividends !== undefined ? parseFloat(data.expectedAnnualDividends) : existingAsset.expectedAnnualDividends,

  updatedAt: new Date().toISOString(),
};

const updatedAsset = applyCompanyAutoDefaults(merged);
```

In the auto-recompute block below (lines 120-131), guard against null yield:

```ts
const yieldPct = updatedAsset.yield ?? 0;
// ... rest of block unchanged
```

- [ ] **Step 2: Manual smoke test**

In the dashboard, edit an existing asset:
- Change Security Type to "Company"
- Verify the row shows call=No, mgmtStyle=N/A, mgmtFee=0 after save

Then edit another asset and clear its yield field. Verify after save the cell shows "Not Found" (yellow — once Group 3 is done; for now, expect a `null` value in API response).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/assets/\[id\]/route.ts
git commit -m "feat(api/assets): normalize category inputs and apply Company defaults at PUT"
```

---

### Task 11: Wire normalizers into `POST /api/portfolio-pdf`

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`

- [ ] **Step 1: Import and apply normalizers**

Edit `src/app/api/portfolio-pdf/route.ts`. Add imports near the existing `researchTicker` import (line 10):

```ts
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
} from '@/lib/classification/allowlists';
```

Update the `newItem` object construction (lines 270-314). Run each category field through its normalizer at write time. Note that `enrichedData` already comes pre-normalized from `researchTicker` (Task 8), but we re-normalize the *merged* value defensively because `existing` may contain legacy bad values:

```ts
const securityType = normalizeSecurityType(
  (existing?.securityType && existing.securityType !== "") ? existing.securityType : enrichedData?.securityType,
);

const baseItem = {
  PK: PROFILE_KEY,
  SK: assetSK,
  id: assetId,
  profileId: PROFILE_KEY,
  type: "ASSET",
  ticker: h.ticker,
  currency: normalizeCurrency(h.currency || enrichedData?.currency || existing?.currency || "CAD"),
  quantity: h.quantity,
  liveTickerPrice: pricePerShare > 0 ? pricePerShare : (enrichedData?.currentPrice ?? (existing?.liveTickerPrice ?? 0)),
  bookCost: h.bookCost,
  marketValue: h.marketValue,
  profitLoss: h.marketValue - h.bookCost,
  accountNumber: h.accountNumber || (existing?.accountNumber ?? ""),
  accountType: h.accountType || (existing?.accountType ?? "Registered"),
  importSource: "pdf-statement",
  updatedAt: new Date().toISOString(),
  createdAt: existing?.createdAt ?? new Date().toISOString(),
  account: h.accountNumber && accountMappings[h.accountNumber] ? accountMappings[h.accountNumber] : (existing?.account ?? ""),

  securityType,
  strategyType: normalizeStrategyType(
    (existing?.strategyType && existing.strategyType !== "") ? existing.strategyType : enrichedData?.strategyType,
  ),
  call: normalizeCall(
    (existing?.call && existing.call !== "" && existing.call !== "N/A") ? existing.call : enrichedData?.call,
  ),
  sector: normalizeSector(
    (existing?.sector && existing.sector !== "" && existing.sector !== "N/A") ? existing.sector : enrichedData?.sector,
  ),
  market: normalizeMarket(
    (existing?.market && existing.market !== "") ? existing.market : enrichedData?.market,
    securityType,
  ),
  managementStyle: normalizeManagementStyle(
    (existing?.managementStyle && existing.managementStyle !== "") ? existing.managementStyle : enrichedData?.managementStyle,
  ),
  name: (existing?.name && existing.name !== "") ? existing.name : (enrichedData?.name ?? ""),

  externalRating: existing?.externalRating ?? enrichedData?.externalRating ?? "",
  managementFee: existing?.managementFee ?? enrichedData?.managementFee ?? null,
  yield: existing?.yield ?? enrichedData?.dividendYield ?? null,
  oneYearReturn: existing?.oneYearReturn ?? enrichedData?.oneYearReturn ?? null,
  fiveYearReturn: existing?.fiveYearReturn ?? null,
  threeYearReturn: existing?.threeYearReturn ?? enrichedData?.threeYearReturn ?? null,
  exDividendDate: existing?.exDividendDate ?? enrichedData?.exDividendDate ?? "",
  analystConsensus: existing?.analystConsensus ?? enrichedData?.analystConsensus ?? "",
  beta: existing?.beta ?? enrichedData?.beta ?? 0,
  riskFlag: existing?.riskFlag ?? enrichedData?.riskFlag ?? "",
  risk: existing?.risk ?? "",
  volatility: existing?.volatility ?? enrichedData?.volatility ?? 0,
  expectedAnnualDividends: existing?.expectedAnnualDividends ?? 0,
};

const newItem = applyCompanyAutoDefaults(baseItem);
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean (or only complaints from `DashboardClient.tsx` which Task 14 fixes)

- [ ] **Step 3: Manual smoke test**

Re-import a PDF that previously produced "ecnquote" rows. Verify:
- After import, refresh the dashboard
- All previously bad values are now "Not Found" or canonical
- Company-type rows have Call=No, MgmtStyle=N/A, MgmtFee=0

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts
git commit -m "feat(api/portfolio-pdf): normalize all category fields at write and apply Company defaults"
```

- [ ] **Step 5: 🚢 PUSH POINT 1 — push to main**

```bash
git push origin main
```

The PO can now do live QA: dropdowns will show only canonical values; bad inputs (like a future "ecnquote") will land as "Not Found" instead of polluting the dropdowns. Display still shows raw `null` numbers as `0.00%` until Group 3 lands — that's expected.

---

## Group 3 — Display Layer (Tasks 12–16)

### Task 12: Create `NotFoundCell` shared component

**Files:**
- Create: `src/components/NotFoundCell.tsx`

- [ ] **Step 1: Implement the component**

```tsx
// src/components/NotFoundCell.tsx
"use client";

interface Props {
  /** The text to render when value is missing. Defaults to "Not Found". */
  label?: string;
  /** Optional tooltip text on hover. */
  title?: string;
}

export function NotFoundCell({ label = "Not Found", title = "Value not found in market data — please review" }: Props) {
  return (
    <span
      className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 italic border border-yellow-200 dark:border-yellow-800/50 cursor-help"
      title={title}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotFoundCell.tsx
git commit -m "feat(ui): add NotFoundCell yellow flag component"
```

---

### Task 13: Update `DashboardClient` dropdowns to read from allowlists

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add imports**

At the top of the file (next to the existing `Asset, MarketData` import around line 6):

```ts
import {
  STRATEGY_TYPES,
  SECURITY_TYPES,
  CALL_VALUES,
  SECTOR_VALUES,
  MARKET_VALUES,
  CANONICAL_CURRENCIES,
  MGMT_STYLES,
} from "@/lib/classification/allowlists";
```

- [ ] **Step 2: Replace the derived option lists**

Edit `DashboardClient.tsx:64-73`. Replace data-derived options with allowlist-sourced ones:

```ts
// Account list stays derived (it's user data, not classification)
const accounts = useMemo(() => Array.from(new Set(assets.map(a => a.account).filter(Boolean))), [assets]);

// Classification dropdowns: source-of-truth lists from allowlists module
const securityTypes = SECURITY_TYPES;
const strategyTypes = STRATEGY_TYPES;
const calls = CALL_VALUES;
const sectors = SECTOR_VALUES;
const markets = MARKET_VALUES;
// Currency: canonical USD/CAD plus any other ISO codes that already exist in user data
const currencies = useMemo(() => {
  const fromData = assets.map(a => a.currency).filter(Boolean) as string[];
  return Array.from(new Set([...CANONICAL_CURRENCIES, ...fromData])).filter(c => c !== "Not Found");
}, [assets]);
const managementStyles = MGMT_STYLES;
const risks = useMemo(() => Array.from(new Set(assets.map(a => a.risk).filter(Boolean))), [assets]);
```

- [ ] **Step 3: Manual smoke test**

Run dev server, open dashboard, click Edit on any row. Verify each dropdown:
- Security Type: Company / ETF / Fund / Not Found
- Strategy: Dividend / Growth / Mix / Not Found
- Sector: 12 canonical labels + Not Found
- Market: USA / Canada / North America / Global / Not Found
- Currency: USD, CAD, plus any extras already in DB
- Mgt Style: Active / Passive / N/A

No "ecnquote" or other garbage appears.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): source classification dropdowns from allowlists module"
```

---

### Task 14: Render null numbers and "Not Found" text via `NotFoundCell`

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Add NotFoundCell import**

```ts
import { NotFoundCell } from "@/components/NotFoundCell";
```

- [ ] **Step 2: Replace `naIndicator` and rewrite null/Not-Found rendering**

Edit `DashboardClient.tsx:718-724`. Replace the existing `naIndicator` helper:

```ts
// Helper that renders a value or NotFoundCell when missing.
// For numbers, treat null as missing; 0 is valid.
// For strings, treat "", null, undefined, or "Not Found" as missing.
const renderText = (value: string | null | undefined) => {
  if (value === null || value === undefined || value === "" || value === "Not Found") {
    return <NotFoundCell />;
  }
  return <span>{value}</span>;
};

const renderNumber = (value: number | null | undefined, suffix = "", decimals = 2) => {
  if (value === null || value === undefined) {
    return <NotFoundCell />;
  }
  return <span>{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
};

const renderPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) {
    return <NotFoundCell />;
  }
  return <span>{(value * 100).toFixed(2)}%</span>;
};
```

- [ ] **Step 3: Update each affected cell to use the new renderers**

Edit the row-render block (around lines 755-825). Replace the inline `Number(... || 0)` patterns with the new renderers. Specifically:

- Yield % cell (line 797): `isEditing ? renderField("yield", ...) : renderPercent(asset.yield)`
- 1YR Return cell (line 801): `isEditing ? renderField("oneYearReturn", ...) : renderPercent(asset.oneYearReturn)`
- 3YR Return cell (line 805): `isEditing ? <input... /> : renderPercent(asset.threeYearReturn)`
- Mgt Fee cell (line 773): `isEditing ? renderField("managementFee", ...) : (asset.securityType === "Company" ? <span>0.00%</span> : renderNumber(asset.managementFee, "%", 2))`

For text cells that currently look like:
```tsx
<span className="...">{asset.securityType}</span>
```
Replace with:
```tsx
{renderText(asset.securityType)}
```
…where `securityType` could be "Not Found" — and similarly for Strategy, Sector, Market, MgtStyle.

For the existing classification cells (Security Type, Strategy, Sector, Market, Mgt Style, Currency) the table already uses `renderField`. Update `renderField` to delegate to `renderText` for display mode:

```ts
// Inside renderField (line ~710)
// Display mode
const displayValue = asset[field] as string | number;
if (type === 'number') {
  return renderNumber(typeof displayValue === "number" ? displayValue : null, "", 2);
}
return renderText(typeof displayValue === "string" ? displayValue : null);
```

- [ ] **Step 4: Manual smoke test**

Run dev server. Verify across the table:
- Tickers with missing 1Y/3Y returns show yellow "Not Found" cells instead of "0.00%"
- A ticker imported as `securityType: "Not Found"` shows yellow "Not Found"
- Company-type tickers show their managementFee as "0.00%" (not "Not Found")
- ETF/Fund tickers with null managementFee show yellow "Not Found"
- Hover over a "Not Found" cell shows the tooltip

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): render null numbers and Not Found text via shared NotFoundCell"
```

---

### Task 15: Update CSV export to write "Not Found" / blank for nulls

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

- [ ] **Step 1: Update `handleExportCSV`**

Edit `DashboardClient.tsx:367-403`. The CSV already coalesces with `?? ''` in `escapeCSV`, but the row construction (lines 379-388) does `a.yield, a.oneYearReturn, ...` which will write `null` as empty. We need it to write `"Not Found"` instead so the exported file matches what the user sees:

```ts
const fmt = (v: number | null | undefined): string => v == null ? "Not Found" : String(v);

const rows = assets.map(a => [
  a.account, a.ticker, a.securityType, a.strategyType, a.call,
  a.sector, a.market, a.currency, a.managementStyle, fmt(a.managementFee),
  a.quantity, a.liveTickerPrice, (a.bookCost || 0),
  a.marketValue, totalMV > 0 ? ((a.marketValue || 0) / totalMV * 100).toFixed(1) + '%' : '0%',
  a.profitLoss, fmt(a.yield), fmt(a.oneYearReturn), fmt(a.threeYearReturn ?? a.fiveYearReturn ?? null),
  a.exDividendDate, a.analystConsensus, a.externalRating,
  a.beta, a.riskFlag, a.volatility, a.expectedAnnualDividends,
  a.accountNumber, a.accountType,
].map(escapeCSV));
```

- [ ] **Step 2: Manual smoke test**

Click Export CSV. Open the file. Verify:
- Tickers with null yield show "Not Found" in the Yield column
- Numeric tickers (with real values) show numbers as before
- Company-type rows show their managementFee value (could be 0)

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): export Not Found instead of blank for null numerics"
```

---

### Task 16: Update breakdown chart to render "Not Found" slices in neutral gray

**Files:**
- Modify: `src/app/dashboard/breakdown/lib/computeBreakdowns.ts`
- Modify: `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts`:

```ts
it("preserves Not Found slices (does not silently filter them)", () => {
  const assets: Asset[] = [
    a({ ticker: "X", sector: "Financials", marketValue: 100 }),
    a({ ticker: "Y", sector: "Not Found", marketValue: 50 }),
    a({ ticker: "Z", sector: "IT", marketValue: 50 }),
  ];
  const result = computeBreakdowns(assets);
  const labels = result.sector.slices.map(s => s.label);
  expect(labels).toContain("Not Found");
  const notFound = result.sector.slices.find(s => s.label === "Not Found");
  expect(notFound?.value).toBe(50);
  expect(notFound?.percent).toBe(25);
});

it("renders Not Found slice even if it would be < 5% (does not roll into Others)", () => {
  const assets: Asset[] = [
    a({ ticker: "A", sector: "Financials", marketValue: 1000 }),
    a({ ticker: "B", sector: "Not Found",  marketValue: 30 }),
  ];
  const result = computeBreakdowns(assets);
  const labels = result.sector.slices.map(s => s.label);
  expect(labels).toContain("Not Found"); // even though < 5%
});
```

- [ ] **Step 2: Run tests to verify the failures**

Run: `npx jest src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts`
Expected: FAIL on the new tests (Not Found currently rolls into "Others")

- [ ] **Step 3: Update `group()` in computeBreakdowns.ts to never roll Not Found into Others**

Edit `src/app/dashboard/breakdown/lib/computeBreakdowns.ts:22-62`. Modify the small/big partitioning so Not Found is preserved as its own slice regardless of size:

```ts
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
  const allSlices = Object.entries(sums)
    .map(([label, value]) => ({
      label,
      value,
      percent: total > 0 ? (value / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const SMALL_SLICE_THRESHOLD = 5; // percent
  const PRESERVE_LABELS = new Set(["Not Found", "Uncategorized"]);
  const big = allSlices.filter(s => s.percent >= SMALL_SLICE_THRESHOLD || PRESERVE_LABELS.has(s.label));
  const small = allSlices.filter(s => s.percent < SMALL_SLICE_THRESHOLD && !PRESERVE_LABELS.has(s.label));

  const slices = small.length > 0
    ? [
        ...big,
        {
          label: "Others",
          value: small.reduce((sum, s) => sum + s.value, 0),
          percent: small.reduce((sum, s) => sum + s.percent, 0),
        },
      ]
    : big;
  const dim = DIMENSIONS.find(d => d.key === field);
  return {
    title: dim?.title ?? `By ${String(field)}`,
    field: String(field),
    slices,
    totalValue: total,
  };
}
```

- [ ] **Step 4: Update the chart palette to render Not Found in neutral gray**

Find where chart slices are colored (look at `src/app/dashboard/breakdown/lib/colors.ts` or similar):

Run: `grep -rn "Not Found\|paletteFor\|sliceColor" src/app/dashboard/breakdown/`

Edit the color resolver so any slice with `label === "Not Found"` returns `#9ca3af` (Tailwind neutral-400) regardless of its index. If the chart uses a `palette[label]` lookup, add an explicit case for "Not Found" → gray. If it uses index-based assignment, add a guard before the lookup.

- [ ] **Step 5: Run tests to verify pass**

Run: `npx jest src/app/dashboard/breakdown/`
Expected: PASS — all breakdown tests including the two new ones

- [ ] **Step 6: Manual smoke test**

Open the Breakdown tab. Verify:
- A sector pie that has "Not Found" tickers shows a gray slice for them
- The slice persists even when small (e.g., 3% of portfolio)
- Tooltip shows "Not Found" with the dollar amount and percent

- [ ] **Step 7: Commit + 🚢 PUSH POINT 2**

```bash
git add src/app/dashboard/breakdown/lib/computeBreakdowns.ts src/app/dashboard/breakdown/lib/__tests__/computeBreakdowns.test.ts
# plus the colors.ts file from Step 4
git commit -m "feat(breakdown): preserve Not Found slices in neutral gray, never roll into Others"
git push origin main
```

PO can now see at a glance how much of the portfolio is unclassified. Migration script comes next.

---

## Group 4 — Migration Script (Tasks 17–19)

### Task 17: Add `MIGRATION_PHASE2_CLEANUP` audit action

**Files:**
- Modify: `src/types/audit.ts` (or wherever audit actions are defined)

- [ ] **Step 1: Locate audit action types**

Run: `grep -rn "PDF_IMPORT\|MANUAL_EDIT\|insertAuditLog" src/types src/lib/auditLog.ts 2>/dev/null | head -20`

- [ ] **Step 2: Add the new action type**

If actions are defined as a string union, add `"MIGRATION_PHASE2_CLEANUP"`. If they're free-form strings, no type change is needed but add a comment in `auditLog.ts` noting the new action label.

- [ ] **Step 3: Commit**

```bash
git add src/types/audit.ts # plus any other modified files
git commit -m "feat(audit): add MIGRATION_PHASE2_CLEANUP action type"
```

---

### Task 18: Implement the migration script with `--dry-run` mode

**Files:**
- Create: `scripts/migrate-cleanup-allowlist.ts`

- [ ] **Step 1: Implement the script**

```ts
// scripts/migrate-cleanup-allowlist.ts
/**
 * One-time cleanup of legacy bad classification values.
 * Run with --dry-run first to preview changes; without flag to apply.
 *
 *   AWS_PROFILE=... npx tsx scripts/migrate-cleanup-allowlist.ts --dry-run
 *   AWS_PROFILE=... npx tsx scripts/migrate-cleanup-allowlist.ts
 */

import { db, TABLE_NAME } from "@/lib/db";
import { ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
  NOT_FOUND,
} from "@/lib/classification/allowlists";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";

const DRY_RUN = process.argv.includes("--dry-run");

interface CleanupSummary {
  totalAssets: number;
  modified: number;
  byField: Record<string, number>;
}

async function main() {
  console.log(`[migrate-cleanup-allowlist] Starting (dry-run=${DRY_RUN})`);

  const summary: CleanupSummary = { totalAssets: 0, modified: 0, byField: {} };

  let exclusiveStartKey: Record<string, unknown> | undefined;
  const householdMutations = new Map<string, Array<{ before: any; after: any; ticker: string; assetSK: string }>>();

  do {
    const result = await db.send(new ScanCommand({
      TableName: TABLE_NAME,
      FilterExpression: "#t = :assetType",
      ExpressionAttributeNames: { "#t": "type" },
      ExpressionAttributeValues: { ":assetType": "ASSET" },
      ExclusiveStartKey: exclusiveStartKey,
    }));

    for (const asset of (result.Items || []) as any[]) {
      summary.totalAssets++;
      const before = { ...asset };

      const after = applyCompanyAutoDefaults({
        ...asset,
        securityType: normalizeSecurityType(asset.securityType),
        strategyType: normalizeStrategyType(asset.strategyType),
        call: normalizeCall(asset.call),
        sector: normalizeSector(asset.sector),
        market: normalizeMarket(asset.market, normalizeSecurityType(asset.securityType)),
        currency: normalizeCurrency(asset.currency),
        managementStyle: normalizeManagementStyle(asset.managementStyle),
        // Number fields: silent-zero → null per spec
        yield: asset.yield === 0 ? null : asset.yield ?? null,
        oneYearReturn: asset.oneYearReturn === 0 ? null : asset.oneYearReturn ?? null,
        threeYearReturn: asset.threeYearReturn === 0 ? null : asset.threeYearReturn ?? null,
        // managementFee: only null if NOT a Company (Company keeps its 0)
        managementFee: (normalizeSecurityType(asset.securityType) === "Company")
          ? (asset.managementFee ?? 0)
          : (asset.managementFee === 0 ? null : asset.managementFee ?? null),
        updatedAt: new Date().toISOString(),
      });

      const fieldsChanged: string[] = [];
      for (const k of ["securityType","strategyType","call","sector","market","currency","managementStyle","yield","oneYearReturn","threeYearReturn","managementFee"]) {
        if (before[k] !== after[k]) {
          fieldsChanged.push(k);
          summary.byField[k] = (summary.byField[k] ?? 0) + 1;
        }
      }

      if (fieldsChanged.length === 0) continue;

      summary.modified++;
      console.log(`  ${asset.ticker} (${asset.SK}): ${fieldsChanged.join(", ")}`);

      if (!DRY_RUN) {
        await db.send(new PutCommand({ TableName: TABLE_NAME, Item: after }));
        const householdId = String(asset.PK).replace("HOUSEHOLD#", "");
        if (!householdMutations.has(householdId)) householdMutations.set(householdId, []);
        householdMutations.get(householdId)!.push({
          before: toSnapshot(before),
          after: toSnapshot(after),
          ticker: asset.ticker,
          assetSK: asset.SK,
        });
      }
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  // Write audit log entries (one per household)
  if (!DRY_RUN) {
    for (const [householdId, mutations] of householdMutations.entries()) {
      try {
        await insertAuditLog(
          householdId,
          "MIGRATION_PHASE2_CLEANUP" as any,
          mutations.map(m => ({
            action: "UPDATE" as const,
            ticker: m.ticker,
            assetSK: m.assetSK,
            before: m.before,
            after: m.after,
          })),
          "migrate-cleanup-allowlist.ts",
        );
      } catch (e) {
        console.error(`Audit log write failed for ${householdId}:`, e);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`Total assets scanned: ${summary.totalAssets}`);
  console.log(`Modified: ${summary.modified}${DRY_RUN ? " (dry-run, NOT written)" : ""}`);
  console.log("By field:", summary.byField);
}

main().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Run dry-run against the dev database**

```bash
AWS_PROFILE=<dev-profile> npx tsx scripts/migrate-cleanup-allowlist.ts --dry-run
```

Expected output:
- Total assets scanned, modified count
- Per-asset list of changed fields
- Per-field tally
- Confirmation that nothing was written

Inspect the output. If any asset would be over-modified (e.g., a Company that already has correct fields), investigate before running for real.

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate-cleanup-allowlist.ts
git commit -m "feat(migration): add Phase 2 cleanup script with dry-run mode"
```

---

### Task 19: Run migration on prod, push final state

- [ ] **Step 1: Re-run dry-run against prod**

```bash
AWS_PROFILE=<prod-profile> npx tsx scripts/migrate-cleanup-allowlist.ts --dry-run
```

Save the output to `/tmp/migration-preview.txt` for the audit trail. Have the PO confirm the change list looks right (especially any Company auto-default reapplications and any silent-zero → null conversions).

- [ ] **Step 2: Run for real**

```bash
AWS_PROFILE=<prod-profile> npx tsx scripts/migrate-cleanup-allowlist.ts | tee /tmp/migration-prod-run.log
```

- [ ] **Step 3: Verify**

- Open the prod dashboard.
- Sample 5 random rows that the script reported as modified — confirm fields match expectation.
- Open Time Machine / audit log; confirm `MIGRATION_PHASE2_CLEANUP` entries exist.

- [ ] **Step 4: 🚢 PUSH POINT 3 — push final state to main**

```bash
git push origin main
```

---

## Group 5 — Wrap-up

### Task 20: Recommend adversarial review

Per global instructions, after a sprint that used writing-plans + executing-plans, recommend the adversarial review:

```
"Phase 2 implementation complete. Migration ran on prod, dropdowns are clean, Not Found cells are visible. Recommend running `/codex:adversarial-review` before declaring this sprint shipped — it catches a different class of issues than per-task review (race conditions, security holes, design flaws under load). Run it from a fresh prompt."
```

---

## Self-Review

**Spec coverage check:**

| Spec section | Implemented in |
|---|---|
| 1. Allowlists | Tasks 1–6 (constants + normalizers) |
| 2. Sector consolidation | Task 3 |
| 3. Market classification (Phase 2 best-effort) | Task 4 |
| 4. Company auto-defaults | Task 6 + applied in Tasks 8–11, 18 |
| 5. Missing-data handling (null vs 0) | Task 7 (types), Task 8 (research), Tasks 9–11 (writes), Task 14 (display), Task 18 (migration) |
| 6. Visual treatment | Task 12 (component), Task 14 (wired), Task 16 (chart) |
| 7. Migration script | Task 18, Task 19 |
| 8. Code architecture | Tasks 1–6 produce the file in spec |
| 9. Three-commit grouping | Tasks roll up into 3 PUSH POINTS (after 11, after 16, after 19) |
| 10. Testing strategy | Tasks 1–6 (unit), Task 8 (integration via classifier), manual smoke at each task |
| 11. Risks & mitigations | Lazy re-classification: scripts only normalize/null, no re-classify (Task 18). Yield consumers protected: Task 7 step 4 fixes downstream calculation sites. |
| 12. Definition of Done | PUSH POINT 3 + Task 20 (adversarial review recommended) |

**Type consistency check:**

- `StrategyType`, `SecurityType`, `Sector`, `Market`, `ManagementStyle`, `CallValue` — defined in Task 1, used consistently in Tasks 2–6, 8.
- `applyCompanyAutoDefaults` signature — defined in Task 6, called in Tasks 8 (researchTicker), 9 (POST), 10 (PUT), 11 (PDF), 18 (migration).
- `NotFoundCell` import path — `@/components/NotFoundCell`, used in Tasks 12, 14.
- Asset null-fields (`yield`, `oneYearReturn`, `threeYearReturn`, `fiveYearReturn`, `managementFee`) — declared `number | null` in Task 7, handled at every read/write site (Tasks 8–11, 14, 18).
- `normalizeMarket(raw, securityType?)` — signature defined in Task 4, used in Task 8 (researchTicker), Task 9 (POST), Task 10 (PUT, with merged securityType), Task 11 (PDF), Task 18 (migration).

**Placeholder scan:** No "TBD" / "TODO" / "implement later" / "similar to" — every step has concrete code or commands.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-27-phase2-boundary-layer-fixes.md`.**

Two execution options:

1. **Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks. Fast iteration; main context stays clean.
2. **Inline Execution** — I execute tasks in this session using executing-plans, batch execution with checkpoints for your review.

Which approach?
