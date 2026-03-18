# System Logic & Ripple Effect Manual: Investment Advisor Platform

Welcome to the definitive backend-to-business translation manual for the Investment Advisor. 

This guide is built to help non-technical users and domain experts understand exactly **how the software thinks**. We will walk through the application exactly as it appears in the navigation sidebar. For each section, we will explain the mathematical logic and the "Ripple Effect"—how a number entered in one place triggers changes across the entire system.

To make assimilation easy, we will follow a single running example throughout this guide.

> **Meet our Example User: John**
> John is a 55-year-old preparing for retirement. He has a $100,000 stock portfolio and keeps $15,000 in cash reserves. He just logged into the app.

---

## 1. Investment Advisory Board (Chat Engine)
**Code Location:** `src/app/HomeClient.tsx` & `src/app/api/chat/route.ts` & `src/lib/personas.ts`

This is the homepage of the app, featuring a conversational AI with a panel of legendary investors. Unlike a generic AI, this engine pulls your real, live financial data *before* it answers you. You select which advisors to consult per question — each brings a distinct investment philosophy and will respond in their own voice.

The five available advisors are:
- **Warren Buffett** (The Oracle of Omaha) — Value investing, economic moats, long-term holding
- **Luiz Barsi Filho** (The Dividend King) — Dividend-focused, long-term accumulation
- **Max Gunther** (The Zurich Speculator) — Calculated risk-taking, contrarian thinking
- **Morgan Housel** (The Behavioral Analyst) — Behavioral finance, compounding patience
- **Dave Ramsey** (The Debt Destroyer) — Zero debt, emergency fund, disciplined budgeting

### How it Thinks (Logic Mapping)
Before the AI even sees your typed question, the system secretly builds a "Context String" in the background. It reaches into the database and grabs:
1. **Your Profile Settings:** Strategy, Risk Tolerance, and Goals.
2. **Your Budget Status:** It calculates your `Cash Reserves` and your `Target Monthly Savings` (Total Income minus Total Expenses).
3. **Your Live Portfolio:** It takes a snapshot of exactly what stocks you own, how many, and their current value.

It pastes all of these numbers into the invisible instructions given to the selected advisors.
Only *then* does it give the AI the question you actually typed, along with a hidden tool that allows the AI to fetch real-time stock prices (via Yahoo Finance) if you mention a specific company.

### The Ripple Effect Example
Let's say John types: ***"Should I buy $20,000 worth of Tesla stock today?"***

1. The AI engine checks John's injected context and sees: **`CASH RESERVES: $15,000`**.
2. **The Logic Branch:** The system immediately flags a contradiction. The user is asking to spend $20,000, but the database says they only have $15,000 in liquid cash.
3. **The Result:** Instead of analyzing Tesla's P/E ratio, the selected advisors will immediately address the contradiction — each through their own lens. For example: *"Rule No. 1 is never lose money. You only have $15,000 in cash reserves. Never invest money you don't possess, and never leverage yourself to buy speculative auto-manufacturers."*

By wiring the Chat Engine directly to the Finance Summary, the Advisory Board acts as a true fiduciary, prioritizing liquidity over stock picking.

### Key Features You Can Ask About
- **Analyze my current Portfolio:** The selected advisors will evaluate your asset allocation based on your exact holdings — and you'll get multi-perspective commentary if you select more than one.
- **Critique my investment strategy:** Each advisor will compare your current strategy setting against your portfolio and goals through their own philosophical lens.
- **How much cash do I have?** The AI instantly checks your liquid reserves.
- **Get live stock quotes:** It will fetch real-time market data during your conversation.

---

## 2. My Investment Portfolio (Dashboard)
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
- **Totals Row:** At the bottom, it automatically sums up your Total Market Value and Total Expected Dividends across all displayed assets.

### The Ripple Effect Example
John owns 100 shares of Microsoft. The price jumps from $400 to $410. John's *Total Market Value* in the Holdings Breakdown increases by $1,000. This $1,000 increase doesn't just stay on this page—it immediately "ripples" over to the **My Finance Summary** page, instantly increasing John's calculated `Net Worth` without him typing a single thing.

---

## 3. My Finance Summary (Macroscopic Health Engine)
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
- **Asset Integrations:** Enter values for Real Estate, Cash, and Cars.
- **Synced Investment Field:** The "Investment" field is strictly read-only. It automatically pulls the sum of your *Total Market Value* directly from the **My Investment Portfolio** page.
- **Net Worth Calculation:** Total Assets minus Total Liabilities, instantly updated and saved with a timestamp.

### The Ripple Effect Example (The Ultimate Metric)
This is the master culmination of the entire app. If the stock market crashes (Section 2) AND John buys a new car on credit (Section 3 expenses), both of these negative actions cascade simultaneously into this one Net Worth number, providing a brutally honest, real-time snapshot of John's wealth.

---

## 4. My Investment Strategy (Profile Page)
**Code Location:** `src/app/profile/ProfileClient.tsx`

This page is the **Steering Wheel** for the AI. What you type here fundamentally changes the brain circuitry of the AI Guidance Engine.

### Detailed Features & Functionalities
- **Overall Investment Strategy:** A free-text area where you describe your narrative focus (e.g., "Dividend growth for passive income"). The box automatically resizes as you type.
- **Financial Goals:** Define short term and long term milestones.
- **Risk Tolerance Dropdown:** Select from Conservative, Moderate, Aggressive, or Speculative. This rigidly defines the safety margins the AI will recommend in its reports.

### The Ripple Effect Example: Risk Tolerance
Every field you fill out here is saved to the database. Whenever you use the AI anywhere else in the app, these fields are stapled to the top of your request.
- **If John sets his Risk Tolerance to `Conservative Dividend Focus`:** Later, when using AI Guidance, the AI will ONLY recommend buying dips on extremely safe, 100-year-old companies.
- **If John sets Risk Tolerance to `Aggressive Speculation`:** The AI will recommend buying distressed, highly volatile tech start-ups, explicitly ignoring safe dividend stocks. It dynamically rewires its advice based entirely on this specific page.

---

## 5. AI Guidance (Reasoning & Directive Engine)
**Code Location:** `src/app/profile/guidance/GuidanceClient.tsx`

This page is the heavy-duty analytics engine. It triggers "Directives"—highly engineered prompts that force the AI to process your Portfolio (Section 2) using your Strategy rules (Section 4).

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
  - **Monitored Fields:** Ensure you keep your data accurate across the app. The backend monitors changes to the following fields: _Investment Strategy_, _Financial Goals_, _Risk Tolerance_, and _Portfolio Assets_ (including any changes to Tickers, Shares Owned, Current Price, Total Market Value, Book Cost, or Expected Dividends).
- **Content Blurring & On-Demand Refresh:** To prevent you from acting on outdated advice, the presence of a Stale Data Warning will dynamically blur the underlying report. You can either dismiss the warning or click the **"Refresh Analysis"** button to force the AI to generate a brand new, up-to-date report. A timestamp in the header always ensures you know exactly when the current analysis was generated.

### The Ripple Effect Example: The 4-Pillar Test (Directive 4)
John inputs `IBIT` (A high-risk Bitcoin ETF). The AI pulls John's Profile (Section 4), noting he is a **Conservative near-retiree**. It simulates different expert perspectives (like Cathie Wood vs. Warren Buffett), acts as Chairman, and concludes that while the asset might go up, it **violates John's strict profile rules**. The final output firmly rejects the purchase.

---

## 6. Settings (Household Infrastructure)
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
John links his wife Mary to his Household ID in Settings. Because they share the cryptographic partition, the moment John hits "Save" on his iPad in the Portfolio page, Mary's laptop screen instantly updates. Her Net Worth calculation auto-corrects, and if she asks Warren Buffett a question in the Chat, the AI immediately knows about the new money John just added seconds ago.
