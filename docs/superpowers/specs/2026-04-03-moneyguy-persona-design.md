# Money Guy Persona Design

**Date:** 2026-04-03
**Status:** Draft

---

## Summary

Add an eighth advisor persona to the Investment Advisor platform: **The Money Guy Team** (Brian Preston & Bo Hanson). This persona fills a gap in the current board — practical, process-driven financial planning aimed at middle-class wealth builders — while following the exact same infrastructure patterns as all existing personas.

## Persona Definition

| Field | Value |
|---|---|
| **id** | `moneyguy` |
| **name** | Brian Preston & Bo Hanson |
| **avatar** | `💰` (tentative — may change) |
| **tagline** | The Financial Order of Operations |
| **riskTolerance** | Medium |
| **hasRag** | true |
| **rulesFile** | None (initially — can be added later if needed) |

### System Prompt

Channels both Brian and Bo as a unified voice. Key characteristics:

- **Framework**: The Financial Order of Operations (FOO) — a sequential, prioritized approach to financial decisions
- **Philosophy**: Process over products, financial optimization through proper sequencing, middle-class wealth building through disciplined steps
- **Tone**: Approachable, data-driven, encouraging, with the energy of a well-prepared show. Practical rather than theoretical. They meet people where they are financially.
- **Unique value on the board**: The "what should I do first/next" advisor. While other advisors focus on investment philosophy (what to buy, how to value, how to think about risk), the Money Guy team focuses on personal financial planning process and lifecycle milestones — sequencing and prioritization of financial decisions.
- **Language directive**: Always respond in English regardless of the language of any retrieved context.

## Knowledge Base

### Sources

Two source types, added to `data/personas/sources.json` under key `"moneyguy"`:

1. **Book** — "Millionaire Mission" by Brian Preston (local PDF, `type: "file"`)
2. **Curated articles** — 15-30 manually selected URLs from moneyguy.com (`type: "url"`)

**Article curation status**: Pending PO input. The exact list of articles will be determined through manual curation — selecting the cornerstone content that best represents their framework (FOO steps, debt strategy, investing milestones, tax optimization, employer benefit optimization, etc.). Automated scraping was considered and rejected: a tightly curated index of high-quality articles produces better RAG retrieval than hundreds of posts where signal competes with noise.

### Ingestion

No changes to the ingestion pipeline. The existing `scripts/ingest-persona.ts` already supports:
- Local PDF files via `unpdf`
- Web URLs via `fetch` + `@mozilla/readability` for HTML extraction
- Chunking with configurable size (default 1000 chars)
- Embedding via Gemini `gemini-embedding-001`
- Output to `data/personas/moneyguy-index.json`

**Command**: `npx tsx scripts/ingest-persona.ts moneyguy`

### Retrieval

No changes to `src/lib/rag.ts`. The existing RAG system:
- Dynamically loads `{personaId}-index.json`
- Computes cosine similarity against query embedding
- Applies relevance threshold (0.30) to filter weak matches
- Returns top 3 chunks within a 2,000 token budget

### Potential Ingestion Risks

- **Paywalled content**: moneyguy.com blog appears freely accessible, but if any articles are gated, the ingestion will extract garbage HTML. This will be visible in the output and can be handled by removing those URLs from the source list.
- **Rate limiting**: Fetching 15-30 articles sequentially is unlikely to trigger bot protection. The script already processes sources one at a time.
- **robots.txt / ToS**: Content is fetched for private RAG use, not republished. Legal/ethical review is the team's responsibility.

## Code Changes

### Files Modified

1. **`src/lib/personas-data.ts`**
   - Add `"moneyguy"` to the `PersonaId` union type
   - Add the `moneyguy` entry to the `personas` record with all fields (id, name, avatar, tagline, systemPrompt, hasRag, background, philosophy, riskTolerance)

2. **`data/personas/sources.json`**
   - Add the `"moneyguy"` key with sources array (book + curated article URLs)

### Files NOT Modified

Everything else is already dynamic and requires zero changes:

- **`src/app/api/chat/route.ts`** — iterates over `selectedPersonas` from request body, no hardcoded persona list
- **`src/lib/rag.ts`** — loads indexes by persona ID dynamically
- **`src/lib/personas.ts`** — re-exports from `personas-data.ts`, `generateSystemPrompt` works with any persona
- **UI components** (advisor picker, chat panel, etc.) — render from the `personas` object dynamically
- **Memory system** — keyed by persona ID, works automatically for new personas

## Open Items

- [ ] Final article list — pending PO input on curation approach (manual selection of 15-30 URLs)
- [ ] Avatar emoji — `💰` is tentative, may change
- [ ] System prompt — exact wording to be finalized during implementation
