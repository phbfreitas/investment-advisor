import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
import Papa from "papaparse";

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as Blob;

        if (!file) {
            return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
        }

        const text = await file.text();

        // Wealthsimple CSVs typically have columns like:
        // Date, Action, Symbol, Description, Quantity, Price, Currency, Exchange Rate, Value
        const result = Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
        });

        const data = result.data as any[];

        // Very basic aggregation for MVP: 
        // Just find "Buy" actions to create an average cost position pipeline.
        // Real-world would need a full ledger calculation (Buy - Sell)
        const holdings = new Map<string, { quantity: number; totalCost: number; currency: string }>();

        data.forEach(row => {
            if (!row.Symbol || !row.Action) return;

            const symbol = row.Symbol;
            const action = row.Action.toLowerCase();
            const qty = parseFloat(row.Quantity || "0");
            const price = parseFloat(row.Price || "0");

            if (action.includes("buy")) {
                const current = holdings.get(symbol) || { quantity: 0, totalCost: 0, currency: row.Currency || "CAD" };
                current.quantity += qty;
                current.totalCost += (qty * price);
                holdings.set(symbol, current);
            } else if (action.includes("sell")) {
                // Simple subtraction for MVP
                const current = holdings.get(symbol) || { quantity: 0, totalCost: 0, currency: row.Currency || "CAD" };
                current.quantity -= qty;
                // Adjusting cost basis simply for MVP
                const avgPrice = current.quantity > 0 ? current.totalCost / (current.quantity + qty) : 0;
                current.totalCost -= (qty * avgPrice);

                if (current.quantity <= 0) {
                    holdings.delete(symbol);
                } else {
                    holdings.set(symbol, current);
                }
            }
        });

        // Save to Database
        const profile = await prisma.financialProfile.findFirst();
        if (!profile) {
            return NextResponse.json({ error: "Please setup your Financial Brain profile first" }, { status: 400 });
        }

        // Delete old Wealthsimple assets to replace with new sync
        await prisma.asset.deleteMany({
            where: {
                profileId: profile.id,
                institution: "Wealthsimple"
            }
        });

        const assetsToInsert = Array.from(holdings.entries()).map(([ticker, data]) => ({
            profileId: profile.id,
            ticker: ticker,
            name: ticker, // Can augment with API later
            assetType: "STOCK",
            quantity: data.quantity,
            averageCost: data.totalCost / data.quantity,
            currency: data.currency,
            institution: "Wealthsimple",
            isManuallyAdded: false
        }));

        if (assetsToInsert.length > 0) {
            await prisma.asset.createMany({
                data: assetsToInsert
            });
        }

        return NextResponse.json({ message: "Portfolio synced successfully", count: assetsToInsert.length });
    } catch (error) {
        console.error("Failed to process portfolio CSV:", error);
        return NextResponse.json({ error: "Failed to process file" }, { status: 500 });
    }
}
