import { db, TABLE_NAME } from "@/lib/db";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatExchange, ChatSummary, PersonaResponse, PersonaSummaryMap } from "@/types";

const SUMMARY_THRESHOLD = 3;
const TTL_DAYS = 180;
const MAX_SUMMARY_WORDS = 600;

const PERSONA_IDS = ["barsi", "bogle", "buffett", "graham", "gunther", "housel", "kiyosaki"];

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);

// ── Save a complete exchange (user question + all persona responses) ──

export async function saveExchange(
  householdId: string,
  userMessage: string,
  selectedPersonas: string[],
  responses: PersonaResponse[]
): Promise<void> {
  const now = new Date().toISOString();
  const ttl = Math.floor(Date.now() / 1000) + TTL_DAYS * 86400;

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `CHAT#${now}`,
        userMessage,
        selectedPersonas,
        responses,
        ttl,
        entityType: "CHAT",
      },
    })
  );
}

// ── Fetch recent exchanges (newest first) ──

export async function getRecentExchanges(
  householdId: string,
  limit: number = 10
): Promise<ChatExchange[]> {
  const { Items } = await db.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `HOUSEHOLD#${householdId}`,
        ":skPrefix": "CHAT#",
      },
      ScanIndexForward: false,
      Limit: limit,
    })
  );

  return (Items as ChatExchange[]) || [];
}

// ── Fetch a single advisor's long-term memory summary ──

export async function getSummary(
  householdId: string,
  personaId: string
): Promise<ChatSummary | null> {
  const { Item } = await db.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: `CHAT_SUMMARY#${personaId}`,
      },
    })
  );

  return (Item as ChatSummary) || null;
}

// ── Fetch all advisor summaries (for Client Dossier) ──

export async function getAllSummaries(
  householdId: string
): Promise<PersonaSummaryMap> {
  const results = await Promise.all(
    PERSONA_IDS.map(async (personaId) => {
      const summary = await getSummary(householdId, personaId);
      return [personaId, summary ? {
        text: summary.summary,
        exchangeCount: summary.exchangeCount,
        lastUpdated: summary.updatedAt,
      } : null] as const;
    })
  );

  return Object.fromEntries(results);
}

// ── Check if summarization is needed for a specific persona ──

export function shouldSummarize(
  summary: ChatSummary | null,
  recentExchanges: ChatExchange[],
  personaId: string
): boolean {
  const personaExchanges = recentExchanges.filter(
    (ex) => ex.selectedPersonas.includes(personaId)
  );
  if (personaExchanges.length === 0) return false;

  const unsummarizedCount = countUnsummarized(summary, personaExchanges);
  return unsummarizedCount >= SUMMARY_THRESHOLD;
}

function countUnsummarized(
  summary: ChatSummary | null,
  exchanges: ChatExchange[]
): number {
  if (!summary?.lastExchangeTimestamp) return exchanges.length;

  return exchanges.filter((ex) => ex.SK > `CHAT#${summary.lastExchangeTimestamp}`).length;
}

// ── Update a specific advisor's long-term memory summary via Gemini ──

export async function updateSummary(
  householdId: string,
  personaId: string,
  existingSummary: ChatSummary | null,
  recentExchanges: ChatExchange[]
): Promise<ChatSummary> {
  // Filter to only exchanges where this persona participated
  const personaExchanges = recentExchanges.filter(
    (ex) => ex.selectedPersonas.includes(personaId)
  );

  const unsummarized = existingSummary?.lastExchangeTimestamp
    ? personaExchanges.filter((ex) => ex.SK > `CHAT#${existingSummary.lastExchangeTimestamp}`)
    : personaExchanges;

  // Sort chronologically (oldest first) so the narrative follows proper time order
  const chronological = [...unsummarized].reverse();

  const exchangeText = chronological
    .map((ex) => {
      const personaResponse = ex.responses.find(
        (r) => r.personaId === personaId && r.status === "success"
      );
      const snippet = personaResponse ? personaResponse.content.slice(0, 500) : "";
      return `User: ${ex.userMessage}\n  ${personaId}: ${snippet}`;
    })
    .join("\n---\n");

  const prompt = `You are a memory summarizer for an investment advisory AI system. Your job is to maintain a structured, running profile of the user based on their conversations with the "${personaId}" advisor.

${existingSummary?.summary ? `EXISTING MEMORY:\n${existingSummary.summary}\n\n` : ""}NEW CONVERSATIONS:\n${exchangeText}

INSTRUCTIONS:
- Produce an updated summary (max ${MAX_SUMMARY_WORDS} words) using EXACTLY these 6 sections with ### headers:

### Our Journey So Far
A warm, engaging narrative summary of the conversations so far — written as if the advisor is recounting their relationship with this client. Cover key topics discussed, how the user's thinking has evolved, and the overall trajectory of their investment journey together. Write in a flowing, enjoyable-to-read style (half a page in length). This is the centerpiece of the advisor's notebook.

### Investment Thesis
The user's overarching investment philosophy as understood from conversations with this advisor.

### Current Asset Focus
Specific tickers, sectors, ETFs, or asset classes actively discussed or held.

### Risk Parameters
Risk tolerance signals, comfort zones, and red lines expressed by the user.

### Active Dilemmas
Decisions the user is currently weighing or debating.

### Key Decisions
Concrete commitments or actions the user has made (e.g., "Decided to sell 50 shares of TSLA", "Plans to invest $5K/month into VFV").

RULES:
- Always output ALL 6 sections, even if a section has no content (write "None discussed yet." for empty sections)
- The "Our Journey So Far" section should ALWAYS have meaningful content — even after a single conversation, write a warm narrative about what was discussed
- Merge new information with existing memory, removing outdated details
- Be factual and concise for the 5 structured sections — no opinions or advice
- If the new conversations contain no meaningful information (e.g., "thanks", "ok"), return the existing memory unchanged
- Do NOT include any text before the first ### header`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const newSummaryText = result.response.text();

  const newestExchange = unsummarized[0]; // exchanges are newest-first
  const newExchangeCount = (existingSummary?.exchangeCount ?? 0) + unsummarized.length;

  const updatedSummary: ChatSummary = {
    PK: `HOUSEHOLD#${householdId}`,
    SK: `CHAT_SUMMARY#${personaId}`,
    summary: newSummaryText,
    personaId,
    lastExchangeTimestamp: newestExchange?.SK.replace("CHAT#", "") ?? new Date().toISOString(),
    exchangeCount: newExchangeCount,
    updatedAt: new Date().toISOString(),
    entityType: "CHAT_SUMMARY",
  };

  await db.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: updatedSummary,
    })
  );

  return updatedSummary;
}

// ── Build per-persona history for Gemini's startChat({ history }) ──

export function buildPersonaHistory(
  exchanges: ChatExchange[],
  personaId: string,
  limit: number = 5
): Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> {
  const relevant = exchanges
    .filter((ex) =>
      ex.selectedPersonas.includes(personaId) &&
      ex.responses.some((r) => r.personaId === personaId && r.status === "success")
    )
    .slice(0, limit)
    .reverse(); // chronological order for Gemini history

  return relevant.flatMap((ex) => {
    const personaResponse = ex.responses.find((r) => r.personaId === personaId);
    return [
      { role: "user" as const, parts: [{ text: ex.userMessage }] },
      { role: "model" as const, parts: [{ text: personaResponse?.content || "" }] },
    ];
  });
}

// ── Clear chat history and/or summaries ──

export async function clearHistory(
  householdId: string,
  mode: "chat" | "all" | "summary" = "all",
  personaId?: string
): Promise<void> {
  const pk = `HOUSEHOLD#${householdId}`;

  if (mode === "summary" && personaId) {
    // Delete a single advisor's summary
    await db.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: `CHAT_SUMMARY#${personaId}` },
      })
    );
    return;
  }

  // Fetch and delete all CHAT# items
  if (mode === "chat" || mode === "all") {
    const { Items: chatItems } = await db.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
          ":pk": pk,
          ":skPrefix": "CHAT#",
        },
        ProjectionExpression: "PK, SK",
      })
    );

    const deleteRequests = (chatItems || []).map((item) => ({
      DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
    }));

    const chunkSize = 25;
    for (let i = 0; i < deleteRequests.length; i += chunkSize) {
      const chunk = deleteRequests.slice(i, i + chunkSize);
      await db.send(
        new BatchWriteCommand({
          RequestItems: { [TABLE_NAME]: chunk },
        })
      );
    }
  }

  // Delete all summaries if full reset
  if (mode === "all") {
    // Delete per-advisor summaries
    await Promise.all(
      PERSONA_IDS.map((pid) =>
        db.send(
          new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: `CHAT_SUMMARY#${pid}` },
          })
        )
      )
    );

    // Clean up legacy singleton summary (migration)
    await db.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: "CHAT_SUMMARY" },
      })
    ).catch(() => {}); // ignore if doesn't exist
  }
}
