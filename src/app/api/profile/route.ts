import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `PROFILE#${session.user.email}`;

        // Fetch the profile
        const { Item: profile } = await db.send(
            new GetCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: PROFILE_KEY,
                    SK: PROFILE_KEY,
                },
            })
        );

        // Fetch associated assets
        const { Items: assets } = await db.send(
            new QueryCommand({
                TableName: TABLE_NAME,
                KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
                ExpressionAttributeValues: {
                    ":pk": PROFILE_KEY,
                    ":skPrefix": "ASSET#",
                },
            })
        );

        const responseData = profile ? { ...profile, assets: assets || [] } : {};
        return NextResponse.json(responseData);
    } catch (error) {
        console.error("Failed to fetch profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `PROFILE#${session.user.email}`;
        const data = await request.json();

        // Put operation naturally updates or creates
        const profileData = {
            PK: PROFILE_KEY,
            SK: PROFILE_KEY,
            type: "PROFILE",
            strategy: data.strategy,
            riskTolerance: data.riskTolerance,
            goals: data.goals,
            monthlyIncome: data.monthlyIncome,
            monthlyExpenses: data.monthlyExpenses,
            cashReserves: data.cashReserves,
            updatedAt: new Date().toISOString(),
        };

        await db.send(
            new PutCommand({
                TableName: TABLE_NAME,
                Item: profileData,
            })
        );

        return NextResponse.json(profileData);
    } catch (error) {
        console.error("Failed to save profile:", error);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
}
