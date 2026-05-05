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

// NEXT_PHASE is "phase-production-build" during `next build` — skip the guard
// so the build can succeed without real AWS credentials. The guard still fires
// at runtime (when an actual request imports this module in production).
if (process.env.NEXT_PHASE !== "phase-production-build" &&
    process.env.NODE_ENV !== "development" &&
    !process.env.KMS_KEY_ID) {
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

// Exported for callers that intentionally bypass classification:
//  - UpdateCommand on unclassified fields (e.g., userOverrides). The
//    EncryptedDocumentClient throws on UpdateCommand by design (see
//    docs/superpowers/triage/2026-04-30-3A-deferred-followups.md Item 2
//    — partial updates can't safely encrypt expression values).
//  - Internal infra writes (e.g., audit log) that don't store classified
//    fields and don't need round-trip decryption.
//
// Use sparingly. If your data path involves any field listed in
// FIELD_CLASSIFICATIONS, use `db` (the encrypted wrapper) instead.
export const rawDb_unclassifiedOnly = rawDb;

if (process.env.NODE_ENV !== "production") globalForDynamo.dynamoClient = dynamoClient;
