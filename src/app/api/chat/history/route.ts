import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentExchanges, getSummary, clearHistory } from "@/lib/chat-memory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// GET /api/chat/history?limit=10
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "10", 10), 50);

    const householdId = session.user.householdId;

    const [exchanges, summary] = await Promise.all([
      getRecentExchanges(householdId, limit),
      getSummary(householdId),
    ]);

    return NextResponse.json({
      exchanges,
      summary: summary
        ? {
            text: summary.summary,
            exchangeCount: summary.exchangeCount,
            lastUpdated: summary.updatedAt,
          }
        : null,
    });
  } catch (error) {
    console.error("Chat history GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history." },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/history?mode=chat|all
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "all") as "chat" | "all";

    await clearHistory(session.user.householdId, mode);

    return NextResponse.json({ success: true, mode });
  } catch (error) {
    console.error("Chat history DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history." },
      { status: 500 }
    );
  }
}
