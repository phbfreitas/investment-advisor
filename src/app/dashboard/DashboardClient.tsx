"use client";

import { useState, useEffect, useMemo } from "react";
import { Upload, Plus, RefreshCw, BarChart3, Loader2, AlertCircle, Trash2, Save, Edit2, ArrowUpDown, ArrowUp, ArrowDown, FilterX } from "lucide-react";
import type { Asset, MarketData } from "@/types";

export default function DashboardPage() {
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

  // Option lists derived from existing data
  const accounts = useMemo(() => Array.from(new Set(assets.map(a => a.account).filter(Boolean))), [assets]);
  const securityTypes = useMemo(() => Array.from(new Set(assets.map(a => a.securityType).filter(Boolean))), [assets]);
  const strategyTypes = useMemo(() => Array.from(new Set(assets.map(a => a.strategyType).filter(Boolean))), [assets]);
  const calls = useMemo(() => Array.from(new Set(assets.map(a => a.call).filter(Boolean))), [assets]);
  const sectors = useMemo(() => Array.from(new Set(assets.map(a => a.sector).filter(Boolean))), [assets]);
  const markets = useMemo(() => Array.from(new Set(assets.map(a => a.market).filter(Boolean))), [assets]);
  const currencies = useMemo(() => Array.from(new Set(assets.map(a => a.currency).filter(Boolean))), [assets]);
  const managementStyles = useMemo(() => Array.from(new Set(assets.map(a => a.managementStyle).filter(Boolean))), [assets]);
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

  useEffect(() => {
    fetchAssets();
  }, []);

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
      fetchAssets();
      setMessage({ text: "Asset row deleted.", type: "success" });
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

      setEditingId(null);
      setEditForm({});
      fetchAssets();
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
      managementFee: 0,
      quantity: 0,
      liveTickerPrice: 0,
      bookCost: 0,
      marketValue: 0,
      profitLoss: 0,
      yield: 0,
      oneYearReturn: 0,
      threeYearReturn: 0,
      exDividendDate: "",
      analystConsensus: "",
      beta: 0,
      accountNumber: "",
      accountType: "",
      risk: "",
      volatility: 0,
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

  const renderSortableHeader = (label: string, sortKey: keyof Asset) => (
    <th
      key={sortKey}
      className="px-3 py-3 font-semibold text-neutral-900 dark:text-neutral-100 cursor-pointer hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors group select-none whitespace-nowrap"
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

  const renderFilterInput = (filterKey: string, widthClass = "w-20") => (
    <td key={filterKey} className="px-2 py-2">
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
              setMessage({ text: 'Importing PDF statement...', type: 'success' });
              try {
                const formData = new FormData();
                formData.append('file', file);
                const res = await fetch('/api/portfolio-pdf', { method: 'POST', body: formData });
                const data = await res.json();
                if (res.ok) {
                  setMessage({ text: `Imported ${data.count} holdings from PDF.`, type: 'success' });
                  fetchAssets();
                } else {
                  setMessage({ text: data.error || 'PDF import failed.', type: 'error' });
                }
              } catch (err) {
                console.error('PDF import error:', err);
                setMessage({ text: 'Failed to import PDF.', type: 'error' });
              }
              e.target.value = '';
            }} />
          </label>
        </div>
      </header>

      <div className="w-full p-4 md:p-8">
        <div className="max-w-[1400px] mx-auto space-y-8">

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
                \${totalMarketValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-neutral-50 dark:bg-neutral-900/50 text-neutral-500 dark:text-neutral-400 font-medium transition-colors duration-300">
                  <tr>
                    {renderSortableHeader("Account", "account")}
                    {renderSortableHeader("Ticker", "ticker")}
                    {renderSortableHeader("Security type", "securityType")}
                    {renderSortableHeader("Strategy Type", "strategyType")}
                    {renderSortableHeader("Call", "call")}
                    {renderSortableHeader("Sector", "sector")}
                    {renderSortableHeader("Market", "market")}
                    {renderSortableHeader("Currency", "currency")}
                    {renderSortableHeader("Mgt Style", "managementStyle")}
                    {renderSortableHeader("Mgt Fee", "managementFee")}
                    {renderSortableHeader("# Tickers", "quantity")}
                    {renderSortableHeader("Live $ ticker", "liveTickerPrice")}
                    {renderSortableHeader("Book cost", "bookCost")}
                    {renderSortableHeader("Market Value", "marketValue")}
                    {renderSortableHeader("Profit/loss", "profitLoss")}
                    {renderSortableHeader("Yield", "yield")}
                    {renderSortableHeader("1 YR Return", "oneYearReturn")}
                    {renderSortableHeader("3 YR Return", "threeYearReturn")}
                    {renderSortableHeader("Risk", "risk")}
                    {renderSortableHeader("Volatility", "volatility")}
                    {renderSortableHeader("Expected Div", "expectedAnnualDividends")}
                    {renderSortableHeader("Ext. Rating", "externalRating")}
                    {renderSortableHeader("Strategy", "strategyType")}
                    {renderSortableHeader("Ex-Div Date", "exDividendDate")}
                    {renderSortableHeader("Analyst", "analystConsensus")}
                    {renderSortableHeader("Beta", "beta")}
                    {renderSortableHeader("Acct #", "accountNumber")}
                    {renderSortableHeader("Acct Type", "accountType")}
                    <th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                  <tr className="bg-neutral-50 dark:bg-neutral-900 border-b border-neutral-200 dark:border-neutral-800">
                    {renderFilterInput("account")}
                    {renderFilterInput("ticker")}
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
                    {renderFilterInput("volatility")}
                    {renderFilterInput("expectedAnnualDividends")}
                    {renderFilterInput("externalRating")}
                    {renderFilterInput("strategyType", "w-24")}
                    {renderFilterInput("exDividendDate", "w-24")}
                    {renderFilterInput("analystConsensus", "w-20")}
                    {renderFilterInput("beta", "w-16")}
                    {renderFilterInput("accountNumber", "w-20")}
                    {renderFilterInput("accountType", "w-20")}
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

                      const renderField = (field: keyof Asset, isSelect: boolean, options: string[] = [], type: string = "text", bgClass = "") => {
                        if (isEditing) {
                          if (isSelect) {
                            return (
                              <select
                                className={`w-28 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 ${bgClass}`}
                                value={(editForm[field] as string | number) || ""}
                                onChange={(e) => handleEditChange(field, e.target.value)}
                              >
                                <option value=""></option>
                                {options.map(o => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            );
                          }
                          return (
                            <input
                              type={type}
                              className={`w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900`}
                              value={(editForm[field] as string | number) ?? ""}
                              onChange={(e) => handleEditChange(field, type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
                            />
                          );
                        }

                        // Display mode
                        const displayValue = asset[field] as string | number;
                        if (type === 'number') {
                          return <span className={bgClass ? `px-2 py-0.5 rounded ${bgClass}` : ''}>{Number(displayValue || 0)?.toLocaleString()}</span>;
                        }
                        return <span className={bgClass ? `px-2 py-0.5 rounded ${bgClass}` : ''}>{displayValue}</span>;
                      };

                      return (
                        <tr key={asset.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="px-3 py-3 font-medium text-neutral-900 dark:text-neutral-200">
                            {isEditing ? (
                              <>
                                <input
                                  type="text"
                                  list="account-suggestions"
                                  className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                  value={(editForm.account as string) ?? ""}
                                  onChange={(e) => handleEditChange("account", e.target.value)}
                                />
                                <datalist id="account-suggestions">
                                  {accounts.map(a => <option key={a} value={a} />)}
                                </datalist>
                              </>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50">{asset.account}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 font-bold text-neutral-900 dark:text-neutral-100">
                            {renderField("ticker", false, [], "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("securityType", true, securityTypes, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("strategyType", true, strategyTypes, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("call", true, calls, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("sector", false, [], "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("market", true, markets, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("currency", true, currencies, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("managementStyle", true, managementStyles, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("managementFee", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("quantity", false, [], "number")}</td>
                          {/* Live Ticker: Readonly when not editing, automatically updated based on ticker input */}
                          <td className="px-3 py-3 text-emerald-600 dark:text-emerald-400 font-medium">
                            {isEditing ? (
                              <input type="number" className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900" value={editForm.liveTickerPrice ?? 0} onChange={e => handleEditChange('liveTickerPrice', parseFloat(e.target.value) || 0)} />
                            ) : (
                              (() => {
                                const price = marketData[asset.ticker]?.currentPrice ?? asset.liveTickerPrice;
                                const numPrice = Number(price);
                                return isNaN(numPrice) ? "N/A" : `\$${numPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                              })()
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("bookCost", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300 font-semibold">{renderField("marketValue", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("profitLoss", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("yield", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("oneYearReturn", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.threeYearReturn as number) ?? 0}
                                onChange={(e) => handleEditChange("threeYearReturn", parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span>{Number(asset.threeYearReturn || asset.fiveYearReturn || 0).toLocaleString()}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("risk", false, [], "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300 font-semibold">{renderField("volatility", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("expectedAnnualDividends", false, [], "number")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">{renderField("externalRating", false, [], "text")}</td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {renderField("strategyType", true, strategyTypes, "text", "bg-neutral-100/50 dark:bg-neutral-800/30 border border-neutral-200 dark:border-neutral-700/50")}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-24 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.exDividendDate as string) ?? ""}
                                onChange={(e) => handleEditChange("exDividendDate", e.target.value)}
                              />
                            ) : (
                              <span>{asset.exDividendDate}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.analystConsensus as string) ?? ""}
                                onChange={(e) => handleEditChange("analystConsensus", e.target.value)}
                              />
                            ) : (
                              <span>{asset.analystConsensus}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="number"
                                className="w-16 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.beta as number) ?? 0}
                                onChange={(e) => handleEditChange("beta", parseFloat(e.target.value) || 0)}
                              />
                            ) : (
                              <span className={asset.riskFlag === "Risk Spike" ? "text-red-600 dark:text-red-400" : ""}>
                                {Number(asset.beta || 0).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.accountNumber as string) ?? ""}
                                onChange={(e) => handleEditChange("accountNumber", e.target.value)}
                              />
                            ) : (
                              <span>{asset.accountNumber}</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-neutral-700 dark:text-neutral-300">
                            {isEditing ? (
                              <input
                                type="text"
                                className="w-20 p-1 text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                                value={(editForm.accountType as string) ?? ""}
                                onChange={(e) => handleEditChange("accountType", e.target.value)}
                              />
                            ) : (
                              <span>{asset.accountType}</span>
                            )}
                          </td>

                          <td className="px-3 py-3 text-right">
                            <div className="flex items-center justify-end space-x-2">
                              {isEditing ? (
                                <button onClick={saveEdit} disabled={isSaving} className="text-teal-600 hover:text-teal-700 dark:text-teal-500 p-1">
                                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                </button>
                              ) : (
                                <>
                                  <button onClick={() => startEdit(asset)} className="text-blue-500 hover:text-blue-700 p-1">
                                    <Edit2 className="h-4 w-4" />
                                  </button>
                                  <button onClick={() => handleDeleteAsset(asset.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors p-1">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                  {/* Totals Row */}
                  {(assets.length > 0 || editingId === "NEW") && (
                    <tr className="bg-neutral-100 dark:bg-neutral-800/50 font-bold border-t-2 border-neutral-300 dark:border-neutral-700">
                      <td colSpan={13} className="px-3 py-4 text-right">TOTAL:</td>
                      <td className="px-3 py-4">\${totalMarketValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td colSpan={6}></td>
                      <td className="px-3 py-4">\${totalExpectedDividends.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                      <td colSpan={8}></td>
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

        </div>
      </div>
    </div>
  );
}
