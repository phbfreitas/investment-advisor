export interface Asset {
    PK: string;
    SK: string;
    id: string;
    profileId: string;
    type: "ASSET";
    account: string;
    ticker: string;
    securityType: string;
    strategyType: string;
    call: string;
    sector: string;
    market: string;
    currency: string;
    managementStyle: string;
    externalRating: string;
    managementFee: number;
    quantity: number;
    liveTickerPrice: number;
    bookCost: number;
    marketValue: number;
    profitLoss: number;
    yield: number;
    oneYearReturn: number;
    fiveYearReturn: number;
    threeYearReturn: number;
    exDividendDate: string;
    analystConsensus: string;
    beta: number;
    riskFlag: string;
    accountNumber: string;
    accountType: string;
    risk: string;
    volatility: number;
    expectedAnnualDividends: number;
    updatedAt: string;
}

export interface MarketData {
    ticker: string;
    longName: string | null;
    currentPrice: number;
    currency: string;
    dayChange: number;
    dayChangePercent: number;
    fiftyTwoWeekHigh: number;
    fiftyTwoWeekLow: number;
    marketCap: number;
    trailingPE: number | null;
    forwardPE: number | null;
    dividendYield: number | null;
    error?: string;
}

export interface PersonaResponse {
    personaId: string;
    status: "success" | "error";
    content: string;
}

export interface ChatExchange {
    PK: string;
    SK: string;
    userMessage: string;
    selectedPersonas: string[];
    responses: PersonaResponse[];
    ttl: number;
    entityType: "CHAT";
}

export interface ChatSummary {
    PK: string;
    SK: string;
    summary: string;
    personaId: string;
    lastExchangeTimestamp: string;
    exchangeCount: number;
    updatedAt: string;
    entityType: "CHAT_SUMMARY";
}

export type PersonaSummaryInfo = {
    text: string;
    exchangeCount: number;
    lastUpdated: string;
} | null;

export type PersonaSummaryMap = Record<string, PersonaSummaryInfo>;

export interface HouseholdUser {
    PK: string;
    SK: string;
    email: string;
    householdId: string;
    role: "ADMIN" | "MEMBER";
    updatedAt?: string;
}

export type BudgetData = {
    budgetPaycheck: string;
    budgetDividends: string;
    budgetBonus: string;
    budgetOtherIncome: string;
    budgetFixedHome: string;
    budgetFixedUtilities: string;
    budgetFixedCar: string;
    budgetFixedFood: string;
    budgetDiscretionary: string;
};

export type RentalData = {
    budgetRentalIncome: string;
    budgetRentalExpenses: string;
};

export type WealthData = {
    wealthAssetCash: string;
    wealthAssetCar: string;
    wealthAssetPrimaryResidence: string;
    wealthAssetRentalProperties: string;
    wealthAssetOther: string;
    wealthLiabilityMortgage: string;
    wealthLiabilityHeloc: string;
    wealthLiabilityRentalMortgage: string;
    wealthLiabilityRentalHeloc: string;
    wealthLiabilityCreditCards: string;
    wealthLiabilityCarLease: string;
};

// --- Strategy Configuration ---

export interface StrategyConfig {
    // Asset Mix (must sum to 100)
    assetMixGrowth: number;
    assetMixIncome: number;
    assetMixMixed: number;

    // Multi-select philosophy/principle/account/methodology
    philosophies: string[];
    corePrinciples: string[];
    accountTypes: string[];
    tradingMethodologies: string[];

    // Portfolio Constraints (each must sum to 100)
    sectorAllocation: Record<string, number>;
    geographicExposure: Record<string, number>;

    // Risk Profile
    riskTolerance: number; // 1–10

    // Performance Targets
    targetAnnualReturn: number;
    targetMonthlyDividend: number;
}

// --- Predefined Option Constants ---

export const PHILOSOPHY_OPTIONS = [
    { value: "regular-value", label: "Regular Basic Value", group: "value" as const },
    { value: "deep-value", label: "Deep Value", group: "value" as const },
    { value: "mispriced-situations", label: "Mispriced Special Situations", group: "value" as const },
    { value: "fundamental-value", label: "Fundamental Value", group: "value" as const },
    { value: "event-driven", label: "Event-Driven", group: "strategy" as const },
    { value: "indexing", label: "Indexing", group: "strategy" as const },
    { value: "buy-the-dip", label: "Buy the Dip", group: "strategy" as const },
    { value: "contrarian", label: "Contrarian", group: "strategy" as const },
    { value: "technical-analysis", label: "Technical Analysis", group: "style" as const },
    { value: "socially-responsible", label: "Socially Responsible", group: "style" as const },
    { value: "long-term-growth", label: "Long-term Growth", group: "style" as const },
];

export const CORE_PRINCIPLE_OPTIONS = [
    { value: "diversification", label: "Diversification", description: "Spread risk across asset classes and sectors" },
    { value: "discipline-rebalancing", label: "Discipline / Rebalancing", description: "Trigger alerts when targets drift" },
    { value: "cost-minimization", label: "Cost Minimization", description: "Minimize fees, commissions, and tax drag" },
];

export const ACCOUNT_TYPE_OPTIONS = [
    { value: "registered-tfsa", label: "TFSA" },
    { value: "registered-rrsp", label: "RRSP" },
    { value: "non-registered", label: "Non-Registered" },
];

export const TRADING_METHODOLOGY_OPTIONS = [
    { value: "buy-and-hold", label: "Buy and Hold" },
    { value: "trend-following", label: "Trend Following" },
    { value: "value-averaging", label: "Value Averaging" },
    { value: "sector-rotation", label: "Sector Rotation" },
    { value: "swing-trading", label: "Swing Trading" },
];

export const SECTOR_KEYS = [
    "it", "financials", "healthcare", "consumer-discretionary",
    "communication-services", "industrials", "staples",
    "energy-utilities", "real-estate", "materials", "metals",
    "sp500", "other",
] as const;

export const SECTOR_LABELS: Record<string, string> = {
    "it": "IT",
    "financials": "Financials",
    "healthcare": "Healthcare",
    "consumer-discretionary": "Consumer Discretionary",
    "communication-services": "Communication Services",
    "industrials": "Industrials",
    "staples": "Staples",
    "energy-utilities": "Energy & Utilities",
    "real-estate": "Real Estate",
    "materials": "Materials",
    "metals": "Metals",
    "sp500": "S&P 500",
    "other": "Other",
};

export const GEO_KEYS = ["na", "europe", "asia", "em", "frontier", "usa", "canada", "globalMix"] as const;

export const GEO_LABELS: Record<string, string> = {
    "na": "North America",
    "europe": "Europe",
    "asia": "Asia",
    "em": "Emerging Markets",
    "frontier": "Frontier Markets",
    "usa": "USA Only",
    "canada": "Canada Only",
    "globalMix": "Global Mix",
};

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

export const STRATEGY_CONFIG_DEFAULTS: StrategyConfig = {
    assetMixGrowth: 0,
    assetMixIncome: 0,
    assetMixMixed: 0,
    philosophies: [],
    corePrinciples: [],
    accountTypes: [],
    tradingMethodologies: [],
    sectorAllocation: {},
    geographicExposure: {},
    riskTolerance: 5,
    targetAnnualReturn: 0,
    targetMonthlyDividend: 0,
};
