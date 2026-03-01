import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

// DELETE /api/assets/[id] - Deletes an asset
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.email) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const PROFILE_KEY = `PROFILE#${session.user.email}`;
        const resolvedParams = await params;
        const id = resolvedParams.id;
        const assetSK = `ASSET#${id}`;

        await db.send(
            new DeleteCommand({
                TableName: TABLE_NAME,
                Key: {
                    PK: PROFILE_KEY,
                    SK: assetSK,
                }
            })
        );

        return NextResponse.json({ message: "Asset deleted successfully" });
    } catch (error) {
        console.error("Failed to delete asset:", error);
        return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
    }
}
