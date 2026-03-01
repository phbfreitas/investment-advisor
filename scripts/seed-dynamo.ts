import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, QueryCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Configure AWS credentials from environment
const clientConfig: any = {
    region: process.env.AWS_REGION || "us-east-1",
};

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    clientConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
}

const dynamoClient = new DynamoDBClient(clientConfig);
const db = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";
const PROFILE_ID = "DEFAULT";
const PROFILE_KEY = `PROFILE#${PROFILE_ID}`;

async function seedData() {
    console.log("Starting database seed to DynamoDB table:", TABLE_NAME);

    // 0. Wipe previously inserted bad assets
    try {
        const { Items: existingAssets } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "ASSET#",
                },
            })
        );
        if (existingAssets && existingAssets.length > 0) {
            console.log(`Found ${existingAssets.length} old assets. Wiping them out...`);
            for (const asset of existingAssets) {
                await db.send(new DeleteCommand({ TableName: TABLE_NAME, Key: { PK: asset.PK, SK: asset.SK } }));
            }
            console.log("✅ Wiped old assets");
        }
    } catch (e) { console.error("Could not wipe existing assets:", e); }

    const profileCommand = new PutCommand({
        TableName: TABLE_NAME,
        Item: {
            PK: PROFILE_KEY,
            SK: PROFILE_KEY,
            id: PROFILE_ID,
            type: "PROFILE",
            strategy: "I focus on dividend growth for passive income, while keeping 20% in speculative tech. I prefer holding long term and avoiding high-frequency trading.",
            riskTolerance: "Moderate",
            goals: "Retire by 55 with absolute financial independence. Save $50k for a house downpayment in 3 years.",
            monthlyIncome: 12000,
            monthlyExpenses: 6000,
            cashReserves: 50000,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
    });

    try {
        await db.send(profileCommand);
        console.log("✅ Seeded FinancialProfile");
    } catch (error) {
        console.error("❌ Error seeding profile:", error);
    }

    // 2. Add Dummy Assets with CORRECT SCHEMA
    const assets = [
        {
            ticker: "AAPL",
            name: "Apple Inc.",
            quantity: 50,
            averageCost: 150.0,
            currentPrice: 175.0,
            assetType: "Stock",
            currency: "USD",
        },
        {
            ticker: "VOO",
            name: "Vanguard S&P 500 ETF",
            quantity: 100,
            averageCost: 380.0,
            currentPrice: 450.0,
            assetType: "ETF",
            currency: "USD",
        },
        {
            ticker: "Cash",
            name: "High Yield Savings earning 4%",
            quantity: 1,
            averageCost: 50000.0,
            currentPrice: 50000.0,
            assetType: "Cash",
            currency: "USD",
        },
    ];

    for (const asset of assets) {
        const assetId = uuidv4();
        const assetCommand = new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: PROFILE_KEY,
                SK: `ASSET#${assetId}`,
                id: assetId,
                profileId: PROFILE_KEY,
                ticker: asset.ticker,
                name: asset.name,
                quantity: asset.quantity,
                averageCost: asset.averageCost,
                currentPrice: asset.currentPrice,
                assetType: asset.assetType,
                currency: asset.currency,
                institution: "Manual",
                type: "ASSET",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            },
        });

        try {
            await db.send(assetCommand);
            console.log(`✅ Seeded Asset: ${asset.name}`);
        } catch (error) {
            console.error(`❌ Error seeding asset ${asset.name}:`, error);
        }
    }

    console.log("Database seeding complete!");
}

seedData();
