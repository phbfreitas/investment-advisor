"use client";

import type { Asset, MarketData } from "@/types";

interface HoldingsTabProps {
  assets: Asset[];
  isLoading: boolean;
  marketData: Record<string, MarketData>;
  isMarketLoading: boolean;
  // The existing DashboardClient passes its full set of handlers/state down.
  // For the initial extraction, we accept everything as props rather than
  // dual-managing state. This keeps the diff a pure cut-and-paste.
  children: React.ReactNode;
}

export function HoldingsTab({ children }: HoldingsTabProps) {
  return <>{children}</>;
}
