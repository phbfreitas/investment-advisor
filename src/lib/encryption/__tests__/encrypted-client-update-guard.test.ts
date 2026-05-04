import { UpdateCommand, GetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { EncryptedDocumentClient } from "../encrypted-client";
import type { KeyProvider } from "../types";

function buildClient() {
  const raw = { send: jest.fn().mockResolvedValue({}) } as unknown as DynamoDBDocumentClient;
  const keyProvider: KeyProvider = {
    getDataKey: async () => ({ plaintextKey: Buffer.alloc(32), encryptedKey: "x", keyId: "k" }),
  };
  return { raw, client: new EncryptedDocumentClient(raw, keyProvider, []) };
}

describe("EncryptedDocumentClient — UpdateCommand guard", () => {
  it("throws when handed an UpdateCommand", async () => {
    const { client } = buildClient();
    const cmd = new UpdateCommand({
      TableName: "T",
      Key: { PK: "p", SK: "s" },
      UpdateExpression: "SET x = :v",
      ExpressionAttributeValues: { ":v": 1 },
    });
    await expect(client.send(cmd)).rejects.toThrow(/UpdateCommand is not supported/);
  });

  it("does not call the raw client for UpdateCommand", async () => {
    const { client, raw } = buildClient();
    const cmd = new UpdateCommand({ TableName: "T", Key: { PK: "p", SK: "s" }, UpdateExpression: "SET x = :v", ExpressionAttributeValues: { ":v": 1 } });
    await expect(client.send(cmd)).rejects.toThrow();
    expect(raw.send).not.toHaveBeenCalled();
  });

  it("still passes GetCommand through (regression check)", async () => {
    const { client, raw } = buildClient();
    (raw.send as jest.Mock).mockResolvedValueOnce({ Item: { PK: "HOUSEHOLD#1", SK: "META", foo: "bar" } });
    const cmd = new GetCommand({ TableName: "T", Key: { PK: "HOUSEHOLD#1", SK: "META" } });
    const result = await client.send(cmd);
    expect(raw.send).toHaveBeenCalledTimes(1);
    expect((result as { Item: { foo: string } }).Item.foo).toBe("bar");
  });
});

describe("EncryptedDocumentClient — lock PATCH route stays raw-client", () => {
  it("source-of-routing audit: only lock PATCH route uses UpdateCommand and it imports rawDb_unclassifiedOnly", () => {
    // Static assertion via require — the lock route module must reference rawDb_unclassifiedOnly.
    const fs = require("fs");
    const path = require("path");
    const lockRouteSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/api/assets/[id]/lock/route.ts"),
      "utf-8"
    );
    expect(lockRouteSource).toMatch(/rawDb_unclassifiedOnly/);
    expect(lockRouteSource).not.toMatch(/\bdb\.send\(\s*new UpdateCommand/);
  });
});
