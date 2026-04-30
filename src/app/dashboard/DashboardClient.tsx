"use client";

import { useState, useEffect, useMemo, useCallback, Suspense, type ReactNode } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Upload, Download, Plus, RefreshCw, BarChart3, Loader2, AlertCircle, Trash2, Save, Edit2, ArrowUpDown, ArrowUp, ArrowDown, FilterX, RotateCcw, Lock } from "lucide-react";
import type { Asset, LockableField, MarketData } from "@/types";
import {
  STRATEGY_TYPES,
  SECURITY_TYPES,
  CALL_VALUES,
  SECTOR_VALUES,
  MARKET_VALUES,
  CANONICAL_CURRENCIES,
  MGMT_STYLES,
} from "@/lib/classification/allowlists";
import { AuditToast, type AuditToastData } from "@/components/AuditToast";
import { NotFoundCell } from "@/components/NotFoundCell";
import { TimeMachineDrawer } from "@/components/TimeMachine";
import { HoldingsTab } from "./HoldingsTab";
import { PortfolioTabs } from "./PortfolioTabs";
import { BreakdownTab } from "./breakdown/BreakdownTab";
import { applyLookupRespectingLocks, LOCKABLE_FIELDS } from "@/app/dashboard/lib/applyLookupRespectingLocks";

const LOCKABLE_FIELD_SET = new Set<string>(LOCKABLE_FIELDS);
const isLockableField = (field: keyof Asset): field is LockableField =>
  LOCKABLE_FIELD_SET.has(field as string);

const LOCKABLE_FIELD_LABELS: Record<LockableField, string> = {
  sector: "Sector",
  market: "Market",
  securityType: "Type",
  strategyType: "Strategy",
  call: "Call",
  managementStyle: "Mgmt Style",
  currency: "Currency",
  managementFee: "Mgmt Fee",
};

function LockedFieldIcon({
  isLocked,
  onUnlock,
  label,
}: {
  isLocked: boolean;
  onUnlock: () => void;
  label: string;
}) {
  if (!isLocked) return null;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onUnlock(); }}
      aria-label={`${label} locked — click to unlock`}
      title={`${label} locked — click to unlock`}
      className="inline-flex items-center justify-center w-6 h-6 -ml-0.5 mr-1 rounded text-neutral-400 dark:text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
    >
      <Lock className="h-3 w-3" aria-hidden="true" />
    </button>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });

  // Market data is now optional/helper since the table uses DB values, but we still fetch it for live updates
  const [marketData, setMarketData] = useState<Record<string, MarketData>>({});
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Asset>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Sorting and Filtering state
  const [sortConfig, setSortConfig] = useState<{ key: keyof Asset; direction: 'asc' | 'desc' } | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});

  // Dividend summary period
  const [dividendPeriod, setDividendPeriod] = useState<number>(12);

  // Audit feedback state
  const [auditToasts, setAuditToasts] = useState<AuditToastData[]>([]);
  const [highlightedRows, setHighlightedRows] = useState<Record<string, 'CREATE' | 'UPDATE' | 'DELETE'>>({});
  const [ghostAssets, setGhostAssets] = useState<Array<{ ticker: string; assetSK: string; snapshot: Record<string, unknown> }>>([]);
  const [isTimeMachineOpen, setIsTimeMachineOpen] = useState(false);
  
  // PDF Import Naming State
  const [isNamingModalOpen, setIsNamingModalOpen] = useState(false);
  const [pendingPdfFile, setPendingPdfFile] = useState<File | null>(null);
  const [detectedAccounts, setDetectedAccounts] = useState<string[]>([]);
  const [accountNameMappings, setAccountNameMappings] = useState<Record<string, string>>({});

  const dismissToast = useCallback((id: string) => {
    setAuditToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showAuditToast = (message: string, ticker?: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setAuditToasts(prev => [...prev, { id, message, ticker }]);
  };

  // Account list stays derived (it's user data, not classification)
  const accounts = useMemo(() => Array.from(new Set(assets.map(a => a.account).filter(Boolean))), [assets]);

  // Classification dropdowns: source-of-truth lists from allowlists module
  const securityTypes = [...SECURITY_TYPES];
  const strategyTypes = [...STRATEGY_TYPES];
  const calls = [...CALL_VALUES];
  const sectors = [...SECTOR_VALUES];
  const markets = [...MARKET_VALUES];
  // Currency: canonical USD/CAD plus any other ISO codes that already exist in user data
  const currencies = useMemo(() => {
    const fromData = assets.map(a => a.currency).filter(Boolean) as string[];
    return Array.from(new Set([...CANONICAL_CURRENCIES, ...fromData])).filter(c => c !== "Not Found");
  }, [assets]);
  const managementStyles = [...MGMT_STYLES];
  const risks = useMemo(() => Array.from(new Set(assets.map(a => a.risk).filter(Boolean))), [assets]);

  const fetchMarketData = async (symbols: string[]) => {
    const validSymbols = symbols.filter(Boolean);
    if (validSymbols.length === 0) return;
    setIsMarketLoading(true);

    const uniqueTickers = Array.from(new Set(validSymbols));

    try {
      const promises = uniqueTickers.map(ticker =>
        fetch(`/api/market-data?ticker=${ticker}`).then(res => res.json().catch(() => null)) as Promise<MarketData | null>
      );

      const results = await Promise.all(promises);
      const newMarketData: Record<string, MarketData> = {};

      results.forEach(data => {
        if (data && data.ticker && !data.error) {
          newMarketData[data.ticker] = data as MarketData;
        }
      });

      setMarketData(prev => ({ ...prev, ...newMarketData }));
    } catch (error) {
      console.error("Failed to load market data", error);
    } finally {
      setIsMarketLoading(false);
    }
  };

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const [res] = await Promise.all([
        fetch("/api/profile"),
        new Promise(resolve => setTimeout(resolve, 800)) // Artificial delay for a better refresh spin animation
      ]);
      const data = await res.json();
      if (data && data.assets) {
        setAssets(data.assets as Asset[]);
        fetchMarketData((data.assets as Asset[]).map(a => a.ticker));
      }
    } catch (error) {
      console.error("Failed to load assets", error);
    } finally {
      setIsLoading(false);
    }
  };

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const switchToHoldings = useCallback(() => {
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // Initial mount fetch — runs once
  useEffect(() => {
    fetchAssets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open time machine drawer when ?history=true; depend only on the value, not the whole searchParams object
  const historyParam = searchParams.get("history");
  useEffect(() => {
    if (historyParam === "true") {
      setIsTimeMachineOpen(true);
    }
  }, [historyParam]);

  // Debounced live ticker fetch when editing ticker
  useEffect(() => {
    if (editingId && editForm.ticker) {
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/market-data?ticker=${editForm.ticker}`);
          const data = await res.json();
          if (data && !data.error && data.currentPrice) {
            setEditForm(prev => ({
              ...prev,
              liveTickerPrice: data.currentPrice
            }));
          }
        } catch (e) {
          // ignore 
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [editForm.ticker, editingId]);

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset row?")) return;

    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      showAuditToast(`Asset deleted.`);
      fetchAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete asset.";
      setMessage({ text: message, type: "error" });
    }
  };

  const startEdit = (asset: Asset) => {
    setEditingId(asset.id);
    setEditForm({ ...asset });
  };

  const handleEditChange = (field: keyof Asset, value: string | number) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const setFieldWithLock = <F extends LockableField>(field: F, value: Asset[F]) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value,
      userOverrides: { ...prev.userOverrides, [field]: true },
    }));
  };

  const handleUnlockEditMode = (field: LockableField) => {
    setEditForm(prev => ({
      ...prev,
      userOverrides: { ...prev.userOverrides, [field]: false },
    }));
  };

  const handleUnlockField = async (asset: Asset, field: LockableField) => {
    const nextOverrides = { ...asset.userOverrides, [field]: false };
    try {
      const res = await fetch(`/api/assets/${asset.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...asset, userOverrides: nextOverrides }),
      });
      if (!res.ok) throw new Error("Failed to unlock field");
      fetchAssets();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to unlock field";
      setMessage({ text: message, type: "error" });
    }
  };

  const saveEdit = async () => {
    setIsSaving(true);
    try {
      const method = editingId === "NEW" ? "POST" : "PUT";
      const url = editingId === "NEW" ? "/api/assets" : `/api/assets/${editingId}`;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (!res.ok) throw new Error("Failed to save asset");

      const responseData = await res.json();
      const action = editingId === "NEW" ? "CREATE" : "UPDATE";
      const savedTicker = editForm.ticker || "";

      setEditingId(null);
      setEditForm({});
      fetchAssets();

      // Audit feedback
      showAuditToast(
        action === "CREATE"
          ? `${savedTicker} added to portfolio.`
          : `${savedTicker} updated.`,
        savedTicker
      );

      // Row highlight — use the asset id from response or editingId
      const highlightId = responseData.asset?.SK || `ASSET#${editingId}`;
      setHighlightedRows(prev => ({ ...prev, [highlightId]: action }));
      setTimeout(() => {
        setHighlightedRows(prev => {
          const next = { ...prev };
          delete next[highlightId];
          return next;
        });
      }, 4000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save asset.";
      setMessage({ text: message, type: "error" });
    } finally {
      setIsSaving(false);
    }
  };

  const addNewRow = () => {
    setEditingId("NEW");
    setEditForm({
      id: "NEW",
      account: "",
      ticker: "",
      securityType: "",
      strategyType: "",
      call: "",
      sector: "",
      market: "",
      currency: "",
      managementStyle: "",
      externalRating: "",
      managementFee: null,
      quantity: 0,
      liveTickerPrice: 0,
      bookCost: 0,
      marketValue: 0,
      profitLoss: 0,
      yield: null,
      oneYearReturn: null,
      threeYearReturn: null,
      exDividendDate: "",
      analystConsensus: "",
      beta: 0,
      accountNumber: "",
      accountType: "",
      risk: "",
      expectedAnnualDividends: 0
    });
  };

  const handleSort = (key: keyof Asset) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedAssets = useMemo(() => {
    // 1. Filter
    let filteredAssets = assets.filter(asset => {
      return Object.entries(filters).every(([key, filterValue]) => {
        if (!filterValue) return true;

        let assetValue: string | number | undefined =
          key === 'liveTickerPrice'
            ? (marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice)
            : asset[key as keyof Asset] as string | number | undefined;

        if (assetValue == null) return false;
        return assetValue.toString().toLowerCase().includes(filterValue.toLowerCase());
      });
    });

    // 2. Sort
    let sortableItems = [...filteredAssets];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue: string | number | undefined = a[sortConfig.key] as string | number | undefined;
        let bValue: string | number | undefined = b[sortConfig.key] as string | number | undefined;

        // Ensure live ticker price uses the actively fetched market data when sorting
        if (sortConfig.key === 'liveTickerPrice') {
          aValue = marketData[a.ticker]?.currentPrice ?? a.liveTickerPrice;
          bValue = marketData[b.ticker]?.currentPrice ?? b.liveTickerPrice;
        }

        if (aValue == null) aValue = '';
        if (bValue == null) bValue = '';

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = aValue.toString().toLowerCase();
        const bStr = bValue.toString().toLowerCase();
        if (aStr < bStr) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aStr > bStr) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [assets, sortConfig, filters, marketData]);

  // Ticker lookup — auto-populate fields when ticker is entered/changed
  const handleTickerLookup = async (symbol: string) => {
    if (!symbol.trim()) return;
    try {
      const res = await fetch(`/api/ticker-lookup?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        const qty = editForm.quantity || 0;
        const price = data.currentPrice || 0;
        const yieldForCalc = data.dividendYield ?? 0;
        const bookCostNum = editForm.bookCost || 0;

        setEditForm(prev => {
          const lookupPatch = applyLookupRespectingLocks(prev, data);
          return {
            ...prev,
            ...lookupPatch,
            // Computed fields derived from quantity * price * yield — always recomputed.
            marketValue: qty > 0 && price > 0 ? qty * price : prev.marketValue,
            profitLoss: qty > 0 && price > 0 ? (qty * price) - bookCostNum : prev.profitLoss,
            expectedAnnualDividends: qty > 0 && price > 0 && yieldForCalc > 0 ? qty * price * yieldForCalc : 0,
          };
        });
      }
    } catch (err) {
      console.error('Ticker lookup failed:', err);
    }
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Account', 'Ticker', 'Type', 'Strategy Type', 'Call', 'Sector', 'Market', 'Currency',
      'Mgt Style', 'Mgt Fee', 'Qty', 'Live Price', 'Book Cost', 'Market Value', 'Weight %', 'P/L',
      'Yield %', '1yr Return', '3yr Return', 'Ex-Div Date', 'Analyst', 'Ext. Rating',
      'Beta', 'Risk Flag', 'Volatility', 'Expected Div', 'Acct #', 'Acct Type',
    ];
    const totalMV = assets.reduce((s, a) => s + (a.marketValue || 0), 0);
    const escapeCSV = (v: unknown) => {
      const str = String(v ?? '');
      return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const fmt = (v: number | null | undefined): string => v == null ? "Not Found" : String(v);
    const rows = assets.map(a => [
      a.account, a.ticker, a.securityType, a.strategyType, a.call,
      a.sector, a.market, a.currency, a.managementStyle, fmt(a.managementFee),
      a.quantity, a.liveTickerPrice, (a.bookCost || 0),
      a.marketValue, totalMV > 0 ? ((a.marketValue || 0) / totalMV * 100).toFixed(1) + '%' : '0%',
      a.profitLoss, fmt(a.yield), fmt(a.oneYearReturn), fmt(a.threeYearReturn ?? a.fiveYearReturn ?? null),
      a.exDividendDate, a.analystConsensus, a.externalRating,
      a.beta, a.riskFlag, a.volatility, a.expectedAnnualDividends,
      a.accountNumber, a.accountType,
    ].map(escapeCSV));
    const totalBK = assets.reduce((s, a) => s + (a.bookCost || 0), 0);
    const totalPL = assets.reduce((s, a) => s + (a.profitLoss || 0), 0);
    const totalsRow = ['Totals', '', '', '', '', '', '', '', '', '', '',
      '', totalBK.toFixed(2), totalMV.toFixed(2), '100%', totalPL.toFixed(2),
      '', '', '', '', '', '', '', '', '', '', '', '',
    ];
    const csv = [headers.join(','), ...rows.map(r => r.join(',')), totalsRow.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `portfolio-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const renderSortableHeader = (label: string, sortKey: keyof Asset, extraClassName = "") => (
    <th
      key={sortKey}
      className={`px-3 py-3 font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group select-none whitespace-nowrap ${extraClassName}`}
      onClick={() => handleSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        <span className="text-neutral-400 dark:text-neutral-500 flex-shrink-0">
          {sortConfig?.key === sortKey ? (
            sortConfig.direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </span>
      </div>
    </th>
  );

  // Sticky classes for frozen columns (Account + Ticker only)
  const stickyCol1 = "sticky left-0 z-10 bg-neutral-50 dark:bg-neutral-900/50";
  const stickyCol2 = "sticky left-[120px] z-10 bg-neutral-50 dark:bg-neutral-900/50 border-r-2 border-neutral-300 dark:border-neutral-600";
  const stickyBodyCol1 = "sticky left-0 z-10 bg-white dark:bg-[#0a0a0a]";
  const stickyBodyCol2 = "sticky left-[120px] z-10 bg-white dark:bg-[#0a0a0a] border-r-2 border-neutral-300 dark:border-neutral-600";
  const stickyTotalsCol1 = "sticky left-0 z-10 bg-neutral-100 dark:bg-neutral-800/50";
  const stickyTotalsCol2 = "sticky left-[120px] z-10 bg-neutral-100 dark:bg-neutral-800/50 border-r-2 border-neutral-300 dark:border-neutral-600";

  const renderFilterInput = (filterKey: string, widthClass = "w-20", extraClassName = "") => (
    <td key={filterKey} className={`px-2 py-2 ${extraClassName}`}>
      <input
        type="text"
        placeholder="Filter..."
        className={`${widthClass} p-1 text-xs rounded border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900/50 text-neutral-700 dark:text-neutral-300 placeholder:text-neutral-400/50 focus:outline-none focus:border-teal-500/50`}
        value={filters[filterKey] || ""}
        onChange={(e) => setFilters(prev => ({ ...prev, [filterKey]: e.target.value }))}
      />
    </td>
  );

  const clearFilters = () => setFilters({});

  const totalMarketValue = assets.reduce((acc, curr) => acc + (Number(curr.marketValue) || 0), 0);
  const totalExpectedDividends = assets.reduce((acc, curr) => acc + (Number(curr.expectedAnnualDividends) || 0), 0);

  // Keep legacy KPIs for top display mostly intact, adapting to new schema
  const totalCostBasis = assets.reduce((acc, curr) => acc + (Number(curr.bookCost) || 0), 0);
  const totalReturn = totalCostBasis > 0 ? ((totalMarketValue - totalCostBasis) / totalCostBasis) * 100 : 0;

  const portfolioDividendYield = totalMarketValue > 0
    ? assets.reduce((acc, curr) => {
      const yieldPercent = Number(curr.yield) || 0;
      const weight = (Number(curr.marketValue) || 0) / totalMarketValue;
      return acc + (weight * yieldPercent);
    }, 0)
    : 0;

  const getRowHighlightClass = (assetSK: string) => {
    const action = highlightedRows[assetSK];
    if (!action) return "";
    switch (action) {
      case 'CREATE': return "audit-highlight-create";
      case 'UPDATE': return "audit-highlight-update";
      case 'DELETE': return "audit-highlight-delete";
      default: return "";
    }
  };

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      <header className="flex-none min-h-[4rem] h-auto py-3 md:py-0 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 space-y-3 md:space-y-0 transition-colors duration-300">
        <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200 w-full text-center md:text-left">My Investment Portfolio</h1>

        <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-end">
          <label className="cursor-not-allowed flex-1 md:flex-none justify-center items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500 px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center opacity-60">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Import Wealthsimple CSV</span>
            <span className="sm:hidden">Import CSV</span>
            <input type="file" accept=".csv" className="hidden" disabled={true} />
          </label>
          <label className="cursor-pointer flex-1 md:flex-none justify-center items-center space-x-2 bg-teal-600 hover:bg-teal-700 text-white px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center">
            <Upload className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Import PDF Statement</span>
            <span className="sm:hidden">Import PDF</span>
            <input type="file" accept=".pdf" className="hidden" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;

              setIsUploading(true);
              setMessage({ text: 'Previewing PDF statement...', type: 'success' });

              try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/portfolio-pdf?preview=true', { method: 'POST', body: formData });
                const data = await res.json();

                if (res.ok && data.preview) {
                  setPendingPdfFile(file);
                  setDetectedAccounts(data.accounts || []);
                  
                  // Pre-fill mappings with existing account names if possible
                  const newMappings: Record<string, string> = {};
                  data.accounts.forEach((acctNum: string) => {
                    const existing = assets.find(a => a.accountNumber === acctNum);
                    if (existing && existing.account) {
                      newMappings[acctNum] = existing.account || "";
                    }
                  });
                  setAccountNameMappings(newMappings);
                  setIsNamingModalOpen(true);
                } else {
                  setMessage({ text: data.error || 'Failed to preview PDF', type: 'error' });
                }
              } catch (err) {
                console.error(err);
                setMessage({ text: 'Error previewing PDF', type: 'error' });
              } finally {
                setIsUploading(false);
              }
              e.target.value = '';
            }} />
          </label>
          <button
            type="button"
            onClick={handleExportCSV}
            disabled={assets.length === 0}
            className="flex-1 md:flex-none justify-center items-center space-x-2 bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center disabled:opacity-40"
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">CSV</span>
          </button>
          <button
            type="button"
            onClick={() => setIsTimeMachineOpen(true)}
            className="flex-1 md:flex-none justify-center items-center space-x-2 bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center"
          >
            <RotateCcw className="h-4 w-4 shrink-0 text-teal-500" />
            <span className="hidden sm:inline">History</span>
            <span className="sm:hidden">History</span>
          </button>
        </div>
      </header>

      <PortfolioTabs>
      <HoldingsTab
        assets={assets}
        isLoading={isLoading}
        marketData={marketData}
        isMarketLoading={isMarketLoading}
      >
      <div className="w-full p-4 md:p-8">
        <div className="mx-auto space-y-8">

          {message.text && (
            <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              <AlertCircle className="h-5 w-5" />
              <span>{message.text}</span>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Total Market Value</span>
              <h3 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center">
                ${totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {isMarketLoading && <Loader2 className="h-4 w-4 animate-spin ml-3 text-teal-600" />}
              </h3>
            </div>
            <div className="glass-panel p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Total Return</span>
              <h3 className={`text-3xl font-semibold ${totalReturn >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                {totalReturn > 0 ? "+" : ""}{totalReturn.toFixed(2)}%
              </h3>
            </div>
            <div className="glass-panel p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Avg Dividend Yield</span>
              <h3 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100">
                {(portfolioDividendYield * 100).toFixed(2)}%
              </h3>
            </div>
          </div>

          {/* Investment Table */}
          <div className="glass-panel overflow-hidden">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-colors duration-300">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 flex items-center">
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-500 mr-2" />
                Holdings Breakdown
              </h3>
              <button
                onClick={fetchAssets}
                className="text-neutral-400 hover:text-neutral-900 dark:hover:text-white transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="overflow-x-auto max-h-[75vh]">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-medium transition-colors duration-300 sticky top-0 z-20">
                  <tr>
                    {renderSortableHeader("Account Name", "account", `${stickyCol1} min-w-[120px]`)}
                    {renderSortableHeader("Ticker", "ticker", `${stickyCol2} min-w-[90px]`)}
                    {renderSortableHeader("Acct Type", "accountType", `min-w-[90px]`)}
                    {renderSortableHeader("Acct #", "accountNumber", `min-w-[80px]`)}
                    {renderSortableHeader("Security Type", "securityType")}
                    {renderSortableHeader("Strategy Type", "strategyType")}
                    {renderSortableHeader("Call", "call")}
                    {renderSortableHeader("Sector", "sector")}
                    {renderSortableHeader("Market", "market")}
                    {renderSortableHeader("Currency", "currency")}
                    {renderSortableHeader("Mgt Style", "managementStyle")}
                    {renderSortableHeader("Mgt Fee %", "managementFee")}
                    {renderSortableHeader("# Tickers", "quantity")}
                    {renderSortableHeader("Live $", "liveTickerPrice")}
                    {renderSortableHeader("Book Cost", "bookCost")}
                    {renderSortableHeader("Market Value", "marketValue")}
                    {renderSortableHeader("Profit/Loss", "profitLoss")}
                    {renderSortableHeader("Yield %", "yield")}
                    {renderSortableHeader("1YR Return %", "oneYearReturn")}
                    {renderSortableHeader("3YR Return %", "threeYearReturn")}
                    {renderSortableHeader("Risk", "risk")}
                    {renderSortableHeader("Expected Div", "expectedAnnualDividends")}
                    {renderSortableHeader("Ext. Rating", "externalRating")}
                    {renderSortableHeader("Ex-Div Date", "exDividendDate")}
                    {renderSortableHeader("Analyst", "analystConsensus")}
                    {renderSortableHeader("Beta", "beta")}
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                  <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                    {renderFilterInput("account", "w-20", stickyCol1)}
                    {renderFilterInput("ticker", "w-20", stickyCol2)}
                    {renderFilterInput("accountType", "w-20")}
                    {renderFilterInput("accountNumber", "w-20")}
                    {renderFilterInput("securityType", "w-24")}
                    {renderFilterInput("strategyType", "w-28")}
                    {renderFilterInput("call", "w-16")}
                    {renderFilterInput("sector")}
                    {renderFilterInput("market")}
                    {renderFilterInput("currency", "w-16")}
                    {renderFilterInput("managementStyle", "w-24")}
                    {renderFilterInput("managementFee", "w-16")}
                    {renderFilterInput("quantity", "w-20")}
                    {renderFilterInput("liveTickerPrice", "w-24")}
                    {renderFilterInput("bookCost")}
                    {renderFilterInput("marketValue")}
                    {renderFilterInput("profitLoss")}
                    {renderFilterInput("yield", "w-16")}
                    {renderFilterInput("oneYearReturn")}
                    {renderFilterInput("threeYearReturn")}
                    {renderFilterInput("risk", "w-16")}
                    {renderFilterInput("expectedAnnualDividends")}
                    {renderFilterInput("externalRating")}
                    {renderFilterInput("exDividendDate", "w-24")}
                    {renderFilterInput("analystConsensus", "w-20")}
                    {renderFilterInput("beta", "w-16")}
                    <td className="px-3 py-2 text-right">
                      {Object.keys(filters).length > 0 && (
                        <button onClick={clearFilters} className="text-neutral-400 hover:text-red-500 transition-colors" title="Clear Filters">
                          <FilterX className="h-4 w-4 inline" />
                        </button>
                      )}
                    </td>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 transition-colors duration-300">
                  {[...sortedAssets, ...(editingId === "NEW" ? [editForm] : [])].length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={29} className="px-6 py-8 text-center text-neutral-500">
                        No assets found. Click Add Row below.
                      </td>
                    </tr>
                  ) : (
                    [...sortedAssets, ...(editingId === "NEW" ? [editForm as Asset] : [])].map((asset) => {
                      const isEditing = editingId === asset.id;

                      // Helper that renders a value or NotFoundCell when missing.
                      // For numbers, treat null as missing; 0 is valid.
                      // For strings, treat "", null, undefined, or "Not Found" as missing.
                      const renderText = (value: string | null | undefined) => {
                        if (value === null || value === undefined || value === "" || value === "Not Found") {
                          return <NotFoundCell />;
                        }
                        return <span>{value}</span>;
                      };

                      const renderNumber = (value: number | null | undefined, suffix = "", decimals = 2) => {
                        if (value === null || value === undefined) {
                          return <NotFoundCell />;
                        }
                        return <span>{value.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
                      };

                      const renderPercent = (value: number | null | undefined) => {
                        if (value === null || value === undefined) {
                          return <NotFoundCell />;
                        }
                        return <span>{(value * 100).toFixed(2)}%</span>;
                      };

                      const renderField = (field: keyof Asset, isSelect: boolean, options: string[] = [], type: string = "text", bgClass = "") => {
                        const lockable = isLockableField(field);
                        const lockableField = lockable ? (field as LockableField) : null;

                        if (isEditing) {
                          let control: ReactNode;
                          if (isSelect) {
                            control = (
                              <select
                                className={`w-28 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${bgClass}`}
                                value={(editForm[field] as string | number) || ""}
                                onChange={(e) => {
                                  if (isLockableField(field)) {
                                    setFieldWithLock(field, e.target.value as Asset[typeof field]);
                                  } else {
                                    handleEditChange(field, e.target.value);
                                  }
                                }}
                              >
                                <option value=""></option>
                                {options.map(o => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            );
                          } else {
                            control = (
                              <input
                                type={type}
                                className={`w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900`}
                                value={(editForm[field] as string | number | null) ?? ""}
                                onChange={(e) => {
                                  if (isLockableField(field)) {
                                    if (type === 'number') {
                                      const parsed = e.target.value === "" ? null : parseFloat(e.target.value);
                                      const safe = parsed === null ? null : (Number.isNaN(parsed) ? null : parsed);
                                      setFieldWithLock(field, safe as Asset[typeof field]);
                                    } else {
                                      setFieldWithLock(field, e.target.value as Asset[typeof field]);
                                    }
                                  } else {
                                    handleEditChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value);
                                  }
                                }}
                              />
                            );
                          }

                          if (lockableField) {
                            return (
                              <div className="flex items-center">
                                <LockedFieldIcon
                                  isLocked={editForm.userOverrides?.[lockableField] === true}
                                  onUnlock={() => handleUnlockEditMode(lockableField)}
                                  label={LOCKABLE_FIELD_LABELS[lockableField]}
                                />
                                {control}
                              </div>
                            );
                          }
                          return control;
                        }

                        // Display mode — delegate Not Found / null cases to NotFoundCell while
                        // preserving bgClass pill styling for canonical values.
                        const displayValue = asset[field] as string | number | null | undefined;
                        let content: ReactNode;
                        if (type === 'number') {
                          if (displayValue === null || displayValue === undefined || typeof displayValue !== 'number') {
                            content = <NotFoundCell />;
                          } else {
                            content = <span className={bgClass ? `px-2 py-0.5 rounded ${bgClass}` : ''}>{displayValue.toLocaleString()}</span>;
                          }
                        } else if (displayValue === null || displayValue === undefined || displayValue === "" || displayValue === "Not Found") {
                          content = <NotFoundCell />;
                        } else {
                          content = <span className={bgClass ? `px-2 py-0.5 rounded ${bgClass}` : ''}>{displayValue}</span>;
                        }

                        if (lockableField) {
                          return (
                            <span className="inline-flex items-center">
                              <LockedFieldIcon
                                isLocked={asset.userOverrides?.[lockableField] === true}
                                onUnlock={() => handleUnlockField(asset, lockableField)}
                                label={LOCKABLE_FIELD_LABELS[lockableField]}
                              />
                              {content}
                            </span>
                          );
                        }
                        return content;
                      };

                      // Legacy "—" indicator kept for ext-rating, ex-div date, analyst, beta where
                      // a softer dash is preferable to the prominent yellow NotFoundCell.
                      const naIndicator = (value: string | number | null | undefined, suffix = "") => {
                        if (value === null || value === undefined || value === "" || value === 0) {
                          return <span className="text-neutral-300 dark:text-neutral-600 italic cursor-help" title="Not available from market data">—</span>;
                        }
                        return <span>{typeof value === 'number' ? value.toLocaleString() : value}{suffix}</span>;
                      };

                      return (
                        <tr key={asset.id} className={`hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors ${getRowHighlightClass(asset.SK)}`}>
                          {/* 1. Account */}
                          <td className={`px-3 py-3 font-medium text-neutral-900 dark:text-neutral-200 ${stickyBodyCol1} min-w-[120px]`}>
                            {isEditing ? (
                              <>
                                <input type="text" list="account-suggestions" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.account as string) ?? ""} onChange={(e) => handleEditChange("account", e.target.value)} />
                                <datalist id="account-suggestions">{accounts.map(a => <option key={a} value={a} />)}</datalist>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50">{asset.account}</span>
                            )}
                          </td>
                          {/* 2. Ticker */}
                          <td className={`px-3 py-3 font-bold text-neutral-900 dark:text-neutral-100 ${stickyBodyCol2} min-w-[90px]`}>
                            {isEditing ? (
                              <input type="text" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.ticker as string) || ""} onChange={(e) => handleEditChange("ticker", e.target.value.toUpperCase())} onBlur={() => handleTickerLookup(editForm.ticker || "")} />
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50">{asset.ticker}</span>
                            )}
                          </td>
                          {/* 3. Acct Type */}
                          <td className={`px-3 py-3 text-neutral-700 dark:text-neutral-300 min-w-[90px]`}>
                            {isEditing ? <input type="text" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.accountType as string) ?? ""} onChange={(e) => handleEditChange("accountType", e.target.value)} /> : <span>{asset.accountType || "N/A"}</span>}
                          </td>
                          {/* 4. Acct # */}
                          <td className={`px-3 py-3 text-neutral-700 dark:text-neutral-300 min-w-[80px]`}>
                            {isEditing ? <input type="text" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.accountNumber as string) ?? ""} onChange={(e) => handleEditChange("accountNumber", e.target.value)} /> : <span>{asset.accountNumber || "N/A"}</span>}
                          </td>
                          {/* 5. Security Type */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("securityType", true, securityTypes, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 6. Strategy Type */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("strategyType", true, strategyTypes, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 7. Call */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("call", true, calls, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 8. Sector */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("sector", true, sectors, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 9. Market */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("market", true, markets, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 10. Currency */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("currency", true, currencies, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 11. Mgt Style — N/A if missing */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? renderField("managementStyle", true, managementStyles, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50") : (
                              <span className="inline-flex items-center">
                                <LockedFieldIcon
                                  isLocked={asset.userOverrides?.managementStyle === true}
                                  onUnlock={() => handleUnlockField(asset, "managementStyle")}
                                  label={LOCKABLE_FIELD_LABELS.managementStyle}
                                />
                                <span>{asset.managementStyle || "N/A"}</span>
                              </span>
                            )}
                          </td>
                          {/* 12. Mgt Fee % — Companies are legitimately 0; otherwise NotFoundCell when null */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? renderField("managementFee", false, [], "number") : (
                              <span className="inline-flex items-center">
                                <LockedFieldIcon
                                  isLocked={asset.userOverrides?.managementFee === true}
                                  onUnlock={() => handleUnlockField(asset, "managementFee")}
                                  label={LOCKABLE_FIELD_LABELS.managementFee}
                                />
                                {asset.securityType === "Company" ? <span>0.00%</span> : renderNumber(asset.managementFee, "%", 2)}
                              </span>
                            )}
                          </td>
                          {/* 13. Quantity */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("quantity", false, [], "number")}</td>
                          {/* 14. Live $ — backslash fix */}
                          <td className="px-3 py-3 text-emerald-600 dark:text-emerald-400 font-medium">
                            {isEditing ? (
                              <input type="number" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={editForm.liveTickerPrice ?? 0} onChange={e => handleEditChange('liveTickerPrice', parseFloat(e.target.value) || 0)} />
                            ) : (
                              (() => {
                                const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
                                const numPrice = Number(price);
                                return isNaN(numPrice) ? "N/A" : `$${numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })()
                            )}
                          </td>
                          {/* 15. Book Cost */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("bookCost", false, [], "number")}</td>
                          {/* 16. Market Value */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300 font-semibold">{renderField("marketValue", false, [], "number")}</td>
                          {/* 17. Profit/Loss */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("profitLoss", false, [], "number")}</td>
                          {/* 18. Yield % */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? renderField("yield", false, [], "number") : renderPercent(asset.yield)}
                          </td>
                          {/* 19. 1YR Return % */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? renderField("oneYearReturn", false, [], "number") : renderPercent(asset.oneYearReturn)}
                          </td>
                          {/* 20. 3YR Return % */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? <input type="number" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.threeYearReturn as number | null) ?? ""} onChange={(e) => handleEditChange("threeYearReturn", parseFloat(e.target.value) || 0)} /> : renderPercent(asset.threeYearReturn ?? asset.fiveYearReturn ?? null)}
                          </td>
                          {/* 21. Risk */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("risk", false, [], "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}</td>
                          {/* 22. Expected Div */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("expectedAnnualDividends", false, [], "number")}</td>
                          {/* 23. Ext. Rating */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? renderField("externalRating", false, [], "text") : naIndicator(asset.externalRating)}
                          </td>
                          {/* 24. Ex-Div Date */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? <input type="text" className="w-24 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.exDividendDate as string) ?? ""} onChange={(e) => handleEditChange("exDividendDate", e.target.value)} /> : naIndicator(asset.exDividendDate)}
                          </td>
                          {/* 25. Analyst */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? <input type="text" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.analystConsensus as string) ?? ""} onChange={(e) => handleEditChange("analystConsensus", e.target.value)} /> : naIndicator(asset.analystConsensus)}
                          </td>
                          {/* 26. Beta */}
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? <input type="number" className="w-16 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={(editForm.beta as number) ?? 0} onChange={(e) => handleEditChange("beta", parseFloat(e.target.value) || 0)} /> : (
                              asset.beta ? <span className={asset.riskFlag === "Risk Spike" ? "text-red-600 dark:text-red-400" : ""}>{Number(asset.beta).toLocaleString()}</span> : naIndicator(null)
                            )}
                          </td>
                          {/* Actions */}
                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {isEditing ? (
                                <button onClick={saveEdit} disabled={isSaving} className="text-teal-600 hover:text-teal-700 dark:text-teal-500 p-1">
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </button>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(asset)} className="text-blue-500 hover:text-blue-700 p-1"><Edit2 className="h-4 w-4" /></button>
                                  <button onClick={() => handleDeleteAsset(asset.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1"><Trash2 className="h-4 w-4" /></button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Ghost rows for deleted assets */}
                  {ghostAssets.map(ghost => {
                    const s = ghost.snapshot as Record<string, unknown>;
                    return (
                      <tr key={`ghost-${ghost.assetSK}`} className="audit-highlight-delete">
                        <td className="px-3 py-2 text-red-400 line-through opacity-70" colSpan={4}>{ghost.ticker}</td>
                        <td className="px-3 py-2 text-red-400 line-through opacity-70 text-right">{Number(s.quantity || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-400 line-through opacity-70 text-right">${Number(s.marketValue || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-400 line-through opacity-70 text-right">${Number(s.bookCost || 0).toLocaleString()}</td>
                        <td className="px-3 py-2 text-red-400 opacity-70 text-center" colSpan={19}>removed from portfolio</td>
                      </tr>
                    );
                  })}
                  {/* Totals Row */}
                  {(assets.length > 0 || editingId === "NEW") && (
                    <tr className="bg-neutral-100 dark:bg-neutral-800/50 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
                      <td className={`px-3 py-4 ${stickyTotalsCol1}`}></td>
                      <td className={`${stickyTotalsCol2}`}></td>
                      <td></td>
                      <td></td>
                      <td colSpan={11} className="px-3 py-4 text-right">TOTAL:</td>
                      <td className="px-3 py-4">${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td colSpan={5}></td>
                      <td className="px-3 py-4">${totalExpectedDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td colSpan={5}></td>
                    </tr>
                  )}
                </tbody>
              </table>
              <div className="p-4 flex items-center justify-center border-t border-neutral-200 dark:border-neutral-800">
                <button
                  onClick={addNewRow}
                  disabled={editingId === "NEW"}
                  className="flex items-center space-x-2 text-teal-600 dark:text-teal-500 hover:text-teal-700 font-medium text-sm disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Row</span>
                </button>
              </div>
            </div>
          </div>

          {/* Dividend Summary Section */}
          {assets.length > 0 && (
            <div className="glass-panel overflow-hidden">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-colors duration-300">
                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 flex items-center">
                  <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-500 mr-2" />
                  Dividend Summary
                </h3>
                <select
                  value={dividendPeriod}
                  onChange={(e) => setDividendPeriod(Number(e.target.value))}
                  className="px-3 py-1.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value={1}>Next Month</option>
                  <option value={3}>Next 3 Months</option>
                  <option value={6}>Next 6 Months</option>
                  <option value={12}>Next 12 Months</option>
                </select>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center">
                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">
                      Expected Dividends ({dividendPeriod === 1 ? "1 Month" : `${dividendPeriod} Months`})
                    </span>
                    <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      ${(totalExpectedDividends / 12 * dividendPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Monthly Average</span>
                    <span className="text-2xl font-semibold text-emerald-600 dark:text-emerald-400">
                      ${(totalExpectedDividends / 12).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 block mb-1">Annual Total</span>
                    <span className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      ${totalExpectedDividends.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
                {/* Breakdown by Strategy Type */}
                <div className="mt-6 pt-6 border-t border-neutral-200 dark:border-neutral-800">
                  <h4 className="text-sm font-semibold text-neutral-600 dark:text-neutral-400 mb-3 uppercase tracking-wider">By Strategy Type</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {Object.entries(
                      assets.reduce<Record<string, number>>((acc, a) => {
                        const key = a.strategyType || "Unclassified";
                        acc[key] = (acc[key] || 0) + (Number(a.expectedAnnualDividends) || 0);
                        return acc;
                      }, {})
                    ).sort((a, b) => b[1] - a[1]).map(([type, annual]) => (
                      <div key={type} className="bg-neutral-50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50 rounded-lg p-3">
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 block mb-1">{type}</span>
                        <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                          ${(annual / 12 * dividendPeriod).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-xs text-neutral-400 ml-1">/ {dividendPeriod}mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
      </HoldingsTab>
      <BreakdownTab
        assets={assets}
        isLoading={isLoading}
        onSwitchToHoldings={switchToHoldings}
      />
      </PortfolioTabs>
      <TimeMachineDrawer
        isOpen={isTimeMachineOpen} 
        onClose={() => setIsTimeMachineOpen(false)} 
        onRollbackComplete={fetchAssets}
      />
      <AuditToast 
        toasts={auditToasts} 
        onDismiss={dismissToast} 
        onViewHistory={() => setIsTimeMachineOpen(true)} 
      />
      {/* PDF Account Naming Modal */}
      {isNamingModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-2xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden slide-in-from-bottom-4 duration-300">
            <div className="p-6">
              <div className="flex items-center space-x-3 text-teal-600 mb-4">
                <div className="p-2 bg-teal-50 dark:bg-teal-900/30 rounded-lg">
                  <Upload className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Name Your Accounts</h3>
              </div>
              
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
                We detected the following account numbers in your statement. Please provide a friendly name for each (e.g. "TFSA", "RBC Margin").
              </p>

              <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                {detectedAccounts.length > 0 ? (
                  detectedAccounts.map((acctNum) => (
                    <div key={acctNum} className="space-y-1.5 p-3 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800">
                      <label className="text-xs font-bold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider flex justify-between">
                        <span>Account Number</span>
                        <span className="text-neutral-900 dark:text-neutral-200">{acctNum}</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter account name..."
                        className="w-full p-2.5 text-sm rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                        value={accountNameMappings[acctNum] || ""}
                        onChange={(e) => setAccountNameMappings(prev => ({ ...prev, [acctNum]: e.target.value }))}
                        autoFocus
                      />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-xl border border-dashed border-neutral-200 dark:border-neutral-700">
                    <p className="text-sm text-neutral-500">No specific account numbers detected.</p>
                    <p className="text-xs text-neutral-400 mt-1">Default name will be used.</p>
                  </div>
                )}
              </div>

              <div className="mt-8 flex items-center justify-end space-x-3">
                <button
                  onClick={() => {
                    setIsNamingModalOpen(false);
                    setPendingPdfFile(null);
                  }}
                  className="px-4 py-2 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!pendingPdfFile) return;
                    setIsNamingModalOpen(false);
                    setIsUploading(true);
                    setMessage({ text: 'Finalizing PDF import...', type: 'success' });

                    try {
                      const formData = new FormData();
                      formData.append('file', pendingPdfFile);
                      formData.append('accountMappings', JSON.stringify(accountNameMappings));

                      const res = await fetch('/api/portfolio-pdf', { method: 'POST', body: formData });
                      const data = await res.json();
                      
                      if (res.ok) {
                        setMessage({ text: `Imported ${data.count} holdings.`, type: 'success' });
                        
                        // Set row highlights logic
                        if (data.mutations && Array.isArray(data.mutations)) {
                          const highlights: Record<string, 'CREATE' | 'UPDATE' | 'DELETE'> = {};
                          const ghosts: Array<{ ticker: string; assetSK: string; snapshot: Record<string, unknown> }> = [];

                          for (const m of data.mutations) {
                            highlights[m.assetSK] = m.action;
                            if (m.action === 'DELETE') {
                              ghosts.push({ ticker: m.ticker, assetSK: m.assetSK, snapshot: m.before || {} });
                            }
                          }
                          setHighlightedRows(highlights);
                          setGhostAssets(ghosts);
                          setTimeout(() => {
                            setHighlightedRows({});
                            setGhostAssets([]);
                          }, 10000);
                        }
                        
                        fetchAssets();
                      } else {
                        setMessage({ text: data.error || 'Failed to import PDF', type: 'error' });
                      }
                    } catch (err) {
                      console.error(err);
                      setMessage({ text: 'Error finalizing import', type: 'error' });
                    } finally {
                      setIsUploading(false);
                      setPendingPdfFile(null);
                    }
                  }}
                  className="px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-teal-500/20 transition-all flex items-center space-x-2"
                >
                  <span>Finish Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
