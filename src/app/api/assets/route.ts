import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/assets - Adds a manual asset
export async function POST(request: Request) {
    try {
        const data = await request.json();

        // For MVP, look up the single profile
        const profile = await prisma.financialProfile.findFirst();
        if (!profile) {
            return NextResponse.json({ error: "Please setup your Financial Brain profile first" }, { status: 400 });
        }

        const asset = await prisma.asset.create({
            data: {
                profileId: profile.id,
                ticker: data.ticker || "",
                name: data.name || "",
                assetType: data.assetType || "OTHER",
                quantity: parseFloat(data.quantity) || 0,
                averageCost: parseFloat(data.averageCost) || 0,
                currency: data.currency || "USD",
                institution: data.institution || "Manual",
                isManuallyAdded: true,
            }
        });

        return NextResponse.json({ message: "Asset added successfully", asset });
    } catch (error) {
        console.error("Failed to add manual asset:", error);
        return NextResponse.json({ error: "Failed to add manual asset" }, { status: 500 });
    }
}
