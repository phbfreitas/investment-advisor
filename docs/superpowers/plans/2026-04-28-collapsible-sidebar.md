# Collapsible Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-toggled icons-only collapsed mode to the desktop/tablet sidebar (`md+`), persisting the choice in `localStorage`. Phone bottom-nav (< md) is unchanged.

**Architecture:** Single-component change in `src/components/Sidebar.tsx`. State lives in a `useState<boolean>` (`isCollapsed`), hydrated from `localStorage` on mount via `useEffect`. A chevron toggle button in the desktop header flips the state. All inner elements respond to the state via conditional Tailwind classes (`hidden`, `md:w-64` ⇄ `md:w-16`, `flex-row` ⇄ `flex-col`, etc.). Tooltips when collapsed are delivered via the native `title` attribute — no new dependencies.

**Tech Stack:** Next.js 14 App Router, React 18, Tailwind CSS, lucide-react icons, Jest + React Testing Library + jsdom for tests.

**Spec:** [docs/superpowers/specs/2026-04-28-collapsible-sidebar-design.md](../specs/2026-04-28-collapsible-sidebar-design.md)

---

## File Structure

- **Modify:** `src/components/Sidebar.tsx` — add state, toggle button, conditional classes, localStorage persistence, title attributes.
- **Create:** `src/components/__tests__/Sidebar.test.tsx` — new test file (no existing test for Sidebar).

The Sidebar is self-contained and no other component reads its layout. No other files are touched.

---

## Task 1: Test scaffold + first failing test for the toggle button

**Files:**
- Create: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx` (add toggle button stub)

**Goal:** Stand up the test file with mocks, then prove TDD works by adding a test for a toggle button that doesn't yet exist, watching it fail, then making it pass.

- [ ] **Step 1: Create the test file**

Create `src/components/__tests__/Sidebar.test.tsx`:

```typescript
/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

import { Sidebar } from "../Sidebar";

describe("Sidebar collapse toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a toggle button labeled 'Collapse sidebar' in the expanded state", () => {
    render(<Sidebar />);
    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "renders a toggle button"`
Expected: FAIL with "Unable to find an accessible element with the role 'button' and name `/collapse sidebar/i`".

- [ ] **Step 3: Add the toggle button to the Sidebar header**

In `src/components/Sidebar.tsx`:

a) Add `ChevronLeft` and `ChevronRight` to the lucide-react import on line 6:

```typescript
import { Users, LayoutDashboard, Settings, BrainCircuit, LogOut, Wallet, Target, BookOpen, Globe, Shield, Radio, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
```

b) Replace the desktop header block (currently `Sidebar.tsx:66-69`) with:

```typescript
{/* Desktop header */}
<div className="md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-200 dark:border-neutral-800 hidden md:flex md:justify-between transition-colors duration-300">
    <div className="flex items-center min-w-0">
        <BrainCircuit className="h-6 w-6 text-teal-600 dark:text-teal-400 mr-3 shrink-0" />
        <span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
    </div>
    <button
        type="button"
        aria-label="Collapse sidebar"
        aria-expanded={true}
        className="hidden md:flex items-center justify-center h-6 w-6 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
    >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
    </button>
</div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "renders a toggle button"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): add toggle button stub in desktop header"
```

---

## Task 2: Click handler collapses outer container

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** Wire up `useState` and the click handler so clicking the toggle flips the outer container's width class and the button's `aria-expanded`.

- [ ] **Step 1: Add the failing collapse-on-click test**

Append to `src/components/__tests__/Sidebar.test.tsx` inside the `describe`:

```typescript
it("collapses the outer container when the toggle is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar />);

    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("md:w-64");
    expect(outer.className).not.toContain("md:w-16");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const expandToggle = screen.getByRole("button", { name: /expand sidebar/i });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    expect(outer.className).toContain("md:w-16");
    expect(outer.className).not.toContain("md:w-64");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "collapses the outer container"`
Expected: FAIL — clicking the button does nothing.

- [ ] **Step 3: Add state and click handler**

In `src/components/Sidebar.tsx`:

a) Inside the `Sidebar` component (just after `const [activePillar, setActivePillar] = useState…`, around line 50), add:

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);
```

b) Update the outer container className (currently line 64) — replace the literal `md:w-64` with a conditional via `cn`:

```typescript
return (
    <div className={cn(
        "flex fixed bottom-0 left-0 right-0 z-50 md:relative md:h-full w-full flex-row md:flex-col bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-md md:bg-neutral-50 dark:md:bg-[#0a0a0a] border-t md:border-t-0 md:border-r border-neutral-200 dark:border-neutral-800 shrink-0 transition-colors duration-300 md:transition-[width] md:duration-200",
        isCollapsed ? "md:w-16" : "md:w-64"
    )}>
```

c) Update the toggle button to use the state — replace the `<button>` from Task 1 step 3b with:

```typescript
<button
    type="button"
    onClick={() => setIsCollapsed(c => !c)}
    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    aria-expanded={!isCollapsed}
    className="hidden md:flex items-center justify-center h-6 w-6 rounded text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 dark:hover:text-white transition-colors"
>
    {isCollapsed ? (
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
    ) : (
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
    )}
</button>
```

- [ ] **Step 4: Run the failing test plus the prior one**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): toggle collapsed state on click, swap container width"
```

---

## Task 3: Hide labels and the header logo wrapper when collapsed

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** When collapsed, the entire header logo+label wrapper hides on `md+` (so the 24px toggle has room inside the 64px column, with `justify-center` on the parent giving it a centered placement). Every nav-item label, every utility-item label, and the Sign Out label hide. Pillar button text also hides.

- [ ] **Step 1: Add the failing labels-hidden test**

Append to the `describe` block:

```typescript
it("hides the header logo wrapper and every text label when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    expect(screen.getByText("InvestAI Panel")).toBeVisible();
    expect(screen.getByText("My Investment Portfolio")).toBeVisible();
    expect(screen.getByText("Sign Out")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(screen.queryByText("InvestAI Panel")).not.toBeVisible();
    expect(screen.queryByText("My Investment Portfolio")).not.toBeVisible();
    expect(screen.queryByText("Sign Out")).not.toBeVisible();
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "hides the header logo wrapper"`
Expected: FAIL — labels are still visible after click.

- [ ] **Step 3: Apply conditional classes**

In `src/components/Sidebar.tsx`:

a) Header parent `<div>` — switch its flex layout from `md:justify-between` to `md:justify-center` when collapsed (so the lone toggle button is centered):

```typescript
{/* Desktop header */}
<div className={cn(
    "md:h-16 shrink-0 items-center px-4 md:px-6 py-3 md:py-0 border-r md:border-r-0 md:border-b border-neutral-200 dark:border-neutral-800 hidden md:flex transition-colors duration-300",
    isCollapsed ? "md:justify-center" : "md:justify-between"
)}>
```

b) Inner logo+label wrapper `<div>` — add `md:hidden` when collapsed (this hides BOTH the logo and the "InvestAI Panel" span on `md+` in one move; mobile is unaffected because this whole header block is already `hidden md:flex`):

```typescript
<div className={cn("flex items-center min-w-0", isCollapsed && "md:hidden")}>
    <BrainCircuit className="h-6 w-6 text-teal-600 dark:text-teal-400 mr-3 shrink-0" />
    <span className="text-lg font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 text-gradient shrink-0">InvestAI Panel</span>
</div>
```

c) Pillar toggle button text — currently `{pillar.name}` rendered as text inside the desktop pillar `<button>` at lines 73-89. Wrap the name in a conditional span:

```typescript
<pillar.icon className="h-3.5 w-3.5" />
<span className={cn(isCollapsed && "hidden")}>{pillar.name}</span>
```

d) Nav item label span — currently at line 143:

```typescript
<span className={cn(
    "block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap",
    isCollapsed && "md:hidden"
)}>{item.name}</span>
```

(`md:hidden` so the mobile bottom-nav still shows the small label as today.)

e) Desktop-only utilities label spans — currently at line 172 inside the `hidden md:flex` utilities `<nav>`:

```typescript
<span className={cn("whitespace-nowrap", isCollapsed && "hidden")}>{item.name}</span>
```

f) Sign Out label span — currently at line 185:

```typescript
<span className={cn(
    "block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap",
    isCollapsed && "md:hidden"
)}>Sign Out</span>
```

- [ ] **Step 4: Run all Sidebar tests, verify they pass**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: all three tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): hide all text labels in collapsed mode"
```

---

## Task 4: Center icons and tighten spacing in collapsed mode

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** When collapsed at `md+`, nav item rows center their icons (`md:justify-center` instead of `md:justify-start`) and remove the right margin from icons (`md:mr-0` instead of `md:mr-3`). Same for utility links and Sign Out.

- [ ] **Step 1: Add the failing layout test**

Append:

```typescript
it("centers icons and zeros their right margin when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const portfolioLink = screen.getByRole("link", { name: /my investment portfolio/i });
    expect(portfolioLink.className).toContain("md:justify-center");
    expect(portfolioLink.className).not.toContain("md:justify-start");

    const portfolioIcon = portfolioLink.querySelector("svg");
    expect(portfolioIcon).not.toBeNull();
    expect(portfolioIcon!.getAttribute("class")).toContain("md:mr-0");
    expect(portfolioIcon!.getAttribute("class")).not.toContain("md:mr-3");
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "centers icons"`
Expected: FAIL — link still uses `md:justify-start` and icon still uses `md:mr-3`.

- [ ] **Step 3: Apply conditional layout classes**

In `src/components/Sidebar.tsx`:

a) Main nav item `<Link>` — currently around line 119-130. Update the className section that contains `md:justify-start`:

```typescript
className={cn(
    isActive
        ? isAmber && !isUtility
            ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
            : "bg-teal-50 dark:bg-neutral-900 text-teal-700 dark:text-teal-400"
        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white",
    isUtility ? "md:hidden" : "",
    "group flex flex-col md:flex-row items-center justify-center rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0",
    isCollapsed ? "md:justify-center" : "md:justify-start"
)}
```

b) Main nav item icon — currently around line 132-141. Update its className:

```typescript
<item.icon
    className={cn(
        isActive
            ? isAmber && !isUtility
                ? "text-amber-600 dark:text-amber-400"
                : "text-teal-600 dark:text-teal-400"
            : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
        "mb-1 h-5 w-5 shrink-0 transition-colors",
        isCollapsed ? "md:mb-0 md:mr-0" : "md:mb-0 md:mr-3"
    )}
    aria-hidden="true"
/>
```

c) Desktop utilities `<Link>` — currently around line 156-163. Update className (note: utilities live under `hidden md:flex`, so we only need md-prefix variants):

```typescript
className={cn(
    isActive
        ? "bg-teal-50 dark:bg-neutral-900 text-teal-700 dark:text-teal-400"
        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900/50 hover:text-neutral-900 dark:hover:text-white",
    "group flex items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    isCollapsed ? "justify-center" : ""
)}
```

d) Desktop utilities icon — currently around line 166-169. Update:

```typescript
<item.icon
    className={cn(
        isActive ? "text-teal-600 dark:text-teal-400" : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300",
        "h-5 w-5 shrink-0 transition-colors",
        isCollapsed ? "mr-0" : "mr-3"
    )}
    aria-hidden="true"
/>
```

e) Sign Out button — currently lines 180-186. Update className and icon className:

```typescript
<button
    onClick={() => signOut({ callbackUrl: '/login' })}
    className={cn(
        "group flex flex-col md:flex-row items-center justify-center rounded-lg px-3 py-2 md:px-3 md:py-2 text-xs md:text-sm font-medium transition-colors md:w-auto shrink-0 text-neutral-500 dark:text-neutral-400 hover:bg-red-50 dark:hover:bg-neutral-900/50 hover:text-red-700 dark:hover:text-red-400",
        isCollapsed ? "md:justify-center" : "md:justify-start"
    )}
>
    <LogOut className={cn(
        "mb-1 h-5 w-5 shrink-0 transition-colors text-neutral-400 dark:text-neutral-500 group-hover:text-red-600 dark:group-hover:text-red-400",
        isCollapsed ? "md:mb-0 md:mr-0" : "md:mb-0 md:mr-3"
    )} aria-hidden="true" />
    <span className={cn(
        "block text-[11px] md:text-sm text-center md:text-left whitespace-nowrap",
        isCollapsed && "md:hidden"
    )}>Sign Out</span>
</button>
```

- [ ] **Step 4: Run all Sidebar tests**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: all four tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): center icons and remove margins in collapsed mode"
```

---

## Task 5: Pillar toggle stacks vertically when collapsed

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** The desktop pillar toggle (Blueprint │ Markets) currently lays out as `flex` (row). When collapsed, it must switch to `flex-col` so the two icon-only buttons stack vertically inside the 64px-wide column.

- [ ] **Step 1: Add the failing layout test**

Append:

```typescript
it("stacks the pillar toggle vertically when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    const blueprintButton = screen.getByRole("button", { name: /my blueprint/i });
    const pillarContainer = blueprintButton.parentElement!;

    expect(pillarContainer.className).not.toContain("flex-col");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(pillarContainer.className).toContain("flex-col");
});
```

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "stacks the pillar toggle"`
Expected: FAIL — container still uses default flex-row.

- [ ] **Step 3: Apply conditional `md:flex-col` to pillar toggle container**

In `src/components/Sidebar.tsx`, the desktop pillar toggle div is currently at line 72. Update its className using `cn`:

```typescript
{/* Desktop pillar toggle */}
<div className={cn(
    "hidden md:flex mx-3 mt-3 p-1 rounded-lg bg-neutral-100 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800",
    isCollapsed && "md:flex-col"
)}>
    {pillars.map((pillar) => (
        <button
            key={pillar.id}
            onClick={() => setActivePillar(pillar.id)}
            className={cn(
                "flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all",
                activePillar === pillar.id
                    ? pillar.id === "blueprint"
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-amber-600 text-white shadow-sm"
                    : "text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
            )}
        >
            <pillar.icon className={cn(isCollapsed ? "h-4 w-4" : "h-3.5 w-3.5")} />
            <span className={cn(isCollapsed && "hidden")}>{pillar.name}</span>
        </button>
    ))}
</div>
```

(The pillar `<span>` change for hiding the text was added in Task 3 step 3c — keep it. The pillar icon size bumps from `h-3.5 w-3.5` to `h-4 w-4` when collapsed for tap-target clarity, per the spec.)

- [ ] **Step 4: Run all tests**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: all five tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): stack pillar toggle vertically when collapsed"
```

---

## Task 6: Tooltips via `title` attribute

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** Every interactive icon in the desktop sidebar — nav links, utility links, Sign Out, pillar buttons, the toggle itself — gets a `title` attribute matching its visible label so the browser shows a tooltip on hover/focus when collapsed.

- [ ] **Step 1: Add the failing tooltip test**

Append:

```typescript
it("sets a title attribute on every interactive sidebar element", () => {
    render(<Sidebar />);

    expect(
        screen.getByRole("link", { name: /my investment portfolio/i })
    ).toHaveAttribute("title", "My Investment Portfolio");

    expect(
        screen.getByRole("link", { name: /user guide/i })
    ).toHaveAttribute("title", "User Guide");

    expect(
        screen.getByRole("button", { name: /sign out/i })
    ).toHaveAttribute("title", "Sign Out");

    expect(
        screen.getByRole("button", { name: /my blueprint/i })
    ).toHaveAttribute("title", "My Blueprint");
});
```

Note: the toggle button already has an `aria-label`; assistive tech reads it. We add a matching `title` for visual hover too.

- [ ] **Step 2: Run and verify it fails**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "sets a title attribute"`
Expected: FAIL — no `title` attributes yet.

- [ ] **Step 3: Add `title` attributes**

In `src/components/Sidebar.tsx`:

a) Pillar toggle buttons — add `title={pillar.name}`:

```typescript
<button
    key={pillar.id}
    onClick={() => setActivePillar(pillar.id)}
    title={pillar.name}
    className={...}
>
```

(Apply to both desktop pillar toggle around line 73 and mobile pillar toggle around line 95. The mobile one is harmless when expanded but provides a tooltip for tablet users.)

b) Main nav `<Link>` — add `title={item.name}`:

```typescript
<Link
    key={item.name}
    href={item.href}
    title={item.name}
    className={...}
>
```

c) Desktop utilities `<Link>` — add `title={item.name}`:

```typescript
<Link
    key={item.name}
    href={item.href}
    title={item.name}
    className={...}
>
```

d) Sign Out `<button>` — add `title="Sign Out"`:

```typescript
<button
    onClick={() => signOut({ callbackUrl: '/login' })}
    title="Sign Out"
    className={...}
>
```

e) Toggle button — add `title` matching aria-label:

```typescript
<button
    type="button"
    onClick={() => setIsCollapsed(c => !c)}
    title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
    aria-expanded={!isCollapsed}
    className={...}
>
```

- [ ] **Step 4: Run all tests**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: all six tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): add title tooltips on every interactive element"
```

---

## Task 7: localStorage persistence (hydration + write + error tolerance)

**Files:**
- Modify: `src/components/__tests__/Sidebar.test.tsx`
- Modify: `src/components/Sidebar.tsx`

**Goal:** On mount, read the `investmentAdvisor.sidebar.collapsed` key. On every toggle, write the new value. If `localStorage` throws, swallow the error (component still works in memory).

- [ ] **Step 1: Add three failing persistence tests**

Append:

```typescript
const STORAGE_KEY = "investmentAdvisor.sidebar.collapsed";

it("starts collapsed when localStorage has 'true'", () => {
    localStorage.setItem(STORAGE_KEY, "true");
    const { container } = render(<Sidebar />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("md:w-16");
    expect(
        screen.getByRole("button", { name: /expand sidebar/i })
    ).toHaveAttribute("aria-expanded", "false");
});

it("writes the new value to localStorage when toggled", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("true");

    await user.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(localStorage.getItem(STORAGE_KEY)).toBe("false");
});

it("does not crash if localStorage.setItem throws", async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, "setItem")
        .mockImplementation(() => { throw new Error("quota exceeded"); });

    const user = userEvent.setup();
    const { container } = render(<Sidebar />);

    await expect(
        user.click(screen.getByRole("button", { name: /collapse sidebar/i }))
    ).resolves.not.toThrow();

    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("md:w-16");

    setItemSpy.mockRestore();
});
```

- [ ] **Step 2: Run and verify they fail**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx -t "localStorage"`

Note: the second test name is "writes the new value to localStorage" — adjust the `-t` filter or run all tests:

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: three new tests FAIL (no persistence logic yet).

- [ ] **Step 3: Add persistence logic**

In `src/components/Sidebar.tsx`:

a) Add a constant near the top (after the imports, before `pillars`):

```typescript
const STORAGE_KEY = "investmentAdvisor.sidebar.collapsed";

function readStoredCollapsed(): boolean {
    try {
        return typeof window !== "undefined" && window.localStorage.getItem(STORAGE_KEY) === "true";
    } catch {
        return false;
    }
}

function writeStoredCollapsed(value: boolean): void {
    try {
        window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
        // Ignore — private browsing, quota, etc.
    }
}
```

b) Replace `const [isCollapsed, setIsCollapsed] = useState(false);` (added in Task 2) with a lazy-initialized version + a hydration effect. Because we render server-side first, we initialize to `false` and hydrate on mount:

```typescript
const [isCollapsed, setIsCollapsed] = useState(false);

useEffect(() => {
    setIsCollapsed(readStoredCollapsed());
}, []);
```

c) Replace the toggle handler `() => setIsCollapsed(c => !c)` with a version that writes through:

```typescript
onClick={() => {
    setIsCollapsed(prev => {
        const next = !prev;
        writeStoredCollapsed(next);
        return next;
    });
}}
```

- [ ] **Step 4: Run all tests**

Run: `npx jest src/components/__tests__/Sidebar.test.tsx`
Expected: all nine tests PASS.

(The "starts collapsed when localStorage has 'true'" test relies on the `useEffect` running synchronously during `render` in jsdom — React Testing Library flushes effects after render, so this works.)

- [ ] **Step 5: Commit**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "feat(sidebar): persist collapse state to localStorage with error tolerance"
```

---

## Task 8: Final verification — typecheck, lint, full test run, manual browser check

**Files:** None (verification only).

**Goal:** Confirm the change is clean across the toolchain and renders correctly at the three target viewports.

- [ ] **Step 1: Run full Jest suite**

Run: `npm test`
Expected: all tests pass, including the existing suites.

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: zero errors. (Warnings are acceptable if they pre-existed.)

- [ ] **Step 4: Build smoke test**

Run: `npm run build`
Expected: build completes successfully with no Sidebar-related errors.

- [ ] **Step 5: Manual browser verification (mobile-first)**

Start the dev server: `npm run dev`

Open `http://localhost:3000/dashboard` in Chrome. Use DevTools device toolbar:

- **iPhone SE (375 × 667):** confirm bottom-nav is unchanged. The toggle button must NOT be visible. Sidebar items show as a horizontal row at the bottom with their small labels.
- **iPad portrait (768 × 1024):** confirm the toggle button appears in the header. Click it — sidebar shrinks to ~64px, all labels disappear, pillar toggle stacks vertically. Hover an icon → browser tooltip appears after ~500ms.
- **Desktop (1440 × 900):** same behavior as tablet. Reload the page — collapsed state persists.
- **Cross-route:** while collapsed on `/dashboard`, navigate to `/profile` and back. State stays collapsed.
- **Theme parity:** flip dark mode (system or app toggle if available). Confirm collapsed sidebar reads correctly.

If any visual issue is found that's not covered by tests (e.g., icon misalignment, transition jank), fix it inline and add a regression test.

- [ ] **Step 6: Final commit if any fixes were made**

```bash
git add src/components/Sidebar.tsx src/components/__tests__/Sidebar.test.tsx
git commit -m "fix(sidebar): <describe any final adjustment>"
```

If no fixes were needed, no final commit. Implementation is complete.
