# User Guide - Investment Advisor Portfolio Manager

This guide details the methodology and classification system used by this advisor, specifically for managing a diversified portfolio of ETFs and Equities.

## 📈 Portfolio Classification Engine

The system uses a strict, rules-based decision tree to categorize assets. This approach prioritizes quantitative data (Yield and 3-Year Beta) from Yahoo Finance to ensure 100% alignment with your investment philosophy.

### 🌳 Classification Hierarchy

| Category | Philosophy | Yield Threshold | Required Condition |
| :--- | :--- | :--- | :--- |
| **Pure Growth** | Long-term capital appreciation. | 0.0% - 2.0% | Index (S&P/Nasdaq) or Growth Keywords. |
| **Pure Dividend**| High-quality income & stability. | 2.1% - 8.0% | **Beta < 1.0** + Dividend/Stability Keywords. |
| **The Mix** | High yield or tactical exposure. | > 8.0% | Options, CC, or Yield Enhancement terms. |
| **The Mix** | Hybrid risk / growth-income. | 2.1% - 8.0% | **Beta >= 1.0**. |

---

## 🏗️ Strategy Definitions

### 1. Pure Growth (Crescimento Puro)
*   **Goal**: Maximum capital gain with minimum emphasis on current cash flow.
*   **Asset Type**: Broad market index ETFs (e.g., VFV, QQQ) or non-dividend paying growth stocks.
*   **Selection Rule**: If Yield is < 2%, the system validates against a "Growth/Index" keyword list.

### 2. Pure Dividend (Dividendos Puros)
*   **Goal**: Sustainable, high-quality cash flow with lower-than-market volatility.
*   **Asset Type**: Traditional "Dividend Aristocrats," REITs, Utilities, and major Financial Institutions (e.g., Bank of Nova Scotia, Manulife).
*   **Selection Rule**: If Yield is between 2.1% and 8% and the **3-Year Beta is < 1.0**, it is classified here.

### 3. The Mix / Hybrids (O Mix)
*   **Goal**: High current income (often via derivative strategies) or aggressive market exposure.
*   **Asset Type**: Covered Call ETFs (e.g., JEPQ, HDIV), high-yield closed-end funds (e.g., CLM), or tactical sector bets with higher volatility.
*   **Selection Rule**: Automatically selected for yields > 8% or if beta exceeds 1.0 for mid-yield assets.

---

## 🛡️ Data Synchronization

The system employs a **"Gold Standard" Deduplication Logic** when importing brokerage statements:
1.  **Ticker Resolution**: Automatically detects Canadian assets (appending `.TO` if needed).
2.  **Metadata Freshness**: Fetches real-time price, yield, and beta for every import.
3.  **Conflict Prevention**: Matches assets by Ticker + Account ID to prevent duplication.
4.  **Pruning**: Redundant or manually tracked records that contradict the latest official statement are flagged for removal.
