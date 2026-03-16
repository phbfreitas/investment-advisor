import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;

        const { Items } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "CASHFLOW#",
                },
            })
        );

        return NextResponse.json(Items || []);
    } catch (error) {
        console.error("Failed to fetch cashflow", error);
        return NextResponse.json({ error: "Failed to fetch cashflow" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;
        const cashflows = await request.json();

        if (!Array.isArray(cashflows)) {
            return NextResponse.json({ error: "Expected an array of cashflows" }, { status: 400 });
        }

        // 1. Get existing cashflow items to find any that were deleted in the UI
        const existingData = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: { ":pk": PROFILE_KEY, ":skPrefix": "CASHFLOW#" },
            })
        );
        const existingKeys = (existingData.Items || []).map(item => item.SK);
        const incomingKeys = cashflows.map(cf => `CASHFLOW#${cf.year}-${cf.month}`);

        const deleteKeys = existingKeys.filter(sk => !incomingKeys.includes(sk));

        // 2. Prepare Batch Write Requests (max 25 per batch)
        type WriteRequest =
            | { PutRequest: { Item: Record<string, unknown> } }
            | { DeleteRequest: { Key: { PK: string; SK: string } } };
        const writeRequests: WriteRequest[] = [];

        // Add Deletes
        for (const sk of deleteKeys) {
            writeRequests.push({
                DeleteRequest: {
                    Key: { PK: PROFILE_KEY, SK: sk }
                }
            });
        }

        // Add Puts
        for (const cf of cashflows) {
            writeRequests.push({
                PutRequest: {
                    Item: {
                        PK: PROFILE_KEY,
                        SK: `CASHFLOW#${cf.year}-${cf.month}`,
                        year: cf.year,
                        month: cf.month,
                        income: cf.income,
                        expenses: cf.expenses,
                        cashReserves: cf.cashReserves,
                        updatedAt: new Date().toISOString()
                    }
                }
            });
        }

        // Execute BatchWrite in chunks of 25
        for (let i = 0; i < writeRequests.length; i += 25) {
            const chunk = writeRequests.slice(i, i + 25);
            if (chunk.length > 0) {
                await db.send(
                    new BatchWriteCommand({
                        RequestItems: {
                            [TABLE_NAME]: chunk
                        }
                    })
                );
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Failed to save cashflow", error);
        return NextResponse.json({ error: "Failed to save cashflow" }, { status: 500 });
    }
}
