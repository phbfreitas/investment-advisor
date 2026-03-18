# Multi-Persona Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the single-persona (Warren Buffett) investment advisor into a 5-persona "Investment Advisory Board" with multi-select UI, generic ingestion pipeline, and persona-agnostic RAG.

**Architecture:** The persona system (`personas.ts`) becomes the source of truth for all 5 advisors. The RAG pipeline (`rag.ts`) switches from a hardcoded Buffett check to a dynamic persona-keyed index loader. A generic ingestion script replaces the Buffett-specific one, driven by a `sources.json` manifest. The frontend adds a persona selector and removes all Buffett branding.

**Tech Stack:** Next.js 16, TypeScript, Google Gemini API (gemini-embedding-001 + gemini-2.5-flash), pdf-parse, cheerio, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-17-multi-persona-expansion-design.md`

---

## File Structure

| Action | File | Responsibility |
|---|---|---|
| Modify | `src/lib/personas.ts` | Add 4 new personas, expand `PersonaId` union, add English-only instruction to all prompts |
| Modify | `src/lib/rag.ts` | Update `DocumentChunk` metadata, persona-keyed cache, dynamic index paths |
| Create | `data/personas/sources.json` | Manifest of ingestion sources per persona |
| Create | `scripts/ingest-persona.ts` | Generic ingestion script (URLs + local PDFs) |
| Delete | `scripts/ingest-buffett.ts` | Replaced by generic script |
| Modify | `scripts/test-rag.ts` | Accept persona ID as CLI argument |
| Modify | `src/app/api/debug-rag/route.ts` | Accept persona query param |
| Modify | `src/app/layout.tsx:8-11` | Update title and meta description |
| Modify | `src/components/Sidebar.tsx:10` | Rename "Warren Buffett" nav item |
| Modify | `src/app/HomeClient.tsx` | Remove Buffett branding, add persona selector, dynamic loading state |
| Modify | `src/components/PanelResponse.tsx:16` | Replace "Buffett's Analysis" header |
| Modify | `src/app/profile/ProfileClient.tsx:110` | Generalize "Warren will use this..." copy |
| Modify | `src/app/user-guide/UserGuideClient.tsx:27-33,174-241` | Update Section 1 from Buffett to Advisory Board |
| Modify | `USER_GUIDE.md:14-42` | Update Section 1 in markdown guide |

---

### Task 1: Expand Persona Definitions

**Files:**
- Modify: `src/lib/personas.ts`

- [ ] **Step 1: Expand PersonaId and add 4 new personas**

Replace the entire file content:

```typescript
export type PersonaId = "buffett" | "barsi" | "gunther" | "housel" | "ramsey";

export interface Persona {
    id: PersonaId;
    name: string;
    avatar: string;
    tagline: string;
    systemPrompt: string;
    hasRag?: boolean;
}

export const personas: Record<PersonaId, Persona> = {
    buffett: {
        id: "buffett",
        name: "Warren Buffett",
        avatar: "👴",
        tagline: "The Oracle of Omaha",
        hasRag: true,
        systemPrompt: `You are Warren Buffett. You advocate for Value Investing.
    Focus on intrinsic value, strong economic moats, and long-term holding.
    You prefer businesses you can understand, with consistent earning power and good management.
    You avoid speculative fads and timing the market.
    Tone: Patient, grandfatherly, folksy wisdom, rational, and occasionally humorous.
    IMPORTANT: Always respond in English regardless of the language of any retrieved context.`
    },
    barsi: {
        id: "barsi",
        name: "Luiz Barsi Filho",
        avatar: "📊",
        tagline: "The Dividend King",
        hasRag: true,
        systemPrompt: `You are Luiz Barsi Filho, Brazil's greatest individual investor.
    You advocate for dividend-focused, long-term accumulation strategies.
    You believe in buying shares of solid companies that pay consistent dividends and holding them forever.
    You emphasize patience through market cycles and building an income-generating portfolio.
    You distrust short-term speculation and believe the stock market is a "dividend machine."
    Tone: Direct, practical, disciplined, occasionally blunt, with the wisdom of decades in emerging markets.
    IMPORTANT: Always respond in English regardless of the language of any retrieved context.`
    },
    gunther: {
        id: "gunther",
        name: "Max Gunther",
        avatar: "🎲",
        tagline: "The Zurich Speculator",
        hasRag: true,
        systemPrompt: `You are Max Gunther, author of "The Zurich Axioms."
    You advocate for calculated risk-taking and strategic speculation.
    You believe diversification for its own sake is a mistake — concentrate on your best bets.
    You emphasize knowing when to cut losses quickly and when to take profits.
    You are contrarian by nature and distrust consensus thinking.
    Your philosophy: always bet meaningfully, never gamble with money you can't afford to lose, and trust your gut when the data is ambiguous.
    Tone: Sharp, provocative, witty, pragmatic, with a European sensibility.
    IMPORTANT: Always respond in English regardless of the language of any retrieved context.`
    },
    housel: {
        id: "housel",
        name: "Morgan Housel",
        avatar: "🧠",
        tagline: "The Behavioral Analyst",
        hasRag: true,
        systemPrompt: `You are Morgan Housel, author of "The Psychology of Money."
    You focus on the behavioral and psychological aspects of wealth and investing.
    You believe personal finance is deeply personal — what works for one person may not work for another.
    You emphasize the power of compounding, patience, and humility about predictions.
    You warn against greed, envy, and the illusion of control in financial markets.
    Your key insight: wealth is what you don't spend, and financial success is more about behavior than intelligence.
    Tone: Thoughtful, storytelling-driven, calm, empathetic, with a gift for making complex ideas simple.
    IMPORTANT: Always respond in English regardless of the language of any retrieved context.`
    },
    ramsey: {
        id: "ramsey",
        name: "Dave Ramsey",
        avatar: "💪",
        tagline: "The Debt Destroyer",
        hasRag: true,
        systemPrompt: `You are Dave Ramsey, America's most trusted voice on personal finance.
    You advocate for total debt elimination using the debt snowball method.
    You believe an emergency fund (3-6 months expenses) is non-negotiable before any investing.
    You prefer simple, conservative investments — no individual stocks, no crypto, no leverage.
    You emphasize disciplined budgeting, living below your means, and avoiding consumer debt at all costs.
    Your philosophy: "If you will live like no one else, later you can live like no one else."
    Tone: Energetic, passionate, no-nonsense, occasionally tough-love, motivational preacher energy.
    IMPORTANT: Always respond in English regardless of the language of any retrieved context.`
    },
};

/**
 * Helper to generate the full system prompt injected with the user's personal financial context.
 */
export function generateSystemPrompt(personaId: PersonaId, userContextString: string, ragContext: string = ""): string {
    const persona = personas[personaId];
    if (!persona) throw new Error("Persona not found");

    return `
${persona.systemPrompt}

${ragContext}

---

IMPORTANT CONTEXT ABOUT THE USER YOU ARE ADVISING:
${userContextString}

INSTRUCTIONS:
You are an AI advisor designed to channel the wisdom and analytical framework of the specified persona.
Analyze the user's situation, questions, or portfolio directly applying your philosophical framework.
When you pull from RAG context, weave it naturally into your response as if recalling your own past writings.
Provide actionable thoughts that directly address the user's specific risk tolerance, goals, and current assets.
Keep your response concise (3-5 paragraphs) and highly readable (use markdown formatting like bolding or lists where appropriate).
Do NOT break character.
`;
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0 (no errors)

- [ ] **Step 3: Commit**

```bash
git add src/lib/personas.ts
git commit -m "feat: add 4 new investment advisor personas (barsi, gunther, housel, ramsey)"
```

---

### Task 2: Update RAG Pipeline for Multi-Persona

**Files:**
- Modify: `src/lib/rag.ts`

- [ ] **Step 1: Update DocumentChunk interface and make pipeline persona-agnostic**

Replace the entire file:

```typescript
import * as fs from 'fs/promises';
import * as path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || "";
const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

export interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;
        source: string;
    };
    embedding: number[];
}

const cachedIndexes: Map<string, DocumentChunk[]> = new Map();

function cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

const RELEVANCE_THRESHOLD = 0.30;
const MAX_CONTEXT_TOKENS = 2000;

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

export async function getRagContext(personaId: string, query: string, topK: number = 3): Promise<string> {
    try {
        if (!cachedIndexes.has(personaId)) {
            const indexPath = path.join(process.cwd(), "data", "personas", `${personaId}-index.json`);
            try {
                const fileData = await fs.readFile(indexPath, 'utf-8');
                cachedIndexes.set(personaId, JSON.parse(fileData));
            } catch {
                // Index file doesn't exist — persona works without RAG
                console.log(`[RAG] No index file found for persona "${personaId}". Skipping RAG context.`);
                return "";
            }
        }

        const index = cachedIndexes.get(personaId);
        if (!index || index.length === 0) return "";

        const queryEmbeddingResult = await embeddingModel.embedContent(query);
        const queryEmbedding = queryEmbeddingResult.embedding.values;

        // Calculate similarities
        const scoredChunks = index.map(chunk => ({
            ...chunk,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }));

        // Sort by highest score
        scoredChunks.sort((a, b) => b.score - a.score);

        // Log top scores for debugging
        const topScores = scoredChunks.slice(0, topK).map(c => ({
            id: c.id,
            score: c.score.toFixed(4),
            source: c.metadata.sourceLabel,
        }));
        console.log(`[RAG:${personaId}] Query: "${query.slice(0, 80)}..." | Top scores:`, topScores);

        // Filter by relevance threshold
        const relevantChunks = scoredChunks
            .slice(0, topK)
            .filter(chunk => chunk.score >= RELEVANCE_THRESHOLD);

        if (relevantChunks.length === 0) {
            console.log(`[RAG:${personaId}] No chunks passed relevance threshold (${RELEVANCE_THRESHOLD}). Skipping RAG context.`);
            return "";
        }

        // Apply token budget — include as many chunks as fit
        let contextString = "\n### RETRIEVED KNOWLEDGE BASE EXTRACTS:\n";
        contextString += "These are specific, retrieved excerpts from your actual writings meant to help you directly answer the user's question.\n\n";

        const headerTokens = estimateTokens(contextString);
        let usedTokens = headerTokens;
        let includedCount = 0;

        for (const chunk of relevantChunks) {
            const chunkText = `--- Extract ${includedCount + 1} (Source: ${chunk.metadata.sourceLabel}) ---\n${chunk.text}\n\n`;
            const chunkTokens = estimateTokens(chunkText);

            if (usedTokens + chunkTokens > MAX_CONTEXT_TOKENS && includedCount > 0) {
                console.log(`[RAG:${personaId}] Token budget reached (${usedTokens}/${MAX_CONTEXT_TOKENS}). Included ${includedCount}/${relevantChunks.length} relevant chunks.`);
                break;
            }

            contextString += chunkText;
            usedTokens += chunkTokens;
            includedCount++;
        }

        console.log(`[RAG:${personaId}] Included ${includedCount} chunks (~${usedTokens} tokens).`);
        return contextString;
    } catch (e) {
        console.error(`Error retrieving RAG context for ${personaId}:`, e);
        return "";
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 3: Commit**

```bash
git add src/lib/rag.ts
git commit -m "feat: make RAG pipeline persona-agnostic with dynamic index loading"
```

---

### Task 3: Create Source Manifest and Generic Ingestion Script

**Files:**
- Create: `data/personas/sources.json`
- Create: `scripts/ingest-persona.ts`
- Delete: `scripts/ingest-buffett.ts`

- [ ] **Step 1: Create `data/personas/sources.json`**

Use the exact book filenames from the `books/` directory:

```json
{
  "buffett": {
    "sources": [
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/1977.html", "label": "1977 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/1989.html", "label": "1989 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/1995.html", "label": "1995 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/2018ltr.pdf", "label": "2018 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/2021ltr.pdf", "label": "2021 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/2022ltr.pdf", "label": "2022 Shareholder Letter" },
      { "type": "url", "path": "https://www.berkshirehathaway.com/letters/2023ltr.pdf", "label": "2023 Shareholder Letter" },
      { "type": "file", "path": "books/Warren Buffett_ The Ultimate Guide To Investing like Warren -- Borrows, Richard -- 2016 -- eb48ea224196690234197b5e6be1c0ad -- Anna's Archive.pdf", "label": "The Ultimate Guide to Investing like Warren Buffett" }
    ]
  },
  "barsi": {
    "sources": [
      { "type": "file", "path": "books/O rei dos dividends _ a saga do filho de imigrantes pobres -- Luiz Barsi Filho -- Rio de Janeiro, 2022 -- Editora Sextante -- 9786555644746 -- c51ffcc8863a684d5faa02e410801708 -- Anna's Archive.pdf", "label": "O Rei dos Dividendos" }
    ]
  },
  "gunther": {
    "sources": [
      { "type": "file", "path": "books/Os Axiomas de Zurique -- Max Gunther -- ae1a7e841c58df9a930e79e9df1992bf -- Anna's Archive.pdf", "label": "The Zurich Axioms" }
    ]
  },
  "housel": {
    "sources": [
      { "type": "file", "path": "books/The Psychology of Money_ Timeless lessons on wealth, greed, -- Morgan Housel -- United Kingdom, Sep 08, 2020 -- Harriman House -- 9780857197689 -- 27ef11c0c6cadc87941099f5b8c6177a -- Anna's Archive.pdf", "label": "The Psychology of Money" }
    ]
  },
  "ramsey": {
    "sources": [
      { "type": "file", "path": "books/The Total Money Makeover_ A Proven Plan for Financial -- Dave Ramsey -- 2009 -- Thomas Nelson -- 2bcbf6fabf53249f5cbe6c4488e67084 -- Anna's Archive.pdf", "label": "The Total Money Makeover" }
    ]
  }
}
```

- [ ] **Step 2: Create `scripts/ingest-persona.ts`**

This script reuses the chunking, embedding, and parsing logic from the old `ingest-buffett.ts` but is driven by `sources.json`:

```typescript
import * as fs from "fs/promises";
import * as path from "path";
import * as cheerio from "cheerio";
import { PDFParse } from "pdf-parse";
import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is not set. Check your .env.local file.");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "gemini-embedding-001" });

const OUTPUT_DIR = path.join(process.cwd(), "data", "personas");
const SOURCES_FILE = path.join(OUTPUT_DIR, "sources.json");

interface SourceEntry {
    type: "url" | "file";
    path: string;
    label: string;
}

interface SourceManifest {
    [personaId: string]: { sources: SourceEntry[] };
}

interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;
        source: string;
    };
    embedding?: number[];
}

async function fetchUrl(url: string): Promise<string> {
    const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
    });
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.statusText}`);

    if (url.endsWith(".pdf")) {
        const buffer = await response.arrayBuffer();
        const parser = new PDFParse({ data: Buffer.from(buffer) });
        const result = await parser.getText();
        const text = result.text.replace(/\s+/g, " ").trim();
        await parser.destroy();
        return text;
    } else {
        const html = await response.text();
        const $ = cheerio.load(html);
        $("script, style").remove();
        return $("body").text().replace(/\s+/g, " ").trim();
    }
}

async function readLocalPdf(filePath: string): Promise<string> {
    const absolutePath = path.join(process.cwd(), filePath);
    const buffer = await fs.readFile(absolutePath);
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    const text = result.text.replace(/\s+/g, " ").trim();
    await parser.destroy();
    return text;
}

function chunkText(text: string, maxChunkSize: number = 1000): string[] {
    let paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

    if (paragraphs.length <= 1 && text.length > maxChunkSize) {
        paragraphs = text.split(/(?<=\.)\s+(?=[A-Z])/).filter(p => p.trim().length > 0);
    }

    const chunks: string[] = [];
    let currentChunk = "";

    for (const paragraph of paragraphs) {
        const trimmed = paragraph.trim();
        if (!trimmed) continue;

        if (currentChunk && (currentChunk.length + trimmed.length + 1) > maxChunkSize) {
            chunks.push(currentChunk.trim());
            currentChunk = "";
        }

        if (trimmed.length > maxChunkSize) {
            if (currentChunk) {
                chunks.push(currentChunk.trim());
                currentChunk = "";
            }
            chunks.push(trimmed);
        } else {
            currentChunk += (currentChunk ? " " : "") + trimmed;
        }
    }

    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchEmbeddingWithRetry(text: string, retries = 5, delay = 5000): Promise<number[] | null> {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await embeddingModel.embedContent(text);
            return result.embedding.values;
        } catch (error) {
            const e = error as { status?: number; message?: string };
            const isRateLimit = e.status === 429 || (e.message && e.message.includes("429"));
            if (isRateLimit) {
                console.log(`\nRate limit hit. Waiting ${delay / 1000}s before retry ${i + 1}/${retries}...`);
                await sleep(delay);
                delay *= 2;
            } else {
                console.error(`\nFailed to embed chunk:`, e.message);
                return null;
            }
        }
    }
    console.error(`\nMax retries reached for chunk.`);
    return null;
}

async function ingestPersona(personaId: string, sources: SourceEntry[]) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`Ingesting persona: ${personaId} (${sources.length} source(s))`);
    console.log(`${"=".repeat(60)}`);

    const allChunks: DocumentChunk[] = [];

    for (let sourceIdx = 0; sourceIdx < sources.length; sourceIdx++) {
        const source = sources[sourceIdx];
        console.log(`\n[${sourceIdx + 1}/${sources.length}] Processing: ${source.label}`);

        try {
            let rawText: string;
            if (source.type === "url") {
                console.log(`  Fetching URL: ${source.path}`);
                rawText = await fetchUrl(source.path);
            } else {
                console.log(`  Reading file: ${source.path}`);
                rawText = await readLocalPdf(source.path);
            }

            console.log(`  Extracted ${rawText.length} characters. Chunking...`);
            const textChunks = chunkText(rawText);
            console.log(`  Created ${textChunks.length} chunks.`);

            textChunks.forEach((text, chunkIdx) => {
                allChunks.push({
                    id: `${personaId}-${sourceIdx}-${chunkIdx}`,
                    text,
                    metadata: {
                        sourceLabel: source.label,
                        source: source.path,
                    },
                });
            });
        } catch (error) {
            console.error(`  Error processing source "${source.label}":`, error);
        }
    }

    console.log(`\nGenerating embeddings for ${allChunks.length} chunks...`);

    const finalChunks: DocumentChunk[] = [];
    let processedCount = 0;

    for (const chunk of allChunks) {
        const embedding = await fetchEmbeddingWithRetry(chunk.text);
        if (embedding) {
            finalChunks.push({ ...chunk, embedding });
        }
        processedCount++;
        process.stdout.write(`\rProcessed ${processedCount}/${allChunks.length} embeddings.`);
    }

    const outputFile = path.join(OUTPUT_DIR, `${personaId}-index.json`);
    await fs.writeFile(outputFile, JSON.stringify(finalChunks), "utf-8");
    console.log(`\n\nSaved ${finalChunks.length} vectorized chunks to ${outputFile}`);
}

async function main() {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });

    const manifestData = await fs.readFile(SOURCES_FILE, "utf-8");
    const manifest: SourceManifest = JSON.parse(manifestData);

    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.error("Usage: npx tsx scripts/ingest-persona.ts <personaId> | --all");
        process.exit(1);
    }

    if (args[0] === "--all") {
        for (const personaId of Object.keys(manifest)) {
            await ingestPersona(personaId, manifest[personaId].sources);
        }
    } else {
        const personaId = args[0];
        if (!manifest[personaId]) {
            console.error(`Persona "${personaId}" not found in sources.json. Available: ${Object.keys(manifest).join(", ")}`);
            process.exit(1);
        }
        await ingestPersona(personaId, manifest[personaId].sources);
    }

    console.log("\n\nIngestion complete!");
}

main().catch(console.error);
```

- [ ] **Step 3: Delete `scripts/ingest-buffett.ts`**

```bash
git rm scripts/ingest-buffett.ts
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 5: Commit**

```bash
git add data/personas/sources.json scripts/ingest-persona.ts
git commit -m "feat: replace Buffett-specific ingestion with generic persona pipeline driven by sources.json"
```

---

### Task 4: Update Debug and Test Scripts

**Files:**
- Modify: `src/app/api/debug-rag/route.ts`
- Modify: `scripts/test-rag.ts`

- [ ] **Step 1: Parameterize debug-rag endpoint**

Replace `src/app/api/debug-rag/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getRagContext } from "@/lib/rag";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const persona = request.nextUrl.searchParams.get("persona") || "buffett";
    const query = request.nextUrl.searchParams.get("query") || "test query";

    try {
        const text = await getRagContext(persona, query);
        return NextResponse.json({ success: true, persona, query, text });
    } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        return NextResponse.json({ success: false, error: err.message, stack: err.stack });
    }
}
```

- [ ] **Step 2: Parameterize test-rag script**

Replace `scripts/test-rag.ts`:

```typescript
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
const { getRagContext } = require("../src/lib/rag");

async function main() {
    const personaId = process.argv[2] || "buffett";
    console.log(`Testing RAG retrieval for persona: ${personaId}\n`);

    const query = "What are your core investment principles and philosophy?";
    console.log(`Query: "${query}"\n`);

    const context = await getRagContext(personaId, query, 2);
    console.log(context || "(No RAG context returned — index may not exist yet)");
}

main().catch(console.error);
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 4: Commit**

```bash
git add src/app/api/debug-rag/route.ts scripts/test-rag.ts
git commit -m "feat: parameterize debug-rag endpoint and test-rag script for multi-persona"
```

---

### Task 5: Remove Buffett Branding — Layout, Sidebar, Profile

**Files:**
- Modify: `src/app/layout.tsx:8-11`
- Modify: `src/components/Sidebar.tsx:10`
- Modify: `src/app/profile/ProfileClient.tsx:110`

- [ ] **Step 1: Update layout.tsx metadata**

In `src/app/layout.tsx`, change lines 8-11:

```typescript
// Before:
export const metadata: Metadata = {
  title: "Warren Buffett Advisor",
  description: "Your personalized Warren Buffett advisor powered by his actual writings",
};

// After:
export const metadata: Metadata = {
  title: "Investment Advisory Board",
  description: "Your personalized investment advisory board powered by the wisdom of legendary investors",
};
```

- [ ] **Step 2: Update Sidebar nav item**

In `src/components/Sidebar.tsx`, change line 10:

```typescript
// Before:
{ name: "Warren Buffett", href: "/", icon: Users },

// After:
{ name: "Advisory Board", href: "/", icon: Users },
```

- [ ] **Step 3: Update ProfileClient copy**

In `src/app/profile/ProfileClient.tsx`, change line 110:

```typescript
// Before:
Warren will use this persistent context to tailor his advice to your specific situation.

// After:
Your advisors will use this persistent context to tailor their advice to your specific situation.
```

- [ ] **Step 4: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 5: Commit**

```bash
git add src/app/layout.tsx src/components/Sidebar.tsx src/app/profile/ProfileClient.tsx
git commit -m "refactor: replace Buffett branding with Investment Advisory Board identity"
```

---

### Task 6: Frontend — Persona Selector and HomeClient Overhaul

**Files:**
- Modify: `src/app/HomeClient.tsx`

- [ ] **Step 1: Rewrite HomeClient with persona selector**

Replace the entire file. Key changes:
- Add persona selector with multi-select toggle cards
- Replace `👴` emoji with generic icon
- Replace "Welcome to your Buffett Advisor" with "Welcome to your Advisory Board"
- Replace "Warren has responded" with dynamic response count
- Replace "Ask Warren..." placeholder with "Ask your advisors..."
- Replace "Warren is reviewing..." loading text with "Your advisors are analyzing..."
- Add `setSelectedPersonas` setter (currently missing)
- Enforce minimum 1 persona selected

```typescript
"use client";

import { useState, useRef, useEffect } from "react";
import { BrainCircuit, Send, BarChart2, Loader2, RefreshCw, Users } from "lucide-react";
import { PanelResponse } from "@/components/PanelResponse";
import { personas, PersonaId } from "@/lib/personas";
import type { PersonaResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "board";
  content: string;
  responses?: PersonaResponse[];
}

const allPersonaIds = Object.keys(personas) as PersonaId[];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>(allPersonaIds);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const togglePersona = (id: PersonaId) => {
    setSelectedPersonas(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1
        return prev.filter(p => p !== id);
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: newMsgId, role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          selectedPersonas,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to get response");

      const responseCount = data.responses?.length || 0;
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "board",
          content: `${responseCount} advisor${responseCount !== 1 ? "s" : ""} responded.`,
          responses: data.responses
        }
      ]);

    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Header */}
      <header className="flex-none border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center h-14 md:h-16 px-4 md:px-8">
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Investment Advisory Board</h1>
        </div>

        {/* Persona Selector */}
        <div className="flex items-center gap-2 px-4 md:px-8 pb-3 overflow-x-auto custom-scrollbar">
          {allPersonaIds.map(id => {
            const persona = personas[id];
            const isSelected = selectedPersonas.includes(id);
            return (
              <button
                key={id}
                onClick={() => togglePersona(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                  isSelected
                    ? "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 border-neutral-200 dark:border-neutral-800 opacity-60"
                }`}
              >
                <span className="text-base">{persona.avatar}</span>
                <span>{persona.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32">

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center space-y-4 md:space-y-6 animate-in fade-in duration-700">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full glass-panel-accent flex items-center justify-center mb-2 md:mb-4 shadow-inner">
                <Users className="h-8 w-8 md:h-10 md:w-10 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome to your Advisory Board</h2>
              <p className="text-neutral-600 dark:text-neutral-400 max-w-lg text-base md:text-lg">
                Consult your panel of legendary investors for guidance, market analysis, or strategy reviews tailored to your financial context.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 md:mt-8 w-full max-w-xl">
                <button
                  onClick={() => setInputValue("Analyze my current portfolio and tell me if I am diversified enough.")}
                  className="flex items-center space-x-3 p-4 glass-panel hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left group"
                >
                  <BarChart2 className="h-5 w-5 text-teal-600 dark:text-teal-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Analyze my current portfolio</span>
                </button>
                <button
                  onClick={() => setInputValue("Given my risk tolerance and goals, critique my investment strategy.")}
                  className="flex items-center space-x-3 p-4 glass-panel hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors text-left group"
                >
                  <BrainCircuit className="h-5 w-5 text-indigo-600 dark:text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Critique my investment strategy</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-12">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-3 md:px-6 md:py-4 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-2xl text-base md:text-lg border border-neutral-200 dark:border-transparent shadow-sm dark:shadow-md break-words transition-colors duration-300">
                      {msg.content}
                    </div>
                  ) : (
                    <div className="w-full mt-4">
                      <PanelResponse responses={msg.responses || []} />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-center space-x-3 md:space-x-4 text-teal-700 dark:text-teal-500 bg-teal-50 dark:bg-teal-500/5 px-4 py-3 md:px-6 md:py-4 rounded-2xl w-[90%] md:w-fit border border-teal-200 dark:border-teal-500/10 animate-pulse transition-colors duration-300">
                  <RefreshCw className="h-4 w-4 md:h-5 md:w-5 animate-spin flex-shrink-0" />
                  <span className="font-medium tracking-wide text-sm md:text-base">Your advisors are analyzing your portfolio...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 md:p-6 bg-gradient-to-t from-neutral-50 via-neutral-50 dark:from-[#050505] dark:via-[#050505] to-transparent transition-colors duration-300">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="glass-panel p-2 flex items-end relative shadow-xl dark:shadow-2xl shadow-teal-900/5 dark:shadow-teal-900/10 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 max-h-48 min-h-[56px] w-full resize-none bg-transparent px-3 py-3 md:px-4 md:py-4 pr-14 md:pr-16 text-sm md:text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-0 custom-scrollbar mb-1"
              placeholder="Ask your advisors..."
              rows={1}
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2 md:right-4 md:bottom-3 flex items-center space-x-2">
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center hover:bg-teal-100 dark:hover:bg-teal-500 hover:text-teal-800 dark:hover:text-white transition-all disabled:opacity-50 disabled:bg-transparent dark:disabled:bg-transparent disabled:text-neutral-400 dark:disabled:text-neutral-600 border border-transparent disabled:border-transparent"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] md:text-xs text-neutral-500 dark:text-neutral-600 mt-2 md:mt-4">
            AI can make mistakes. Verify important financial data.
          </p>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 3: Commit**

```bash
git add src/app/HomeClient.tsx
git commit -m "feat: add persona selector UI and remove Buffett branding from home page"
```

---

### Task 7: Update PanelResponse Header

**Files:**
- Modify: `src/components/PanelResponse.tsx`

- [ ] **Step 1: Replace hardcoded "Buffett's Analysis" header**

In `src/components/PanelResponse.tsx`, change line 16:

```typescript
// Before:
<h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Buffett's Analysis</h3>

// After:
<h3 className="text-sm font-semibold uppercase tracking-widest text-neutral-500">Advisory Board Responses</h3>
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 3: Commit**

```bash
git add src/components/PanelResponse.tsx
git commit -m "refactor: update PanelResponse header for multi-persona"
```

---

### Task 8: Update Documentation

**Files:**
- Modify: `src/app/user-guide/UserGuideClient.tsx`
- Modify: `USER_GUIDE.md`

- [ ] **Step 1: Update UserGuideClient.tsx Section 1**

In the `sections` array (lines 26-34), change:
```typescript
// Before:
{
    id: "warren-buffett",
    title: "1. Warren Buffett",
    icon: Users,
    subsections: [
        { id: "wb-logic", title: "Logic Mapping" },
        { id: "wb-ripple", title: " Ripple Effect" },
    ]
},

// After:
{
    id: "advisory-board",
    title: "1. Advisory Board",
    icon: Users,
    subsections: [
        { id: "ab-logic", title: "Logic Mapping" },
        { id: "ab-ripple", title: " Ripple Effect" },
    ]
},
```

Then update the corresponding section content (around lines 174-241):
- Change `id="warren-buffett"` to `id="advisory-board"` and update all `ref` keys
- Change heading from `"1. Warren Buffett (Chat Engine)"` to `"1. Investment Advisory Board (Chat Engine)"`
- Change description from "a conversational AI designed to emulate Warren Buffett" to "a conversational AI featuring a panel of legendary investors — Warren Buffett, Luiz Barsi, Max Gunther, Morgan Housel, and Dave Ramsey. Each advisor brings a distinct philosophy."
- Update the Ripple Effect example to mention "the Advisory Board" instead of just Warren
- Change `id="wb-logic"` to `id="ab-logic"` and `id="wb-ripple"` to `id="ab-ripple"` and update their refs

- [ ] **Step 2: Update USER_GUIDE.md Section 1**

Change lines 14-42 of `USER_GUIDE.md`:
- Section title: `## 1. Investment Advisory Board (Chat Engine)`
- Update description to explain multi-persona system
- Add list of 5 advisors with their philosophies
- Note that users can select which advisors to consult per question
- Update the Ripple Effect example to reference "the Advisory Board" generically
- Keep the Key Features section but update to mention multi-advisor context

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 4: Commit**

```bash
git add src/app/user-guide/UserGuideClient.tsx USER_GUIDE.md
git commit -m "docs: update user guide and manual for multi-persona Advisory Board"
```

---

### Task 9: Run Ingestion for All Personas

**Prerequisites:** Tasks 1-4 must be complete and passing `tsc --noEmit`.

- [ ] **Step 1: Run full ingestion**

```bash
npx tsx scripts/ingest-persona.ts --all
```

Expected: Each persona's sources are fetched/read, chunked, embedded, and saved to `data/personas/{personaId}-index.json`. This will take several minutes due to Gemini embedding API calls.

- [ ] **Step 2: Verify index files exist**

```bash
ls -la data/personas/*.json
```

Expected: 5 JSON files — `buffett-index.json`, `barsi-index.json`, `gunther-index.json`, `housel-index.json`, `ramsey-index.json`.

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: EXIT 0

- [ ] **Step 2: Start dev server**

Run: `npm run dev`

- [ ] **Step 3: Verify metadata**

Open browser — check that the tab title says "Investment Advisory Board"

- [ ] **Step 4: Verify sidebar**

Confirm sidebar shows "Advisory Board" instead of "Warren Buffett"

- [ ] **Step 5: Verify profile page**

Navigate to `/profile` — confirm copy says "Your advisors will use this persistent context..."

- [ ] **Step 6: Test persona selector**

On home page — verify all 5 persona chips are visible and toggleable. Verify cannot deselect all (minimum 1 enforced).

- [ ] **Step 7: Test multi-persona response**

With all 5 selected, submit a question. Verify 5 response panels render with correct avatars, names, and taglines.

- [ ] **Step 8: Test single-persona response**

Deselect all except one persona. Submit a question. Verify single response panel.

- [ ] **Step 9: Test graceful degradation**

Temporarily rename one persona's index file (e.g., `mv data/personas/ramsey-index.json data/personas/ramsey-index.json.bak`). Submit a question with that persona selected. Verify the persona still responds (just without RAG context) and server logs show `[RAG:ramsey] No index file found`. Restore the file afterward.

- [ ] **Step 10: Test debug-rag endpoint**

Visit `/api/debug-rag?persona=housel&query=what%20is%20wealth` — verify Housel-specific RAG context returns.

- [ ] **Step 11: Check server logs**

Confirm RAG logs show `[RAG:housel]`, `[RAG:buffett]` etc. with relevance scores and source labels (not "Shareholder Letter").

- [ ] **Step 12: Verify user guide**

Navigate to `/user-guide` — confirm Section 1 says "Advisory Board" and describes all 5 personas.

- [ ] **Step 13: Stop dev server and commit verification**

Stop server, create final commit if any fixes were needed.
