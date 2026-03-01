import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, QueryCommand } from "@aws-sdk/lib-dynamodb";

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
const db = DynamoDBDocumentClient.from(dynamoClient);

async function test() {
    const TABLE_NAME = "InvestmentAdvisorData";
    console.log("Checking table:", TABLE_NAME);
    const { Items: assets } = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
            ExpressionAttributeValues: {
                ":pk": "PROFILE#DEFAULT",
                ":skPrefix": "ASSET#",
            },
        })
    );
    console.log("Found assets:", assets?.length);
    console.log(assets);
}
test();
