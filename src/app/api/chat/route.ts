import { NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType, FunctionDeclaration } from "@google/generative-ai";
import { db, TABLE_NAME } from "@/lib/db";
import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { personas, generateSystemPrompt, PersonaId } from "@/lib/personas";
import { getRagContext } from "@/lib/rag";
import { fetchStockData, fetchStockDataToolDefinition } from "@/lib/finance-tools";
import { buildFullUserContext } from "@/lib/portfolio-analytics";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getRecentExchanges,
  getSummary,
  saveExchange,
  shouldSummarize,
  updateSummary,
  buildPersonaHistory,
} from "@/lib/chat-memory";
import type { ChatExchange, ChatSummary } from "@/types";

type PersonaSummaries = Record<string, ChatSummary | null>;

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

    const householdId = session.user!.householdId!;

    // 1. Fetch User Context + Memory in parallel
    let contextString = "User has not provided a financial profile yet. Give generalized advice.";
    let recentExchanges: ChatExchange[] = [];
    let personaSummaries: PersonaSummaries = {};

    const profilePromise = db.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: { PK: PROFILE_KEY, SK: "META" },
      })
    );

    // Memory fetch — graceful degradation on failure
    const memoryPromise = Promise.all([
      getRecentExchanges(householdId, 10),
      // Fetch summaries for each selected persona
      Promise.all(
        selectedPersonas.map(async (pid: string) => {
          const s = await getSummary(householdId, pid);
          return [pid, s] as const;
        })
      ),
    ]).catch((err) => {
      console.error("Memory fetch failed, falling back to stateless:", err);
      return [[] as ChatExchange[], [] as (readonly [string, ChatSummary | null])[]] as const;
    });

    const [{ Item: profile }, [exchanges, summaryEntries]] = await Promise.all([
      profilePromise,
      memoryPromise,
    ]);

    recentExchanges = exchanges;
    personaSummaries = Object.fromEntries(summaryEntries);

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
          ScanIndexForward: false,
        })
      );

      const latestCashflow = cashflows && cashflows.length > 0 ? cashflows[0] : null;

      contextString = buildFullUserContext(profile, assets || [], latestCashflow);
    }

    // 2. Per-advisor threshold-based summarization (every 5th exchange, synchronous-on-read)
    for (const pid of selectedPersonas) {
      if (shouldSummarize(personaSummaries[pid] ?? null, recentExchanges, pid)) {
        try {
          personaSummaries[pid] = await updateSummary(householdId, pid, personaSummaries[pid] ?? null, recentExchanges);
        } catch (err) {
          console.error(`Summarization failed for ${pid}, continuing with existing:`, err);
        }
      }
    }

    // 3. Prepare the Tool definition for Gemini
    const tools = [
      {
        functionDeclarations: [fetchStockDataToolDefinition],
      },
    ];

    // 4. Orchestrate Parallel LLM Calls with per-persona history
    const fetchPersonaResponse = async (personaId: string) => {
      try {
        const personaConfig = personas[personaId as keyof typeof personas];
        const ragContext = personaConfig?.hasRag ? await getRagContext(personaId, message) : "";
        const personaSummaryText = personaSummaries[personaId]?.summary || "";

        const model = genAI.getGenerativeModel({
          model: "gemini-2.5-flash",
          systemInstruction: await generateSystemPrompt(personaId as PersonaId, contextString, ragContext, personaSummaryText),
          tools: tools,
        });

        // Build per-persona conversation history (last 5 exchanges with this persona)
        const history = buildPersonaHistory(recentExchanges, personaId, 5);

        const chat = model.startChat({ history });
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
          status: "success" as const,
          content: responseText,
        };
      } catch (err) {
        console.error(`Error generating response for ${personaId}: `, err);
        const e = err as { status?: number; message?: string };
        const isRateLimit = e.status === 429 || (e.message && e.message.includes('429'));
        return {
          personaId,
          status: "error" as const,
          content: isRateLimit
            ? "I am currently rate-limited by the API. Please try asking again in a moment."
            : "Sorry, I am currently unavailable to provide advice.",
        };
      }
    };

    const allResponses = await Promise.all(selectedPersonas.map(fetchPersonaResponse));

    // 5. Save exchange to DynamoDB (fire-and-forget)
    saveExchange(householdId, message, selectedPersonas, allResponses).catch((err) =>
      console.error("Failed to save exchange:", err)
    );

    return NextResponse.json({ responses: allResponses });
  } catch (error) {
    console.error("Global Chat API Error:", error);
    return NextResponse.json(
      { error: "An error occurred while processing your request." },
      { status: 500 }
    );
  }
}
