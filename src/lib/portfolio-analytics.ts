import type { Asset, StrategyConfig } from "@/types";
import {
    PHILOSOPHY_OPTIONS,
    CORE_PRINCIPLE_OPTIONS,
    ACCOUNT_TYPE_OPTIONS,
    TRADING_METHODOLOGY_OPTIONS,
    SECTOR_LABELS,
    GEO_LABELS,
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
};

export const GEO_NORMALIZE_MAP: Record<string, string> = {
    "US": "na",
    "USA": "na",
    "Canada": "na",
    "CA": "na",
    "North America": "na",
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
        (sum, a) => sum + a.oneYearReturn * a.marketValue,
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

    return lines.length > 0 ? lines.join("\n") : "";
}
