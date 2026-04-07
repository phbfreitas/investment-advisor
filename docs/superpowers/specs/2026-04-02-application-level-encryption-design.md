# Application-Level Encryption: "Blind Admin" Design Spec

**Date:** 2026-04-02
**Status:** Approved for Implementation
**Goal:** Secure sensitive financial data against unauthorized database access (including internal admins) while maintaining full AI guidance engine functionality.

---

## Context

As the Investment Advisor platform moves toward commercialization, user trust requires that database administrators cannot read plaintext financial data by querying DynamoDB directly. True Zero-Knowledge encryption is infeasible because the server-side AI engine (Gemini) must decrypt data in memory to assemble prompts. The validated approach is **Application-Level Encryption** — data is encrypted by the app server before reaching DynamoDB, and decrypted in Lambda memory only when needed.

### Why Not Zero-Knowledge?

- The AI guidance engine pulls real-time portfolio, strategy, and finance summaries to build context strings for Gemini dynamically.
- Deep Critique runs 5 parallel analyses matching macro-events against user portfolios.
- Household sharing syncs financial data across connected spouses/planners.
- All of these require the server to read plaintext — the server must retain decryption capability.

---

## Architecture

### Transparent Middleware Layer

A `EncryptedDocumentClient` wraps the existing `DynamoDBDocumentClient` in `src/lib/db.ts`. All application code continues calling `db.send()` unchanged. The middleware intercepts writes (encrypting classified fields) and reads (decrypting them).

```
Application Code (unchanged — 16+ files calling db.send())
    │
    ▼
EncryptedDocumentClient (NEW)
    ├── Field Classification Map — declares which fields per entity type to encrypt
    ├── Key Provider — abstracts KMS, caches DEK in Lambda memory
    └── AES-256-GCM Encrypt/Decrypt Engine
    │
    ▼
DynamoDB (ciphertext in sensitive fields, metadata in plaintext)
```

### Command Interception

| Command Type     | Action                                           |
|------------------|--------------------------------------------------|
| `PutCommand`     | Encrypt classified fields in `Item` before write |
| `BatchWriteCommand` | Encrypt fields in each `PutRequest.Item`      |
| `GetCommand`     | Decrypt classified fields in `response.Item`     |
| `QueryCommand`   | Decrypt fields in each `response.Items[]`        |
| `ScanCommand`    | Decrypt fields in each `response.Items[]`        |
| `DeleteCommand`  | Pass through (no item body)                      |

### Key Management: Global Key (Phase 1)

- A single AWS KMS Customer Master Key (CMK) is provisioned via SST.
- On first deploy, `KMS.GenerateDataKey` creates a 256-bit Data Encryption Key (DEK). The encrypted DEK is stored in DynamoDB as `GLOBAL/ENCRYPTION_KEY`. The plaintext DEK is used for encryption operations.
- On Lambda cold start, the Key Provider reads the encrypted DEK from DynamoDB and calls `KMS.Decrypt` to unwrap it. The plaintext DEK is cached in a module-level variable for the Lambda container lifetime.
- Warm invocations incur zero KMS calls.
- `enableKeyRotation: true` — AWS auto-rotates the CMK annually and retains old versions for decryption.
- If no `GLOBAL/ENCRYPTION_KEY` record exists (first run), the Key Provider calls `GenerateDataKey`, stores the encrypted DEK, and caches the plaintext DEK.

### Future: Envelope Encryption (Phase 2)

The Key Provider interface accepts `householdId` even in Phase 1 (ignored). Phase 2 evolution:
- Each household gets its own DEK, stored encrypted under the CMK in a `HOUSEHOLD#{id}/ENCRYPTION_KEY` record.
- The Key Provider looks up + decrypts the household DEK, caches by householdId.
- Enables **crypto-shredding** — deleting a household's DEK renders their data mathematically unrecoverable.
- No caller or middleware API changes needed — the abstraction hides the key strategy.

---

## Field Classification

**Principle:** Encrypt financial values; leave metadata in plaintext for DynamoDB queryability.

### META (Profile) — `HOUSEHOLD#{id}/META`

**Encrypted:**
- Budget income: `budgetPaycheck`, `budgetRentalIncome`, `budgetDividends`, `budgetBonus`, `budgetOtherIncome`
- Budget expenses: `budgetFixedHome`, `budgetFixedUtilities`, `budgetFixedCar`, `budgetFixedFood`, `budgetDiscretionary`, `budgetRentalExpenses`
- Wealth assets: `wealthAssetCash`, `wealthAssetCar`, `wealthAssetPrimaryResidence`, `wealthAssetRentalProperties`, `wealthAssetOther`
- Wealth liabilities: `wealthLiabilityMortgage`, `wealthLiabilityHeloc`, `wealthLiabilityRentalMortgage`, `wealthLiabilityRentalHeloc`, `wealthLiabilityCreditCards`, `wealthLiabilityCarLease`
- `targetMonthlyDividend`, `goals`

**Plaintext:** strategy, riskTolerance (1-10 scale), assetMix percentages, philosophies, corePrinciples, accountTypes, tradingMethodologies, sectorAllocation, geographicExposure, targetAnnualReturn (%)

### ASSET# (Holdings) — `HOUSEHOLD#{id}/ASSET#{uuid}`

**Encrypted:** quantity, liveTickerPrice, bookCost, marketValue, profitLoss, yield, expectedAnnualDividends, oneYearReturn, threeYearReturn, fiveYearReturn, managementFee, volatility, beta, accountNumber, account

**Plaintext:** ticker, sector, market, currency, securityType, strategyType, accountType, managementStyle, externalRating, risk

### CHAT# (Conversations) — `HOUSEHOLD#{id}/CHAT#{timestamp}`

**Encrypted:** userMessage, responses (entire array serialized as JSON blob)

**Plaintext:** selectedPersonas, ttl, PK, SK

### CHAT_SUMMARY# (Memory) — `HOUSEHOLD#{id}/CHAT_SUMMARY#{personaId}`

**Encrypted:** summary

**Plaintext:** personaId, exchangeCount, lastExchangeTimestamp, formatVersion

### AUDIT_LOG# (Trail) — `HOUSEHOLD#{id}/AUDIT_LOG#{ts}#{uuid}`

**Encrypted:** mutations (entire array with before/after snapshots)

**Plaintext:** source, metadata, createdAt, type

### FINANCE_SUMMARY — `HOUSEHOLD#{id}/FINANCE_SUMMARY`

**Encrypted:** totalIncome, totalExpenses, savingsRate, netWorth, totalAssets, totalLiabilities

### GUIDANCE_CACHE# / RADAR# (Cached AI Output)

**Encrypted:** response, requestSnapshot

**Plaintext:** directive, fingerprint

### Excluded Entities (No Encryption)

- `USER#{email}` — contains only email, householdId, role (no financial data)
- `GLOBAL/NEWS_CACHE#{date}` — public market news shared across all households

### What a "Blind Admin" Sees

An admin querying DynamoDB can see: ticker symbols, sector classifications, account types, timestamps, persona selections, risk tolerance scale.

An admin **cannot** see: dollar amounts, quantities, prices, P/L, account numbers, income, expenses, wealth values, conversation content, AI-generated advice.

---

## Encryption Format

### Algorithm

- **Cipher:** AES-256-GCM (authenticated encryption)
- **IV:** 12 bytes, cryptographically random per encryption
- **Auth Tag:** 16 bytes (128-bit)
- **AAD:** `${PK}|${SK}|${fieldName}` — binds ciphertext to its specific record and field, preventing relocation attacks

### Storage Format

```
ENC:v1:<type>:<base64(IV + ciphertext + authTag)>
```

- `ENC:` — sentinel prefix for migration detection and idempotency
- `v1` — format version (enables future algorithm migration)
- Type tags: `n` (number → parseFloat), `s` (string → as-is), `j` (JSON → JSON.parse)
- The type tag ensures the middleware restores the exact original JavaScript type so application arithmetic (e.g., `marketValue * quantity`) continues working without casts

### Size Overhead

- Numeric field (8 bytes) → ~77 bytes encrypted (~10x, negligible in DynamoDB cost terms)
- Large text field (4000 bytes) → ~5400 bytes (~33% base64 expansion)
- All well within DynamoDB's 400KB item limit

---

## Implementation

### New Files

```
src/lib/encryption/
  crypto.ts                 — AES-256-GCM encrypt/decrypt primitives with type-tagged format
  field-classification.ts   — FIELD_CLASSIFICATIONS config constant
  key-provider.ts           — KeyProvider interface + createKeyProvider() with DEK caching
  encrypted-client.ts       — EncryptedDocumentClient wrapping DynamoDBDocumentClient.send()
  types.ts                  — Shared types (EncryptionVersion, TypeTag, etc.)

scripts/
  migrate-encrypt.ts        — One-time forward migration (scan → encrypt → write back)
  migrate-decrypt.ts        — Rollback migration (decrypt all)
  verify-encryption.ts      — Post-migration verification
```

### Modified Files

| File | Change |
|---|---|
| `src/lib/db.ts` | Wrap raw client with `EncryptedDocumentClient` when `KMS_KEY_ID` env var is set |
| `sst.config.ts` | Add KMS key + alias + Lambda permissions (kms:GenerateDataKey, kms:Decrypt, kms:Encrypt, kms:DescribeKey) |
| `package.json` | Add `@aws-sdk/client-kms` dependency |

### `db.ts` Integration

```typescript
// When KMS_KEY_ID is set (staging/production): encrypt/decrypt transparently
// When KMS_KEY_ID is not set (local dev): bypass encryption entirely
export const db = process.env.KMS_KEY_ID
  ? new EncryptedDocumentClient(rawDb, keyProvider, FIELD_CLASSIFICATIONS)
  : rawDb;
```

### `sst.config.ts` Additions

- Provision `aws.kms.Key` with `enableKeyRotation: true`, `deletionWindowInDays: 30`
- Create `aws.kms.Alias` as `alias/investment-advisor-${stage}`
- Add `KMS_KEY_ID` to Next.js environment variables
- Add KMS permissions scoped to the specific key ARN

### `auth.ts` — No Change

`auth.ts` maintains its own DynamoDB client and only accesses `USER#` entities which contain no financial data. No modification needed. If `USER#` ever gains sensitive fields, refactor to use the shared `db` export.

---

## Migration

### Strategy: Background Migration Script

A one-time `scripts/migrate-encrypt.ts` run at deploy time.

### Algorithm

1. Initialize Key Provider (same KMS key as app)
2. Full table SCAN with pagination
3. For each item:
   - Match SK prefix to field classification
   - Skip if no classification (USER#, GLOBAL entities)
   - For each classified field: skip if already `ENC:` prefixed (idempotent), skip if null/undefined, encrypt otherwise
   - If any fields changed, PutCommand the item back
4. BatchWrite in chunks of 25 with configurable delay to avoid throttling
5. Log progress: items scanned, modified, skipped
6. On error: log failing PK/SK and continue (don't halt migration)

### Deployment Sequence (Zero Downtime)

1. **Deploy infra** — SST provisions KMS key, grants Lambda permissions
2. **Deploy app code** — Middleware handles both plaintext AND ciphertext via `ENC:` prefix detection
3. **Run migration** — `migrate-encrypt.ts` encrypts all existing records
4. **Verify** — `verify-encryption.ts` confirms 100% coverage
5. **Smoke test** — UI, chat, guidance, PDF import all work correctly

The middleware's plaintext fallback ensures zero downtime during the migration window.

### Rollback

`scripts/migrate-decrypt.ts` reverses encryption: scans all items, decrypts `ENC:` values, writes plaintext back. Requires the KMS key to still be accessible.

---

## AI Prompt Integration

Data flows through the encryption layer transparently:

```
DynamoDB (ciphertext) → EncryptedDocumentClient (auto-decrypt) → buildFullUserContext() (plaintext in memory) → Gemini API (HTTPS/TLS) → AI response → EncryptedDocumentClient (auto-encrypt) → DynamoDB (ciphertext)
```

- `buildFullUserContext()` in `src/lib/portfolio-analytics.ts` receives already-decrypted objects. No changes needed.
- The plaintext context string (~2000 words) exists only in Lambda process memory during the request. Never persisted decrypted.
- Chat responses are encrypted when saved via `saveExchange()`.
- Guidance/radar cache responses encrypt both the AI output and the portfolio fingerprint.

### Assumption: LLM Data Retention

This design assumes the Gemini API (or any future LLM provider) operates under a Zero Data Retention / No Training agreement. The application-level encryption protects data at rest in DynamoDB — data in transit to the LLM is protected by HTTPS/TLS and contractual terms. LLM provider data handling is a separate legal/procurement concern.

---

## Trade-offs and Risks

| Decision | Benefit | Cost |
|---|---|---|
| Encrypt entire `responses`/`mutations` arrays as blobs | Simpler middleware, no nested traversal | Cannot query individual response content in DynamoDB |
| Global DEK cached in Lambda memory | Near-zero latency after cold start | If Lambda memory is compromised, DEK exposed for that invocation |
| `ENC:v1:n:` type-tagged format | Preserves original JS types transparently | ~10x size for small numeric fields (negligible cost impact) |
| Plaintext tickers/sectors | DynamoDB queries, filters, sort keys work | Admin can see what assets are held, but not quantities/values |
| Local dev bypasses encryption | No AWS credentials needed for development | Dev/prod parity gap (mitigated by integration tests) |

### Risks

1. **KMS key loss** — all data permanently unrecoverable. Mitigated: `deletionWindowInDays: 30`, AWS retains rotated key material indefinitely.
2. **Cold start latency** — one DynamoDB read + one KMS Decrypt call (~50-150ms) per cold start. Acceptable within 60s Lambda timeout.
3. **DynamoDB item size** — ~2.1KB overhead per asset item (30 fields × 70 bytes). Well within 400KB limit.
4. **Debugging difficulty** — encrypted fields unreadable in DynamoDB console. This is the explicit goal. Build a decrypt CLI tool for authorized debugging.

---

## Verification

### Unit Tests

- Encryption round-trip: encrypt → decrypt → assert equality for numbers, strings, JSON arrays
- Type preservation: parseFloat, JSON.parse restore exact original types
- Field classification resolution: correct mapping for each SK prefix
- Idempotency: encrypting an already-encrypted value is a no-op
- AAD binding: decrypting with wrong PK/SK/fieldName fails authentication

### Integration Tests

- Put/Get round-trip through middleware
- Query with multiple items round-trip
- BatchWrite round-trip
- Mixed plaintext/encrypted reads (migration compatibility)

### Post-Migration Verification

`scripts/verify-encryption.ts`:
1. Scan all items
2. For each classified field: verify `ENC:v1:` prefix or null/undefined
3. Attempt decryption of each encrypted field
4. Report: items scanned, fields verified, any leaked plaintext (expected: 0)

### Manual Smoke Test

1. Open DynamoDB console → household META item → `budgetPaycheck` shows `ENC:v1:n:...`
2. Confirm `strategy`, `riskTolerance` remain readable plaintext
3. Use app: profile loads, chat works, Deep Critique generates, PDF import works
4. Invite household member → data syncs correctly (encrypted/decrypted transparently)
