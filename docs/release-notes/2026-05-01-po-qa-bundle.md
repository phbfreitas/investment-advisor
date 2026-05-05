# Release Notes for QA — Phase 2 + 3A + 3B + 3C + 5G

**For:** Simone (Product Owner)
**Date:** 2026-05-01
**Time needed:** ~25–30 minutes if you do every test
**Where to QA:** prod, on your phone (primary) and laptop (cross-check)

---

## What this covers

Five sub-projects that have been merged to `main` since you last did a QA pass. Most are visible on the Holdings table; one is on the Breakdown tab; one is the new collapsible sidebar.

| Sub-project | One-line summary | What you'll mostly notice |
|---|---|---|
| **Phase 2** — Boundary-layer fixes | Allowlists, sector consolidation, "Not Found" rendering, missing-data honesty | Yellow "Not Found" cells where data is genuinely missing instead of zeros / blanks |
| **3A** — Currency + manual-override protection | Per-row currency in the PDF parser + lock icon on fields you've edited | Lock icons on fields you've changed; correct currency on mixed-currency PDFs |
| **3B** — Collapsible sidebar | Icons-only sidebar mode on desktop/tablet | Chevron in the sidebar header to collapse/expand; choice persists |
| **3C** — ETF holdings market classification | Most ETFs now get a real Market value automatically (USA / Canada / North America / Global) | "Market" column on ETF rows is no longer "Not Found" |
| **5G** — Live-price `?` flag + concentration sum | Grey `?` next to suspicious price jumps, and Top-N chart shows summed % | Both small but visible — see the dedicated test |

A reminder about how to read this: each section has a **What changed** part and a **How to test it** part. You can jump straight to the test if you don't need the context.

---

# Phase 2 — Boundary-layer fixes

## What changed

Before this, the dashboard would silently accept whatever Yahoo (or the PDF) returned, even when the value was nonsense — a sector named "Healthcare Equipment", a return of `0` when Yahoo had nothing to say, currency stamped with the wrong code. The visual result was rows that looked complete but were quietly wrong.

After this:

- **Seven fields have a fixed allowlist of accepted values.** Anything Yahoo or the PDF returns gets normalized to one of those values, or shows up as **"Not Found"** in a yellow italic cell.

  | Field | Accepted values |
  |---|---|
  | Strategy Type | Dividend, Growth, Mix, Not Found |
  | Type | Company, ETF, Fund, Not Found |
  | Call | Yes, No |
  | Sector | Financials, Healthcare, IT, Energy, Real Estate, Consumer Discretionary, Consumer Staples, Materials, Industrials, Communication, Utilities, Diversified, Not Found |
  | Market | USA, Canada, North America, Global, Not Found |
  | Currency | USD, CAD (canonical); EUR/GBP/BRL/etc. accepted when reported by the broker |
  | Mgmt Style | Active, Passive, N/A |

- **Sector consolidation.** Yahoo's noisy sector names get rolled up — "Banking" + "Insurance" → **Financials**, "Cyclical" + "Defensive" → **Consumer Discretionary** / **Consumer Staples**, "Gold" + "Mining" → **Materials**, "Mix" / "Multi-sector" → **Diversified**.

- **Companies (individual stocks) auto-fill three fields.** When something is identified as a `Company`:
  - **Call** is forced to `No` (a single stock is not a covered-call fund).
  - **Mgmt Style** is forced to `N/A` (stocks are not actively/passively managed).
  - **Mgmt Fee** is forced to `0` (legitimate zero — stocks have no fee).

- **Missing numbers stay missing.** Yield, 1-year return, 3-year return, and management fee for ETFs/funds will now display as **"Not Found"** (yellow italic) when Yahoo doesn't return them — instead of silently being shown as `0` and skewing the math.

- **One-time cleanup migration ran on prod.** The migration script (`MIGRATION_PHASE2_CLEANUP`) walked your existing portfolio once and corrected stale rows so you didn't have to re-import everything to see the new behavior.

## How to test it

### 1. Yellow "Not Found" cells (item 4.4)

1. Open the dashboard.
2. Scan for any **yellow italic cells** with the literal text "Not Found".
3. On desktop, hover one — the tooltip should read *"Value not found in market data — please review"*.
4. Confirm none of these cells used to show `0` for a yield or return that you knew was actually unknown.

### 2. Sector values are short and consistent (items 1.1, 1.2, 2.4)

1. Look down the **Sector** column.
2. You should only see values from the canonical list (Financials, Healthcare, IT, Energy, etc.) or "Not Found".
3. Specifically, you should **not** see things like "Banking", "Cyclical", "Multi-sector", or "Healthcare Services" anymore — those are rolled up.

### 3. Companies have sensible defaults (item 2.5)

1. Find a stock row (Type = Company), e.g. Apple, Costco, CM.
2. Confirm:
   - **Call** = `No`
   - **Mgmt Style** = `N/A`
   - **Mgmt Fee** = `0.00%` (rendered normally, not yellow — `0` is legitimate for a stock)

### 4. ETF returns no longer show fake zeros (item 4.3)

1. Find an ETF where the 1-year or 3-year return wasn't available from Yahoo (rare but possible).
2. Confirm the cell shows yellow "Not Found" — not `0.00%`.

### 5. Mobile

1. Same checklist on your phone.
2. Confirm yellow "Not Found" cells fit in their columns without breaking layout.

---

# Phase 3A — Currency fix + "my overrides stick"

## What changed

Two related problems, fixed together:

**Problem 1 — TFSA PDFs were stamping CAD on USD holdings.** The parser used to look at the document once, decide "this is CAD," and stamp CAD on every row. Now it reads currency **per row** — section headers ("Canadian Dollar Holdings", "U.S. Dollar Holdings") and inline tags ("USD" / "CAD" next to a price) both work. The document-level guess is now the last resort.

**Problem 2 — Yahoo refreshes were wiping your manual fixes.** Now there's a **lock**. Any time you edit one of these eight fields, a tiny lock icon appears next to it:

- Sector, Market, Type, Strategy Type, Call, Mgmt Style, Currency, Mgmt Fee

After that, no Yahoo refresh, no PDF re-import, no ticker lookup will overwrite your value. To release the lock, **tap the icon** — the next refresh will populate the field again from Yahoo.

The lock works in two places: directly on the row in the table, and inside the edit form.

## How to test it

### 1. Currency fix on Wealthsimple PDF (item 1.4)

1. Re-upload your Wealthsimple TFSA PDF (the one with mixed CAD + USD).
2. Confirm USD-priced holdings show **USD** in the Currency column, and CAD-priced holdings show **CAD**.
3. Compare against any earlier import where everything had been tagged CAD.

> Note: a small follow-up patch was landed for Wealthsimple-specific section header wording ("Canadian Equities and Alternatives" / "US Equities and Alternatives"). If you spot a row that still gets the wrong currency, screenshot the PDF section.

### 2. Lock icon appears on edit (item 1.3)

1. On any holding, change the **Sector** to a different value.
2. Confirm a small lock icon appears next to the sector value.
3. Repeat with **Call**, **Strategy Type**, **Currency** — same behavior expected on each.

### 3. Lock survives refresh

1. With a locked sector, click "Refresh" or run a single-ticker lookup.
2. Confirm the sector value did **not** change. Lock icon still visible.

### 4. Tap to unlock

1. Tap the lock icon on a locked field.
2. Icon disappears.
3. Click "Refresh". Yahoo's value should now populate.

### 5. Lock survives PDF re-import

1. Pick a row with at least one locked field (say, you locked the Currency on a USD ETF).
2. Re-import the PDF.
3. Confirm the locked field stayed at your value. Other fields refreshed normally.

### 6. Mobile

1. Same checklist on your phone.
2. Confirm lock icons fit in the cells without breaking the row layout.
3. Confirm tap-target on the lock icon is large enough to hit reliably.

> **Known follow-ups still open on 3A** (you don't need to test these — they're tracked):
> - Edit-mode PUT route doesn't yet check optimistic-concurrency on lock toggles (only the inline lock-icon tap does).
> - Three smaller items also filed; none of them affect the visible behavior of the lock for normal use.

---

# Phase 3B — Collapsible sidebar

## What changed

You can now collapse the desktop/tablet sidebar to an icons-only strip. The dashboard tables and charts get back **~190px of horizontal room** when collapsed.

- Icons-only sidebar uses **64px** wide; expanded uses **256px**.
- A **chevron button** in the sidebar header toggles between the two states (`‹` collapses, `›` expands).
- Icon labels are replaced by hover tooltips when collapsed (browser-native `title` attribute, ~500ms hover delay).
- Your choice **persists across reloads** (stored in `localStorage`).
- **Phone is unchanged** — bottom-nav stays exactly as today. The chevron is hidden on phone.

## How to test it

### 1. Toggle works (desktop or tablet)

1. Open the dashboard on desktop (or tablet — anything ≥ 768px wide).
2. Find the chevron button in the top-right of the sidebar header.
3. Click it. Sidebar should collapse to icons-only.
4. Click again. Sidebar should expand back, label text returns.

### 2. Tooltips on collapse

1. With the sidebar collapsed, hover over each icon.
2. Confirm the label appears as a browser tooltip (e.g. "Dashboard", "Settings").

### 3. Persistence

1. Collapse the sidebar.
2. Reload the page.
3. The sidebar should still be collapsed.
4. Expand it. Reload. It should still be expanded.

### 4. Active row tint stays visible when collapsed

1. Collapse the sidebar.
2. Confirm the active page (the one you're on) still has its tinted background — just narrower.

### 5. Phone is unchanged

1. Open the dashboard on your phone.
2. Confirm the bottom-nav row looks identical to before.
3. Confirm there is **no chevron** anywhere.

---

# Phase 3C — ETF Market is no longer always "Not Found"

## What changed

Before: every ETF and fund showed **Market = "Not Found"** because the system couldn't tell what country the fund's holdings were actually from. You worked around this by setting Market manually — and 3A's lock kept your manual values safe.

Now: the system looks at each ETF's **top 10 holdings** and decides:

- All US companies → **USA**
- All Canadian companies → **Canada**
- Mix of US + Canadian → **North America**
- Anything outside North America in the mix → **Global**
- Can't tell with confidence → **Not Found** (you can still set manually with the 3A lock)

To avoid the trap where a "Total World" fund's top 10 is all US tech and gets misclassified as USA, the system also reads the fund's **name and category**. If it contains words like "Global", "World", "International", "Emerging", "Foreign", "Ex-US", "Developed", the system **refuses to classify** and falls back to "Not Found."

**All-in-one ETFs (VBAL, VEQT, XBAL, XEQT, etc.).** These hold other ETFs rather than individual companies. The system goes **one level deep**: it looks up each underlying ETF's classification and combines. So VBAL (US ETF + Canadian ETF + international ETF + bond ETF) usually classifies as **Global**.

**Caching.** Once an ETF is classified, the result is cached for **1 year** — Yahoo's holdings API is slow and rate-limited, and a fund's country bucket doesn't change every week. After 1 year, the next refresh silently re-classifies. To force a fresh classification before then, lock and unlock the field, then refresh — the unlock clears the timestamp.

**Tooltip on Not Found cells (desktop only).** Hovering a yellow Not Found Market cell shows: *"Couldn't determine from top holdings. Set manually if needed."* On phone there's no tooltip — same flow as before, tap the row and use the dropdown.

## How to test it

### 1. Basic classification (item 2.3)

1. Re-import your TFSA PDF.
2. Look at ETF rows — most should now show a real **Market** value (USA, Canada, North America, Global).
3. Spot-check:
   - A US-listed S&P 500 ETF (VOO/IVV/SPY) → **USA**
   - A `.TO`-listed Canadian broad-market ETF (XIC/ZCN) → **Canada**
   - An "international" / "world" / "emerging" ETF (VEA, VWO, EEM) → **Not Found** (caught by the name/category guard — you set manually)

### 2. Cache behavior

1. Click **refresh row** on a freshly-classified ETF.
2. Price/yield should refresh as today, but **Market should stay the same value** (cache hit).

### 3. Lock interaction (3A integration)

1. On a classified ETF row, manually change Market to a different value (e.g. "Canada" on something the system classified as "USA"). The 3A lock icon should appear.
2. Click "refresh row" — Market should NOT change. Lock icon still visible.
3. Tap the lock icon to unlock. Lock disappears.
4. Click "refresh row" again — Market should re-classify and produce a fresh value.

### 4. All-in-one ETF (if you hold one)

1. If you hold VBAL, VEQT, XBAL, XEQT, or similar, look at its Market value.
2. Should be **Global** or **North America** depending on the fund's mandate.
3. If you don't hold one, you can manually look one up via the ticker search.

### 5. Tooltip on Not Found ETF cells (desktop only)

1. On desktop, find a Not Found Market cell on an ETF row.
2. Hover. The tooltip should read: *"Couldn't determine from top holdings. Set manually if needed."*

### 6. Mobile

1. Open the dashboard on your phone.
2. Confirm ETF rows render correctly with the new Market values.
3. Confirm the lock icon (when locked) is still tap-friendly.

---

# Phase 5G — Live-price `?` flag + concentration sum

## What changed

Two small, independent additions:

1. **A small grey `?` next to a Live $ value** when a refresh comes back >10% different from the prior price. The new price still applies — the `?` is just a passive flag saying *"this is a big jump, you may want to glance and confirm."* Tap it for a tooltip showing the prior price and the percentage change.
2. **The Top-N Holdings chart now shows the summed concentration.** Title used to say `Top 10 Holdings`. It now reads `Top N Holdings · X.X% of portfolio`.

Behind the scenes, every `?` also writes a forensic log entry (full Yahoo response, prior price, new price, timestamp) so that when you report a price-bug, the underlying data can be pulled.

## How to test it

### Test 1 — Concentration sum (10 seconds)

1. Open the dashboard, go to the **Breakdown** tab.
2. Find the **Top 10 Holdings** chart.
3. Title should now read something like `Top 10 Holdings · 73.2% of portfolio`.
4. Sanity-check: the percentage roughly matches the sum of the bars in the chart.

### Test 2 — Live-price `?` flag (~3 minutes; requires fake-edit setup)

The real bug (Yahoo returning a wrong price) is unpredictable, so we'll fake it once.

#### Step A — Pick a holding and note its current Live $

1. Open the **Holdings** tab.
2. Pick a low-volatility holding (COST or CM are good choices).
3. Write down the current **Live $** value. e.g. `$996.43`.

#### Step B — Cut its Live $ in half and save

1. Tap the row to enter edit mode.
2. Find the **Live $** field (the green-coloured column).
3. Set it to about **half** of what it was. e.g. `498`.
4. Save the row.

#### Step C — Hit Refresh and confirm the `?` appears

1. Click the global **Refresh** button.
2. Wait for prices to come back from Yahoo.
3. The Live $ should be the *real* price again (Yahoo overwrote your halved value).
4. **Important:** next to the price, you should see a small grey **`?`** icon.
5. Hover (desktop) or tap (phone) the `?`. Tooltip should read something like:
   `Changed from $498.00 (+100.0%)`

#### Step D — Put the price back (optional)

The Live $ will auto-correct on the next refresh anyway. If you want to be tidy, edit and reset to the original value.

### Test 3 — Mobile

1. Repeat Test 2 once on your phone.
2. Confirm the `?` icon fits in the row without breaking table layout.
3. Confirm tapping shows the tooltip cleanly (not cut off at the screen edge).
4. Confirm the tap target is reachable without zooming.

---

# Cross-cutting checks

After you've worked through the per-phase tests, two final sanity sweeps:

## Mobile sweep (your primary device)

The whole point of the four sub-projects is to make the dashboard more honest and more mobile-friendly. After this batch:

- Lock icons (3A) — tap-target large enough?
- Yellow Not Found cells (Phase 2) — fit in cells without overflow?
- Real Market values on ETFs (3C) — render in the column?
- `?` flag (5G) — fits in the Live $ cell?
- Sidebar (3B) — chevron is **not** showing on phone (correct), bottom-nav unchanged?

## What stays exactly the same

- **Live market data refreshes** (prices, yields, returns) still happen the same way. You can't lock a price.
- **Computed values** (Market Value, Profit/Loss, Expected Annual Dividends) update from formulas as before.
- **Charts and Breakdown tab layout, sticky columns, sidebar (in expanded mode), mobile bottom-nav** are all unchanged.
- **Existing assets** don't have any 3A lock or 3C cache stamp until you touch them. First refresh / re-import / edit picks them up.

---

# Reporting issues

If anything looks off, send me:

1. A short sentence on what you did.
2. A screenshot.
3. (If relevant) the ticker and which device you were on.

That's all I need to debug. Don't try to reproduce twice — one report is enough.

---

# What's still pending after this QA

Two things you should know are intentionally not covered:

1. **3A deferred follow-ups** — four small items filed in [docs/superpowers/triage/2026-04-30-3A-deferred-followups.md](../superpowers/triage/2026-04-30-3A-deferred-followups.md). None affect day-to-day use of the lock; they tighten edge cases (concurrency on edit-mode PUT, etc.). Future sprint.
2. **Phase 4** — the time-weighted Total Return timeline filter (item 5.2). Multi-week heavy lift. Not started.

Everything else from the original PO feedback (April 27 triage) is now in your hands for QA.
