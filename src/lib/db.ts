import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const globalForDynamo = globalThis as unknown as {
    dynamoClient: DynamoDBClient | undefined;
};

export const dynamoClient =
    globalForDynamo.dynamoClient ??
    new DynamoDBClient({
        region: process.env.AWS_REGION || "us-east-1",
    });

export const db = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

if (process.env.NODE_ENV !== "production") globalForDynamo.dynamoClient = dynamoClient;

// Table Name constant
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";
