import { NextResponse } from "next/server";
import {
  GetItemCommand,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { dynamoClient } from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || "InvestmentAdvisorData";
const PK = "SYSTEM#CONFIG";
const SK = "PERSONA_REFRESH#moneyguy";

export async function GET() {
  try {
    const result = await dynamoClient.send(
      new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: { S: PK },
          SK: { S: SK },
        },
      })
    );

    const item = result.Item;

    return NextResponse.json({
      frequencyDays: item?.frequencyDays?.N ? parseInt(item.frequencyDays.N, 10) : 7,
      lastRefreshedAt: item?.lastRefreshedAt?.S ?? null,
      status: item?.status?.S ?? "pending",
      articleCount: item?.articleCount?.N ? parseInt(item.articleCount.N, 10) : 0,
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

  const updatedAt = new Date().toISOString();

  try {
    await dynamoClient.send(
      new UpdateItemCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: { S: PK },
          SK: { S: SK },
        },
        UpdateExpression:
          "SET frequencyDays = :frequencyDays, updatedAt = :updatedAt",
        ExpressionAttributeValues: {
          ":frequencyDays": { N: String(frequencyDays) },
          ":updatedAt": { S: updatedAt },
        },
      })
    );

    return NextResponse.json({ frequencyDays });
  } catch (error) {
    console.error("PUT /api/settings/persona-refresh error:", error);
    return NextResponse.json(
      { error: "Failed to update persona refresh settings." },
      { status: 500 }
    );
  }
}
