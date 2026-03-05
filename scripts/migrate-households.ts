import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";
import * as crypto from "crypto";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function migrateToHousehold() {
    const primaryEmail = "phbfreitas2@gmail.com";
    const secondaryEmail = "sialvesamaral@gmail.com";

    // Generate the Master Household ID for the Freitas family
    const householdUUID = crypto.randomUUID();
    const targetHouseholdPk = `HOUSEHOLD#${householdUUID}`;

    console.log(`\n--- Starting Migration to Household Workspace ---`);
    console.log(`Generated Master Household ID: ${targetHouseholdPk}`);

    try {
        // 1. Map both emails to this Household ID in DynamoDB
        // This is the auth lookup table logic: PK=USER#email, SK=USER#email, householdId=targetHouseholdPk
        console.log(`\n1. Creating User -> Household Identity Mappings...`);
        const users = [primaryEmail, secondaryEmail];

        for (const email of users) {
            console.log(`Linking ${email} -> ${targetHouseholdPk}`);
            await db.send(
                new PutCommand({
                    TableName: TABLE_NAME,
                    Item: {
                        PK: `USER#${email}`,
                        SK: `USER#${email}`,
                        email: email,
                        householdId: householdUUID, // Store the raw UUID
                        role: "ADMIN",
                        updatedAt: new Date().toISOString()
                    }
                })
            );
        }

        // 2. Fetch all existing data from the fully-merged primary profile
        console.log(`\n2. Fetching existing unified data from PROFILE#${primaryEmail}...`);
        const result = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk",
                ExpressionAttributeValues: {
                    ":pk": `PROFILE#${primaryEmail}`
                }
            })
        );
        const dataToMigrate = result.Items || [];
        console.log(`Found ${dataToMigrate.length} rows to migrate.`);

        // 3. Clone all rows to the new HOUSEHOLD partition
        console.log(`\n3. Migrating data rows to ${targetHouseholdPk}...`);
        for (const item of dataToMigrate) {
            const newItem = { ...item };

            // Re-point the partition key
            newItem.PK = targetHouseholdPk;

            // Clean up the Sort Key (if it still references the raw old email PROFILE row, change it to META)
            if (newItem.SK === `PROFILE#${primaryEmail}` || newItem.SK.startsWith("PROFILE#")) {
                newItem.SK = "META";
            }
            // For ASSETS and CASHFLOW, the SK stays exactly the same (e.g., ASSET#AAPL)

            newItem.migratedAt = new Date().toISOString();

            await db.send(
                new PutCommand({
                    TableName: TABLE_NAME,
                    Item: newItem
                })
            );
        }

        console.log(`\nMigration completed successfully!`);
        console.log(`Household UUID to use in testing: ${householdUUID}`);

    } catch (e) {
        console.error("Migration failed:", e);
    }
}

migrateToHousehold();
