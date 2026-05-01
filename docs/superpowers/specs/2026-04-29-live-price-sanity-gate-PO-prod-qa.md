# Prod QA Script: Live-Price `?` Flag + Concentration Sum

**For:** the Product Owner (you!)
**Date:** April 30, 2026
**Time needed:** about 5 minutes total
**Where to do it:** straight on prod, on your phone (or laptop — both work)

---

## What just shipped

Two things you can check today:

1. **A small grey `?` next to a Live $ value** when a price refresh comes back >10% different from what we had stored. It's a passive flag — the new price still applies, it just tells you "this is a big jump, you may want to glance and confirm." Tap it for a tooltip showing the prior price and the percentage change.
2. **The Top 10 Holdings chart now shows the summed concentration.** The title used to say `Top 10 Holdings`. It now says `Top N Holdings · X.X% of portfolio` (where N adapts to however many holdings you have, and X.X is the sum of their percentages).

Both ship together as Phase 5 sub-project 5G.

---

## Test 1: Concentration Sum (10 seconds)

This one's easy.

1. Open the dashboard, go to the **Breakdown** tab.
2. Find the **Top 10 Holdings** chart.
3. Look at its title.
4. Confirm: it now reads something like `Top 10 Holdings · 73.2% of portfolio` (your actual percentage will differ).
5. If the percentage looks roughly right (sum of the bars in the chart), you're done.

**If you see something off:** message me with what the title actually says and what you expected.

---

## Test 2: Live-Price `?` Flag (about 3 minutes)

This one needs a deliberate setup because the real bug (Yahoo serving wrong prices) is unpredictable. We're going to *fake* a wrong price on one of your holdings, refresh, confirm the flag appears, then put the price back. Three steps.

### Step 1 — Pick a holding and note its current Live $

Open the **Holdings** tab. Pick any one of your holdings — something not too volatile, like **COST** or **CM**, works well.

Write down its current **Live $** value. Example: COST shows `$996.43`.

### Step 2 — Cut its Live $ in half and save

1. Tap the row to enter edit mode.
2. Find the **Live $** field (column 14 in the table — the green-coloured one).
3. Change the value to about **half** of what it was. For COST at $996.43, set it to `498`.
4. Save the row.

The row now displays your halved value as the Live $. (This temporarily makes one holding's market value look wrong; we'll fix it in Step 4.)

### Step 3 — Hit Refresh and confirm the `?` appears

1. Click the global **Refresh** button (top of the dashboard).
2. Wait a second for the prices to come back from Yahoo.
3. Look at the same row. The Live $ should now show the *real* price again (Yahoo just overwrote your halved value).
4. **Important:** next to the price, you should see a small grey **`?`** icon.
5. Hover (desktop) or tap (phone) the `?`. A tooltip should appear reading something like:
   `Changed from $498.00 (+100.0%)`
6. ✅ If the `?` and tooltip appear, the feature works.

If you don't see the `?` after refresh, or the tooltip text is wrong, message me with a screenshot.

### Step 4 — Put the price back

The Live $ value will auto-correct itself on the next price refresh anyway (Yahoo will keep overwriting whatever you typed), so technically you don't have to do anything. But if you'd rather be tidy:

1. Tap the row to enter edit mode again.
2. Set Live $ back to the original value you wrote down in Step 1.
3. Save.

Or just hit Refresh once more — Yahoo's value will replace it.

---

## Mobile check

Since you mostly use the app on your phone, please also do Test 2 once on mobile:

- Confirm the `?` icon fits in the row without breaking the table layout.
- Confirm tapping the icon shows the tooltip cleanly (it should appear above or beside the icon, not get cut off).
- The tap target around the `?` should feel reachable — not so tiny you have to zoom.

---

## What to expect in normal everyday use

Once Test 2 passes, you don't need to do anything else proactively. Just use the app normally. Two things will happen:

- **Real price bugs (the kind you saw on April 28) will now show up as a `?` next to the affected ticker.** You'll glance at them, decide if the value seems reasonable, and either accept or manually fix.
- **Behind the scenes, every flag triggers a forensic log entry** — full Yahoo response, your prior price, the new price, the timestamp. We don't surface this to you anywhere, but next time you report "the price was wrong on date X for ticker Y," I can pull the exact data and pin down what Yahoo returned. That's the real long-term value of this feature.

---

## What's NOT changing

To keep your mental model clean:

- **Price refreshes still happen the same way.** One click of Refresh, all tickers update. The flag is purely additive.
- **No new modals, no accept/reject prompts.** Per your earlier feedback ("nightmare accepting everything"), the flag is silent and passive.
- **All other dashboard behavior is identical.** Charts, totals, breakdown tab, sticky columns, the existing lock icons from sub-project 3A — all unchanged.

---

## When something looks wrong

If during Test 2:

- The `?` doesn't appear after a half-price → refresh sequence
- The tooltip shows the wrong prior price or wrong percentage
- The `?` appears on the wrong row
- The `?` gets stuck (still visible after a refresh that should have cleared it)
- On mobile, the `?` causes layout issues

…send me a screenshot and a sentence about what you did. That's all I need to debug.

---

## One more thing — a heads-up on the Wealthsimple currency thing

The earlier sub-project 3A (currency + manual-override protection) is mostly in, but I noticed our Wealthsimple section-header detection doesn't match the wording your statements actually use ("Canadian Equities and Alternatives" / "US Equities and Alternatives" instead of "Canadian Dollar Holdings" / "US Dollar Holdings"). I'm landing a small follow-up patch for that **before** you re-import a new Wealthsimple PDF. Otherwise USD assets like VGT and COST will still get tagged as CAD on import and the live-price `?` could fire on currency-conversion ghosts instead of real Yahoo bugs.

That patch is small (~10 lines) and lands on the existing 3A branch. I'll let you know when it's in. Until then, Test 2 above with a holding you've manually verified works fine — just hold off on a fresh PDF import until the patch lands.
