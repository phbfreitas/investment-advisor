import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function runSync() {
    const sourceEmail = "sialvesamaral@gmail.com";
    const targetEmail = "phbfreitas2@gmail.com";

    const sourcePk = `PROFILE#${sourceEmail}`;
    const targetPk = `PROFILE#${targetEmail}`;

    console.log(`Fetching data from ${sourcePk}...`);

    // 1. Fetch source profile data
    const result = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": sourcePk
            }
        })
    );

    const allSourceItems = result.Items || [];

    // 2. Filter out ASSET records
    const itemsToCopy = allSourceItems.filter(item => !item.SK.startsWith("ASSET#"));

    console.log(`Found ${itemsToCopy.length} records to copy (excluded ${allSourceItems.length - itemsToCopy.length} assets)`);

    // 3. Migrate and Put each item into the target profile
    for (const item of itemsToCopy) {
        // Deep copy the item
        const targetItem = { ...item };

        // Change the Partition Key
        targetItem.PK = targetPk;

        // Change the Sort Key if it contains the source email (e.g., PROFILE#...)
        if (targetItem.SK.includes(sourceEmail)) {
            targetItem.SK = targetItem.SK.replace(sourceEmail, targetEmail);
        }

        targetItem.updatedAt = new Date().toISOString();

        console.log(`Saving ${targetItem.SK} to ${targetPk}...`);

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: targetItem
            })
        );
    }

    console.log("Sync complete!");
}

runSync().catch(console.error);
