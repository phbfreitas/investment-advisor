"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

type TabId = "holdings" | "breakdown";
const TAB_IDS: TabId[] = ["holdings", "breakdown"];

interface PortfolioTabsProps {
  /** Two children expected, in order: HoldingsTab content, then BreakdownTab content. */
  children: [ReactNode, ReactNode];
}

export function PortfolioTabs({ children }: PortfolioTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const active: TabId = useMemo(() => {
    const v = searchParams.get("tab");
    return v === "breakdown" ? "breakdown" : "holdings";
  }, [searchParams]);

  const setTab = useCallback(
    (id: TabId) => {
      const params = new URLSearchParams(searchParams.toString());
      if (id === "holdings") params.delete("tab");
      else params.set("tab", id);
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const idx = TAB_IDS.indexOf(active);
    const next = TAB_IDS[(idx + (e.key === "ArrowRight" ? 1 : TAB_IDS.length - 1)) % TAB_IDS.length];
    setTab(next);
    e.preventDefault();
  };

  const [holdingsPane, breakdownPane] = children;

  return (
    <div className="flex flex-col flex-1">
      <div
        role="tablist"
        aria-label="Portfolio views"
        className="flex border-b border-neutral-200 dark:border-neutral-800 px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-[4rem] z-[5]"
        onKeyDown={onKeyDown}
      >
        {TAB_IDS.map((id) => {
          const selected = active === id;
          return (
            <button
              key={id}
              id={`tab-${id}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`tabpanel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setTab(id)}
              className={[
                "min-h-[44px] px-4 md:px-6 text-sm font-medium transition-colors border-b-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2",
                selected
                  ? "border-teal-500 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200",
              ].join(" ")}
            >
              {id === "holdings" ? "Holdings" : "Breakdown"}
            </button>
          );
        })}
      </div>
      <div id="tabpanel-holdings" role="tabpanel" aria-labelledby="tab-holdings" hidden={active !== "holdings"} className={active !== "holdings" ? "hidden" : undefined}>
        {holdingsPane}
      </div>
      <div id="tabpanel-breakdown" role="tabpanel" aria-labelledby="tab-breakdown" hidden={active !== "breakdown"} className={active !== "breakdown" ? "hidden" : undefined}>
        {breakdownPane}
      </div>
    </div>
  );
}
