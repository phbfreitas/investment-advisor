/**
 * Rollback migration: decrypt all encrypted financial fields back to plaintext.
 *
 * Usage:
 *   KMS_KEY_ID=<key-id> DYNAMODB_TABLE_NAME=<table> npx tsx scripts/migrate-decrypt.ts
 *
 * WARNING: This reverses the "Blind Admin" protection. Only run to roll back.
 * Requires the KMS key to still be accessible and not deleted.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient } from '@aws-sdk/client-kms';
import { createKeyProvider } from '../src/lib/encryption/key-provider';
import { getClassification } from '../src/lib/encryption/field-classification';
import { decryptField, isEncrypted } from '../src/lib/encryption/crypto';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'InvestmentAdvisorData';
const KMS_KEY_ID = process.env.KMS_KEY_ID;
const BATCH_DELAY_MS = Number(process.env.MIGRATE_DELAY_MS ?? 200);

if (!KMS_KEY_ID) {
  console.error('ERROR: KMS_KEY_ID environment variable is required');
  process.exit(1);
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const rawDb = DynamoDBDocumentClient.from(dynamoClient, { marshallOptions: { removeUndefinedValues: true } });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const keyProvider = createKeyProvider({ kmsKeyId: KMS_KEY_ID, tableName: TABLE_NAME }, rawDb, kmsClient);

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  console.log('⚠️  ROLLBACK: Decrypting all financial fields back to plaintext');
  console.log(`Table: ${TABLE_NAME}`);
  console.log(`KMS Key: ${KMS_KEY_ID}`);
  console.log('');

  let scanned = 0;
  let modified = 0;
  let skipped = 0;
  let errors = 0;
  let lastEvaluatedKey: Record<string, unknown> | undefined;

  const { plaintextKey } = await keyProvider.getDataKey();

  do {
    const result = await rawDb.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        ExclusiveStartKey: lastEvaluatedKey,
      })
    );

    const items = result.Items ?? [];
    scanned += items.length;

    for (const item of items) {
      const pk = item.PK as string;
      const sk = item.SK as string;

      try {
        const classification = getClassification(sk);
        if (!classification) {
          skipped++;
          continue;
        }

        let changed = false;
        const updated = { ...item };

        for (const field of classification.encryptedFields) {
          const value = updated[field];
          if (value === null || value === undefined) continue;
          if (!isEncrypted(value)) continue; // already plaintext

          const aad = `${pk}|${sk}|${field}`;
          updated[field] = decryptField(value as string, plaintextKey, aad);
          changed = true;
        }

        if (!changed) {
          skipped++;
          continue;
        }

        await rawDb.send(new PutCommand({ TableName: TABLE_NAME, Item: updated }));
        modified++;

        if (modified % 100 === 0) {
          console.log(`  Progress: scanned=${scanned}, modified=${modified}, skipped=${skipped}, errors=${errors}`);
        }
      } catch (err) {
        errors++;
        console.error(`  ERROR decrypting item PK=${pk} SK=${sk}:`, err);
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;

    if (lastEvaluatedKey) {
      await sleep(BATCH_DELAY_MS);
    }
  } while (lastEvaluatedKey);

  console.log('');
  console.log('Rollback complete:');
  console.log(`  Items scanned:  ${scanned}`);
  console.log(`  Items modified: ${modified}`);
  console.log(`  Items skipped:  ${skipped}`);
  console.log(`  Errors:         ${errors}`);

  if (errors > 0) {
    console.error('\nWARNING: Some items failed to decrypt. Check logs above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
