/**
 * One-time cleanup of legacy bad classification values.
 *
 * Production data is encrypted via the "Blind Admin" KMS scheme — this script
 * uses EncryptedDocumentClient directly so encrypted fields round-trip safely.
 *
 * Required env vars:
 *   KMS_KEY_ID            — production KMS key ID (alias: investment-advisor-production)
 *   DYNAMODB_TABLE_NAME   — table name (default: InvestmentAdvisorData)
 *   AWS_ACCESS_KEY_ID     — AWS credentials
 *   AWS_SECRET_ACCESS_KEY — AWS credentials
 *   AWS_REGION            — defaults to us-east-1
 *
 * Usage:
 *   KMS_KEY_ID=<id> AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *     npx tsx scripts/migrate-cleanup-allowlist.ts --dry-run
 *
 *   KMS_KEY_ID=<id> AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *     npx tsx scripts/migrate-cleanup-allowlist.ts
 *
 * Run --dry-run first to preview changes; without flag to apply.
 *
 * The script is safe to re-run — it's idempotent: anything already canonical
 * stays canonical, anything still bad gets normalized.
 */

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { EncryptedDocumentClient } from "../src/lib/encryption/encrypted-client";
import { createKeyProvider } from "../src/lib/encryption/key-provider";
import { FIELD_CLASSIFICATIONS } from "../src/lib/encryption/field-classification";
import {
  normalizeStrategyType,
  normalizeSecurityType,
  normalizeSector,
  normalizeMarket,
  normalizeCurrency,
  normalizeManagementStyle,
  normalizeCall,
  applyCompanyAutoDefaults,
} from "../src/lib/classification/allowlists";
import { insertAuditLog } from "../src/lib/auditLog";
import { toSnapshot } from "../src/lib/assetSnapshot";
import type { AssetSnapshot } from "../src/types/audit";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";
const KMS_KEY_ID = process.env.KMS_KEY_ID;
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

if (!KMS_KEY_ID) {
  console.error(
    "ERROR: KMS_KEY_ID env var is required for production runs.\n" +
    "Production data is encrypted at rest. Without the KMS key, the script\n" +
    "would either skip changes or corrupt encrypted fields.\n\n" +
    "Get the KMS key ID from the AWS console (KMS → Keys → alias 'investment-advisor-production')\n" +
    "or via 'sst secret list', then run:\n" +
    "  KMS_KEY_ID=<id> DYNAMODB_TABLE_NAME=<table> AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \\\n" +
    "    npx tsx scripts/migrate-cleanup-allowlist.ts --dry-run\n"
  );
  process.exit(1);
}

const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const rawDb = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true },
});
const kmsClient = new KMSClient({ region: AWS_REGION });
const db = new EncryptedDocumentClient(
  rawDb,
  createKeyProvider(
    { kmsKeyId: KMS_KEY_ID, tableName: TABLE_NAME },
    rawDb,
    kmsClient,
  ),
  FIELD_CLASSIFICATIONS,
);

const DRY_RUN = process.argv.includes("--dry-run");

interface CleanupSummary {
  totalAssets: number;
  modified: number;
  byField: Record<string, number>;
}

interface PendingMutation {
  before: AssetSnapshot;
  after: AssetSnapshot;
  ticker: string;
  assetSK: string;
}

async function main() {
  console.log(`[migrate-cleanup-allowlist] Starting (dry-run=${DRY_RUN})`);

  const summary: CleanupSummary = { totalAssets: 0, modified: 0, byField: {} };

  let exclusiveStartKey: Record<string, unknown> | undefined;
  const householdMutations = new Map<string, PendingMutation[]>();

  do {
    const result: { Items?: Record<string, unknown>[]; LastEvaluatedKey?: Record<string, unknown> } = await db.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#t = :assetType",
        ExpressionAttributeNames: { "#t": "type" },
        ExpressionAttributeValues: { ":assetType": "ASSET" },
        ExclusiveStartKey: exclusiveStartKey,
      }),
    );

    for (const asset of (result.Items || []) as Record<string, unknown>[]) {
      summary.totalAssets++;
      const before = { ...asset };

      const normalizedSecurityType = normalizeSecurityType(asset.securityType as string | null | undefined);
      const after = applyCompanyAutoDefaults({
        ...asset,
        securityType: normalizedSecurityType,
        strategyType: normalizeStrategyType(asset.strategyType as string | null | undefined),
        call: normalizeCall(asset.call as string | null | undefined),
        sector: normalizeSector(asset.sector as string | null | undefined),
        market: normalizeMarket(
          asset.market as string | null | undefined,
          normalizedSecurityType,
        ),
        currency: normalizeCurrency(asset.currency as string | null | undefined),
        managementStyle: normalizeManagementStyle(asset.managementStyle as string | null | undefined),
        // Number fields: silent-zero -> null per spec
        yield: asset.yield === 0 ? null : (asset.yield as number | null | undefined) ?? null,
        oneYearReturn:
          asset.oneYearReturn === 0 ? null : (asset.oneYearReturn as number | null | undefined) ?? null,
        threeYearReturn:
          asset.threeYearReturn === 0 ? null : (asset.threeYearReturn as number | null | undefined) ?? null,
        fiveYearReturn:
          asset.fiveYearReturn === 0 ? null : (asset.fiveYearReturn as number | null | undefined) ?? null,
        // managementFee: only null if NOT a Company (Company keeps its 0)
        managementFee:
          normalizedSecurityType === "Company"
            ? ((asset.managementFee as number | null | undefined) ?? 0)
            : asset.managementFee === 0
              ? null
              : (asset.managementFee as number | null | undefined) ?? null,
        updatedAt: new Date().toISOString(),
      });

      const fieldsChanged: string[] = [];
      const trackedFields = [
        "securityType",
        "strategyType",
        "call",
        "sector",
        "market",
        "currency",
        "managementStyle",
        "yield",
        "oneYearReturn",
        "threeYearReturn",
        "fiveYearReturn",
        "managementFee",
      ] as const;

      for (const k of trackedFields) {
        if (before[k] !== (after as Record<string, unknown>)[k]) {
          fieldsChanged.push(k);
          summary.byField[k] = (summary.byField[k] ?? 0) + 1;
        }
      }

      if (fieldsChanged.length === 0) continue;

      summary.modified++;
      console.log(`  ${asset.ticker} (${asset.SK}): ${fieldsChanged.join(", ")}`);

      if (!DRY_RUN) {
        await db.send(new PutCommand({ TableName: TABLE_NAME, Item: after as Record<string, unknown> }));
        const householdId = String(asset.PK).replace("HOUSEHOLD#", "");
        if (!householdMutations.has(householdId)) householdMutations.set(householdId, []);
        householdMutations.get(householdId)!.push({
          before: toSnapshot(before),
          after: toSnapshot(after as Record<string, unknown>),
          ticker: String(asset.ticker ?? ""),
          assetSK: String(asset.SK ?? ""),
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
          "MIGRATION_PHASE2_CLEANUP",
          mutations.map((m) => ({
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

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
