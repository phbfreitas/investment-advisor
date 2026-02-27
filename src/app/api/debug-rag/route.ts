import { NextResponse } from "next/server";
import { getRagContext } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        const text = await getRagContext("buffett", "test query");
        return NextResponse.json({ success: true, text });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message, stack: e.stack });
    }
}
