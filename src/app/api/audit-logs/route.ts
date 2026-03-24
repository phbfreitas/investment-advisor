import { NextResponse } from "next/server";
import { db, TABLE_NAME } from "@/lib/db";
import { QueryCommand, QueryCommandInput } from "@aws-sdk/lib-dynamodb";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const lastKey = searchParams.get("lastKey");

    const commandInput: QueryCommandInput = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${session.user.householdId}`,
        ":skPrefix": "AUDIT_LOG#",
      },
      ScanIndexForward: false,
      Limit: limit,
    };

    if (lastKey) {
      commandInput.ExclusiveStartKey = {
        PK: `HOUSEHOLD#${session.user.householdId}`,
        SK: lastKey,
      };
    }

    const { Items, LastEvaluatedKey } = await db.send(
      new QueryCommand(commandInput)
    );

    return NextResponse.json({
      logs: Items || [],
      lastKey: LastEvaluatedKey?.SK || null,
    });
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}
