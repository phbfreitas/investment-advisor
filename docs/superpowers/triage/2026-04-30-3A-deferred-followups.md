# 3A Deferred Follow-Ups — 2026-04-30

Four 3A scope gaps surfaced during the 5G adversarial-review cycle (4 passes of `/codex:adversarial-review` between 5G implementation and deploy). None were introduced by 5G; all pre-date this sprint. Filed here for a future hardening pass of 3A's user-override / lock / lookup infrastructure.

## Item 1 — Edit-mode lock changes save through unconditional PUT

**Severity:** HIGH (correctness — silent data loss under concurrent edit)
**Surfaced by:** `/codex:adversarial-review` round #2, finding 1
**Originating commit:** `3d13b0e fix(unlock): narrow PATCH endpoint with optimistic concurrency for lock toggle`

### Summary

3A added optimistic concurrency to the **inline lock-icon tap** path via the new `PATCH /api/assets/[id]/lock` endpoint. The optimistic-concurrency check is enforced server-side via DDB `ConditionExpression` on `expectedUpdatedAt`.

The **edit-mode save** path (open edit form → toggle locks via `handleUnlockEditMode` → click Save → full asset PUT to `/api/assets/[id]`) does NOT use the same protection. `saveEdit` sends the entire asset via plain `PUT` and the server merges/overwrites without any `updatedAt` / condition check.

### Failure mode

Two-tab or phone+laptop scenario:
1. Tab A opens edit mode.
2. Tab B updates the asset (refresh applies a new live price; or another lock toggle; or a PDF re-import lands).
3. Tab A's user clicks Save.
4. Tab A's PUT silently clobbers tab B's newer fields and lock map.

The PO uses both phone and laptop, so multi-device concurrent editing is plausible. Even single-device: the auto-refresh updates `liveTickerPrice` in background while edit mode is open; on save, the open form's stale `liveTickerPrice` overwrites the just-refreshed value. (For `liveTickerPrice` this is self-healing on the next refresh, but for `userOverrides` it isn't.)

### Recommended fix shape

Either:
- **Extend optimistic concurrency to full asset PUT.** Server-side: `/api/assets/[id]` PUT requires `expectedUpdatedAt` from the client and uses DDB `ConditionExpression` to reject stale writes with 409. Client-side: `saveEdit` reads `editForm.updatedAt` (snapshot from when edit started), passes it as `expectedUpdatedAt` in the body, surfaces a "your data is stale, please refresh" prompt on 409.
- **Or route lock-state changes through the narrow PATCH endpoint even while editing.** Edit-mode toggles call `/api/assets/[id]/lock` for lock changes only; the rest of the form continues through the broad PUT (unprotected). Less defensive but smaller surface.

Effort estimate: 3-4 hours including server changes, client UI for conflict, and tests.

### Why deferred

- Pre-existing in `main` since 3A merged. Not introduced by 5G.
- Fix scope is non-trivial.
- 5G's adversarial cycle focused on the new 5G work; shoehorning a 3A hardening task into the deploy gate would have ballooned scope.

## Item 2 — EncryptedDocumentClient advertises UpdateCommand support but bypasses encryption

**Severity:** HIGH (data-protection regression with hard-to-detect failure mode)
**Surfaced by:** `/codex:adversarial-review` round #3, finding 1
**Originating commit:** `3d13b0e fix(unlock): narrow PATCH endpoint with optimistic concurrency for lock toggle`

### Summary

The `EncryptedDocumentClient` wrapper at `src/lib/encryption/encrypted-client.ts` transparently encrypts/decrypts classified asset fields (`liveTickerPrice`, `bookCost`, `marketValue`, `managementFee`, `accountNumber`, etc.) for `Put`, `BatchWrite`, `Get`, `Query`, and `Scan` operations.

Commit `3d13b0e` added `UpdateCommand` to the `AnyCommand` type union to support the new lock PATCH endpoint, **but did not add a corresponding handler in `send()`**. `UpdateCommand` falls through to `raw.send()`, bypassing encryption entirely.

### Current state

Today this isn't actively leaking data:
- The lock PATCH only updates `userOverrides`, which is NOT in the classified-fields list.
- The route doesn't return the full asset back, so unencrypted classified fields aren't exposed in responses.

### Forward-looking risk

The type signature now advertises Update support to anyone reading the wrapper. Future code that uses `UpdateCommand` to modify any classified field (e.g., a partial update that touches `liveTickerPrice` for performance reasons) will write **plaintext** into rows the rest of the system treats as envelope-encrypted. The mismatch will be silent until something tries to decrypt the row and fails — possibly weeks or months after the offending code lands.

`ReturnValues: "ALL_NEW"` on an UpdateCommand is also unsafe: returned attributes are not decrypted before the caller sees them.

### Recommended fix shape

Either:
- **Implement explicit UpdateCommand handling.** Encrypt classified values referenced in `UpdateExpression`/`ExpressionAttributeValues` before sending; decrypt classified fields in `Attributes` (from `ReturnValues`) on response. Mirror the existing PutCommand handler's classification logic.
- **Or reject UpdateCommand outright.** Throw a typed error in `send()` when the input is an `UpdateCommand`. Forces callers to use Put (which already encrypts) and surfaces the encryption gap at call site instead of hiding it.

The first option preserves Update functionality but requires careful classification handling for both expression values and returned attributes. The second is simpler and matches the existing single-command codepath defensively.

Effort estimate: 4-6 hours for option 1 (full Update support + tests). 1-2 hours for option 2 (rejection + migrating the lock PATCH to use Put if needed).

### Why deferred

- Pre-existing in `main` since 3A merged. Not introduced by 5G.
- 5G's commits never use `UpdateCommand` directly (PutCommand with `attribute_not_exists` ConditionExpression is what we use for the price-anomaly-log writer).
- No active data leak today; the risk is forward-looking.

## Item 3 — Ticker lookup carries previous symbol's data into the new symbol

**Severity:** HIGH (silent cross-ticker data corruption that survives commit)
**Surfaced by:** `/codex:adversarial-review` round #4, finding 1
**Originating commit:** `878f899 fix(dashboard): preserve manually-entered live-data values on silent lookups`

### Summary

`applyLookupRespectingLocks` (at `src/app/dashboard/lib/applyLookupRespectingLocks.ts`) now falls back to the PREVIOUS asset's values for live-lookup fields whenever the new ticker lookup returns null/undefined. The `?? prevAsset.field` fallback was intended to protect manually-entered values from being clobbered by silent refreshes, but it conflates "user manually entered this" with "previous lookup left a value."

When the user changes a ticker on an existing asset, the new lookup legitimately omits fields that don't apply (`oneYearReturn` and `threeYearReturn` are `null` for non-fund tickers, etc.). The current code falls back to the OLD ticker's values, producing a silently corrupt asset.

### Failure mode

1. User has Asset X with ticker `AAPL`: `oneYearReturn: 0.15`, `threeYearReturn: 0.50`, `beta: 1.2`, `analystConsensus: "Buy"`, `exDividendDate: "2026-02-09"`.
2. User edits the ticker to `SHOP`. `handleTickerLookup("SHOP")` calls `researchTicker`, which returns SHOP's partial data: `currentPrice: 90, oneYearReturn: null, threeYearReturn: null, beta: null, analystConsensus: null, exDividendDate: ""`.
3. `applyLookupRespectingLocks` runs. For each missing field, falls back to AAPL's value.
4. Form now displays: ticker=`SHOP`, but `oneYearReturn: 0.15`, `threeYearReturn: 0.50`, `beta: 1.2`, `analystConsensus: "Buy"`, `exDividendDate: "2026-02-09"` — all carried over from AAPL.
5. User clicks Save. Asset persists with ticker=`SHOP` and AAPL's metadata. Silent corruption survives commit.

### Recommended fix shape

Track ticker identity through the lookup. When `lookup.symbol !== prevAsset.ticker` (i.e., the user changed the symbol), clear lookup-derived fields that the new lookup didn't supply — set them to `null` / `""` rather than falling back to the previous symbol's values.

A cleaner design: distinguish "field the user manually entered" (already tracked via `userOverrides` for the 8 lockable fields) from "field carried from previous lookup" (which should never survive a symbol change). For the lookup-derived fields not in the lockable set (`oneYearReturn`, `threeYearReturn`, `beta`, `analystConsensus`, `externalRating`, `exDividendDate`, `currentPrice`, `dividendYield`), the rule should be: take the new lookup's value verbatim; null is null.

For the lockable 8 (`sector`, `market`, `securityType`, `strategyType`, `call`, `managementStyle`, `currency`, `managementFee`): keep the existing lock-respecting behavior — if the user has locked the field, preserve their value; otherwise take the new lookup's value.

Effort estimate: 1-2 hours including unit tests for the cross-ticker scenario.

### Why deferred

- Pre-existing in `main` since `878f899`. Not introduced by 5G.
- 5G's commits never touch `applyLookupRespectingLocks.ts` or `handleTickerLookup`.
- The fix requires careful reasoning about lock semantics and field classification, which is 3A territory.

## Item 4 — Lock toggle PATCH returns 500 after the write already committed

**Severity:** MEDIUM (UX confusion, audit-log consistency gap, retry-on-success risk)
**Surfaced by:** `/codex:adversarial-review` round #4, finding 2
**Originating commit:** `3d13b0e fix(unlock): narrow PATCH endpoint with optimistic concurrency for lock toggle`

### Summary

The new `PATCH /api/assets/[id]/lock` route does three things in sequence: (1) `UpdateCommand` to flip the lock bit, (2) `GetCommand` to refetch the updated asset, (3) `insertAuditLog` to write an audit entry. Steps 2 and 3 happen AFTER step 1 commits, but they share the route's outer try/catch.

If step 2 or step 3 fails, the route returns 500 even though step 1 already committed. From the user's perspective, the lock toggle "failed" — but the lock state actually changed in DDB.

### Failure mode

- DDB outage on the GetCommand → 500 returned, lock state already changed, user retries the toggle, second toggle reverses the actual change.
- Audit log table at scale-limit / permission regression → 500 returned, lock state changed but audit history missing the corresponding entry. Audit/state consistency lost.
- User sees "lock toggle failed," tries it again, ends up with the lock state opposite to what they wanted.

### Recommended fix shape

Two reasonable options:

- **Decouple audit from user-visible result.** Catch errors from steps 2 and 3 separately. Log them server-side (CloudWatch + alerting) but return success to the client once step 1 commits. The audit-log gap is a real operational concern but should be visible to operators, not falsely surfaced to users as a mutation failure.
- **Use a DDB transaction or outbox pattern.** Wrap steps 1 + 3 in a `TransactWriteCommand` (DDB supports up to 100 items per transaction including audit-log writes) so either both commit or neither does. Step 2 (refetch) is informational and can stay best-effort. This eliminates the "state changed but audit missed it" inconsistency.

Effort estimate: 1 hour for option 1 (decoupling). 2-3 hours for option 2 (transactional path + tests).

### Why deferred

- Pre-existing in `main` since `3d13b0e`. Not introduced by 5G.
- The lock PATCH is the only consumer affected; the broader edit-mode PUT path (Item 1) doesn't have this issue because it doesn't write to audit-log on the same hot path.

## Recommendation

All four items should land in a dedicated 3A hardening sprint. Priority order:

1. **Item 3 (ticker lookup carryover)** — HIGH severity, smallest fix, eliminates silent data corruption on a path the PO might use.
2. **Item 1 (edit-mode PUT concurrency)** — HIGH severity, matters when 3A's lock infrastructure is next extended.
3. **Item 2 (encrypted UpdateCommand)** — HIGH severity but currently no active leak; matters before any future code adds partial updates on classified fields.
4. **Item 4 (lock PATCH 500-after-commit)** — MEDIUM severity, smallest UX win.

For Item 2, a cheap interim mitigation: add a runtime check in `EncryptedDocumentClient.send()` that throws if the command is `UpdateCommand`, until proper encryption support is added. That way the type union still says "Update is supported" but the runtime forces engineers to handle the gap explicitly.

## Cross-references

- 5G spec: `docs/superpowers/specs/2026-04-29-live-price-sanity-gate-design.md`
- 5G plan: `docs/superpowers/plans/2026-04-29-live-price-sanity-gate.md`
- 3A spec: `docs/superpowers/specs/2026-04-29-currency-and-override-protection-design.md`
- 3A plan: `docs/superpowers/plans/2026-04-29-currency-and-override-protection.md`
