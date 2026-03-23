import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getRecentExchanges, getAllSummaries, clearHistory, shouldSummarize, getSummary, updateSummary } from "@/lib/chat-memory";

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

    const [exchanges, summaries] = await Promise.all([
      getRecentExchanges(householdId, limit),
      getAllSummaries(householdId),
    ]);

    // Backfill: if exchanges exist but per-advisor summaries are missing, trigger summarization
    if (exchanges.length >= 5) {
      const personasWithExchanges = new Set<string>();
      for (const ex of exchanges) {
        for (const pid of ex.selectedPersonas) {
          personasWithExchanges.add(pid);
        }
      }

      const backfillPromises: Promise<void>[] = [];
      for (const pid of personasWithExchanges) {
        if (summaries[pid] === null) {
          backfillPromises.push(
            (async () => {
              try {
                const personaSummary = await getSummary(householdId, pid);
                if (shouldSummarize(personaSummary, exchanges, pid)) {
                  const updated = await updateSummary(householdId, pid, personaSummary, exchanges);
                  summaries[pid] = {
                    text: updated.summary,
                    exchangeCount: updated.exchangeCount,
                    lastUpdated: updated.updatedAt,
                  };
                }
              } catch (err) {
                console.error(`Backfill summarization failed for ${pid}:`, err);
              }
            })()
          );
        }
      }

      if (backfillPromises.length > 0) {
        await Promise.all(backfillPromises);
      }
    }

    return NextResponse.json({
      exchanges,
      summaries,
    });
  } catch (error) {
    console.error("Chat history GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat history." },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/history?mode=chat|all|summary&persona=buffett
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mode = (searchParams.get("mode") || "all") as "chat" | "all" | "summary";
    const persona = searchParams.get("persona") || undefined;

    await clearHistory(session.user.householdId, mode, persona);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Chat history DELETE error:", error);
    return NextResponse.json(
      { error: "Failed to clear chat history." },
      { status: 500 }
    );
  }
}
