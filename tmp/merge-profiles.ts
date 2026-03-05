import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function mergeProfiles() {
    const sourceEmail = "sialvesamaral@gmail.com";
    const targetEmail = "phbfreitas2@gmail.com";

    const sourcePk = `PROFILE#${sourceEmail}`;
    const targetPk = `PROFILE#${targetEmail}`;

    console.log(`Fetching data from ${sourcePk}...`);

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

    // Find both parts of sialvesamaral's profile
    const strategyData = allSourceItems.find(i => i.SK === `PROFILE#${sourceEmail}`) || {};
    const budgetData = allSourceItems.find(i => i.SK === `PROFILE#${targetEmail}`) || {};

    // Merge them into one clean object
    const mergedProfile = { ...budgetData, ...strategyData };

    // Clean up partition / sort keys
    mergedProfile.PK = targetPk;
    mergedProfile.SK = targetPk;
    mergedProfile.updatedAt = new Date().toISOString();

    console.log(`Saving properly merged profile to ${targetPk}...`);
    await db.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: mergedProfile
        })
    );

    console.log("Merge complete!");
}

mergeProfiles().catch(console.error);
