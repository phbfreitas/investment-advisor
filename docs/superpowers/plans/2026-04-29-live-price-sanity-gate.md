# Live-Price Sanity Gate + Concentration Sum Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [docs/superpowers/specs/2026-04-29-live-price-sanity-gate-design.md](../specs/2026-04-29-live-price-sanity-gate-design.md)

**Goal:** Add a passive `?` flag next to the Live $ value when a refresh delivers a price ≥10% off prior, log the anomaly with the raw Yahoo response to DynamoDB, and show the summed % of the Top-N Holdings in the Concentration chart title.

**Architecture:** Detection is a pure helper computed client-side (`detectAnomaly`); `DashboardClient.tsx` integrates it into `fetchMarketData` and the edit-form `useEffect`. Anomalous events fire-and-forget POST to a new server endpoint `/api/price-anomaly-log` which writes a `PRICE_ANOMALY` record to the existing single-table DynamoDB. The visual `?` renders only on the dashboard table cell; the edit-form path logs without rendering. Concentration sum is a one-line `reduce` in the section title.

**Tech Stack:** Next.js 16 App Router (server routes), TypeScript, React 19 (client component), Jest + ts-jest, jsdom for component tests, AWS SDK v3 (`@aws-sdk/lib-dynamodb`), next-auth.

**Conventions to follow:**
- Test files live under `__tests__` siblings to the implementation, named `<basename>.test.ts(x)`.
- Pure helpers go in their own files so they can be tested in isolation (mirror `parseHoldings.ts` + `__tests__/parseHoldings.test.ts`).
- Server-side helpers that touch DynamoDB go in `src/lib/` (mirror `src/lib/auditLog.ts`).
- Conventional Commits (`feat(...)`, `test(...)`, `refactor(...)`).
- One commit per task. Tests committed in the same commit as the code they cover.

---

## File Plan

| Path | Status | Purpose |
|---|---|---|
| `src/app/dashboard/lib/priceAnomaly.ts` | NEW | Pure helper: `detectAnomaly(prior, next, threshold)` returns `{ isAnomaly, deltaPct }`. Tested in isolation. |
| `src/app/dashboard/lib/__tests__/priceAnomaly.test.ts` | NEW | Unit tests for the helper. |
| `src/types/priceAnomaly.ts` | NEW | `PriceAnomalyPayload` (request body) + `PriceAnomalyRecord` (DDB item). |
| `src/lib/priceAnomalyLog.ts` | NEW | `insertPriceAnomalyLog(householdId, payload)` — DDB writer, mirrors `src/lib/auditLog.ts`. |
| `src/lib/__tests__/priceAnomalyLog.test.ts` | NEW | Verify the writer constructs the correct DDB item shape (db sender mocked). |
| `src/app/api/price-anomaly-log/route.ts` | NEW | `POST` handler: auth + payload validation + delegate to `insertPriceAnomalyLog`. |
| `src/app/dashboard/DashboardClient.tsx` | MODIFY | Add `anomalies` state; integrate detection in `fetchMarketData` (lines 91-118) and edit-form `useEffect` (lines 161-179); render `?` next to Live $ in the table cell (lines 848-858). |
| `src/app/dashboard/breakdown/ConcentrationSection.tsx` | MODIFY | Title becomes `Top N Holdings · X.X% of portfolio`. |
| `src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx` | NEW | Title content tests (10/N rows, sum correctness, rounding). |

---

## Task 1: Pure detectAnomaly helper

**Files:**
- Create: `src/app/dashboard/lib/priceAnomaly.ts`
- Test: `src/app/dashboard/lib/__tests__/priceAnomaly.test.ts`

- [ ] **Step 1.1: Write the failing test**

Create `src/app/dashboard/lib/__tests__/priceAnomaly.test.ts`:

```typescript
import { detectAnomaly } from "../priceAnomaly";

describe("detectAnomaly", () => {
    it("returns isAnomaly=false when prior is 0 (no baseline)", () => {
        expect(detectAnomaly(0, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is null", () => {
        expect(detectAnomaly(null as unknown as number, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when prior is undefined", () => {
        expect(detectAnomaly(undefined as unknown as number, 100).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when next is 0", () => {
        expect(detectAnomaly(100, 0).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=false when delta is below threshold", () => {
        expect(detectAnomaly(100, 109).isAnomaly).toBe(false);
    });

    it("returns isAnomaly=true at exactly 10% (boundary)", () => {
        const result = detectAnomaly(100, 110);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(10);
    });

    it("returns isAnomaly=true on a 100% jump (the JEPQ-style 2x case)", () => {
        const result = detectAnomaly(58, 116);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(100);
    });

    it("returns isAnomaly=true on a -11% drop (sign-agnostic)", () => {
        const result = detectAnomaly(100, 89);
        expect(result.isAnomaly).toBe(true);
        expect(result.deltaPct).toBeCloseTo(-11);
    });

    it("respects a custom threshold", () => {
        expect(detectAnomaly(100, 105, 0.05).isAnomaly).toBe(true);
        expect(detectAnomaly(100, 104.99, 0.05).isAnomaly).toBe(false);
    });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/lib/__tests__/priceAnomaly.test.ts`
Expected: FAIL — `Cannot find module '../priceAnomaly'`.

- [ ] **Step 1.3: Implement the helper**

Create `src/app/dashboard/lib/priceAnomaly.ts`:

```typescript
export interface AnomalyResult {
    isAnomaly: boolean;
    deltaPct: number;
}

/**
 * Detects whether `next` differs from `prior` by at least `threshold`
 * (default 10%). Returns isAnomaly=false when there's no usable baseline
 * (prior <= 0 or null/undefined) or when next is 0/missing.
 *
 * `deltaPct` is signed and expressed as a percentage (e.g., +100.3 or -10.9).
 */
export function detectAnomaly(
    prior: number,
    next: number,
    threshold = 0.1
): AnomalyResult {
    if (!prior || prior <= 0 || !next || next <= 0) {
        return { isAnomaly: false, deltaPct: 0 };
    }
    const ratio = (next - prior) / prior;
    const deltaPct = ratio * 100;
    return {
        isAnomaly: Math.abs(ratio) >= threshold,
        deltaPct,
    };
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `npx jest src/app/dashboard/lib/__tests__/priceAnomaly.test.ts`
Expected: PASS — 9 tests pass.

- [ ] **Step 1.5: Commit**

```bash
git add src/app/dashboard/lib/priceAnomaly.ts src/app/dashboard/lib/__tests__/priceAnomaly.test.ts
git commit -m "feat(priceAnomaly): pure detectAnomaly helper with 10% default threshold"
```

---

## Task 2: PriceAnomaly types

**Files:**
- Create: `src/types/priceAnomaly.ts`

- [ ] **Step 2.1: Create the types file**

Create `src/types/priceAnomaly.ts`:

```typescript
/**
 * Wire payload from the dashboard client to the price-anomaly-log endpoint.
 * Captured during a refresh or edit-form ticker lookup whenever the
 * detectAnomaly helper returns isAnomaly=true.
 */
export interface PriceAnomalyPayload {
    ticker: string;
    assetId: string;
    priorPrice: number;
    newPrice: number;
    deltaPct: number;       // signed percentage (+100.3 or -10.9)
    deltaAbs: number;       // signed dollars
    source: "refresh" | "edit-form-lookup";
    rawYahooQuote: unknown; // forwarded verbatim from /api/market-data response
}

/**
 * DynamoDB item shape for an anomaly record (for type safety in the writer).
 */
export interface PriceAnomalyRecord {
    PK: string;             // HOUSEHOLD#<id>
    SK: string;             // ANOMALY#<isoTimestamp>#<ticker>
    type: "PRICE_ANOMALY";
    ticker: string;
    assetId: string;
    priorPrice: number;
    newPrice: number;
    deltaPct: number;
    deltaAbs: number;
    source: PriceAnomalyPayload["source"];
    detectedAt: string;     // ISO timestamp
    rawYahooQuote: unknown;
}
```

- [ ] **Step 2.2: Verify the file compiles**

Run: `npx tsc --noEmit`
Expected: no errors related to this file. (Other unrelated errors in the repo are out of scope — only fail if the new file itself errors.)

- [ ] **Step 2.3: Commit**

```bash
git add src/types/priceAnomaly.ts
git commit -m "feat(types): add PriceAnomalyPayload and PriceAnomalyRecord"
```

---

## Task 3: insertPriceAnomalyLog server helper

**Files:**
- Create: `src/lib/priceAnomalyLog.ts`
- Test: `src/lib/__tests__/priceAnomalyLog.test.ts`

This mirrors `src/lib/auditLog.ts` (existing pattern in the codebase).

- [ ] **Step 3.1: Write the failing test**

Create `src/lib/__tests__/priceAnomalyLog.test.ts`:

```typescript
import { buildPriceAnomalyItem } from "../priceAnomalyLog";

describe("buildPriceAnomalyItem", () => {
    const samplePayload = {
        ticker: "JEPQ",
        assetId: "asset-uuid-1",
        priorPrice: 58.12,
        newPrice: 116.40,
        deltaPct: 100.3,
        deltaAbs: 58.28,
        source: "refresh" as const,
        rawYahooQuote: { regularMarketPrice: 116.40, currency: "USD", symbol: "JEPQ" },
    };

    it("constructs a PK/SK keyed to the household and ticker", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.PK).toBe("HOUSEHOLD#hh-123");
        expect(item.SK).toBe("ANOMALY#2026-04-29T12:00:00.000Z#JEPQ");
        expect(item.type).toBe("PRICE_ANOMALY");
    });

    it("preserves payload fields and includes detectedAt", () => {
        const item = buildPriceAnomalyItem("hh-123", samplePayload, "2026-04-29T12:00:00.000Z");
        expect(item.ticker).toBe("JEPQ");
        expect(item.priorPrice).toBe(58.12);
        expect(item.newPrice).toBe(116.40);
        expect(item.deltaPct).toBe(100.3);
        expect(item.detectedAt).toBe("2026-04-29T12:00:00.000Z");
        expect(item.rawYahooQuote).toEqual({
            regularMarketPrice: 116.40,
            currency: "USD",
            symbol: "JEPQ",
        });
    });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npx jest src/lib/__tests__/priceAnomalyLog.test.ts`
Expected: FAIL — `Cannot find module '../priceAnomalyLog'`.

- [ ] **Step 3.3: Implement the helper**

Create `src/lib/priceAnomalyLog.ts`:

```typescript
import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import type { PriceAnomalyPayload, PriceAnomalyRecord } from "@/types/priceAnomaly";

/**
 * Build the DynamoDB item from an anomaly payload. Pure function for testability.
 */
export function buildPriceAnomalyItem(
    householdId: string,
    payload: PriceAnomalyPayload,
    detectedAt: string
): PriceAnomalyRecord {
    return {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `ANOMALY#${detectedAt}#${payload.ticker}`,
        type: "PRICE_ANOMALY",
        ticker: payload.ticker,
        assetId: payload.assetId,
        priorPrice: payload.priorPrice,
        newPrice: payload.newPrice,
        deltaPct: payload.deltaPct,
        deltaAbs: payload.deltaAbs,
        source: payload.source,
        detectedAt,
        rawYahooQuote: payload.rawYahooQuote,
    };
}

/**
 * Writes a price-anomaly record to DynamoDB. Best-effort — caller catches
 * failures and treats logging as non-critical.
 */
export async function insertPriceAnomalyLog(
    householdId: string,
    payload: PriceAnomalyPayload
): Promise<string> {
    const detectedAt = new Date().toISOString();
    const item = buildPriceAnomalyItem(householdId, payload, detectedAt);
    await db.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: item,
        })
    );
    return item.SK;
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npx jest src/lib/__tests__/priceAnomalyLog.test.ts`
Expected: PASS — 2 tests pass.

- [ ] **Step 3.5: Commit**

```bash
git add src/lib/priceAnomalyLog.ts src/lib/__tests__/priceAnomalyLog.test.ts
git commit -m "feat(priceAnomalyLog): DDB writer + pure item builder helper"
```

---

## Task 4: POST /api/price-anomaly-log route

**Files:**
- Create: `src/app/api/price-anomaly-log/route.ts`

The route is thin: auth + minimal validation + delegate. Following the existing pattern in this codebase, no integration test is added for the route handler itself; the underlying helper is unit-tested in Task 3, and manual QA in Task 8 verifies end-to-end.

- [ ] **Step 4.1: Implement the route**

Create `src/app/api/price-anomaly-log/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertPriceAnomalyLog } from "@/lib/priceAnomalyLog";
import type { PriceAnomalyPayload } from "@/types/priceAnomaly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidPayload(body: unknown): body is PriceAnomalyPayload {
    if (!body || typeof body !== "object") return false;
    const b = body as Record<string, unknown>;
    return (
        typeof b.ticker === "string" &&
        typeof b.assetId === "string" &&
        typeof b.priorPrice === "number" &&
        typeof b.newPrice === "number" &&
        typeof b.deltaPct === "number" &&
        typeof b.deltaAbs === "number" &&
        (b.source === "refresh" || b.source === "edit-form-lookup")
    );
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        if (!isValidPayload(body)) {
            return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }

        const householdId = session.user.householdId;
        const sk = await insertPriceAnomalyLog(householdId, body);

        console.log(
            `[price-anomaly] ${body.ticker} prior=${body.priorPrice.toFixed(2)} ` +
                `new=${body.newPrice.toFixed(2)} delta=${body.deltaPct >= 0 ? "+" : ""}${body.deltaPct.toFixed(1)}% ` +
                `household=${householdId}`
        );

        return NextResponse.json({ ok: true, sk });
    } catch (error) {
        console.error("[price-anomaly] write failed:", error);
        // Best-effort: return 200 with ok:false so the client doesn't surface an error.
        return NextResponse.json({ ok: false, error: "internal" }, { status: 200 });
    }
}
```

- [ ] **Step 4.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors from this file.

- [ ] **Step 4.3: Verify the route is reachable**

Start the dev server: `npm run dev`

In another terminal, send a test payload (will return 401 because we're unauthed — that's the expected response that proves the route is wired up):

```bash
curl -X POST http://localhost:3000/api/price-anomaly-log \
  -H "Content-Type: application/json" \
  -d '{"ticker":"TEST","assetId":"x","priorPrice":1,"newPrice":2,"deltaPct":100,"deltaAbs":1,"source":"refresh","rawYahooQuote":{}}'
```

Expected: HTTP 401 with `{"ok":false,"error":"Unauthorized"}`. Stop the dev server.

- [ ] **Step 4.4: Commit**

```bash
git add src/app/api/price-anomaly-log/route.ts
git commit -m "feat(api): POST /price-anomaly-log endpoint"
```

---

## Task 5: Wire detection into fetchMarketData (refresh path)

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (around lines 91-118 + state declaration area)

This adds an `anomalies` state, computes deltas after each ticker fetch, fires the log POST when an anomaly is detected, and stores the anomaly info for rendering. The new price still applies to display normally — the anomaly is informational only.

- [ ] **Step 5.1: Read the current state declarations**

Run: `grep -n "useState" src/app/dashboard/DashboardClient.tsx | head -20`

Note where existing state hooks live (typically near the top of the component). The new `anomalies` state goes alongside `marketData`.

- [ ] **Step 5.2: Add the anomalies state and import**

In `src/app/dashboard/DashboardClient.tsx`:

1. Add the import at the top of the imports section (alphabetize within the local-imports group):

```typescript
import { detectAnomaly } from "./lib/priceAnomaly";
```

2. Find the line declaring `marketData` state (search for `useState<Record<string, MarketData>>`) and add the anomalies state immediately after it:

```typescript
const [anomalies, setAnomalies] = useState<Record<string, { prior: number; next: number; deltaPct: number }>>({});
```

- [ ] **Step 5.3: Update fetchMarketData to detect + log**

Replace the existing `fetchMarketData` function (currently at lines 91-118) with:

```typescript
const fetchMarketData = async (symbols: string[]) => {
    const validSymbols = symbols.filter(Boolean);
    if (validSymbols.length === 0) return;
    setIsMarketLoading(true);

    const uniqueTickers = Array.from(new Set(validSymbols));

    try {
        const promises = uniqueTickers.map(ticker =>
            fetch(`/api/market-data?ticker=${ticker}`).then(res => res.json().catch(() => null)) as Promise<MarketData | null>
        );

        const results = await Promise.all(promises);
        const newMarketData: Record<string, MarketData> = {};
        const newAnomalies: Record<string, { prior: number; next: number; deltaPct: number }> = {};

        results.forEach(data => {
            if (data && data.ticker && !data.error) {
                newMarketData[data.ticker] = data as MarketData;

                const asset = assets.find(a => a.ticker === data.ticker);
                const prior = asset?.liveTickerPrice ?? 0;
                const next = data.currentPrice ?? 0;
                const { isAnomaly, deltaPct } = detectAnomaly(prior, next);

                if (isAnomaly && asset) {
                    newAnomalies[data.ticker] = { prior, next, deltaPct };
                    // Fire-and-forget — logging is best-effort instrumentation.
                    fetch("/api/price-anomaly-log", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            ticker: data.ticker,
                            assetId: asset.id,
                            priorPrice: prior,
                            newPrice: next,
                            deltaPct,
                            deltaAbs: next - prior,
                            source: "refresh",
                            rawYahooQuote: data,
                        }),
                    }).catch(() => { /* swallow */ });
                }
            }
        });

        setMarketData(prev => ({ ...prev, ...newMarketData }));
        setAnomalies(prev => ({ ...prev, ...newAnomalies }));
    } catch (error) {
        console.error("Failed to load market data", error);
    } finally {
        setIsMarketLoading(false);
    }
};
```

- [ ] **Step 5.4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5.5: Run all tests to confirm nothing regressed**

Run: `npx jest`
Expected: all tests pass (no DashboardClient tests today; we just need to confirm no other tests broke).

- [ ] **Step 5.6: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): detect price anomalies in fetchMarketData and log to server"
```

---

## Task 6: Wire detection into edit-form useEffect (log only, no UI)

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (the debounced edit-form useEffect, currently lines 161-179)

In the edit form, the user is actively reviewing the price as it populates. We log anomalies for forensics but do NOT render a `?` icon (rendering it next to a live `<input>` would be noisy and offer no info the user isn't already seeing).

- [ ] **Step 6.1: Update the edit-form useEffect**

Find the existing `useEffect` block that starts with `// Debounced live ticker fetch when editing ticker` (around line 160) and replace its body with:

```typescript
// Debounced live ticker fetch when editing ticker
useEffect(() => {
    if (editingId && editForm.ticker) {
        const timer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/market-data?ticker=${editForm.ticker}`);
                const data = await res.json();
                if (data && !data.error && data.currentPrice) {
                    const prior = editForm.liveTickerPrice ?? 0;
                    const next = data.currentPrice;
                    const { isAnomaly, deltaPct } = detectAnomaly(prior, next);

                    if (isAnomaly && editingId !== "NEW") {
                        // Edit-form anomaly: log only, do NOT render `?` (active input field).
                        fetch("/api/price-anomaly-log", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                                ticker: editForm.ticker,
                                assetId: editingId,
                                priorPrice: prior,
                                newPrice: next,
                                deltaPct,
                                deltaAbs: next - prior,
                                source: "edit-form-lookup",
                                rawYahooQuote: data,
                            }),
                        }).catch(() => { /* swallow */ });
                    }

                    setEditForm(prev => ({
                        ...prev,
                        liveTickerPrice: data.currentPrice,
                    }));
                }
            } catch (e) {
                // ignore
            }
        }, 1000);
        return () => clearTimeout(timer);
    }
}, [editForm.ticker, editingId]);
```

Note: `editingId !== "NEW"` skips logging on brand-new asset creation (no prior to compare against meaningfully); `detectAnomaly` would also return `isAnomaly=false` when prior=0, but the explicit check makes intent clearer.

- [ ] **Step 6.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6.3: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): log price anomalies on edit-form ticker lookup (log-only)"
```

---

## Task 7: Render `?` icon in Live $ table cell

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx` (Live $ cell render, currently lines 848-858)

- [ ] **Step 7.1: Replace the Live $ cell render**

Find the block:

```tsx
<td className="px-3 py-3 text-emerald-600 dark:text-emerald-400 font-medium">
    {isEditing ? (
        <input type="number" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={editForm.liveTickerPrice ?? 0} onChange={e => handleEditChange('liveTickerPrice', parseFloat(e.target.value) || 0)} />
    ) : (
        (() => {
            const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
            const numPrice = Number(price);
            return isNaN(numPrice) ? "N/A" : `$${numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        })()
    )}
</td>
```

Replace with:

```tsx
<td className="px-3 py-3 text-emerald-600 dark:text-emerald-400 font-medium">
    {isEditing ? (
        <input type="number" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={editForm.liveTickerPrice ?? 0} onChange={e => handleEditChange('liveTickerPrice', parseFloat(e.target.value) || 0)} />
    ) : (
        (() => {
            const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
            const numPrice = Number(price);
            const formatted = isNaN(numPrice)
                ? "N/A"
                : `$${numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const anomaly = anomalies[asset.ticker];
            return (
                <span className="inline-flex items-center gap-1">
                    <span>{formatted}</span>
                    {anomaly && (
                        <span
                            title={`Changed from $${anomaly.prior.toFixed(2)} (${anomaly.deltaPct >= 0 ? "+" : ""}${anomaly.deltaPct.toFixed(1)}%)`}
                            aria-label={`Price changed by ${anomaly.deltaPct.toFixed(1)} percent`}
                            className="text-neutral-400 dark:text-neutral-500 text-xs cursor-help select-none px-1"
                            data-testid={`price-anomaly-flag-${asset.ticker}`}
                        >
                            ?
                        </span>
                    )}
                </span>
            );
        })()
    )}
</td>
```

The `data-testid` is added so future component tests can find the flag deterministically without relying on text content.

- [ ] **Step 7.2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7.3: Lint**

Run: `npm run lint`
Expected: no new errors in DashboardClient.tsx.

- [ ] **Step 7.4: Run all tests**

Run: `npx jest`
Expected: all pass.

- [ ] **Step 7.5: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): render grey ? flag next to Live \$ when price anomaly detected"
```

---

## Task 8: Manual QA on dev server (5G.1 end-to-end)

**Files:** none (manual verification only — no commit)

This catches integration issues that unit tests can't. Execute on the dev server before moving on.

- [ ] **Step 8.1: Start the dev server**

Run: `npm run dev`

Wait for the "ready" line. Open http://localhost:3000 and sign in.

- [ ] **Step 8.2: Set up the repro**

Navigate to the dashboard. Pick any asset with a non-zero `liveTickerPrice`. Note the current price. Edit the row, manually change `Live $` to **half** the current value. Save.

- [ ] **Step 8.3: Trigger a refresh**

Click the global Refresh button (or the area that triggers `fetchAssets`).

- [ ] **Step 8.4: Verify the `?` appears**

In the Live $ cell for the asset you just edited, confirm a small grey `?` is visible to the right of the price. Hover (desktop) — tooltip reads `Changed from $X.XX (+YY.Y%)` with the prior (halved) value and a positive delta around +100%.

- [ ] **Step 8.5: Verify the log was written**

Check the dev server console output. You should see a line like:
`[price-anomaly] AAPL prior=92.50 new=185.00 delta=+100.0% household=<id>`

If you have AWS DynamoDB access (or a local mock), confirm a `PRICE_ANOMALY` record exists under your household partition with `rawYahooQuote` populated.

- [ ] **Step 8.6: Verify next refresh clears the flag**

Hit Refresh again. The `?` should disappear (the previously-anomalous price is now the baseline; delta = 0).

- [ ] **Step 8.7: Verify edge case — first-time / zero baseline**

Edit a different asset, set its `liveTickerPrice` to `0`, save. Refresh. Confirm NO `?` appears for that asset (no baseline, so no anomaly).

- [ ] **Step 8.8: Mobile viewport check**

Open Chrome DevTools, toggle device toolbar, switch to a phone-sized viewport. Repeat Step 8.2-8.4. Confirm the `?` is visible, doesn't break the row layout, and tap area is reachable.

- [ ] **Step 8.9: Stop the dev server**

If all steps passed, stop the dev server. If any failed, debug before proceeding.

---

## Task 9: Concentration sum in section title

**Files:**
- Modify: `src/app/dashboard/breakdown/ConcentrationSection.tsx`
- Create: `src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx`

- [ ] **Step 9.1: Write the failing test**

Create `src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { ConcentrationSection } from "../ConcentrationSection";
import type { TopHoldings } from "../lib/types";

const makeTopHoldings = (rows: Array<{ ticker: string; percent: number }>): TopHoldings => ({
    top: rows.map(r => ({
        ticker: r.ticker,
        marketValue: 1000,
        percent: r.percent,
        call: "No",
        account: "Brokerage",
        sector: "IT",
        currency: "USD",
    })),
    others: null,
    totalValue: rows.reduce((sum, r) => sum + 1000, 0),
});

describe("ConcentrationSection title", () => {
    it("shows sum of percents in title with 10 holdings", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 10 },
            { ticker: "B", percent: 9 },
            { ticker: "C", percent: 8 },
            { ticker: "D", percent: 7 },
            { ticker: "E", percent: 6 },
            { ticker: "F", percent: 5 },
            { ticker: "G", percent: 4 },
            { ticker: "H", percent: 3 },
            { ticker: "I", percent: 2 },
            { ticker: "J", percent: 1 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        expect(screen.getByText(/Top 10 Holdings/i)).toBeInTheDocument();
        expect(screen.getByText(/55\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("adapts the count when fewer than 10 holdings are present", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 50 },
            { ticker: "B", percent: 25 },
            { ticker: "C", percent: 15 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        expect(screen.getByText(/Top 3 Holdings/i)).toBeInTheDocument();
        expect(screen.getByText(/90\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("renders 0.0% when there are no holdings", () => {
        render(<ConcentrationSection topHoldings={{ top: [], others: null, totalValue: 0 }} />);
        expect(screen.getByText(/Top 0 Holdings/i)).toBeInTheDocument();
        expect(screen.getByText(/0\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("rounds to one decimal", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 33.33 },
            { ticker: "B", percent: 33.33 },
            { ticker: "C", percent: 33.34 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        // 33.33 + 33.33 + 33.34 = 100.00
        expect(screen.getByText(/100\.0% of portfolio/i)).toBeInTheDocument();
    });
});
```

- [ ] **Step 9.2: Run test to verify it fails**

Run: `npx jest src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx`
Expected: FAIL — "Top N Holdings" text not present in current title (currently hardcoded "Top 10 Holdings"); the percent line is also missing.

- [ ] **Step 9.3: Update ConcentrationSection.tsx**

Find the existing `<h3>` block at the top of the component:

```tsx
<h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">Top 10 Holdings</h3>
```

Replace with:

```tsx
<h3 className="text-sm font-medium text-neutral-800 dark:text-neutral-200 mb-2">
    Top {rows.length} Holdings
    <span className="text-neutral-500 dark:text-neutral-400 font-normal">
        {" · "}{rows.reduce((sum, r) => sum + (r.percent ?? 0), 0).toFixed(1)}% of portfolio
    </span>
</h3>
```

- [ ] **Step 9.4: Run the test to verify it passes**

Run: `npx jest src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx`
Expected: PASS — 4 tests pass.

- [ ] **Step 9.5: Run all tests to confirm no regressions**

Run: `npx jest`
Expected: all pass, including the existing BreakdownTab and DriftSignalsSection tests.

- [ ] **Step 9.6: Commit**

```bash
git add src/app/dashboard/breakdown/ConcentrationSection.tsx src/app/dashboard/breakdown/__tests__/ConcentrationSection.test.tsx
git commit -m "feat(concentration): show summed % of portfolio in Top-N Holdings title"
```

---

## Task 10: Final verification + lint pass

**Files:** none (verification only)

- [ ] **Step 10.1: Full test run**

Run: `npx jest`
Expected: all tests pass; no skipped/pending tests added.

- [ ] **Step 10.2: TypeScript check**

Run: `npx tsc --noEmit`
Expected: no new errors introduced by this work.

- [ ] **Step 10.3: Lint**

Run: `npm run lint`
Expected: no new errors in any file touched by this plan.

- [ ] **Step 10.4: Build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 10.5: Smoke check the staging deploy**

If a staging deploy is available, hit the dashboard, refresh once, confirm:
- No console errors on a fresh refresh.
- A genuine 10%+ price move (or a manually-engineered one per Task 8) renders `?`.
- The Concentration section title reads `Top N Holdings · X.X% of portfolio` with the correct sum.

If smoke is clean, work is shippable.

---

## What ships after this plan

When all 10 tasks complete:

1. The Live $ table cell flags any refresh that returns a price ≥10% off the prior known value, with a grey `?` and a tooltip showing the prior price + signed delta.
2. Every anomaly is recorded in DynamoDB with the full Yahoo response — forensic data the next time a wrong price is reported.
3. The Top-N Holdings chart title shows the summed concentration percent.
4. No quarantine modal, no accept/reject flow — the PO's stated preference for awareness over ceremony.

## What does NOT ship in this plan (separate work)

- **3A hot patch** — broaden Wealthsimple section-header regex in `parseHoldings.ts`. Lands on the in-flight 3A branch as a small follow-up commit; *must* land before this 5G work is QA'd against the PO's real Wealthsimple statements (otherwise USD assets stay mis-tagged as CAD and the apparent "Bug A" persists).
- **Anomaly history UI** — log records exist in DynamoDB but no view surfaces them. Future spec.
- **Per-ticker custom thresholds** — single global 10%; tune later if the log shows false-positive volume is annoying.
- **Phase 5 sub-projects 5A–5F** — separate brainstorms.
