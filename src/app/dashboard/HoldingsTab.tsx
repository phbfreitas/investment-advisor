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
  onColumnVisibilityChange: (key: string, visible: boolean) => void;
  onExchangeSave: (assetId: string, suffix: string, name: string) => void;
  // The existing DashboardClient passes its full set of handlers/state down.
  // For the initial extraction, we accept everything as props rather than
  // dual-managing state. This keeps the diff a pure cut-and-paste.
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

export function HoldingsTab({ children }: HoldingsTabProps) {
  return <>{children}</>;
}

export { ExchangeCell };
