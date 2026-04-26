import type { Asset } from "@/types";
import type { DriftSignal, DriftSeverity } from "./types";
import { THRESHOLDS, DEFENSIVE_SECTORS, dominantKey } from "./thresholds";

const SEVERITY_ORDER: Record<DriftSeverity, number> = { red: 0, warning: 1, info: 2 };

function pct(n: number) {
  return Math.round(n * 1000) / 10;
}

function fmtPctLabel(value: number): string {
  return `${pct(value)}%`;
}

function sumByField<K extends keyof Asset>(assets: Asset[], field: K): { sums: Record<string, number>; total: number } {
  const sums: Record<string, number> = {};
  let total = 0;
  for (const asset of assets) {
    if (!Number.isFinite(asset.marketValue) || asset.marketValue <= 0) continue;
    const raw = asset[field];
    const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Uncategorized";
    sums[label] = (sums[label] ?? 0) + asset.marketValue;
    total += asset.marketValue;
  }
  return { sums, total };
}

function contributorsForField<K extends keyof Asset>(
  assets: Asset[], field: K, value: string, total: number
) {
  return assets
    .filter(a => {
      if (!Number.isFinite(a.marketValue) || a.marketValue <= 0) return false;
      const raw = a[field];
      const label = typeof raw === "string" && raw.trim().length > 0 ? raw : "Uncategorized";
      return label === value;
    })
    .map(a => ({
      label: a.ticker,
      value: a.marketValue,
      percent: total > 0 ? (a.marketValue / total) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function computeDriftSignals(assets: Asset[]): DriftSignal[] {
  const valid = assets.filter(a => Number.isFinite(a.marketValue) && a.marketValue > 0);
  const total = valid.reduce((s, a) => s + a.marketValue, 0);
  if (total <= 0) return [];

  const signals: DriftSignal[] = [];

  // Single-stock concentration — aggregate by ticker so multi-account splits don't slip through
  const byTicker = new Map<string, Asset[]>();
  for (const asset of valid) {
    const ticker = typeof asset.ticker === "string" && asset.ticker.trim().length > 0 ? asset.ticker : "Uncategorized";
    const existing = byTicker.get(ticker);
    if (existing) existing.push(asset);
    else byTicker.set(ticker, [asset]);
  }

  for (const [ticker, rows] of byTicker.entries()) {
    const sum = rows.reduce((s, a) => s + a.marketValue, 0);
    const ratio = sum / total;
    const thresholdLabel = `threshold: ${pct(THRESHOLDS.singleStockRed)}% (red), ${pct(THRESHOLDS.singleStockWarn)}% (warn)`;
    const contributors = rows
      .map(a => ({
        // Show account when the ticker is split across accounts; otherwise just the ticker
        label: rows.length > 1 ? `${ticker} (${a.account || "no account"})` : ticker,
        value: a.marketValue,
        percent: (a.marketValue / total) * 100,
      }))
      .sort((a, b) => b.value - a.value);

    if (ratio > THRESHOLDS.singleStockRed) {
      signals.push({
        id: `stock-red-${ticker}`,
        severity: "red",
        title: `${ticker} is ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel,
        contributors,
      });
    } else if (ratio > THRESHOLDS.singleStockWarn) {
      signals.push({
        id: `stock-warn-${ticker}`,
        severity: "warning",
        title: `${ticker} is ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel,
        contributors,
      });
    }
  }

  // Sector concentration
  const sectors = sumByField(valid, "sector");
  for (const [sector, sum] of Object.entries(sectors.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.sectorRed) {
      signals.push({
        id: `sector-red-${sector}`,
        severity: "red",
        title: `${sector} sector concentrated at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.sectorRed)}% (red), ${pct(THRESHOLDS.sectorWarn)}% (warn)`,
        contributors: contributorsForField(valid, "sector", sector, total),
      });
    } else if (ratio > THRESHOLDS.sectorWarn) {
      signals.push({
        id: `sector-warn-${sector}`,
        severity: "warning",
        title: `${sector} sector concentrated at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.sectorRed)}% (red), ${pct(THRESHOLDS.sectorWarn)}% (warn)`,
        contributors: contributorsForField(valid, "sector", sector, total),
      });
    }
  }

  // Region concentration
  // Note: unlike currency (where we skip the dominant "base" because non-base FX creates risk),
  // region concentration is a risk regardless of which region is dominant — so we check ALL regions.
  const regions = sumByField(valid, "market");
  for (const [region, sum] of Object.entries(regions.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.regionWarn) {
      signals.push({
        id: `region-warn-${region}`,
        severity: "warning",
        title: `${region} concentration at ${fmtPctLabel(ratio)}`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.regionWarn)}% (warn)`,
        contributors: contributorsForField(valid, "market", region, total),
      });
    }
  }

  // Currency exposure (non-base)
  const currencies = sumByField(valid, "currency");
  const baseCurrency = dominantKey(currencies.sums);
  for (const [code, sum] of Object.entries(currencies.sums)) {
    if (code === baseCurrency) continue;
    const ratio = sum / total;
    if (ratio > THRESHOLDS.currencyNonBaseWarn) {
      signals.push({
        id: `currency-warn-${code}`,
        severity: "warning",
        title: `${code} exposure: ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.currencyNonBaseWarn)}% (warn) for non-base currency (base: ${baseCurrency ?? "n/a"})`,
        contributors: contributorsForField(valid, "currency", code, total),
      });
    }
  }

  // Account skew
  const accounts = sumByField(valid, "account");
  for (const [acct, sum] of Object.entries(accounts.sums)) {
    const ratio = sum / total;
    if (ratio > THRESHOLDS.accountSkewInfo) {
      signals.push({
        id: `account-info-${acct}`,
        severity: "info",
        title: `${acct} holds ${fmtPctLabel(ratio)} of portfolio`,
        thresholdLabel: `threshold: ${pct(THRESHOLDS.accountSkewInfo)}% (info — tax-shelter underuse?)`,
        contributors: contributorsForField(valid, "account", acct, total),
      });
    }
  }

  // Cash drag (defensive sectors)
  const defensiveSet = new Set(DEFENSIVE_SECTORS.map(s => s.toLowerCase()));
  const defensiveValid = valid.filter(a => defensiveSet.has((a.sector || "").toLowerCase()));
  const defensiveSum = defensiveValid.reduce((s, a) => s + a.marketValue, 0);
  const defensiveRatio = total > 0 ? defensiveSum / total : 0;
  if (defensiveRatio > THRESHOLDS.cashDragInfo) {
    signals.push({
      id: "defensive-info",
      severity: "info",
      title: `Defensive sectors at ${fmtPctLabel(defensiveRatio)}`,
      thresholdLabel: `threshold: ${pct(THRESHOLDS.cashDragInfo)}% (info — possible cash drag)`,
      contributors: defensiveValid
        .map(a => ({ label: a.ticker, value: a.marketValue, percent: (a.marketValue / total) * 100 }))
        .sort((x, y) => y.value - x.value),
    });
  }

  signals.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return signals;
}
