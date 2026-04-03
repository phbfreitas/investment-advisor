import { EncryptedDocumentClient } from '../encrypted-client';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, BatchWriteCommand, ScanCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { FIELD_CLASSIFICATIONS } from '../field-classification';
import { isEncrypted } from '../crypto';
import { KeyProvider } from '../types';
import { _clearKeyCache } from '../key-provider';

const TABLE = 'TestTable';
const HOUSEHOLD_PK = 'HOUSEHOLD#test-household';
const TEST_KEY = Buffer.alloc(32, 0xab);

const fakeKeyProvider: KeyProvider = {
  getDataKey: async () => ({ plaintextKey: TEST_KEY, keyId: 'test-key' }),
};

function makeClient(sendImpl: jest.Mock): DynamoDBDocumentClient {
  return { send: sendImpl } as unknown as DynamoDBDocumentClient;
}

beforeEach(() => {
  _clearKeyCache();
});

describe('PutCommand — encrypt on write', () => {
  it('encrypts classified fields before writing', async () => {
    const capturedCalls: unknown[] = [];
    const rawSend = jest.fn().mockImplementation(cmd => {
      capturedCalls.push(cmd);
      return Promise.resolve({});
    });

    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);

    const item = {
      PK: HOUSEHOLD_PK,
      SK: 'META',
      strategy: 'Dividend Growth',      // plaintext
      riskTolerance: 7,                  // plaintext
      budgetPaycheck: 5000,              // encrypted
      goals: 'Retire early',             // encrypted
    };

    await client.send(new PutCommand({ TableName: TABLE, Item: item }));

    expect(rawSend).toHaveBeenCalledTimes(1);
    const sentItem = (capturedCalls[0] as PutCommand).input.Item as Record<string, unknown>;

    // Plaintext fields preserved
    expect(sentItem.strategy).toBe('Dividend Growth');
    expect(sentItem.riskTolerance).toBe(7);

    // Financial fields encrypted
    expect(isEncrypted(sentItem.budgetPaycheck)).toBe(true);
    expect(isEncrypted(sentItem.goals)).toBe(true);

    // Original item not mutated
    expect(item.budgetPaycheck).toBe(5000);
  });

  it('does not encrypt fields not in classification', async () => {
    const rawSend = jest.fn().mockResolvedValue({});
    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);

    const item = { PK: HOUSEHOLD_PK, SK: 'USER#test@example.com', email: 'test@example.com', householdId: 'test' };
    await client.send(new PutCommand({ TableName: TABLE, Item: item }));

    const sentItem = (rawSend.mock.calls[0][0] as PutCommand).input.Item as Record<string, unknown>;
    expect(sentItem.email).toBe('test@example.com');
    expect(sentItem.householdId).toBe('test');
  });
});

describe('GetCommand — decrypt on read', () => {
  it('decrypts classified fields in response', async () => {
    const { encryptField } = require('../crypto');
    const aadPaycheck = `${HOUSEHOLD_PK}|META|budgetPaycheck`;
    const aadGoals = `${HOUSEHOLD_PK}|META|goals`;
    const encPaycheck = encryptField(5000, TEST_KEY, aadPaycheck);
    const encGoals = encryptField('Retire early', TEST_KEY, aadGoals);

    const rawSend = jest.fn().mockResolvedValue({
      Item: {
        PK: HOUSEHOLD_PK,
        SK: 'META',
        strategy: 'Dividend Growth',
        budgetPaycheck: encPaycheck,
        goals: encGoals,
      },
    });

    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);
    const result = await client.send(new GetCommand({ TableName: TABLE, Key: { PK: HOUSEHOLD_PK, SK: 'META' } }));

    expect(result.Item.strategy).toBe('Dividend Growth');
    expect(result.Item.budgetPaycheck).toBe(5000);
    expect(result.Item.goals).toBe('Retire early');
  });

  it('returns plaintext fields as-is (migration compatibility)', async () => {
    // Simulates an item not yet migrated — field is still plaintext
    const rawSend = jest.fn().mockResolvedValue({
      Item: {
        PK: HOUSEHOLD_PK,
        SK: 'META',
        budgetPaycheck: 5000, // still plaintext, not yet migrated
      },
    });

    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);
    const result = await client.send(new GetCommand({ TableName: TABLE, Key: { PK: HOUSEHOLD_PK, SK: 'META' } }));

    // Plaintext fallback — no error, returns as-is
    expect(result.Item.budgetPaycheck).toBe(5000);
  });

  it('returns null Item as-is', async () => {
    const rawSend = jest.fn().mockResolvedValue({ Item: undefined });
    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);
    const result = await client.send(new GetCommand({ TableName: TABLE, Key: { PK: HOUSEHOLD_PK, SK: 'META' } }));
    expect(result.Item).toBeUndefined();
  });
});

describe('QueryCommand — decrypt multiple items', () => {
  it('decrypts classified fields in each item', async () => {
    const { encryptField } = require('../crypto');
    const aad1 = `${HOUSEHOLD_PK}|ASSET#uuid-1|marketValue`;
    const aad2 = `${HOUSEHOLD_PK}|ASSET#uuid-2|marketValue`;
    const enc1 = encryptField(10000, TEST_KEY, aad1);
    const enc2 = encryptField(20000, TEST_KEY, aad2);

    const rawSend = jest.fn().mockResolvedValue({
      Items: [
        { PK: HOUSEHOLD_PK, SK: 'ASSET#uuid-1', ticker: 'AAPL', marketValue: enc1 },
        { PK: HOUSEHOLD_PK, SK: 'ASSET#uuid-2', ticker: 'MSFT', marketValue: enc2 },
      ],
    });

    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);
    const result = await client.send(new QueryCommand({
      TableName: TABLE,
      KeyConditionExpression: 'PK = :pk',
      ExpressionAttributeValues: { ':pk': HOUSEHOLD_PK },
    }));

    expect(result.Items[0].ticker).toBe('AAPL');
    expect(result.Items[0].marketValue).toBe(10000);
    expect(result.Items[1].ticker).toBe('MSFT');
    expect(result.Items[1].marketValue).toBe(20000);
  });
});

describe('BatchWriteCommand — encrypt each PutRequest item', () => {
  it('encrypts classified fields in BatchWrite put items', async () => {
    const rawSend = jest.fn().mockResolvedValue({ UnprocessedItems: {} });
    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);

    const item1 = { PK: HOUSEHOLD_PK, SK: 'ASSET#uuid-1', ticker: 'AAPL', marketValue: 10000 };
    const item2 = { PK: HOUSEHOLD_PK, SK: 'ASSET#uuid-2', ticker: 'MSFT', marketValue: 20000 };

    await client.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE]: [
          { PutRequest: { Item: item1 } },
          { PutRequest: { Item: item2 } },
        ],
      },
    }));

    const sent = rawSend.mock.calls[0][0] as BatchWriteCommand;
    const requests = sent.input.RequestItems![TABLE];

    const sentItem1 = (requests[0] as { PutRequest: { Item: Record<string, unknown> } }).PutRequest.Item;
    const sentItem2 = (requests[1] as { PutRequest: { Item: Record<string, unknown> } }).PutRequest.Item;

    expect(sentItem1.ticker).toBe('AAPL');
    expect(isEncrypted(sentItem1.marketValue)).toBe(true);
    expect(sentItem2.ticker).toBe('MSFT');
    expect(isEncrypted(sentItem2.marketValue)).toBe(true);
  });
});

describe('DeleteCommand — pass through', () => {
  it('passes through without modification', async () => {
    const rawSend = jest.fn().mockResolvedValue({});
    const client = new EncryptedDocumentClient(makeClient(rawSend), fakeKeyProvider, FIELD_CLASSIFICATIONS);

    await client.send(new DeleteCommand({ TableName: TABLE, Key: { PK: HOUSEHOLD_PK, SK: 'META' } }));

    expect(rawSend).toHaveBeenCalledTimes(1);
    const cmd = rawSend.mock.calls[0][0];
    expect(cmd).toBeInstanceOf(DeleteCommand);
  });
});
