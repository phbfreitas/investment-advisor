import { NextResponse } from "next/server";
import { LambdaClient, InvokeCommand } from "@aws-sdk/client-lambda";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.householdId) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lambdaArn = process.env.MONEYGUY_REFRESH_LAMBDA_ARN;
    if (!lambdaArn) {
        return NextResponse.json(
            { error: "Refresh Lambda is not configured." },
            { status: 500 }
        );
    }

    try {
        const lambda = new LambdaClient({});
        await lambda.send(
            new InvokeCommand({
                FunctionName: lambdaArn,
                InvocationType: "Event", // async fire-and-forget — returns 202 immediately
            })
        );
        return NextResponse.json({ triggered: true });
    } catch (error) {
        console.error("Failed to invoke MoneyGuy refresh Lambda:", error);
        return NextResponse.json(
            { error: "Failed to trigger refresh." },
            { status: 500 }
        );
    }
}
