import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
    try {
        // For MVP, we assume a single user profile. 
        // We fetch the first one we find. If none exists, we return null.
        const profile = await prisma.financialProfile.findFirst({
            include: { assets: true },
        });
        return NextResponse.json(profile || {});
    } catch (error) {
        console.error("Failed to fetch profile:", error);
        return NextResponse.json({ error: "Failed to fetch profile" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const data = await request.json();

        // For MVP, fetch the first profile to know if we are updating or creating
        const existingProfile = await prisma.financialProfile.findFirst();

        let profile;
        if (existingProfile) {
            profile = await prisma.financialProfile.update({
                where: { id: existingProfile.id },
                data: {
                    strategy: data.strategy,
                    riskTolerance: data.riskTolerance,
                    goals: data.goals,
                    monthlyIncome: data.monthlyIncome,
                    monthlyExpenses: data.monthlyExpenses,
                    cashReserves: data.cashReserves,
                },
            });
        } else {
            profile = await prisma.financialProfile.create({
                data: {
                    strategy: data.strategy,
                    riskTolerance: data.riskTolerance,
                    goals: data.goals,
                    monthlyIncome: data.monthlyIncome,
                    monthlyExpenses: data.monthlyExpenses,
                    cashReserves: data.cashReserves,
                },
            });
        }

        return NextResponse.json(profile);
    } catch (error) {
        console.error("Failed to save profile:", error);
        return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
    }
}
