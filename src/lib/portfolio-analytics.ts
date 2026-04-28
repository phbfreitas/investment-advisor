import type { Asset, StrategyConfig } from "@/types";
import {
    PHILOSOPHY_OPTIONS,
    CORE_PRINCIPLE_OPTIONS,
    ACCOUNT_TYPE_OPTIONS,
    TRADING_METHODOLOGY_OPTIONS,
    SECTOR_LABELS,
    GEO_LABELS,
    RISK_TOLERANCE_LABELS,
} from "@/types";

// --- Normalization Maps ---

export const SECTOR_NORMALIZE_MAP: Record<string, string> = {
    "Information Technology": "it",
    "Technology": "it",
    "Tech": "it",
    "Financials": "financials",
    "Financial Services": "financials",
    "Financial": "financials",
    "Healthcare": "healthcare",
    "Health Care": "healthcare",
    "Consumer Discretionary": "consumer-discretionary",
    "Communication Services": "communication-services",
    "Telecom": "communication-services",
    "Industrials": "industrials",
    "Industrial": "industrials",
    "Consumer Staples": "staples",
    "Staples": "staples",
    "Energy": "energy-utilities",
    "Utilities": "energy-utilities",
    "Energy & Utilities": "energy-utilities",
    "Real Estate": "real-estate",
    "REIT": "real-estate",
    "Materials": "materials",
    "Basic Materials": "materials",
    "Metals": "metals",
    "Precious Metals": "metals",
    "Mining": "metals",
    "s&p 500": "sp500",
    "s&p500": "sp500",
    "sp500": "sp500",
    "index": "sp500",
    "other": "other",
};

export const GEO_NORMALIZE_MAP: Record<string, string> = {
    "US": "usa",
    "USA": "usa",
    "Canada": "canada",
    "CA": "canada",
    "North America": "na",
    "Global": "globalMix",
    "Global Mix": "globalMix",
    "UK": "europe",
    "Germany": "europe",
    "France": "europe",
    "Switzerland": "europe",
    "Europe": "europe",
    "Japan": "asia",
    "China": "asia",
    "Hong Kong": "asia",
    "Australia": "asia",
    "Asia": "asia",
    "Brazil": "em",
    "India": "em",
    "Mexico": "em",
    "South Korea": "em",
    "Emerging Markets": "em",
};

// --- Drift Calculation ---

export interface DriftEntry {
    key: string;
    label: string;
    target: number;
    actual: number;
    drift: number;
    warning: boolean;
}

export interface DriftResult {
    sectorDrift: DriftEntry[];
    geoDrift: DriftEntry[];
    unclassifiedCount: number;
}

const DRIFT_WARNING_THRESHOLD = 5;

export function calculatePortfolioDrift(
    targetSectors: Record<string, number>,
    targetGeo: Record<string, number>,
    assets: Asset[]
): DriftResult {
    const validAssets = assets.filter((a) => a.marketValue > 0);
    const totalValue = validAssets.reduce((sum, a) => sum + a.marketValue, 0);

    let unclassifiedCount = 0;
    const sectorActuals: Record<string, number> = {};
    const geoActuals: Record<string, number> = {};

    for (const asset of validAssets) {
        const sectorKey = SECTOR_NORMALIZE_MAP[asset.sector];
        if (sectorKey) {
            sectorActuals[sectorKey] = (sectorActuals[sectorKey] || 0) + asset.marketValue;
        } else if (asset.sector) {
            unclassifiedCount++;
        }

        const geoKey = GEO_NORMALIZE_MAP[asset.market];
        if (geoKey) {
            geoActuals[geoKey] = (geoActuals[geoKey] || 0) + asset.marketValue;
        }
    }

    const sectorDrift: DriftEntry[] = Object.entries(targetSectors).map(([key, target]) => {
        const actualValue = sectorActuals[key] || 0;
        const actual = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
        const drift = actual - target;
        return {
            key,
            label: SECTOR_LABELS[key] || key,
            target,
            actual: Math.round(actual * 10) / 10,
            drift: Math.round(drift * 10) / 10,
            warning: Math.abs(drift) > DRIFT_WARNING_THRESHOLD,
        };
    });

    const geoDrift: DriftEntry[] = Object.entries(targetGeo).map(([key, target]) => {
        const actualValue = geoActuals[key] || 0;
        const actual = totalValue > 0 ? (actualValue / totalValue) * 100 : 0;
        const drift = actual - target;
        return {
            key,
            label: GEO_LABELS[key] || key,
            target,
            actual: Math.round(actual * 10) / 10,
            drift: Math.round(drift * 10) / 10,
            warning: Math.abs(drift) > DRIFT_WARNING_THRESHOLD,
        };
    });

    return { sectorDrift, geoDrift, unclassifiedCount };
}

// --- Performance Projections ---

export interface PerformanceEstimates {
    estimatedAnnualReturn: number;
    estimatedMonthlyDividend: number;
}

export function calculatePerformanceEstimates(assets: Asset[]): PerformanceEstimates {
    const validAssets = assets.filter((a) => a.marketValue > 0);
    const totalValue = validAssets.reduce((sum, a) => sum + a.marketValue, 0);

    if (totalValue === 0) {
        return { estimatedAnnualReturn: 0, estimatedMonthlyDividend: 0 };
    }

    const weightedReturn = validAssets.reduce(
        (sum, a) => sum + (a.oneYearReturn ?? 0) * a.marketValue,
        0
    );
    const estimatedAnnualReturn = Math.round((weightedReturn / totalValue) * 10) / 10;

    const totalAnnualDividends = validAssets.reduce(
        (sum, a) => sum + (a.expectedAnnualDividends || 0),
        0
    );
    const estimatedMonthlyDividend = Math.round((totalAnnualDividends / 12) * 100) / 100;

    return { estimatedAnnualReturn, estimatedMonthlyDividend };
}

// --- Format Strategy Context for LLM ---

function labelLookup(values: string[], options: { value: string; label: string }[]): string {
    const map = new Map(options.map((o) => [o.value, o.label]));
    return values.map((v) => map.get(v) || v).join(", ");
}

export function formatStrategyContext(profile: Partial<StrategyConfig>): string {
    const lines: string[] = [];

    const { assetMixGrowth = 0, assetMixIncome = 0, assetMixMixed = 0 } = profile;
    if (assetMixGrowth + assetMixIncome + assetMixMixed > 0) {
        lines.push(`ASSET MIX TARGETS: Growth ${assetMixGrowth}%, Income ${assetMixIncome}%, Mixed ${assetMixMixed}%`);
    }

    if (profile.philosophies?.length) {
        lines.push(`INVESTMENT PHILOSOPHIES: ${labelLookup(profile.philosophies, PHILOSOPHY_OPTIONS)}`);
    }

    if (profile.corePrinciples?.length) {
        lines.push(`CORE PRINCIPLES: ${labelLookup(profile.corePrinciples, CORE_PRINCIPLE_OPTIONS)}`);
    }

    if (profile.accountTypes?.length) {
        lines.push(`ACCOUNT TYPES: ${labelLookup(profile.accountTypes, ACCOUNT_TYPE_OPTIONS)}`);
    }

    if (profile.tradingMethodologies?.length) {
        lines.push(`TRADING METHODOLOGY: ${labelLookup(profile.tradingMethodologies, TRADING_METHODOLOGY_OPTIONS)}`);
    }

    if (profile.sectorAllocation && Object.keys(profile.sectorAllocation).length > 0) {
        const parts = Object.entries(profile.sectorAllocation)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${SECTOR_LABELS[k] || k} ${v}%`);
        if (parts.length) lines.push(`SECTOR TARGETS: ${parts.join(", ")}`);
    }

    if (profile.geographicExposure && Object.keys(profile.geographicExposure).length > 0) {
        const parts = Object.entries(profile.geographicExposure)
            .filter(([, v]) => v > 0)
            .map(([k, v]) => `${GEO_LABELS[k] || k} ${v}%`);
        if (parts.length) lines.push(`GEOGRAPHIC TARGETS: ${parts.join(", ")}`);
    }

    if (profile.targetAnnualReturn && profile.targetAnnualReturn > 0) {
        lines.push(`TARGET ANNUAL RETURN: ${profile.targetAnnualReturn}%`);
    }

    if (profile.targetMonthlyDividend && profile.targetMonthlyDividend > 0) {
        lines.push(`TARGET MONTHLY DIVIDEND INCOME: $${profile.targetMonthlyDividend}`);
    }

    if (profile.riskTolerance != null) {
        const riskLabel = RISK_TOLERANCE_LABELS[profile.riskTolerance] || 'Not set';
        lines.push(`RISK TOLERANCE: ${profile.riskTolerance}/10 (${riskLabel})`);
    }

    return lines.length > 0 ? lines.join("\n") : "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
/**
 * Format a nullable decimal-stored ratio (e.g., 0.05 = 5%) as a percentage
 * string for AI prompt context. Multiplies by 100 to convert decimal to percent.
 * Renders "Not Found" when the value is null/undefined/non-numeric so the
 * model can distinguish a genuinely missing metric from a 0%.
 *
 * Use only for fields stored as decimals: yield, oneYearReturn,
 * threeYearReturn, fiveYearReturn. Do NOT use for managementFee (stored
 * already-as-percent).
 */
function fmtPctOrNotFound(v: number | null | undefined, decimals = 2): string {
    if (v === null || v === undefined) return "Not Found";
    const n = Number(v);
    if (!Number.isFinite(n)) return "Not Found";
    return `${(n * 100).toFixed(decimals)}%`;
}

function p(val: any, fallback = 0): number {
    if (val == null || val === '') return fallback;
    const n = typeof val === 'string' ? parseFloat(val.replace(/,/g, '')) : Number(val);
    return isNaN(n) ? fallback : n;
}

/**
 * Build a comprehensive context string for AI conversations.
 * Includes: strategy config, full portfolio holdings, finance summary (budget, wealth, net worth).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildFullUserContext(profile: Record<string, any>, assets: any[], latestCashflow: any): string {
    const sections: string[] = [];

    // --- 1. Strategy & Goals ---
    sections.push("=== INVESTMENT STRATEGY ===");
    sections.push(`Strategy: ${profile.strategy || "Not specified"}`);
    sections.push(`Goals: ${profile.goals || "Not specified"}`);
    const strategyCtx = formatStrategyContext(profile as Partial<StrategyConfig>);
    if (strategyCtx) sections.push(strategyCtx);

    // --- 2. Budget & Cash Flow ---
    const tIncome = p(profile.budgetPaycheck) + p(profile.budgetRentalIncome) + p(profile.budgetDividends) + p(profile.budgetBonus) + p(profile.budgetOtherIncome);
    const tExpenses = p(profile.budgetFixedHome) + p(profile.budgetFixedUtilities) + p(profile.budgetFixedCar) + p(profile.budgetFixedFood) + p(profile.budgetDiscretionary) + p(profile.budgetRentalExpenses);

    sections.push("\n=== MONTHLY BUDGET ===");
    if (tIncome > 0 || tExpenses > 0) {
        sections.push(`Total Monthly Income: $${tIncome.toFixed(2)}`);
        sections.push(`  - Paycheck: $${p(profile.budgetPaycheck).toFixed(2)}`);
        sections.push(`  - Rental Income: $${p(profile.budgetRentalIncome).toFixed(2)}`);
        sections.push(`  - Dividends: $${p(profile.budgetDividends).toFixed(2)}`);
        sections.push(`  - Bonus: $${p(profile.budgetBonus).toFixed(2)}`);
        sections.push(`  - Other Income: $${p(profile.budgetOtherIncome).toFixed(2)}`);
        sections.push(`Total Monthly Expenses: $${tExpenses.toFixed(2)}`);
        sections.push(`  - Housing: $${p(profile.budgetFixedHome).toFixed(2)}`);
        sections.push(`  - Utilities: $${p(profile.budgetFixedUtilities).toFixed(2)}`);
        sections.push(`  - Car/Transport: $${p(profile.budgetFixedCar).toFixed(2)}`);
        sections.push(`  - Food/Groceries: $${p(profile.budgetFixedFood).toFixed(2)}`);
        sections.push(`  - Discretionary: $${p(profile.budgetDiscretionary).toFixed(2)}`);
        sections.push(`  - Rental Expenses: $${p(profile.budgetRentalExpenses).toFixed(2)}`);
        sections.push(`Target Monthly Savings: $${(tIncome - tExpenses).toFixed(2)}`);
    } else {
        sections.push("No monthly budget defined.");
    }

    const cashReserves = latestCashflow?.cashReserves || 0;
    if (cashReserves > 0) sections.push(`Cash Reserves: $${cashReserves}`);

    // --- 3. Wealth / Net Worth ---
    const assetCash = p(profile.wealthAssetCash);
    const assetCar = p(profile.wealthAssetCar);
    const assetPrimary = p(profile.wealthAssetPrimaryResidence);
    const assetRental = p(profile.wealthAssetRentalProperties);
    const assetOther = p(profile.wealthAssetOther);
    const totalNonInvestmentAssets = assetCash + assetCar + assetPrimary + assetRental + assetOther;

    const liabMortgage = p(profile.wealthLiabilityMortgage);
    const liabHeloc = p(profile.wealthLiabilityHeloc);
    const liabRentalMortgage = p(profile.wealthLiabilityRentalMortgage);
    const liabRentalHeloc = p(profile.wealthLiabilityRentalHeloc);
    const liabCreditCards = p(profile.wealthLiabilityCreditCards);
    const liabCarLease = p(profile.wealthLiabilityCarLease);
    const totalLiabilities = liabMortgage + liabHeloc + liabRentalMortgage + liabRentalHeloc + liabCreditCards + liabCarLease;

    if (totalNonInvestmentAssets > 0 || totalLiabilities > 0) {
        sections.push("\n=== WEALTH & NET WORTH ===");
        sections.push("Non-Investment Assets:");
        if (assetCash > 0) sections.push(`  - Cash/Savings: $${assetCash.toFixed(2)}`);
        if (assetPrimary > 0) sections.push(`  - Primary Residence: $${assetPrimary.toFixed(2)}`);
        if (assetRental > 0) sections.push(`  - Rental Properties: $${assetRental.toFixed(2)}`);
        if (assetCar > 0) sections.push(`  - Vehicles: $${assetCar.toFixed(2)}`);
        if (assetOther > 0) sections.push(`  - Other Assets: $${assetOther.toFixed(2)}`);
        sections.push("Liabilities:");
        if (liabMortgage > 0) sections.push(`  - Mortgage: $${liabMortgage.toFixed(2)}`);
        if (liabHeloc > 0) sections.push(`  - HELOC: $${liabHeloc.toFixed(2)}`);
        if (liabRentalMortgage > 0) sections.push(`  - Rental Mortgage: $${liabRentalMortgage.toFixed(2)}`);
        if (liabRentalHeloc > 0) sections.push(`  - Rental HELOC: $${liabRentalHeloc.toFixed(2)}`);
        if (liabCreditCards > 0) sections.push(`  - Credit Cards: $${liabCreditCards.toFixed(2)}`);
        if (liabCarLease > 0) sections.push(`  - Car Lease/Loan: $${liabCarLease.toFixed(2)}`);
    }

    // --- 4. Full Portfolio Holdings ---
    const assetsList = (assets || []) as Asset[];
    const totalMV = assetsList.reduce((s, a) => s + (Number(a.marketValue) || 0), 0);
    const totalBK = assetsList.reduce((s, a) => s + (Number(a.bookCost) || 0), 0);
    const totalPL = assetsList.reduce((s, a) => s + (Number(a.profitLoss) || 0), 0);
    const totalExpDiv = assetsList.reduce((s, a) => s + (Number(a.expectedAnnualDividends) || 0), 0);
    const weightedYield = totalMV > 0
        ? assetsList.reduce((acc, a) => acc + ((Number(a.yield) || 0) * 100 * ((Number(a.marketValue) || 0) / totalMV)), 0)
        : 0;

    sections.push("\n=== PORTFOLIO HOLDINGS ===");
    if (assetsList.length > 0) {
        sections.push(`Total Holdings: ${assetsList.length} positions`);
        sections.push(`Total Market Value: $${totalMV.toFixed(2)}`);
        sections.push(`Total Book Cost: $${totalBK.toFixed(2)}`);
        sections.push(`Total P/L: $${totalPL.toFixed(2)} (${totalBK > 0 ? ((totalPL / totalBK) * 100).toFixed(1) : 0}%)`);
        sections.push(`Weighted Portfolio Yield: ${weightedYield.toFixed(2)}%`);
        sections.push(`Expected Annual Dividends: $${totalExpDiv.toFixed(2)} (~$${(totalExpDiv / 12).toFixed(2)}/month)`);

        // Combined net worth
        const investmentValue = totalMV;
        const totalAllAssets = totalNonInvestmentAssets + investmentValue;
        const netWorth = totalAllAssets - totalLiabilities;
        sections.push(`\nTotal Net Worth: $${netWorth.toFixed(2)} (Investments: $${investmentValue.toFixed(2)} + Other Assets: $${totalNonInvestmentAssets.toFixed(2)} - Liabilities: $${totalLiabilities.toFixed(2)})`);

        sections.push("\nDetailed Holdings:");
        for (const a of assetsList) {
            const mv = Number(a.marketValue) || 0;
            const weight = totalMV > 0 ? ((mv / totalMV) * 100).toFixed(1) : '0.0';
            sections.push(`- ${a.ticker} | ${a.quantity} shares @ $${Number(a.liveTickerPrice || 0).toFixed(2)} | MV: $${mv.toFixed(2)} (${weight}%) | BK: $${(Number(a.bookCost) || 0).toFixed(2)} | P/L: $${Number(a.profitLoss || 0).toFixed(2)} | Yield: ${fmtPctOrNotFound(a.yield, 2)} | Beta: ${Number(a.beta || 0).toFixed(2)} | Strategy: ${a.strategyType || 'N/A'} | Sector: ${a.sector || 'N/A'} | Market: ${a.market || 'N/A'} | Acct: ${a.account || 'N/A'} (${a.accountType || 'N/A'}) | 1yr: ${fmtPctOrNotFound(a.oneYearReturn, 1)} | Analyst: ${a.analystConsensus || 'N/A'}${a.riskFlag ? ' | RISK FLAG: ' + a.riskFlag : ''}`);
        }
    } else {
        sections.push("No portfolio holdings documented.");
    }

    return sections.join("\n");
}
