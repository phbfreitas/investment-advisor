import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand, BatchWriteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import Papa from "papaparse";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;

        const formData = await request.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const text = await file.text();

        // Wealthsimple CSVs typically have columns like:
        // Date, Action, Symbol, Description, Quantity, Price, Currency, Exchange Rate, Value
        const result = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
        });

        interface CsvRow {
            Symbol?: string;
            Action?: string;
            Quantity?: string;
            Price?: string;
            Currency?: string;
        }
        const data = result.data as CsvRow[];

        // Very basic aggregation for MVP: 
        const holdings = new Map<string, { quantity: number; totalCost: number; currency: string }>();

        data.forEach(row => {
            if (!row.Symbol || !row.Action) return;

            const symbol = row.Symbol;
            const action = row.Action.toLowerCase();
            const qty = parseFloat(row.Quantity || "0");
            const price = parseFloat(row.Price || "0");

            if (action.includes("buy")) {
                const current = holdings.get(symbol) || { quantity: 0, totalCost: 0, currency: row.Currency || "CAD" };
                current.quantity += qty;
                current.totalCost += (qty * price);
                holdings.set(symbol, current);
            } else if (action.includes("sell")) {
                const current = holdings.get(symbol) || { quantity: 0, totalCost: 0, currency: row.Currency || "CAD" };
                current.quantity -= qty;
                const avgPrice = current.quantity > 0 ? current.totalCost / (current.quantity + qty) : 0;
                current.totalCost -= (qty * avgPrice);

                if (current.quantity <= 0) {
                    holdings.delete(symbol);
                } else {
                    holdings.set(symbol, current);
                }
            }
        });

        // Ensure profile exists
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        if (!profile) {
            return NextResponse.json({ error: "Please setup your Financial Brain profile first" }, { status: 400 });
        }

        // 1. Find all existing Wealthsimple assets to delete
        const { Items: existingAssets } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                FilterExpression: "institution = :inst",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "ASSET#",
                    ":inst": "Wealthsimple"
                }
            })
        );

        type WriteRequest =
            | { PutRequest: { Item: Record<string, unknown> } }
            | { DeleteRequest: { Key: { PK: string; SK: string } } };
        const writeRequests: WriteRequest[] = [];

        // Add Delete requests for old assets
        if (existingAssets) {
            existingAssets.forEach((asset: Record<string, unknown>) => {
                writeRequests.push({
                    DeleteRequest: {
                        Key: { PK: asset.PK, SK: asset.SK }
                    }
                });
            });
        }

        // Add Put requests for new aggregated assets
        Array.from(holdings.entries()).forEach(([ticker, data]) => {
            const assetId = uuidv4();
            writeRequests.push({
                PutRequest: {
                    Item: {
                        PK: PROFILE_KEY,
                        SK: `ASSET#${assetId}`,
                        id: assetId,
                        profileId: PROFILE_KEY,
                        type: "ASSET",
                        ticker: ticker,
                        name: ticker,
                        assetType: "STOCK",
                        quantity: data.quantity,
                        averageCost: data.totalCost / data.quantity,
                        currentPrice: data.totalCost / data.quantity, // fallback
                        currency: data.currency,
                        institution: "Wealthsimple",
                        isManuallyAdded: false,
                        updatedAt: new Date().toISOString()
                    }
                }
            });
        });

        // DynamoDB BatchWriteItem has a limit of 25 operations per request
        const chunkSize = 25;
        for (let i = 0; i < writeRequests.length; i += chunkSize) {
            const chunk = writeRequests.slice(i, i + chunkSize);
            await db.send(
                new BatchWriteCommand({
                    RequestItems: {
                        [TABLE_NAME]: chunk
                    }
                })
            );
        }

        return NextResponse.json({ message: "Portfolio synced successfully", count: holdings.size });
    } catch (error) {
        console.error("Failed to process portfolio CSV:", error);
        return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
    }
}
