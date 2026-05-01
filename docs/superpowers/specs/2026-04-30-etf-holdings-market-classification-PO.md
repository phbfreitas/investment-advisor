# What's Coming: ETFs Will Finally Show the Right Country

**For:** the Product Owner (you!)
**Date:** April 30, 2026
**Companion document:** A more technical version exists for the developer at `2026-04-30-etf-holdings-market-classification-design.md`. This one is plain English so you can review the user-visible behavior before we build it.

---

## What's broken today

When you import an ETF or a Fund into the dashboard, the **Market** column shows "Not Found." Always. Doesn't matter if it's a Vanguard S&P 500 ETF (obviously USA) or a Canadian-listed broad-market fund (obviously Canada) — the system can't tell.

The reason is technical: the *exchange* where an ETF trades doesn't tell you anything about *what's inside it*. A US-listed ETF can hold Canadian companies; a Canadian-listed ETF can hold all-US tech stocks. So today the system gives up and shows "Not Found" for every fund.

You worked around it by setting the Market value manually. But every time the system refreshed, it overwrote your fix — until sub-project 3A (just shipped) added the lock to protect manual edits.

3C is the natural follow-up: instead of always giving up, the system actually tries to figure it out.

---

## What we're building

The system will look at each ETF's **top 10 holdings** (the names of the actual companies inside the fund — Apple, Microsoft, Royal Bank of Canada, etc.) and use that to decide:

- All US companies → **USA**
- All Canadian companies → **Canada**
- A mix of US and Canadian companies → **North America**
- Anything outside North America in the mix → **Global**
- Can't tell with confidence → **Not Found** (you set it manually with the lock from 3A)

That's the rule you specified during brainstorming.

---

## The trap we're avoiding

There's a sneaky case worth understanding: a fund called something like **"Vanguard Total World"** has the world's biggest US tech companies as its top 10 holdings — because those are the world's biggest companies, period. If we just looked at the top 10, the world fund would mistakenly classify as USA.

To avoid that, the system also reads the fund's **name and category**. If the name or category contains words like "Global", "World", "International", "Emerging", "Foreign", "Ex-US", or "Developed", the system refuses to classify and falls back to "Not Found." For those funds, you set the value yourself with the lock from 3A.

For the obvious cases — anything called "S&P 500", "Total US Market", "Nasdaq 100", "TSX 60", etc. — the classification works without surprises.

---

## What you'll see on the dashboard

### Most ETFs will get a real Market value automatically

After this ships, the next time you re-import your TFSA PDF (or click refresh on an existing ETF row), most of your fund holdings will pick up a real Market value:

- **VOO, IVV, SPY** (S&P 500 ETFs) → **USA**
- **QQQ** (Nasdaq) → **USA**
- **XIC.TO, ZCN.TO** (Canadian total market) → **Canada**
- **VEA, IEFA** (developed international) → **Not Found** (caught by the "International" guard — set manually if you want them tagged Global)
- **VWO, EEM** (emerging markets) → **Not Found** (caught by "Emerging" guard)
- **VBAL, VEQT** (Vanguard's all-in-one Canadian portfolios) → **North America** or **Global** depending on what they actually hold inside

### Funds-of-funds (the tricky case)

Vanguard's "all-in-one" ETFs like **VBAL** or **VEQT** don't hold individual companies — they hold a small basket of *other ETFs* (a US ETF, a Canadian ETF, an international ETF, a bond ETF). The system will recognize those nested ETFs and look up each one's classification, then combine.

So for VBAL (which holds a US fund + a Canadian fund + an international fund), the result will likely be **Global** (because the international piece pushes it outside North America). For an "all North American" all-in-one, you'd see **North America**.

The system only goes one level deep. If an all-in-one happens to hold *another* all-in-one (rare), the inner one gets treated as "unknown" and the outer one likely falls back to **Not Found**. You'd set it manually.

---

## How fresh the classification stays

Here's the part you specifically chose during brainstorming:

> Compute once, automatically expire after **1 year**.

Once the system classifies QQQ as "USA," it remembers that decision and doesn't re-check on every dashboard load — which would be wasteful (Yahoo's holdings API is slow and rate-limited, and the country bucket of an ETF essentially never changes).

After 365 days, the next time the system touches that ticker (a refresh, a PDF re-import), it'll silently re-classify in the background. So if a fund's mandate genuinely changed over the course of a year, the dashboard will eventually catch up without you doing anything.

If you want to force a fresh classification *before* the year is up — for example, you suspect a fund changed strategies — there's a slightly clunky workaround: tap the lock icon to lock the field, then tap it again to unlock, then refresh. That clears the cached timestamp and the next refresh re-classifies. We didn't add a dedicated "force re-classify" button because the use case is rare in practice (ETFs don't change country buckets often).

---

## What you'll see when classification fails

Some ETFs will still show "Not Found" because the system genuinely can't tell:

- Funds with "Global", "World", "International", "Emerging", "Foreign" in the name → guarded against the false-positive trap
- Funds where Yahoo doesn't expose the top-10 holdings (rare but happens)
- Funds whose top-10 are mostly other ETFs we can't see through (rare nested case)

When this happens, the cell looks the same as today. **On desktop, hovering shows a small tooltip:**

> *"Couldn't determine from top holdings. Set manually if needed."*

On mobile (your primary device) the tooltip doesn't appear — but you already know what to do: tap the row, set Market manually with the dropdown (the lock icon will appear, marking it as your choice), and you're done. The 3A lock keeps it protected on every future refresh.

No new icons, no badges, no extra clutter on the table. The only visible difference is that most ETF rows that used to say "Not Found" now have a real value.

---

## How it behaves in different situations

| You do this… | …and this happens |
|---|---|
| Import a fresh PDF with QQQ in it | The system classifies QQQ as USA on the first researchTicker call and remembers for 1 year. |
| Tap "refresh row" on QQQ a week later | Live data (price, yield, returns) refreshes as today. Market is **not** re-checked because the cache is still fresh. |
| Tap "refresh row" on QQQ 14 months later | Live data refreshes; classifier also re-runs because TTL is expired; new timestamp recorded. |
| Manually set QQQ's Market to "Canada" (you have your reasons) | Lock icon appears. Cache timestamp is cleared. On every future refresh the manual value sticks. |
| Tap the lock icon on the locked QQQ row | Lock removed. Next refresh re-classifies QQQ from scratch — clean slate. |
| Re-import your TFSA PDF months later | Each ETF row's lock is respected. Newly added ETFs get classified on the spot. |
| Hover an unclassifiable Not Found ETF on desktop | Tooltip explains "couldn't determine — set manually if needed." |

---

## What stays exactly the same

- **Companies (non-ETF holdings)** — already classify correctly via the exchange suffix (`.TO` → Canada, etc.). No change.
- **The Phase 2 allowlist** — `USA / Canada / North America / Global / Not Found` — unchanged. We're just populating it more accurately for ETFs.
- **The 3A lock system** — unchanged. Manual overrides still take precedence over everything.
- **The dashboard layout, charts, breakdown tab, sticky columns, sidebar, mobile bottom nav** — all unchanged.
- **Existing assets in your portfolio** — they don't have a cached classification yet, so on the next refresh or PDF re-import they'll pick one up. No data migration, no batch update.

---

## What happens to assets that already exist

Nothing happens until you touch them. Existing rows simply have no cache timestamp yet. The first time you click refresh, re-import, or use the ticker lookup on an existing ETF, the system runs the classifier and records the result. The Market value updates from "Not Found" to whatever the holdings analysis produces. The lock icon doesn't appear (because the value came from the system, not you).

If you've already set Market manually on an asset (locked from 3A), the classifier respects the lock. No change to your manual values.

---

## How to test this once it's deployed

When the change is live, here's a checklist:

### Basic classification (item 2.3)

1. Re-import your TFSA PDF.
2. Look at ETF rows: most should now show a real Market value (USA, Canada, North America, or Global).
3. Spot-check a few:
   - A US-listed S&P 500 ETF → **USA**
   - A `.TO`-listed Canadian broad-market ETF → **Canada**
   - An "international" or "world" ETF → likely **Not Found**

### Cache behavior

1. Click "refresh row" on a freshly-classified ETF. The price/yield should refresh, but Market should stay the same value (cache hit).
2. Open the audit log on that row — you should see `marketComputedAt` recorded with a recent timestamp.

### Lock interaction (3A integration)

1. On a classified ETF row, manually change Market to a different value (say, "Canada" on something that classified as "USA"). The lock icon should appear.
2. Click "refresh row" — Market should NOT change. Lock icon still visible.
3. Tap the lock icon to unlock. The lock disappears.
4. Click "refresh row" again — Market should re-classify and show a fresh value.

### All-in-one ETF (if you hold one)

1. Find an all-in-one ETF in your portfolio (VBAL, VEQT, XBAL, XEQT, etc.). If you don't hold one, you can manually look one up via the ticker search.
2. The Market should classify based on its underlying ETFs — likely **Global** or **North America** depending on the fund's mandate.

### Mobile (your primary device)

1. Open the dashboard on your phone.
2. Confirm ETF rows render correctly with the new Market values.
3. Confirm the lock icon (when locked) is still tap-friendly.

---

## Trade-offs we discussed (so you have the full picture)

A few decisions you locked in during brainstorming:

- **Lazy-only, no background refresh.** The system never auto-classifies in the background. Classification runs only when you naturally touch a ticker (PDF import, refresh button, manual lookup). Saves Yahoo bandwidth, simpler design.
- **Top-10 unanimity rule, no coverage threshold.** If the top-10 holdings are unanimous within a country bucket, we classify. We don't require the top-10 to cover any particular % of the fund. The name/category guard handles the false-positive case.
- **Any-presence rule for North America.** A single Canadian holding in an otherwise-US ETF's top-10 triggers North America classification. Risk: cross-listings sneaking in. In practice this is rare, and the 3A lock fixes it in one tap. Adding a 5%-weight threshold would have introduced a magic number we'd have to defend forever.
- **1-year TTL** (your custom choice). Long enough to avoid pointless re-checking but short enough to catch genuine drift over time.
- **One level of recursion.** Handles all-in-one Canadian ETFs cleanly. Doesn't get tangled in exotic deep nesting.
- **Tooltip on Not Found ETF cells (desktop only).** Subtle hint that the system tried and couldn't classify. Nothing on mobile because the lock + manual edit affordance is enough.

---

## What happens after you approve this

1. The developer writes a step-by-step implementation plan from the technical spec.
2. The work ships in small commits to `main`, each with tests.
3. After the sprint completes, an adversarial review pass (Codex) catches any subtle regressions before the work is considered "done."
4. You'll do live QA on prod once it's deployed (per your usual workflow).
5. If anything looks off in the live test, we adjust.

When you're ready, send "approved" or "looks good" and we'll move to the implementation plan.
