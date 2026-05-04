import * as fs from "fs";
import * as path from "path";
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
    // Static assertion: the lock route module must reference rawDb_unclassifiedOnly.
    const lockRoutePath = path.resolve(__dirname, "../../../app/api/assets/[id]/lock/route.ts");
    const lockRouteSource = fs.readFileSync(lockRoutePath, "utf-8");
    expect(lockRouteSource).toMatch(/rawDb_unclassifiedOnly/);
    // Hard-fail if the route ever reverts to using the encrypted `db` for an UpdateCommand,
    // regardless of whether it's called inline (`db.send(new UpdateCommand(...))`),
    // via a captured variable (`const cmd = new UpdateCommand(...); db.send(cmd);`),
    // or through bracket access (`db['send'](...)`).
    expect(lockRouteSource).not.toMatch(/\bdb\s*\.\s*send\s*\(\s*new\s+UpdateCommand/);
    expect(lockRouteSource).not.toMatch(/\bdb\s*\[\s*['"]send['"]\s*\]\s*\(/);
    // Variable-indirection check: any `new UpdateCommand` expression in this file should
    // be sent via rawDb_unclassifiedOnly, never via `db`.
    const hasUpdateCmd = /\bnew\s+UpdateCommand\b/.test(lockRouteSource);
    if (hasUpdateCmd) {
      expect(lockRouteSource).toMatch(/rawDb_unclassifiedOnly\s*\.\s*send/);
    }
  });
});
