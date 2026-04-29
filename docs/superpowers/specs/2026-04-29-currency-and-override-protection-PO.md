# What's Coming: Currency Fix + "My Overrides Stick"

**For:** the Product Owner (you!)
**Date:** April 29, 2026
**Companion document:** A more technical version exists for the developer at `2026-04-29-currency-and-override-protection-design.md`. This one explains everything in plain English so you can review the user-visible behavior before we build it.

---

## What's broken today

You raised two related problems. Here's what each one looks like right now:

### Problem 1 — When you upload a TFSA PDF, the wrong currency gets stamped on everything

Your TFSA holds both Canadian-dollar funds and U.S.-dollar funds. When you upload the brokerage statement, the app currently looks at the *whole document* once, decides "this looks Canadian," and stamps **CAD** on every row — including the U.S. holdings. So a USD-priced ETF ends up as CAD on the dashboard, throwing off the math.

You confirmed this with a screenshot showing both currencies on the same statement, all imported as CAD.

### Problem 2 — Every ticker refresh wipes out the corrections you made

When you manually fix a classification — say, changing a fund's sector to "Diversified" because Yahoo got it wrong, or marking an ETF as a covered-call fund — the next time the app looks up that ticker (refresh or PDF re-import), Yahoo's value comes back and silently overwrites your fix. There's no way to tell the system "this one is mine, leave it alone."

It's frustrating because you have to keep re-doing the same corrections after every refresh.

---

## What we're building

Two changes that pair naturally:

1. **The PDF parser learns to read currency one row at a time.** It looks for currency markers near each holding — section headers like "Canadian Dollar Holdings" or "U.S. Dollar Holdings", or inline tags like "USD" right next to a price. Only when neither is present does it fall back to the document-level guess.

2. **Fields you set by hand get a "lock" that follows them everywhere.** When you change a value yourself, the system marks it as yours. After that, no Yahoo lookup, no PDF re-import, no refresh will overwrite it — until *you* explicitly unlock it.

---

## What you'll see on the dashboard

### A small lock icon next to fields you've changed

After this ships, the moment you edit one of these eight fields…

- **Sector** (e.g., Healthcare, Diversified)
- **Market** (USA, Canada, North America, Global, Not Found)
- **Type** (Company, ETF, Fund)
- **Strategy Type** (Dividend, Growth, Mix)
- **Call** (Yes, No — covered-call fund)
- **Mgmt Style** (Active, Passive, N/A)
- **Currency** (USD, CAD)
- **Mgmt Fee**

…a tiny lock icon appears next to the value. That's the system telling you: *"I see that you set this. I won't change it."*

The icon only shows up on fields you've locked. Untouched fields look exactly the same as today — no extra clutter.

### How to unlock a field

If you change your mind and want Yahoo to populate that field again, **tap the lock icon**. The icon disappears. The next time the system looks up that ticker, it'll write whatever Yahoo says.

Two places this works:
- **In the table directly** — tap the lock icon on a row to unlock without entering edit mode.
- **In the edit form** — same icon, same behavior.

---

## How it behaves in different situations

| You do this… | …and this happens |
|---|---|
| Change the sector by hand | The field locks. Lock icon appears. |
| Change the sector and then change it again | Stays locked at the latest value. |
| Pick "Not Found" from a dropdown to clear a field | Still locks (at "Not Found"). The system records "you deliberately removed Yahoo's value." |
| Tap the lock icon on a locked field | Unlocks. Yahoo will be allowed to fill it again on the next refresh. |
| Run a single-ticker lookup | Locked fields don't change. Unlocked fields update from Yahoo. |
| Re-import the same TFSA PDF next month | Currency stays as you locked it. Other locked fields stay too. New holdings come in with their own auto-detected currency. |
| Add a brand-new holding | Nothing is locked yet — the first edit by you will lock that field. |

The rule is simple: **if you've touched it, the system protects it. Tap the lock to release it.**

---

## What about the currency fix specifically?

When you re-import your TFSA statement after this ships, here's what changes:

1. The parser scans for headers like "Canadian Dollar Holdings" and "U.S. Dollar Holdings". Rows under each header get the right currency.
2. If there's no section header but a row has "USD" or "CAD" right next to its price/value, that wins.
3. Only if neither signal is present does the parser fall back to its old document-level guess.

For your TFSA where both currencies are clearly grouped: every row should now end up with the correct currency on import. No more manual fixes.

If you've already manually fixed a currency on an existing holding (locking it), that lock keeps protecting it on every future re-import.

---

## What stays exactly the same

To keep your mental model clean, here's what we're **not** changing:

- **Live market data** (prices, yields, returns, dividends, betas) — these are still refreshed every time. You can't "lock" a price; that would defeat the point of having live prices.
- **Computed values** (Market Value, Profit/Loss, Expected Annual Dividends) — these come from formulas. They update whenever their inputs do. No lock concept.
- **The dashboard layout, charts, breakdown tab, sticky columns** — all unchanged.
- **The mobile bottom-nav, the new collapsible sidebar** (sub-project 3B) — all unchanged.
- **Existing assets you've already imported** — they don't have any locks yet, and that's fine. The first time you edit one, that field becomes locked.

---

## What happens to assets that already exist

You don't need to do anything. Existing rows simply have no locks. The first time you edit any of the 8 fields, that field becomes locked — same as if it were a brand-new asset.

No data migration, no batch update, no "please review your old holdings." It just starts working from the moment we ship.

---

## How to test this once it's deployed

When the change is live, here's a checklist of things to try:

### Currency fix (item 1.4)
1. Re-upload your TFSA PDF (the one with mixed CAD + USD).
2. Check that USD-priced holdings show currency **USD** in the table, and CAD-priced holdings show **CAD**.
3. Compare against last month's import where everything was tagged CAD.

### Manual override protection (item 1.3)
1. On any holding, change the **sector** to something different (e.g., "Diversified" if Yahoo had it as something else).
2. Confirm a small lock icon appears next to the sector value in the table.
3. Tap "Refresh" or run a single-ticker lookup on that holding.
4. Confirm the sector value did NOT change. The lock icon should still be visible.
5. Repeat with **Call**, **Strategy Type**, **Currency** — all should behave the same.
6. Tap the lock icon on a locked field. It should disappear.
7. Run a refresh again. The field should now update from Yahoo.

### Mobile (this is your primary device)
1. Open the dashboard on your phone.
2. Confirm the lock icons fit in the cells without breaking the row layout.
3. Tap a lock icon — make sure the tap target is big enough to hit reliably.

---

## Trade-offs we discussed (so you have the full picture)

A few choices we made that you should know about:

- **Locks are implicit (any edit locks).** We considered an explicit "lock this field" toggle that you'd click *before* editing — but that's two clicks for every change, and you'd forget. Implicit + lock icon = the system protects you without ceremony.
- **The lock icon only appears when something is locked.** We considered showing a faded lock icon on every cell so you'd always know the affordance is there. But it would clutter the table on mobile, and the visible-only-when-needed pattern is the smaller footprint.
- **Clearing a field to "Not Found" still locks it.** We could have made "clear" mean "let Yahoo refill this." But that creates a quiet exception to the rule. With a single rule (any edit locks; tap icon to unlock), there's nothing to remember.
- **PDF re-imports respect locks too.** No "PDF data always wins" exception. Once you've said it's yours, it's yours — even on a fresh broker statement. If you want the broker's currency value to take over, unlock the field and re-import.

---

## Questions for you to answer before we build

If anything in here surprises you or feels wrong, let me know now — easier to change the design than to rebuild after it ships.

A few specific things to confirm:

1. **Eight lockable fields — too many? Too few?** The list is: sector, market, securityType, strategyType, call, managementStyle, currency, managementFee. Anything you'd add or drop?
2. **Lock icon visibility** — happy with "only shows when locked"? Or do you want a faint icon always visible so you don't forget the feature exists?
3. **Tap target on mobile** — is one tap on the icon enough to unlock, or do you want a confirmation ("Are you sure you want to unlock this?") to prevent accidental taps?
4. **The currency parser's section-header detection** — if your brokerage uses a different phrasing than "Canadian Dollar Holdings" (e.g., "CAD Securities", "Canadian Account"), let us know so the parser can match it.

---

## What happens after you approve this

1. The developer writes a step-by-step implementation plan from the technical spec.
2. The work ships in small commits to `main`, each with tests.
3. You'll do live QA on prod once it's deployed (per your usual workflow).
4. If anything looks off in the live test, we adjust.

When you're ready, send "approved" or "looks good" and we'll move to the implementation plan.
