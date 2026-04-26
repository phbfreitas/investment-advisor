"use client";

import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import type { Asset } from "@/types";
import { computeBreakdowns } from "./lib/computeBreakdowns";
import { computeTopHoldings } from "./lib/computeTopHoldings";
import { computeWeightedYield } from "./lib/computeWeightedYield";
import { computeDriftSignals } from "./lib/computeDriftSignals";
import { CompositionSection } from "./CompositionSection";
import { ConcentrationSection } from "./ConcentrationSection";
import { DriftSignalsSection } from "./DriftSignalsSection";

interface BreakdownTabProps {
  assets: Asset[];
  isLoading: boolean;
  onSwitchToHoldings: () => void;
}

export function BreakdownTab({ assets, isLoading, onSwitchToHoldings }: BreakdownTabProps) {
  const breakdowns    = useMemo(() => computeBreakdowns(assets),    [assets]);
  const topHoldings   = useMemo(() => computeTopHoldings(assets),   [assets]);
  const weightedYield = useMemo(() => computeWeightedYield(assets), [assets]);
  const driftSignals  = useMemo(() => computeDriftSignals(assets),  [assets]);

  if (isLoading) {
    return (
      <div data-testid="breakdown-loading" className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
        <h2 className="text-lg font-medium text-neutral-800 dark:text-neutral-200 mb-2">
          Your portfolio is empty
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4 max-w-md">
          Import holdings on the Holdings tab to see your breakdown.
        </p>
        <button
          onClick={onSwitchToHoldings}
          className="min-h-[44px] px-4 rounded-lg bg-teal-500 text-white text-sm font-medium hover:bg-teal-600 transition-colors"
        >
          Go to Holdings
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col p-4 md:p-8 space-y-8">
      <section aria-labelledby="composition-heading">
        <h2 id="composition-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          1 · Composition
        </h2>
        <CompositionSection breakdowns={breakdowns} />
      </section>

      <section aria-labelledby="concentration-heading">
        <h2 id="concentration-heading" className="text-xs uppercase tracking-wider text-teal-600 dark:text-teal-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          2 · Concentration
        </h2>
        <ConcentrationSection topHoldings={topHoldings} weightedYield={weightedYield} />
      </section>

      <section aria-labelledby="drift-heading">
        <h2 id="drift-heading" className="text-xs uppercase tracking-wider text-amber-600 dark:text-amber-400 font-semibold border-b border-neutral-200 dark:border-neutral-800 pb-2 mb-4">
          3 · Drift Signals
        </h2>
        <DriftSignalsSection signals={driftSignals} />
      </section>
    </div>
  );
}
