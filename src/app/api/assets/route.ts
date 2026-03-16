import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// POST /api/assets - Adds a new manual asset row
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;
        const data = await request.json();

        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: { PK: PROFILE_KEY, SK: "META" },
            })
        );

        if (!profile) {
            return NextResponse.json({ error: "Please setup your profile first" }, { status: 400 });
        }

        const assetId = uuidv4();
        const assetSK = `ASSET#${assetId}`;

        const asset = {
            PK: PROFILE_KEY,
            SK: assetSK,
            id: assetId,
            profileId: PROFILE_KEY,
            type: "ASSET",

            account: data.account || "",
            ticker: data.ticker || "",
            securityType: data.securityType || "",
            strategyType: data.strategyType || "",
            call: data.call || "",
            sector: data.sector || "",
            market: data.market || "",
            currency: data.currency || "",
            managementStyle: data.managementStyle || "",
            externalRating: data.externalRating || "",

            managementFee: parseFloat(data.managementFee) || 0,
            quantity: parseFloat(data.quantity) || 0,
            liveTickerPrice: parseFloat(data.liveTickerPrice) || 0,
            bookCost: parseFloat(data.bookCost) || 0,
            marketValue: parseFloat(data.marketValue) || 0,
            profitLoss: parseFloat(data.profitLoss) || 0,
            yield: parseFloat(data.yield) || 0,
            oneYearReturn: parseFloat(data.oneYearReturn) || 0,
            fiveYearReturn: parseFloat(data.fiveYearReturn) || 0,
            risk: data.risk || "",
            volatility: parseFloat(data.volatility) || 0,
            expectedAnnualDividends: parseFloat(data.expectedAnnualDividends) || 0,

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
