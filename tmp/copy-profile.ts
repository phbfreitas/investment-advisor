import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function copyData(sourceEmail: string, targetEmail: string) {
    const sourcePk = `PROFILE#${sourceEmail}`;
    const targetPk = `PROFILE#${targetEmail}`;

    console.log(`Fetching records for ${sourceEmail}...`);
    const result = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": sourcePk
            }
        })
    );

    const items = result.Items || [];
    console.log(`Found ${items.length} records. Beginning copy to ${targetEmail}...`);

    for (const item of items) {
        const targetItem = { ...item, PK: targetPk };
        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: targetItem
            })
        );
    }

    console.log("Copy complete!");
}

copyData("phbfreitas2@gmail.com", "sialvesamaral@gmail.com").catch(console.error);
