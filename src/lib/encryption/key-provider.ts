import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { DataKey, KeyProvider, KeyProviderConfig } from './types';

const DEK_PK = 'GLOBAL';
const DEK_SK = 'ENCRYPTION_KEY';

/** Module-level cache — persists for the Lambda container lifetime (warm invocations) */
let cachedKey: DataKey | null = null;

export function createKeyProvider(
  config: KeyProviderConfig,
  rawDb: DynamoDBDocumentClient,
  kmsClient: KMSClient = new KMSClient({})
): KeyProvider {
  return {
    async getDataKey(_householdId?: string): Promise<DataKey> {
      if (cachedKey) return cachedKey;

      const { kmsKeyId, tableName } = config;

      // Try to load an existing encrypted DEK from DynamoDB
      const existing = await rawDb.send(
        new GetCommand({ TableName: tableName, Key: { PK: DEK_PK, SK: DEK_SK } })
      );

      if (existing.Item?.encryptedDek) {
        // Decrypt the stored DEK with KMS
        const decryptResult = await kmsClient.send(
          new DecryptCommand({
            CiphertextBlob: Buffer.from(existing.Item.encryptedDek as string, 'base64'),
            KeyId: kmsKeyId,
          })
        );

        if (!decryptResult.Plaintext) {
          throw new Error('KMS Decrypt returned empty Plaintext');
        }

        cachedKey = {
          plaintextKey: Buffer.from(decryptResult.Plaintext),
          keyId: kmsKeyId,
        };
        return cachedKey;
      }

      // First run — generate a new DEK
      const generated = await kmsClient.send(
        new GenerateDataKeyCommand({
          KeyId: kmsKeyId,
          KeySpec: 'AES_256',
        })
      );

      if (!generated.Plaintext || !generated.CiphertextBlob) {
        throw new Error('KMS GenerateDataKey returned incomplete response');
      }

      // Persist the encrypted DEK to DynamoDB
      await rawDb.send(
        new PutCommand({
          TableName: tableName,
          Item: {
            PK: DEK_PK,
            SK: DEK_SK,
            encryptedDek: Buffer.from(generated.CiphertextBlob).toString('base64'),
            createdAt: new Date().toISOString(),
          },
          // Only write if it doesn't exist — guards against race conditions
          ConditionExpression: 'attribute_not_exists(PK)',
        })
      );

      cachedKey = {
        plaintextKey: Buffer.from(generated.Plaintext),
        keyId: kmsKeyId,
      };
      return cachedKey;
    },
  };
}

/** Exported for testing only — clears the module-level DEK cache */
export function _clearKeyCache(): void {
  cachedKey = null;
}
