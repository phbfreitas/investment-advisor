# 3A Deferred Follow-Ups — 2026-04-30

Two 3A scope gaps surfaced during the 5G adversarial-review cycle (3 passes of `/codex:adversarial-review` between 5G implementation and deploy). Neither was introduced by 5G; both pre-date this sprint. Filed here for future hardening of 3A's user-override / lock infrastructure.

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

## Recommendation

Both items should land **before any future code uses `UpdateCommand` on the asset PK** — especially before adding any partial-update endpoints. If 3A's lock infrastructure is going to be extended (e.g., a "lock all fields at once" bulk action, or a per-account lock policy), Item 1 needs to land first.

For Item 2, a cheap interim mitigation: add a runtime check in `EncryptedDocumentClient.send()` that throws if the command is `UpdateCommand`, until proper encryption support is added. That way the type union still says "Update is supported" but the runtime forces engineers to handle the gap explicitly.

## Cross-references

- 5G spec: `docs/superpowers/specs/2026-04-29-live-price-sanity-gate-design.md`
- 5G plan: `docs/superpowers/plans/2026-04-29-live-price-sanity-gate.md`
- 3A spec: `docs/superpowers/specs/2026-04-29-currency-and-override-protection-design.md`
- 3A plan: `docs/superpowers/plans/2026-04-29-currency-and-override-protection.md`
