import { createKeyProvider, _clearKeyCache } from '../key-provider';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';

jest.mock('@aws-sdk/client-kms');
jest.mock('@aws-sdk/lib-dynamodb');

const FAKE_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/fake-key-id';
const FAKE_TABLE = 'TestTable';
const FAKE_PLAINTEXT = Buffer.alloc(32, 0xde);
const FAKE_CIPHERTEXT = Buffer.alloc(64, 0xad);

function makeDb(sendImpl: jest.Mock): DynamoDBDocumentClient {
  return { send: sendImpl } as unknown as DynamoDBDocumentClient;
}

function makeKms(sendImpl: jest.Mock): KMSClient {
  return { send: sendImpl } as unknown as KMSClient;
}

beforeEach(() => {
  _clearKeyCache();
  jest.clearAllMocks();
});

describe('createKeyProvider — first run (no existing DEK)', () => {
  it('calls GenerateDataKey, stores encrypted DEK, returns plaintext key', async () => {
    const dbSend = jest.fn()
      .mockResolvedValueOnce({ Item: undefined }) // GetCommand — no existing DEK
      .mockResolvedValueOnce({}); // PutCommand — store encrypted DEK

    const kmsSend = jest.fn().mockResolvedValueOnce({
      Plaintext: FAKE_PLAINTEXT,
      CiphertextBlob: FAKE_CIPHERTEXT,
    });

    const provider = createKeyProvider(
      { kmsKeyId: FAKE_KEY_ID, tableName: FAKE_TABLE },
      makeDb(dbSend),
      makeKms(kmsSend)
    );

    const key = await provider.getDataKey();

    expect(key.plaintextKey).toEqual(FAKE_PLAINTEXT);
    expect(key.keyId).toBe(FAKE_KEY_ID);

    // Should have called GenerateDataKey
    expect(kmsSend).toHaveBeenCalledTimes(1);
    expect(kmsSend.mock.calls[0][0]).toBeInstanceOf(GenerateDataKeyCommand);

    // Should have stored the encrypted DEK
    expect(dbSend).toHaveBeenCalledTimes(2);
    expect(dbSend.mock.calls[0][0]).toBeInstanceOf(GetCommand);
    expect(dbSend.mock.calls[1][0]).toBeInstanceOf(PutCommand);
  });
});

describe('createKeyProvider — warm start (DEK already in DynamoDB)', () => {
  it('calls Decrypt (not GenerateDataKey), returns plaintext key', async () => {
    const storedEncryptedDek = FAKE_CIPHERTEXT.toString('base64');

    const dbSend = jest.fn().mockResolvedValueOnce({
      Item: { PK: 'GLOBAL', SK: 'ENCRYPTION_KEY', encryptedDek: storedEncryptedDek },
    });

    const kmsSend = jest.fn().mockResolvedValueOnce({
      Plaintext: FAKE_PLAINTEXT,
    });

    const provider = createKeyProvider(
      { kmsKeyId: FAKE_KEY_ID, tableName: FAKE_TABLE },
      makeDb(dbSend),
      makeKms(kmsSend)
    );

    const key = await provider.getDataKey();

    expect(key.plaintextKey).toEqual(FAKE_PLAINTEXT);
    expect(kmsSend).toHaveBeenCalledTimes(1);
    expect(kmsSend.mock.calls[0][0]).toBeInstanceOf(DecryptCommand);

    // No PutCommand — DEK already exists
    expect(dbSend).toHaveBeenCalledTimes(1);
  });
});

describe('createKeyProvider — in-memory cache', () => {
  it('returns cached key on second call (no KMS or DynamoDB calls)', async () => {
    const dbSend = jest.fn().mockResolvedValueOnce({ Item: undefined }).mockResolvedValueOnce({});
    const kmsSend = jest.fn().mockResolvedValueOnce({
      Plaintext: FAKE_PLAINTEXT,
      CiphertextBlob: FAKE_CIPHERTEXT,
    });

    const provider = createKeyProvider(
      { kmsKeyId: FAKE_KEY_ID, tableName: FAKE_TABLE },
      makeDb(dbSend),
      makeKms(kmsSend)
    );

    await provider.getDataKey(); // first call — hits KMS
    await provider.getDataKey(); // second call — should use cache

    expect(kmsSend).toHaveBeenCalledTimes(1);
    expect(dbSend).toHaveBeenCalledTimes(2); // only from first call
  });
});
