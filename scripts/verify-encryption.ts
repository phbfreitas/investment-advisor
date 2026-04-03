/**
 * Post-migration verification: scans all items and confirms all classified fields
 * are encrypted. Reports any leaked plaintext.
 *
 * Usage:
 *   KMS_KEY_ID=<key-id> DYNAMODB_TABLE_NAME=<table> npx tsx scripts/verify-encryption.ts
 *
 * Exit code 0 = all clear. Exit code 1 = leaked plaintext found or decryption errors.
 */
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand } from '@aws-sdk/lib-dynamodb';
import { KMSClient } from '@aws-sdk/client-kms';
import { createKeyProvider } from '../src/lib/encryption/key-provider';
import { getClassification } from '../src/lib/encryption/field-classification';
import { decryptField, isEncrypted } from '../src/lib/encryption/crypto';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'InvestmentAdvisorData';
const KMS_KEY_ID = process.env.KMS_KEY_ID;

if (!KMS_KEY_ID) {
  console.error('ERROR: KMS_KEY_ID environment variable is required');
  process.exit(1);
}

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const rawDb = DynamoDBDocumentClient.from(dynamoClient, { marshallOptions: { removeUndefinedValues: true } });
const kmsClient = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });
const keyProvider = createKeyProvider({ kmsKeyId: KMS_KEY_ID, tableName: TABLE_NAME }, rawDb, kmsClient);

interface LeakedField {
  pk: string;
  sk: string;
  field: string;
  value: unknown;
}

async function main(): Promise<void> {
  console.log(`Verifying encryption on table: ${TABLE_NAME}`);
  console.log('');

  let itemsScanned = 0;
  let fieldsVerified = 0;
  let fieldsNull = 0;
  let decryptionErrors = 0;
  const leakedFields: LeakedField[] = [];
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
    itemsScanned += items.length;

    for (const item of items) {
      const pk = item.PK as string;
      const sk = item.SK as string;

      const classification = getClassification(sk);
      if (!classification) continue;

      for (const field of classification.encryptedFields) {
        const value = item[field];
        if (value === null || value === undefined) {
          fieldsNull++;
          continue;
        }

        if (!isEncrypted(value)) {
          // Leaked plaintext!
          leakedFields.push({ pk, sk, field, value });
          continue;
        }

        // Attempt decryption to verify the ciphertext is valid
        try {
          const aad = `${pk}|${sk}|${field}`;
          decryptField(value as string, plaintextKey, aad);
          fieldsVerified++;
        } catch (err) {
          decryptionErrors++;
          console.error(`  DECRYPTION ERROR: PK=${pk} SK=${sk} field=${field}: ${err}`);
        }
      }
    }

    lastEvaluatedKey = result.LastEvaluatedKey as Record<string, unknown> | undefined;
  } while (lastEvaluatedKey);

  console.log('Verification results:');
  console.log(`  Items scanned:          ${itemsScanned}`);
  console.log(`  Fields verified (ENC):  ${fieldsVerified}`);
  console.log(`  Fields null/absent:     ${fieldsNull}`);
  console.log(`  Leaked plaintext:       ${leakedFields.length}`);
  console.log(`  Decryption errors:      ${decryptionErrors}`);

  if (leakedFields.length > 0) {
    console.error('\nLEAKED PLAINTEXT FIELDS:');
    for (const leak of leakedFields) {
      console.error(`  PK=${leak.pk} SK=${leak.sk} field=${leak.field} value=${JSON.stringify(leak.value)}`);
    }
  }

  if (leakedFields.length === 0 && decryptionErrors === 0) {
    console.log('\n✓ All classified fields are properly encrypted and decryptable.');
    process.exit(0);
  } else {
    console.error('\n✗ Verification FAILED. Run migrate-encrypt.ts to fix leaked fields.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
