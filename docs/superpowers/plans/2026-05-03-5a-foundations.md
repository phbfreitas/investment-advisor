# 5A Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the portfolio data correct and the source-of-truth wiring complete: fix the PDF import quantity bug, harden the data-trust layer (4 backlog items from 3A), and wire all dashboard charts to a single live-merged assets source.

**Architecture:** Six discrete, low-coupling fixes plus one wiring change in `DashboardClient`. Each fix lives in its own file and is independently testable. The source-of-truth wiring introduces one `liveMergedAssets` memo in `DashboardClient` and threads it to `BreakdownTab` so charts reflect the same live prices the table shows.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Jest 30, AWS DynamoDB Document Client, NextAuth.

**Spec reference:** `docs/superpowers/specs/2026-05-03-phase5-prioritization-breakdown-design.md` § "5A — Foundations (data trust layer) — GATING".

---

## File structure

**Modified:**
- `src/lib/encryption/encrypted-client.ts` — add UpdateCommand runtime guard.
- `src/lib/db.ts` — export `rawDb_unclassifiedOnly` as an explicit-bypass escape hatch.
- `src/app/api/assets/[id]/lock/route.ts` — switch UpdateCommand to `rawDb_unclassifiedOnly`; decouple audit-log + refetch from main commit.
- `src/app/dashboard/lib/applyLookupRespectingLocks.ts` — clear lookup-derived fields when the ticker symbol changes.
- `src/app/api/assets/[id]/route.ts` — extend optimistic concurrency to the PUT path.
- `src/app/dashboard/DashboardClient.tsx` — wire `symbol` through ticker lookup; add `liveMergedAssets` memo; pass to `BreakdownTab` and use for chart-relevant totals; surface 409 conflict on edit-mode save.
- `src/app/api/portfolio-pdf/parseHoldings.ts` — tighten holding-row patterns so footer/total rows can't masquerade as tickers.

**Created:**
- `src/app/dashboard/lib/liveMergeAssets.ts` — pure helper, canonical merge of assets ⊕ marketData.
- `src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts`
- `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts`
- `src/app/api/assets/[id]/__tests__/lock-decouple.test.ts`
- `src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts`
- `src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts`
- `src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts`
- `docs/superpowers/specs/2026-05-03-5a-data-flow.md` — short reference doc for the source-of-truth contract.

---

## Task ordering rationale

Smallest, defensive, isolated changes first; bigger structural ones last:

1. Encryption guard (smallest, defensive, no API surface change)
2. Ticker carryover (pure client function, fully unit-testable)
3. Lock PATCH decouple (single route, narrow change)
4. PUT optimistic concurrency (route + client save flow)
5. PDF quantity bug (investigation-led; touches parser regex)
6. Source-of-truth wiring (largest blast radius; do last after correctness fixes are in)
7. Data-flow doc (locks in the contract for future contributors)

---

## Task 1: EncryptedDocumentClient runtime guard + lock PATCH migration

**Files:**
- Modify: `src/lib/encryption/encrypted-client.ts:31-46`
- Modify: `src/lib/db.ts` — export `rawDb` as an escape hatch for unclassified-field updates.
- Modify: `src/app/api/assets/[id]/lock/route.ts:1-15` — switch UpdateCommand to use `rawDb`.
- Test: `src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts` (new)

**Why:** `EncryptedDocumentClient` advertises `UpdateCommand` in its `AnyCommand` union but `send()` has no handler — falls through to `raw.send()`, bypassing encryption. No active leak today (the lock PATCH is the only Update consumer, and it only writes `userOverrides` which isn't classified). Forward-looking trap: future code that updates `liveTickerPrice` / `bookCost` / `marketValue` / `managementFee` / `accountNumber` via Update would write plaintext into envelope-encrypted rows. Adding a runtime throw forces engineers to handle the gap explicitly.

**Critical migration coupling:** `db` exported from `src/lib/db.ts` IS the `EncryptedDocumentClient` when `KMS_KEY_ID` is set (staging/production). The lock PATCH currently calls `db.send(new UpdateCommand(...))` — after the guard lands, this throws in production. The migration: export `rawDb` from `db.ts` and have the lock PATCH import `rawDb` for its UpdateCommand. Comment explains why bypass is safe (`userOverrides` is not in `FIELD_CLASSIFICATIONS`). Both changes ship in **one commit** so production is never broken between steps.

- [ ] **Step 1: Write the failing test**

Create `src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts`:

```ts
import { UpdateCommand, GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EncryptedDocumentClient } from "../encrypted-client";
import type { KeyProvider } from "../types";

function buildClient() {
  const raw = { send: jest.fn().mockResolvedValue({}) } as unknown as DynamoDBDocumentClient;
  const keyProvider: KeyProvider = {
    getDataKey: async () => ({ plaintextKey: Buffer.alloc(32), encryptedKey: "x", keyId: "k" }),
  };
  return { raw, client: new EncryptedDocumentClient(raw, keyProvider, []) };
}

describe("EncryptedDocumentClient — UpdateCommand guard", () => {
  it("throws when handed an UpdateCommand", async () => {
    const { client } = buildClient();
    const cmd = new UpdateCommand({
      TableName: "T",
      Key: { PK: "p", SK: "s" },
      UpdateExpression: "SET x = :v",
      ExpressionAttributeValues: { ":v": 1 },
    });
    await expect(client.send(cmd)).rejects.toThrow(/UpdateCommand is not supported/);
  });

  it("does not call the raw client for UpdateCommand", async () => {
    const { client, raw } = buildClient();
    const cmd = new UpdateCommand({ TableName: "T", Key: { PK: "p", SK: "s" }, UpdateExpression: "SET x = :v", ExpressionAttributeValues: { ":v": 1 } });
    await expect(client.send(cmd)).rejects.toThrow();
    expect(raw.send).not.toHaveBeenCalled();
  });

  it("still passes GetCommand through (regression check)", async () => {
    const { client, raw } = buildClient();
    (raw.send as jest.Mock).mockResolvedValueOnce({ Item: { PK: "HOUSEHOLD#1", SK: "META", foo: "bar" } });
    const cmd = new GetCommand({ TableName: "T", Key: { PK: "HOUSEHOLD#1", SK: "META" } });
    const result = await client.send(cmd);
    expect(raw.send).toHaveBeenCalledTimes(1);
    expect((result as { Item: { foo: string } }).Item.foo).toBe("bar");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts -t "throws when handed an UpdateCommand"`
Expected: FAIL — no throw is emitted; the command silently passes through.

- [ ] **Step 3: Add the guard to `send()`**

In `src/lib/encryption/encrypted-client.ts`, modify the `send()` method (around lines 31-46):

```ts
async send(command: AnyCommand): Promise<any> {
    if (command instanceof PutCommand) {
      return this.handlePut(command);
    }
    if (command instanceof BatchWriteCommand) {
      return this.handleBatchWrite(command);
    }
    if (command instanceof GetCommand) {
      return this.handleGet(command);
    }
    if (command instanceof QueryCommand || command instanceof ScanCommand) {
      return this.handleMultiItem(command);
    }
    if (command instanceof UpdateCommand) {
      // 5A: UpdateCommand on the encrypted client is unsafe — UpdateExpression /
      // ExpressionAttributeValues / ReturnValues all bypass classification.
      // Callers must use PutCommand (encrypts on write) until full Update support
      // lands. See docs/superpowers/triage/2026-04-30-3A-deferred-followups.md Item 2.
      throw new Error(
        "EncryptedDocumentClient: UpdateCommand is not supported; use PutCommand or call the raw DDB client directly when classified fields are not involved."
      );
    }
    // DeleteCommand and anything else passes through unchanged
    return this.raw.send(command as any);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Run the full encryption test suite to check for regressions**

Run: `npx jest src/lib/encryption/`
Expected: all existing tests still pass (no GetCommand / PutCommand regression).

- [ ] **Step 6: Audit existing UpdateCommand usages**

Run: `grep -rn "UpdateCommand" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__`
Expected output: only `src/app/api/assets/[id]/lock/route.ts` calls `db.send(new UpdateCommand(...))`. If a second consumer exists, that must also be migrated in this task before commit (or the work expands to cover it).

- [ ] **Step 7: Export `rawDb` from `src/lib/db.ts` as an escape hatch**

Open `src/lib/db.ts`. The current file builds `rawDb` (line 18) but does not export it. Add:

```ts
// Exported for callers that intentionally bypass classification:
//  - UpdateCommand on unclassified fields (e.g., userOverrides). The
//    EncryptedDocumentClient throws on UpdateCommand by design (see 5A
//    Item 2 — partial updates can't safely encrypt expression values).
//  - Internal infra writes (e.g., audit log) that don't store classified
//    fields and don't need round-trip decryption.
//
// Use sparingly. If your data path involves any field listed in
// FIELD_CLASSIFICATIONS, use `db` (the encrypted wrapper) instead.
export const rawDb_unclassifiedOnly = rawDb;
```

(The verbose name is intentional — it's a friction point so engineers think twice before reaching for it.)

- [ ] **Step 8: Migrate lock PATCH to `rawDb_unclassifiedOnly`**

In `src/app/api/assets/[id]/lock/route.ts`, change the import on line 2:

```ts
import { db, rawDb_unclassifiedOnly, TABLE_NAME } from "@/lib/db";
```

Then change the `db.send(new UpdateCommand(...))` call (around line 103) to use the raw client:

```ts
        try {
            await rawDb_unclassifiedOnly.send(
                new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: assetSK },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: conditionExpression,
                    ReturnValues: "ALL_NEW",
                })
            );
        } catch (err: unknown) {
```

The Get + Get calls in the same route stay on `db` (encrypted wrapper) — they read the asset which DOES have classified fields like `liveTickerPrice`, and need decryption.

Add a comment above the migrated UpdateCommand:

```ts
        // userOverrides is NOT in FIELD_CLASSIFICATIONS, so bypassing the
        // encrypted client is safe here. UpdateCommand against the encrypted
        // client throws by design (5A Item 2). When the partial-update
        // pattern needs classified fields, the route must Get → modify →
        // PutCommand instead, which round-trips through encryption.
```

- [ ] **Step 9: Add a regression test for the lock PATCH wiring**

Append to `src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts`:

```ts
describe("EncryptedDocumentClient — lock PATCH route stays raw-client", () => {
  it("source-of-routing audit: only lock PATCH route uses UpdateCommand and it imports rawDb_unclassifiedOnly", () => {
    // Static assertion via require — the lock route module must reference rawDb_unclassifiedOnly.
    const fs = require("fs");
    const path = require("path");
    const lockRouteSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/assets/[id]/lock/route.ts"),
      "utf-8"
    );
    expect(lockRouteSource).toMatch(/rawDb_unclassifiedOnly/);
    expect(lockRouteSource).not.toMatch(/\bdb\.send\(\s*new UpdateCommand/);
  });
});
```

Run: `npx jest src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts`
Expected: 4 passing tests (3 existing + this new one).

- [ ] **Step 10: Run the full test suite to confirm no integration breakage**

Run: `npx jest`
Expected: green. If any test mocks `db.send` and depends on UpdateCommand being routed there, that mock should be migrated to `rawDb_unclassifiedOnly`.

- [ ] **Step 11: Commit (all changes together)**

```bash
git add src/lib/encryption/encrypted-client.ts src/lib/encryption/__tests__/encrypted-client-update-guard.test.ts src/lib/db.ts src/app/api/assets/[id]/lock/route.ts
git commit -m "feat(encryption): runtime guard against UpdateCommand on EncryptedDocumentClient

UpdateCommand bypasses classification and would silently write plaintext
into envelope-encrypted rows. Throw at the wrapper level until full
Update support lands.

The lock PATCH route is the only existing UpdateCommand consumer; migrated
to rawDb_unclassifiedOnly (a new explicit-bypass export from db.ts).
userOverrides is not in FIELD_CLASSIFICATIONS so the bypass is safe.

See 3A deferred follow-ups Item 2."
```

---

## Task 2: Ticker lookup — clear lookup-derived fields when symbol changes

**Files:**
- Modify: `src/app/dashboard/lib/applyLookupRespectingLocks.ts`
- Test: `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts` (new)

**Why:** `applyLookupRespectingLocks` falls back to `prev.field` when the new lookup returns null/undefined. When the user changes the ticker, this carries OLD ticker data into the new ticker (e.g., AAPL's `oneYearReturn=0.15` survives a switch to SHOP whose lookup returns null). Silent corruption that survives commit. Track ticker identity through the function and clear lookup-derived fields when symbols differ.

**The 8 lockable fields** (`sector`, `market`, `securityType`, `strategyType`, `call`, `managementStyle`, `currency`, `managementFee`) keep their lock-respecting behavior — locks mean "user-curated value." **The 8 non-lockable lookup-derived fields** (`liveTickerPrice`, `yield`, `oneYearReturn`, `threeYearReturn`, `exDividendDate`, `analystConsensus`, `externalRating`, `beta`, `riskFlag`) get the new rule: on symbol change, take the new lookup's value verbatim (null is null).

- [ ] **Step 1: Write the failing test**

Create `src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts`:

```ts
import { applyLookupRespectingLocks, LookupData } from "../applyLookupRespectingLocks";
import type { Asset } from "@/types";

const aaplPrev: Partial<Asset> = {
  ticker: "AAPL",
  oneYearReturn: 0.15,
  threeYearReturn: 0.50,
  beta: 1.2,
  analystConsensus: "Buy",
  exDividendDate: "2026-02-09",
  liveTickerPrice: 180,
  yield: 0.005,
  externalRating: "BBB+",
  riskFlag: "LOW",
};

const shopLookup: LookupData = {
  // SHOP lookup returns mostly nulls for fund-only metrics
  currentPrice: 90,
  oneYearReturn: null,
  threeYearReturn: null,
  beta: undefined,
  analystConsensus: undefined,
  exDividendDate: undefined,
  dividendYield: null,
  externalRating: undefined,
  riskFlag: undefined,
};

describe("applyLookupRespectingLocks — ticker change", () => {
  it("clears lookup-derived fields when the ticker changes", () => {
    const next = applyLookupRespectingLocks(
      { ...aaplPrev, ticker: "SHOP" }, // user changed ticker before lookup ran
      { ...shopLookup, symbol: "SHOP" } as LookupData & { symbol: string },
    );

    expect(next.oneYearReturn).toBeNull();
    expect(next.threeYearReturn).toBeNull();
    expect(next.beta).toBe(0);
    expect(next.analystConsensus).toBe("");
    expect(next.exDividendDate).toBe("");
    expect(next.yield).toBeNull();
    expect(next.externalRating).toBe("");
    expect(next.riskFlag).toBe("");
    expect(next.liveTickerPrice).toBe(90); // new lookup wins
  });

  it("preserves prev values when the ticker is unchanged (silent refresh)", () => {
    const next = applyLookupRespectingLocks(
      aaplPrev,
      { symbol: "AAPL" } as LookupData & { symbol: string }, // empty refresh
    );

    expect(next.oneYearReturn).toBe(0.15);
    expect(next.threeYearReturn).toBe(0.50);
    expect(next.beta).toBe(1.2);
    expect(next.analystConsensus).toBe("Buy");
    expect(next.exDividendDate).toBe("2026-02-09");
    expect(next.liveTickerPrice).toBe(180);
  });

  it("respects locks even on ticker change (locked sector/market preserved)", () => {
    const lockedPrev: Partial<Asset> = {
      ...aaplPrev,
      sector: "Technology",
      market: "US",
      userOverrides: { sector: true, market: true },
    };
    const next = applyLookupRespectingLocks(
      { ...lockedPrev, ticker: "SHOP" },
      { sector: "E-Commerce", market: "Canada", symbol: "SHOP" } as LookupData & { symbol: string },
    );
    expect(next.sector).toBe("Technology");
    expect(next.market).toBe("US");
    // lookup-derived still cleared (data.oneYearReturn is undefined → null)
    expect(next.oneYearReturn).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts`
Expected: FAIL — first test expects nulls but receives AAPL's values.

- [ ] **Step 3: Add `symbol` to `LookupData` and tracking through the function**

Modify `src/app/dashboard/lib/applyLookupRespectingLocks.ts`:

```ts
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
    "exchange",
] as const;

export type LookupData = {
    symbol?: string;       // NEW: ticker the lookup was performed for, used to detect symbol changes
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
    marketComputedAt?: string | null;
    exchangeSuffix?: string;
    exchangeName?: string;
};

/**
 * Returns the patch to apply to editForm in response to a ticker lookup,
 * skipping any field that the user has explicitly locked.
 *
 * 5A Item 3: when the user changed the ticker before the lookup ran
 * (data.symbol !== prev.ticker), lookup-derived fields take the new
 * lookup's value verbatim — including null. Without this, AAPL's
 * 1yr-return would survive a switch to SHOP because SHOP's lookup
 * returns null and the old ?? prev.field fallback carried it forward.
 */
export function applyLookupRespectingLocks(
    prev: Partial<Asset>,
    data: LookupData,
): Partial<Asset> {
    const overrides = prev.userOverrides ?? {};
    const isLocked = (field: LockableField) => overrides[field] === true;

    const tickerChanged = typeof data.symbol === "string"
        && typeof prev.ticker === "string"
        && data.symbol.toUpperCase() !== prev.ticker.toUpperCase();

    // For lookup-derived fields (non-lockable): when the ticker changed, take the
    // new lookup's value verbatim (including null). When unchanged, preserve prev
    // for silent refreshes.
    const liveTickerPrice = tickerChanged
        ? (data.currentPrice ?? 0)
        : (data.currentPrice ?? prev.liveTickerPrice ?? 0);
    const yieldVal = tickerChanged
        ? (data.dividendYield ?? null)
        : (data.dividendYield ?? prev.yield ?? null);
    const oneYearReturn = tickerChanged
        ? (data.oneYearReturn ?? null)
        : (data.oneYearReturn ?? prev.oneYearReturn ?? null);
    const threeYearReturn = tickerChanged
        ? (data.threeYearReturn ?? null)
        : (data.threeYearReturn ?? prev.threeYearReturn ?? null);
    const exDividendDate = tickerChanged
        ? (data.exDividendDate ?? "")
        : (data.exDividendDate ?? prev.exDividendDate ?? "");
    const analystConsensus = tickerChanged
        ? (data.analystConsensus ?? "")
        : (data.analystConsensus ?? prev.analystConsensus ?? "");
    const externalRating = tickerChanged
        ? (data.externalRating ?? "")
        : (data.externalRating ?? prev.externalRating ?? "");
    const beta = tickerChanged
        ? (data.beta ?? 0)
        : (data.beta ?? prev.beta ?? 0);
    const riskFlag = tickerChanged
        ? (data.riskFlag ?? "")
        : (data.riskFlag ?? prev.riskFlag ?? "");

    return {
        sector: isLocked("sector") ? prev.sector : (data.sector || prev.sector),
        market: isLocked("market") ? prev.market : (data.market || prev.market),
        securityType: isLocked("securityType") ? prev.securityType : (data.securityType || prev.securityType),
        strategyType: isLocked("strategyType") ? prev.strategyType : (data.strategyType || prev.strategyType),
        call: isLocked("call") ? prev.call : (data.call || prev.call),
        managementStyle: isLocked("managementStyle") ? prev.managementStyle : (data.managementStyle || prev.managementStyle),
        currency: isLocked("currency") ? prev.currency : (data.currency || prev.currency),
        managementFee: isLocked("managementFee") ? prev.managementFee : (data.managementFee ?? prev.managementFee),

        exchangeSuffix: isLocked("exchange") ? prev.exchangeSuffix : (data.exchangeSuffix ?? prev.exchangeSuffix ?? ""),
        exchangeName:   isLocked("exchange") ? prev.exchangeName   : (data.exchangeName   ?? prev.exchangeName   ?? ""),

        marketComputedAt: isLocked("market")
            ? (prev.marketComputedAt ?? null)
            : (data.marketComputedAt !== undefined ? data.marketComputedAt : (prev.marketComputedAt ?? null)),

        liveTickerPrice,
        yield: yieldVal,
        oneYearReturn,
        threeYearReturn,
        exDividendDate,
        analystConsensus,
        externalRating,
        beta,
        riskFlag,
    };
}

export { LOCKABLE_FIELDS };
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Run any existing tests for this file**

Run: `npx jest applyLookupRespectingLocks`
Expected: all tests pass (no regression in silent-refresh behavior).

- [ ] **Step 6: Wire `symbol` through the lookup call site**

The only call site is in `handleTickerLookup` at `src/app/dashboard/DashboardClient.tsx:607`:

```ts
        const lookupPatch = applyLookupRespectingLocks(prev, data);
```

Change to:

```ts
        const lookupPatch = applyLookupRespectingLocks(prev, { ...data, symbol });
```

`symbol` is the function parameter at line 582 — it's the ticker being looked up. Passing it through lets `applyLookupRespectingLocks` compare against `prev.ticker` and detect ticker changes.

Run: `grep -n "applyLookupRespectingLocks" src/app/dashboard/DashboardClient.tsx`
Expected: confirm only line 607 calls the function (line 22 is the import). If a second call site exists, apply the same change.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/lib/applyLookupRespectingLocks.ts src/app/dashboard/lib/__tests__/applyLookupRespectingLocks-ticker-change.test.ts src/app/dashboard/DashboardClient.tsx
git commit -m "fix(ticker-lookup): clear lookup-derived fields when ticker symbol changes

When the user edits the ticker (prev.ticker !== data.symbol), the new
lookup wins verbatim — including null — for non-lockable fields like
oneYearReturn, threeYearReturn, beta, analystConsensus. Previously these
silently carried over from the old ticker. Lockable fields keep their
lock-respecting behavior. See 3A deferred follow-ups Item 3."
```

---

## Task 3: Lock PATCH — decouple audit refetch from main commit

**Files:**
- Modify: `src/app/api/assets/[id]/lock/route.ts:130-160`
- Test: `src/app/api/assets/[id]/__tests__/lock-decouple.test.ts` (new)

**Why:** The lock PATCH does (1) UpdateCommand → (2) GetCommand refetch → (3) audit-log insert. Steps 2 and 3 share the route's outer try/catch. If 2 or 3 fails, the route returns 500 even though step 1 already committed. User sees "lock toggle failed," retries, and ends up with the lock state opposite to intended. Wrap steps 2 and 3 in their own try/catch and return success once step 1 commits.

- [ ] **Step 1: Write the failing test**

Create `src/app/api/assets/[id]/__tests__/lock-decouple.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { PATCH } from "../lock/route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { householdId: "h1" } }),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
// Both `db` (encrypted wrapper, used for Gets) and `rawDb_unclassifiedOnly`
// (used for the UpdateCommand after Task 1) share the same underlying mock —
// the route uses one for reads and the other for the lock write.
const rawSend = jest.fn();
jest.mock("@/lib/db", () => ({
  db: { send: rawSend },
  rawDb_unclassifiedOnly: { send: rawSend },
  TABLE_NAME: "T",
}));
jest.mock("@/lib/auditLog", () => ({ insertAuditLog: jest.fn() }));
jest.mock("@/lib/assetSnapshot", () => ({ toSnapshot: (x: unknown) => x }));

import { insertAuditLog } from "@/lib/auditLog";

const sendMock = rawSend;
const auditMock = insertAuditLog as unknown as jest.Mock;

function buildRequest(body: object) {
  return new Request("http://test/api/assets/abc/lock", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  sendMock.mockReset();
  auditMock.mockReset();
});

describe("PATCH /api/assets/[id]/lock — decouple audit from commit", () => {
  it("returns 200 even if the post-commit refetch fails", async () => {
    // (1) Get existing asset → ok (db.send)
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    // (2) UpdateCommand → ok (rawDb_unclassifiedOnly.send — same underlying mock)
    sendMock.mockResolvedValueOnce({});
    // (3) Refetch GetCommand → fails
    sendMock.mockRejectedValueOnce(new Error("DDB outage"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toMatch(/Lock state updated/);
  });

  it("returns 200 even if the audit-log write fails", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    sendMock.mockResolvedValueOnce({});
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "new" } });
    auditMock.mockRejectedValueOnce(new Error("audit table throttled"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
  });

  it("still returns 5xx if the UpdateCommand itself throws (non-conditional)", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL" } });
    sendMock.mockRejectedValueOnce(new Error("DDB write rejected"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(500);
  });

  it("still returns 409 on ConditionalCheckFailedException", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    const condErr = Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
    sendMock.mockRejectedValueOnce(condErr);

    const res = await PATCH(buildRequest({ field: "sector", locked: true, expectedUpdatedAt: "stale" }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(409);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/app/api/assets/[id]/__tests__/lock-decouple.test.ts`
Expected: FAIL — first two tests return 500 because the existing try/catch wraps the refetch and audit-log calls.

- [ ] **Step 3: Decouple steps 2 and 3 from the outer try/catch**

In `src/app/api/assets/[id]/lock/route.ts`, replace lines 130-157 (the post-UpdateCommand block) with this structure:

```ts
        // Step 1 (UpdateCommand) committed successfully here.
        // Steps 2 (refetch) and 3 (audit-log) are best-effort: failures must not
        // surface as 500 to the user, since the lock state has already changed.
        // Log them server-side for operator visibility.
        let updatedAsset: Record<string, unknown> | undefined;
        try {
            const refetch = await db.send(
                new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: assetSK },
                })
            );
            updatedAsset = refetch.Item;
        } catch (refetchErr) {
            console.error("[lock-PATCH] post-commit refetch failed (lock state DID change):", refetchErr);
        }

        if (updatedAsset) {
            try {
                await insertAuditLog(
                    session.user.householdId,
                    "MANUAL_EDIT",
                    [
                        {
                            action: "UPDATE",
                            ticker: String(updatedAsset.ticker || ""),
                            assetSK,
                            before: toSnapshot(existingAsset),
                            after: toSnapshot(updatedAsset),
                        },
                    ],
                    String(updatedAsset.ticker || "")
                );
            } catch (auditErr) {
                console.error("[lock-PATCH] post-commit audit-log write failed (lock state DID change):", auditErr);
            }
        }

        return NextResponse.json({ message: "Lock state updated", asset: updatedAsset });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/app/api/assets/[id]/__tests__/lock-decouple.test.ts`
Expected: 4 passing tests.

- [ ] **Step 5: Run all assets API tests to check for regressions**

Run: `npx jest src/app/api/assets/`
Expected: existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/assets/[id]/lock/route.ts src/app/api/assets/[id]/__tests__/lock-decouple.test.ts
git commit -m "fix(lock-PATCH): decouple audit-log + refetch from main commit

Steps 2 (refetch) and 3 (audit-log) are best-effort and must not surface
as 500 once the UpdateCommand commits — otherwise the user sees 'failed',
retries, and reverses the intended state. Server-side console.error
preserves operator visibility into refetch/audit failures. See 3A
deferred follow-ups Item 4."
```

---

## Task 4: Edit-mode PUT — extend optimistic concurrency

**Files:**
- Modify: `src/app/api/assets/[id]/route.ts:106-238` (PUT handler)
- Modify: `src/app/dashboard/DashboardClient.tsx` — saveEdit / handleSubmit path
- Test: `src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts` (new)

**Why:** The lock PATCH endpoint has optimistic concurrency via `expectedUpdatedAt`. The full PUT path (used by edit-mode save) does not — a stale tab silently clobbers fields edited elsewhere. PO uses both phone and laptop, so concurrent edits are plausible. Add the same `expectedUpdatedAt` check to PUT; surface 409 to the client and prompt "your data is stale, please refresh."

- [ ] **Step 1: Write the failing test**

Create `src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts`:

```ts
/**
 * @jest-environment node
 */
import { PUT } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { householdId: "h1" } }),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
jest.mock("@/lib/db", () => ({
  db: { send: jest.fn() },
  TABLE_NAME: "T",
}));
jest.mock("@/lib/auditLog", () => ({ insertAuditLog: jest.fn() }));
jest.mock("@/lib/assetSnapshot", () => ({ toSnapshot: (x: unknown) => x }));
jest.mock("@/lib/classification/allowlists", () => ({
  normalizeStrategyType: (x: unknown) => x,
  normalizeSecurityType: (x: unknown) => x,
  normalizeSector: (x: unknown) => x,
  normalizeMarket: (x: unknown) => x,
  normalizeCurrency: (x: unknown) => x,
  normalizeManagementStyle: (x: unknown) => x,
  normalizeCall: (x: unknown) => x,
  applyCompanyAutoDefaults: (x: Record<string, unknown>) => x,
}));

import { db } from "@/lib/db";
const sendMock = db.send as unknown as jest.Mock;

function buildPut(body: object, id = "abc") {
  return PUT(
    new Request(`http://test/api/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => sendMock.mockReset());

describe("PUT /api/assets/[id] — optimistic concurrency", () => {
  it("returns 409 when expectedUpdatedAt does not match the current asset", async () => {
    // GetCommand returns asset with updatedAt="newer-version"
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "newer-version" } });

    const res = await buildPut({ ticker: "AAPL", expectedUpdatedAt: "stale-version" });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/modified|refresh|stale/i);
    // PutCommand should NOT have been called
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when expectedUpdatedAt matches", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "v1" } });
    sendMock.mockResolvedValueOnce({}); // PutCommand

    const res = await buildPut({ ticker: "AAPL", expectedUpdatedAt: "v1" });
    expect(res.status).toBe(200);
  });

  it("returns 200 when expectedUpdatedAt is omitted (legacy / non-edit-mode callers)", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "v1" } });
    sendMock.mockResolvedValueOnce({});

    const res = await buildPut({ ticker: "AAPL" });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts`
Expected: FAIL — the 409 test gets 200 because no concurrency check exists.

- [ ] **Step 3: Add the `expectedUpdatedAt` check to PUT**

In `src/app/api/assets/[id]/route.ts`, after the `existingAsset` GetCommand returns (around line 124, immediately after the `if (!existingAsset) {...}` block), add:

```ts
        // 5A: optimistic concurrency. If the client sends expectedUpdatedAt and it
        // doesn't match the asset's current updatedAt, reject with 409 — a parallel
        // session has modified the asset and the client's payload is stale. Omitting
        // expectedUpdatedAt skips the check (legacy / non-edit-mode callers).
        const expectedUpdatedAt: string | undefined = typeof data.expectedUpdatedAt === "string"
            ? data.expectedUpdatedAt
            : undefined;
        if (expectedUpdatedAt && existingAsset.updatedAt !== expectedUpdatedAt) {
            return NextResponse.json(
                { error: "Asset was modified by another session. Refresh and try again." },
                { status: 409 }
            );
        }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts`
Expected: 3 passing tests.

- [ ] **Step 5: Wire `expectedUpdatedAt` through the client-side save path**

Find `saveEdit` (or equivalent) in `src/app/dashboard/DashboardClient.tsx`:

Run: `grep -nE "saveEdit|fetch.*api/assets/\\\$" src/app/dashboard/DashboardClient.tsx | head -20`

Locate the PUT call (search for `method: "PUT"` near `/api/assets/`). The existing pattern includes the editForm body. Modify it to include `expectedUpdatedAt` from the editForm snapshot:

```ts
const res = await fetch(`/api/assets/${editingId}`, {
  method: "PUT",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    ...editForm,
    expectedUpdatedAt: editForm.updatedAt, // 5A: reject save if asset was modified after edit started
  }),
});

if (res.status === 409) {
  alert("This asset was changed in another tab/device since you opened the editor. Click OK to refresh.");
  await fetchAssets();
  setEditingId(null);
  return;
}
```

- [ ] **Step 6: Add an integration smoke test for the client-side 409 flow**

Manual smoke (no automated test for this step, but document it):
1. Open the dashboard in two tabs.
2. Tab A: open edit on an asset, leave the form open.
3. Tab B: edit the same asset's quantity, save.
4. Tab A: change a field, click Save.
5. Expect the alert + refresh; the edit form should close without writing.

- [ ] **Step 7: Commit**

```bash
git add src/app/api/assets/[id]/route.ts src/app/api/assets/[id]/__tests__/put-optimistic-concurrency.test.ts src/app/dashboard/DashboardClient.tsx
git commit -m "feat(assets-PUT): optimistic concurrency via expectedUpdatedAt

Edit-mode save path now sends expectedUpdatedAt (snapshot from when edit
started). Server returns 409 if the asset was modified concurrently;
client surfaces a refresh prompt and reloads. Mirrors the lock PATCH
optimistic-concurrency contract. See 3A deferred follow-ups Item 1."
```

---

## Task 5: PDF import quantity bug — investigate and fix

**Files:**
- Modify: `src/app/api/portfolio-pdf/parseHoldings.ts`
- Test: `src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts` (new)

**Why:** The current `holdingPattern` regex `^([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s+\$?([\d,]+(?:\.\d{2})?)/` matches uppercase-letter-only "tickers" up to 5 chars. Footer/total rows like `TOTAL 12345 1234 5678` or `TOTAL FOR ACCOUNT 100 200 300` can match. The parser then injects bogus tickers OR (worse) the wsQtyPattern `(?:^|\s)([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+\d...` matches mid-line, picking up cross-line numbers as quantities.

The fix: tighten both patterns to reject known footer keywords and add quantity-sanity checks. The dedupe at line 138 means the FIRST match wins — so a bogus first match silently shadows valid rows.

- [ ] **Step 1: Reproduce with Simone's broken PDF (if available) OR build a minimal failing fixture**

Check if a sample of the broken PDF text is available in `tmp_*.txt` files at the repo root:

Run: `ls -la tmp_*.txt 2>/dev/null; ls -la docs/release-notes/*.pdf 2>/dev/null`

If no sample exists: build a fixture in the test that reproduces the failure mode (footer rows with VGT-like ticker patterns producing wrong quantities).

- [ ] **Step 2: Write the failing test (totals-row immunity)**

Create `src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts`:

```ts
import { parseHoldings } from "../parseHoldings";

describe("parseHoldings — totals/footer rows must not become tickers", () => {
  it("ignores 'TOTAL ...' footer rows even with 3+ trailing numerics", () => {
    const text = `
Account No. 12345 TFSA
U.S. Dollar Holdings

VGT 50 580.00 29000.00
TOTAL 50 29000 29000
        `.trim();
    const holdings = parseHoldings(text);

    expect(holdings).toHaveLength(1);
    expect(holdings[0].ticker).toBe("VGT");
    expect(holdings[0].quantity).toBe(50);
  });

  it("ignores 'GRAND TOTAL' / 'SUBTOTAL' / 'BALANCE' footer rows", () => {
    const text = `
U.S. Dollar Holdings

VGT 50 580.00 29000.00
SUBTOTAL 50 29000 29000
GRAND TOTAL 50 29000 29000
BALANCE 50 0 0
        `.trim();
    const holdings = parseHoldings(text);

    expect(holdings.map(h => h.ticker)).toEqual(["VGT"]);
  });

  it("does NOT pick up the WS pattern from a totals row mid-line", () => {
    const text = `
TOTAL FOR ACCOUNT 50 29000 29000
        `.trim();
    const holdings = parseHoldings(text);
    expect(holdings).toHaveLength(0);
  });

  it("rejects rows where quantity looks like a year or page number", () => {
    // Real-world failure: a "Page 2 of 5" line with a stray ticker-like preceding word
    const text = `
EOD 2026 50 580
        `.trim();
    const holdings = parseHoldings(text);
    // EOD is uppercase + 3 letters; without context it would have matched. Reject.
    expect(holdings).toHaveLength(0);
  });

  it("still parses normal holding rows correctly (regression check)", () => {
    const text = `
U.S. Dollar Holdings

VGT 50 580.00 29000.00
QQQ 100 400.00 40000.00
        `.trim();
    const holdings = parseHoldings(text);
    expect(holdings).toHaveLength(2);
    expect(holdings.find(h => h.ticker === "VGT")?.quantity).toBe(50);
    expect(holdings.find(h => h.ticker === "QQQ")?.quantity).toBe(100);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts`
Expected: FAIL — `TOTAL`, `SUBTOTAL`, `BALANCE`, `EOD` rows currently produce phantom holdings.

- [ ] **Step 4: Add a footer-keyword reject list and tighten the patterns**

In `src/app/api/portfolio-pdf/parseHoldings.ts`, add a constant near the top of the file (after `CURRENCY_CONFIGS`):

```ts
// 5A: rows starting with these tokens are footer/totals/section markers, never holdings.
// Real ticker symbols are never these strings, so a hard reject list is safe.
const NON_TICKER_LEAD_TOKENS = new Set([
    "TOTAL", "SUBTOTAL", "BALANCE", "GRAND", "SUMMARY", "ENDING",
    "OPENING", "CLOSING", "PAGE", "EOD", "EOY", "FX", "USD", "CAD",
    "EUR", "GBP", "DR", "CR", "NET", "GROSS", "MTD", "YTD", "QTD",
]);

function isFooterRow(line: string): boolean {
    // Match the leading word (first run of uppercase letters/spaces).
    const leadMatch = line.match(/^([A-Z][A-Z\s.&]*?)(?=\s|$)/);
    if (!leadMatch) return false;
    const leadWord = leadMatch[1].trim().split(/\s+/)[0]; // first whitespace-delimited token
    return NON_TICKER_LEAD_TOKENS.has(leadWord);
}
```

Then, in `parseHoldings`, gate both pattern matches at the top of the loop:

```ts
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Check for section header to update currency context
        const headerMatch = detectSectionCurrency(line);
        if (headerMatch !== null) {
            sectionCurrency = headerMatch;
            // Fall through — header line might also contain a holding pattern.
        }

        // 5A: hard-reject footer/totals rows before regex matching.
        if (isFooterRow(line)) {
            continue;
        }

        // 1. Try generic safe pattern
        // ... (rest unchanged)
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx jest src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts`
Expected: 5 passing tests.

- [ ] **Step 6: Run the full parseHoldings suite to check for regressions**

Run: `npx jest src/app/api/portfolio-pdf/`
Expected: all existing tests still pass. If any existing test fixture happened to use a leading word from `NON_TICKER_LEAD_TOKENS` as a real ticker, fix the fixture (no real ticker symbol matches those reserved words).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/portfolio-pdf/parseHoldings.ts src/app/api/portfolio-pdf/__tests__/parseHoldings-totals-rows.test.ts
git commit -m "fix(pdf-import): reject footer/totals rows before holding-pattern match

Footer rows like 'TOTAL ...', 'SUBTOTAL ...', 'BALANCE ...' could match
the holding regex (uppercase letters + 3 trailing numerics) and silently
inject phantom holdings — sometimes shadowing the real row via the
ticker+currency dedupe. Hard reject list is the simplest correct fix.
Module 7 #1."
```

---

## Task 6: Source-of-truth wiring — `liveMergeAssets` helper + chart wiring

**Files:**
- Create: `src/app/dashboard/lib/liveMergeAssets.ts` — pure helper, the canonical merge logic.
- Modify: `src/app/dashboard/DashboardClient.tsx` — add `liveMergedAssets` memo using the helper, pass to `BreakdownTab`.
- Test: `src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts` (new) — unit tests for the helper.

**Why:** The dashboard has TWO data sources: `assets[]` (server-side, includes stored `marketValue` from last fetch) and `marketData[id].currentPrice` (live, polled separately). HoldingsTab merges them inline (`marketData[asset.id]?.currentPrice ?? asset.liveTickerPrice`); BreakdownTab takes only `assets` and feeds it to `computeBreakdowns / computeTopHoldings / computeDriftSignals`. Result: the table shows live prices, the charts show stale prices. Edits in the table don't reflect in chart values until the next full refresh.

Fix: extract the merge into a pure helper that production code AND tests both consume — production via `useMemo`, tests directly. The same logic ships to both tabs and to all chart aggregations.

- [ ] **Step 1: Write the failing test for the helper (which doesn't exist yet)**

Create `src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts`:

```ts
import { liveMergeAssets } from "../liveMergeAssets";
import { computeBreakdowns } from "../../breakdown/lib/computeBreakdowns";
import type { Asset } from "@/types";

const baseAsset = (over: Partial<Asset>): Asset => ({
  id: "1", ticker: "AAPL", quantity: 10, liveTickerPrice: 100, bookCost: 800,
  marketValue: 1000, profitLoss: 200, market: "US", sector: "Technology",
  ...over,
} as Asset);

describe("liveMergeAssets", () => {
  it("recomputes marketValue from live price when marketData provides one", () => {
    const assets: Asset[] = [baseAsset({ id: "1", quantity: 10, liveTickerPrice: 100, marketValue: 1000 })];
    const marketData = { "1": { currentPrice: 200 } };
    const merged = liveMergeAssets(assets, marketData);
    expect(merged[0].liveTickerPrice).toBe(200);
    expect(merged[0].marketValue).toBe(2000);
    expect(merged[0].profitLoss).toBe(2000 - 800);
  });

  it("preserves stale marketValue when marketData has no entry for the asset", () => {
    const assets: Asset[] = [baseAsset({ id: "1", marketValue: 1000 })];
    const merged = liveMergeAssets(assets, {});
    expect(merged[0].marketValue).toBe(1000);
  });

  it("falls back to stale price when live price is non-positive (0, NaN, negative)", () => {
    const assets: Asset[] = [baseAsset({ id: "1", liveTickerPrice: 100, marketValue: 1000 })];
    expect(liveMergeAssets(assets, { "1": { currentPrice: 0 } })[0].liveTickerPrice).toBe(100);
    expect(liveMergeAssets(assets, { "1": { currentPrice: NaN } })[0].liveTickerPrice).toBe(100);
    expect(liveMergeAssets(assets, { "1": { currentPrice: -5 } })[0].liveTickerPrice).toBe(100);
  });

  it("preserves all other asset fields verbatim", () => {
    const assets: Asset[] = [baseAsset({ id: "1", sector: "Technology", market: "US", currency: "USD" })];
    const merged = liveMergeAssets(assets, { "1": { currentPrice: 200 } });
    expect(merged[0].sector).toBe("Technology");
    expect(merged[0].market).toBe("US");
    expect(merged[0].currency).toBe("USD");
  });

  it("feeds correct sector breakdown when chained with computeBreakdowns", () => {
    const assets: Asset[] = [
      baseAsset({ id: "1", quantity: 10, liveTickerPrice: 100, marketValue: 1000, sector: "Technology" }),
      baseAsset({ id: "2", quantity: 5, liveTickerPrice: 400, marketValue: 2000, sector: "Diversified" }),
    ];
    const merged = liveMergeAssets(assets, { "1": { currentPrice: 200 } }); // AAPL live = 200, mv → 2000
    const breakdowns = computeBreakdowns(merged);
    const tech = breakdowns.sector.slices.find(s => s.label === "Technology");
    expect(tech?.value).toBe(2000); // NOT 1000 (the stale value)
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts`
Expected: FAIL — `Cannot find module '../liveMergeAssets'`.

- [ ] **Step 3: Create the helper**

Create `src/app/dashboard/lib/liveMergeAssets.ts`:

```ts
import type { Asset } from "@/types";

/**
 * 5A Source of Truth: merge live `marketData` prices into each asset and
 * recompute derived totals so EVERY consumer (Holdings totals, Breakdown
 * charts, drift signals) reads from one canonical array.
 *
 * Rules:
 *   - liveTickerPrice = marketData[id].currentPrice when it's a positive
 *     finite number; otherwise asset.liveTickerPrice (the server-known last
 *     value).
 *   - marketValue   = quantity × livePrice when both are positive; otherwise
 *     asset.marketValue (preserves server value when live data is missing).
 *   - profitLoss    = marketValue - (bookCost ?? 0).
 *   - All other fields are copied verbatim.
 *
 * Pure function — same inputs, same output. Suitable for `useMemo` callers.
 */
export function liveMergeAssets(
  assets: Asset[],
  marketData: Record<string, { currentPrice?: number }>,
): Asset[] {
  return assets.map(asset => {
    const liveCandidate = marketData[asset.id]?.currentPrice;
    const livePrice =
      typeof liveCandidate === "number" && Number.isFinite(liveCandidate) && liveCandidate > 0
        ? liveCandidate
        : asset.liveTickerPrice;
    const qty = asset.quantity ?? 0;
    const marketValue =
      qty > 0 && typeof livePrice === "number" && livePrice > 0
        ? qty * livePrice
        : asset.marketValue;
    return {
      ...asset,
      liveTickerPrice: livePrice,
      marketValue,
      profitLoss: marketValue - (asset.bookCost ?? 0),
    };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts`
Expected: 5 passing tests.

- [ ] **Step 5: Add `liveMergedAssets` memo to `DashboardClient.tsx`**

Add the import near the top of `src/app/dashboard/DashboardClient.tsx` (alongside the existing `applyLookupRespectingLocks` import around line 22):

```tsx
import { liveMergeAssets } from "@/app/dashboard/lib/liveMergeAssets";
```

Then near the existing `assets`-derived memos (around line 197 where `accounts` is defined), add:

```tsx
  // 5A Source of Truth: see docs/superpowers/specs/2026-05-03-5a-data-flow.md.
  // Both HoldingsTab totals and BreakdownTab charts consume this array.
  const liveMergedAssets = useMemo(
    () => liveMergeAssets(assets, marketData),
    [assets, marketData]
  );
```

- [ ] **Step 6: Pass `liveMergedAssets` to `BreakdownTab`**

Find the BreakdownTab usage at line 1530-1534:

```tsx
      <BreakdownTab
        assets={assets}
        isLoading={isLoading}
        onSwitchToHoldings={switchToHoldings}
      />
```

Change `assets={assets}` to `assets={liveMergedAssets}`.

- [ ] **Step 7: Audit other consumers of stale `assets` for chart-relevant aggregations**

Run: `grep -nE "computeBreakdowns|computeTopHoldings|computeDriftSignals|reduce.*marketValue|sum.*marketValue" src/app/dashboard/DashboardClient.tsx`

For every reducer/aggregation that sums marketValue/profitLoss from `assets` for chart-or-totals display (e.g., line 702 `totalMarketValue`, line 718 `totalCostBasis`), change the source array to `liveMergedAssets`. Leave row-level uses of `assets` unchanged unless they're feeding chart math — the table's row-by-row liveTickerPrice merge already happens via `marketData[asset.id]?.currentPrice` and doesn't need `liveMergedAssets`.

Audit checklist (verify each):
- [ ] `totalMarketValue` (line ~702) → switch to `liveMergedAssets`
- [ ] `totalExpectedDividends` (line ~703) — leave on `assets` (not affected by live price)
- [ ] `totalCostBasis` (line ~718) — leave on `assets` (bookCost doesn't change)
- [ ] Any `computePortfolioTotals` call — check whether it expects raw or merged; if it derives marketValue, switch to `liveMergedAssets`

- [ ] **Step 8: Run all dashboard and breakdown tests**

Run: `npx jest src/app/dashboard/`
Expected: all tests pass. If `BreakdownTab.test.tsx` mocks specific `assets`, those mocks should still work (BreakdownTab's prop signature is unchanged — it still receives `Asset[]`).

- [ ] **Step 9: Manual smoke**

1. Load the dashboard with at least one asset that has a non-zero `marketData[id].currentPrice`.
2. Switch to the Breakdown tab.
3. Verify the donut totals reflect the live price (compare against the value shown in the Holdings table's Live $ column).
4. Edit a quantity inline in Holdings; switch to Breakdown; verify the chart updates without a full page refresh.

- [ ] **Step 10: Commit**

```bash
git add src/app/dashboard/lib/liveMergeAssets.ts src/app/dashboard/lib/__tests__/liveMergeAssets.test.ts src/app/dashboard/DashboardClient.tsx
git commit -m "feat(dashboard): live-merged assets feed both Holdings and Breakdown

Charts previously consumed stale marketValue from the server-fetched
assets[], while the table merged marketData[id].currentPrice inline.
Result: table showed live prices, charts showed stale. New liveMergeAssets
helper recomputes liveTickerPrice/marketValue/profitLoss from marketData
and flows to BreakdownTab + dashboard totals — charts now reflect the
same data the table shows. Module 8."
```

---

## Task 7: Data-flow reference doc

**Files:**
- Create: `docs/superpowers/specs/2026-05-03-5a-data-flow.md`

**Why:** Future contributors need a one-page reference describing the source-of-truth contract: where the canonical asset list lives, where live prices come from, and how the two merge. Without it, the next engineer who adds a new chart will tap `assets` directly and re-create the divergence.

- [ ] **Step 1: Write the doc**

Create `docs/superpowers/specs/2026-05-03-5a-data-flow.md`:

```markdown
# Dashboard Data Flow — Source of Truth

**Status:** Active contract as of 5A (2026-05-03).

## Canonical sources

- **`assets[]`** in `DashboardClient.tsx` — fetched from `/api/profile` GET. Server-side stored values: `bookCost`, `quantity`, `liveTickerPrice` (last-known-from-fetch), `marketValue` (computed at last save), `userOverrides`, `expectedAnnualDividends`, classification fields.
- **`marketData[assetId]`** — fetched from `/api/market-data` (live Yahoo prices, polled). Contains `currentPrice` and freshness metadata.

## The merge: `liveMergedAssets`

Defined in `DashboardClient.tsx` as `useMemo([assets, marketData])`. Per asset:

- `liveTickerPrice` = `marketData[asset.id].currentPrice` if it's a positive number, else `asset.liveTickerPrice`.
- `marketValue` = `quantity × liveTickerPrice` if both are positive, else `asset.marketValue`.
- `profitLoss` = `marketValue - bookCost`.
- All other fields preserved verbatim from `asset`.

## Consumers

| Surface | Source | Notes |
|---------|--------|-------|
| HoldingsTab table rows | `assets` + inline `marketData` merge in cell renderer | Row-level merge stays in HoldingsTab for now (per-cell logic depends on edit state) |
| HoldingsTab top-of-page totals | `liveMergedAssets` | totalMarketValue, total profit/loss |
| BreakdownTab — `computeBreakdowns` | `liveMergedAssets` | sector / market / strategy / etc. |
| BreakdownTab — `computeTopHoldings` | `liveMergedAssets` | concentration |
| BreakdownTab — `computeDriftSignals` | `liveMergedAssets` | drift |
| Strategy page Actuals (5C) | `liveMergedAssets` (TBD when 5C lands) | Categorical sync from Holdings |

## Rules of thumb

- **Never tap raw `assets[]` for chart aggregations.** Use `liveMergedAssets`.
- **Never introduce a third price source.** Live price is `marketData`; book cost is server.
- **Per-row inline edits** in the table mutate `assets[]` (server round-trip on save). The merge re-runs automatically on the next render.

## Why this contract exists

Pre-5A, `BreakdownTab` consumed stale `assets[].marketValue` while `HoldingsTab` merged live prices inline. Charts and table disagreed. Module 8 of Simone's PO feedback ("Holdings Table is the only source for charts") explicitly required unifying the path. See:
- `docs/superpowers/specs/2026-05-03-phase5-prioritization-breakdown-design.md` — sprint 5A scope
- `docs/superpowers/specs/2026-05-03-5a-foundations-design.md` — N/A (5A's design lives inside the Phase 5 prioritization spec)
```

- [ ] **Step 2: Verify the doc renders cleanly**

Run: `npx --yes -p markdownlint-cli2 markdownlint-cli2 docs/superpowers/specs/2026-05-03-5a-data-flow.md 2>/dev/null || cat docs/superpowers/specs/2026-05-03-5a-data-flow.md | head -5`
Expected: file exists; if markdownlint runs, no fatal errors.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-05-03-5a-data-flow.md
git commit -m "docs(5a): add dashboard data-flow contract reference"
```

---

## Task 8: Sprint wrap-up — cross-cutting verification + adversarial review

**Files:** None (verification + handoff).

**Why:** Per global CLAUDE.md instructions, every implementation cycle ends with `/codex:adversarial-review` before the sprint is declared ready for merge. 5A's review is the highest-stakes of the six because it's the data-trust layer — adversarial findings here can block the rest of Phase 5.

- [ ] **Step 1: Run the full test suite**

Run: `npx jest`
Expected: all tests green.

- [ ] **Step 2: Run lint + build**

Run: `npm run lint && npm run build`
Expected: zero warnings/errors. Address any introduced.

- [ ] **Step 3: Manual smoke checklist on dashboard**

Verify each of the following on iPad-portrait viewport (Simone's primary device):
- [ ] PDF import of a previously-failing statement now produces correct quantities.
- [ ] Edit a ticker on an existing asset (e.g., AAPL → SHOP); verify oneYearReturn / threeYearReturn / beta / analystConsensus / exDividendDate clear (don't carry over).
- [ ] Open edit mode in tab A; modify the same asset's quantity in tab B and save; in tab A try to save → expect 409 alert + form-close.
- [ ] Toggle a lock; simulate a refetch failure (offline mid-toggle) → expect lock state still flipped (no false-failure UX).
- [ ] Edit a quantity inline; switch to Breakdown tab; verify donut totals updated.
- [ ] Run a sector-breakdown sanity check: marketValue sum across slices ≈ total market value at top of Holdings.

- [ ] **Step 4: Recommend `/codex:adversarial-review`**

Per global CLAUDE.md: announce to Paulo:

> "Implementation complete and smoke green — recommend running `/codex:adversarial-review` before we mark this ready for merge."

The slash command is user-invocable only; do not dispatch it directly.

- [ ] **Step 5: After adversarial-review findings (if any)**

If the review surfaces issues, triage:
- **Confirmed blockers** → fix in this sprint, re-run review.
- **Forward-looking risks** → add to a new triage doc (`docs/superpowers/triage/2026-MM-DD-5a-deferred-followups.md`) following the 3A pattern.

When the review converges (zero new 5A-introduced findings on a pass), the sprint is ready to merge.

---

## Spec coverage check

Each item from the spec's "5A — Foundations" scope table → task that implements it:

| Spec item | Task |
|-----------|------|
| Module 8 — Holdings Table is the only source for charts | Task 6 (liveMergedAssets) + Task 7 (doc) |
| Module 7 #1 — PDF import quantity bug | Task 5 |
| 3A Item 3 — Ticker lookup carries old symbol's data | Task 2 |
| 3A Item 1 — Edit-mode PUT bypasses optimistic concurrency | Task 4 |
| 3A Item 2 — EncryptedDocumentClient bypasses encryption on UpdateCommand | Task 1 |
| 3A Item 4 — Lock PATCH 500-after-commit | Task 3 |

All spec items mapped. Definition-of-done from the spec:
- [x] All six items above land green with adversarial-review pass → Tasks 1-6 + Task 8.
- [x] Short data-flow doc lives in `docs/superpowers/specs/` → Task 7.
- [x] No new HIGH-severity adversarial findings in the data-trust layer → enforced by Task 8 Step 4.
