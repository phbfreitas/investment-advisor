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
    if (!session || !session.user?.householdId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const PROFILE_KEY = `HOUSEHOLD#${session.user!.householdId!}`;

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
        Key: { PK: PROFILE_KEY, SK: "META" },
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

      const tIncome = (parseFloat(profile.budgetPaycheck) || 0) + (parseFloat(profile.budgetRentalIncome) || 0) + (parseFloat(profile.budgetDividends) || 0) + (parseFloat(profile.budgetBonus) || 0) + (parseFloat(profile.budgetOtherIncome) || 0);
      const tExpenses = (parseFloat(profile.budgetFixedHome) || 0) + (parseFloat(profile.budgetFixedUtilities) || 0) + (parseFloat(profile.budgetFixedCar) || 0) + (parseFloat(profile.budgetFixedFood) || 0) + (parseFloat(profile.budgetDiscretionary) || 0) + (parseFloat(profile.budgetRentalExpenses) || 0);

      const budgetSummary = tIncome > 0 || tExpenses > 0
        ? `BUDGETED DECLARED INCOME: $${tIncome}\nBUDGETED DECLARED EXPENSES: $${tExpenses}\nTARGET MONTHLY SAVINGS: $${tIncome - tExpenses}`
        : "No monthly budget defined.";

      contextString = `
STRATEGY: ${profile.strategy || "Not specified"}
RISK TOLERANCE: ${profile.riskTolerance || "Not specified"}
GOALS: ${profile.goals || "Not specified"}
CASH RESERVES: $${currentCashReserves}
${budgetSummary}
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

    // 3. Orchestrate Parallel LLM Calls
    // With a paid tier, we can process all selected personas concurrently.
    const fetchPersonaResponse = async (personaId: string) => {
      try {
        const personaConfig = personas[personaId as keyof typeof personas];
        const ragContext = personaConfig?.hasRag ? await getRagContext(personaId, message) : "";

        // Initialize model with specific system instruction
        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash", // Reverted to the latest capable Flash model for fast multi-persona chat
          systemInstruction: generateSystemPrompt(personaId as PersonaId, contextString, ragContext),
          tools: tools,
        });

        const chat = model.startChat({});
        let result = await chat.sendMessage(message);
        let responseText = result.response.text();

        // Handle Function Calling
        const calls = result.response.functionCalls();
        if (calls && Array.isArray(calls) && calls.length > 0) {
          const toolResponses = [];
          for (const call of calls) {
            if (call.name === 'fetchStockData') {
              const args = call.args as { ticker: string };
              const data = await fetchStockData(args.ticker);
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

        return {
          personaId,
          status: "success",
          content: responseText,
        };
      } catch (err) {
        console.error(`Error generating response for ${personaId}: `, err);
        const e = err as { status?: number; message?: string };
        const isRateLimit = e.status === 429 || (e.message && e.message.includes('429'));
        return {
          personaId,
          status: "error",
          content: isRateLimit
            ? "I am currently rate-limited by the API. Please try asking again in a moment."
            : "Sorry, I am currently unavailable to provide advice.",
        };
      }
    };

    const allResponses = await Promise.all(selectedPersonas.map(fetchPersonaResponse));

    return NextResponse.json({ responses: allResponses });
  } catch (error) {
    console.error("Global Chat API Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
