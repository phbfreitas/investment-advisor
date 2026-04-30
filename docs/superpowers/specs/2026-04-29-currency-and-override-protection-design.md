# Currency Overwrite + Manual-Override Protection — Design Spec

**Date:** 2026-04-29
**Source triage:** [docs/superpowers/triage/2026-04-27-po-feedback-triage.md](../triage/2026-04-27-po-feedback-triage.md)
**Scope:** Phase 3, sub-project 3A — PO feedback items 1.3 + 1.4
**Decision baseline:** Triage report and prior brainstorming. Design choices captured in this doc.

## Goal

Stop the system from silently overwriting two kinds of user intent:

1. **Per-row currency in PDF imports** — a TFSA statement with both CAD and USD holdings currently imports everything as the document-level default. Each holding line should be tagged with its own currency.
2. **Manual classification overrides** — when the PO sets sector="Diversified" or call="Yes" by hand, every Yahoo lookup, enrichment pass, and PDF re-import currently overwrites her value. The system should track which fields she set deliberately and respect them on every write path.

Both pair around write-path attribution: trust the more specific, more recent intent over the more general, automatically-discovered value.

## Non-Goals

- **Locks on live market data** (yield, returns, price, beta, exDividendDate, analystConsensus, externalRating, riskFlag) — these are meant to refresh continuously. Locking them defeats the point of refresh.
- **Locks on computed values** (`marketValue`, `profitLoss`, `expectedAnnualDividends`) — derived from other fields; not user-set intent.
- **Bulk lock/unlock UI** (e.g., "lock all sectors at once"). Single-row toggle covers the PO's stated need.
- **Audit/history of lock changes** — the audit-trail system already tracks all asset mutations including the new `userOverrides` field.
- **Server-driven detection of "user-typed" vs. "tool-populated"** — detection happens client-side via per-onChange flagging.
- **Migration of existing assets** — `userOverrides` is optional; existing rows have it `undefined` (= unlocked) and need no backfill.

## Design

### 1. Lockable Fields

Eight fields are subject to user override locks. Two groups:

| Group | Fields | Why |
|---|---|---|
| Classification | `sector`, `market`, `securityType`, `strategyType`, `call`, `managementStyle` | The PO's deliberate categorical choices. Yahoo's auto-classification can be wrong (e.g., "ecnquote" leaking through, sector mis-mapping). |
| Metadata | `currency`, `managementFee` | Per-row currency: PO's manual fix when the parser tags wrong. Mgmt fee: one-shot manual entry from a fund prospectus that Yahoo may not have. |

Live data fields (yield, returns, prices, etc.) and computed values (marketValue, etc.) are **not** lockable.

### 2. Lock Semantics

**Implicit lock + visible indicator + explicit unlock (Hybrid model).**

| Trigger | Effect |
|---|---|
| User edits any of the 8 fields in the inline form | Sets `userOverrides[field] = true` |
| User clicks the lock icon on a locked field | Sets `userOverrides[field] = false` (or removes the key) |
| User clears a field to empty / "Not Found" | Stays locked at the new (empty) value — same rule as any other edit |
| `handleTickerLookup` runs | Skips writing any field where `userOverrides?.[field] === true` |
| PDF re-import (currency only) | Skips the `currency` field if locked |
| Bulk Yahoo enrichment | Skips locked fields |

**Universal lock semantics:** every write path respects the lock. There are no exceptions like "imports always win." A locked field is only changed by a direct user edit or by an explicit unlock + subsequent lookup.

### 3. Data Model

Add an optional field to the `Asset` type in `src/types/index.ts`:

```typescript
export type LockableField =
  | "sector" | "market" | "securityType" | "strategyType"
  | "call" | "managementStyle" | "currency" | "managementFee";

export interface Asset {
  // ... existing fields
  userOverrides?: Partial<Record<LockableField, boolean>>;
}
```

**Storage:** A simple map of field-name → `true`. The map is `undefined` for assets with no overrides; individual keys are `undefined` (or `false`) for unlocked fields. `Partial<Record<…, boolean>>` lets TypeScript prevent typos at call sites.

**Encryption:** `userOverrides` is **not** added to the `ASSET#` `encryptedFields` array in `src/lib/encryption/field-classification.ts`. The map contains booleans for which fields the user has locked — purely metadata, no financial data, no PII. Consistent with how `sector` and `market` themselves are unencrypted today.

**Migration:** None required. Existing assets have no `userOverrides` key; reads against `asset.userOverrides?.sector` return `undefined` (falsy = unlocked). The first time a user edits a locked field, the key is added by the regular asset PATCH path.

### 4. Detection — Per-onChange Flagging

Each of the 8 lockable fields has a user-facing onChange handler in `DashboardClient.tsx` (and any other inline edit form). Each handler is updated to additionally flag the override:

```typescript
onChange={e => setEditForm(prev => ({
  ...prev,
  sector: e.target.value,
  userOverrides: { ...prev.userOverrides, sector: true },
}))}
```

A helper collapses the boilerplate:

```typescript
const setFieldWithLock = <F extends LockableField>(field: F, value: Asset[F]) =>
  setEditForm(prev => ({
    ...prev,
    [field]: value,
    userOverrides: { ...prev.userOverrides, [field]: true },
  }));
```

`handleTickerLookup` and any other programmatic write path **never** touch `userOverrides`.

### 5. Lock-Respecting Writes

Three write paths need a lock guard:

| Path | File (current location) | Change |
|---|---|---|
| Inline ticker lookup (`handleTickerLookup`) | `src/app/dashboard/DashboardClient.tsx:343` | For each of the 8 lockable fields, replace `data.X \|\| prev.X` with `prev.userOverrides?.X ? prev.X : (data.X \|\| prev.X)` (or extract a small `applyLookupRespectingLocks` helper). |
| PDF re-import upsert (currency only) | `src/app/api/portfolio-pdf/route.ts` | When updating an existing holding's currency, skip if `existingAsset.userOverrides?.currency === true`. |
| Bulk Yahoo enrichment | Located during implementation — grep for callers of `tickerResearch` / `enrichAsset` / similar. Likely lives under `src/app/api/portfolio-enrich/` or `src/lib/enrichment/`. | Same field-by-field guard as the inline lookup. |

The implementation plan will identify and audit all currently-existing write paths to the 8 lockable fields, not just the three above.

### 6. Lock Icon UI

- **Icon:** `Lock` from lucide-react, 12px size.
- **Color:** muted neutral (`text-neutral-400 dark:text-neutral-500`) in display mode; teal-tinted in edit mode (`text-teal-500`) to signal "this state was just set".
- **Placement:** inline-left of the cell value, with a 4px gap. Layout: `<span class="inline-flex items-center gap-1"><Lock /><CellValue /></span>`.
- **Visibility:** rendered only when `asset.userOverrides?.[field] === true`. No icon = no chrome.
- **Tap target:** padded to 24×24 (mobile-first project convention); the icon itself stays 12px visually.
- **Display mode:** clicking the icon toggles the lock immediately (PATCH the asset). **No confirmation dialog** — confirmed by PO. A single tap is enough; an accidental unlock is recoverable by tapping the field to lock again, so the friction of a confirmation prompt isn't justified.
- **Edit mode:** clicking the icon toggles the lock in `editForm` state; saved on form submit.
- **Accessibility:** `aria-label="Field locked — click to unlock"`. `title` attribute matches for hover tooltip.

### 7. Per-Row Currency Detection (Item 1.4)

Replace the document-level detection at `src/app/api/portfolio-pdf/route.ts:69`:

```typescript
const currency = /CAD|Canadian/i.test(text) ? "CAD" : "USD";
```

with a data-driven, per-row resolver. Strategy: **section header → inline token → document default**.

#### Currency configuration table

Define a list of supported currencies with their detection patterns. Ships with USD and CAD entries (Simone's only use case today); adding more is a one-line append:

```typescript
type CurrencyConfig = {
  code: "USD" | "CAD" | "EUR" | "GBP" | "BRL"; // extend as needed
  sectionRegex: RegExp;
  inlineToken: RegExp;
  documentRegex: RegExp; // for the document-level fallback
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
```

Per the PO, only USD and CAD are needed today. The list shape is forward-compatible: adding EUR/GBP/BRL would be a single new entry, and they're already in the Phase 2 currency allowlist.

#### Resolver logic

Inside `parseHoldings`:

1. Compute `documentDefault` by matching each config's `documentRegex` against the full text. First match wins; default to USD if none match (matches today's behavior).
2. Track `sectionCurrency: CurrencyCode | null`, initial value `null`. While iterating lines, if a line matches any config's `sectionRegex`, set `sectionCurrency` to that config's `code`. (Headers are sticky: the section currency stays in effect until another header overrides it.)
3. For each successfully parsed holding line, compute `rowCurrency` in this order:
   - **Inline token first:** check each config's `inlineToken` against the line. If exactly one matches, use it. (Inline beats section so a single misplaced row in a "CAD section" can correctly self-identify as USD.)
   - **Section second:** if no unique inline match, use `sectionCurrency` if non-null.
   - **Document default last:** otherwise use `documentDefault`.
4. Each `holdings.push(...)` uses the resolved `rowCurrency` instead of the document-level value.

The state machine and the config list are local to `parseHoldings` — no new module. Extending to new currencies in the future means adding a row to `CURRENCY_CONFIGS`.

### 8. Files Affected

- `src/types/index.ts` — add `LockableField` type and `userOverrides` field on `Asset`.
- `src/app/dashboard/DashboardClient.tsx` — `setFieldWithLock` helper, onChange wiring on the 8 fields, lock guard in `handleTickerLookup`, lock icon rendering in display + edit modes.
- `src/app/api/portfolio-pdf/route.ts` — per-row currency state machine in `parseHoldings`; lock guard for `currency` on re-import upsert.
- Bulk Yahoo enrichment route (location TBD during implementation) — lock guards for the 8 fields.
- `src/app/dashboard/__tests__/...` — new tests for the helpers and integration paths.
- `src/app/api/portfolio-pdf/__tests__/...` — new tests for the per-row currency parser.

No changes to:
- `src/lib/encryption/field-classification.ts` (`userOverrides` is metadata, not encrypted).
- DynamoDB single-table key schema (no new SK prefix; `userOverrides` is just a new attribute on existing `ASSET#…` items).

## Testing Strategy

### Unit tests (Jest)

**Per-row currency parser** (`src/app/api/portfolio-pdf/__tests__/parseHoldings-currency.test.ts`):
- Section header above two holdings → both rows tagged with section currency.
- Inline `USD` token on one row, no section header → that row tagged USD, others fall back to document default.
- Mixed: section header for one block, inline token in a row, no marker in another row → each gets its appropriate value via precedence.
- No markers anywhere → all rows tagged with document default (existing behavior).
- Fixture: a synthetic TFSA-like text mirroring the PO's screenshot (CAD section + USD section).

**Lock-respecting helpers** (likely a new pure helper extracted from `handleTickerLookup`, e.g., `applyLookupRespectingLocks`):
- Returns `prev.X` when `userOverrides.X === true`, regardless of what `data.X` says.
- Returns `data.X` (or `prev.X` fallback) when `userOverrides.X` is undefined/false.
- `userOverrides` map itself is never written by the helper.

### Integration tests (React Testing Library)

In a new `DashboardClient.test.tsx` or extension of existing tests:

- Editing the sector dropdown sets `userOverrides.sector = true` in `editForm`.
- After save, the saved Asset has `userOverrides.sector = true`.
- A subsequent ticker lookup does NOT change the locked sector but DOES update an unlocked field (e.g., yield).
- Clicking the lock icon (in display mode) flips the override flag and persists.
- Clicking the lock icon (in edit mode) updates `editForm` only; persists on submit.
- Lock icon is NOT rendered when `userOverrides?.[field]` is undefined or false.
- Lock icon IS rendered when `userOverrides?.[field] === true`.

### Manual verification (mobile-first per project memory)

- Mixed-currency PDF re-import: the PO's TFSA statement should now produce both CAD and USD rows.
- Set a sector override, run a refresh — sector unchanged, lock icon visible.
- Click the lock icon, run a refresh — sector updated to Yahoo's value.
- Phone view (375px): lock icon visible without breaking row layout.
- Tablet (768px) and desktop (1440px): same.
- Theme parity: light + dark.

## Acceptance

- A re-import of a mixed CAD+USD brokerage PDF produces rows with the correct per-row currency.
- Setting `sector` (or any of the other 7 lockable fields) by hand produces a visible lock icon and survives a subsequent ticker lookup, bulk enrichment, and PDF re-import.
- The lock icon is clickable in both display and edit modes; clicking it toggles the lock and persists.
- All Jest tests pass; `npx tsc --noEmit` clean; build compiles.
- No migration of existing assets needed.
