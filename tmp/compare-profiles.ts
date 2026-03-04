import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function getProfileData(email: string) {
    const pk = `PROFILE#${email}`;
    const result = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: {
                ":pk": pk
            }
        })
    );
    return result.Items || [];
}

async function compare() {
    const p1 = "phbfreitas2@gmail.com";
    const p2 = "sialvesamaral@gmail.com";

    const data1 = await getProfileData(p1);
    const data2 = await getProfileData(p2);

    console.log(`\n--- Profile 1: ${p1} ---`);
    console.log(`Total Records: ${data1.length}`);
    const meta1 = data1.find(i => i.SK === "META");
    console.log(`Age: ${meta1?.age}, Risk: ${meta1?.riskTolerance}, Goal: ${meta1?.primaryGoal}`);
    const assets1 = data1.filter(i => i.SK.startsWith("ASSET#"));
    console.log(`Total Assets: ${assets1.length}`);

    console.log(`\n--- Profile 2: ${p2} ---`);
    console.log(`Total Records: ${data2.length}`);
    const meta2 = data2.find(i => i.SK === "META");
    console.log(`Age: ${meta2?.age}, Risk: ${meta2?.riskTolerance}, Goal: ${meta2?.primaryGoal}`);
    const assets2 = data2.filter(i => i.SK.startsWith("ASSET#"));
    console.log(`Total Assets: ${assets2.length}`);

    // Compare equality
    if (data1.length === 0 && data2.length === 0) {
        console.log("\nCONCLUSION: Both profiles are completely empty.");
        return;
    }

    // deep compare excluding PK
    const normalize = (items: any[]) => items.map(i => {
        const { PK, updatedAt, ...rest } = i;
        return rest;
    }).sort((a, b) => a.SK.localeCompare(b.SK));

    const norm1 = normalize(data1);
    const norm2 = normalize(data2);

    const isMatch = JSON.stringify(norm1) === JSON.stringify(norm2);
    console.log(`\nCONCLUSION: Are the profiles identical (excluding user ID & timestamps)? ${isMatch ? 'YES' : 'NO'}`);
}

compare().catch(console.error);
