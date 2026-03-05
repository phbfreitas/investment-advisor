import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const client = new DynamoDBClient({ region: process.env.AWS_REGION || "us-east-1" });
const db = DynamoDBDocumentClient.from(client);
const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

async function debug() {
    console.log("Fetching phbfreitas2@gmail.com...");
    const res = await db.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: "USER#phbfreitas2@gmail.com",
            SK: "USER#phbfreitas2@gmail.com"
        }
    }));
    console.log(res.Item);

    console.log("Scanning all users...");
    const scanRes = await db.send(new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "begins_with(PK, :prefix)",
        ExpressionAttributeValues: { ":prefix": "USER#" }
    }));
    console.log(scanRes.Items);
}

debug();
