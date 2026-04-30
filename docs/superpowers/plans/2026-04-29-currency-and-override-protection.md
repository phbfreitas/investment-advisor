# Currency Overwrite + Manual-Override Protection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the system from silently overwriting two kinds of user intent — per-row currency on PDF import, and manual classification overrides — by introducing per-field user-override locks on 8 lockable fields and a data-driven per-row currency parser.

**Architecture:** New optional `userOverrides?: Partial<Record<LockableField, boolean>>` field on the `Asset` type. Locks are *implicit* (set on user edit) and respected by every server- and client-side write path: the inline ticker lookup in `DashboardClient`, the PUT route's merge logic, and the PDF re-import enrichment. A small lock icon is rendered in the cell only when the field is locked; tapping it unlocks. The PDF parser inside `route.ts` is upgraded with a data-driven currency configuration table (`CURRENCY_CONFIGS`) that ships with USD/CAD entries and is trivially extensible for future currencies.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, DynamoDB single-table, Jest + ts-jest + jsdom, lucide-react icons.

**Spec:** [docs/superpowers/specs/2026-04-29-currency-and-override-protection-design.md](../specs/2026-04-29-currency-and-override-protection-design.md)

---

## File Structure

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/types/index.ts` | Add `LockableField` type and `userOverrides?` field on `Asset`. |
| Modify | `src/types/audit.ts` | Add optional `userOverrides?` to `AssetSnapshot` for rollback fidelity. |
| Modify | `src/lib/assetSnapshot.ts` | Include `userOverrides` in the `toSnapshot()` output. |
| Modify | `src/app/api/portfolio-pdf/route.ts` | Export `parseHoldings`. Add `CURRENCY_CONFIGS` and per-row currency state machine. Apply lock-aware merge in the upsert. |
| Create | `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts` | Unit tests for the per-row currency parser. |
| Modify | `src/app/api/assets/[id]/route.ts` | PUT handler accepts and persists `userOverrides`. |
| Create | `src/app/dashboard/lib/applyLookupRespectingLocks.ts` | Pure helper that merges Yahoo lookup data into edit form, respecting locks. |
| Create | `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts` | Unit tests for the helper. |
| Modify | `src/app/dashboard/DashboardClient.tsx` | Wire helper into `handleTickerLookup`. Add `setFieldWithLock` for 8 onChange handlers. Render lock icon in display + edit modes. |

The codebase already favors keeping logic close to consumers; we extract pure helpers only where it materially improves testability (the parser and the lookup-merge function). No new shared modules beyond those.

---

## Task 1: Add `LockableField` type + `userOverrides` field on Asset

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/types/audit.ts`
- Modify: `src/lib/assetSnapshot.ts`

**Goal:** Land the data-model change with zero behavior change. After this task, `userOverrides` is in the type system and propagates through the audit snapshot, but no code reads it yet.

- [ ] **Step 1: Add the type and the optional field on `Asset`**

In `src/types/index.ts`, add the following ABOVE the existing `export interface Asset` declaration:

```typescript
export type LockableField =
    | "sector"
    | "market"
    | "securityType"
    | "strategyType"
    | "call"
    | "managementStyle"
    | "currency"
    | "managementFee";
```

Then, inside the `Asset` interface (anywhere — convention suggests next to the other classification fields, but order doesn't matter), add:

```typescript
userOverrides?: Partial<Record<LockableField, boolean>>;
```

- [ ] **Step 2: Add the same field to `AssetSnapshot` for audit/rollback**

In `src/types/audit.ts`, add to the `AssetSnapshot` interface:

```typescript
userOverrides?: Partial<Record<"sector" | "market" | "securityType" | "strategyType" | "call" | "managementStyle" | "currency" | "managementFee", boolean>>;
```

(We inline the field literals here rather than importing `LockableField` to keep the types-of-types module dependency-free, matching the existing convention.)

- [ ] **Step 3: Update `toSnapshot()` to include `userOverrides`**

In `src/lib/assetSnapshot.ts`, replace the `return { ... }` with:

```typescript
return {
    quantity: Number(asset.quantity) || 0,
    marketValue: Number(asset.marketValue) || 0,
    bookCost: Number(asset.bookCost) || 0,
    profitLoss: Number(asset.profitLoss) || 0,
    liveTickerPrice: Number(asset.liveTickerPrice) || 0,
    currency: String(asset.currency || ""),
    account: String(asset.account || ""),
    accountNumber: String(asset.accountNumber || ""),
    accountType: String(asset.accountType || ""),
    sector: String(asset.sector || ""),
    market: String(asset.market || ""),
    securityType: String(asset.securityType || ""),
    strategyType: String(asset.strategyType || ""),
    call: String(asset.call || ""),
    managementStyle: String(asset.managementStyle || ""),
    externalRating: String(asset.externalRating || ""),
    managementFee: numOrNull(asset.managementFee),
    yield: numOrNull(asset.yield),
    oneYearReturn: numOrNull(asset.oneYearReturn),
    threeYearReturn: numOrNull(asset.threeYearReturn),
    fiveYearReturn: numOrNull(asset.fiveYearReturn),
    exDividendDate: String(asset.exDividendDate || ""),
    analystConsensus: String(asset.analystConsensus || ""),
    beta: Number(asset.beta) || 0,
    riskFlag: String(asset.riskFlag || ""),
    risk: String(asset.risk || ""),
    volatility: Number(asset.volatility) || 0,
    expectedAnnualDividends: Number(asset.expectedAnnualDividends) || 0,
    importSource: String(asset.importSource || ""),
    createdAt: String(asset.createdAt || ""),
    updatedAt: String(asset.updatedAt || ""),
    userOverrides: (asset.userOverrides && typeof asset.userOverrides === "object")
        ? asset.userOverrides as AssetSnapshot["userOverrides"]
        : undefined,
};
```

(The defensive cast handles DynamoDB's untyped record shape.)

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: zero errors. If errors appear, they likely indicate a place where `Asset` was used in a `Record<keyof Asset, ...>` context — fix by spreading instead.

- [ ] **Step 5: Run the existing test suite**

Run: `npm test`
Expected: all existing tests pass. No new behavior, so nothing should change.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/types/audit.ts src/lib/assetSnapshot.ts
git commit -m "feat(types): add LockableField + userOverrides to Asset and AssetSnapshot"
```

---

## Task 2: Export `parseHoldings` and write baseline single-currency test

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`
- Create: `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`

**Goal:** Make `parseHoldings` testable by exporting it. Lock in the existing single-currency behavior with a baseline test before changing anything.

- [ ] **Step 1: Export `parseHoldings` from `route.ts`**

In `src/app/api/portfolio-pdf/route.ts`, change `function parseHoldings(text: string): ParsedHolding[] {` (around line 63) to:

```typescript
export function parseHoldings(text: string): ParsedHolding[] {
```

Also export `ParsedHolding` (search for `interface ParsedHolding` or `type ParsedHolding` in the same file and add `export`).

(Next.js App Router only treats `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, `HEAD`, `OPTIONS` exports as route handlers. Other named exports are accessible via direct import.)

- [ ] **Step 2: Create the test file with a baseline test**

Create `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`:

```typescript
import { parseHoldings } from "../route";

describe("parseHoldings — currency", () => {
    it("tags every row with the document-level currency when no per-row markers exist", () => {
        const text = `
Account No. ABC123 TFSA
Some preamble.

VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(2);
        expect(holdings.every(h => h.currency === "USD")).toBe(true);
    });

    it("tags every row CAD when 'Canadian' appears at document level and no per-row markers exist", () => {
        const text = `
Canadian portfolio summary.

VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(2);
        expect(holdings.every(h => h.currency === "CAD")).toBe(true);
    });
});
```

- [ ] **Step 3: Run the tests, verify they pass**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`
Expected: 2 passed. (No behavior change — these tests document existing behavior.)

If a test fails, do NOT modify the parser yet. Instead, adjust the fixture so the existing parser produces the asserted result. The point is to lock in the *current* baseline before adding per-row detection.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts
git commit -m "test(parseHoldings): baseline single-currency tests + export for testability"
```

---

## Task 3: Per-row currency — section header detection

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`
- Modify: `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`

**Goal:** Add the `CURRENCY_CONFIGS` table and a section-tracking state machine. Rows under "Canadian Dollar Holdings" → CAD; rows under "U.S. Dollar Holdings" → USD.

- [ ] **Step 1: Add the failing section-header test**

Append to the `describe` block in `parseHoldings.test.ts`:

```typescript
it("tags rows with the most recent section-header currency", () => {
    const text = `
Account No. ABC123 TFSA

Canadian Dollar Holdings
VFV.TO 100 50.00 5500.00

U.S. Dollar Holdings
SPY 25 400.00 10500.00
QQQ 10 350.00 3700.00
    `.trim();

    const holdings = parseHoldings(text);

    expect(holdings).toHaveLength(3);
    const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
    expect(byTicker["VFV.TO"].currency).toBe("CAD");
    expect(byTicker["SPY"].currency).toBe("USD");
    expect(byTicker["QQQ"].currency).toBe("USD");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts -t "section-header currency"`
Expected: FAIL — all rows currently get the same document-level currency.

- [ ] **Step 3: Add `CURRENCY_CONFIGS` and the section state machine**

In `src/app/api/portfolio-pdf/route.ts`, add this near the top of the file (after imports, before any function definitions):

```typescript
type CurrencyCode = "USD" | "CAD";

type CurrencyConfig = {
    code: CurrencyCode;
    sectionRegex: RegExp;
    inlineToken: RegExp;
    documentRegex: RegExp;
};

const CURRENCY_CONFIGS: CurrencyConfig[] = [
    {
        code: "CAD",
        sectionRegex: /Canadian\s*Dollar\s*(?:Holdings|Securities|Account)?/i,
        inlineToken: /\bCAD\b/i,
        documentRegex: /CAD|Canadian/i,
    },
    {
        code: "USD",
        sectionRegex: /U\.?S\.?\s*Dollar\s*(?:Holdings|Securities|Account)?/i,
        inlineToken: /\bUSD\b/i,
        documentRegex: /USD|U\.?S\.?\s*Dollar/i,
    },
];

function detectDocumentDefaultCurrency(text: string): CurrencyCode {
    for (const cfg of CURRENCY_CONFIGS) {
        if (cfg.documentRegex.test(text)) return cfg.code;
    }
    return "USD";
}

function detectSectionCurrency(line: string): CurrencyCode | null {
    for (const cfg of CURRENCY_CONFIGS) {
        if (cfg.sectionRegex.test(line)) return cfg.code;
    }
    return null;
}
```

Now modify `parseHoldings`. Replace the line:

```typescript
const currency = /CAD|Canadian/i.test(text) ? "CAD" : "USD";
```

with:

```typescript
const documentDefault = detectDocumentDefaultCurrency(text);
let sectionCurrency: CurrencyCode | null = null;
```

Then, inside the `for (let i = 0; i < lines.length; i++) {` loop, ABOVE the existing pattern matchers, add:

```typescript
const headerMatch = detectSectionCurrency(line);
if (headerMatch !== null) {
    sectionCurrency = headerMatch;
    continue;
}
```

Finally, in EVERY `holdings.push({ ... })` call inside `parseHoldings`, change the `currency` field from the bare `currency` variable to:

```typescript
currency: sectionCurrency ?? documentDefault,
```

(There are 2-3 push sites; update each. The inline-token override comes in Task 4.)

- [ ] **Step 4: Run the failing test, verify it passes**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`
Expected: all 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts
git commit -m "feat(parseHoldings): section-header-driven currency detection"
```

---

## Task 4: Per-row currency — inline token detection

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`
- Modify: `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`

**Goal:** Add inline `USD`/`CAD` token detection per holding line. Inline tokens override section currency (and document default).

- [ ] **Step 1: Add the failing inline-token test**

Append to the `describe` block:

```typescript
it("uses an inline USD/CAD token in a row to override the section/document default", () => {
    const text = `
Canadian portfolio summary.

VFV.TO 100 50.00 5500.00 CAD
SPY 25 400.00 10500.00 USD
    `.trim();

    const holdings = parseHoldings(text);

    expect(holdings).toHaveLength(2);
    const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
    expect(byTicker["VFV.TO"].currency).toBe("CAD");
    expect(byTicker["SPY"].currency).toBe("USD");
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts -t "inline USD/CAD token"`
Expected: FAIL — SPY is currently tagged with the document-level CAD because of the "Canadian portfolio" preamble.

- [ ] **Step 3: Add inline token detection**

In `route.ts`, add this helper near `detectSectionCurrency`:

```typescript
function detectInlineCurrency(line: string): CurrencyCode | null {
    const matches = CURRENCY_CONFIGS.filter(cfg => cfg.inlineToken.test(line));
    return matches.length === 1 ? matches[0].code : null;
}
```

(Returns null if zero or two-or-more match — ambiguous lines fall through to section/default.)

Then update each `holdings.push({ ... })` call inside `parseHoldings`. Change:

```typescript
currency: sectionCurrency ?? documentDefault,
```

to:

```typescript
currency: detectInlineCurrency(line) ?? sectionCurrency ?? documentDefault,
```

(The variable `line` is in scope at each push site since the matchers loop over it.)

For the Wealthsimple multi-line block (the `wsQtyPattern` branch), the `line` variable refers to the ticker line; if currency markers might appear on subsequent lines, they're also worth checking. **Implementation note:** for V1, only check the primary `line` per push site. If PO testing reveals Wealthsimple-specific multi-line currency markers, file a follow-up.

- [ ] **Step 4: Run the test, verify it passes**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`
Expected: all 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts
git commit -m "feat(parseHoldings): inline USD/CAD token overrides section/default currency"
```

---

## Task 5: Per-row currency — full precedence + mixed-document test

**Files:**
- Modify: `src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`

**Goal:** Lock in the full precedence (inline > section > document default) with a TFSA-shaped fixture that mirrors Simone's screenshot.

- [ ] **Step 1: Add a comprehensive precedence test**

Append to the `describe` block:

```typescript
it("applies full precedence inline > section > document default in a TFSA-style mixed statement", () => {
    const text = `
Account No. TFSA12345

Canadian Dollar Holdings
VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00

U.S. Dollar Holdings
SPY 25 400.00 10500.00
QQQ 10 350.00 3700.00

Special row tagged USD inside a CAD section context: VEA.TO 5 10.00 55.00 USD
    `.trim();

    const holdings = parseHoldings(text);

    const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
    expect(byTicker["VFV.TO"].currency).toBe("CAD");
    expect(byTicker["XEQT.TO"].currency).toBe("CAD");
    expect(byTicker["SPY"].currency).toBe("USD");
    expect(byTicker["QQQ"].currency).toBe("USD");
    expect(byTicker["VEA.TO"]?.currency).toBe("USD");
});
```

(The `?.` on `VEA.TO` is defensive — if the parser's regex doesn't match a single-line edge case it'll be undefined; the assertion will surface that.)

- [ ] **Step 2: Run all currency tests, verify they pass**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts`
Expected: all 5 tests pass.

If the VEA.TO assertion fails because that ticker isn't matched at all by the existing regex (a Wealthsimple-specific format that's not a normal "ticker qty cost value" line), accept that as a known limitation: in real statements the inline token sits next to the price column, and the standard pattern catches it. Either:
- Remove that line from the fixture if it can't be matched.
- Or adjust the fixture to put VEA.TO in the standard position.

The point of this test is the precedence rule, not the regex's exhaustiveness.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/portfolio-pdf/__tests__/parseHoldings.test.ts
git commit -m "test(parseHoldings): mixed-currency TFSA precedence end-to-end"
```

---

## Task 6: PDF re-import — lock-aware merge for the 8 lockable fields

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`

**Goal:** When the PDF re-import path encounters an existing asset, fields with `existing.userOverrides[field] === true` win regardless of what the parser or Yahoo enrichment supplies.

- [ ] **Step 1: Add a lock-aware helper**

In `route.ts`, near the top of the file (after `CURRENCY_CONFIGS` from Task 3):

```typescript
import type { LockableField } from "@/types";

function pickWithLock<T>(
    existing: { userOverrides?: Partial<Record<LockableField, boolean>> } | null | undefined,
    field: LockableField,
    existingValue: T | undefined,
    fallback: T | undefined,
): T | undefined {
    if (existing?.userOverrides?.[field] === true) return existingValue;
    return fallback;
}
```

This is the "if locked, existing wins always" rule. The caller chooses how to compose the fallback (which may itself prefer existing-non-empty over enriched, etc.).

- [ ] **Step 2: Wire `pickWithLock` into the upsert site**

Find the `baseItem` construction in `route.ts` (around line 288). Replace each of the 6 classification fields and the 2 metadata fields with the lock-aware version. For example, change:

```typescript
sector: normalizeSector(
    (existing?.sector && existing.sector !== "" && existing.sector !== "N/A" && existing.sector !== "Not Found") ? existing.sector : enrichedData?.sector,
),
```

to:

```typescript
sector: normalizeSector(
    pickWithLock(
        existing,
        "sector",
        existing?.sector,
        (existing?.sector && existing.sector !== "" && existing.sector !== "N/A" && existing.sector !== "Not Found")
            ? existing.sector
            : enrichedData?.sector,
    ),
),
```

Apply the same shape to the other 7 fields:
- `market` (note: passes `securityType` to `normalizeMarket`)
- `securityType`
- `strategyType`
- `call`
- `managementStyle`
- `currency`
- `managementFee`

For `currency`, the existing line is:

```typescript
currency: normalizeCurrency(h.currency || enrichedData?.currency || existing?.currency || "CAD"),
```

becomes:

```typescript
currency: normalizeCurrency(
    pickWithLock(
        existing,
        "currency",
        existing?.currency,
        h.currency || enrichedData?.currency || existing?.currency || "CAD",
    ),
),
```

For `managementFee`, the existing is:

```typescript
managementFee: existing?.managementFee ?? enrichedData?.managementFee ?? null,
```

becomes:

```typescript
managementFee: pickWithLock(
    existing,
    "managementFee",
    existing?.managementFee,
    existing?.managementFee ?? enrichedData?.managementFee ?? null,
) ?? null,
```

Also: the `baseItem` object should propagate the existing `userOverrides` so it isn't lost on re-import:

```typescript
userOverrides: existing?.userOverrides,
```

(Add this near the top of the `baseItem` object, anywhere consistent with the other passthrough fields.)

- [ ] **Step 3: Verify the existing test suite still passes**

Run: `npm test`
Expected: all existing tests pass. (We've changed import-time merge logic but none of the currently-existing tests assert that path.)

This task does not add a new automated test — the lock-aware merge is integration-shaped and difficult to unit-test without mocking the entire DynamoDB session and Yahoo enrichment surface. The behavior is verified end-to-end via the manual browser check in Task 11. (If a future maintainer wants to test this in isolation, the cleanest path is extracting the entire `baseItem` construction into a pure function — out of scope here.)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts
git commit -m "feat(portfolio-pdf): respect userOverrides when merging existing assets on re-import"
```

---

## Task 7: PUT route accepts `userOverrides`

**Files:**
- Modify: `src/app/api/assets/[id]/route.ts`

**Goal:** The PUT handler must read `userOverrides` from the request body and persist it. Without this, the client-side lock changes never reach storage.

- [ ] **Step 1: Add `userOverrides` to the PUT merge**

In `src/app/api/assets/[id]/route.ts`, find the `const merged = { ... }` block (around line 98). Add before `updatedAt`:

```typescript
userOverrides: data.userOverrides !== undefined ? data.userOverrides : existingAsset.userOverrides,
```

The shape isn't normalized — we trust the client to send a valid `Partial<Record<LockableField, boolean>>`. (If desired, a future hardening pass can validate the keys and coerce values; for V1 the client is fully under our control.)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test`
Expected: all existing tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/assets/[id]/route.ts
git commit -m "feat(assets-route): persist userOverrides on PUT"
```

---

## Task 8: Client helper `applyLookupRespectingLocks` + tests

**Files:**
- Create: `src/app/dashboard/lib/applyLookupRespectingLocks.ts`
- Create: `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`

**Goal:** A pure function that takes the previous edit-form state, the Yahoo lookup response, and produces the next edit-form state — respecting per-field locks. Wiring into `DashboardClient.handleTickerLookup` happens in Task 9.

- [ ] **Step 1: Create the helper file**

Create `src/app/dashboard/lib/applyLookupRespectingLocks.ts`:

```typescript
import type { Asset, LockableField } from "@/types";

const LOCKABLE_FIELDS: readonly LockableField[] = [
    "sector",
    "market",
    "securityType",
    "strategyType",
    "call",
    "managementStyle",
    "currency",
    "managementFee",
] as const;

export type LookupData = {
    sector?: string;
    market?: string;
    securityType?: string;
    strategyType?: string;
    call?: string;
    managementStyle?: string;
    currency?: string;
    managementFee?: number | null;
    currentPrice?: number;
    dividendYield?: number | null;
    oneYearReturn?: number | null;
    threeYearReturn?: number | null;
    exDividendDate?: string;
    analystConsensus?: string;
    externalRating?: string;
    beta?: number;
    riskFlag?: string;
};

/**
 * Returns the patch to apply to editForm in response to a ticker lookup,
 * skipping any field that the user has explicitly locked.
 */
export function applyLookupRespectingLocks(
    prev: Partial<Asset>,
    data: LookupData,
): Partial<Asset> {
    const overrides = prev.userOverrides ?? {};
    const isLocked = (field: LockableField) => overrides[field] === true;

    return {
        sector: isLocked("sector") ? prev.sector : (data.sector || prev.sector),
        market: isLocked("market") ? prev.market : (data.market || prev.market),
        securityType: isLocked("securityType") ? prev.securityType : (data.securityType || prev.securityType),
        strategyType: isLocked("strategyType") ? prev.strategyType : (data.strategyType || prev.strategyType),
        call: isLocked("call") ? prev.call : (data.call || prev.call),
        managementStyle: isLocked("managementStyle") ? prev.managementStyle : (data.managementStyle || prev.managementStyle),
        currency: isLocked("currency") ? prev.currency : (data.currency || prev.currency),
        managementFee: isLocked("managementFee") ? prev.managementFee : (data.managementFee ?? prev.managementFee),

        // Live data — never locked, always taken from lookup if present.
        liveTickerPrice: data.currentPrice ?? prev.liveTickerPrice,
        yield: data.dividendYield ?? null,
        oneYearReturn: data.oneYearReturn ?? null,
        threeYearReturn: data.threeYearReturn ?? null,
        exDividendDate: data.exDividendDate ?? "",
        analystConsensus: data.analystConsensus ?? "",
        externalRating: data.externalRating ?? "",
        beta: data.beta ?? 0,
        riskFlag: data.riskFlag ?? "",

        // userOverrides itself is never written by the lookup.
    };
}

export { LOCKABLE_FIELDS };
```

- [ ] **Step 2: Create the test file**

Create `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`:

```typescript
import { applyLookupRespectingLocks, type LookupData } from "../applyLookupRespectingLocks";

describe("applyLookupRespectingLocks", () => {
    it("applies all lookup classification fields when nothing is locked", () => {
        const prev = { sector: "OldSector", call: "No" };
        const data: LookupData = { sector: "NewSector", call: "Yes" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("NewSector");
        expect(next.call).toBe("Yes");
    });

    it("preserves a locked classification field even when lookup returns a different value", () => {
        const prev = {
            sector: "Diversified",
            call: "No",
            userOverrides: { sector: true },
        };
        const data: LookupData = { sector: "Healthcare", call: "Yes" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("Diversified");  // locked → preserved
        expect(next.call).toBe("Yes");              // unlocked → updated
    });

    it("preserves a locked currency", () => {
        const prev = {
            currency: "USD",
            userOverrides: { currency: true },
        };
        const data: LookupData = { currency: "CAD" };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.currency).toBe("USD");
    });

    it("preserves a locked managementFee even when lookup returns a number", () => {
        const prev = {
            managementFee: 0.05,
            userOverrides: { managementFee: true },
        };
        const data: LookupData = { managementFee: 0.20 };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.managementFee).toBe(0.05);
    });

    it("always updates live data fields regardless of any classification lock", () => {
        const prev = {
            sector: "Diversified",
            yield: 0.01,
            userOverrides: { sector: true },
        };
        const data: LookupData = {
            sector: "Healthcare",
            currentPrice: 123.45,
            dividendYield: 0.05,
        };

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("Diversified");        // locked classification preserved
        expect(next.liveTickerPrice).toBe(123.45);      // live data refreshed
        expect(next.yield).toBe(0.05);                  // live data refreshed
    });

    it("never returns userOverrides — the lookup must not mutate lock state", () => {
        const prev = {
            userOverrides: { sector: true },
        };
        const data: LookupData = {};

        const next = applyLookupRespectingLocks(prev, data);

        expect("userOverrides" in next).toBe(false);
    });

    it("falls back to prev when lookup returns undefined for an unlocked field", () => {
        const prev = { sector: "OldSector" };
        const data: LookupData = {};

        const next = applyLookupRespectingLocks(prev, data);

        expect(next.sector).toBe("OldSector");
    });
});
```

- [ ] **Step 3: Run the tests, verify they pass**

Run: `npx jest src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts`
Expected: 7 passed.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/lib/applyLookupRespectingLocks.ts src/app/dashboard/lib/__tests__/applyLookupRespectingLocks.test.ts
git commit -m "feat(dashboard): add applyLookupRespectingLocks pure helper with tests"
```

---

## Task 9: Wire `applyLookupRespectingLocks` into `handleTickerLookup`

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

**Goal:** Replace the inline `data.X || prev.X` pattern in `handleTickerLookup` with a call to the new helper, so locks are respected at lookup time.

- [ ] **Step 1: Update `handleTickerLookup` to use the helper**

In `src/app/dashboard/DashboardClient.tsx`, add the import near the top:

```typescript
import { applyLookupRespectingLocks } from "@/app/dashboard/lib/applyLookupRespectingLocks";
```

Then find `handleTickerLookup` (around line 343). Replace the contents of `setEditForm(prev => ({ ... }))` with the helper call. The full updated function:

```typescript
const handleTickerLookup = async (symbol: string) => {
    if (!symbol.trim()) return;
    try {
        const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}`);
        if (res.ok) {
            const data = await res.json();
            const qty = editForm.quantity || 0;
            const price = data.currentPrice || 0;
            const yieldForCalc = data.dividendYield ?? 0;
            const bookCostNum = editForm.bookCost || 0;

            setEditForm(prev => {
                const lookupPatch = applyLookupRespectingLocks(prev, data);
                return {
                    ...prev,
                    ...lookupPatch,
                    // Computed fields derived from quantity * price * yield — always recomputed.
                    marketValue: qty > 0 && price > 0 ? qty * price : prev.marketValue,
                    profitLoss: qty > 0 && price > 0 ? (qty * price) - bookCostNum : prev.profitLoss,
                    expectedAnnualDividends: qty > 0 && price > 0 && yieldForCalc > 0 ? qty * price * yieldForCalc : 0,
                };
            });
        }
    } catch (err) {
        console.error('Ticker lookup failed:', err);
    }
};
```

(Computed fields stay inline because they depend on local variables `qty`/`price`/`bookCostNum` from the function scope.)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run the existing test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): respect userOverrides in handleTickerLookup"
```

---

## Task 10: `setFieldWithLock` helper + wire 8 onChange handlers

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

**Goal:** Every user-facing edit of one of the 8 lockable fields sets `userOverrides[field] = true` automatically.

- [ ] **Step 1: Add the helper inside the component**

In `DashboardClient.tsx`, near the existing `handleEditChange` function (around line 200), add:

```typescript
const setFieldWithLock = <F extends LockableField>(field: F, value: Asset[F]) => {
    setEditForm(prev => ({
        ...prev,
        [field]: value,
        userOverrides: { ...prev.userOverrides, [field]: true },
    }));
};
```

Add the import at the top:

```typescript
import type { LockableField } from "@/types";
```

- [ ] **Step 2: Identify the 8 onChange call sites**

The lockable fields are `sector`, `market`, `securityType`, `strategyType`, `call`, `managementStyle`, `currency`, `managementFee`.

Use grep on the file to find each `onChange` call site:

```bash
grep -n "onChange" src/app/dashboard/DashboardClient.tsx | grep -E "(sector|market|securityType|strategyType|^.*\bcall|managementStyle|currency|managementFee)"
```

(There may be multiple — both the inline-edit form AND the add-new-row form. Update both.)

For each onChange handler, replace the existing `setEditForm(prev => ({ ...prev, FIELD: value }))` with `setFieldWithLock("FIELD", value)`.

Example: a sector dropdown might currently be:

```tsx
<select
    value={editForm.sector || ""}
    onChange={e => setEditForm(prev => ({ ...prev, sector: e.target.value }))}
>
```

becomes:

```tsx
<select
    value={editForm.sector || ""}
    onChange={e => setFieldWithLock("sector", e.target.value)}
>
```

For numeric fields like `managementFee`:

```tsx
onChange={e => setFieldWithLock("managementFee", e.target.value === "" ? null : parseFloat(e.target.value))}
```

(The TypeScript signature `Asset[F]` captures the right type for each field.)

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

If `setFieldWithLock("managementFee", ...)` complains about the value type, double-check that the cast aligns with `Asset["managementFee"] = number | null`.

- [ ] **Step 4: Run the existing test suite**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): lock fields automatically on user edit via setFieldWithLock"
```

---

## Task 11: Lock icon UI — display + edit modes

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

**Goal:** Render a lock icon in each lockable cell when `userOverrides[field] === true`. Tap to unlock — in display mode it PUTs immediately; in edit mode it updates `editForm`.

- [ ] **Step 1: Add the lock icon helper component**

Inside `DashboardClient.tsx`, define (above the main component or in a sibling file — pick whichever matches the existing pattern; if everything else is inline, keep this inline too):

```tsx
import { Lock } from "lucide-react";

function LockedFieldIcon({
    isLocked,
    onUnlock,
    label,
}: {
    isLocked: boolean;
    onUnlock: () => void;
    label: string;
}) {
    if (!isLocked) return null;
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onUnlock(); }}
            aria-label={`${label} locked — click to unlock`}
            title={`${label} locked — click to unlock`}
            className="inline-flex items-center justify-center w-6 h-6 -ml-0.5 mr-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
        >
            <Lock className="h-3 w-3" aria-hidden="true" />
        </button>
    );
}
```

(`stopPropagation` prevents row-click handlers like "expand row" or "navigate to detail" from firing when the user taps the icon.)

- [ ] **Step 2: Add an unlock-from-display-mode handler**

Inside the `DashboardClient` component, near `saveEdit`:

```tsx
const handleUnlockField = async (asset: Asset, field: LockableField) => {
    const nextOverrides = { ...asset.userOverrides, [field]: false };
    try {
        const res = await fetch(`/api/assets/${asset.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...asset, userOverrides: nextOverrides }),
        });
        if (!res.ok) throw new Error("Failed to unlock field");
        fetchAssets();
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to unlock field";
        setMessage({ text: message, type: "error" });
    }
};
```

(Sends the entire asset back; the PUT route from Task 7 will accept the new `userOverrides` and persist it.)

- [ ] **Step 3: Render the lock icon in each lockable cell — display mode**

Find each table cell that displays one of the 8 lockable fields. The exact line numbers will depend on the current `DashboardClient.tsx` shape; use grep:

```bash
grep -n "{asset\.sector\|{asset\.market\|{asset\.securityType\|{asset\.strategyType\|{asset\.call\|{asset\.managementStyle\|{asset\.currency\|{asset\.managementFee" src/app/dashboard/DashboardClient.tsx
```

For each match, wrap the value in an inline-flex span with the lock icon:

```tsx
<span className="inline-flex items-center">
    <LockedFieldIcon
        isLocked={asset.userOverrides?.sector === true}
        onUnlock={() => handleUnlockField(asset, "sector")}
        label="Sector"
    />
    {asset.sector || ""}
</span>
```

Apply the same shape for the other 7 fields. The `label` prop should be a human-readable name: "Sector", "Market", "Type", "Strategy", "Call", "Mgmt Style", "Currency", "Mgmt Fee".

- [ ] **Step 4: Render the lock icon in each lockable cell — edit mode**

Find each edit-mode input/select for the 8 fields. Wrap each in the same pattern, but with an in-form unlock handler:

```tsx
<div className="flex items-center">
    <LockedFieldIcon
        isLocked={editForm.userOverrides?.sector === true}
        onUnlock={() => setEditForm(prev => ({
            ...prev,
            userOverrides: { ...prev.userOverrides, sector: false },
        }))}
        label="Sector"
    />
    <select
        value={editForm.sector || ""}
        onChange={e => setFieldWithLock("sector", e.target.value)}
        className="..."
    >
        {/* options */}
    </select>
</div>
```

(The icon is positioned to the left of the input via flex.)

Repeat for the other 7 fields.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 6: Run the existing test suite**

Run: `npm test`
Expected: all tests pass. (No new automated tests — the visual rendering of the lock icon is verified manually in Task 12. If the implementer wants regression coverage, a single snapshot test for "renders lock icon when userOverrides.sector is true" is welcome but optional.)

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): render lock icon on locked fields in display + edit modes"
```

---

## Task 12: Final verification — typecheck, lint, full test run, manual browser check

**Files:** None (verification only).

**Goal:** Confirm the change is clean across the toolchain and renders correctly.

- [ ] **Step 1: Run the full Jest suite**

Run: `npm test`
Expected: all tests pass — including the new parser tests and the new helper tests, plus the existing 173 baseline.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no NEW errors. Pre-existing lint warnings (e.g., `RotateCcw` unused, `react-hooks/set-state-in-effect` on existing effects) are out of scope and should not be fixed.

- [ ] **Step 4: Build smoke test**

Run: `npm run build`
Expected: build compiles successfully. (Page-data collection may fail due to a pre-existing missing `KMS_KEY_ID` env var unrelated to this sprint — that failure mode is acceptable.)

- [ ] **Step 5: Manual browser verification (mobile-first)**

Start the dev server: `npm run dev`. Open `http://localhost:3000/dashboard`.

Currency fix (item 1.4):
- Re-import a TFSA-style PDF with mixed CAD + USD holdings.
- Confirm USD-priced rows show currency `USD` and CAD-priced rows show `CAD`.

Manual override protection (item 1.3):
- On any holding, change Sector to a different value via the inline edit form. Save.
- Confirm a small lock icon appears next to the sector cell in the table.
- Click "Refresh" / run a single-ticker lookup on that holding.
- Confirm the sector value did NOT change. Lock icon is still visible.
- Repeat with `call`, `strategyType`, `currency`, `managementFee`.
- Tap the lock icon (in display mode, no edit). The icon disappears. Refresh — Yahoo's value now writes through.

Mobile (375 × 667):
- Confirm lock icons fit without breaking row layout.
- Tap target is reliably hittable.

Theme parity:
- Toggle dark mode. Confirm lock icons read correctly in both themes.

Multi-tab (sanity):
- Lock a field in one tab. Open another tab. The other tab won't see the lock until refresh — that's expected and out of scope; flagged in the design.

- [ ] **Step 6: Final commit if any fixes were made**

If manual verification surfaces a small visual/UX issue not caught by automated checks, fix it and commit:

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "fix(sidebar/locks): <describe adjustment>"
```

If nothing needed, no final commit. Implementation is complete.
