import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { personas, generateSystemPrompt, PersonaId } from "@/lib/personas";
import { getRagContext } from "@/lib/rag";
import { fetchStockData, fetchStockDataToolDefinition } from "@/lib/finance-tools";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Initialize Gemini
const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(request: Request) {
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not set in environment variables." },
      { status: 500 }
    );
  }

  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const PROFILE_KEY = `PROFILE#${session.user.email}`;

    const { message, selectedPersonas } = await request.json();

    if (!message) {
      return NextResponse.json({ error: "Message is required." }, { status: 400 });
    }

    if (!selectedPersonas || selectedPersonas.length === 0) {
      return NextResponse.json({ error: "At least one persona must be selected." }, { status: 400 });
    }

    // 1. Fetch User Context
    let contextString = "User has not provided a financial profile yet. Give generalized advice.";

    const { Item: profile } = await db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: PROFILE_KEY, SK: PROFILE_KEY },
      })
    );

    if (profile) {
      const { Items: assets } = await db.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": PROFILE_KEY,
            ":skPrefix": "ASSET#",
          },
        })
      );

      const { Items: cashflows } = await db.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
          ExpressionAttributeValues: {
            ":pk": PROFILE_KEY,
            ":skPrefix": "CASHFLOW#",
          },
          ScanIndexForward: false, // Descending sort (newest YYYY-MM string first)
        })
      );

      const latestCashflow = cashflows && cashflows.length > 0 ? cashflows[0] : null;
      const currentCashReserves = latestCashflow?.cashReserves || 0;

      const assetsList = assets || [];
      const assetSummary = assetsList.length > 0
        ? assetsList.map(a => `- ${a.quantity} shares of ${a.ticker} (Avg Cost: $${a.averageCost})`).join("\n")
        : "No assets documented.";

      contextString = `
STRATEGY: ${profile.strategy || "Not specified"}
RISK TOLERANCE: ${profile.riskTolerance || "Not specified"}
GOALS: ${profile.goals || "Not specified"}
CASH RESERVES: $${currentCashReserves}
PORTFOLIO HOLDINGS:
${assetSummary}
`;
    }

    // 2. Prepare the Tool definition for Gemini
    const tools = [
      {
        functionDeclarations: [fetchStockDataToolDefinition],
      },
    ];

    // 3. Orchestrate Sequential LLM Calls
    // To avoid free-tier strict concurrent rate limits, we will process the personas individually with a delay.
    const allResponses = [];

    for (const personaId of selectedPersonas) {
      try {
        const personaConfig = personas[personaId as keyof typeof personas];
        const ragContext = personaConfig?.hasRag ? await getRagContext(personaId, message) : "";

        // Initialize model with specific system instruction
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash-lite",
          systemInstruction: generateSystemPrompt(personaId as any, contextString, ragContext),
          tools: tools,
        });

        const chat = model.startChat({});

        let result = await chat.sendMessage(message);
        let responseText = result.response.text();

        // Handle Function Calling
        const calls = result.response.functionCalls();
        if (calls && Array.isArray(calls) && calls.length > 0) {
          const toolResponses = [];
          // Even function calling needs to be sequential if querying live APIs heavily
          for (const call of calls) {
            if (call.name === 'fetchStockData') {
              const data = await fetchStockData((call.args as any).ticker);
              toolResponses.push({
                functionResponse: { name: call.name, response: data }
              });
            }
          }

          if (toolResponses.length > 0) {
            result = await chat.sendMessage(toolResponses);
            responseText = result.response.text();
          }
        }

        allResponses.push({
          personaId,
          status: "success",
          content: responseText,
        });

        // Sleep for 2.5 seconds before querying the next persona to respect free-tier RPM/RPD limits
        await new Promise(resolve => setTimeout(resolve, 2500));

      } catch (err: any) {
        console.error(`Error generating response for ${personaId}: `, err);
        const isRateLimit = err.status === 429 || (err.message && err.message.includes('429'));
        allResponses.push({
          personaId,
          status: "error",
          content: isRateLimit
            ? "I am currently rate-limited by the API. Please try asking again in a moment."
            : "Sorry, I am currently unavailable to provide advice.",
        });

        // If we hit a rate limit, sleep longer before attempting the next persona
        if (isRateLimit) await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    return NextResponse.json({ responses: allResponses });
  } catch (error: any) {
    console.error("Global Chat API Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
