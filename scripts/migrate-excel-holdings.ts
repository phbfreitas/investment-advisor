import * as xlsx from 'xlsx';
import { db, TABLE_NAME } from "../src/lib/db";
import { QueryCommand, BatchWriteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import * as dotenv from "dotenv";

// Load environment variables for local execution outside of Next.js
dotenv.config({ path: ".env.local" });

const PROFILE_EMAIL = "phbfreitas2@gmail.com"; // Defaulting to the known user for testing

async function migrate() {
    console.log(`Starting migration for profile: ${PROFILE_EMAIL}`);
    const PROFILE_KEY = `PROFILE#${PROFILE_EMAIL}`;

    // 1. Wipe old Assets
    console.log("Fetching existing assets to delete...");
    let existingAssets: any[] = [];
    try {
        const result = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "ASSET#",
                },
            })
        );
        existingAssets = result.Items || [];
    } catch (e) {
        console.error("Error fetching old assets. Double check AWS credentials.", e);
        process.exit(1);
    }

    console.log(`Found ${existingAssets.length} old assets. Deleting...`);
    const deleteRequests = existingAssets.map(asset => ({
        DeleteRequest: {
            Key: { PK: asset.PK, SK: asset.SK }
        }
    }));

    await executeBatchOperations(deleteRequests);
    console.log("Old assets wiped.");

    // 2. Read Excel
    console.log("Reading Excel file...");
    const workbook = xlsx.readFile('Stock and dividend overview_3Mar2026.xlsx');
    const sheetName = 'Breakdow stocks - 3Mar26';
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) {
        console.error(`Sheet "${sheetName}" not found.`);
        process.exit(1);
    }

    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    // Remove the header row
    const rows = data.slice(1);

    console.log(`Found ${rows.length} rows to import.`);

    const putRequests: any[] = [];

    const sanitizeNumber = (val: any) => {
        if (typeof val === 'number') return val;
        if (typeof val === 'string') {
            const parsed = parseFloat(val.replace(/[^0-9.-]+/g, ""));
            return isNaN(parsed) ? 0 : parsed;
        }
        return 0;
    };

    rows.forEach((row, idx) => {
        // Skip completely empty rows
        if (!row || row.length < 5 || !row[2]) return;

        const assetId = uuidv4();

        // Map based on the column indices outputted by our read-excel script
        const item = {
            PK: PROFILE_KEY,
            SK: `ASSET#${assetId}`,
            id: assetId,
            profileId: PROFILE_KEY,
            type: "ASSET",

            // Text Fields
            account: row[1] || "",               // B
            ticker: row[2] || "",                // C
            securityType: row[3] || "",          // D
            strategyType: row[4] || "",          // E
            call: row[5] || "",                  // F
            sector: row[6] || "",                // G
            market: row[7] || "",                // H
            currency: row[8] || "",              // I
            managementStyle: row[9] || "",       // J
            externalRating: row[22] || "",       // W

            // Numeric fields
            managementFee: sanitizeNumber(row[10]),      // K
            quantity: sanitizeNumber(row[11]),           // L (# tickers)
            liveTickerPrice: sanitizeNumber(row[12]),    // M
            bookCost: sanitizeNumber(row[13]),           // N
            marketValue: sanitizeNumber(row[14]),        // O
            profitLoss: sanitizeNumber(row[15]),         // P
            yield: sanitizeNumber(row[16]),              // Q
            oneYearReturn: sanitizeNumber(row[17]),      // R
            fiveYearReturn: sanitizeNumber(row[18]),     // S
            risk: row[19] || "",                         // T (Text)
            volatility: sanitizeNumber(row[20]),         // U
            expectedAnnualDividends: sanitizeNumber(row[21]), // V

            updatedAt: new Date().toISOString()
        };

        putRequests.push({
            PutRequest: {
                Item: item
            }
        });
    });

    console.log(`Prepared ${putRequests.length} PutRequests. Executing batch writes...`);
    await executeBatchOperations(putRequests);

    console.log("Migration complete!");
}

async function executeBatchOperations(requests: any[]) {
    const chunkSize = 25;
    for (let i = 0; i < requests.length; i += chunkSize) {
        const chunk = requests.slice(i, i + chunkSize);
        await db.send(
            new BatchWriteCommand({
                RequestItems: {
                    [TABLE_NAME]: chunk
                }
            })
        );
        process.stdout.write(".");
    }
    console.log("");
}

migrate();
