import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// DELETE /api/assets/[id] - Deletes an asset
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;

        // Ensure the profile exists, optional check
        const profile = await prisma.financialProfile.findFirst();
        if (!profile) {
            return NextResponse.json({ error: "Profile not found" }, { status: 400 });
        }

        await prisma.asset.delete({
            where: { id: id, profileId: profile.id }
        });

        return NextResponse.json({ message: "Asset deleted successfully" });
    } catch (error) {
        console.error("Failed to delete asset:", error);
        return NextResponse.json({ error: "Failed to delete asset" }, { status: 500 });
    }
}
