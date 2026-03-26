# Universal Audit Trail & Time Machine Design

## 1. Summary

Build a complete audit trail that records the before/after state of every portfolio mutation (PDF import and manual edit), and a "Time Machine" UI that lets users review changes and roll back to any prior state.

**Goals:**
- 100% coverage: no portfolio mutation occurs without an audit log entry
- Cascade rollback: "revert to before this change" undoes that entry and everything after it
- Premium visual feedback: glassmorphic UI, color-coded diffs, micro-animations
- Mobile-first responsive design

**Constraints:**
- Financial data is critical — audit trail is permanent (no TTL)
- Manual edits and rollbacks must not conflict — chronological order is sacred
- Must work within DynamoDB single-table design and existing HOUSEHOLD# isolation

## 2. Decisions

**[D1] PK Pattern:** `HOUSEHOLD#{householdId}` — matches every other entity in the codebase. The original draft used `PROFILE#` which doesn't exist in the data model.

**[D2] SK Pattern:** `AUDIT_LOG#{ISO timestamp}#{uuid}` — uuid suffix prevents millisecond collisions.

**[D3] Scope:** Universal — PDF imports AND manual edits (create, update, delete). Eliminates the risk of a rollback conflicting with an untracked manual change.

**[D4] Rollback Model:** Cascade rollback. Selecting "Revert to before this change" on entry N automatically reverses entries N through latest in reverse chronological order. Each reversal generates its own audit log entry.

**[D5] Retention:** Permanent. No TTL.

**[D6] Approach:** Inline audit calls in existing routes (Approach A). The codebase has only two mutation paths — the added complexity of a DynamoDB middleware wrapper or event queue is not justified.

**[D7] No toast library dependency.** Custom glassmorphic toast component to match the app's aesthetic.

## 3. Data Model

### Audit Log Entity

| Field | Type | Description |
|-------|------|-------------|
| PK | string | `HOUSEHOLD#{householdId}` |
| SK | string | `AUDIT_LOG#{ISO timestamp}#{uuid}` |
| type | string | `"AUDIT_LOG"` (constant) |
| source | enum | `"PDF_IMPORT"` \| `"MANUAL_EDIT"` \| `"ROLLBACK"` |
| metadata | string | Filename for PDF, ticker for manual edit, target SK for rollback |
| mutations | array | Array of Mutation objects (see below) |
| createdAt | string | ISO timestamp |

### Mutation Object Shape

```ts
interface AuditMutation {
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  ticker: string;
  assetSK: string;                    // e.g. "ASSET#uuid" — needed for rollback
  before: AssetSnapshot | null;       // null for CREATE
  after: AssetSnapshot | null;        // null for DELETE
}

interface AssetSnapshot {
  quantity: number;
  marketValue: number;
  bookCost: number;
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
  liveTickerPrice: number;
  profitLoss: number;
  importSource: string;
  createdAt: string;
  updatedAt: string;
}
```

The snapshot captures all mutable asset fields (including timestamps) so rollback can restore complete state.

**Implementation notes:**
- **DynamoDB 400KB item limit:** A single audit log entry stores full before/after snapshots for every affected asset. For very large PDF imports (100+ assets), the mutations array could approach DynamoDB's 400KB item size limit. If this becomes an issue, split into multiple audit log entries with a shared batch ID. For typical household portfolios (< 50 assets), this is well within limits.
- **Concurrency:** If two household members trigger rollbacks simultaneously, interleaved writes could produce inconsistent state. This is low risk for a personal finance app but worth noting. A conditional write guard (checking no new audit entries appeared since the query) can be added if needed.

## 4. Backend Components

### 4.1 Audit Log Writer — `src/lib/auditLog.ts` (NEW)

Exports:

```ts
insertAuditLog(
  householdId: string,
  source: 'PDF_IMPORT' | 'MANUAL_EDIT' | 'ROLLBACK',
  mutations: AuditMutation[],
  metadata?: string
): Promise<string>  // returns the generated SK
```

- Builds the entity from the schema above
- `PutCommand` to `InvestmentAdvisorData` table
- Returns the SK for downstream reference

### 4.2 PDF Import Route Restructuring — `src/app/api/portfolio-pdf/route.ts` (MODIFY)

The current code mixes PutRequests and DeleteRequests in a flat array with no operation classification. This will be restructured to:

1. **Classify operations explicitly during the loop:**
   - If `existing` found → `UPDATE`, capture before (existing state) and after (new values)
   - If `existing` not found → `CREATE`, capture after only
2. **Classify deletions explicitly:**
   - Assets belonging to the account that are no longer in the PDF → `DELETE`, capture before only
3. **Build `writeRequests` and `mutations` arrays in a single pass**
4. **Add `UnprocessedItems` retry logic** to `BatchWriteCommand` — the current code silently drops throttled items
5. **Write audit log only after ALL chunks succeed** — prevents phantom logs for partial imports
6. **Return classified mutations in the response** — needed by the frontend for row highlighting

### 4.3 Manual Edit Routes — `src/app/api/assets/[id]/route.ts` and `src/app/api/assets/route.ts` (MODIFY)

**PUT (update):**
- Fetch current asset state with `GetCommand` before writing
- Diff current vs. incoming values
- After `PutCommand` succeeds, call `insertAuditLog(householdId, 'MANUAL_EDIT', [mutation], ticker)`

**DELETE:**
- Fetch current asset state before deletion
- After `DeleteCommand` succeeds, call `insertAuditLog(householdId, 'MANUAL_EDIT', [{ action: 'DELETE', before, after: null }], ticker)`

**POST (create):**
- After `PutCommand` succeeds, call `insertAuditLog(householdId, 'MANUAL_EDIT', [{ action: 'CREATE', before: null, after }], ticker)`

### 4.4 Audit Logs Fetch — `src/app/api/audit-logs/route.ts` (NEW)

GET endpoint for the Time Machine UI.

- Query: `PK = HOUSEHOLD#{householdId}`, `begins_with(SK, 'AUDIT_LOG#')`
- `ScanIndexForward: false` (newest first)
- Cursor-based pagination: `limit` (default 50) and `lastKey` query params
- Returns `{ logs: AuditLog[], lastKey?: string }`

### 4.5 Rollback Endpoint — `src/app/api/portfolio-rollback/route.ts` (NEW)

POST with `{ auditLogSK: string }`.

**Cascade logic:**

1. Query all `AUDIT_LOG#` entries for the household, sorted descending
2. Collect all entries from most recent down to and including the target `auditLogSK`
3. Process in reverse chronological order (newest first), inverting each mutation:
   - `CREATE` → `DeleteCommand` using stored `assetSK`
   - `DELETE` → `PutCommand` recreating from `before` snapshot
   - `UPDATE` → `PutCommand` overwriting with `before` values
4. For each reversed entry, insert a new `ROLLBACK` audit log
5. Return summary of all changes made

**Edge cases:**

- Rolling back a rollback: works naturally — rollback entries have standard CREATE/UPDATE/DELETE mutations
- Asset missing when UPDATE-reverting: treat as CREATE (deleted by later operation being cascaded)
- Asset exists when CREATE-reverting: treat as DELETE (defensive guard)

**Error handling:**

- If any DynamoDB operation fails mid-cascade, stop processing, return partial-rollback error with details of what was and wasn't reversed
- Audit entries for completed reversals remain intact

## 5. Frontend Components

### 5.1 Audit Toast — `src/components/AuditToast.tsx` (NEW)

Custom glassmorphic toast notification (no external library).

- **Styling:** backdrop-blur, semi-transparent background, subtle border glow
- **Animation:** Slides in from bottom-right with CSS spring keyframes
- **Content:** "Asset updated. Exact snapshot secured in Audit Trail."
- **Action:** [View in Time Machine] button → navigates to `/audit`
- **Behavior:** Auto-dismisses after ~5 seconds, supports stacking for rapid edits

### 5.2 Row Highlight Animations — in `DashboardClient.tsx` (MODIFY)

**After manual edit succeeds:**
- Set transient `auditConfirmedId` state on the edited row
- CSS animation: neon-green radial pulse expanding outward, fading into a shield/check icon (~2 seconds)

**After PDF import succeeds (enhanced response):**

The API response includes classified mutations. The dashboard sets a transient `highlightedMutations` state:

- **Created rows:** Neon-green left border + soft green glow, fades over ~4 seconds
- **Updated rows:** Amber/gold left border + subtle pulse, fades over ~4 seconds
- **Deleted rows (ghost rows):** Temporarily re-rendered as phantom rows with a red strikethrough animation that fades out. The deleted asset data comes from the API response's mutation `before` snapshots. Ghost rows are merged into the asset list transiently and removed after animation completes.

### 5.3 Time Machine Page — `src/app/audit/page.tsx` (NEW)

Full page accessible from sidebar navigation and toast quick-links.

**Desktop layout (>= 768px):**

- Left side: vertical git-style glowing timeline with nodes
- Right side: expanded diff card for the selected node

**Mobile layout (< 768px):**

- Single-column stack with the vertical timeline line preserved
- Tapping a node expands the diff card inline below it (accordion-style)
- Diff values stack vertically (ticker, then before → after)
- Rollback button goes full-width at bottom of expanded card (min 48px tap target)

**Timeline nodes:**

- Styled by source type:
  - PDF_IMPORT: document icon, blue accent
  - MANUAL_EDIT: pencil icon, green accent
  - ROLLBACK: rewind icon, amber accent
- Display: source label, relative timestamp ("2 hours ago" with absolute on hover), brief summary ("PDF Import — 6 assets affected")

**Expanded diff card:**

- Frosted-glass card with slide-in animation
- Color-coded mutations:
  - CREATE: green `+` prefix, shows `after` values
  - DELETE: red `-` prefix, shows `before` values
  - UPDATE: `before` in red, `after` in green (inline diff)
- Fields shown: ticker, quantity, marketValue, bookCost, plus any other fields that changed

**Rollback interaction:**

- "Revert to before this change" button on each non-ROLLBACK node
- Hover: pulsing border glow
- Click: confirmation dialog — "This will undo this change and all X changes after it. Continue?"
- On confirm: full-screen rewind animation (reverse-spinning icon + overlay flash), then timeline refreshes with new ROLLBACK entries
- On error: red toast with error details

**Empty state:** Centered message — "No changes recorded yet. Import a PDF or edit an asset to start building your audit trail."

**Dark/light mode:** Glassmorphic styling uses CSS variables / Tailwind `dark:` variants. Backdrop-blur works across modern browsers.

## 6. Navigation Integration

- Add "Time Machine" entry to the sidebar navigation in `Sidebar.tsx`
- Route: `/audit`
- Icon: clock/rewind icon with the same accent styling as other nav items

## 7. Verification Plan

| Test | Action | Expected Result |
|------|--------|-----------------|
| Manual edit audit | Edit XQQ from 230 to 250 shares | 1x MANUAL_EDIT log with before: 230, after: 250. Row pulse + toast on dashboard. |
| Manual create audit | Add new ticker AAPL | 1x MANUAL_EDIT log with action: CREATE, before: null. Row pulse + toast. |
| Manual delete audit | Delete FIE | 1x MANUAL_EDIT log with action: DELETE, after: null. Toast confirmation. |
| PDF import audit | Upload February_2026.pdf | 1x PDF_IMPORT log with all CREATE/UPDATE/DELETE mutations. Dashboard shows highlighted rows + ghost rows for deletions. |
| Cascade rollback | Click rollback on PDF import (with 2 manual edits after it) | Manual edits reversed first (newest to oldest), then PDF import reversed. 3x ROLLBACK log entries created. Assets restored to pre-import state. |
| Rollback a rollback | Click rollback on a ROLLBACK entry | The rollback itself is reversed, re-applying the original changes. |
| Time Machine display | Open /audit page | Timeline shows all entries newest-first. Clicking a node shows diff card. Mobile layout stacks correctly. |
| Empty state | New user with no mutations | Empty state message displayed. |
| Pagination | User with 60+ audit entries | First page shows 50, "Load more" fetches next batch. |
