import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand,
  DeleteCommand,
  BatchWriteCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { encryptField, decryptField, isEncrypted } from './crypto';
import { getClassification, FieldClassification } from './field-classification';
import { KeyProvider } from './types';

type AnyCommand =
  | PutCommand
  | GetCommand
  | QueryCommand
  | ScanCommand
  | DeleteCommand
  | BatchWriteCommand
  | UpdateCommand;

export class EncryptedDocumentClient {
  constructor(
    private readonly raw: DynamoDBDocumentClient,
    private readonly keyProvider: KeyProvider,
    private readonly classifications: ReturnType<typeof getClassification>[] // unused — accessed via getClassification
  ) {}

  async send(command: AnyCommand): Promise<any> {
    if (command instanceof PutCommand) {
      return this.handlePut(command);
    }
    if (command instanceof BatchWriteCommand) {
      return this.handleBatchWrite(command);
    }
    if (command instanceof GetCommand) {
      return this.handleGet(command);
    }
    if (command instanceof QueryCommand || command instanceof ScanCommand) {
      return this.handleMultiItem(command);
    }
    // DeleteCommand and anything else passes through unchanged
    return this.raw.send(command as any);
  }

  // ── Write path ─────────────────────────────────────────────────────────────

  private async handlePut(command: PutCommand): Promise<any> {
    const item = command.input.Item;
    if (!item) return this.raw.send(command);

    const encrypted = await this.encryptItem(item as Record<string, unknown>);
    return this.raw.send(new PutCommand({ ...command.input, Item: encrypted }));
  }

  private async handleBatchWrite(command: BatchWriteCommand): Promise<any> {
    const { RequestItems } = command.input;
    if (!RequestItems) return this.raw.send(command);

    const encryptedRequestItems: typeof RequestItems = {};

    for (const [tableName, requests] of Object.entries(RequestItems)) {
      encryptedRequestItems[tableName] = await Promise.all(
        requests.map(async (req) => {
          if ('PutRequest' in req && req.PutRequest?.Item) {
            const encrypted = await this.encryptItem(req.PutRequest.Item as Record<string, unknown>);
            return { PutRequest: { Item: encrypted } };
          }
          // DeleteRequest — pass through
          return req;
        })
      );
    }

    return this.raw.send(new BatchWriteCommand({ ...command.input, RequestItems: encryptedRequestItems }));
  }

  // ── Read path ───────────────────────────────────────────────────────────────

  private async handleGet(command: GetCommand): Promise<any> {
    const result = await this.raw.send(command);
    if (result?.Item) {
      result.Item = await this.decryptItem(result.Item as Record<string, unknown>);
    }
    return result;
  }

  private async handleMultiItem(command: QueryCommand | ScanCommand): Promise<any> {
    const result = await this.raw.send(command as any) as { Items?: Record<string, unknown>[] };
    if (result?.Items) {
      result.Items = await Promise.all(
        result.Items.map((item: Record<string, unknown>) => this.decryptItem(item))
      );
    }
    return result;
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private async encryptItem(item: Record<string, unknown>): Promise<Record<string, unknown>> {
    const sk = item.SK as string | undefined;
    const pk = item.PK as string | undefined;
    if (!sk || !pk) return item;

    const classification = getClassification(sk);
    if (!classification) return item;

    const { plaintextKey } = await this.keyProvider.getDataKey();
    const result = { ...item };

    for (const field of classification.encryptedFields) {
      const value = result[field];
      if (value === null || value === undefined) continue;
      if (isEncrypted(value)) continue; // already encrypted (idempotency)

      const aad = `${pk}|${sk}|${field}`;
      result[field] = encryptField(value, plaintextKey, aad);
    }

    return result;
  }

  private async decryptItem(item: Record<string, unknown>): Promise<Record<string, unknown>> {
    const sk = item.SK as string | undefined;
    const pk = item.PK as string | undefined;
    if (!sk || !pk) return item;

    const classification = getClassification(sk);
    if (!classification) return item;

    const { plaintextKey } = await this.keyProvider.getDataKey();
    const result = { ...item };

    for (const field of classification.encryptedFields) {
      const value = result[field];
      if (value === null || value === undefined) continue;
      if (!isEncrypted(value)) continue; // plaintext fallback (migration compatibility)

      const aad = `${pk}|${sk}|${field}`;
      result[field] = decryptField(value as string, plaintextKey, aad);
    }

    return result;
  }
}
