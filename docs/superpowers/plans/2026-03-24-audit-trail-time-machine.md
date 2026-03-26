# Audit Trail & Time Machine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a universal audit trail that records before/after state for every portfolio mutation, with a premium "Time Machine" UI for reviewing changes and cascade rollback.

**Architecture:** Inline audit logging in existing API routes (PDF import + manual asset CRUD). New rollback endpoint processes cascade reversals. New `/audit` page renders a glassmorphic vertical timeline with diff cards. Custom toast component for edit feedback.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, DynamoDB (single-table), lucide-react icons, CSS keyframe animations.

**Spec:** `docs/superpowers/specs/2026-03-24-audit-trail-time-machine-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/types/audit.ts` | Audit log types (AuditMutation, AuditLog, AssetSnapshot) |
| Create | `src/lib/auditLog.ts` | `insertAuditLog()` utility — DynamoDB PutCommand |
| Create | `src/lib/assetSnapshot.ts` | `toSnapshot()` helper — extracts snapshot from asset record |
| Modify | `src/app/api/portfolio-pdf/route.ts` | Restructure loop with operation classification + audit call |
| Modify | `src/app/api/assets/route.ts` | Add audit call after asset creation |
| Modify | `src/app/api/assets/[id]/route.ts` | Add audit calls after PUT and DELETE |
| Create | `src/app/api/audit-logs/route.ts` | GET endpoint to fetch audit logs with pagination |
| Create | `src/app/api/portfolio-rollback/route.ts` | POST endpoint for cascade rollback |
| Create | `src/components/AuditToast.tsx` | Glassmorphic toast notification component |
| Create | `src/app/audit/page.tsx` | Server page wrapper (auth check + redirect) |
| Create | `src/app/audit/AuditClient.tsx` | Time Machine client component (timeline + diff cards + rollback) |
| Modify | `src/app/dashboard/DashboardClient.tsx` | Row highlight animations, ghost rows, toast integration, import response handling |
| Modify | `src/components/Sidebar.tsx` | Add "Time Machine" nav entry |

---

### Task 1: Audit Types

**Files:**
- Create: `src/types/audit.ts`

- [ ] **Step 1: Create the audit type definitions**

```ts
// src/types/audit.ts

export interface AssetSnapshot {
  quantity: number;
  marketValue: number;
  bookCost: number;
  profitLoss: number;
  liveTickerPrice: number;
  currency: string;
  account: string;
  accountNumber: string;
  accountType: string;
  sector: string;
  market: string;
  securityType: string;
  strategyType: string;
  call: string;
  managementStyle: string;
  externalRating: string;
  managementFee: number;
  yield: number;
  oneYearReturn: number;
  threeYearReturn: number;
  fiveYearReturn: number;
  exDividendDate: string;
  analystConsensus: string;
  beta: number;
  riskFlag: string;
  risk: string;
  volatility: number;
  expectedAnnualDividends: number;
  importSource: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditMutation {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  ticker: string;
  assetSK: string;
  before: AssetSnapshot | null;
  after: AssetSnapshot | null;
}

export type AuditSource = 'PDF_IMPORT' | 'MANUAL_EDIT' | 'ROLLBACK';

export interface AuditLog {
  PK: string;
  SK: string;
  type: 'AUDIT_LOG';
  source: AuditSource;
  metadata: string;
  mutations: AuditMutation[];
  createdAt: string;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `src/types/audit.ts`

- [ ] **Step 3: Commit**

```bash
git add src/types/audit.ts
git commit -m "feat(audit): add audit trail type definitions"
```

---

### Task 2: Asset Snapshot Helper

**Files:**
- Create: `src/lib/assetSnapshot.ts`

- [ ] **Step 1: Create the snapshot extraction helper**

This function extracts the snapshot fields from a full DynamoDB asset record, ensuring consistent field selection across all audit call sites.

```ts
// src/lib/assetSnapshot.ts
import type { AssetSnapshot } from "@/types/audit";

/**
 * Extracts an AssetSnapshot from a DynamoDB asset record.
 * Used by audit logging to capture before/after state.
 */
export function toSnapshot(asset: Record<string, unknown>): AssetSnapshot {
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
    managementFee: Number(asset.managementFee) || 0,
    yield: Number(asset.yield) || 0,
    oneYearReturn: Number(asset.oneYearReturn) || 0,
    threeYearReturn: Number(asset.threeYearReturn) || 0,
    fiveYearReturn: Number(asset.fiveYearReturn) || 0,
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
  };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/assetSnapshot.ts
git commit -m "feat(audit): add asset snapshot extraction helper"
```

---

### Task 3: Audit Log Writer

**Files:**
- Create: `src/lib/auditLog.ts`

- [ ] **Step 1: Create the audit log writer utility**

```ts
// src/lib/auditLog.ts
import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type { AuditMutation, AuditSource } from "@/types/audit";

/**
 * Inserts an audit log entry into DynamoDB.
 * Returns the generated SK for downstream reference.
 */
export async function insertAuditLog(
  householdId: string,
  source: AuditSource,
  mutations: AuditMutation[],
  metadata?: string
): Promise<string> {
  const now = new Date().toISOString();
  const SK = `AUDIT_LOG#${now}#${uuidv4()}`;

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK,
        type: "AUDIT_LOG",
        source,
        metadata: metadata || "",
        mutations,
        createdAt: now,
      },
    })
  );

  return SK;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/auditLog.ts
git commit -m "feat(audit): add insertAuditLog utility for DynamoDB"
```

---

### Task 4: Restructure PDF Import Route

**Files:**
- Modify: `src/app/api/portfolio-pdf/route.ts`

This is the most complex task. The existing route builds a flat `writeRequests` array without classifying operations. We restructure it to classify CREATE/UPDATE/DELETE during the loop and build the `mutations` array alongside `writeRequests`.

- [ ] **Step 1: Add imports at the top of the file**

Add after existing imports (line 6):

```ts
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import type { AuditMutation } from "@/types/audit";
```

- [ ] **Step 2: Restructure the main loop (lines 206-275) to classify operations**

Replace the section from `type WriteRequest` (line 205) through the end of the write loop (line 275) with:

```ts
        // 4. Classify operations and build write requests + audit mutations
        type WriteRequest = { PutRequest?: { Item: Record<string, unknown> }, DeleteRequest?: { Key: Record<string, unknown> } };
        const writeRequests: WriteRequest[] = [];
        const mutations: AuditMutation[] = [];

        for (const h of holdings) {
            const pricePerShare = h.quantity > 0 ? h.marketValue / h.quantity : 0;
            const allMatches = existingAssets.filter(a => a.ticker === h.ticker);
            let existing;

            if (h.accountNumber) {
                existing = allMatches.find(a => a.accountNumber === h.accountNumber);
                if (!existing) {
                    const naMatches = allMatches.filter(a => !a.accountNumber || a.accountNumber.trim() === '' || a.accountNumber.trim().toLowerCase() === 'n/a' || a.accountNumber.trim().toLowerCase() === 'closing');
                    if (naMatches.length === 1) existing = naMatches[0];
                }
            } else {
                if (allMatches.length === 1 && !allMatches[0].accountNumber) {
                    existing = allMatches[0];
                } else {
                    const naMatches = allMatches.filter(a => !a.accountNumber || a.accountNumber.trim() === '' || a.accountNumber.trim().toLowerCase() === 'n/a' || a.accountNumber.trim().toLowerCase() === 'closing');
                    if (naMatches.length === 1) existing = naMatches[0];
                }
            }

            const assetId = existing ? existing.id : uuidv4();
            const assetSK = `ASSET#${assetId}`;

            const newItem = {
                PK: PROFILE_KEY,
                SK: assetSK,
                id: assetId,
                profileId: PROFILE_KEY,
                type: "ASSET",
                ticker: h.ticker,
                currency: h.currency || "CAD",
                quantity: h.quantity,
                liveTickerPrice: pricePerShare,
                bookCost: h.bookCost,
                marketValue: h.marketValue,
                profitLoss: h.marketValue - h.bookCost,
                accountNumber: h.accountNumber || (existing?.accountNumber ?? ""),
                accountType: h.accountType || (existing?.accountType ?? "Registered"),
                importSource: "pdf-statement",
                updatedAt: new Date().toISOString(),
                createdAt: existing?.createdAt ?? new Date().toISOString(),
                account: existing?.account ?? "",
                securityType: existing?.securityType ?? "",
                strategyType: existing?.strategyType ?? "",
                call: existing?.call ?? "",
                sector: existing?.sector ?? "",
                market: existing?.market ?? "",
                managementStyle: existing?.managementStyle ?? "",
                externalRating: existing?.externalRating ?? "",
                managementFee: existing?.managementFee ?? 0,
                yield: existing?.yield ?? 0,
                oneYearReturn: existing?.oneYearReturn ?? 0,
                fiveYearReturn: existing?.fiveYearReturn ?? 0,
                threeYearReturn: existing?.threeYearReturn ?? 0,
                exDividendDate: existing?.exDividendDate ?? "",
                analystConsensus: existing?.analystConsensus ?? "",
                beta: existing?.beta ?? 0,
                riskFlag: existing?.riskFlag ?? "",
                risk: existing?.risk ?? "",
                volatility: existing?.volatility ?? 0,
                expectedAnnualDividends: existing?.expectedAnnualDividends ?? 0,
            };

            writeRequests.push({ PutRequest: { Item: newItem } });

            // Classify for audit
            if (existing) {
                mutations.push({
                    action: 'UPDATE',
                    ticker: h.ticker,
                    assetSK,
                    before: toSnapshot(existing),
                    after: toSnapshot(newItem),
                });
            } else {
                mutations.push({
                    action: 'CREATE',
                    ticker: h.ticker,
                    assetSK,
                    before: null,
                    after: toSnapshot(newItem),
                });
            }
        }
```

- [ ] **Step 3: Add deletion classification (replace lines 277-294)**

Replace the deletion section with:

```ts
        // 5. Classify and build delete requests for assets no longer in PDF
        const pdfAccountNumber = holdings.length > 0 ? holdings[0].accountNumber : extractAccountNumber(text);
        if (pdfAccountNumber && pdfAccountNumber.trim() !== '') {
            const existingAssetsForAccount = existingAssets.filter(a => a.accountNumber === pdfAccountNumber);
            for (const asset of existingAssetsForAccount) {
                const stillHoldsIt = holdings.some(h => h.ticker === asset.ticker);
                if (!stillHoldsIt) {
                    writeRequests.push({
                        DeleteRequest: {
                            Key: { PK: asset.PK, SK: asset.SK }
                        }
                    });
                    mutations.push({
                        action: 'DELETE',
                        ticker: asset.ticker,
                        assetSK: asset.SK,
                        before: toSnapshot(asset),
                        after: null,
                    });
                }
            }
        }
```

- [ ] **Step 4: Add UnprocessedItems retry and audit log call (replace lines 296-307)**

Replace the BatchWrite section with:

```ts
        // 6. DynamoDB BatchWriteItem with retry for unprocessed items
        const chunkSize = 25;
        for (let i = 0; i < writeRequests.length; i += chunkSize) {
            const chunk = writeRequests.slice(i, i + chunkSize);
            let unprocessed = chunk;
            let retries = 0;
            const maxRetries = 3;

            while (unprocessed.length > 0 && retries < maxRetries) {
                const result = await db.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [TABLE_NAME]: unprocessed,
                        }
                    })
                );

                const remaining = result.UnprocessedItems?.[TABLE_NAME];
                if (remaining && remaining.length > 0) {
                    unprocessed = remaining as WriteRequest[];
                    retries++;
                    // Exponential backoff before retry
                    await new Promise(resolve => setTimeout(resolve, 100 * Math.pow(2, retries)));
                } else {
                    unprocessed = [];
                }
            }

            if (unprocessed.length > 0) {
                console.error(`Failed to process ${unprocessed.length} items after ${maxRetries} retries`);
                return NextResponse.json({
                    error: `Import partially failed. ${unprocessed.length} items could not be written.`,
                }, { status: 500 });
            }
        }

        // 7. Write audit log only after ALL chunks succeed
        const filename = (formData.get("file") as File)?.name || "unknown.pdf";
        if (mutations.length > 0) {
            await insertAuditLog(session.user.householdId, 'PDF_IMPORT', mutations, filename);
        }
```

- [ ] **Step 5: Update the success response (replace lines 309-313)**

Replace with:

```ts
        return NextResponse.json({
            message: "PDF statement imported successfully",
            count: holdings.length,
            holdings: holdings.map(h => ({ ticker: h.ticker, quantity: h.quantity, accountType: h.accountType })),
            mutations: mutations.map(m => ({ action: m.action, ticker: m.ticker, assetSK: m.assetSK })),
        });
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Manual verification**

Start dev server: `npm run dev`
Upload a PDF and verify:
1. Assets are created/updated/deleted as before
2. Check DynamoDB for a new `AUDIT_LOG#` entry with correct mutations array
3. Response includes `mutations` array with action/ticker/assetSK

- [ ] **Step 8: Commit**

```bash
git add src/app/api/portfolio-pdf/route.ts
git commit -m "feat(audit): restructure PDF import with operation classification and audit logging"
```

---

### Task 5: Add Audit Logging to Manual Edit Routes

**Files:**
- Modify: `src/app/api/assets/route.ts`
- Modify: `src/app/api/assets/[id]/route.ts`

- [ ] **Step 1: Add audit to POST (create) in `src/app/api/assets/route.ts`**

Add imports after line 6:

```ts
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
```

After the `PutCommand` succeeds (after line 81), before the return statement, add:

```ts
        // Audit log: record creation
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'CREATE',
            ticker: asset.ticker,
            assetSK: asset.SK,
            before: null,
            after: toSnapshot(asset),
        }], asset.ticker);
```

- [ ] **Step 2: Add audit to DELETE in `src/app/api/assets/[id]/route.ts`**

Add imports after line 5:

```ts
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
```

In the DELETE handler, fetch the asset before deleting it. Replace lines 22-30 with:

```ts
        // Fetch existing asset before deletion for audit snapshot
        const { Item: existingAsset } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK },
            })
        );

        if (!existingAsset) {
            return NextResponse.json({ error: "Asset not found" }, { status: 404 });
        }

        await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK }
            })
        );

        // Audit log: record deletion
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'DELETE',
            ticker: existingAsset.ticker || "",
            assetSK,
            before: toSnapshot(existingAsset),
            after: null,
        }], existingAsset.ticker || "");
```

- [ ] **Step 3: Add audit to PUT (update) in the same file**

In the PUT handler, after the `PutCommand` succeeds (after line 118), before the return statement, add:

```ts
        // Audit log: record update
        await insertAuditLog(session.user.householdId, 'MANUAL_EDIT', [{
            action: 'UPDATE',
            ticker: updatedAsset.ticker,
            assetSK,
            before: toSnapshot(existingAsset),
            after: toSnapshot(updatedAsset),
        }], updatedAsset.ticker);
```

Note: `existingAsset` is already fetched at line 53 — no additional DB call needed.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Manual verification**

With dev server running:
1. Edit an asset's quantity via the dashboard inline edit. Check DynamoDB for `AUDIT_LOG#` with source=MANUAL_EDIT, action=UPDATE
2. Add a new asset row. Check for action=CREATE
3. Delete an asset. Check for action=DELETE

- [ ] **Step 6: Commit**

```bash
git add src/app/api/assets/route.ts src/app/api/assets/[id]/route.ts
git commit -m "feat(audit): add audit logging to manual asset CRUD operations"
```

---

### Task 6: Audit Logs Fetch Endpoint

**Files:**
- Create: `src/app/api/audit-logs/route.ts`

- [ ] **Step 1: Create the GET endpoint**

```ts
// src/app/api/audit-logs/route.ts
import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const lastKey = searchParams.get("lastKey");

    const commandInput: Record<string, unknown> = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${session.user.householdId}`,
        ":skPrefix": "AUDIT_LOG#",
      },
      ScanIndexForward: false,
      Limit: limit,
    };

    if (lastKey) {
      commandInput.ExclusiveStartKey = {
        PK: `HOUSEHOLD#${session.user.householdId}`,
        SK: lastKey,
      };
    }

    const { Items, LastEvaluatedKey } = await db.send(
      new QueryCommand(commandInput)
    );

    return NextResponse.json({
      logs: Items || [],
      lastKey: LastEvaluatedKey?.SK || null,
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Manual verification**

With dev server running and some audit logs already created from previous tasks:
1. `curl http://localhost:3000/api/audit-logs` (or use browser) — should return logs array
2. Test pagination: `curl http://localhost:3000/api/audit-logs?limit=1` — should return 1 log + lastKey

- [ ] **Step 4: Commit**

```bash
git add src/app/api/audit-logs/route.ts
git commit -m "feat(audit): add GET endpoint for fetching audit logs with pagination"
```

---

### Task 7: Rollback Endpoint

**Files:**
- Create: `src/app/api/portfolio-rollback/route.ts`

- [ ] **Step 1: Create the cascade rollback endpoint**

```ts
// src/app/api/portfolio-rollback/route.ts
import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import type { AuditMutation, AuditLog } from "@/types/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { auditLogSK } = await request.json();
    if (!auditLogSK || !auditLogSK.startsWith("AUDIT_LOG#")) {
      return NextResponse.json({ error: "Invalid audit log reference" }, { status: 400 });
    }

    const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;

    // 1. Fetch audit logs from newest down to the target (inclusive)
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :targetSK AND :maxSK",
        ExpressionAttributeValues: {
          ":pk": PROFILE_KEY,
          ":targetSK": auditLogSK,
          ":maxSK": "AUDIT_LOG#\uffff", // Upper bound ensures only AUDIT_LOG# entries
        },
        ScanIndexForward: false,
      })
    );

    const allLogs = (Items || []) as AuditLog[];

    // 2. Collect entries from most recent down to and including the target
    const targetIndex = allLogs.findIndex(log => log.SK === auditLogSK);
    if (targetIndex === -1) {
      return NextResponse.json({ error: "Audit log entry not found" }, { status: 404 });
    }

    // Logs are newest-first, so entries 0..targetIndex need to be reversed
    const logsToReverse = allLogs.slice(0, targetIndex + 1);

    // 3. Process each log entry (already in newest-first order)
    const rollbackSummary: { logSK: string; reversedMutations: number }[] = [];

    for (const log of logsToReverse) {
      const reverseMutations: AuditMutation[] = [];

      for (const mutation of log.mutations) {
        try {
          if (mutation.action === 'CREATE' && mutation.after) {
            // CREATE -> DELETE: remove the asset that was created
            // Check if asset still exists first
            const { Item: currentAsset } = await db.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
              })
            );

            if (currentAsset) {
              await db.send(
                new DeleteCommand({
                  TableName: TABLE_NAME,
                  Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
                })
              );
              reverseMutations.push({
                action: 'DELETE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: toSnapshot(currentAsset),
                after: null,
              });
            }
          } else if (mutation.action === 'DELETE' && mutation.before) {
            // DELETE -> CREATE: recreate the asset from before snapshot
            const restoredAsset = {
              PK: PROFILE_KEY,
              SK: mutation.assetSK,
              id: mutation.assetSK.replace('ASSET#', ''),
              profileId: PROFILE_KEY,
              type: "ASSET",
              ticker: mutation.ticker,
              ...mutation.before,
              updatedAt: new Date().toISOString(),
            };

            await db.send(
              new PutCommand({
                TableName: TABLE_NAME,
                Item: restoredAsset,
              })
            );
            reverseMutations.push({
              action: 'CREATE',
              ticker: mutation.ticker,
              assetSK: mutation.assetSK,
              before: null,
              after: toSnapshot(restoredAsset),
            });
          } else if (mutation.action === 'UPDATE' && mutation.before) {
            // UPDATE -> UPDATE: revert to before values
            const { Item: currentAsset } = await db.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
              })
            );

            if (currentAsset) {
              // Revert to before snapshot values
              const revertedAsset = {
                ...currentAsset,
                ...mutation.before,
                updatedAt: new Date().toISOString(),
              };

              await db.send(
                new PutCommand({
                  TableName: TABLE_NAME,
                  Item: revertedAsset,
                })
              );
              reverseMutations.push({
                action: 'UPDATE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: toSnapshot(currentAsset),
                after: toSnapshot(revertedAsset),
              });
            } else {
              // Asset was deleted by a later operation — recreate from before
              const restoredAsset = {
                PK: PROFILE_KEY,
                SK: mutation.assetSK,
                id: mutation.assetSK.replace('ASSET#', ''),
                profileId: PROFILE_KEY,
                type: "ASSET",
                ticker: mutation.ticker,
                ...mutation.before,
                updatedAt: new Date().toISOString(),
              };

              await db.send(
                new PutCommand({
                  TableName: TABLE_NAME,
                  Item: restoredAsset,
                })
              );
              reverseMutations.push({
                action: 'CREATE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: null,
                after: toSnapshot(restoredAsset),
              });
            }
          }
        } catch (err) {
          console.error(`Rollback failed for mutation ${mutation.ticker} (${mutation.action}):`, err);
          // Record what was successfully reversed before failing
          if (reverseMutations.length > 0) {
            await insertAuditLog(
              session.user.householdId,
              'ROLLBACK',
              reverseMutations,
              `PARTIAL_ROLLBACK:${log.SK}`
            );
          }
          return NextResponse.json({
            error: `Rollback partially failed at ${mutation.ticker} (${mutation.action}). ${rollbackSummary.length} entries fully reversed, current entry partially reversed.`,
            rollbackSummary,
          }, { status: 500 });
        }
      }

      // Record the rollback audit entry for this log
      if (reverseMutations.length > 0) {
        await insertAuditLog(
          session.user.householdId,
          'ROLLBACK',
          reverseMutations,
          log.SK
        );
      }

      rollbackSummary.push({
        logSK: log.SK,
        reversedMutations: reverseMutations.length,
      });
    }

    return NextResponse.json({
      message: `Successfully rolled back ${logsToReverse.length} audit entries.`,
      rollbackSummary,
    });
  } catch (error) {
    console.error("Rollback failed:", error);
    return NextResponse.json({ error: "Rollback failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Manual verification**

With dev server running:
1. Make a manual edit (e.g., change XQQ from 230 to 250)
2. Note the `AUDIT_LOG#` SK from the audit logs endpoint
3. Call rollback: `curl -X POST http://localhost:3000/api/portfolio-rollback -H 'Content-Type: application/json' -d '{"auditLogSK":"AUDIT_LOG#..."}'`
4. Verify the asset reverted to 230
5. Verify a new ROLLBACK audit log entry was created

- [ ] **Step 4: Commit**

```bash
git add src/app/api/portfolio-rollback/route.ts
git commit -m "feat(audit): add cascade rollback endpoint with per-entry reversal"
```

---

### Task 8: Audit Toast Component

**Files:**
- Create: `src/components/AuditToast.tsx`

- [ ] **Step 1: Create the glassmorphic toast component**

```tsx
// src/components/AuditToast.tsx
"use client";

import { useEffect, useState } from "react";
import { Shield, X } from "lucide-react";
import Link from "next/link";

export interface AuditToastData {
  id: string;
  message: string;
  ticker?: string;
}

interface AuditToastProps {
  toasts: AuditToastData[];
  onDismiss: (id: string) => void;
}

export function AuditToast({ toasts, onDismiss }: AuditToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <AuditToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AuditToastItem({ toast, onDismiss }: { toast: AuditToastData; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`
        pointer-events-auto max-w-sm w-full
        bg-white/10 dark:bg-white/5 backdrop-blur-xl
        border border-white/20 dark:border-white/10
        rounded-xl shadow-2xl shadow-black/20
        p-4 flex items-start gap-3
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Shield className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {toast.message}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Exact snapshot secured in Audit Trail.
        </p>
        <Link
          href="/audit"
          className="inline-block mt-2 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 transition-colors"
        >
          View in Time Machine →
        </Link>
      </div>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/AuditToast.tsx
git commit -m "feat(audit): add glassmorphic AuditToast notification component"
```

---

### Task 9: Dashboard Integration — Row Highlights, Ghost Rows, Toasts

**Files:**
- Modify: `src/app/dashboard/DashboardClient.tsx`

This task adds: audit toast triggering, row pulse animations, and ghost rows for PDF import deletions.

- [ ] **Step 1: Add imports and new state variables**

Add to imports (line 4):

```ts
import { AuditToast, type AuditToastData } from "@/components/AuditToast";
```

Add after existing state declarations (after line 27, before the option lists):

```ts
  // Audit feedback state
  const [auditToasts, setAuditToasts] = useState<AuditToastData[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<Record<string, 'CREATE' | 'UPDATE' | 'DELETE'>>({});
  const [ghostAssets, setGhostAssets] = useState<Array<{ ticker: string; assetSK: string; snapshot: Record<string, unknown> }>>([]);

  const dismissToast = (id: string) => {
    setAuditToasts(prev => prev.filter(t => t.id !== id));
  };

  const showAuditToast = (message: string, ticker?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setAuditToasts(prev => [...prev, { id, message, ticker }]);
  };
```

- [ ] **Step 2: Update `saveEdit()` to trigger toast and row highlight**

Replace the success path inside `saveEdit()` (lines 150-152) with:

```ts
      const responseData = await res.json();
      const action = editingId === "NEW" ? "CREATE" : "UPDATE";
      const savedTicker = editForm.ticker || "";

      setEditingId(null);
      setEditForm({});
      fetchAssets();

      // Audit feedback
      showAuditToast(
        action === "CREATE"
          ? `${savedTicker} added to portfolio.`
          : `${savedTicker} updated.`,
        savedTicker
      );

      // Row highlight — use the asset id from response or editingId
      const highlightId = responseData.asset?.SK || `ASSET#${editingId}`;
      setHighlightedRows(prev => ({ ...prev, [highlightId]: action }));
      setTimeout(() => {
        setHighlightedRows(prev => {
          const next = { ...prev };
          delete next[highlightId];
          return next;
        });
      }, 4000);
```

- [ ] **Step 3: Update `handleDeleteAsset()` to trigger toast**

Replace the success message in `handleDeleteAsset()` (line 120) with:

```ts
      showAuditToast(`Asset deleted.`);
      fetchAssets();
```

- [ ] **Step 4: Update PDF import handler to show row highlights and ghost rows**

Replace the success path in the PDF import onChange handler (lines 414-416) with:

```ts
                if (res.ok) {
                  setMessage({ text: `Imported ${data.count} holdings from PDF.`, type: 'success' });

                  // Set row highlights from classified mutations
                  if (data.mutations && Array.isArray(data.mutations)) {
                    const highlights: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {};
                    const ghosts: Array<{ ticker: string; assetSK: string; snapshot: Record<string, unknown> }> = [];

                    for (const m of data.mutations) {
                      highlights[m.assetSK] = m.action;
                      if (m.action === 'DELETE') {
                        ghosts.push({ ticker: m.ticker, assetSK: m.assetSK, snapshot: {} });
                      }
                    }

                    setHighlightedRows(highlights);
                    setGhostAssets(ghosts);

                    // Clear highlights after animation
                    setTimeout(() => {
                      setHighlightedRows({});
                      setGhostAssets([]);
                    }, 4000);
                  }

                  showAuditToast(`PDF imported — ${data.count} holdings processed.`);
                  fetchAssets();
                }
```

- [ ] **Step 5: Add row highlight CSS classes to table rows**

In the table body where asset rows are rendered (around line 560-565, where the `<tr>` is created for each row), add a dynamic className. Find the `<tr` tag for each asset row and add highlight logic. The exact location will be the `sortedAssets.map()` callback.

Add this helper before the return statement (inside the component, near line 375):

```ts
  const getRowHighlightClass = (assetSK: string) => {
    const action = highlightedRows[assetSK];
    if (!action) return "";
    switch (action) {
      case 'CREATE': return "audit-highlight-create";
      case 'UPDATE': return "audit-highlight-update";
      case 'DELETE': return "audit-highlight-delete";
      default: return "";
    }
  };
```

Apply the class to each `<tr>` in the assets map by adding `${getRowHighlightClass(asset.SK)}` to its className.

- [ ] **Step 6: Add ghost rows after the regular assets in the table body**

After the `sortedAssets.map()` block in the table body, add:

```tsx
          {/* Ghost rows for deleted assets */}
          {ghostAssets.map(ghost => (
            <tr key={`ghost-${ghost.assetSK}`} className="audit-highlight-delete">
              <td colSpan={26} className="px-4 py-3 text-center text-sm text-red-400 line-through opacity-70">
                {ghost.ticker} — removed from portfolio
              </td>
            </tr>
          ))}
```

- [ ] **Step 7: Add the AuditToast component to the JSX**

At the very end of the component's return, just before the closing `</div>`, add:

```tsx
      <AuditToast toasts={auditToasts} onDismiss={dismissToast} />
```

- [ ] **Step 8: Add CSS keyframe animations**

Create a `<style>` tag inside the component (at the start of the return JSX, before the first `<div>`), or add to the app's global CSS file. The animations:

```css
/* Add to src/app/globals.css or inline */
@keyframes audit-pulse-green {
  0% { box-shadow: inset 4px 0 0 0 #10b981, 0 0 0 0 rgba(16, 185, 129, 0.4); }
  50% { box-shadow: inset 4px 0 0 0 #10b981, 0 0 20px 4px rgba(16, 185, 129, 0.15); }
  100% { box-shadow: none; border-left-color: transparent; }
}

@keyframes audit-pulse-amber {
  0% { box-shadow: inset 4px 0 0 0 #f59e0b, 0 0 0 0 rgba(245, 158, 11, 0.4); }
  50% { box-shadow: inset 4px 0 0 0 #f59e0b, 0 0 20px 4px rgba(245, 158, 11, 0.15); }
  100% { box-shadow: none; border-left-color: transparent; }
}

@keyframes audit-pulse-red {
  0% { box-shadow: inset 4px 0 0 0 #ef4444; opacity: 0.7; }
  100% { box-shadow: none; opacity: 0; }
}

.audit-highlight-create {
  animation: audit-pulse-green 4s ease-out forwards;
}

.audit-highlight-update {
  animation: audit-pulse-amber 4s ease-out forwards;
}

.audit-highlight-delete {
  animation: audit-pulse-red 4s ease-out forwards;
}
```

Find the global CSS file (likely `src/app/globals.css`) and add these styles there.

- [ ] **Step 9: Verify TypeScript compiles and visual test**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

Manual test:
1. Edit an asset → see amber pulse on row + toast slides in from bottom-right
2. Add a new asset → see green pulse + toast
3. Delete an asset → see toast
4. Import PDF → see green/amber/red highlights on affected rows + ghost rows for deletions + toast

- [ ] **Step 10: Commit**

```bash
git add src/app/dashboard/DashboardClient.tsx src/app/globals.css
git commit -m "feat(audit): add row highlights, ghost rows, and toast integration to dashboard"
```

---

### Task 10: Time Machine Page

**Files:**
- Create: `src/app/audit/page.tsx`
- Create: `src/app/audit/AuditClient.tsx`

- [ ] **Step 1: Create the server page wrapper**

```tsx
// src/app/audit/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  return <AuditClient />;
}
```

- [ ] **Step 2: Create the Time Machine client component**

This is a large component. Key sections: fetch logs, timeline rendering, diff card expansion, rollback trigger.

```tsx
// src/app/audit/AuditClient.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Pencil, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, Loader2, Clock } from "lucide-react";
import type { AuditLog, AuditMutation } from "@/types/audit";

export default function AuditClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [expandedSK, setExpandedSK] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchLogs = useCallback(async (cursorKey?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursorKey) params.set("lastKey", cursorKey);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      if (data.logs) {
        setLogs(prev => cursorKey ? [...prev, ...data.logs] : data.logs);
        setLastKey(data.lastKey || null);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRollback = async (auditLogSK: string) => {
    // Count how many entries will be reversed
    const targetIndex = logs.findIndex(l => l.SK === auditLogSK);
    const count = targetIndex + 1;

    const confirmed = confirm(
      `This will undo this change and ${count > 1 ? `all ${count - 1} change(s) after it` : "no other changes"}. Continue?`
    );
    if (!confirmed) return;

    setIsRollingBack(true);
    setRollbackTarget(auditLogSK);

    try {
      const res = await fetch("/api/portfolio-rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogSK }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        // Refresh the timeline
        await fetchLogs();
      } else {
        setMessage({ text: data.error || "Rollback failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Rollback failed. Please try again.", type: "error" });
    } finally {
      setIsRollingBack(false);
      setRollbackTarget(null);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return <FileText className="h-4 w-4" />;
      case "MANUAL_EDIT": return <Pencil className="h-4 w-4" />;
      case "ROLLBACK": return <RotateCcw className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      case "MANUAL_EDIT": return "text-emerald-400 bg-emerald-500/20 border-emerald-500/30";
      case "ROLLBACK": return "text-amber-400 bg-amber-500/20 border-amber-500/30";
      default: return "text-neutral-400 bg-neutral-500/20 border-neutral-500/30";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return "PDF Import";
      case "MANUAL_EDIT": return "Manual Edit";
      case "ROLLBACK": return "Rollback";
      default: return source;
    }
  };

  const getTimelineLineColor = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return "bg-blue-500/50";
      case "MANUAL_EDIT": return "bg-emerald-500/50";
      case "ROLLBACK": return "bg-amber-500/50";
      default: return "bg-neutral-500/50";
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const summarizeMutations = (mutations: AuditMutation[]) => {
    const creates = mutations.filter(m => m.action === "CREATE").length;
    const updates = mutations.filter(m => m.action === "UPDATE").length;
    const deletes = mutations.filter(m => m.action === "DELETE").length;

    const parts: string[] = [];
    if (creates) parts.push(`${creates} created`);
    if (updates) parts.push(`${updates} updated`);
    if (deletes) parts.push(`${deletes} deleted`);
    return parts.join(", ") || "No changes";
  };

  // Rewind overlay animation
  const RewindOverlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <RotateCcw className="h-16 w-16 text-amber-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
        <p className="text-lg font-medium text-white">Reverting changes...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {isRollingBack && <RewindOverlay />}

      {/* Header */}
      <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-teal-500" />
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Time Machine</h1>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </button>
      </header>

      <div className="flex-1 p-4 md:p-8 max-w-4xl mx-auto w-full">
        {/* Messages */}
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === "success"
              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <RotateCcw className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mb-4" />
            <h2 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">No changes recorded yet</h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Import a PDF or edit an asset to start building your audit trail.</p>
          </div>
        )}

        {/* Timeline */}
        {logs.length > 0 && (
          <div className="relative">
            {/* Glowing vertical line */}
            <div className="absolute left-[19px] md:left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/40 via-neutral-500/20 to-transparent" />

            <div className="space-y-1">
              {logs.map((log, index) => {
                const isExpanded = expandedSK === log.SK;
                const isTarget = rollbackTarget === log.SK;

                return (
                  <div key={log.SK} className="relative">
                    {/* Timeline node */}
                    <button
                      onClick={() => setExpandedSK(isExpanded ? null : log.SK)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-start gap-3 md:gap-4 py-3 px-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                        {/* Node dot */}
                        <div className={`relative z-10 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center ${getSourceColor(log.source)} ${isTarget ? "animate-pulse" : ""}`}>
                          {getSourceIcon(log.source)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pt-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {getSourceLabel(log.source)}
                            </span>
                            {log.metadata && log.source === "PDF_IMPORT" && (
                              <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                — {log.metadata}
                              </span>
                            )}
                            {log.metadata && log.source === "MANUAL_EDIT" && (
                              <span className="text-xs text-neutral-500 dark:text-neutral-400">
                                — {log.metadata}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-400 dark:text-neutral-500" title={new Date(log.createdAt).toLocaleString()}>
                              {formatRelativeTime(log.createdAt)}
                            </span>
                            <span className="text-xs text-neutral-400 dark:text-neutral-500">
                              · {summarizeMutations(log.mutations)}
                            </span>
                          </div>
                        </div>

                        {/* Expand indicator */}
                        <div className="flex-shrink-0 pt-2">
                          {isExpanded
                            ? <ChevronDown className="h-4 w-4 text-neutral-400" />
                            : <ChevronRight className="h-4 w-4 text-neutral-400" />
                          }
                        </div>
                      </div>
                    </button>

                    {/* Expanded diff card */}
                    {isExpanded && (
                      <div className="ml-12 md:ml-16 mb-4 mt-1 animate-in slide-in-from-top-2 duration-200">
                        <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-3">
                          {/* Mutations list */}
                          {log.mutations.map((m, mIndex) => (
                            <MutationCard key={mIndex} mutation={m} />
                          ))}

                          {/* Rollback button — not shown on ROLLBACK entries */}
                          {log.source !== "ROLLBACK" && (
                            <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRollback(log.SK);
                                }}
                                disabled={isRollingBack}
                                className="w-full md:w-auto px-4 py-2.5 rounded-lg text-sm font-medium
                                  bg-amber-500/10 text-amber-600 dark:text-amber-400
                                  border border-amber-500/20
                                  hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10
                                  transition-all duration-200
                                  disabled:opacity-50 disabled:cursor-not-allowed
                                  flex items-center justify-center gap-2"
                              >
                                <RotateCcw className="h-4 w-4" />
                                Revert to before this change
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Load more */}
            {lastKey && (
              <div className="text-center py-8">
                <button
                  onClick={() => fetchLogs(lastKey)}
                  disabled={isLoading}
                  className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {isLoading && logs.length === 0 && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        )}
      </div>
    </div>
  );
}

/** Renders a single mutation with color-coded diff */
function MutationCard({ mutation }: { mutation: AuditMutation }) {
  const actionColors = {
    CREATE: { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", prefix: "+" },
    UPDATE: { badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", prefix: "~" },
    DELETE: { badge: "bg-red-500/20 text-red-400 border-red-500/30", prefix: "-" },
  };

  const { badge, prefix } = actionColors[mutation.action];

  const diffFields = () => {
    if (mutation.action === "CREATE" && mutation.after) {
      return (
        <div className="space-y-1">
          <DiffLine label="Quantity" value={mutation.after.quantity} color="text-emerald-400" />
          <DiffLine label="Market Value" value={`$${mutation.after.marketValue.toLocaleString()}`} color="text-emerald-400" />
          <DiffLine label="Book Cost" value={`$${mutation.after.bookCost.toLocaleString()}`} color="text-emerald-400" />
        </div>
      );
    }

    if (mutation.action === "DELETE" && mutation.before) {
      return (
        <div className="space-y-1">
          <DiffLine label="Quantity" value={mutation.before.quantity} color="text-red-400" strikethrough />
          <DiffLine label="Market Value" value={`$${mutation.before.marketValue.toLocaleString()}`} color="text-red-400" strikethrough />
          <DiffLine label="Book Cost" value={`$${mutation.before.bookCost.toLocaleString()}`} color="text-red-400" strikethrough />
        </div>
      );
    }

    if (mutation.action === "UPDATE" && mutation.before && mutation.after) {
      // Show only fields that changed
      const fields: { label: string; before: string | number; after: string | number }[] = [];

      const keys: (keyof typeof mutation.before)[] = [
        "quantity", "marketValue", "bookCost", "profitLoss", "liveTickerPrice",
        "currency", "account", "accountNumber", "accountType", "sector", "market",
        "securityType", "strategyType", "managementFee", "yield",
        "oneYearReturn", "threeYearReturn", "fiveYearReturn",
      ];

      for (const key of keys) {
        const bVal = mutation.before[key];
        const aVal = mutation.after[key];
        if (bVal !== aVal) {
          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
          const formatVal = (v: string | number) => typeof v === "number" && (key.includes("Value") || key.includes("Cost") || key.includes("Loss"))
            ? `$${v.toLocaleString()}`
            : String(v);
          fields.push({ label, before: formatVal(bVal), after: formatVal(aVal) });
        }
      }

      if (fields.length === 0) {
        return <p className="text-xs text-neutral-500">No visible field changes</p>;
      }

      return (
        <div className="space-y-1.5">
          {fields.map(f => (
            <div key={f.label} className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{f.label}</span>
              <span className="text-red-400 line-through">{String(f.before)}</span>
              <span className="text-neutral-500 hidden md:inline">→</span>
              <span className="text-emerald-400">{String(f.after)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono border ${badge}`}>
        {prefix} {mutation.action}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">{mutation.ticker}</p>
        {diffFields()}
      </div>
    </div>
  );
}

function DiffLine({ label, value, color, strikethrough }: { label: string; value: string | number; color: string; strikethrough?: boolean }) {
  return (
    <div className={`text-xs flex gap-2 ${color}`}>
      <span className="text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{label}</span>
      <span className={strikethrough ? "line-through" : ""}>{String(value)}</span>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Manual verification**

Navigate to `/audit` in the browser:
1. Timeline loads with existing audit entries
2. Clicking a node expands the diff card
3. Diff card shows color-coded before/after values
4. Rollback button appears on non-ROLLBACK entries
5. Mobile view: accordion layout, full-width rollback button
6. Empty state shows when no logs exist

- [ ] **Step 5: Commit**

```bash
git add src/app/audit/page.tsx src/app/audit/AuditClient.tsx
git commit -m "feat(audit): add Time Machine page with timeline, diff cards, and rollback UI"
```

---

### Task 11: Sidebar Navigation Update

**Files:**
- Modify: `src/components/Sidebar.tsx`

- [ ] **Step 1: Add Time Machine to the "My Blueprint" pillar**

In [Sidebar.tsx](src/components/Sidebar.tsx), add the `RotateCcw` icon to imports (line 6):

Change `Radio` import to include `RotateCcw`:
```ts
import { Users, LayoutDashboard, Settings, BrainCircuit, LogOut, Wallet, Target, BookOpen, Globe, Shield, Radio, RotateCcw } from "lucide-react";
```

Add the Time Machine entry to the "My Blueprint" pillar items array (after the dashboard entry, line 20):

```ts
            { name: "Time Machine", href: "/audit", icon: RotateCcw },
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Manual verification**

1. Sidebar shows "Time Machine" in My Blueprint pillar
2. Clicking it navigates to `/audit`
3. Active state styling works when on the `/audit` page

- [ ] **Step 4: Commit**

```bash
git add src/components/Sidebar.tsx
git commit -m "feat(audit): add Time Machine to sidebar navigation"
```

---

### Task 12: End-to-End Verification

No files to modify — this is the full verification pass from the spec.

- [ ] **Step 1: Manual Edit Test**

1. Go to the dashboard
2. Edit XQQ from 230 to 250 shares
3. Verify: amber row pulse + audit toast appears
4. Open Time Machine → see 1x MANUAL_EDIT log showing 230 → 250

- [ ] **Step 2: PDF Import Test**

1. Upload a PDF statement
2. Verify: rows highlight green (create), amber (update), red ghost rows (delete)
3. Audit toast appears
4. Open Time Machine → see 1x PDF_IMPORT log with all mutations

- [ ] **Step 3: Cascade Rollback Test**

1. Make 2 manual edits after the PDF import
2. Open Time Machine
3. Click "Revert to before this change" on the PDF import entry
4. Confirm the cascade dialog
5. Verify: rewind animation plays, all 3 entries (2 manual + 1 PDF) are reversed
6. Verify: 3 new ROLLBACK entries in the timeline
7. Verify: portfolio is back to pre-import state

- [ ] **Step 4: Mobile Verification**

1. Open the app on a mobile viewport (or use Chrome DevTools responsive mode)
2. Navigate to Time Machine via sidebar
3. Verify: single-column accordion layout
4. Verify: diff cards expand inline below nodes
5. Verify: rollback button is full-width

- [ ] **Step 5: Final commit (if any adjustments needed)**

```bash
git add -A
git commit -m "fix(audit): address e2e verification findings"
```
