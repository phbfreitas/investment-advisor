"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import type { Asset, MarketData } from "@/types";

export const DEFAULT_COLUMN_VISIBILITY: Record<string, boolean> = {
  account: true,
  ticker: true,
  securityType: true,
  strategyType: true,
  call: false,
  sector: true,
  market: true,
  currency: true,
  exchange: true,
  managementStyle: false,
  managementFee: true,
  quantity: true,
  liveTickerPrice: true,
  bookCost: true,
  marketValue: true,
  weightPct: true,
  profitLoss: true,
  yield: true,
  oneYearReturn: true,
  threeYearReturn: false,
  exDividendDate: false,
  analystConsensus: false,
  externalRating: false,
  beta: false,
  riskFlag: false,
  volatility: false,
  expectedAnnualDividends: true,
  accountNumber: false,
  accountType: false,
};

const KNOWN_EXCHANGES = [
  { label: "Nasdaq",        suffix: "",    name: "Nasdaq" },
  { label: "NYSE",          suffix: "",    name: "NYSE" },
  { label: "NYSE American", suffix: "",    name: "NYSE American" },
  { label: "TSX",           suffix: ".TO", name: "TSX" },
  { label: "TSX Venture",   suffix: ".V",  name: "TSX Venture" },
  { label: "Cboe Canada",   suffix: ".NE", name: "Cboe Canada" },
  { label: "Other",         suffix: null,  name: "Other" },
] as const;

interface HoldingsTabProps {
  assets: Asset[];
  isLoading: boolean;
  marketData: Record<string, MarketData>;
  isMarketLoading: boolean;
  columnVisibility: Record<string, boolean>;
  onExchangeSave: (assetId: string, suffix: string, name: string) => void;
  children: React.ReactNode;
}

function ExchangeCell({
  asset,
  onSave,
}: {
  asset: Asset;
  onSave: (assetId: string, suffix: string, name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [selectedSuffix, setSelectedSuffix] = useState(asset.exchangeSuffix ?? "");
  const [customSuffix, setCustomSuffix] = useState("");
  const [selectedName, setSelectedName] = useState(asset.exchangeName ?? "");
  const isLocked = asset.userOverrides?.exchange === true;
  const needsReview = asset.needsExchangeReview === true;

  if (needsReview && !editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="flex items-center gap-1 text-amber-600 dark:text-amber-400 text-xs font-medium"
        title="Currency mismatch detected — click to set exchange"
      >
        ⚠ Review
      </button>
    );
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-1">
        {isLocked && <Lock className="h-3 w-3 text-neutral-400" aria-hidden="true" />}
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-neutral-700 dark:text-neutral-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
        >
          {asset.exchangeName || "—"}
        </button>
      </div>
    );
  }

  const handleConfirm = () => {
    const isOther = selectedName === "Other";
    const finalSuffix = isOther ? customSuffix : selectedSuffix;
    const finalName = isOther ? `Custom (${customSuffix})` : selectedName;
    onSave(asset.id, finalSuffix, finalName);
    setEditing(false);
  };

  return (
    <div className="flex flex-col gap-1">
      <select
        value={selectedName}
        onChange={e => {
          const opt = KNOWN_EXCHANGES.find(x => x.name === e.target.value);
          setSelectedName(e.target.value);
          setSelectedSuffix(opt?.suffix ?? "");
        }}
        className="text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 bg-white dark:bg-neutral-900"
      >
        {KNOWN_EXCHANGES.map(ex => (
          <option key={ex.label} value={ex.name}>{ex.label}</option>
        ))}
      </select>
      {selectedName === "Other" && (
        <input
          type="text"
          placeholder=".XX"
          value={customSuffix}
          onChange={e => setCustomSuffix(e.target.value)}
          className="text-xs border border-neutral-300 dark:border-neutral-700 rounded px-1 py-0.5 w-16 bg-white dark:bg-neutral-900"
        />
      )}
      <div className="flex gap-1">
        <button onClick={handleConfirm} className="text-xs text-teal-600 dark:text-teal-400 font-medium">Save</button>
        <button onClick={() => setEditing(false)} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
}

const COLUMN_LABELS: Record<string, string> = {
  account: "Account", ticker: "Ticker", securityType: "Type",
  strategyType: "Strategy", call: "Call", sector: "Sector",
  market: "Market", currency: "Currency", exchange: "Exchange",
  managementStyle: "Mgmt Style", managementFee: "Mgmt Fee",
  quantity: "Qty", liveTickerPrice: "Live Price", bookCost: "Book Cost",
  marketValue: "Market Value", weightPct: "Weight %", profitLoss: "P/L",
  yield: "Yield %", oneYearReturn: "1YR Return", threeYearReturn: "3YR Return",
  exDividendDate: "Ex-Div Date", analystConsensus: "Analyst",
  externalRating: "Ext. Rating", beta: "Beta", riskFlag: "Risk Flag",
  volatility: "Volatility", expectedAnnualDividends: "Exp. Dividends",
  accountNumber: "Acct #", accountType: "Acct Type",
};

export function ColumnManagerPopover({
  columnVisibility,
  onToggle,
  onClose,
}: {
  columnVisibility: Record<string, boolean>;
  onToggle: (key: string, visible: boolean) => void;
  onClose: () => void;
}) {
  const isVisible = (key: string) =>
    columnVisibility[key] !== undefined
      ? columnVisibility[key]
      : (DEFAULT_COLUMN_VISIBILITY[key] ?? true);

  return (
    <div className="absolute right-0 top-8 z-50 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl p-4 w-64 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">Manage Columns</span>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300">✕</button>
      </div>
      <div className="space-y-2">
        {Object.keys(COLUMN_LABELS).map(key => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isVisible(key)}
              onChange={e => onToggle(key, e.target.checked)}
              className="rounded border-neutral-300 text-teal-600 focus:ring-teal-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">{COLUMN_LABELS[key]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function HoldingsTab({ children }: HoldingsTabProps) {
  return <>{children}</>;
}

export { ExchangeCell };
