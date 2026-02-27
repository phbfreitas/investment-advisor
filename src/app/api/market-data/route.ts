import { NextResponse } from "next/server";
import { fetchStockData } from "@/lib/finance-tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const ticker = searchParams.get("ticker");

    if (!ticker) {
        return NextResponse.json({ error: "Ticker is required" }, { status: 400 });
    }

    try {
        const data = await fetchStockData(ticker);

        if (data.error) {
            return NextResponse.json({ error: data.error }, { status: 404 });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error(`Failed to fetch market data for ${ticker}:`, error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
