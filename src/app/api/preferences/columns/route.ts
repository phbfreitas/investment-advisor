import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.householdId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `HOUSEHOLD#${session.user.householdId}`;
        const body = await request.json();
        const { columnVisibility } = body;

        if (!columnVisibility || typeof columnVisibility !== "object" || Array.isArray(columnVisibility)) {
            return NextResponse.json({ error: "columnVisibility must be an object" }, { status: 400 });
        }

        // Validate: all values must be boolean
        for (const [key, val] of Object.entries(columnVisibility)) {
            if (typeof val !== "boolean") {
                return NextResponse.json({ error: `columnVisibility["${key}"] must be a boolean` }, { status: 400 });
            }
        }

        const { Item: meta } = await db.send(new GetCommand({
            TableName: TABLE_NAME,
            Key: { PK: PROFILE_KEY, SK: "META" },
        }));

        if (!meta) {
            return NextResponse.json({ error: "Profile not found" }, { status: 404 });
        }

        await db.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                ...meta,
                columnVisibility: { ...(meta.columnVisibility ?? {}), ...columnVisibility },
                updatedAt: new Date().toISOString(),
            },
        }));

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Failed to update column visibility:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
