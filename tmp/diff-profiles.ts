import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";
import * as fs from "fs";

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

async function findDifferences() {
    const p1 = "phbfreitas2@gmail.com";
    const p2 = "sialvesamaral@gmail.com";

    const data1 = await getProfileData(p1);
    const data2 = await getProfileData(p2);

    const keys1 = data1.map(i => i.SK);
    const keys2 = data2.map(i => i.SK);

    const onlyIn1 = keys1.filter(k => !keys2.includes(k));
    const onlyIn2 = keys2.filter(k => !keys1.includes(k));

    let output = "";

    output += `--- Items only in ${p1} ---\n`;
    onlyIn1.forEach(k => { output += `${k}: ${JSON.stringify(data1.find(i => i.SK === k), null, 2)}\n`; });

    output += `\n--- Items only in ${p2} ---\n`;
    onlyIn2.forEach(k => { output += `${k}: ${JSON.stringify(data2.find(i => i.SK === k), null, 2)}\n`; });

    output += `\n--- Items with different content ---\n`;
    const commonKeys = keys1.filter(k => keys2.includes(k));
    commonKeys.forEach(k => {
        const item1 = data1.find(i => i.SK === k);
        const item2 = data2.find(i => i.SK === k);

        const norm1 = { ...item1 };
        delete norm1.PK;
        delete norm1.updatedAt;

        const norm2 = { ...item2 };
        delete norm2.PK;
        delete norm2.updatedAt;

        // deep equality check since keys might be ordered differently
        const isMatch = JSON.stringify(Object.keys(norm1).sort().map(key => norm1[key])) ===
            JSON.stringify(Object.keys(norm2).sort().map(key => norm2[key]));

        if (!isMatch) {
            output += `\nDifference in SK: ${k}\n`;
            output += `${p1}:\n${JSON.stringify(norm1, null, 2)}\n`;
            output += `${p2}:\n${JSON.stringify(norm2, null, 2)}\n`;
        }
    });

    fs.writeFileSync("tmp/diff-output-utf8.txt", output, "utf-8");
    console.log("Done. Wrote to tmp/diff-output-utf8.txt");
}

findDifferences().catch(console.error);
