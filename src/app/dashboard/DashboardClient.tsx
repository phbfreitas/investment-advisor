"use client";

import { useState, useEffect } from "react";
import { Upload, Plus, RefreshCw, BarChart3, Loader2, AlertCircle, Trash2 } from "lucide-react";
import { AddAssetModal } from "@/components/AddAssetModal";

export default function DashboardPage() {
  const [assets, setAssets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "" });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [marketData, setMarketData] = useState<Record<string, any>>({});
  const [isMarketLoading, setIsMarketLoading] = useState(false);

  const fetchMarketData = async (symbols: string[]) => {
    if (symbols.length === 0) return;
    setIsMarketLoading(true);

    // Create unique set of tickers
    const uniqueTickers = Array.from(new Set(symbols));

    try {
      const promises = uniqueTickers.map(ticker =>
        fetch(`/api/market-data?ticker=${ticker}`).then(res => res.json())
      );

      const results = await Promise.all(promises);
      const newMarketData: Record<string, any> = {};

      results.forEach(data => {
        if (data && data.ticker && !data.error) {
          newMarketData[data.ticker] = data;
        }
      });

      setMarketData(newMarketData);
    } catch (error) {
      console.error("Failed to load market data", error);
    } finally {
      setIsMarketLoading(false);
    }
  };

  const fetchAssets = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/profile");
      const data = await res.json();
      if (data && data.assets) {
        setAssets(data.assets);
        fetchMarketData(data.assets.map((a: any) => a.ticker));
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;

    setIsUploading(true);
    setMessage({ text: "", type: "" });

    const file = e.target.files[0];
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to upload");

      setMessage({ text: `Successfully imported ${data.count} assets from Wealthsimple.`, type: "success" });
      fetchAssets();
    } catch (error: any) {
      setMessage({ text: error.message || "Error importing CSV.", type: "error" });
    } finally {
      setIsUploading(false);
      // Reset input
      e.target.value = "";
    }
  };

  const handleDeleteAsset = async (id: string) => {
    if (!confirm("Are you sure you want to delete this asset?")) return;

    try {
      const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete asset");
      fetchAssets();
      setMessage({ text: "Asset deleted successfully.", type: "success" });
    } catch (error: any) {
      setMessage({ text: error.message || "Failed to delete asset.", type: "error" });
    }
  };

  const totalCostBasis = assets.reduce((acc, curr) => acc + (curr.quantity * curr.averageCost), 0);
  const totalValue = assets.reduce((acc, curr) => {
    const livePrice = marketData[curr.ticker]?.currentPrice || curr.averageCost;
    return acc + (curr.quantity * livePrice);
  }, 0);

  const totalReturn = totalCostBasis > 0 ? ((totalValue - totalCostBasis) / totalCostBasis) * 100 : 0;

  const portfolioDividendYield = totalValue > 0
    ? assets.reduce((acc, curr) => {
      const livePrice = marketData[curr.ticker]?.currentPrice || curr.averageCost;
      const yieldPercent = marketData[curr.ticker]?.dividendYield || 0;
      const weight = (curr.quantity * livePrice) / totalValue;
      return acc + (weight * yieldPercent);
    }, 0)
    : 0;

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      <header className="flex-none min-h-[4rem] h-auto py-3 md:py-0 border-b border-neutral-200 dark:border-neutral-800 flex flex-col md:flex-row items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 space-y-3 md:space-y-0 transition-colors duration-300">
        <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200 w-full text-center md:text-left">KPI Dashboard</h1>

        <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-end">
          <label className="cursor-pointer flex-1 md:flex-none justify-center items-center space-x-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center">
            {isUploading ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Upload className="h-4 w-4 text-teal-600 dark:text-teal-500 shrink-0" />}
            <span className="hidden sm:inline">{isUploading ? "Uploading..." : "Import Wealthsimple CSV"}</span>
            <span className="sm:hidden">{isUploading ? "..." : "Import CSV"}</span>
            <input type="file" accept=".csv" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
          </label>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex-1 md:flex-none justify-center items-center space-x-2 bg-teal-50 dark:bg-teal-600/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100 dark:hover:bg-teal-600/30 px-2 py-2 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-colors flex text-center"
          >
            <Plus className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">Add Manual Asset</span>
            <span className="sm:hidden">Add Asset</span>
          </button>
        </div>
      </header>

      <div className="w-full p-4 md:p-8">
        <div className="max-w-6xl mx-auto space-y-8">

          {message.text && (
            <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
              <AlertCircle className="h-5 w-5" />
              <span>{message.text}</span>
            </div>
          )}

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass-panel p-6 flex flex-col justify-center">
              <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-2">Total Estimated Value</span>
              <h3 className="text-3xl font-semibold text-neutral-900 dark:text-neutral-100 flex items-center">
                \${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                {portfolioDividendYield.toFixed(2)}%
              </h3>
            </div>
          </div>

          {/* Investment Table */}
          <div className="glass-panel overflow-hidden">
            <div className="p-6 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between transition-colors duration-300">
              <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 flex items-center">
                <BarChart3 className="h-5 w-5 text-teal-600 dark:text-teal-500 mr-2" />
                Holdings
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
                    <th className="px-6 py-4">Ticker</th>
                    <th className="px-6 py-4">Quantity</th>
                    <th className="px-6 py-4">Avg Cost</th>
                    <th className="px-6 py-4">Live Price</th>
                    <th className="px-6 py-4">Total Value</th>
                    <th className="px-6 py-4">Change</th>
                    <th className="px-6 py-4">Source</th>
                    <th className="px-6 py-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 transition-colors duration-300">
                  {assets.length === 0 && !isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                        No assets found. Import a CSV or add manually to see your portfolio.
                      </td>
                    </tr>
                  ) : (
                    assets.map((asset) => {
                      const mData = marketData[asset.ticker];
                      const livePrice = mData?.currentPrice || asset.averageCost;
                      const returnPct = ((livePrice - asset.averageCost) / asset.averageCost) * 100;

                      return (
                        <tr key={asset.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-900/30 transition-colors">
                          <td className="px-6 py-4 font-medium text-neutral-900 dark:text-neutral-200">{asset.ticker}</td>
                          <td className="px-6 py-4 text-neutral-700 dark:text-neutral-300">{asset.quantity.toLocaleString()}</td>
                          <td className="px-6 py-4 text-neutral-700 dark:text-neutral-300">\${asset.averageCost.toFixed(2)}</td>

                          <td className="px-6 py-4 text-neutral-900 dark:text-neutral-100">
                            {mData ? `\$${livePrice.toFixed(2)}` : <span className="text-neutral-400 dark:text-neutral-500">Wait...</span>}
                          </td>

                          <td className="px-6 py-4 text-neutral-800 dark:text-neutral-200">
                            \${(asset.quantity * livePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>

                          <td className={`px-6 py-4 font-medium ${returnPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {returnPct > 0 ? "+" : ""}{returnPct.toFixed(2)}%
                          </td>

                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${asset.institution === 'Wealthsimple'
                              ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-500'
                              : 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400'
                              }`}>
                              {asset.institution || 'Manual'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteAsset(asset.id)} className="text-neutral-400 dark:text-neutral-500 hover:text-red-600 dark:hover:text-red-400 transition-colors">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>

      <AddAssetModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => { setIsModalOpen(false); fetchAssets(); }}
      />
    </div>
  );
}
