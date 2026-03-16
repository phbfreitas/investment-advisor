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
    wealthLiabilityMortgage: string;
    wealthLiabilityHeloc: string;
    wealthLiabilityRentalMortgage: string;
    wealthLiabilityRentalHeloc: string;
    wealthLiabilityCreditCards: string;
    wealthLiabilityCarLease: string;
};
