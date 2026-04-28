# Collapsible Sidebar — Design Spec

**Date:** 2026-04-28
**Source triage:** [docs/superpowers/triage/2026-04-27-po-feedback-triage.md](../triage/2026-04-27-po-feedback-triage.md)
**Scope:** Phase 3, sub-project 3B — PO feedback item 5.1
**Decision baseline:** Triage report captured "Option A — icons-only on desktop and tablet". This spec lands the "how".

## Goal

Let the PO collapse the desktop/tablet sidebar to an icons-only strip so dashboard tables and charts get back ~190px of horizontal room. The choice persists across reloads. Phone (bottom-nav) is unchanged.

## Non-Goals

- Auto-collapse on viewport resize. The user controls the state directly (Option B from brainstorming); the app does not second-guess her on rotate or resize.
- Keyboard shortcut to toggle. Single user, low value, adds testing surface.
- Custom tooltip component or positioning library. The native `title` attribute is sufficient.
- Server-side preference storage. Single-user app — `localStorage` is enough.
- Phone/mobile layout changes. The current bottom-nav row is good and the PO confirmed it stays.

## Design

### 1. Scope & Breakpoints

| Viewport | Width range | Behavior |
|---|---|---|
| Phone | `< md` (< 768px) | Unchanged. Horizontal bottom nav. Toggle button **not rendered**. |
| Tablet + Desktop | `≥ md` (≥ 768px) | Vertical sidebar. Toggle button visible in header. Two states: expanded (`w-64`, 256px) and collapsed (`w-16`, 64px). |

The Tailwind `md:` breakpoint is the dividing line. Phone keeps `flex-row` bottom-row layout exactly as today.

### 2. State Management

- **Owner:** `Sidebar` component (`src/components/Sidebar.tsx`) holds state via `useState<boolean>`.
- **Variable:** `isCollapsed: boolean`. Default `false` (expanded).
- **Persistence:** `localStorage` key `investmentAdvisor.sidebar.collapsed`. Stored as the literal string `"true"` or `"false"`.
- **Hydration:** A `useEffect` on mount reads the key and calls `setIsCollapsed(value === "true")`. The component renders expanded on the server (SSR) and snaps to the saved preference on the client. This is the standard Next.js pattern for client-only persisted UI state.
- **Toggle:** the button's `onClick` flips state and synchronously writes the new value to `localStorage`.
- **Failure mode:** if `localStorage` is unavailable (private browsing, server context, throwing setter), the read/write is wrapped in a `try/catch` and silently falls back to in-memory state. No error surfaced.

### 3. Visual Changes

Driven by a single class toggle on the outer container — `md:w-64` (expanded) vs `md:w-16` (collapsed). All inner elements respond via conditional classes.

| Element | Expanded | Collapsed |
|---|---|---|
| Outer container | `md:w-64` | `md:w-16` |
| Header container | `md:flex md:items-center md:justify-between` (logo + label on the left, toggle on the right) | `md:flex md:items-center md:justify-center` (toggle alone, centered — logo and label both hidden so the 24px toggle has room in the 64px column) |
| Header `<span>` "InvestAI Panel" | shown | `hidden` |
| Header logo (BrainCircuit) wrapper | shown | `md:hidden` (the entire logo + label inner div hides on `md+` when collapsed) |
| Toggle button (chevron) | top-right of header, `‹` | top-right of header, `›` |
| Pillar toggle container | `flex-row` (Blueprint │ Markets) | `flex-col` (Blueprint stacked over Markets) |
| Pillar button text | shown | `hidden` |
| Pillar button icon | `h-3.5 w-3.5` | bumped to `h-4 w-4` for tap-target clarity |
| Nav item (`<Link>`) | `flex-row`, `justify-start`, icon + text | `flex-row`, `justify-center`, icon-only |
| Nav item `<span>` (label) | shown | `hidden` |
| Nav item icon margin | `mr-3` | `mr-0` |
| Utilities (User Guide, Settings) | shown with divider | shown with divider, icon-only |
| Sign Out | `justify-start`, icon + text | `justify-center`, icon-only |
| Sign Out `<span>` | shown | `hidden` |
| Active row tint | `bg-teal-50 dark:bg-neutral-900` | same — tint stays visible in icon-only mode |

**Animation:** `transition-[width] duration-200 ease` on the outer container. Inner elements (header span, label spans) flip with `display: none` rather than animating opacity — this avoids the layout-jank pattern where text reflows mid-animation.

### 4. Toggle Button

- Lives inside the existing desktop header (`<div>` at `Sidebar.tsx:66-69`).
- Lucide icon: `ChevronLeft` when expanded, `ChevronRight` when collapsed.
- Only rendered at `md+` (`hidden md:flex`).
- `aria-label="Collapse sidebar"` when expanded, `"Expand sidebar"` when collapsed.
- `aria-expanded={!isCollapsed}` for assistive tech.
- 24×24px tap target with subtle hover background to signal interactivity.

### 5. Tooltips

Use the native `title` attribute. Set on every nav `<Link>`, every utility `<Link>`, and the Sign Out button. The browser shows the tooltip on hover (~500ms) and on keyboard focus.

- Tooltip text equals `item.name` (the same string we display when expanded).
- Pillar toggle buttons also get `title` ("My Blueprint" / "Market Intelligence") since their text is hidden when collapsed.
- The toggle button itself has a `title` matching its `aria-label`.

We do **not** suppress `title` when expanded — the redundant label is harmless and saves a conditional. (If it ever feels noisy in user testing we can revisit; PO has not flagged it.)

### 6. Accessibility

- Toggle button: `aria-label`, `aria-expanded`, focusable, keyboard-activatable (`<button>` element).
- Nav items: each `<Link>` keeps `aria-label` derived from `item.name` so screen readers announce destinations even with the visible text hidden.
- No focus traps. Collapsed state changes only visual width and label visibility; tab order is identical to expanded.
- Color contrast unchanged from current implementation.

### 7. Files Affected

- `src/components/Sidebar.tsx` — state, toggle button, conditional classes. Single file.
- `src/components/__tests__/Sidebar.test.tsx` — new file (no existing test for Sidebar).

No other files touched. The sidebar is self-contained.

## Testing Strategy

### Unit tests (Jest + React Testing Library)

In `src/components/__tests__/Sidebar.test.tsx`:

1. **Default state is expanded** — render with no `localStorage` value, assert the toggle button has `aria-expanded="true"` and the "InvestAI Panel" text is in the DOM.
2. **Click toggle collapses** — click the toggle button, assert `aria-expanded="false"` and the outer container has the `md:w-16` class (the source of truth for collapsed state).
3. **localStorage hydration** — pre-set `localStorage.setItem("investmentAdvisor.sidebar.collapsed", "true")`, render, assert collapsed state on mount.
4. **localStorage write on toggle** — click toggle, assert `localStorage.getItem(...)` returns the new value.
5. **localStorage failure does not crash** — mock `localStorage.setItem` to throw, click toggle, assert the component does not throw and state still updates in memory.
6. **Toggle button accessibility** — assert button is reachable by `role="button"` query and has correct `aria-label` in both states.
7. **Tooltip presence** — assert each nav item has a `title` attribute matching its visible label.

### Manual verification (mobile-first per project memory)

- **Phone view (Chrome DevTools, 375×667 iPhone SE):** bottom nav unchanged, toggle button **not** visible.
- **Tablet view (768×1024 iPad portrait):** toggle button visible, click collapses to 64px, click again expands, hover on icons shows tooltip on tap-and-hold.
- **Desktop view (1440×900):** same as tablet plus reload-persistence check.
- **Cross-route check:** toggle on `/dashboard`, navigate to `/profile`, confirm collapsed state persists.
- **Theme parity:** verify light + dark themes both render correctly in collapsed mode.

## Out-of-Scope Reminders (deliberate)

- Animating text fade-in/out — `display: none` is intentional for layout stability.
- Auto-collapse below a width threshold — chosen against in brainstorming; user-controlled is the design.
- Tooltip enhancement (custom React tooltip with arrow, theming) — `title` is enough.
- Telemetry on collapse usage — not needed for one user.

## Acceptance

- PO can click the chevron in the header to collapse the sidebar to icons.
- Tablet view (768–1280px) shows ~190px more main-content width when collapsed.
- Reload preserves collapsed state.
- Phone bottom-nav layout is bit-for-bit identical to current production behavior.
- All Jest tests pass; `npm run typecheck` clean; `npm run lint` clean.
