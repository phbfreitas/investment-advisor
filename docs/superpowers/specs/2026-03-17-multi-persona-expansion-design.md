# Multi-Persona Expansion: Investment Advisory Board

**Date:** 2026-03-17
**Status:** Approved

## Problem

The application currently supports a single AI persona (Warren Buffett) with hardcoded references throughout the RAG pipeline, frontend UI, and ingestion scripts. Five investment books exist in `books/` but are unused. Users cannot choose which advisor to consult.

## Outcome

Expand to 5 distinct personas — each with their own knowledge base, philosophy, and personality — presented as an "Investment Advisory Board." Users can multi-select which advisors to consult per question.

---

## Personas

| ID | Name | Avatar | Tagline | Source Material | Philosophy |
|---|---|---|---|---|---|
| `buffett` | Warren Buffett | 👴 | The Oracle of Omaha | 7 shareholder letters (URLs) + Borrows book (local PDF) | Value investing, economic moats, long-term holding |
| `barsi` | Luiz Barsi Filho | 📊 | The Dividend King | O Rei dos Dividendos (local PDF, Portuguese) | Dividend-focused, long-term accumulation, income portfolios |
| `gunther` | Max Gunther | 🎲 | The Zurich Speculator | Os Axiomas de Zurique (local PDF, Portuguese) | Calculated risk-taking, cut losses early, contrarian |
| `housel` | Morgan Housel | 🧠 | The Behavioral Analyst | The Psychology of Money (local PDF) | Behavioral finance, compounding patience, humility |
| `ramsey` | Dave Ramsey | 💪 | The Debt Destroyer | The Total Money Makeover (local PDF) | Zero debt, emergency fund, disciplined budgeting |

**Language:** All personas respond in English regardless of source material language.

---

## Design

### 1. Type System & Persona Definitions

**File:** `src/lib/personas.ts`

- Expand `PersonaId` union: `"buffett" | "barsi" | "gunther" | "housel" | "ramsey"`
- Add 4 new entries to the `personas` record, each with unique `systemPrompt`, `hasRag: true`, avatar, and tagline
- Every system prompt includes an explicit "always respond in English" instruction
- Existing Buffett persona stays, prompt unchanged

**File:** `src/types/index.ts` — No changes needed. `PersonaResponse.personaId` is already `string`.

### 2. Generic Ingestion Pipeline

**New file:** `scripts/ingest-persona.ts` (replaces `scripts/ingest-buffett.ts`)

**New file:** `data/personas/sources.json` — Manifest mapping each persona ID to its source list.

Each source entry:
```json
{ "type": "url" | "file", "path": "...", "label": "Human-readable source name" }
```

The `label` field flows into `DocumentChunk.metadata.sourceLabel` at ingestion time, replacing the current `year` field. This ensures RAG extract headers correctly describe each source (e.g., "The Psychology of Money" instead of "Shareholder Letter").

Buffett's sources: 7 existing shareholder letter URLs + the Borrows book PDF.
Other 4 personas: single local PDF each from `books/`.

**Usage:**
```
npx tsx scripts/ingest-persona.ts <personaId>   # Ingest one persona
npx tsx scripts/ingest-persona.ts --all          # Ingest all personas
```

**Logic:**
1. Read `sources.json` for the given persona
2. For each source: fetch URL or read local file, parse HTML/PDF
3. Chunk with paragraph-aware strategy (existing `chunkText` logic)
4. Embed via Gemini `gemini-embedding-001`
5. Each chunk gets metadata: `{ sourceLabel: string; source: string }` (the `label` from manifest + the raw path/URL)
6. Chunk IDs use format `{personaId}-{sourceIndex}-{chunkIndex}` (e.g., `barsi-0-14`, `buffett-2-7`)
7. Save to `data/personas/{personaId}-index.json`

Reuses: paragraph-aware chunking, exponential backoff retry, PDF/HTML parsing — all from current `ingest-buffett.ts`.

**Deleted:** `scripts/ingest-buffett.ts` — fully replaced.
**Note:** Existing `buffett-index.json` will be regenerated with the new metadata schema and additional Borrows book content.

### 3. RAG Pipeline — Multi-Persona Support

**File:** `src/lib/rag.ts`

Four changes:

1. **Persona-keyed cache:** Replace `cachedBuffettIndex` with `Map<string, DocumentChunk[]>`
2. **Dynamic index path:** `data/personas/${personaId}-index.json` instead of hardcoded `buffett-index.json`
3. **Remove hardcoded check:** Delete `if (personaId !== 'buffett') return ""` — any persona with a valid index file gets RAG context
4. **Update `DocumentChunk` interface and extract formatting:** Replace `metadata.year` with `metadata.sourceLabel` (string). Update the extract header from hardcoded `"Shareholder Letter"` to use `chunk.metadata.sourceLabel` (e.g., `"--- Extract 1 (Source: The Psychology of Money) ---"`)

If an index file doesn't exist, return `""` gracefully (persona works without RAG). This allows incremental rollout.

All existing improvements stay: relevance threshold (0.30), token budget (2000), cosine similarity, debug logging.

### 4. Additional Buffett-Branded Files

**File:** `src/app/layout.tsx`

- Update `<title>` from "Warren Buffett Advisor" to "Investment Advisory Board"
- Update `<meta description>` to reflect multi-persona identity

**File:** `src/app/profile/ProfileClient.tsx`

- Replace "Warren will use this persistent context to tailor his advice" with neutral copy like "Your advisors will use this persistent context to tailor their advice"

**File:** `src/app/api/debug-rag/route.ts`

- Parameterize to accept a `persona` query param (default: `"buffett"`) instead of hardcoded persona ID

**File:** `scripts/test-rag.ts`

- Accept persona ID as CLI argument (default: `"buffett"`)
- Update log message from "Testing RAG retrieval for Warren Buffett..." to dynamic

### 5. Frontend — Advisory Board UI

**File:** `src/app/HomeClient.tsx`

- **Remove all Buffett branding:** Welcome message, "Warren has responded", any Buffett-specific copy
- **New identity:** "Investment Advisory Board" — professional, neutral framing
- **Persona selector:** Multi-select cards/chips showing avatar, name, tagline for all 5 personas. Toggle on/off with visual feedback. Minimum 1 required.
- **Default state:** All 5 personas selected
- **Response indicator:** Dynamic — "Your advisors have responded" or "{count} advisor(s) responded"

**File:** `src/components/PanelResponse.tsx`

- Remove hardcoded "Buffett's Analysis" header
- Replace with "Advisory Board Responses" or remove entirely (each card already renders persona name/avatar)

### 6. Documentation Updates

**File:** `src/app/user-guide/UserGuideClient.tsx`

- Update Section 1 from "Warren Buffett (Chat Engine)" to reflect the multi-persona Advisory Board
- Document persona selector, multi-select behavior, and the 5 available advisors
- Update the "John" example to show consulting multiple advisors

**File:** `USER_GUIDE.md`

- Mirror the same changes in the markdown documentation
- Update code location references if any paths changed
- Document the ingestion script usage for future persona additions

### 7. Chat Route

**File:** `src/app/api/chat/route.ts` — **No changes needed.** Already supports:
- `selectedPersonas: string[]` array from request
- `Promise.all()` for parallel persona responses
- Conditional RAG via `personaConfig?.hasRag`

---

## Files Summary

| Action | File | Change |
|---|---|---|
| Modify | `src/lib/personas.ts` | Add 4 personas, expand `PersonaId` |
| Modify | `src/lib/rag.ts` | Persona-keyed cache, dynamic paths, update `DocumentChunk` metadata schema |
| Modify | `src/app/layout.tsx` | Update title and meta description |
| Modify | `src/app/HomeClient.tsx` | Remove Buffett branding, add persona selector |
| Modify | `src/components/PanelResponse.tsx` | Remove "Buffett's Analysis" header |
| Modify | `src/app/profile/ProfileClient.tsx` | Generalize "Warren will use this..." copy |
| Modify | `src/app/api/debug-rag/route.ts` | Parameterize persona ID |
| Modify | `scripts/test-rag.ts` | Accept persona ID as argument |
| Modify | `src/app/user-guide/UserGuideClient.tsx` | Update guide for multi-persona |
| Modify | `USER_GUIDE.md` | Update markdown guide |
| Create | `scripts/ingest-persona.ts` | Generic ingestion script |
| Create | `data/personas/sources.json` | Source manifest |
| Delete | `scripts/ingest-buffett.ts` | Replaced by generic script |

---

## Verification

1. `tsc --noEmit` — no type errors
2. `npx tsx scripts/ingest-persona.ts buffett` — verify Buffett ingestion (now includes Borrows book)
3. `npx tsx scripts/ingest-persona.ts --all` — ingest all 5 personas
4. `npm run dev` — start dev server
5. Verify browser tab shows "Investment Advisory Board" (layout.tsx metadata)
6. Verify profile page shows generic advisor copy, not "Warren" (ProfileClient.tsx)
7. Verify persona selector UI — toggle personas, confirm at least 1 required
8. Submit question with all 5 selected — verify 5 parallel responses
9. Submit question with 1 selected — verify single response
10. Test with a persona whose index file is missing — verify graceful degradation (no RAG, persona still responds)
11. Check server logs for RAG scores per persona, verify extract headers use `sourceLabel` not "Shareholder Letter"
12. Review user guide page — confirm updated content
13. Verify debug-rag endpoint with `?persona=housel` returns Housel-specific context
