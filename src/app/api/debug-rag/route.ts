import { NextResponse } from "next/server";
import { getRagContext } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const text = await getRagContext("buffett", "test query");
        return NextResponse.json({ success: true, text });
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}
