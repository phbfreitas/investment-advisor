import { db, TABLE_NAME } from "../src/lib/db";
import { QueryCommand, DeleteCommand, PutCommand } from "@aws-sdk/lib-dynamodb";

const OLD_PK = "PROFILE#DEFAULT";
const NEW_PK = "PROFILE#phbfreitas2@gmail.com";

async function run() {
    console.log(`Starting data migration from ${OLD_PK} to ${NEW_PK}...`);

    // 1. Fetch all items under the old profile key
    const { Items } = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk",
            ExpressionAttributeValues: { ":pk": OLD_PK },
        })
    );

    if (!Items || Items.length === 0) {
        console.log("No legacy data found under the old key!");
        return;
    }

    console.log(`Found ${Items.length} legacy items. Migrating...`);

    // 2. Iterate through each item, create a new one, and delete the old one
    // DynamoDB Partition Keys cannot be updated in place. We must Put new and Delete old.
    for (const item of Items) {
        // Determine the new SK
        // If the SK was PROFILE#DEFAULT, it needs to be updated to the new email too.
        // If it was an ASSET#123, the SK can stay the same.
        const newSK = item.SK === OLD_PK ? NEW_PK : item.SK;

        // Create the updated item payload
        const migratedItem = {
            ...item,
            PK: NEW_PK,
            SK: newSK,
        };

        // If the item had a profileId reference pointing to the old key, update it
        if ((migratedItem as any).profileId === OLD_PK) {
            (migratedItem as any).profileId = NEW_PK;
        }

        // Insert the new record
        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: migratedItem,
            })
        );
        console.log(`Copied   : ${newSK}`);

        // Delete the old record
        await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: { PK: item.PK, SK: item.SK },
            })
        );
        console.log(`Deleted  : ${item.SK} (Old Key)`);
    }

    console.log("✅ All legacy data successfully migrated to your email!");
}

run().catch(console.error);
