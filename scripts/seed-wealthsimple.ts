import * as fs from 'fs';
import * as path from 'path';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Simple CSV parser
function parseCSV(content: string) {
    const lines = content.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
            obj[header] = values[index]?.trim();
        });
        return obj;
    });
}

// AWS Auth
const clientConfig: any = { region: process.env.AWS_REGION || "us-east-1" };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
}

const dynamoClient = new DynamoDBClient(clientConfig);
const db = DynamoDBDocumentClient.from(dynamoClient, { marshallOptions: { removeUndefinedValues: true } });

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";
const PROFILE_KEY = "PROFILE#DEFAULT";

async function seedWealthsimple() {
    console.log("Starting Wealthsimple CSV import to DynamoDB...");
    try {
        const csvPath = path.join(process.cwd(), 'dummy_wealthsimple.csv');
        const csvData = fs.readFileSync(csvPath, 'utf8');
        const rows = parseCSV(csvData);

        // Group by Symbol
        const assetMap = new Map<string, any>();
        for (const row of rows) {
            const symbol = row.Symbol;
            if (!symbol) continue;

            const quantity = parseFloat(row.Quantity) || 0;
            const price = parseFloat(row.Price) || 0;
            const value = parseFloat(row.Value) || 0;

            if (!assetMap.has(symbol)) {
                assetMap.set(symbol, {
                    ticker: symbol,
                    name: row.Description || symbol,
                    quantity: 0,
                    totalCost: 0,
                    currency: row.Currency || "CAD",
                });
            }

            const current = assetMap.get(symbol)!;
            if (row.Action === "Buy") {
                current.quantity += quantity;
                current.totalCost += value;
            } else if (row.Action === "Sell") {
                current.quantity -= quantity;
                current.totalCost -= (current.totalCost / (current.quantity + quantity)) * quantity;
            }
        }

        // Delete existing Wealthsimple assets
        const { Items: oldAssets } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: { ":pk": PROFILE_KEY, ":skPrefix": "ASSET#" },
            })
        );

        const deleteRequests = (oldAssets || [])
            .filter(a => a.institution === "Wealthsimple")
            .map(a => ({
                DeleteRequest: { Key: { PK: a.PK, SK: a.SK } }
            }));

        if (deleteRequests.length > 0) {
            console.log(`Deleting ${deleteRequests.length} old Wealthsimple assets...`);
            await db.send(new BatchWriteCommand({
                RequestItems: { [TABLE_NAME]: deleteRequests }
            }));
        }

        // Insert new aggregated assets
        const putRequests = [];
        for (const [symbol, data] of assetMap.entries()) {
            if (data.quantity <= 0) continue;

            const assetId = uuidv4();
            putRequests.push({
                PutRequest: {
                    Item: {
                        PK: PROFILE_KEY,
                        SK: `ASSET#${assetId}`,
                        id: assetId,
                        profileId: PROFILE_KEY,
                        ticker: data.ticker,
                        name: data.name,
                        quantity: data.quantity,
                        averageCost: data.totalCost / data.quantity,
                        assetType: "STOCK",
                        currency: data.currency,
                        institution: "Wealthsimple",
                        type: "ASSET",
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    }
                }
            });
            console.log(`Prepared asset: ${data.ticker} (${data.quantity} shares)`);
        }

        if (putRequests.length > 0) {
            await db.send(new BatchWriteCommand({
                RequestItems: { [TABLE_NAME]: putRequests }
            }));
            console.log(`✅ Successfully seeded ${putRequests.length} Wealthsimple assets!`);
        } else {
            console.log("No valid assets to insert.");
        }

    } catch (e) {
        console.error("Failed to seed Wealthsimple data:", e);
    }
}

seedWealthsimple();
