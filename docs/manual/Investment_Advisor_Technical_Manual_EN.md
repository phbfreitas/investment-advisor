# Investment Advisor — Technical Implementation Manual

**Version:** 1.0  
**Date:** April 2026  
**Audience:** Product Owner / Technical Audit  
**Purpose:** Complete bottom-up documentation of every system, prompt, data flow, and caching mechanism in the Investment Advisor platform. This document enables the PO to verify that the backend implementation matches the product vision.

---

# Table of Contents

1. System Architecture Overview
2. Data Model & DynamoDB Design
3. The Persona Engine
4. RAG (Retrieval-Augmented Generation) System
5. Chat Memory & Summarization System
6. The Chat Orchestration Pipeline
7. User Context Assembly Engine
8. AI Guidance Directives (6 Directives)
9. Global Radar System (7 Directives)
10. Live Market Data Integration (Yahoo Finance)
11. PDF Import & 3-Way Sync Engine
12. Audit Trail & Time Machine Rollback
13. News Ingestion & Caching
14. Streaming & Timeout Bypass (Heartbeat)
15. Caching Architecture (Fingerprint-Based)
16. Prompt Templates & Formatting Rules
17. Asset Snapshot System (31-Field Capture)
18. Authentication & Multi-Household Isolation

---

# 1. System Architecture Overview

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 / React 19 / Tailwind CSS v4 |
| AI Models | Google Gemini 2.5 Flash (chat, memory, radar), Gemini 3.1 Pro Preview (guidance directives) |
| Embeddings | Gemini Embedding 001 |
| Database | AWS DynamoDB (single-table design) |
| Deployment | SST on AWS Lambda + CloudFront |
| Auth | NextAuth.js with OAuth2 (Google) |
| Market Data | Yahoo Finance (yahoo-finance2 library) |
| News | NewsData.io API |
| PDF Parsing | unpdf library (extractText + getDocumentProxy) |

## Request Flow (High Level)

Every AI-powered feature follows this pattern:

1. **Authenticate** — Verify JWT session, extract `householdId`
2. **Fetch context** — Load user profile, assets, cash flow from DynamoDB
3. **Assemble context string** — `buildFullUserContext()` constructs a structured financial narrative
4. **Fetch persona-specific data** — Memory summaries, RAG chunks, rules files
5. **Construct prompt** — Combine system prompt + rules + RAG + memory + user context + instructions
6. **Query AI model** — Send to Gemini with appropriate model variant
7. **Stream response** — Return to client with heartbeat padding for timeout bypass
8. **Side effects** — Save exchange to history, trigger summarization if threshold met

---

# 2. Data Model & DynamoDB Design

## Single-Table Design

All data lives in one DynamoDB table. The partition key (`PK`) scopes everything to a household. The sort key (`SK`) identifies the entity type and instance.

| PK Pattern | SK Pattern | Entity |
|-----------|-----------|--------|
| `HOUSEHOLD#{householdId}` | `META` | User profile (strategy, goals, risk tolerance) |
| `HOUSEHOLD#{householdId}` | `ASSET#{uuid}` | Individual portfolio holding |
| `HOUSEHOLD#{householdId}` | `CHAT#{ISO-timestamp}` | Chat exchange (user message + all persona responses) |
| `HOUSEHOLD#{householdId}` | `CHAT_SUMMARY#{personaId}` | Per-persona long-term memory summary |
| `HOUSEHOLD#{householdId}` | `AUDIT_LOG#{ISO-timestamp}#{uuid}` | Portfolio change audit entry |
| `HOUSEHOLD#{householdId}` | `FINANCE_SUMMARY` | Monthly budget & cash flow data |
| `HOUSEHOLD#{householdId}` | `GUIDANCE_CACHE#{directive}#{fingerprint}` | Cached AI guidance response |
| `GLOBAL` | `NEWS_CACHE#{YYYY-MM-DD}` | Daily news cache (shared across all households) |

## Household Isolation

Every API endpoint extracts `householdId` from the authenticated session and uses it as the partition key prefix. No cross-household data access is possible — DynamoDB's partition key isolation enforces this at the database level.

---

# 3. The Persona Engine

**Source files:**
- `src/lib/personas-data.ts` — Persona definitions, system prompts, metadata
- `src/lib/personas.ts` — `generateSystemPrompt()` function
- `data/personas/rules/*.md` — Per-persona dogmatic rules files

## 3.1 — The Seven Personas

Each persona is defined with these fields:

| Field | Purpose |
|-------|---------|
| `id` | Machine identifier (e.g., `"buffett"`) |
| `name` | Display name (e.g., `"Warren Buffett"`) |
| `avatar` | Emoji for UI rendering |
| `tagline` | One-line descriptor (e.g., `"The Oracle of Omaha"`) |
| `background` | Short background label |
| `philosophy` | Core philosophy summary |
| `riskTolerance` | Low / Medium / High |
| `systemPrompt` | The verbatim system prompt injected into every Gemini call |
| `hasRag` | Whether this persona has a vector-indexed knowledge base |
| `rulesFile` | Filename of the persona's dogmatic rules Markdown file |

### Verbatim System Prompts

**John C. Bogle** (`bogle`):
```
You are John C. Bogle, founder of Vanguard and pioneer of index investing.
You advocate for low-cost, broadly diversified index funds as the optimal strategy for the vast majority of investors.
You believe that costs matter enormously — every dollar paid in fees is a dollar lost in returns, compounded over decades.
You distrust active management, market timing, and complex financial products, viewing Wall Street as an industry that profits at the expense of ordinary investors.
Your philosophy: "Don't look for the needle in the haystack. Just buy the haystack."
Tone: Principled, professorial, plainspoken, passionate about fairness, with a missionary's conviction.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Warren Buffett** (`buffett`):
```
You are Warren Buffett. You advocate for Value Investing.
Focus on intrinsic value, strong economic moats, and long-term holding.
You prefer businesses you can understand, with consistent earning power and good management.
You avoid speculative fads and timing the market.
Tone: Patient, grandfatherly, folksy wisdom, rational, and occasionally humorous.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Luiz Barsi Filho** (`barsi`):
```
You are Luiz Barsi Filho, Brazil's greatest individual investor.
You advocate for dividend-focused, long-term accumulation strategies.
You believe in buying shares of solid companies that pay consistent dividends and holding them forever.
You emphasize patience through market cycles and building an income-generating portfolio.
You distrust short-term speculation and believe the stock market is a "dividend machine."
Tone: Direct, practical, disciplined, occasionally blunt, with the wisdom of decades in emerging markets.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Benjamin Graham** (`graham`):
```
You are Benjamin Graham, the father of value investing and author of "The Intelligent Investor."
You advocate for disciplined, analytical investing grounded in the concept of margin of safety.
You believe in buying securities only when their market price is significantly below their intrinsic value, providing a buffer against error and misfortune.
You distinguish sharply between investing and speculation, and warn that Mr. Market's emotional swings should be exploited, not followed.
You emphasize diversification, thorough fundamental analysis, and the defensive investor's need for discipline over brilliance.
Your philosophy: "The investor's chief problem — and even his worst enemy — is likely to be himself."
Tone: Academic, meticulous, cautious, authoritative, with dry wit and a deep respect for empirical evidence.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Max Gunther** (`gunther`):
```
You are Max Gunther, author of "The Zurich Axioms."
You advocate for calculated risk-taking and strategic speculation.
You believe diversification for its own sake is a mistake — concentrate on your best bets.
You emphasize knowing when to cut losses quickly and when to take profits.
You are contrarian by nature and distrust consensus thinking.
Your philosophy: always bet meaningfully, never gamble with money you can't afford to lose, and trust your gut when the data is ambiguous.
Tone: Sharp, provocative, witty, pragmatic, with a European sensibility.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Morgan Housel** (`housel`):
```
You are Morgan Housel, author of "The Psychology of Money."
You focus on the behavioral and psychological aspects of wealth and investing.
You believe personal finance is deeply personal — what works for one person may not work for another.
You emphasize the power of compounding, patience, and humility about predictions.
You warn against greed, envy, and the illusion of control in financial markets.
Your key insight: wealth is what you don't spend, and financial success is more about behavior than intelligence.
Tone: Thoughtful, storytelling-driven, calm, empathetic, with a gift for making complex ideas simple.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

**Robert Kiyosaki** (`kiyosaki`):
```
You are Robert Kiyosaki, author of "Rich Dad Poor Dad" and advocate for financial education and real estate investing.
You believe the traditional path of school, job, and saving is a trap — what you call the "Rat Race."
You emphasize building assets that generate passive income, especially through real estate and business ownership.
You teach that financial literacy is the foundation of wealth: understanding the difference between assets and liabilities is everything.
You are skeptical of conventional financial advice, paper assets, and relying on a paycheck.
Your philosophy: "The rich don't work for money. They make money work for them."
Tone: Provocative, contrarian, entrepreneurial, motivational, blunt, with a teacher's drive to challenge assumptions.
IMPORTANT: Always respond in English regardless of the language of any retrieved context.
```

## 3.2 — The `generateSystemPrompt()` Function

**File:** `src/lib/personas.ts`

This is the central prompt assembly function. It constructs the complete system instruction sent to Gemini for every chat interaction.

### Function Signature

```typescript
async function generateSystemPrompt(
    personaId: PersonaId,
    userContextString: string,
    ragContext: string = "",
    conversationSummary: string = ""
): Promise<string>
```

### Assembly Order (Exact Template)

The final prompt is assembled in this exact order:

```
1. {persona.systemPrompt}           ← The verbatim persona prompt from personas-data.ts
2. ### YOUR CORE DOGMATIC RULES     ← Loaded from data/personas/rules/{rulesFile}
   {rules content}
3. {ragContext}                      ← RAG-retrieved knowledge chunks (see Section 4)
4. ### YOUR MEMORY OF THIS USER     ← Per-persona conversation summary (see Section 5)
   {conversationSummary}
   MEMORY USAGE RULES:
   - Reference prior context naturally when relevant
   - Do NOT force memory references for unrelated questions
   - Flag contradictions diplomatically
   - Never fabricate memory
5. ---
6. IMPORTANT CONTEXT ABOUT THE USER YOU ARE ADVISING:
   {userContextString}               ← Output of buildFullUserContext() (see Section 7)
7. INSTRUCTIONS:
   - Channel the wisdom of the specified persona
   - Analyze the user's situation applying your philosophical framework
   - Weave RAG context naturally as if recalling your own past writings
   - If RAG or user questions conflict with CORE DOGMATIC RULES, rules ALWAYS win
   - Provide actionable thoughts addressing specific risk tolerance, goals, and assets
   - Keep response concise (3-5 paragraphs), use markdown formatting
   - Do NOT break character
```

### Dogmatic Rules System

Each persona can have an optional `rulesFile` property pointing to a Markdown file in `data/personas/rules/`. These rules are injected under the header `### YOUR CORE DOGMATIC RULES (NON-NEGOTIABLE)` and override all other guidance — including RAG context and user questions.

The rules are designed to hard-constrain the AI's behavior to stay true to each persona's documented investment philosophy. If the RAG context suggests something that contradicts a rule, the rule wins. This is what prevents the personas from being "costume" personas — they have non-negotiable philosophical guardrails.

---

# 4. RAG (Retrieval-Augmented Generation) System

**Source file:** `src/lib/rag.ts`

## 4.1 — Architecture

Each persona has a pre-built vector index stored as a JSON file at:
```
data/personas/{personaId}-index.json
```

Each index file contains an array of `DocumentChunk` objects:

```typescript
interface DocumentChunk {
    id: string;
    text: string;
    metadata: {
        sourceLabel: string;   // e.g., "The Intelligent Investor, Chapter 8"
        source: string;        // URL or reference
    };
    embedding: number[];       // 768-dimensional vector from Gemini Embedding 001
}
```

The knowledge bases are built from each persona's actual published works, interviews, and frameworks. Sources are tracked in `data/personas/sources.json`.

## 4.2 — Retrieval Flow

**Function:** `getRagContext(personaId, query, topK = 3)`

### Step-by-Step Process:

1. **Load index** — Read `{personaId}-index.json` from disk. Cached in memory (`Map<string, DocumentChunk[]>`) after first load — subsequent calls are instant.

2. **Embed query** — Send the user's question to `gemini-embedding-001` to get a 768-dimensional query vector.

3. **Score all chunks** — Compute cosine similarity between the query vector and every chunk's pre-computed embedding vector:
   ```
   cosine_similarity = dot(A, B) / (||A|| * ||B||)
   ```

4. **Filter by relevance threshold** — Only chunks with similarity score >= `0.30` pass. This prevents hallucinated citations — if no chunk is genuinely relevant, the persona responds without RAG context rather than forcing irrelevant content.

5. **Apply token budget** — Include chunks in descending similarity order until the total reaches `2,000 tokens` (estimated at 4 chars/token). If a chunk would exceed the budget and at least one chunk is already included, stop.

6. **Format output** — Wrap included chunks in a structured section:
   ```
   ### RETRIEVED KNOWLEDGE BASE EXTRACTS:
   These are specific, retrieved excerpts from your actual writings meant to help you directly answer the user's question.

   --- Extract 1 (Source: The Intelligent Investor, Chapter 8) ---
   {chunk text}

   --- Extract 2 (Source: ...) ---
   {chunk text}
   ```

### Key Design Decisions

- **Relevance threshold of 0.30**: Set low enough to capture tangentially relevant content but high enough to exclude noise. Logged to console for debugging.
- **Token budget of 2,000**: Prevents RAG context from overwhelming the persona's own reasoning. Leaves room for the system prompt, rules, memory, and user context.
- **Graceful degradation**: If no index file exists for a persona, the function returns empty string — the persona works without RAG, relying purely on its system prompt and the AI model's training data.

---

# 5. Chat Memory & Summarization System

**Source file:** `src/lib/chat-memory.ts`

## 5.1 — Architecture Overview

The memory system has two tiers:

| Tier | DynamoDB SK Pattern | Purpose | Retention |
|------|-------------------|---------|-----------|
| Raw exchanges | `CHAT#{ISO-timestamp}` | Complete conversation records | 180 days (TTL) |
| Per-persona summaries | `CHAT_SUMMARY#{personaId}` | Compressed long-term memory | Indefinite |

## 5.2 — Exchange Storage

**Function:** `saveExchange(householdId, userMessage, selectedPersonas, responses)`

Every chat interaction saves a complete exchange record:

```typescript
{
    PK: "HOUSEHOLD#{householdId}",
    SK: "CHAT#{ISO-timestamp}",        // e.g., "CHAT#2026-04-01T14:32:00.000Z"
    userMessage: string,                // The user's question
    selectedPersonas: string[],         // Which personas participated
    responses: PersonaResponse[],       // All persona responses (content + status)
    ttl: number,                        // Unix timestamp, 180 days from now
    entityType: "CHAT"
}
```

The TTL field causes DynamoDB to automatically delete raw exchanges after 180 days. This is acceptable because the important context is preserved in the per-persona summaries.

## 5.3 — Per-Persona History for Gemini

**Function:** `buildPersonaHistory(exchanges, personaId, limit = 5)`

This function builds the `history` array for Gemini's `startChat()` API. For each persona:

1. Filter exchanges to only those where this persona participated AND returned a successful response
2. Take the most recent 5 exchanges
3. Reverse to chronological order (Gemini expects oldest-first)
4. Format as alternating `user`/`model` message pairs

This gives each persona conversational continuity — they can reference what was said 2–3 messages ago without relying on summarization.

## 5.4 — Threshold-Based Summarization

**Trigger:** `shouldSummarize(summary, recentExchanges, personaId)`

Summarization is triggered when a persona has accumulated **3 or more unsummarized exchanges** (`SUMMARY_THRESHOLD = 3`). The count is determined by comparing exchange timestamps against the summary's `lastExchangeTimestamp`.

### Summarization Prompt (Verbatim)

**Function:** `updateSummary(householdId, personaId, existingSummary, recentExchanges)`

The system sends the following prompt to `gemini-2.5-flash`:

```
You are a memory summarizer for an investment advisory AI system. Your job is to maintain a structured, running profile of the user based on their conversations with the "{personaId}" advisor.

{If existing summary exists:}
EXISTING MEMORY:
{existing summary text}

NEW CONVERSATIONS:
{chronological exchange snippets, each with timestamp, user message, and first 500 chars of persona response}

INSTRUCTIONS:
- Produce an updated summary (max 600 words) using EXACTLY these 6 sections with ### headers:

### Our Journey So Far
A warm, engaging narrative summary of the conversations so far — written as if the advisor is recounting their relationship with this client. CRITICAL: Follow strict chronological order from the EARLIEST conversation (Exchange 1) to the MOST RECENT. The narrative should flow as a timeline: "We first discussed X... Later, you mentioned Y... Most recently, you brought up Z..." Cover key topics discussed, how the user's thinking has evolved, and the overall trajectory of their investment journey together. Write in a flowing, enjoyable-to-read style (half a page in length). This is the centerpiece of the advisor's notebook.

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
- Do NOT include any text before the first ### header
```

### Summary Storage

```typescript
{
    PK: "HOUSEHOLD#{householdId}",
    SK: "CHAT_SUMMARY#{personaId}",
    summary: string,                    // The 6-section structured text
    personaId: string,
    lastExchangeTimestamp: string,       // ISO timestamp of newest summarized exchange
    exchangeCount: number,              // Cumulative count of all summarized exchanges
    updatedAt: string,
    entityType: "CHAT_SUMMARY",
    formatVersion: "v2"                 // Bumping this forces regeneration of all summaries
}
```

### Key Design Decisions

- **Per-persona memory**: Each of the 7 advisors has their own independent memory of the user. Buffett remembers what was discussed with Buffett; Bogle has separate context. This prevents cross-contamination of philosophical perspectives.
- **Threshold of 3**: Balances freshness (don't wait too long) against API cost (don't summarize after every message).
- **600-word max**: Keeps memory concise enough to fit within Gemini's context window alongside all other context.
- **Format version**: The `SUMMARY_FORMAT_VERSION = "v2"` field allows forced regeneration of all summaries if the prompt structure changes.
- **Snippet truncation**: Only the first 500 characters of each persona response are included in the summarization prompt to stay within token limits.

## 5.5 — Clear History

**Function:** `clearHistory(householdId, mode, personaId?)`

Three modes:
- `"chat"` — Delete all raw `CHAT#` exchanges only
- `"summary"` + `personaId` — Delete a single advisor's summary
- `"all"` — Delete all exchanges AND all 7 persona summaries + legacy singleton summary

Batch delete uses DynamoDB `BatchWriteCommand` with 25-item chunks (DynamoDB's limit per batch).

---

# 6. The Chat Orchestration Pipeline

**Source file:** `src/app/api/chat/route.ts`

This is the core API endpoint that handles the Expert Guidance chat. It orchestrates the entire flow from receiving a user message to streaming 7 simultaneous persona responses.

## 6.1 — Request Flow (Step by Step)

### Step 1: Authentication & Input Validation
```
POST /api/chat
Body: { message: string, selectedPersonas: string[] }
```
Extracts `householdId` from the authenticated session. Validates message is present.

### Step 2: Parallel Data Fetch

Two operations run simultaneously via `Promise.all`:

```typescript
const [profile, memoryData] = await Promise.all([
    // 1. Fetch user profile (META record)
    db.send(new GetCommand({ Key: { PK, SK: "META" } })),
    
    // 2. Fetch chat memory (recent exchanges + per-persona summaries)
    (async () => {
        const exchanges = await getRecentExchanges(householdId, 10);
        const summaries = await getAllSummaries(householdId);
        return { exchanges, summaries };
    })()
]);
```

### Step 3: Build User Context

Calls `buildFullUserContext(profile)` to assemble the complete financial narrative (see Section 7 for full details).

### Step 4: Per-Persona Summarization Check

Before querying any persona, the system checks if summarization is needed:

```typescript
for (const personaId of selectedPersonas) {
    const summary = summaries[personaId];
    if (shouldSummarize(summary, exchanges, personaId)) {
        await updateSummary(householdId, personaId, summary, exchanges);
    }
}
```

This ensures memory is fresh before the persona responds. The threshold check is cheap (timestamp comparison); the actual summarization only triggers when 3+ unsummarized exchanges exist.

### Step 5: Parallel Persona Queries

All selected personas are queried simultaneously:

```typescript
const results = await Promise.all(
    selectedPersonas.map(personaId => fetchPersonaResponse(personaId))
);
```

For each persona, `fetchPersonaResponse` does:

1. **Build history** — `buildPersonaHistory(exchanges, personaId, 5)` returns the last 5 exchanges formatted for Gemini's `startChat()` API
2. **Fetch RAG context** — `getRagContext(personaId, userMessage)` retrieves relevant knowledge chunks
3. **Get memory summary** — Extract this persona's summary text from the pre-fetched summaries
4. **Generate system prompt** — `generateSystemPrompt(personaId, userContext, ragContext, summaryText)` assembles the complete system instruction
5. **Query Gemini** — Uses `gemini-2.5-flash` with:
   - `systemInstruction`: The assembled prompt
   - `history`: The last 5 exchanges
   - `tools`: `[{ functionDeclarations: [fetchStockDataToolDefinition] }]`
6. **Handle function calls** — If Gemini calls `fetchStockData(ticker)`, the system:
   - Executes the Yahoo Finance lookup
   - Sends the result back to Gemini as a tool response
   - Gets the updated response that incorporates live market data
7. **Return response** — `{ personaId, content, status: "success" | "error" }`

### Step 6: Fire-and-Forget Exchange Save

After all responses are collected:

```typescript
saveExchange(householdId, userMessage, selectedPersonas, responses)
    .catch(err => console.error("Failed to save exchange:", err));
```

This is intentionally non-blocking — the user gets their response immediately, and the save happens asynchronously. If it fails, the user experience is unaffected (they just lose that exchange from history).

### Step 7: Rate Limit Detection

If any persona returns a 429 (rate limit) error from Gemini, the system returns a specific error message to the frontend so it can display an appropriate "please wait" message.

## 6.2 — Model Selection

| Component | Model | Rationale |
|-----------|-------|-----------|
| Chat personas | `gemini-2.5-flash` | Fast, cost-effective for conversational responses |
| Memory summarization | `gemini-2.5-flash` | Routine summarization task, doesn't need top-tier model |
| Query embedding | `gemini-embedding-001` | Purpose-built for vector similarity |

---

# 7. User Context Assembly Engine

**Source file:** `src/lib/portfolio-analytics.ts`

This is the most critical data assembly layer. Every AI feature — chat, guidance, radar — uses the output of these functions to inject the user's complete financial picture into the prompt.

## 7.1 — `buildFullUserContext(profile)`

Produces a multi-section structured narrative string. Here is the exact output format:

### Section 1: Investment Strategy

```
=== INVESTMENT STRATEGY ===
Strategy: {profile.strategy}
Goals: {profile.goals}
{formatStrategyContext(profile) output — see 7.2}
```

### Section 2: Monthly Budget

```
=== MONTHLY BUDGET ===
Income:
  Paycheck: ${paycheck}
  Rental: ${rental}
  Dividends: ${dividends}
  Bonus: ${bonus}
  Other: ${other}
  TOTAL INCOME: ${sum}

Expenses:
  Housing: ${housing}
  Utilities: ${utilities}
  Car & Transport: ${car}
  Food: ${food}
  Discretionary: ${discretionary}
  Rental Expenses: ${rental}
  TOTAL EXPENSES: ${sum}

Target Savings Rate: {savings}%
```

Only included if the profile has a `financeSummary` with budget data.

### Section 3: Wealth & Net Worth

```
=== WEALTH & NET WORTH ===
Non-Investment Assets:
  Cash & Savings: ${cash}
  Primary Residence: ${primaryResidence}
  Rental Properties: ${rentalProperties}
  Vehicles: ${vehicles}
  Other Assets: ${otherAssets}

Liabilities:
  Primary Mortgage: ${primaryMortgage}
  HELOC: ${heloc}
  Rental Property Mortgage: ${rentalMortgage}
  Credit Cards: ${creditCards}
  Car Lease/Loan: ${carLease}
```

Only included if the profile has wealth data.

### Section 4: Portfolio Holdings

```
=== PORTFOLIO HOLDINGS ===
Total Holdings: {count}
Total Market Value: ${totalMV}
Total Book Cost: ${totalBK}
Total P/L: ${totalPL} ({plPercent}%)
Weighted Avg Yield: {weightedYield}%
Expected Annual Dividends: ${annualDivs}
Total Net Worth (Portfolio + Wealth Assets - Liabilities): ${netWorth}

{For each asset:}
- {ticker} | Qty: {qty} | MV: ${mv} | BK: ${bk} | P/L: ${pl} | Yield: {yield}% | Sector: {sector} | Geo: {market} | Account: {account} ({accountType}) | Type: {securityType} | Strategy: {strategyType} | Call: {call} | Mgmt: {managementStyle} | Rating: {rating} | Fee: {fee}% | Beta: {beta}
```

### Key Implementation Detail

The function queries DynamoDB for all `ASSET#` records, then computes:
- **Total market value, book cost, P/L** across all holdings
- **Weighted average yield** (yield of each holding * its market value weight)
- **Expected annual dividends** (sum of `expectedAnnualDividends` field per asset)
- **Net worth** = portfolio market value + wealth assets - liabilities

## 7.2 — `formatStrategyContext(profile)`

Formats the strategy-specific Blueprint fields into a readable block:

```
Asset Mix Targets: Growth: {growth}% | Income: {income}% | Mixed: {mixed}%

Investment Philosophies: {comma-separated list}
Core Principles: {comma-separated list}
Account Types: {comma-separated list}
Trading Methodologies: {comma-separated list}

Sector Allocation Targets:
  {For each sector with target > 0:}
  - {sectorName}: {target}%

Geographic Allocation Targets:
  {For each geography with target > 0:}
  - {geoName}: {target}%

Target Annual Return: {targetReturn}%
Target Monthly Dividend: ${targetDividend}
Risk Tolerance: {riskTolerance}/10 ({label})
```

Risk tolerance labels:
- 1-3: Conservative
- 4-6: Moderate
- 7-8: Aggressive
- 9-10: Very Aggressive

## 7.3 — Portfolio Drift Engine

**Function:** `calculatePortfolioDrift(assets, profile)`

Compares actual portfolio distribution against Blueprint targets.

### Normalization Maps

The system normalizes free-text sector/geography values to standard categories using mapping dictionaries. Examples:
- `"Information Technology"`, `"Tech"`, `"IT"` all normalize to `"Information Technology"`
- `"USA"`, `"United States"`, `"US"` all normalize to `"United States"`

### Drift Calculation

For each sector/geography target:
1. Sum market values of all assets matching that category
2. Divide by total portfolio market value to get actual percentage
3. Compare to target percentage
4. Flag if absolute difference exceeds `DRIFT_WARNING_THRESHOLD = 5%`

Returns:
```typescript
{
    sectorDrift: Array<{ sector, target, actual, drift, overThreshold }>,
    geoDrift: Array<{ geography, target, actual, drift, overThreshold }>
}
```

## 7.4 — Performance Estimates

**Function:** `calculatePerformanceEstimates(assets, profile)`

- **Weighted annual return**: Sum of (each asset's oneYearReturn * its portfolio weight)
- **Estimated monthly dividend**: Sum of all assets' `expectedAnnualDividends` / 12

---

# 8. AI Guidance Directives (6 Directives)

**Source file:** `src/app/api/guidance/route.ts`

## 8.1 — Architecture

The guidance system runs structured analytical prompts against the user's complete financial context. Unlike chat (which is conversational), directives produce formatted analytical reports.

### System-Level Configuration

**Model:** `gemini-3.1-pro-preview` (upgraded from flash for higher quality analytical output)

**CIO System Instruction (verbatim):**
```
You are the Chief Investment Officer (CIO) of a sophisticated investment platform.
Your tone is "Executive Crispy" — structured, data-driven, and actionable.
Structure your response with clear H2 (##) and H3 (###) headers.
Use tables where comparisons are helpful.
Bold key metrics and tickers.
No fluff — every sentence should add value.
Use markdown formatting throughout.
Do NOT use raw HTML tags. Only use Markdown.
```

**Formatting Rules** (appended to every directive prompt):
```
FORMATTING RULES (CRITICAL):
- ALWAYS use GitHub-flavored Markdown.
- Break up large blocks of text. Use double newlines for generous spacing.
- Use H2 (##) and H3 (###) headers to clearly separate sections.
- Use bulleted lists (-) heavily for any multi-point analysis.
- **Bold** key terms, tickers, and financial metrics.
- Use Blockquotes (>) to highlight the most important takeaway or conclusion.
- Where appropriate, use Markdown Tables for scannability.
- Never write a paragraph longer than 3-4 sentences without breaking it up.
- NEVER use raw HTML tags. Only use Markdown.
```

## 8.2 — The Six Directive Prompts (Verbatim)

### Directive 1: Rebalance with Precision

```
Identify when my growth-to-income ratio drifts from the 50/50 target. Recommend specific buy/sell orders to restore alignment — with position sizing. Cross-reference my current sector and geographic allocations.
```

**What it does:** Compares actual growth/income/mixed percentages against the user's Blueprint targets. Recommends specific trades with share quantities to restore alignment.

### Directive 2: Optimize Dividend Growth

```
Suggest high-conviction moves to increase dividend growth. Focus on my income-generating positions and recommend upgrades, additions, or trims based on yield sustainability, payout ratios, and my target monthly dividend.
```

**What it does:** Analyzes dividend-paying positions against the target monthly dividend. Considers account types (TFSA vs RRSP vs Non-Registered) for tax efficiency.

### Directive 3: Maintain Tactical Aggression

```
Highlight 'Buy the Dip' opportunities that align with my 10% annual return benchmark and my defined risk tolerance. Propose specific entry points for growth-oriented positions.
```

**What it does:** Identifies growth opportunities anchored to the user's return benchmark. Filtered by the user's trading methodologies — respects whether the user is a "Buy the Dip" practitioner or not.

### Directive 4: Investment Idea Evaluation

This directive is unique — it takes a user-provided ticker and produces a multi-section debate report.

```
Provide a detailed Investment Idea Evaluation for the ticker [{ticker}]. Structure your response in EXACTLY these sections:

## Board of Directors Opinion
Simulate a board debate where these legendary investors weigh in:
- **Warren Buffett**: Value & moat perspective
- **Ray Dalio**: Macro & risk parity perspective
- **Cathie Wood**: Disruptive innovation perspective
- **Peter Lynch**: Growth at a reasonable price perspective
- **John Bogle**: Index & cost perspective
Each advisor gives a CLEAR verdict: Buy, Hold, or Sell with 2-3 sentence justification.

## Multi-Factor Analysis
Present a table with these columns: Factor | Score (1-10) | Assessment
Factors: Valuation, Growth Potential, Dividend Profile, Risk Level, Strategic Fit

## Strategic Direction
How does this ticker align with my specific strategy, sector targets, and portfolio gaps?

## AI Official Opinion
Your synthesized recommendation considering all the above. Clear Buy/Hold/Sell with confidence level and suggested position size relative to my portfolio.
```

**What it does:** The most sophisticated single directive. Simulates a board debate across 5 investment philosophies, runs a multi-factor quantitative analysis, assesses strategic fit against the user's specific portfolio, and synthesizes an official opinion.

### Directive 5: Portfolio Report

```
Generate a comprehensive multi-factor portfolio analysis report highlighting strengths, weaknesses, risk concentrations, and rebalancing priorities. Include forward-looking suggestions based on my strategy and targets.
```

**What it does:** Full portfolio health check benchmarked against the user's Blueprint targets (not generic market benchmarks). Flags sector/geo drift, assesses asset mix vs goals.

### Directive 6: Stock Recommendations

```
Based on my current portfolio, strategy, and market conditions, recommend specific stocks to buy assuming funds are available. Provide 3-5 specific equities or ETFs with clear rationale for each, including how they fill gaps in my current allocation.
```

**What it does:** 3-5 actionable buy recommendations filtered by the user's philosophies, account types, and risk tolerance. Each recommendation explains which portfolio gap it fills.

## 8.3 — Prompt Assembly for Directives

Each directive prompt is assembled as:

```
{FORMATTING_RULES}

{directive prompt text}

USER'S COMPLETE FINANCIAL CONTEXT:
{buildFullUserContext(profile) output}
```

The CIO system instruction is passed separately as the model's `systemInstruction`.

## 8.4 — Fingerprint-Based Caching

The system computes a cache fingerprint from:

```typescript
fingerprint = hash(profile.strategy + JSON.stringify(assets))
```

**Cache key:** `GUIDANCE_CACHE#{directiveNumber}#{fingerprint}`

### Cache Logic:

1. Before querying Gemini, compute the current fingerprint
2. Check DynamoDB for a cached response with that fingerprint
3. **If cache hit**: Return cached response immediately with `X-Guidance-Cache: HIT` header
4. **If cache miss**: Query Gemini, cache the response, return with `X-Guidance-Cache: MISS` header

### Cache Invalidation:

The cache is automatically invalidated when:
- The user's strategy changes (any Blueprint field modification)
- The portfolio changes (any asset addition, update, or deletion)

Both of these change the fingerprint, causing a cache miss on the next request.

The response also includes `X-Guidance-Changed-Fields` header listing which fields changed since the last cached version.

## 8.5 — Streaming & Heartbeat

Guidance responses use streaming with a heartbeat mechanism to bypass AWS CloudFront's 30-second timeout:

```typescript
// Every 5 seconds, send a zero-width space character
const heartbeat = setInterval(() => {
    controller.enqueue(encoder.encode('\u200B'));
}, 5000);
```

This keeps the connection alive while Gemini processes complex analytical prompts that may take 30-60 seconds with `gemini-3.1-pro-preview`.

---

# 9. Global Radar System (7 Directives)

**Source file:** `src/app/api/global-radar/route.ts`

## 9.1 — Architecture

Global Radar connects live geopolitical news to the user's specific portfolio. It fetches real-time financial news, injects it alongside the user's complete financial context, and runs structured analytical directives.

### System Instruction (Verbatim)

```
You are the Chief Investment Officer (CIO) of a sophisticated investment platform, with deep expertise in geopolitical risk analysis and macro investing. Your tone is "Executive Crispy" — structured, data-driven, and actionable.
```

### Model

- **Directives 1-5 and 7:** `gemini-2.5-flash`
- **Directive 6 (Deep Critique):** `gemini-2.5-flash` for individual analyses, with parallel execution and synthesis

## 9.2 — Prompt Assembly

Each radar directive prompt is assembled as:

```
{FORMATTING_RULES}

=== TODAY'S NEWS DIGEST ===
{formatNewsContext(articles) output — see Section 13}

{directive-specific prompt}

=== USER PORTFOLIO & STRATEGY ===
{buildFullUserContext(profile) output}
```

## 9.3 — The Seven Directive Prompts (Verbatim)

### Directive 1: Net Worth Stress Test

```
Analyze my complete financial position — liquid portfolio, real estate exposure, and monthly cash flow — against the current geopolitical and macro backdrop.

Structure:
## Liquid Portfolio Vulnerability
- Which holdings are most exposed to current macro risks?
- Quantify potential drawdown scenarios (mild, moderate, severe)

## Real Estate & Hard Asset Exposure
- How do current interest rate trends affect my property values and mortgage costs?
- CAD/USD implications for my cross-border exposure

## Cash Flow Resilience
- Can my current income/expense ratio absorb a 20% portfolio drawdown?
- What is my "financial runway" if income disruption occurs?

## Net Worth Stress Scenarios
Present a table: Scenario | Portfolio Impact | Real Estate Impact | Net Worth Change
Include: Base Case, Mild Recession, Severe Downturn, Stagflation
```

### Directive 2: Deep Buy Scanner

```
Identify exactly 3 "deep value" buying opportunities that emerge from current geopolitical disruption. Each pick must meet ALL three criteria:
1. Price has dropped due to panic/sentiment, not fundamental deterioration
2. Technical indicators (beta, volatility) show selling exhaustion
3. Current valuation is below 5-year average on key metrics

For each pick:
## [Ticker] — [Company Name]
- **The Setup**: Why this opportunity exists now (connect to specific news)
- **Valuation Case**: Key metrics vs. 5-year averages
- **Risk/Reward**: Downside risk vs. upside potential (quantified)
- **Position Sizing**: Recommended allocation as % of my portfolio
- **Correlation Check**: How this correlates with my existing holdings

IMPORTANT: Do NOT recommend tickers I already hold. Check my portfolio first.
```

### Directive 3: Opportunity Cost Evaluator

```
Which sectors or positions in my portfolio have become "dead money" in the current macro regime?

For each identified position:
## [Ticker/Sector] — Opportunity Cost Analysis
- **Current Status**: Performance and outlook given today's news
- **Opportunity Cost**: What could this capital be doing instead?
- **Action Threshold**: At what point should I cut this position?
- **Tax Implications**: Consider my account type (TFSA/RRSP/Non-Reg)

Conclude with a ranked "Redeployment Priority List" — positions to exit first, with suggested replacement investments.
```

### Directive 4: Cross-Sectional Impact Report

```
How do current geopolitical events alter the risk profile across my asset mix categories?

Structure the analysis by my target allocation: 40% Growth / 40% Mix / 20% Dividends

## Growth Sleeve (Target: 40%)
- Which growth holdings benefit/suffer from current events?
- Should I adjust my growth allocation temporarily?

## Mixed Sleeve (Target: 40%)
- How do current events affect my balanced positions?
- Are any "mixed" holdings becoming pure growth or pure income plays?

## Dividend Sleeve (Target: 20%)
- Dividend sustainability analysis given current macro pressures
- Which dividend payers are most/least resilient?

## Rebalancing Verdict
Should I adjust my 40/40/20 allocation given current conditions? If so, to what?
```

### Directive 5: Full Strategy Critic

```
Benchmark my current strategy against major asset classes and alternative approaches given today's macro environment.

## Strategy vs. Benchmarks
Compare my actual returns and risk profile against:
- S&P 500 (US Large Cap)
- TSX Composite (Canadian)
- AGG (US Bonds)
- GLD (Gold/Commodities)
Present as a comparison table with: YTD Return, Volatility, Sharpe-like Assessment

## Strategic Gaps
What risks is my current strategy NOT hedging for?
What opportunities is my current strategy NOT capturing?

## Devil's Advocate
Make the strongest possible case AGAINST my current approach given today's news.

## Recommended Adjustments
Specific, actionable changes ranked by priority and impact.
```

### Directive 6: Deep Critique (Parallel Execution)

This is the most architecturally complex directive. It runs 5 analyses **in parallel** and then synthesizes them into an executive report.

#### Parallel Execution Architecture:

```typescript
// All 5 analyses start with 500ms stagger to avoid rate limits
const analyses = await Promise.all([
    runAnalysis("Net Worth Stress Test", directive1Prompt, 0),
    runAnalysis("Deep Buy Scanner", directive2Prompt, 500),
    runAnalysis("Opportunity Cost Evaluator", directive3Prompt, 1000),
    runAnalysis("Cross-Sectional Impact", directive4Prompt, 1500),
    runAnalysis("Full Strategy Critic", directive5Prompt, 2000),
]);
```

Each analysis runs independently against `gemini-2.5-flash`. The stagger prevents hitting Gemini's rate limits.

#### Synthesis Prompt:

After all 5 analyses complete, the system sends a synthesis prompt:

```
You are the Chief Investment Officer synthesizing five independent analyses into a single executive report.

Here are the five completed analyses:
{analysis 1 output}
{analysis 2 output}
{analysis 3 output}
{analysis 4 output}
{analysis 5 output}

Synthesize into an executive report with these sections:

## Executive Summary
3-sentence overview of the most critical findings.

## Top 3 Immediate Actions
Specific, actionable steps the user should take THIS WEEK, ranked by urgency.

## Top 3 Deep Buy Stocks
The strongest buying opportunities from across all analyses.

## Single Biggest Risk
The one risk that could most damage this portfolio given current conditions.

## Strategic Outlook
Forward-looking assessment: what should the user be preparing for over the next 3-6 months?
```

### Directive 7: Daily Verdict

```
For EACH major news item provided, create a structured verdict:

## [News Headline]

### The Fact
One-sentence summary of what happened.

### The 'So What?'
Why this matters for markets and investors generally.

### Impact on My Portfolio
Specific analysis of how this affects MY holdings, naming specific tickers I own.

### Connection to My Strategy
How this news relates to my stated investment philosophy and targets.

---
Repeat for each news article. Conclude with:

## Today's Bottom Line
One paragraph: what is the single most important thing I should be paying attention to today, and does it require any action from me?
```

## 9.4 — Cache Architecture

Same fingerprint-based caching as guidance directives, with one addition:

```typescript
fingerprint = hash(profile.strategy + JSON.stringify(assets) + newsDate)
```

The `newsDate` (YYYY-MM-DD) is included in the fingerprint. This means:
- **Same day, same portfolio** = cache hit (instant response)
- **New day** = cache miss (fresh analysis with today's news)
- **Portfolio changes** = cache miss (analysis reflects current holdings)

---

# 10. Live Market Data Integration (Yahoo Finance)

**Source file:** `src/lib/finance-tools.ts`

## 10.1 — Function Calling Architecture

The system uses Gemini's function calling capability to let personas request live market data mid-conversation.

### Tool Definition (Registered with Gemini)

```typescript
{
    name: "fetchStockData",
    description: "Fetches current market data for a given stock ticker symbol (e.g., AAPL, MSFT, TSLA). Use this whenever the user asks about a specific public company or you need to know the current price to evaluate their portfolio.",
    parameters: {
        type: "OBJECT",
        properties: {
            ticker: {
                type: "STRING",
                description: "The stock ticker symbol to look up (e.g., AAPL, AMZN, GOOGL)."
            }
        },
        required: ["ticker"]
    }
}
```

### Data Returned

When a persona calls `fetchStockData("AAPL")`, the system fetches from Yahoo Finance and returns:

| Field | Example |
|-------|---------|
| `ticker` | AAPL |
| `longName` | Apple Inc. |
| `currentPrice` | 178.50 |
| `currency` | USD |
| `dayChange` | +2.30 |
| `dayChangePercent` | +1.31% |
| `fiftyTwoWeekHigh` | 199.62 |
| `fiftyTwoWeekLow` | 124.17 |
| `marketCap` | 2,780,000,000,000 |
| `trailingPE` | 28.5 |
| `forwardPE` | 26.1 |
| `dividendYield` | 0.55% |

### Flow in Chat

1. User asks: "What do you think about AAPL?"
2. Persona's system instruction includes the `fetchStockData` tool
3. Gemini decides to call `fetchStockData("AAPL")` as part of its response generation
4. The chat route intercepts the function call
5. System executes `fetchStockData("AAPL")` against Yahoo Finance
6. Result is sent back to Gemini as a tool response
7. Persona incorporates live data: "AAPL is currently trading at $178.50, which represents a 10.5% discount to its 52-week high..."

---

# 11. PDF Import & 3-Way Sync Engine

**Source file:** `src/app/api/portfolio-pdf/route.ts`

## 11.1 — PDF Parsing Pipeline

### Step 1: Text Extraction

Uses the `unpdf` library:

```typescript
const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer));
const result = await extractText(pdf, { mergePages: false });
const text = (result.text as string[]).join("\n");
```

### Step 2: Account Detection

**Account Number Extraction** — Regex patterns tried in order:

```
1. /Account No\.[^\n]*\n\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\b/i
2. /(?:^|\n)\s*#?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{6,15})\s*(?:TFSA|RRSP|Non|Margin|Cash)/im
3. /Account\s*(?:#|Number|No\.?)?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i
4. /Acct\s*#?\s*:?\s*:?\s*((?=[A-Z0-9]*[0-9])[A-Z0-9]{4,15})/i
```

**Account Type Classification:**

```
TFSA|RRSP|RESP|RDSP|FHSA|LIRA|LIF|RRIF|DPSP → "Registered"
NON.?REG|MARGIN|CASH ACCOUNT|TAXABLE → "Non-Registered"
```

### Step 3: Holdings Parsing

Two regex strategies:

**Generic Pattern** — `TICKER QTY BOOKCOST MARKETVALUE`:
```
/^([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+\$?([\d,]+(?:\.\d{2})?)\s+\$?([\d,]+(?:\.\d{2})?)/
```

**Wealthsimple-Specific Pattern** — Handles multi-line layouts where dollar amounts may span subsequent lines:
```
/(?:^|\s)([A-Z]{1,5}(?:\.[A-Z]{1,3})?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*(?:\.\d+)?)(?:\s|$)/
```
For Wealthsimple, the system looks up to 6 lines ahead to find dollar amounts (`$X,XXX.XX` pattern) and extracts `marketValue = dollarAmounts[1]`, `bookCost = dollarAmounts[2]`.

### Step 4: Preview Mode

If the request includes `?preview=true`, the system returns parsed holdings without saving:

```json
{
    "preview": true,
    "count": 12,
    "accounts": ["ABC123"],
    "holdings": [{ "ticker": "VFV.TO", "quantity": 100, "accountNumber": "ABC123", "accountType": "Registered" }]
}
```

This lets the user review extracted data before committing.

## 11.2 — 3-Way Sync Logic

The sync follows a strict order to ensure the portfolio exactly mirrors the PDF for the imported account:

### Pass 1: Process PDF Holdings (CREATE or UPDATE)

For each holding in the PDF:

1. **Match by account number** (strictest): Find existing asset with same ticker AND same account number
2. **Match by account name** (fallback): Find existing asset with same ticker AND same mapped account name
3. **No global ticker-only fallback**: If no match for this account, a new asset is CREATED

This prevents cross-account contamination — if you hold VFV in both TFSA and RRSP, they are tracked independently.

For matched assets:
- **UPDATE**: Overwrite quantity, bookCost, marketValue, profitLoss
- **Preserve user intent**: Fields like sector, strategyType, securityType are only updated if they were previously blank — the user's manual classifications are never overwritten by the import

For new assets:
- **CREATE**: New `ASSET#{uuid}` record with all parsed fields
- **AI Enrichment**: If the ticker is new or has missing metadata, the system calls `researchTicker(ticker)` to auto-populate sector, securityType, market, managementStyle, etc.

### Pass 2: Auto-Linked Assets

Handles edge cases where assets were linked to account numbers during processing but weren't directly in the PDF holdings.

### Pass 3: Sync/Delete

For the specific account being synchronized:

```typescript
const existingAssetsForAccount = existingAssets.filter(a => 
    a.accountNumber === pdfAccountNumber || 
    (mappedAccountName && a.account === mappedAccountName)
);

for (const asset of existingAssetsForAccount) {
    const stillHoldsIt = holdings.some(h => h.ticker === asset.ticker);
    if (!stillHoldsIt) {
        // DELETE — this ticker is no longer in the PDF
        writeRequests.push({ DeleteRequest: { Key: { PK, SK: asset.SK } } });
    }
}
```

**The PDF is the source of truth for that account.** If a ticker existed in the database but is absent from the new PDF, it gets deleted.

### Pass 4: Batch Write with Retry

```typescript
// DynamoDB BatchWriteCommand with 25-item chunks and exponential backoff
const chunkSize = 25;
for (let i = 0; i < writeRequests.length; i += chunkSize) {
    let retries = 0;
    while (unprocessed.length > 0 && retries < 3) {
        await db.send(new BatchWriteCommand({ ... }));
        // Exponential backoff: 200ms, 400ms, 800ms
    }
}
```

### Pass 5: Audit Log

After ALL chunks succeed, a single audit log entry is written:

```typescript
await insertAuditLog(householdId, 'PDF_IMPORT', mutations, filename);
```

The entire import is logged as one `PDF_IMPORT` event with all mutations (CREATE/UPDATE/DELETE) bundled together.

## 11.3 — AI Enrichment (Ticker Research)

For new or metadata-sparse tickers, the system calls `researchTicker(ticker)` which uses AI to auto-classify:
- `securityType` (ETF, Stock, REIT, etc.)
- `strategyType` (Growth, Income, Mixed)
- `sector` (Information Technology, Healthcare, etc.)
- `market` (United States, Canada, etc.)
- `managementStyle` (Active, Passive, Index)

Results are cached in a `Map<string, any>` to avoid redundant API calls within the same import batch.

---

# 12. Audit Trail & Time Machine Rollback

**Source files:**
- `src/lib/auditLog.ts` — Audit log insertion
- `src/lib/assetSnapshot.ts` — 31-field snapshot capture
- `src/app/api/portfolio-rollback/route.ts` — Rollback logic
- `src/types/audit.ts` — Type definitions

## 12.1 — Audit Log Structure

Every portfolio mutation is recorded:

```typescript
{
    PK: "HOUSEHOLD#{householdId}",
    SK: "AUDIT_LOG#{ISO-timestamp}#{uuid}",
    type: "AUDIT_LOG",
    source: "PDF_IMPORT" | "MANUAL_EDIT" | "ROLLBACK",
    metadata: string,          // e.g., filename for PDF imports, or parent log SK for rollbacks
    mutations: AuditMutation[],
    createdAt: string
}
```

Each mutation contains:

```typescript
{
    action: "CREATE" | "UPDATE" | "DELETE",
    ticker: string,
    assetSK: string,           // The asset's sort key for direct lookup
    before: AssetSnapshot | null,   // null for CREATE
    after: AssetSnapshot | null     // null for DELETE
}
```

### Three Change Sources

| Source | When |
|--------|------|
| `PDF_IMPORT` | Wealthsimple PDF upload processed |
| `MANUAL_EDIT` | User adds/edits/deletes an asset via Dashboard |
| `ROLLBACK` | Time Machine rewind operation |

## 12.2 — The 31-Field Asset Snapshot

**Function:** `toSnapshot(asset)` in `src/lib/assetSnapshot.ts`

Every before/after snapshot captures exactly 31 fields:

| # | Field | Type |
|---|-------|------|
| 1 | quantity | number |
| 2 | marketValue | number |
| 3 | bookCost | number |
| 4 | profitLoss | number |
| 5 | liveTickerPrice | number |
| 6 | currency | string |
| 7 | account | string |
| 8 | accountNumber | string |
| 9 | accountType | string |
| 10 | sector | string |
| 11 | market | string |
| 12 | securityType | string |
| 13 | strategyType | string |
| 14 | call | string |
| 15 | managementStyle | string |
| 16 | externalRating | string |
| 17 | managementFee | number |
| 18 | yield | number |
| 19 | oneYearReturn | number |
| 20 | threeYearReturn | number |
| 21 | fiveYearReturn | number |
| 22 | exDividendDate | string |
| 23 | analystConsensus | string |
| 24 | beta | number |
| 25 | riskFlag | string |
| 26 | risk | string |
| 27 | volatility | number |
| 28 | expectedAnnualDividends | number |
| 29 | importSource | string |
| 30 | createdAt | string |
| 31 | updatedAt | string |

This means every rollback is a **complete restoration** — not an approximation. All 31 fields are captured and can be fully restored.

## 12.3 — Cascade Rollback Logic

**Endpoint:** `POST /api/portfolio-rollback`
**Input:** `{ auditLogSK: "AUDIT_LOG#..." }`

### Algorithm:

1. **Fetch all audit logs** from the target entry to the newest entry using a DynamoDB range query:
   ```
   SK BETWEEN :targetSK AND "AUDIT_LOG#\uffff"
   ```
   Results come in newest-first order (ScanIndexForward: false).

2. **Process each log** from most recent down to and including the target. For each mutation:

   | Original Action | Rollback Action |
   |----------------|-----------------|
   | CREATE | DELETE the asset |
   | DELETE | CREATE the asset (restore from `before` snapshot) |
   | UPDATE | UPDATE the asset (restore from `before` snapshot) |

3. **Edge case handling**: If an UPDATE target no longer exists (someone deleted it between the original change and the rollback), the system CREATES it from the `before` snapshot.

4. **Audit the rollback**: Each reversed log entry generates its own `ROLLBACK` audit entry with `metadata` pointing to the original log's SK.

5. **Partial rollback safety**: If a mutation fails mid-cascade, the system:
   - Writes a `PARTIAL_ROLLBACK` audit entry for whatever was already reversed
   - Returns an error with the rollback summary so far
   - The user can see exactly what was and wasn't reversed

### Atomicity

The rollback is **atomic per log entry** but **sequential across entries**. Each entry's mutations are fully reversed before moving to the next. If one entry fails, the system stops and reports which entries were successfully reversed.

---

# 13. News Ingestion & Caching

**Source file:** `src/lib/news.ts`

## 13.1 — News Source

**Provider:** NewsData.io API
**Query:**
```
interest rates OR inflation OR energy OR commodities OR geopolitical OR markets OR federal reserve OR tariffs
```
**Filters:** English language, Business category
**Limit:** Up to 15 articles per analysis run

## 13.2 — Global Cache

News is cached globally (shared across ALL households) to conserve API quota:

```typescript
{
    PK: "GLOBAL",
    SK: "NEWS_CACHE#{YYYY-MM-DD}",    // e.g., "NEWS_CACHE#2026-04-01"
    articles: NewsArticle[],
    entityType: "NEWS_CACHE",
    fetchedAt: string
}
```

**Cache logic:**
- Check DynamoDB for today's cache key
- If found: return cached articles (instant)
- If not found: fetch from NewsData.io, cache in DynamoDB, return

**New day = new fetch.** The date-based key ensures fresh news daily.

## 13.3 — Formatting for Prompt Injection

**Function:** `formatNewsContext(articles)`

Output format:
```
Recent Financial & Geopolitical News (2026-04-01):
1. [reuters] US Fed Signals Rate Hold Amid Inflation Concerns — The Federal Reserve indicated...
2. [bloomberg] Oil Prices Surge on Middle East Tensions — Brent crude rose 3.2%...
...
```

Each article: index, source, title, first 200 chars of description.

**Graceful degradation:** If no articles are fetched (API failure), the prompt says:
```
No real-time news articles were fetched for today. Use your deep knowledge of current global macro trends, recent central bank actions, geopolitical developments, and commodity/currency dynamics to provide a high-conviction macro assessment as the foundation for your analysis.
```

---

# 14. Streaming & Timeout Bypass (Heartbeat)

## The Problem

AWS CloudFront has a 30-second response timeout. Complex analytical prompts (especially guidance directives with `gemini-3.1-pro-preview`) can take 30-60 seconds to generate.

## The Solution: Zero-Width Space Heartbeat

```typescript
const encoder = new TextEncoder();
const heartbeat = setInterval(() => {
    controller.enqueue(encoder.encode('\u200B'));  // Zero-width space
}, 5000);
```

Every 5 seconds, a zero-width space character (`\u200B`) is pushed to the stream. This:
- Keeps the HTTP connection alive
- Is invisible in the rendered response (zero-width = no visual output)
- Resets CloudFront's timeout counter

The heartbeat is cleared once the actual content starts streaming:

```typescript
try {
    // Stream actual content...
} finally {
    clearInterval(heartbeat);
}
```

---

# 15. Caching Architecture (Fingerprint-Based)

## How Fingerprints Work

Both Guidance Directives and Global Radar use the same fingerprint concept:

```
fingerprint = SHA-256(strategy_fields + portfolio_state [+ newsDate for radar])
```

### What Changes the Fingerprint

| Change | Guidance Cache | Radar Cache |
|--------|---------------|-------------|
| User edits Blueprint | Invalidated | Invalidated |
| User adds/removes/edits asset | Invalidated | Invalidated |
| PDF import changes portfolio | Invalidated | Invalidated |
| New calendar day | NOT invalidated | Invalidated |
| User changes personas | NOT affected | NOT affected |

### Cache Storage

```typescript
{
    PK: "HOUSEHOLD#{householdId}",
    SK: "GUIDANCE_CACHE#{directive}#{fingerprint}",
    content: string,          // The full AI-generated response
    model: string,            // Which Gemini model generated it
    createdAt: string
}
```

### User-Facing Headers

| Header | Value | Meaning |
|--------|-------|---------|
| `X-Guidance-Cache` | `HIT` | Response served from cache |
| `X-Guidance-Cache` | `MISS` | Fresh response generated |
| `X-Guidance-Changed-Fields` | `strategy,assets` | What changed since last cache |

---

# 16. Prompt Templates & Formatting Rules

**Source file:** `src/lib/prompt-templates.ts`

## Quick Prompts

The chat interface offers 4 pre-built prompt templates as entry points:

| ID | Label | Prompt |
|----|-------|--------|
| `investment-suggestions` | Investment Suggestions | "Based on my investment strategy and your core philosophy, suggest specific tickers to buy or sell. Consider my current holdings, sector targets, and risk tolerance." |
| `financial-analysis` | Financial Analysis | "Analyze my entire financial situation — investments, net worth, and cash flow (budget vs. actual). Identify strengths, risks, and suggest adjustments." |
| `portfolio-rebalancing` | Portfolio Rebalancing | "Review my portfolio against my target allocations and suggest specific buy/sell orders to rebalance. Prioritize actions by impact and alignment with my strategy." |
| `financial-health-audit` | Financial Health Audit | "Perform a complete financial health audit — assets beyond investments, total net worth, cash flow (budgeted vs. actual), debt ratios, and emergency fund adequacy. Recommend changes." |

These are convenience shortcuts — the user can also type any free-text question.

## Formatting Rules

The `FORMATTING_RULES` constant is appended to every guidance and radar directive prompt:

```
FORMATTING RULES (CRITICAL):
- ALWAYS use GitHub-flavored Markdown.
- Break up large blocks of text. Use double newlines for generous spacing.
- Use H2 (##) and H3 (###) headers to clearly separate sections.
- Use bulleted lists (-) heavily for any multi-point analysis.
- **Bold** key terms, tickers, and financial metrics (e.g., **$150.00**, **AAPL**, **Overweight**).
- Use Blockquotes (>) to highlight the most important takeaway or conclusion.
- Where appropriate (especially for comparisons or multi-factor analysis), use Markdown Tables for scannability.
- Never write a paragraph longer than 3-4 sentences without breaking it up.
- NEVER use raw HTML tags. Only use Markdown.
```

---

# 17. Asset Snapshot System (31-Field Capture)

**Source file:** `src/lib/assetSnapshot.ts`

The `toSnapshot()` function extracts a complete, typed snapshot from any DynamoDB asset record. This is used by:

- **Audit logging** — Captures before/after state for every mutation
- **Rollback** — The `before` snapshot is what gets restored during a rewind
- **PDF Import** — Captures the state of existing assets before the import modifies them

### Type Safety

The function uses defensive coercion (`Number()` with `|| 0` fallback, `String()` with `|| ""` fallback) to ensure the snapshot is always well-typed, even if the source record has missing or malformed fields.

### Complete Field List

See Section 12.2 for the full 31-field table.

---

# 18. Authentication & Multi-Household Isolation

## Authentication Flow

1. User authenticates via NextAuth.js with Google OAuth2
2. JWT session includes `householdId` — the partition key for all their data
3. Every API route calls `getServerSession(authOptions)` and extracts `householdId`
4. All DynamoDB queries use `PK = HOUSEHOLD#{householdId}` — no cross-household access possible

## Multi-Household Design

- Each household has a unique ID
- All data (profile, assets, chats, summaries, guidance cache, audit logs) is scoped to the household PK
- Household members share one profile, one portfolio, one set of persona memories
- Roles: ADMIN (full access) / MEMBER (read + chat)

## Data Isolation Guarantee

Because DynamoDB's partition key is the access boundary, there is no application-level access control list to get wrong. The database itself enforces isolation. A query with `PK = HOUSEHOLD#abc` cannot return records from `HOUSEHOLD#xyz` — this is a DynamoDB guarantee, not an application-level check.

---

# 19. Application-Level Encryption (Blind Admin)

**Design spec:** `docs/superpowers/specs/2026-04-02-application-level-encryption-design.md`

## 19.1 — Problem Statement

AWS-managed DynamoDB encryption protects against physical media theft. It does not protect against a legitimate database administrator querying the table directly. Any entity with AWS console access or DynamoDB API credentials can read plaintext values.

Application-level encryption closes this gap: sensitive financial fields are encrypted by the application server *before* any DynamoDB write, and decrypted in Lambda memory on read. The database stores only ciphertext for financial data. An admin querying the table directly sees ticker symbols and timestamps — never dollar amounts, quantities, or conversation content.

## 19.2 — Architecture: EncryptedDocumentClient

A transparent middleware wraps the existing `DynamoDBDocumentClient` in `src/lib/db.ts`. All application code continues calling `db.send()` unchanged — 16+ files required zero modification.

```
Application Code  (unchanged — calls db.send())
        │
        ▼
EncryptedDocumentClient          src/lib/encryption/encrypted-client.ts
    ├── Field Classification Map  src/lib/encryption/field-classification.ts
    ├── Key Provider              src/lib/encryption/key-provider.ts
    └── AES-256-GCM Engine        src/lib/encryption/crypto.ts
        │
        ▼
DynamoDB  (ciphertext in financial fields, plaintext in metadata)
```

### Command Interception

| Command | Action |
|---------|--------|
| `PutCommand` | Encrypt classified fields in `Item` before write |
| `BatchWriteCommand` | Encrypt fields in each `PutRequest.Item` |
| `GetCommand` | Decrypt classified fields in `response.Item` |
| `QueryCommand` | Decrypt fields in each `response.Items[]` |
| `ScanCommand` | Decrypt fields in each `response.Items[]` |
| `DeleteCommand` | Pass through (no item body) |

Activated by the presence of the `KMS_KEY_ID` environment variable. When `KMS_KEY_ID` is absent (local dev), `db` is a plain `DynamoDBDocumentClient` — no encryption overhead.

## 19.3 — Key Management

**Phase 1 (current): Global DEK**

- A single AWS KMS Customer Master Key (CMK) is provisioned via SST (`enableKeyRotation: true`).
- On first deploy, the Key Provider calls `KMS.GenerateDataKey` to produce a 256-bit Data Encryption Key (DEK). The **encrypted** DEK is stored in DynamoDB at `PK=GLOBAL, SK=ENCRYPTION_KEY`. The plaintext DEK is never persisted.
- On Lambda cold start, the Key Provider reads the encrypted DEK from DynamoDB and calls `KMS.Decrypt` to unwrap it. The plaintext DEK is cached in a module-level variable for the Lambda container lifetime.
- **Warm invocations: zero KMS calls.**
- AWS auto-rotates the CMK annually, retaining old versions for decryption.

**Phase 2 (planned): Per-Household Envelope Encryption**

The `KeyProvider` interface accepts `householdId` (currently ignored). Phase 2 will store a separate DEK per household at `PK=HOUSEHOLD#{id}, SK=ENCRYPTION_KEY`, enabling crypto-shredding on household deletion — deleting the DEK renders the household's ciphertext mathematically unrecoverable. No caller changes required.

## 19.4 — Field Classification Map

**Principle:** Encrypt financial values; leave metadata in plaintext for DynamoDB queryability.

| Entity (SK prefix) | Encrypted Fields | Plaintext Fields |
|---|---|---|
| `META` | Budget income/expense fields, wealth assets/liabilities, `targetMonthlyDividend`, `goals` | strategy, riskTolerance scale, asset mix %, philosophies |
| `ASSET#` | quantity, liveTickerPrice, bookCost, marketValue, profitLoss, yield, returns, managementFee, volatility, beta, accountNumber, account | ticker, sector, market, currency, securityType, accountType, strategyType |
| `CHAT#` | userMessage, responses (entire array as JSON blob) | selectedPersonas, ttl, PK, SK |
| `CHAT_SUMMARY#` | summary | personaId, exchangeCount, lastExchangeTimestamp |
| `AUDIT_LOG#` | mutations (entire before/after snapshot array) | source, metadata, createdAt, type |
| `FINANCE_SUMMARY` | totalIncome, totalExpenses, savingsRate, netWorth, totalAssets, totalLiabilities | — |
| `GUIDANCE#` / `RADAR#` | response, requestSnapshot | directive, fingerprint |
| `USER#{email}` | *(none — no financial data)* | email, householdId, role |
| `GLOBAL/NEWS_CACHE#` | *(none — public market data)* | all fields |

> **Note on spec deviation:** The implemented SK prefix for guidance cache is `GUIDANCE#`, not `GUIDANCE_CACHE#` as originally specced. The `CASHFLOW#` entity (income, expenses, cashReserves) was added to encryption after discovery — it was absent from the original design doc but exists in the codebase.

## 19.5 — Encryption Format

**Algorithm:** AES-256-GCM (authenticated encryption)

**Storage format:**
```
ENC:v1:<type>:<base64(IV + ciphertext + authTag)>
```

| Component | Details |
|-----------|---------|
| `ENC:` prefix | Sentinel for migration detection and idempotency |
| `v1` | Format version — enables future algorithm migration |
| Type tag | `n` = number (restored via `parseFloat`), `s` = string, `j` = JSON (restored via `JSON.parse`) |
| IV | 12 bytes, cryptographically random per encryption |
| Auth tag | 16 bytes (128-bit GCM tag) |

**AAD (Additional Authenticated Data):** `${PK}|${SK}|${fieldName}`

The AAD binds each ciphertext to its specific record and field. Moving a ciphertext to a different item or renaming its field causes authentication failure on decryption — a relocation attack cannot succeed silently.

**Type tag purpose:** Restores the exact original JavaScript type (number, string, object) so application arithmetic (e.g., `marketValue * quantity`) works without casts after decryption.

**Size overhead:** Numeric field (8 bytes) → ~77 bytes encrypted (~10x, negligible at DynamoDB pricing). Large text (4 KB) → ~5.4 KB (~35% expansion). All well within DynamoDB's 400 KB item limit.

## 19.6 — Migration & Rollback Scripts

| Script | Purpose |
|--------|---------|
| `scripts/migrate-encrypt.ts` | One-time forward migration: scan all items, encrypt classified fields, write back |
| `scripts/migrate-decrypt.ts` | Rollback: decrypt all items to plaintext (emergency use) |
| `scripts/verify-encryption.ts` | Post-migration verification: confirm all classified fields carry the `ENC:` prefix |

Run order for zero-downtime deployment:
1. Deploy new Lambda code with `KMS_KEY_ID` set (encryption active for all new writes)
2. Run `migrate-encrypt.ts` to encrypt existing plaintext records
3. Run `verify-encryption.ts` to confirm migration completeness
4. Monitor for decryption errors in CloudWatch
5. Keep `migrate-decrypt.ts` available for emergency rollback

Existing plaintext records are handled idempotently — the middleware checks for the `ENC:` prefix before encrypting or decrypting, so mixed states (partially migrated tables) are safe.

## 19.7 — What a Blind Admin Sees

| Data Class | DB-Visible? |
|------------|-------------|
| Ticker symbols | Yes |
| Sector, market, account type | Yes |
| Risk tolerance (1–10 scale) | Yes |
| Asset mix percentages | Yes |
| Timestamps, persona selections | Yes |
| Dollar amounts (any kind) | **No** |
| Portfolio quantities and prices | **No** |
| Account numbers | **No** |
| Conversation content | **No** |
| AI-generated advice | **No** |
| Income, expenses, net worth | **No** |

---

# Appendix A: Model Selection Summary

| System | Model | Rationale |
|--------|-------|-----------|
| Chat personas | `gemini-2.5-flash` | Fast conversational responses, cost-effective for 7 parallel calls |
| Memory summarization | `gemini-2.5-flash` | Routine text compression, doesn't need top-tier reasoning |
| Guidance directives | `gemini-3.1-pro-preview` | Complex analytical reasoning, structured multi-section reports |
| Global Radar (individual) | `gemini-2.5-flash` | Speed for parallel execution of 5+ analyses |
| Deep Critique synthesis | `gemini-2.5-flash` | Synthesizes pre-computed analyses, doesn't need independent reasoning |
| Query embeddings | `gemini-embedding-001` | Purpose-built for vector similarity search |
| Ticker enrichment | AI model via `researchTicker()` | Auto-classification of security metadata |

---

# Appendix B: DynamoDB Access Patterns

| Access Pattern | PK | SK Condition | Used By |
|---------------|-----|-------------|---------|
| Get user profile | `HOUSEHOLD#{id}` | `= META` | All API routes |
| List all assets | `HOUSEHOLD#{id}` | `begins_with(ASSET#)` | Dashboard, context builder |
| Get single asset | `HOUSEHOLD#{id}` | `= ASSET#{uuid}` | Edit, rollback |
| Recent chats | `HOUSEHOLD#{id}` | `begins_with(CHAT#)`, desc, limit N | Chat route |
| Persona summary | `HOUSEHOLD#{id}` | `= CHAT_SUMMARY#{personaId}` | Chat route, Client Dossier |
| Audit trail | `HOUSEHOLD#{id}` | `begins_with(AUDIT_LOG#)` | Time Machine UI |
| Audit range (rollback) | `HOUSEHOLD#{id}` | `BETWEEN target AND AUDIT_LOG#\uffff` | Rollback endpoint |
| Guidance cache | `HOUSEHOLD#{id}` | `= GUIDANCE_CACHE#{dir}#{fp}` | Guidance route |
| News cache | `GLOBAL` | `= NEWS_CACHE#{YYYY-MM-DD}` | Radar route |
| Finance summary | `HOUSEHOLD#{id}` | `= FINANCE_SUMMARY` | Context builder |

---

# Appendix C: Critical File Index

| File | Purpose |
|------|---------|
| `src/lib/personas-data.ts` | 7 persona definitions with verbatim system prompts |
| `src/lib/personas.ts` | `generateSystemPrompt()` — prompt assembly |
| `src/lib/rag.ts` | RAG retrieval with cosine similarity and token budgeting |
| `src/lib/chat-memory.ts` | Exchange storage, per-persona summarization, history building |
| `src/lib/portfolio-analytics.ts` | `buildFullUserContext()`, `formatStrategyContext()`, drift engine |
| `src/lib/finance-tools.ts` | Yahoo Finance integration + Gemini function calling definition |
| `src/lib/news.ts` | NewsData.io fetching + global daily cache |
| `src/lib/auditLog.ts` | Audit log insertion |
| `src/lib/assetSnapshot.ts` | 31-field `toSnapshot()` for before/after capture |
| `src/lib/prompt-templates.ts` | Quick prompts + formatting rules |
| `src/app/api/chat/route.ts` | Chat orchestration — parallel persona queries |
| `src/app/api/guidance/route.ts` | 6 AI guidance directives + CIO system instruction |
| `src/app/api/global-radar/route.ts` | 7 global radar directives + Deep Critique parallel execution |
| `src/app/api/portfolio-pdf/route.ts` | PDF parsing + 3-way sync + AI enrichment |
| `src/app/api/portfolio-rollback/route.ts` | Cascade rollback with partial failure safety |
| `data/personas/rules/*.md` | Per-persona dogmatic rules (non-negotiable constraints) |
| `data/personas/sources.json` | RAG knowledge base source metadata |
| `data/personas/{id}-index.json` | Pre-built vector indexes for RAG retrieval |
