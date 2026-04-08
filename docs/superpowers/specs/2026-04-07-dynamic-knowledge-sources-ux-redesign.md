# Dynamic Knowledge Sources UX Redesign

**Date**: 2026-04-07
**Status**: Approved
**Approach**: Incremental Fix (Approach A)

## Context

The Dynamic Knowledge Sources card in Settings controls the Money Guy advisor's auto-refreshing article knowledge base. Three UX problems were reported:

1. **No visual distinction on frequency buttons** — the teal active state (`bg-teal-50 border-teal-200`) is nearly indistinguishable from the neutral state, so the user can't tell which frequency is selected after navigating away and back.
2. **Misleading status badge** — "Up to Date" displays even with 0 articles indexed, because the badge only checks `status === "success"` without considering `articleCount`.
3. **No progress feedback** — the "Trigger Refresh Now" button fires the Lambda asynchronously and shows a static message. The UI never updates until the user manually reloads the page.

## Files to Modify

| File | Change |
|------|--------|
| `src/app/settings/SettingsClient.tsx` | Button styling, polling, badge logic, error visibility |
| `functions/refresh-moneyguy.ts` | Write `status: "refreshing"` + `startedAt` at handler start |
| `src/app/api/settings/persona-refresh/route.ts` | Return `startedAt` in GET response |

## Section 1: Frequency Button Visual Treatment

**Active button**:
- Border: `border-2 border-teal-500` (bold, colored — currently `border border-teal-200`)
- Icon: `CheckCircle2` from lucide-react (`h-4 w-4`), teal, rendered inline left of the label text
- Background: `bg-teal-50 dark:bg-teal-500/10` (subtle fill, same as today)
- Result: `[check-icon 7 Days]` with thick teal border

**Inactive button**:
- Border: `border border-neutral-200 dark:border-neutral-800` (thin neutral, unchanged)
- No icon
- Same hover behavior as today

## Section 2: Lambda Status Flow + DynamoDB Model

**Lambda changes** (`functions/refresh-moneyguy.ts`):
- Extend `updateConfigRow()` to accept an optional `startedAt` field in its input, and add the corresponding `SET` expression part (same pattern as the existing `lastRefreshedAt` optional field).
- After the frequency gate passes (i.e., refresh will proceed), immediately call `updateConfigRow({ status: "refreshing", startedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })` before any RSS/scrape/embed work begins.
- On success: write `status: "success"`, `lastRefreshedAt`, `articleCount`, `updatedAt` (existing behavior, unchanged).
- On error: write `status: "error"`, `updatedAt` (existing behavior, unchanged).

**GET route changes** (`src/app/api/settings/persona-refresh/route.ts`):
- Return `startedAt` field alongside existing `frequencyDays`, `lastRefreshedAt`, `status`, `articleCount`.

**DynamoDB config row shape**:
```
PK: SYSTEM#CONFIG
SK: PERSONA_REFRESH#moneyguy
frequencyDays: 7              (number)
status: "refreshing"          (string — pending | refreshing | success | error)
startedAt: "2026-04-07T..."   (string, ISO — set when refresh begins)
lastRefreshedAt: "2026-04-07T..." (string, ISO — set on success)
articleCount: 28              (number — set on success)
updatedAt: "2026-04-07T..."   (string, ISO)
```

## Section 3: Status Badge Logic

5-state badge replacing the current 3-state model:

| Condition | Badge Color | Badge Text |
|-----------|-------------|------------|
| `status` is `"pending"` or missing | Gray | "Never refreshed" |
| `status === "refreshing"` | Blue (animated pulse) | "Refreshing..." |
| `status === "success" && articleCount > 0` | Green | "Up to date" |
| `status === "success" && articleCount === 0` | Amber | "No articles found" |
| `status === "error"` | Red | "Refresh failed" |

**Stats row context**:
- During `refreshing`: show elapsed time since `startedAt` (e.g., "Started 45s ago")
- On `success`: show "Last updated: Apr 7, 2026" and "28 articles indexed"
- On `error`: show "Last attempt failed" with timestamp

## Section 4: Polling After Trigger

After `handleTriggerRefresh` gets a successful response (`{ triggered: true }`):

1. Start polling `GET /api/settings/persona-refresh` every **10 seconds**.
2. On each poll, update `refreshConfig` state so the badge and stats reflect the latest DynamoDB values.
3. **Stop polling** when `status` changes from `"refreshing"` to `"success"` or `"error"`.
4. **Safety cap**: stop after **5 minutes** (30 polls) — the Lambda has a 5-min timeout.
5. During polling:
   - Status badge shows blue pulsing "Refreshing..." state.
   - Trigger button is disabled, text shows "Refreshing...".
6. On completion:
   - `success`: badge flips to green, trigger message updates to "Refresh complete - N articles indexed."
   - `error`: badge flips to red, trigger message updates to "Refresh failed - check Lambda logs."

**Implementation**: `setInterval` stored in a `useRef`, cleared on status change or component unmount. No new dependencies.

## Section 5: Error Visibility

**Frequency save errors**:
- Replace the `text-xs` inline span with a small alert bar below the buttons.
- Red left border, red text, `text-sm`. Auto-dismisses after 5 seconds.

**Trigger errors**:
- Same red alert bar treatment below the trigger button.

**Frequency save success**:
- Keep inline "Saved" text but bump to `text-sm` with a `CheckCircle2` icon for consistency.
- Auto-dismisses after 2.5s (existing behavior).

## Verification

1. **Button contrast**: Navigate to Settings, observe the active frequency button has a bold teal border + checkmark icon. Click a different button — checkmark moves, "Saved" appears briefly. Navigate away and back — same button is still highlighted.
2. **Trigger + polling**: Click "Trigger Refresh Now". Badge changes to blue pulsing "Refreshing...", trigger button disables. Wait ~2 minutes. Badge should flip to green "Up to date" with article count > 0. Trigger message shows "Refresh complete - N articles indexed."
3. **Error states**: If Lambda fails (e.g., bad GEMINI_API_KEY), badge shows red "Refresh failed". Red alert bar appears below trigger button.
4. **Empty refresh**: If RSS returns 0 articles, badge shows amber "No articles found" instead of misleading "Up to date".
5. **Status persistence**: Reload the page at any point — badge, article count, and frequency all reflect the DynamoDB state accurately.
