import { db, TABLE_NAME } from "../src/lib/db";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

async function listProfiles() {
    const result = await db.send(
        new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: "#typ = :type",
            ExpressionAttributeNames: {
                "#typ": "type"
            },
            ExpressionAttributeValues: {
                ":type": "PROFILE"
            }
        })
    );
    console.log("Profiles in DB:", result.Items?.map((i: Record<string, unknown>) => i.PK));
}

listProfiles();
