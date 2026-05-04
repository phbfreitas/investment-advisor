import { NextResponse } from "next/server";
import { db, rawDb_unclassifiedOnly, TABLE_NAME } from "@/lib/db";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertAuditLog } from "@/lib/auditLog";
import { toSnapshot } from "@/lib/assetSnapshot";
import type { LockableField } from "@/types";

export const dynamic = "force-dynamic";

const LOCKABLE_FIELDS: ReadonlyArray<LockableField> = [
    "sector",
    "market",
    "securityType",
    "strategyType",
    "call",
    "managementStyle",
    "currency",
    "managementFee",
    "exchange",
];

function isLockableField(value: unknown): value is LockableField {
    return typeof value === "string" && (LOCKABLE_FIELDS as readonly string[]).includes(value);
}

/**
 * PATCH /api/assets/[id]/lock
 *
 * Body: { field: LockableField, locked: boolean, expectedUpdatedAt?: string }
 *
 * Atomically toggles a single key in `userOverrides` for one asset using a DynamoDB
 * UpdateCommand. Optimistic concurrency: if `expectedUpdatedAt` is provided, the
 * update only succeeds when the asset's current `updatedAt` matches.
 *
 * This endpoint is intentionally narrower than the full PUT route so that a stale
 * tab toggling a lock cannot overwrite unrelated fields edited elsewhere.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const assetSK = `ASSET#${id}`;
        const data = await request.json();

        if (!isLockableField(data.field)) {
            return NextResponse.json({ error: "Invalid field" }, { status: 400 });
        }
        if (typeof data.locked !== "boolean") {
            return NextResponse.json({ error: "Invalid 'locked' value" }, { status: 400 });
        }

        // Fetch the asset for audit before/after snapshots and to detect 404.
        const { Item: existingAsset } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: assetSK },
            })
        );

        if (!existingAsset) {
            return NextResponse.json({ error: "Asset not found" }, { status: 404 });
        }

        const newUpdatedAt = new Date().toISOString();
        const expectedUpdatedAt: string | undefined = typeof data.expectedUpdatedAt === "string"
            ? data.expectedUpdatedAt
            : undefined;

        const expressionAttributeNames: Record<string, string> = {
            "#field": data.field,
        };
        const expressionAttributeValues: Record<string, unknown> = {
            ":locked": data.locked,
            ":newUpdatedAt": newUpdatedAt,
            ":emptyMap": {},
        };

        // Single SET clause: initialize userOverrides if missing, then assign the field
        // and bump updatedAt. DynamoDB applies all assignments in one atomic update.
        const updateExpression =
            `SET userOverrides = if_not_exists(userOverrides, :emptyMap), ` +
            `userOverrides.#field = :locked, ` +
            `updatedAt = :newUpdatedAt`;

        // Optimistic concurrency: only update if updatedAt hasn't changed since the client
        // last read. If the client didn't send expectedUpdatedAt, skip the condition (legacy path).
        const conditionExpression = expectedUpdatedAt
            ? `updatedAt = :expectedUpdatedAt`
            : undefined;
        if (expectedUpdatedAt) {
            expressionAttributeValues[":expectedUpdatedAt"] = expectedUpdatedAt;
        }

        // SAFETY INVARIANT: this route only writes to userOverrides (and updatedAt). If
        // either field is ever added to FIELD_CLASSIFICATIONS in
        // src/lib/encryption/field-classification.ts, this raw-client bypass MUST be
        // replaced with a Get → modify → PutCommand round-trip (which routes through
        // the encrypted wrapper).
        // UpdateCommand against the encrypted client throws by design. When the
        // partial-update pattern needs classified fields, the route must Get → modify →
        // PutCommand instead, which round-trips through encryption.
        try {
            await rawDb_unclassifiedOnly.send(
                new UpdateCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: assetSK },
                    UpdateExpression: updateExpression,
                    ExpressionAttributeNames: expressionAttributeNames,
                    ExpressionAttributeValues: expressionAttributeValues,
                    ConditionExpression: conditionExpression,
                    ReturnValues: "ALL_NEW",
                })
            );
        } catch (err: unknown) {
            // ConditionalCheckFailedException → 409 Conflict so the client can refetch and retry.
            if (
                typeof err === "object" &&
                err !== null &&
                "name" in err &&
                (err as { name: string }).name === "ConditionalCheckFailedException"
            ) {
                return NextResponse.json(
                    { error: "Asset was modified by another session. Refresh and try again." },
                    { status: 409 }
                );
            }
            throw err;
        }

        // Step 1 (UpdateCommand) committed successfully here.
        // Steps 2 (refetch) and 3 (audit-log) are best-effort: failures must not
        // surface as 500 to the user, since the lock state has already changed.
        // Log them server-side for operator visibility.
        let updatedAsset: Record<string, unknown> | undefined;
        try {
            const refetch = await db.send(
                new GetCommand({
                    TableName: TABLE_NAME,
                    Key: { PK: PROFILE_KEY, SK: assetSK },
                })
            );
            updatedAsset = refetch.Item;
        } catch (refetchErr) {
            console.error("[lock-PATCH] post-commit refetch failed (lock state DID change):", refetchErr);
        }

        if (updatedAsset) {
            try {
                await insertAuditLog(
                    session.user.householdId,
                    "MANUAL_EDIT",
                    [
                        {
                            action: "UPDATE",
                            ticker: String(updatedAsset.ticker || ""),
                            assetSK,
                            before: toSnapshot(existingAsset),
                            after: toSnapshot(updatedAsset),
                        },
                    ],
                    String(updatedAsset.ticker || "")
                );
            } catch (auditErr) {
                console.error("[lock-PATCH] post-commit audit-log write failed (lock state DID change):", auditErr);
            }
        }

        return NextResponse.json({ message: "Lock state updated", asset: updatedAsset });
    } catch (error) {
        console.error("Failed to update lock state:", error);
        return NextResponse.json({ error: "Failed to update lock state" }, { status: 500 });
    }
}
