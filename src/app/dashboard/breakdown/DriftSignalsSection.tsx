"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, ChevronDown } from "lucide-react";
import type { DriftSignal, DriftSeverity } from "./lib/types";
import { THRESHOLDS } from "./lib/thresholds";

const fmtCurrency = (n: number) =>
  n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const SEVERITY_STYLES: Record<DriftSeverity, { icon: typeof AlertCircle; cls: string; iconCls: string }> = {
  red:     { icon: AlertCircle,    cls: "border-l-red-500 bg-red-500/5",         iconCls: "text-red-500" },
  warning: { icon: AlertTriangle,  cls: "border-l-amber-500 bg-amber-500/5",     iconCls: "text-amber-500" },
  info:    { icon: Info,           cls: "border-l-neutral-400 bg-neutral-500/5", iconCls: "text-neutral-500" },
};

interface DriftSignalsSectionProps {
  signals: DriftSignal[];
}

export function DriftSignalsSection({ signals }: DriftSignalsSectionProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (signals.length === 0) {
    return (
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-[#0a0a0a] p-4">
        <p className="text-sm text-neutral-700 dark:text-neutral-300">
          No concentration risks detected at current thresholds.
        </p>
        <details className="mt-2">
          <summary className="text-xs text-neutral-500 cursor-pointer">Active thresholds</summary>
          <ul className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 list-disc list-inside space-y-1">
            <li>Single stock: warn &gt; {THRESHOLDS.singleStockWarn * 100}%, red &gt; {THRESHOLDS.singleStockRed * 100}%</li>
            <li>Sector: warn &gt; {THRESHOLDS.sectorWarn * 100}%, red &gt; {THRESHOLDS.sectorRed * 100}%</li>
            <li>Region: warn &gt; {THRESHOLDS.regionWarn * 100}%</li>
            <li>Non-base currency: warn &gt; {THRESHOLDS.currencyNonBaseWarn * 100}%</li>
            <li>Account skew: info &gt; {THRESHOLDS.accountSkewInfo * 100}%</li>
            <li>Defensive sectors: info &gt; {THRESHOLDS.cashDragInfo * 100}%</li>
          </ul>
        </details>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {signals.map(s => {
        const { icon: Icon, cls, iconCls } = SEVERITY_STYLES[s.severity];
        const isOpen = !!expanded[s.id];
        return (
          <li key={s.id} className={`rounded-r-lg border-l-4 ${cls}`}>
            <button
              type="button"
              aria-expanded={isOpen}
              aria-label={s.title}
              onClick={() => setExpanded(prev => ({ ...prev, [s.id]: !prev[s.id] }))}
              className="w-full flex items-center gap-3 min-h-[44px] px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
            >
              <Icon className={`h-5 w-5 flex-none ${iconCls}`} aria-hidden />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{s.title}</div>
                <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">{s.thresholdLabel}</div>
              </div>
              <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${isOpen ? "rotate-180" : ""}`} aria-hidden />
            </button>
            {isOpen && s.contributors.length > 0 && (
              <ul className="px-3 pb-3 pt-1 border-t border-neutral-200 dark:border-neutral-800 space-y-1">
                {s.contributors.map(c => (
                  <li key={c.label} className="flex justify-between text-xs text-neutral-600 dark:text-neutral-400">
                    <span>{c.label}</span>
                    <span>{fmtCurrency(c.value)} · {c.percent.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
