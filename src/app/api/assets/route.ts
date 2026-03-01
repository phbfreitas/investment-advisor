import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

export const dynamic = "force-dynamic";

const PROFILE_KEY = "PROFILE#DEFAULT";

// POST /api/assets - Adds a manual asset
export async function POST(request: Request) {
    try {
        const data = await request.json();

        // For MVP, look up the single profile
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: PROFILE_KEY },
            })
        );

        if (!profile) {
            return NextResponse.json({ error: "Please setup your Financial Brain profile first" }, { status: 400 });
        }

        const assetId = uuidv4();
        const assetSK = `ASSET#${assetId}`;

        const asset = {
            PK: PROFILE_KEY,
            SK: assetSK,
            id: assetId,
            profileId: PROFILE_KEY,
            type: "ASSET",
            ticker: data.ticker || "",
            name: data.name || "",
            assetType: data.assetType || "OTHER",
            quantity: parseFloat(data.quantity) || 0,
            averageCost: parseFloat(data.averageCost) || 0,
            currentPrice: parseFloat(data.averageCost) || 0, // Fallback until updated
            currency: data.currency || "USD",
            institution: data.institution || "Manual",
            isManuallyAdded: true,
            updatedAt: new Date().toISOString(),
        };

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: asset,
            })
        );

        return NextResponse.json({ message: "Asset added successfully", asset });
    } catch (error) {
        console.error("Failed to add manual asset:", error);
        return NextResponse.json({ error: "Failed to add manual asset" }, { status: 500 });
    }
}
