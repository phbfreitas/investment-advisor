# Strategy Configuration Feedback Refinements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the strategy configuration system based on user feedback — expanded sector/geo options, risk tolerance slider, "Other" wealth field, portfolio table with Yahoo Finance lookup, CSV export, and guru prompt templates.

**Architecture:** Extend existing types and constants, add a Yahoo Finance ticker-lookup API route, enhance ProfileClient with a portfolio table (reusing existing Asset CRUD), replace chat quick prompts with 4 guru prompt templates. All changes follow established patterns (controlled forms, DynamoDB merge, Tailwind dark mode).

**Tech Stack:** Next.js App Router, TypeScript, DynamoDB, yahoo-finance2 (already installed), Tailwind CSS, lucide-react icons.

---

### Task 1: Extend Types and Constants

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add new sector keys and labels**

In `SECTOR_KEYS` array (~line 141), append two entries:

```typescript
// After 'metals':
'sp500',
'other',
```

In `SECTOR_LABELS` object (~line 155), add:

```typescript
'sp500': 'S&P 500',
'other': 'Other',
```

- [ ] **Step 2: Add new geographic keys and labels**

In `GEO_KEYS` array (~line 165), append three entries:

```typescript
// After 'frontier':
'usa',
'canada',
'globalMix',
```

In `GEO_LABELS` object (~line 173), add:

```typescript
'usa': 'USA Only',
'canada': 'Canada Only',
'globalMix': 'Global Mix',
```

- [ ] **Step 3: Change riskTolerance type**

In the profile/form types, ensure `riskTolerance` is typed as `number` (not a string enum). If the existing type is `string`, change it to `number`. Add a helper constant for the label mapping:

```typescript
export const RISK_TOLERANCE_LABELS: Record<number, string> = {
  1: 'Conservative', 2: 'Conservative', 3: 'Conservative',
  4: 'Moderate', 5: 'Moderate', 6: 'Moderate',
  7: 'Aggressive', 8: 'Aggressive', 9: 'Aggressive',
  10: 'Very Aggressive',
};

export const RISK_TOLERANCE_MIGRATION: Record<string, number> = {
  'Conservative': 2,
  'Moderate': 5,
  'Aggressive': 8,
  'Speculative': 10,
};
```

- [ ] **Step 4: Add wealthAssetOther to WealthData**

In the `WealthData` type (~line 80), add after `wealthAssetRentalProperties`:

```typescript
wealthAssetOther: string;
```

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit`
Expected: Type errors in files that reference old types (expected at this stage — will be fixed in subsequent tasks).

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: extend types with new sector/geo keys, risk tolerance scale, and Other wealth field"
```

---

### Task 2: Update Portfolio Analytics

**Files:**
- Modify: `src/lib/portfolio-analytics.ts`

- [ ] **Step 1: Add new entries to SECTOR_NORMALIZE_MAP**

In `SECTOR_NORMALIZE_MAP` (~line 13), add mappings for the new keys:

```typescript
's&p 500': 'sp500',
's&p500': 'sp500',
'sp500': 'sp500',
'index': 'sp500',
'other': 'other',
```

- [ ] **Step 2: Update GEO_NORMALIZE_MAP for granular regions**

In `GEO_NORMALIZE_MAP` (~line 41), modify the existing uppercase entries in-place to map to the new granular keys instead of `"na"`, and add new entries:

```typescript
// Modify these existing entries (they currently all map to "na"):
"US": "usa",           // was "na"
"USA": "usa",          // was "na"
"Canada": "canada",    // was "na"
"CA": "canada",        // was "na"

// Keep "North America" mapping to "na" for unspecified:
"North America": "na", // unchanged

// Add new entries:
"Global": "globalMix",
"Global Mix": "globalMix",
```

- [ ] **Step 3: Update formatStrategyContext for risk tolerance**

In `formatStrategyContext` (~line 177), update the risk tolerance line to use the numeric scale:

```typescript
import { RISK_TOLERANCE_LABELS } from '@/types';

// In the function, replace the riskTolerance line with:
const riskLabel = RISK_TOLERANCE_LABELS[profile.riskTolerance] || 'Not set';
lines.push(`RISK TOLERANCE: ${profile.riskTolerance}/10 (${riskLabel})`);
```

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add src/lib/portfolio-analytics.ts
git commit -m "feat: update normalization maps for granular geo regions and new sector keys"
```

---

### Task 3: Ticker Lookup API Route

**Files:**
- Create: `src/app/api/ticker-lookup/route.ts`

- [ ] **Step 1: Create the Yahoo Finance lookup endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import yahooFinance from 'yahoo-finance2';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const symbol = request.nextUrl.searchParams.get('symbol');
  if (!symbol) {
    return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 });
  }

  try {
    const quote = await yahooFinance.quote(symbol.toUpperCase());
    const summaryDetail = await yahooFinance.quoteSummary(symbol.toUpperCase(), {
      modules: ['summaryDetail', 'assetProfile'],
    });

    return NextResponse.json({
      sector: summaryDetail.assetProfile?.sector || '',
      market: quote.exchange || '',
      securityType: quote.quoteType || '',
      currentPrice: quote.regularMarketPrice || 0,
      dividendYield: summaryDetail.summaryDetail?.dividendYield
        ? summaryDetail.summaryDetail.dividendYield * 100
        : 0,
      oneYearReturn: quote.fiftyTwoWeekChangePercent || 0,
      fiveYearReturn: 0, // Not directly available from yahoo-finance2 quote
      currency: quote.currency || 'USD',
      name: quote.shortName || quote.longName || symbol,
    });
  } catch (error) {
    console.error(`[ticker-lookup] Failed for ${symbol}:`, error);
    return NextResponse.json(
      { error: `Could not find ticker: ${symbol}` },
      { status: 404 }
    );
  }
}
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/ticker-lookup/route.ts
git commit -m "feat: add Yahoo Finance ticker-lookup API endpoint"
```

---

### Task 4: Prompt Templates

**Files:**
- Create: `src/lib/prompt-templates.ts`
- Modify: `src/app/HomeClient.tsx`

- [ ] **Step 1: Create prompt templates constant**

```typescript
export interface PromptTemplate {
  id: string;
  emoji: string;
  label: string;
  prompt: string;
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: 'investment-suggestions',
    emoji: '💡',
    label: 'Investment Suggestions',
    prompt:
      'Based on my investment strategy and your core philosophy, suggest specific tickers to buy or sell. Consider my current holdings, sector targets, and risk tolerance.',
  },
  {
    id: 'financial-analysis',
    emoji: '📊',
    label: 'Financial Analysis',
    prompt:
      'Analyze my entire financial situation — investments, net worth, and cash flow (budget vs. actual). Identify strengths, risks, and suggest adjustments.',
  },
  {
    id: 'portfolio-rebalancing',
    emoji: '⚖️',
    label: 'Portfolio Rebalancing',
    prompt:
      'Review my portfolio against my target allocations and suggest specific buy/sell orders to rebalance. Prioritize actions by impact and alignment with my strategy.',
  },
  {
    id: 'financial-health-audit',
    emoji: '🏥',
    label: 'Financial Health Audit',
    prompt:
      'Perform a complete financial health audit — assets beyond investments, total net worth, cash flow (budgeted vs. actual), debt ratios, and emergency fund adequacy. Recommend changes.',
  },
];
```

- [ ] **Step 2: Replace quick prompts in HomeClient.tsx**

In `src/app/HomeClient.tsx`, replace the existing quick prompt buttons (~lines 139-152) with the new templates:

```typescript
import { PROMPT_TEMPLATES } from '@/lib/prompt-templates';
```

Replace the hardcoded quick prompt pills with:

```tsx
{/* Quick Prompts */}
<div className="flex flex-wrap gap-2 justify-center">
  {PROMPT_TEMPLATES.map((tmpl) => (
    <button
      key={tmpl.id}
      onClick={() => setInputValue(tmpl.prompt)}
      className="px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition-colors"
    >
      {tmpl.emoji} {tmpl.label}
    </button>
  ))}
</div>
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompt-templates.ts src/app/HomeClient.tsx
git commit -m "feat: replace quick prompts with 4 guru prompt templates"
```

---

### Task 5: Profile Page — Config Tweaks (Sectors, Geo, Risk Slider)

**Files:**
- Modify: `src/app/profile/ProfileClient.tsx`
- Modify: `src/app/api/profile/route.ts`

- [ ] **Step 1: Update ProfileClient form defaults**

In the `FormData` interface (~line 94), change `riskTolerance` from `string` to `number`.

In `DEFAULT_FORM` (~line 110), update:
- `sectorAllocation`: add `sp500: 0, other: 0` to the record
- `geographicExposure`: add `usa: 0, canada: 0, globalMix: 0` to the record
- `riskTolerance`: change default from `''` to `5` (middle of scale, now a number)

- [ ] **Step 2: Add risk tolerance backward compatibility in data loading**

In the useEffect that loads profile data (~line 125), add migration logic:

```typescript
import { RISK_TOLERANCE_MIGRATION } from '@/types';

// When setting formData from loaded profile:
const rawRisk = profileData.riskTolerance;
const riskValue = typeof rawRisk === 'string'
  ? (RISK_TOLERANCE_MIGRATION[rawRisk] ?? 5)
  : (typeof rawRisk === 'number' ? rawRisk : 5);
```

Use `riskValue` when populating formData.

- [ ] **Step 3: Add number input auto-select behavior**

Add an `onFocus` handler to all percentage number inputs in the sector and geographic sections that selects all text:

```typescript
const handleFocusSelect = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.select();
};
```

Apply `onFocus={handleFocusSelect}` to every allocation number input.

- [ ] **Step 4: Replace risk tolerance dropdown with slider**

Replace the existing risk tolerance dropdown/select with a range slider:

```tsx
<CollapsibleSection title="Risk Tolerance">
  <div className="space-y-3">
    <input
      type="range"
      min={1}
      max={10}
      step={1}
      value={formData.riskTolerance}
      onChange={(e) =>
        setFormData((prev) => ({ ...prev, riskTolerance: parseInt(e.target.value) }))
      }
      className="w-full h-2 rounded-lg appearance-none cursor-pointer"
      style={{
        background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
      }}
    />
    <div className="flex justify-between text-xs text-neutral-500">
      <span>1 — Conservative</span>
      <span>4 — Moderate</span>
      <span>7 — Aggressive</span>
      <span>10 — Very Aggressive</span>
    </div>
    <p className="text-center text-sm font-semibold text-teal-500">
      Current: {formData.riskTolerance} — {RISK_TOLERANCE_LABELS[formData.riskTolerance] || 'Not set'}
    </p>
  </div>
</CollapsibleSection>
```

- [ ] **Step 5: Update profile API validation**

In `src/app/api/profile/route.ts`, add risk tolerance validation in the POST handler (~line 67):

```typescript
// After existing percentage validations:
const riskTolerance = body.riskTolerance;
if (riskTolerance !== undefined && riskTolerance !== null) {
  const riskNum = typeof riskTolerance === 'string'
    ? (RISK_TOLERANCE_MIGRATION[riskTolerance] ?? parseInt(riskTolerance))
    : riskTolerance;
  if (typeof riskNum !== 'number' || riskNum < 1 || riskNum > 10) {
    return NextResponse.json({ error: 'Risk tolerance must be between 1 and 10' }, { status: 400 });
  }
}
```

Also add `riskTolerance` to the fields persisted in the profileData object.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/app/profile/ProfileClient.tsx src/app/api/profile/route.ts
git commit -m "feat: add new sector/geo options and risk tolerance slider"
```

---

### Task 6: Finance Summary — "Other" Wealth Field

**Files:**
- Modify: `src/app/finance-summary/FinanceSummaryClient.tsx`
- Modify: `src/app/api/profile/route.ts`

- [ ] **Step 1: Add wealthAssetOther to FinanceSummaryClient state**

In the state initialization (~line 77), add `wealthAssetOther: ''` to the wealthData defaults.

In the useEffect that loads data, extract `wealthAssetOther` from the profile payload.

- [ ] **Step 2: Add the "Other Assets" input field in the UI**

In the Assets column of the wealth section, after the last asset InputField (wealthAssetRentalProperties), add:

```tsx
<InputField
  label="Other Assets"
  value={wealthData.wealthAssetOther}
  onChange={(val) => handleWealthChange('wealthAssetOther', val)}
/>
```

- [ ] **Step 3: Include wealthAssetOther in totalAssets calculation**

In the calculation section (~line 375), add `parseFloat(wealthData.wealthAssetOther.replace(/,/g, '') || '0')` to the totalAssets sum.

- [ ] **Step 4: Include wealthAssetOther in save handler**

In `handleWealthSubmit`, ensure `wealthAssetOther` is included in the payload sent to `/api/profile`.

- [ ] **Step 5: Update profile API to persist wealthAssetOther**

In `src/app/api/profile/route.ts`, add `wealthAssetOther` to the WealthData fields in the profileData object (~line 108):

```typescript
wealthAssetOther: body.wealthAssetOther ?? existing.wealthAssetOther ?? null,
```

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add src/app/finance-summary/FinanceSummaryClient.tsx src/app/api/profile/route.ts
git commit -m "feat: add Other Assets field to finance summary wealth section"
```

---

### Task 7: Portfolio Table on Profile Page

**Files:**
- Modify: `src/app/profile/ProfileClient.tsx`

This is the largest task. It adds a portfolio table section to the profile page that displays existing assets in a scrollable table with sticky header, inline editing, Yahoo Finance auto-lookup, and CSV export.

- [ ] **Step 1: Add portfolio table state**

Add state for the table's editing mode and new holding form:

```typescript
const [editingAssetId, setEditingAssetId] = useState<string | null>(null);
const [editForm, setEditForm] = useState<Partial<Asset>>({});
const [showAddForm, setShowAddForm] = useState(false);
const [newHolding, setNewHolding] = useState({
  account: '', ticker: '', securityType: '', sector: '', market: '',
  quantity: '', bookCost: '', currency: 'CAD',
});
const [tickerLoading, setTickerLoading] = useState(false);
```

- [ ] **Step 2: Add ticker lookup handler**

```typescript
const handleTickerLookup = async (symbol: string) => {
  if (!symbol.trim()) return;
  setTickerLoading(true);
  try {
    const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}`);
    if (res.ok) {
      const data = await res.json();
      setNewHolding((prev) => ({
        ...prev,
        sector: data.sector || prev.sector,
        market: data.market || prev.market,
        securityType: data.securityType || prev.securityType,
      }));
    }
  } catch (err) {
    console.error('Ticker lookup failed:', err);
  } finally {
    setTickerLoading(false);
  }
};
```

- [ ] **Step 3: Add account autofill list**

Derive unique account names from existing assets:

```typescript
const uniqueAccounts = useMemo(() => {
  const accounts = new Set(assets.map((a) => a.account).filter(Boolean));
  return Array.from(accounts);
}, [assets]);
```

- [ ] **Step 4: Add calculated fields**

```typescript
const portfolioTotals = useMemo(() => {
  const totalMarketValue = assets.reduce((sum, a) => sum + (a.marketValue || 0), 0);
  const totalBookCost = assets.reduce((sum, a) => sum + (a.bookCost || 0) * (a.quantity || 0), 0);
  const totalPL = assets.reduce((sum, a) => sum + (a.profitLoss || 0), 0);
  return { totalMarketValue, totalBookCost, totalPL };
}, [assets]);

const assetWeight = (asset: Asset) => {
  if (!portfolioTotals.totalMarketValue) return 0;
  return ((asset.marketValue || 0) / portfolioTotals.totalMarketValue) * 100;
};
```

- [ ] **Step 5: Add CSV export handler**

```typescript
const handleExportCSV = () => {
  const headers = ['Account', 'Ticker', 'Type', 'Sector', 'Market', 'Qty', 'Book Cost', 'Market Value', 'Weight %', 'P/L'];
  const rows = assets.map((a) => [
    a.account, a.ticker, a.securityType, a.sector, a.market,
    a.quantity, (a.bookCost || 0) * (a.quantity || 0),
    a.marketValue, assetWeight(a).toFixed(1) + '%', a.profitLoss,
  ]);
  const totalsRow = ['Totals', '', '', '', '', '',
    portfolioTotals.totalBookCost, portfolioTotals.totalMarketValue,
    '100%', portfolioTotals.totalPL,
  ];
  const csv = [headers, ...rows, totalsRow].map((r) => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `portfolio-${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
```

- [ ] **Step 6: Add save/delete handlers for holdings**

```typescript
const handleAddHolding = async () => {
  try {
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account: newHolding.account,
        ticker: newHolding.ticker,
        securityType: newHolding.securityType,
        sector: newHolding.sector,
        market: newHolding.market,
        quantity: parseFloat(newHolding.quantity) || 0,
        bookCost: parseFloat(newHolding.bookCost) || 0,
        currency: newHolding.currency,
      }),
    });
    if (res.ok) {
      // Reload assets
      const profileRes = await fetch('/api/profile');
      const data = await profileRes.json();
      setAssets(data.assets || []);
      setShowAddForm(false);
      setNewHolding({ account: '', ticker: '', securityType: '', sector: '', market: '', quantity: '', bookCost: '', currency: 'CAD' });
    }
  } catch (err) {
    console.error('Failed to add holding:', err);
  }
};

const handleDeleteHolding = async (assetId: string) => {
  try {
    await fetch(`/api/assets/${assetId}`, { method: 'DELETE' });
    setAssets((prev) => prev.filter((a) => a.id !== assetId));
  } catch (err) {
    console.error('Failed to delete holding:', err);
  }
};
```

- [ ] **Step 7: Build the portfolio table JSX**

Add a new `CollapsibleSection` titled "Investment Portfolio" after the Performance Targets section. The table should include:

- Header row with "+ Add Holding" and "Export CSV" buttons
- `<datalist>` element populated from `uniqueAccounts` for account autofill
- Scrollable `<div>` with `max-h-96 overflow-y-auto`
- `<table>` with sticky `<thead>` (`sticky top-0 bg-neutral-900 z-10`)
- Columns: Account, Ticker, Type, Sector, Market, Qty, Book Cost, Mkt Value, Weight %, P/L, Actions
- Each row shows asset data with edit (Pencil icon) and delete (Trash2 icon) buttons
- P/L colored green if positive, red if negative
- Weight % in teal
- `<tfoot>` with totals row
- Conditional "Add Holding" inline form with account datalist, ticker input (onBlur triggers lookup), auto-filled fields, quantity and book cost inputs, and Save/Cancel buttons

- [ ] **Step 8: Run type check**

Run: `npx tsc --noEmit`

- [ ] **Step 9: Commit**

```bash
git add src/app/profile/ProfileClient.tsx
git commit -m "feat: add investment portfolio table with Yahoo Finance lookup and CSV export"
```

---

### Task 8: Update User Guide and Manual

**Files:**
- Modify: `src/app/user-guide/UserGuideClient.tsx`
- Modify: `USER_GUIDE.md`

- [ ] **Step 1: Update UserGuideClient.tsx**

Add documentation for the new features in the appropriate sections:
- **Strategy Configuration section:** Mention the new S&P 500 and Other sector options, the 3 new geographic regions (USA, Canada, Global Mix), and the 1-10 risk tolerance slider replacing the old dropdown.
- **Finance Summary section:** Mention the new "Other Assets" field.
- **Portfolio section:** Document the portfolio table, ticker auto-lookup, account autofill, calculated fields, and CSV export.
- **Advisory Board section:** Document the 4 new prompt templates.

- [ ] **Step 2: Update USER_GUIDE.md**

Mirror the same documentation updates in the markdown manual.

- [ ] **Step 3: Commit**

```bash
git add src/app/user-guide/UserGuideClient.tsx USER_GUIDE.md
git commit -m "docs: update user guide with new strategy refinements and portfolio table"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`
Expected: Clean — no errors.

- [ ] **Step 2: Verify dev server starts**

Run: `npm run dev`
Check that the app compiles without errors.

- [ ] **Step 3: Manual smoke test checklist**

- Profile page: verify new sector fields (S&P 500, Other) appear and sum validation works
- Profile page: verify new geo fields (USA, Canada, Global Mix) appear and sum validation works
- Profile page: verify risk tolerance slider renders with gradient and label
- Profile page: verify portfolio table loads existing assets
- Profile page: verify "+ Add Holding" form with ticker auto-lookup
- Profile page: verify CSV export downloads file
- Finance summary: verify "Other Assets" field appears and saves
- Home page: verify 4 guru prompt pills appear and pre-fill chat input
- Chat: verify sending a prompt template works with selected personas
