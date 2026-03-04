import { db, TABLE_NAME } from "../src/lib/db";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function test() {
    const PROFILE_KEY = `PROFILE#phbfreitas@gmail.com`;
    const result = await db.send(
        new QueryCommand({
            TableName: TABLE_NAME,
            KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
            ExpressionAttributeValues: {
                ":pk": PROFILE_KEY,
                ":skPrefix": "ASSET#",
            },
        })
    );
    console.log(`Found ${result.Items?.length} items`);
    if (result.Items && result.Items.length > 0) {
        console.log("First item:", result.Items[0]);
    }
}
test();
