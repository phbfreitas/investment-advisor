import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { insertPriceAnomalyLog } from "@/lib/priceAnomalyLog";
import type { PriceAnomalyPayload } from "@/types/priceAnomaly";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isValidPayload(body: unknown): body is PriceAnomalyPayload {
    if (!body || typeof body !== "object") return false;
    const b = body as Record<string, unknown>;
    return (
        typeof b.ticker === "string" &&
        typeof b.assetId === "string" &&
        typeof b.priorPrice === "number" &&
        typeof b.newPrice === "number" &&
        typeof b.deltaPct === "number" &&
        typeof b.deltaAbs === "number" &&
        (b.source === "refresh" || b.source === "edit-form-lookup")
    );
}

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session || !session.user?.householdId) {
            return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        if (!isValidPayload(body)) {
            return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 });
        }

        const householdId = session.user.householdId;
        const sk = await insertPriceAnomalyLog(householdId, body);

        console.log(
            `[price-anomaly] ${body.ticker} prior=${body.priorPrice.toFixed(2)} ` +
                `new=${body.newPrice.toFixed(2)} delta=${body.deltaPct >= 0 ? "+" : ""}${body.deltaPct.toFixed(1)}% ` +
                `household=${householdId}`
        );

        return NextResponse.json({ ok: true, sk });
    } catch (error) {
        console.error("[price-anomaly] write failed:", error);
        // Honest 5xx so CloudWatch / monitoring can alert on real storage failures.
        // The client's .catch(() => {}) on the fetch call swallows this for users —
        // best-effort means non-blocking for the UI, NOT lying to operators.
        return NextResponse.json({ ok: false, error: "internal" }, { status: 500 });
    }
}
