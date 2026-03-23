# Advisor Memory & UI: Deep Architecture Redesign — Design Spec

**Date:** 2026-03-22
**Status:** Draft
**Replaces:** EA Memory v1 (commit `918031c`)

---

## Problem

The current EA Memory implementation treats the advisory platform as a standard chat tool:
- Past conversations render as collapsed chat transcripts in the main feed
- Memory is hidden behind a modal (`MemoryPanel.tsx`)
- One shared summary blob for all advisors — no per-advisor awareness
- Unstructured free-form summary ("The user...") can't be parsed into meaningful UI

Users don't want to re-read chat logs. They want to see what their advisors *know* about them, structured as an evolving financial profile.

## Solution

Transform the Advisory Board from a "chat interface" into a **"Living Strategy Board"**:
1. **Per-advisor structured memory** — each guru builds their own 5-section dossier
2. **Client Dossier sidebar** — persistent 30% left column showing structured memory cards
3. **Clean active session** — main feed shows only current conversation, no historical clutter
4. **Transcript Archive** — dedicated modal for auditing past exchanges by date

---

## 1. Backend: Per-Advisor Structured Memory

### DynamoDB Schema

**Before:** One `CHAT_SUMMARY` per household (shared across all advisors)
**After:** One `CHAT_SUMMARY#<personaId>` per advisor per household

| Entity | PK | SK | TTL |
|--------|----|----|-----|
| Chat Exchange | `HOUSEHOLD#{id}` | `CHAT#<ISO-timestamp>` | 180 days |
| Advisor Summary | `HOUSEHOLD#{id}` | `CHAT_SUMMARY#buffett` | None |
| Advisor Summary | `HOUSEHOLD#{id}` | `CHAT_SUMMARY#barsi` | None |
| Advisor Summary | `HOUSEHOLD#{id}` | `CHAT_SUMMARY#gunther` | None |
| Advisor Summary | `HOUSEHOLD#{id}` | `CHAT_SUMMARY#housel` | None |
| Advisor Summary | `HOUSEHOLD#{id}` | `CHAT_SUMMARY#ramsey` | None |

### Structured Summary Format

The `updateSummary` prompt enforces strict 5-section markdown:

```markdown
### Investment Thesis
[Philosophy as understood from THIS advisor's conversations]

### Current Asset Focus
[Tickers, sectors, ETFs discussed with THIS advisor]

### Risk Parameters
[Risk tolerance, comfort zones, red lines]

### Active Dilemmas
[Decisions currently being weighed]

### Key Decisions
[Concrete commitments — "Decided to sell TSLA", "Plans $5K/month into VFV"]
```

### Function Changes (`src/lib/chat-memory.ts`)

| Function | Change |
|----------|--------|
| `getSummary(householdId)` | → `getSummary(householdId, personaId)` |
| New: `getAllSummaries(householdId)` | Batch-fetches all 5 advisor summaries |
| `updateSummary(...)` | Adds `personaId` param; filters exchanges to that persona only |
| `shouldSummarize(...)` | Checks per-persona exchange count |
| `clearHistory(...)` | Gains optional `personaId` param for per-advisor reset |

### Constants

| Constant | Before | After |
|----------|--------|-------|
| `TTL_DAYS` | 90 | 180 |
| `MAX_SUMMARY_WORDS` | 300 | 500 |
| `SUMMARY_THRESHOLD` | 5 | 5 (unchanged) |

### Migration

Old `CHAT_SUMMARY` singleton is ignored. Each advisor's first 5 exchanges generate their first structured summary. The old item should be deleted as part of the first `clearHistory(householdId)` call (add a cleanup step that also deletes `SK: CHAT_SUMMARY` if it exists).

---

## 2. System Prompt Upgrade

**File:** `src/lib/personas.ts`

Replace passive memory injection with contextual-reference rules:

```
### YOUR MEMORY OF THIS USER (from prior conversations):
{summaryText}

MEMORY USAGE RULES:
- When the user's question relates to topics in your memory, naturally reference
  this context. Example: "Given your earlier decision to increase dividend exposure..."
- Do NOT force memory references on unrelated questions.
- If the current question contradicts a past decision, flag it diplomatically.
- Never fabricate memory. Only reference what is documented above.
```

Each advisor sees only their OWN summary.

---

## 3. Frontend: Two-Column Layout

**File:** `src/app/HomeClient.tsx`

### Desktop (md+)

```
┌──────────────────────────────────────────────────────┐
│  Header (full width, sticky)                         │
│  "Expert Guidance" + Persona Selector                │
├──────────────┬───────────────────────────────────────┤
│  CLIENT      │   ACTIVE SESSION                      │
│  DOSSIER     │   [Current session messages only]     │
│  (300px)     │   [PanelResponse cards — unchanged]   │
│              │                                       │
│  [Advisor    │                                       │
│   tabs]      │                                       │
│  - Thesis    │                                       │
│  - Assets    │                                       │
│  - Risk      │                                       │
│  - Dilemmas  │                                       │
│  - Decisions │                                       │
│  [Archive]   │   [Input bar (sticky bottom)]         │
└──────────────┴───────────────────────────────────────┘
```

- `grid grid-cols-1 md:grid-cols-[300px_1fr]`
- Left: `<ClientDossier>` (`hidden md:block`)
- Right: existing chat feed, no structural changes
- `CollapsedExchange` removed from main feed
- Main feed is current session only

### Mobile

- Single column, full-width chat
- Brain icon in header opens `<ClientDossier>` as slide-out drawer from left
- `fixed inset-0` overlay with `translate-x` animation
- Close on backdrop click

---

## 4. ClientDossier Component

**New file:** `src/components/ClientDossier.tsx`

### Props

```typescript
interface ClientDossierProps {
  summaries: Record<string, { text: string; exchangeCount: number; lastUpdated: string } | null>;
  onOpenArchive: () => void;
  onResetMemory: (personaId?: string) => void;
  isMobileDrawer?: boolean;
  onClose?: () => void;
}
```

### Structure

- **Advisor tabs** at top — avatar pill buttons per persona
- **5 section cards** — `glass-panel` styled, parsed from `### ` headers in summary text
- **Empty state** — *"Not yet discussed with [advisor name]"* per section
- **Fallback** — unstructured summary renders as single "Summary" card
- **Archive link** — "View Transcript Archive" at bottom
- **Reset actions** — per-advisor reset or reset-all with confirmation

### Parsing

Split on lines starting with `### ` (regex `/^### /m`) to avoid false splits if the LLM quotes a `### ` inside body text. No markdown parser library needed — we control the output format.

---

## 5. TranscriptArchive Component

**New file:** `src/components/TranscriptArchive.tsx`

**Replaces:** `CollapsedExchange.tsx` (deleted) and `MemoryPanel.tsx` (deleted)

- Full-screen modal (same pattern as `GuidanceClient.tsx` modals)
- Fetches `GET /api/chat/history?limit=50`
- Groups exchanges by date (`Intl.DateTimeFormat`)
- Collapsible day sections with exchange count badges
- Click exchange to expand full `PanelResponse` rendering
- Works identically on mobile (full-screen modal)

---

## 6. API Changes

**File:** `src/app/api/chat/history/route.ts`

### GET Response

```typescript
{
  exchanges: ChatExchange[],
  summaries: Record<string, {
    text: string;
    exchangeCount: number;
    lastUpdated: string;
  } | null>
}
```

### DELETE Modes

| Query | Effect |
|-------|--------|
| `?mode=all` | Clear all exchanges + all summaries |
| `?mode=chat` | Clear exchanges only, keep summaries |
| `?mode=summary&persona=buffett` | Clear one advisor's summary |

All DELETE operations return `{ success: true }` with HTTP 200.

---

## 7. Files Changed

| File | Action |
|------|--------|
| `src/lib/chat-memory.ts` | **MODIFY** — per-advisor summaries, structured prompt, TTL, new functions |
| `src/app/api/chat/route.ts` | **MODIFY** — per-advisor summarization trigger + injection |
| `src/lib/personas.ts` | **MODIFY** — contextual memory usage rules |
| `src/types/index.ts` | **MODIFY** — updated ChatSummary, new PersonaSummaryMap |
| `src/app/api/chat/history/route.ts` | **MODIFY** — per-advisor summaries, per-advisor DELETE |
| `src/app/HomeClient.tsx` | **MODIFY** — two-column layout, remove history, mobile drawer |
| `src/components/ClientDossier.tsx` | **NEW** |
| `src/components/TranscriptArchive.tsx` | **NEW** |
| `src/components/CollapsedExchange.tsx` | **DELETE** |
| `src/components/MemoryPanel.tsx` | **DELETE** |
| `USER_GUIDE.md` | **MODIFY** — update EA Memory section |
| `src/app/user-guide/UserGuideClient.tsx` | **MODIFY** — update EA Memory subsection |

---

## 8. Verification

### Build
1. `npx tsc --noEmit` — zero errors
2. `npm run build` — successful

### Manual Testing
1. Desktop: two-column layout (300px dossier + chat)
2. Mobile: single-column + slide-out drawer
3. Chat with Buffett 5+ times → structured summary generates in Buffett's dossier
4. Barsi tab → empty state cards
5. Chat with Barsi → Barsi's dossier populates independently
6. "View Transcript Archive" → date-grouped modal, expandable exchanges
7. Ask Buffett "What did I decide last time?" → contextual reference works
8. Reset Buffett memory → only Buffett clears
9. DynamoDB unavailable → stateless fallback works
10. Page refresh → dossier persists, main feed starts clean
