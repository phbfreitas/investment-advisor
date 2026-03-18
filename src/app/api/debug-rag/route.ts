import { NextRequest, NextResponse } from "next/server";
import { getRagContext } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const persona = request.nextUrl.searchParams.get("persona") || "buffett";
    const query = request.nextUrl.searchParams.get("query") || "test query";

    try {
        const text = await getRagContext(persona, query);
        return NextResponse.json({ success: true, persona, query, text });
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}
