# System Logic & Ripple Effect Manual: Investment Advisor Platform

Welcome to the definitive backend-to-business translation manual for the Investment Advisor.

This guide is built to help non-technical users and domain experts understand exactly **how the software thinks**. The platform is organized into two navigation pillars:

- **My Blueprint** — Your private vault housing all static and dynamic data about your financial situation (My Investment Strategy, My Finance Summary, My Investment Portfolio).
- **Market Intelligence** — The live engine housing three distinct "voices" providing active guidance and external data (Expert Guidance, AI Guidance, Global News Guidance).

For each section, we will explain the mathematical logic and the "Ripple Effect"—how a number entered in one place triggers changes across the entire system.

To make assimilation easy, we will follow a single running example throughout this guide.

> **Meet our Example User: John**
> John is a 55-year-old preparing for retirement. He has a $100,000 stock portfolio and keeps $15,000 in cash reserves. He just logged into the app.

---

# My Blueprint

## 1. My Investment Strategy (Profile Page)
**Code Location:** `src/app/profile/ProfileClient.tsx`

This page is the **Steering Wheel** for the AI. What you type here fundamentally changes the brain circuitry of the AI Guidance Engine. It combines free-text narrative context with structured strategy configuration, giving the advisors both qualitative and quantitative understanding of your investment approach.

### Detailed Features & Functionalities

#### A. Narrative Context (Existing)
- **Overall Investment Strategy:** A free-text area where you describe your narrative focus (e.g., "Dividend growth for passive income"). The box automatically resizes as you type.
- **Financial Goals:** Define short term and long term milestones.
- **Risk Tolerance Slider:** A 1–10 numeric slider replaces the old dropdown. A score of 1 is maximally conservative; 10 is fully speculative. The selected value is passed directly to the AI, allowing it to calibrate advice with finer precision than broad category labels.

#### B. Strategy Configuration (Collapsible Sections)
Eight new structured configuration sections, each collapsible:

- **Asset Mix:** Define your target allocation between Growth, Income, and Mixed assets as percentages (must sum to 100%). A visual stacked bar chart updates in real-time as you adjust the values.
- **Investment Philosophies:** Toggle-select from 11 philosophies grouped into three categories:
  - *Value-Based:* Regular Value, Deep Value, Mispriced Special Situations, Fundamental Value
  - *Strategy-Based:* Event-Driven, Indexing, Buy the Dip, Contrarian
  - *Style-Based:* Technical Analysis, Socially Responsible, Long-term Growth
- **Core Principles:** Select guiding principles — Diversification, Discipline/Rebalancing (triggers drift alerts), and Cost Minimization.
- **Account Types:** Specify which account types you use — TFSA, RRSP, Non-Registered.
- **Trading Methodology:** Select your trading approaches — Buy and Hold, Trend Following, Value Averaging, Sector Rotation, Swing Trading.
- **Sector Allocation:** Set target percentages across 11 standard market sectors (IT, Financials, Healthcare, etc.) plus two additional options — **S&P 500** (for broad index exposure) and **Other** (for assets that don't fit a standard sector). Values must sum to 100%. The system compares your targets against your actual portfolio holdings and displays an inline **drift table** showing Target %, Actual %, and Drift % for each sector. Sectors drifting more than 5% from target are flagged with a warning.
- **Geographic Exposure:** Set target percentages across geographic regions (must sum to 100%). Three new regions have been added — **USA Only**, **Canada Only**, and **Global Mix** — alongside existing options (North America, Europe, Asia, Emerging Markets, Frontier Markets). Same drift detection applies.
- **Performance Targets:** Set your Expected Annual Return (%) and Target Monthly Dividend Income ($). The system calculates projections from your actual portfolio (weighted average 1-year return and sum of expected dividends) and compares them against your targets, flagging when targets exceed estimates.

#### C. Validation
- All percentage groups (Asset Mix, Sector Allocation, Geographic Exposure) must sum to exactly 100% before saving.
- Real-time "Remaining: X%" indicators turn green when the sum is correct and red when it's off.
- Server-side validation provides a second safety net.

### The Ripple Effect Example: Risk Tolerance + Strategy Config
Every field you fill out here is saved to the database. Whenever you use the AI anywhere else in the app, both the narrative fields AND the structured strategy config are stapled to the top of your request.
- **If John sets his Risk Tolerance to `2` (near-conservative) and selects "Buy and Hold" + "Diversification":** The AI will ONLY recommend safe, established companies with strong dividends and broad portfolio diversification.
- **If John sets Risk Tolerance to `9` (near-speculative) and selects "Swing Trading" + "Deep Value":** The AI will recommend distressed, highly volatile opportunities for short-term gains, explicitly ignoring safe dividend stocks. It dynamically rewires its advice based entirely on this page.
- **Drift Alerts:** If John sets a 20% target for Financials but his actual portfolio only has 14% in financial stocks, the drift table shows a -6% warning — reminding him to rebalance before his next purchase.

---

## 2. My Finance Summary (Macroscopic Health Engine)
**Code Location:** `src/app/finance-summary/FinanceSummaryClient.tsx`

While the Portfolio tracks the stock market, this section tracks your real-life wallet: your salary, expenses, real estate, and liabilities.

### Detailed Features & Functionalities

#### A. Budget Monthly Cashflow
Set your baseline income and expense goals to automatically calculate your target savings.
- **Income & Expense Inputs:** Enter values for Paycheck, Dividends, Fixed Home, Discretionary, etc.
- **Auto-Formatting:** Currency fields automatically add commas as you type for easy reading.
- **Auto-Calculated Savings:** As you change any income or expense field, the "Savings" panel instantly updates (Income minus Expenses).

#### B. Actual Monthly Cash Flow
A historical ledger to track your observed financial health over time.
- **Tabular Tracking:** Add rows for specific Years and Months. Enter actual Income, Expenses, and ending Cash Reserves.
- **Row Management:** You can easily add new rows via "Add Row" or remove mistakes with the red trashcan icon.

#### C. Rental Cashflow
A dedicated module to isolate income and expenses specifically related to your rental properties, calculating an isolated Net Profit / Loss.

#### D. Personal Wealth
Track your overall Net Worth by keeping all assets and liabilities up to date over time.
- **Asset Integrations:** Enter values for Real Estate, Cash, Cars, and **Other Assets** (a catch-all field for any asset not covered by other categories, such as collectibles, business interests, or personal property).
- **Synced Investment Field:** The "Investment" field is strictly read-only. It automatically pulls the sum of your *Total Market Value* directly from the **My Investment Portfolio** page.
- **Net Worth Calculation:** Total Assets minus Total Liabilities, instantly updated and saved with a timestamp.

### The Ripple Effect Example (The Ultimate Metric)
This is the master culmination of the entire app. If the stock market crashes (My Investment Portfolio) AND John buys a new car on credit (My Finance Summary expenses), both of these negative actions cascade simultaneously into this one Net Worth number, providing a brutally honest, real-time snapshot of John's wealth.

---

## 3. My Investment Portfolio (Dashboard)
**Code Location:** `src/app/dashboard/DashboardClient.tsx`

This section is the mathematical core of your individual holdings and where you manage your day-to-day assets.

### Detailed Features & Functionalities

#### A. KPI Summary Cards
At the top, three critical indicators give you an instant macroscopic view:
- **Total Market Value:** Sums the real-time value of every asset you own. It pulls live market data (indicated by a spinning loader when refreshing).
- **Total Return:** Calculates the percentage of profit or loss across your entire portfolio based on your initial Book Cost versus current Market Value.
- **Avg Dividend Yield:** Computes a weighted average of your dividend yields, ensuring large positions accurately influence the total yield metric.

#### B. The Holdings Breakdown Table
This is the interactive nerve center where every asset is dissected in detail.
- **Sorting & Filtering:** Every column header can be clicked to sort (ascending/descending). Below each header is a filter box—type a ticker like "AAPL" or a sector like "Tech" to instantly isolate specific rows.
- **Editable Inline Rows:** Click the blue pencil icon to edit any asset. The row transforms into input fields and dropdowns (Account, Security Type, Strategy Type, etc.).
- **Live Dollar Ticker Price:** When editing a ticker symbol, the system waits a second and automatically fetches the *live* current price from Yahoo Finance, eliminating manual data entry.
- **Calculated Metrics:** Columns like Market Value and Profit/Loss are automatically computed based on the Quantity, Book Cost, and the Live Ticker Price.
- **PDF Statement Import:** Upload standard brokerage statements (including native support for Wealthsimple PDFs) to automatically extract your holdings. The system intelligently matches existing assets by Ticker and Account Number, updating the `# Tickers` (Quantity), Market Value, and Book Cost, while automatically deleting old or sold tickers to perfectly sync with your statement.
- **Totals Row:** At the bottom, it automatically sums up your Total Market Value and Total Expected Dividends across all displayed assets.

#### C. Profile Page: Investment Portfolio Table
A dedicated portfolio entry table on the My Investment Strategy page provides a streamlined way to add and manage holdings:
- **Ticker Auto-Lookup:** Type a ticker symbol and the system automatically fetches the current price from Yahoo Finance — no manual price entry required.
- **Account Name Autofill:** The account name field auto-suggests based on previously used account names, speeding up data entry.
- **Auto-Calculated Fields:** Weight % (position size relative to the total portfolio), P/L (profit or loss vs. book cost), and Market Value are all computed automatically — you only enter the quantity and book cost.
- **Totals Row:** The table footer auto-sums market value, book cost, and expected dividends across all entries.
- **CSV Export:** Export your entire portfolio to a CSV file with one click for use in spreadsheets or external tools.

### The Ripple Effect Example
John owns 100 shares of Microsoft. The price jumps from $400 to $410. John's *Total Market Value* in the Holdings Breakdown increases by $1,000. This $1,000 increase doesn't just stay on this page—it immediately "ripples" over to the **My Finance Summary** page, instantly increasing John's calculated `Net Worth` without him typing a single thing.

---

## 4. Time Machine (Universal Audit Trail)
**Code Location:** `src/components/TimeMachine/TimeMachineDrawer.tsx` & `src/app/api/audit-logs/route.ts` & `src/app/api/portfolio-rollback/route.ts`

Every change to your portfolio — whether from a PDF import or a manual inline edit — is permanently recorded in a complete audit trail. The Time Machine lets you review the full history of changes and roll back to any prior state with cascade undo.

### Detailed Features & Functionalities

#### A. Automatic Audit Logging
Every portfolio mutation is captured with a full before/after snapshot:
- **PDF Import:** When you upload a brokerage statement, the system classifies every asset as Created (new ticker), Updated (changed quantity/value), or Deleted (no longer in the statement). A single audit log entry records every mutation with complete snapshots of all asset fields.
- **Manual Edit:** When you edit an asset inline (change quantity, book cost, etc.), a MANUAL_EDIT log captures the exact before and after values.
- **Manual Create/Delete:** Adding a new asset or deleting an existing one is logged with the full asset snapshot, including the Account Name and Account # for better organization.
- **Account-Level Tracking:** Every mutation now explicitly displays the `Account` and `Acct #` (Account Number) in the history timeline, ensuring you can always trace which institution or sub-account an asset belongs to.
- **Glassmorphic Toast Notification:** After every successful edit, a premium frosted-glass notification slides in from the bottom-right confirming: *"Exact snapshot secured in Audit Trail"* with a quick-link to [View History].

#### B. Visual Feedback on Dashboard
After a PDF import, the dashboard highlights affected rows with color-coded animations:
- **Created rows:** Neon-green left border with a soft glow that fades over ~4 seconds.
- **Updated rows:** Amber/gold left border with a subtle pulse that fades over ~4 seconds.
- **Deleted rows (Ghost Rows):** Assets that were removed from the portfolio are temporarily rendered as phantom rows showing their last known Ticker, Quantity, Market Value, and Book Cost with a red strikethrough animation that fades out.

#### C. Accessing the Time Machine
The Time Machine is now integrated directly into the **My Investment Portfolio** page for a more seamless experience.

- **Trigger:** Click the **"History"** button in the Portfolio dashboard header (next to Export CSV).
- **Layout:** A sleek frosted-glass drawer slides in from the right, presenting your audit trail as a visual, interactive timeline.
- **Expanded Details:** Clicking a node in the timeline reveals the expanded diff card with all specific change details.

**Timeline Nodes:** Each node represents a single audit event, styled by source type:
- *PDF Import:* Document icon with blue accent
- *Manual Edit:* Pencil icon with green accent
- *Rollback:* Rewind icon with amber accent

Each node displays the source label, a relative timestamp ("2 hours ago" with absolute time on hover), and a brief summary (e.g., "3 created, 2 updated, 1 deleted").

**Diff Cards:** Clicking a node reveals a frosted-glass card with color-coded mutations:
- **CREATE:** Green `+` prefix showing the new asset's quantity, market value, and book cost.
- **DELETE:** Red `-` prefix with strikethrough showing the asset's last known values.
- **UPDATE:** Side-by-side comparison — old values in red (strikethrough), new values in green. Only fields that actually changed are shown (quantity, market value, book cost, plus any other differing fields).

#### D. Cascade Rollback (The "Ctrl+Z")
The **"Revert to before this change"** button appears on every non-ROLLBACK entry.

- **Cascade Logic:** Clicking rollback on entry N automatically reverses entries N through the most recent in reverse chronological order. This prevents conflicts — you cannot undo a PDF import while leaving a manual edit that happened after it intact.
- **Confirmation Dialog:** Before executing, a dialog warns: *"This will undo this change and all X changes after it. Continue?"*
- **Rewind Animation:** On confirm, a full-screen overlay with a reverse-spinning rewind icon provides visual feedback during the operation.
- **Audit Integrity:** Each reversed entry generates its own ROLLBACK audit log, so the timeline never breaks — you always have a complete record of what happened and when.

**What Rollback Does Behind the Scenes:**
- If the original action CREATED an asset → Rollback DELETES it.
- If the original action DELETED an asset → Rollback RE-CREATES it with the exact original values.
- If the original action UPDATED an asset → Rollback restores the exact previous values.

#### E. Pagination & Empty State
- **Pagination:** Logs are loaded 50 at a time (newest first). A "Load more" button fetches the next page.
- **Empty State:** New users see a centered message: *"No changes recorded yet. Import a PDF or edit an asset to start building your audit trail."*

### The Ripple Effect Example
John uploads his February brokerage statement. The PDF import creates 2 new tickers, updates 3 existing ones, and deletes 1 that was sold. A single PDF_IMPORT audit log captures all 6 mutations with full before/after snapshots. On the dashboard, new rows glow green, updated rows pulse amber, and the sold ticker appears briefly as a ghost row with red strikethrough before fading out. A glassmorphic toast confirms: "Exact snapshot secured in Audit Trail."

Two days later, John manually edits XQQ from 230 to 250 shares (MANUAL_EDIT log), then realizes the February PDF was wrong — he opens the Time Machine, clicks "Revert to before this change" on the PDF import entry. The system automatically reverses the manual edit first (250 → 230), then reverses the PDF import (deleting the 2 new tickers, restoring the sold one, reverting the 3 updated ones). Three ROLLBACK entries appear in the timeline documenting exactly what was reversed.

---

# Market Intelligence

## 5. Expert Guidance (Chat Engine)
**Code Location:** `src/app/HomeClient.tsx` & `src/app/api/chat/route.ts` & `src/lib/personas.ts`

This is the homepage of the app, featuring a conversational AI with a panel of legendary investors. Unlike a generic AI, this engine pulls your real, live financial data *before* it answers you. You select which advisors to consult per question — each brings a distinct investment philosophy and will respond in their own voice.

The seven available advisors are:
- **John C. Bogle** (The Index Fund Pioneer) — Low-cost index investing, anti-active management
- **Warren Buffett** (The Oracle of Omaha) — Value investing, economic moats, long-term holding
- **Luiz Barsi Filho** (The Dividend King) — Dividend-focused, long-term accumulation
- **Benjamin Graham** (The Father of Value Investing) — Margin of safety, fundamental analysis, defensive investing
- **Max Gunther** (The Zurich Speculator) — Calculated risk-taking, contrarian thinking
- **Morgan Housel** (The Behavioral Analyst) — Behavioral finance, compounding patience
- **Robert Kiyosaki** (The Rich Dad Mentor) — Real estate, passive income, financial literacy

### Advisor Selection
The Advisory Board uses a compact **single trigger button** displaying the number of advisors currently selected (e.g., "8 Advisors Selected" or "All Advisors"). Clicking it opens a responsive grid dropdown showing all available advisors with their names, taglines, and checkmarks for selected ones. A "Select All / Deselect All" toggle sits at the top of the dropdown. This design eliminates horizontal scrolling entirely and scales cleanly as more advisors are added.

### How it Thinks (Logic Mapping)
Before the AI even sees your typed question, the system builds a comprehensive "Context String" in the background. It reaches into the database and grabs:
1. **Your Investment Strategy:** Asset mix targets, investment philosophies, core principles, account types, trading methodologies, sector/geographic allocation targets, performance targets, and risk tolerance.
2. **Your Full Finance Summary:** Monthly budget breakdown (income by source, expenses by category), target savings, cash reserves, complete wealth picture (all assets including real estate, vehicles, cash, and other), all liabilities (mortgages, HELOCs, credit cards, leases), and calculated net worth.
3. **Your Complete Portfolio Holdings:** Every position with full detail — ticker, quantity, live price, market value, book cost, P/L, yield, beta, volatility, sector, strategy type, account type, analyst consensus, 1yr/3yr returns, expected dividends, and risk flags. Plus portfolio-level totals (total market value, weighted yield, monthly dividend projection).

It pastes all of these numbers into the invisible instructions given to the selected advisors.
Only *then* does it give the AI the question you actually typed, along with a hidden tool that allows the AI to fetch real-time stock prices (via Yahoo Finance) if you mention a specific company.

### The Ripple Effect Example
Let's say John types: ***"Should I buy $20,000 worth of Tesla stock today?"***

1. The AI engine checks John's injected context and sees: **`CASH RESERVES: $15,000`**.
2. **The Logic Branch:** The system immediately flags a contradiction. The user is asking to spend $20,000, but the database says they only have $15,000 in liquid cash.
3. **The Result:** Instead of analyzing Tesla's P/E ratio, the selected advisors will immediately address the contradiction — each through their own lens. For example: *"Rule No. 1 is never lose money. You only have $15,000 in cash reserves. Never invest money you don't possess, and never leverage yourself to buy speculative auto-manufacturers."*

By wiring the Chat Engine directly to the Finance Summary, the Advisory Board acts as a true fiduciary, prioritizing liquidity over stock picking.

### Prompt Templates (Pill Buttons)
Each advisor card displays four built-in prompt templates as pill buttons in the chat area. Clicking any pill instantly populates the chat input with a fully engineered prompt tailored for that advisor's philosophy:
- **Investment Suggestions** — asks the advisor for stock or asset ideas aligned with your strategy and portfolio.
- **Financial Analysis** — requests a holistic review of your current financial position.
- **Portfolio Rebalancing** — asks the advisor to identify drift and recommend rebalancing moves.
- **Financial Health Audit** — prompts a comprehensive audit of income, expenses, savings, and net worth.

### EA Memory — Advisor Notebook
Your advisors now remember past conversations using a **Per-Advisor Structured Memory** system, surfaced as a persistent **Advisor Notebook** sidebar:

- **Per-Advisor Memory:** Each advisor builds their own independent understanding of you. Buffett's notebook reflects only conversations you've had with Buffett — he doesn't see what Housel discussed. This means each guru develops a unique perspective on your investment profile.
- **Our Journey So Far:** The centerpiece of each advisor's notebook is a warm, narrative summary of your conversations together — covering key topics, how your thinking has evolved, and the trajectory of your investment journey. This reads like an advisor recounting their relationship with you.
- **Structured Sections:** Below the narrative, each advisor's memory is organized into 5 structured sections: **Investment Thesis**, **Current Asset Focus**, **Risk Parameters**, **Active Dilemmas**, and **Key Decisions**. These are displayed as glassmorphic cards in the Advisor Notebook sidebar.
- **Two-Column Layout:** On desktop, the Advisory Board uses a two-column layout — the Advisor Notebook occupies the left 300px showing what your selected advisor knows, while the right column is your active conversation. On mobile, the Notebook opens as a slide-out drawer via the "Notebook" button.
- **Advisor Selector:** Choose an advisor from the dropdown to see their independent memory. A bullet indicator marks advisors who have active memory.
- **Progress Indicator:** For advisors you've started chatting with but haven't reached the memory threshold yet (3 exchanges), a progress bar shows how close you are to generating their first notebook entry.
- **Transcript Archive:** A "View Transcript Archive" link in the Notebook opens a date-grouped modal showing all past exchanges, expandable to see full advisor responses.
- **Memory Control:** Reset a single advisor's memory or reset all advisors at once from the Notebook footer. Chat history auto-cleans after 180 days.
- **Contextual References:** Advisors naturally reference your past decisions and preferences when relevant, but don't force references on unrelated questions. If you contradict a past decision, they'll flag it diplomatically.
- **Graceful Degradation:** If the memory system encounters any issue, the Advisory Board falls back to stateless behavior — your question is still answered, just without historical context.

### Key Features You Can Ask About
- **Analyze my current Portfolio:** The selected advisors will evaluate your asset allocation based on your exact holdings — and you'll get multi-perspective commentary if you select more than one.
- **Critique my investment strategy:** Each advisor will compare your current strategy setting against your portfolio and goals through their own philosophical lens.
- **How much cash do I have?** The AI instantly checks your liquid reserves.
- **Get live stock quotes:** It will fetch real-time market data during your conversation.
- **What did I decide last time?** With EA Memory active, the advisor will recall your prior conversations and decisions.

---

## 6. AI Guidance (Reasoning & Directive Engine)
**Code Location:** `src/app/profile/guidance/GuidanceClient.tsx`

This page is the heavy-duty analytics engine. It triggers "Directives"—highly engineered prompts that force the AI to process your Portfolio (My Investment Portfolio) using your Strategy rules (My Investment Strategy).

### Detailed Features & Functionalities
The page features six targeted AI Directives, each acting as a distinct analytical report:
1. **Rebalance with Precision:** Identifies asset allocation drifts.
2. **Optimize Dividend Growth:** Suggests moves to increase cash flow.
3. **Maintain Tactical Aggression:** Highlights 'Buy the Dip' opportunities.
4. **Investment Idea Evaluation:** A rigorous 4-pillar analysis for a specific new asset. *Clicking this opens an input box requiring you to enter a specific ticker symbol (e.g., AAPL) before analyzing.*
5. **Portfolio Report:** Multi-factor analysis highlighting strengths and weaknesses.
6. **Stock Recommendations:** Agent recommendations based on expert opinions.

- **Live Streaming Interface:** When a report is triggered, an elegant modal opens, and the AI's response is streamed live to the screen, formatted in rich Markdown (tables, bold text, lists) for immediate readability.
- **Intelligent Caching:** To maximize speed and minimize API costs, the system caches every generated report. If you open a previously generated directive, it will load instantly exactly as it was.
- **Stale Data Warnings:** The system takes a fingerprint snapshot of your Portfolio and Strategy whenever an analysis is generated. If you change your holdings or risk tolerance and then open a cached report, you will be greeted by an Amber Warning Banner explicitly listing which underlying data fields have changed since the last run.
  - **Monitored Fields:** Ensure you keep your data accurate across the app. The backend monitors changes to the following fields: _Investment Strategy_, _Financial Goals_, _Risk Tolerance_, _Strategy Configuration_ (Asset Mix, Philosophies, Principles, Account Types, Trading Methodology, Sector/Geographic Targets, Performance Targets), and _Portfolio Assets_ (including any changes to Tickers, Shares Owned, Current Price, Total Market Value, Book Cost, or Expected Dividends).
- **Content Blurring & On-Demand Refresh:** To prevent you from acting on outdated advice, the presence of a Stale Data Warning will dynamically blur the underlying report. You can either dismiss the warning or click the **"Refresh Analysis"** button to force the AI to generate a brand new, up-to-date report. A timestamp in the header always ensures you know exactly when the current analysis was generated.

### The Ripple Effect Example: The 4-Pillar Test (Directive 4)
John inputs `IBIT` (A high-risk Bitcoin ETF). The AI pulls John's Profile (My Investment Strategy), noting he is a **Conservative near-retiree**. It simulates different expert perspectives (like Cathie Wood vs. Warren Buffett), acts as Chairman, and concludes that while the asset might go up, it **violates John's strict profile rules**. The final output firmly rejects the purchase.

---

## 7. Global News Guidance (Geopolitical Radar)
**Code Location:** `src/app/global-radar/GlobalRadarClient.tsx` & `src/app/api/global-radar/route.ts`

This page connects real-world geopolitical and macroeconomic news to your portfolio. It fetches live financial headlines daily and uses AI to analyze how world events impact your specific strategy, identify panic-driven buying opportunities, and stress-test your total net worth.

### Detailed Features & Functionalities
The page features five targeted analyses, one master synthesis, and one total integration view:

1. **Net Worth Stress Test:** Assesses total financial health (liquid + real estate) against this week's macro events.
2. **Deep Buy Scanner:** Finds panic-driven value opportunities using 3 criteria: non-fundamental price drops, selling exhaustion signals, and below-average valuations.
3. **Opportunity Cost Evaluator:** Identifies "dead money" sectors and suggests strategic rotations based on shifting macro regimes.
4. **Cross-Sectional Impact Report:** Maps weekly news (rates, conflicts, energy) to your Growth/Mix/Dividend allocation.
5. **Full Strategy Critic:** Compares your portfolio against global asset classes (S&P 500, TSX, Bonds, Commodities) and critiques exposure gaps.
6. **Deep Critique:** Runs all 5 analyses in parallel, then synthesizes them into a single executive report with Top 3 Actions, Top 3 Deep Buy Stocks, Single Biggest Risk, and Strategic Outlook.
7. **Total Integration (News + Strategy + Portfolio):** Analyzes each major news item in Economics, Business, and Politics against your specific holdings. For every headline it delivers: *The Fact* (2-sentence summary), *The 'So What?'* (macro/sector relevance), *Impact on My Portfolio* (which of your ETFs and stocks are affected), and *Connection to Strategy* (whether to rebalance Dividend vs. Growth or buy/sell specific tickers). Closes with a *Daily Verdict* of priority actions.

- **Live News Integration:** Headlines are fetched daily from NewsData.io covering interest rates, inflation, energy, commodities, geopolitical events, and central bank policy. News is cached globally (shared across all users) to conserve API quota.
- **Intelligent Caching & Stale Warnings:** Analyses are cached per-household and fingerprinted against your portfolio, strategy, *and* the news date. If any of these change, a Stale Data Warning appears with the report blurred until you refresh.
- **Deep Critique Progress Tracking:** When running the Deep Critique, a real-time checklist shows each of the 5 sub-analyses completing with checkmarks. Failed analyses are gracefully noted and excluded from synthesis. Once all complete, the unified executive report streams in.

### The Ripple Effect Example: The Deep Critique
John clicks the **Deep Critique** card on a Monday morning after a turbulent week in global markets. The system fires 5 parallel AI analyses, each examining a different dimension of John's portfolio against the latest headlines. A live checklist shows progress. Once all 5 complete, the AI synthesizes everything into a single-page report listing the Top 3 Immediate Actions, Top 3 Deep Buy Stocks of the Week, the Single Biggest Risk, and a Strategic Outlook — all grounded in real news and John's actual holdings.

---

## 8. Settings (Household Infrastructure)
**Code Location:** `src/app/settings/SettingsClient.tsx`

This section handles the app's multi-tenant architecture, security, and aesthetics.

### Detailed Features & Functionalities

#### A. Appearance
- **Theme Toggles:** Instantly switch between Light, Dark, or System themes. The UI provides a real-time preview context noting which theme is actively applied.

#### B. Account & Security
- **Identity Display:** Shows the currently authorized email identity.
- **Perfect Segregation:** Confirms that all data is cryptographically isolated to your unique Household ID in the database.

#### C. Household Settings
- **Household Management:** Create or join a household using secure alphanumeric ID codes.
- **Shared Access:** Allows you to invite spouses or financial planners into your cryptographic partition, securely sharing data.

### The Ripple Effect Example
John links his wife Mary to his Household ID in Settings. Because they share the cryptographic partition, the moment John hits "Save" on his iPad in the Portfolio page, Mary's laptop screen instantly updates. Her Net Worth calculation auto-corrects, and if she asks a question on the Advisory Board, the AI immediately knows about the new money John just added seconds ago.
