import { NextResponse } from "next/server";
import { GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { db, TABLE_NAME } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PK = "SYSTEM#CONFIG";
const SK = "PERSONA_REFRESH#moneyguy";

export async function GET() {
  try {
    const result = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK, SK },
      })
    );

    const item = result.Item;

    return NextResponse.json({
      frequencyDays: item?.frequencyDays ?? 7,
      lastRefreshedAt: item?.lastRefreshedAt ?? null,
      startedAt: item?.startedAt ?? null,
      status: item?.status ?? "pending",
      articleCount: item?.articleCount ?? 0,
    });
  } catch (error) {
    console.error("GET /api/settings/persona-refresh error:", error);
    return NextResponse.json(
      { error: "Failed to fetch persona refresh settings." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user?.householdId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { frequencyDays } = body as { frequencyDays?: unknown };

  if (
    frequencyDays === undefined ||
    frequencyDays === null ||
    typeof frequencyDays !== "number" ||
    !Number.isInteger(frequencyDays) ||
    frequencyDays < 1 ||
    frequencyDays > 30
  ) {
    return NextResponse.json(
      { error: "frequencyDays must be an integer between 1 and 30." },
      { status: 400 }
    );
  }

  try {
    // Read current item first to preserve existing fields
    const existing = await db.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: { PK: "SYSTEM#CONFIG", SK: "PERSONA_REFRESH#moneyguy" }
    }));
    const current = existing.Item ?? {};

    await db.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: "SYSTEM#CONFIG",
        SK: "PERSONA_REFRESH#moneyguy",
        frequencyDays: frequencyDays,
        lastRefreshedAt: current.lastRefreshedAt ?? null,
        status: current.status ?? "pending",
        articleCount: current.articleCount ?? 0,
        updatedAt: new Date().toISOString(),
      }
    }));

    return NextResponse.json({ frequencyDays });
  } catch (error) {
    console.error("PUT /api/settings/persona-refresh error:", error);
    return NextResponse.json(
      { error: "Failed to update persona refresh settings." },
      { status: 500 }
    );
  }
}
