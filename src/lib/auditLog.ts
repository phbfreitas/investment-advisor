import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import type { AuditMutation, AuditSource } from "@/types/audit";

/**
 * Inserts an audit log entry into DynamoDB.
 * Returns the generated SK for downstream reference.
 */
export async function insertAuditLog(
  householdId: string,
  source: AuditSource,
  mutations: AuditMutation[],
  metadata?: string
): Promise<string> {
  const now = new Date().toISOString();
  const SK = `AUDIT_LOG#${now}#${uuidv4()}`;

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK,
        type: "AUDIT_LOG",
        source,
        metadata: metadata || "",
        mutations,
        createdAt: now,
      },
    })
  );

  return SK;
}
