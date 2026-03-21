import { db, TABLE_NAME } from "@/lib/db";
import {
  PutCommand,
  GetCommand,
  QueryCommand,
  BatchWriteCommand,
  DeleteCommand,
} from "@aws-sdk/lib-dynamodb";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ChatExchange, ChatSummary, PersonaResponse } from "@/types";

const SUMMARY_THRESHOLD = 5;
const TTL_DAYS = 90;
const MAX_SUMMARY_WORDS = 300;

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

// ── Fetch the long-term memory summary ──

export async function getSummary(
  householdId: string
): Promise<ChatSummary | null> {
  const { Item } = await db.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `HOUSEHOLD#${householdId}`,
        SK: "CHAT_SUMMARY",
      },
    })
  );

  return (Item as ChatSummary) || null;
}

// ── Check if summarization is needed ──

export function shouldSummarize(
  summary: ChatSummary | null,
  recentExchanges: ChatExchange[]
): boolean {
  if (recentExchanges.length === 0) return false;

  const lastSummarizedCount = summary?.exchangeCount ?? 0;
  const currentCount = lastSummarizedCount + countUnsummarized(summary, recentExchanges);

  return currentCount - lastSummarizedCount >= SUMMARY_THRESHOLD;
}

function countUnsummarized(
  summary: ChatSummary | null,
  exchanges: ChatExchange[]
): number {
  if (!summary?.lastExchangeTimestamp) return exchanges.length;

  return exchanges.filter((ex) => ex.SK > `CHAT#${summary.lastExchangeTimestamp}`).length;
}

// ── Update the long-term memory summary via Gemini ──

export async function updateSummary(
  householdId: string,
  existingSummary: ChatSummary | null,
  recentExchanges: ChatExchange[]
): Promise<ChatSummary> {
  const unsummarized = existingSummary?.lastExchangeTimestamp
    ? recentExchanges.filter((ex) => ex.SK > `CHAT#${existingSummary.lastExchangeTimestamp}`)
    : recentExchanges;

  const exchangeText = unsummarized
    .map((ex) => {
      const responseSnippets = ex.responses
        .filter((r) => r.status === "success")
        .map((r) => `  ${r.personaId}: ${r.content.slice(0, 500)}`)
        .join("\n");
      return `User: ${ex.userMessage}\n${responseSnippets}`;
    })
    .join("\n---\n");

  const prompt = `You are a memory summarizer for an investment advisory AI system. Your job is to maintain a concise, running profile of the user based on their conversations with AI investment advisors.

${existingSummary?.summary ? `EXISTING MEMORY:\n${existingSummary.summary}\n\n` : ""}NEW CONVERSATIONS:\n${exchangeText}

INSTRUCTIONS:
- Produce an updated summary (max ${MAX_SUMMARY_WORDS} words) capturing:
  - Investment decisions the user has made or is considering
  - Specific stocks, ETFs, or assets discussed
  - Risk preferences or changes in strategy expressed
  - Financial goals or life events mentioned
  - Any explicit preferences or instructions the user gave
- Merge new information with the existing memory, removing outdated details
- Write in third person ("The user...")
- Be factual and concise — no opinions or advice
- If the new conversations contain no meaningful information (e.g., "thanks", "ok"), return the existing memory unchanged`;

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  const result = await model.generateContent(prompt);
  const newSummaryText = result.response.text();

  const newestExchange = unsummarized[0]; // exchanges are newest-first
  const newExchangeCount = (existingSummary?.exchangeCount ?? 0) + unsummarized.length;

  const updatedSummary: ChatSummary = {
    PK: `HOUSEHOLD#${householdId}`,
    SK: "CHAT_SUMMARY",
    summary: newSummaryText,
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

// ── Clear all chat history and summary for a household ──

export async function clearHistory(
  householdId: string,
  mode: "chat" | "all" = "all"
): Promise<void> {
  const pk = `HOUSEHOLD#${householdId}`;

  // Fetch all CHAT# items
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

  // Delete CHAT# items in batches of 25
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

  // Delete the summary if full reset
  if (mode === "all") {
    await db.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: "CHAT_SUMMARY" },
      })
    );
  }
}
