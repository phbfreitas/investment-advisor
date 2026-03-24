// src/app/api/portfolio-rollback/route.ts
import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand, GetCommand, PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import type { AuditMutation, AuditLog } from "@/types/audit";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { auditLogSK } = await request.json();
    if (!auditLogSK || !auditLogSK.startsWith("AUDIT_LOG#")) {
      return NextResponse.json({ error: "Invalid audit log reference" }, { status: 400 });
    }

    const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;

    // 1. Fetch audit logs from newest down to the target (inclusive)
    const { Items } = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND SK BETWEEN :targetSK AND :maxSK",
        ExpressionAttributeValues: {
          ":pk": PROFILE_KEY,
          ":targetSK": auditLogSK,
          ":maxSK": "AUDIT_LOG#\uffff",
        },
        ScanIndexForward: false,
      })
    );

    const allLogs = (Items || []) as AuditLog[];

    // 2. Collect entries from most recent down to and including the target
    const targetIndex = allLogs.findIndex(log => log.SK === auditLogSK);
    if (targetIndex === -1) {
      return NextResponse.json({ error: "Audit log entry not found" }, { status: 404 });
    }

    const logsToReverse = allLogs.slice(0, targetIndex + 1);

    // 3. Process each log entry (already in newest-first order)
    const rollbackSummary: { logSK: string; reversedMutations: number }[] = [];

    for (const log of logsToReverse) {
      const reverseMutations: AuditMutation[] = [];

      for (const mutation of log.mutations) {
        try {
          if (mutation.action === 'CREATE' && mutation.after) {
            const { Item: currentAsset } = await db.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
              })
            );

            if (currentAsset) {
              await db.send(
                new DeleteCommand({
                  TableName: TABLE_NAME,
                  Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
                })
              );
              reverseMutations.push({
                action: 'DELETE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: toSnapshot(currentAsset),
                after: null,
              });
            }
          } else if (mutation.action === 'DELETE' && mutation.before) {
            const restoredAsset = {
              PK: PROFILE_KEY,
              SK: mutation.assetSK,
              id: mutation.assetSK.replace('ASSET#', ''),
              profileId: PROFILE_KEY,
              type: "ASSET",
              ticker: mutation.ticker,
              ...mutation.before,
              updatedAt: new Date().toISOString(),
            };

            await db.send(
              new PutCommand({
                TableName: TABLE_NAME,
                Item: restoredAsset,
              })
            );
            reverseMutations.push({
              action: 'CREATE',
              ticker: mutation.ticker,
              assetSK: mutation.assetSK,
              before: null,
              after: toSnapshot(restoredAsset),
            });
          } else if (mutation.action === 'UPDATE' && mutation.before) {
            const { Item: currentAsset } = await db.send(
              new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: mutation.assetSK },
              })
            );

            if (currentAsset) {
              const revertedAsset = {
                ...currentAsset,
                ...mutation.before,
                updatedAt: new Date().toISOString(),
              };

              await db.send(
                new PutCommand({
                  TableName: TABLE_NAME,
                  Item: revertedAsset,
                })
              );
              reverseMutations.push({
                action: 'UPDATE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: toSnapshot(currentAsset),
                after: toSnapshot(revertedAsset),
              });
            } else {
              const restoredAsset = {
                PK: PROFILE_KEY,
                SK: mutation.assetSK,
                id: mutation.assetSK.replace('ASSET#', ''),
                profileId: PROFILE_KEY,
                type: "ASSET",
                ticker: mutation.ticker,
                ...mutation.before,
                updatedAt: new Date().toISOString(),
              };

              await db.send(
                new PutCommand({
                  TableName: TABLE_NAME,
                  Item: restoredAsset,
                })
              );
              reverseMutations.push({
                action: 'CREATE',
                ticker: mutation.ticker,
                assetSK: mutation.assetSK,
                before: null,
                after: toSnapshot(restoredAsset),
              });
            }
          }
        } catch (err) {
          console.error(`Rollback failed for mutation ${mutation.ticker} (${mutation.action}):`, err);
          if (reverseMutations.length > 0) {
            await insertAuditLog(
              session.user.householdId,
              'ROLLBACK',
              reverseMutations,
              `PARTIAL_ROLLBACK:${log.SK}`
            );
          }
          return NextResponse.json({
            error: `Rollback partially failed at ${mutation.ticker} (${mutation.action}). ${rollbackSummary.length} entries fully reversed, current entry partially reversed.`,
            rollbackSummary,
          }, { status: 500 });
        }
      }

      if (reverseMutations.length > 0) {
        await insertAuditLog(
          session.user.householdId,
          'ROLLBACK',
          reverseMutations,
          log.SK
        );
      }

      rollbackSummary.push({
        logSK: log.SK,
        reversedMutations: reverseMutations.length,
      });
    }

    return NextResponse.json({
      message: `Successfully rolled back ${logsToReverse.length} audit entries.`,
      rollbackSummary,
    });
  } catch (error) {
    console.error("Rollback failed:", error);
    return NextResponse.json({ error: "Rollback failed" }, { status: 500 });
  }
}
