import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { KMSClient } from "@aws-sdk/client-kms";
import { EncryptedDocumentClient } from "./encryption/encrypted-client";
import { createKeyProvider } from "./encryption/key-provider";
import { FIELD_CLASSIFICATIONS } from "./encryption/field-classification";

const globalForDynamo = globalThis as unknown as {
    dynamoClient: DynamoDBClient | undefined;
};

export const dynamoClient =
    globalForDynamo.dynamoClient ??
    new DynamoDBClient({
        region: process.env.AWS_REGION || "us-east-1",
    });

const rawDb = DynamoDBDocumentClient.from(dynamoClient, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});

// Table Name constant
export const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";

if (process.env.NODE_ENV !== "development" && !process.env.KMS_KEY_ID) {
    throw new Error("KMS_KEY_ID must be set in non-development environments. Refusing to start without encryption.");
}

// When KMS_KEY_ID is set (staging/production): encrypt/decrypt transparently.
// When KMS_KEY_ID is not set (local dev): bypass encryption entirely.
export const db = process.env.KMS_KEY_ID
    ? new EncryptedDocumentClient(
        rawDb,
        createKeyProvider(
            { kmsKeyId: process.env.KMS_KEY_ID, tableName: TABLE_NAME },
            rawDb,
            new KMSClient({ region: process.env.AWS_REGION || "us-east-1" })
        ),
        FIELD_CLASSIFICATIONS
    )
    : rawDb;

if (process.env.NODE_ENV !== "production") globalForDynamo.dynamoClient = dynamoClient;
