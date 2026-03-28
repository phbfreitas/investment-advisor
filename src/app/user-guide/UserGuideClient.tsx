'use client';

import React from 'react';
import { 
  BookOpen, 
  ShieldCheck, 
  TrendingUp, 
  PieChart, 
  Zap, 
  AlertCircle,
  CheckCircle2,
  Lock,
  RefreshCw,
  Search,
  Database
} from 'lucide-react';

interface SidebarItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const sidebarItems: SidebarItem[] = [
  { id: 'methodology', label: 'Methodology', icon: <BookOpen className="w-4 h-4" /> },
  { id: 'classification', label: 'Portfolio Classification', icon: <ShieldCheck className="w-4 h-4" /> },
  { id: 'strategies', label: 'Strategy Definitions', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'sync', label: 'Data Sync Logic', icon: <RefreshCw className="w-4 h-4" /> },
  { id: 'security', label: 'Security & Privacy', icon: <Lock className="w-4 h-4" /> },
];

export default function UserGuideClient() {
  const [activeTab, setActiveTab] = React.useState('methodology');

  const renderContent = () => {
    switch (activeTab) {
      case 'methodology':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-bold text-white mb-2">Our Methodology</h1>
              <p className="text-slate-400">How we manage and categorize your investment universe.</p>
            </header>
            
            <div className="grid gap-6 md:grid-cols-2">
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center mb-4">
                  <PieChart className="w-6 h-6 text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Rule-Based Precision</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  We use a deterministic, rules-based engine rather than simple keywords. Every asset is strictly 
                  evaluated based on quantitative metrics (Yield & Beta) fetched from institutional-grade data providers.
                </p>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700 backdrop-blur-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-4">
                  <Zap className="w-6 h-6 text-emerald-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Dynamic Rebalancing</h3>
                <p className="text-slate-400 text-sm leading-relaxed">
                  The engine re-evaluates classifications every time a statement is imported. If an asset drifts 
                  outside its yield or beta threshold, the engine flags it for strategic review.
                </p>
              </div>
            </div>
          </div>
        );

      case 'classification':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-bold text-white mb-2">Portfolio Classification</h1>
              <p className="text-slate-400">The quantitative decision tree behind your portfolio strategy.</p>
            </header>

            <div className="overflow-hidden rounded-xl border border-slate-700 bg-slate-900/50">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-slate-800/50 border-b border-slate-700">
                    <th className="px-6 py-4 font-semibold text-slate-200 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-4 font-semibold text-slate-200 uppercase tracking-wider">Yield</th>
                    <th className="px-6 py-4 font-semibold text-slate-200 uppercase tracking-wider">Risk Metric</th>
                    <th className="px-6 py-4 font-semibold text-slate-200 uppercase tracking-wider">Logic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  <tr>
                    <td className="px-6 py-4 font-medium text-white italic">Pure Growth</td>
                    <td className="px-6 py-4 text-slate-400">0.0% — 2.0%</td>
                    <td className="px-6 py-4 text-slate-400">S&P/Nasdaq Index</td>
                    <td className="px-6 py-4 text-emerald-400">High Growth</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-white italic">Pure Dividend</td>
                    <td className="px-6 py-4 text-slate-400">2.1% — 8.0%</td>
                    <td className="px-6 py-4 text-slate-400">Beta &lt; 1.0</td>
                    <td className="px-6 py-4 text-blue-400">Income/Stability</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-white italic">The Mix</td>
                    <td className="px-6 py-4 text-slate-400">&gt; 8.0%</td>
                    <td className="px-6 py-4 text-slate-400">Any</td>
                    <td className="px-6 py-4 text-amber-400">Options/High Yield</td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 font-medium text-white italic">The Mix</td>
                    <td className="px-6 py-4 text-slate-400">2.1% — 8.0%</td>
                    <td className="px-6 py-4 text-slate-400">Beta &ge; 1.0</td>
                    <td className="px-6 py-4 text-amber-400">Hybrid / Volatile</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex gap-4">
              <Search className="w-5 h-5 text-blue-400 shrink-0 mt-1" />
              <div>
                <h4 className="text-sm font-semibold text-blue-300 mb-1">Deduplication Guard</h4>
                <p className="text-slate-400 text-xs leading-relaxed">
                  If an asset matches a Canadian ticker (TSX), the engine automatically attempts to resolve it 
                  using .TO suffixes to avoid duplicate entries across US/CA exchanges.
                </p>
              </div>
            </div>
          </div>
        );

      case 'strategies':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-bold text-white mb-2">Strategy Definitions</h1>
              <p className="text-slate-400">Detailed breakdown of the three primary investment pillars.</p>
            </header>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/20">
                <h3 className="text-xl font-bold text-emerald-400 mb-3 italic">1. Pure Growth (Crescimento Puro)</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Focused on long-term capital appreciation with minimal income focus. Primary components include 
                  Standard Index ETFs (VFV, VUN, QQQ) or high-growth equity with dividends below 2.0%.
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-mono border border-emerald-500/20 uppercase tracking-wider">Aggressive</span>
                  <span className="px-2 py-1 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-mono border border-emerald-500/20 uppercase tracking-wider">Index-Based</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-blue-500/5 border border-blue-500/20">
                <h3 className="text-xl font-bold text-blue-400 mb-3 italic">2. Pure Dividend (Dividendos Puros)</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Focused on high-quality cash flow and lower-than-market volatility. Candidates must have a 
                  Beta lower than 1.0 (indicating less risk than the S&P 500) and a yield between 2.1% and 8%.
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-mono border border-blue-500/20 uppercase tracking-wider">Conservative</span>
                  <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-500 text-[10px] font-mono border border-blue-500/20 uppercase tracking-wider">Low Beta</span>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-amber-500/5 border border-amber-500/20">
                <h3 className="text-xl font-bold text-amber-400 mb-3 italic">3. The Mix (O Mix)</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-4">
                  Aggressive yield combined with market exposure. This is the home for "Yield Maximizer" assets, 
                  Covered Call strategies (e.g., HDIV, JEPQ), and high-beta hybrid assets (Yield 2-8%, Beta > 1.0).
                </p>
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-mono border border-amber-500/20 uppercase tracking-wider">Yield Enhanced</span>
                  <span className="px-2 py-1 rounded-md bg-amber-500/10 text-amber-500 text-[10px] font-mono border border-amber-500/20 uppercase tracking-wider">Derivative-Based</span>
                </div>
              </div>
            </div>
          </div>
        );

      case 'sync':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-bold text-white mb-2">Data Sync Logic</h1>
              <p className="text-slate-400">How we ensure 100% data integrity during imports.</p>
            </header>

            <div className="space-y-4">
              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">1</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Deduplication Protection</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Every import undergoes a "Gold Standard" check. We match assets across PDF statements and existing 
                      records using Ticker + Account ID to prevent duplicate values and primary key errors.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">2</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Redundancy Pruning</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Manual records that haven't appeared in your latest official brokerage statements are flagged 
                      for removal. This keeps your dashboard strictly aligned with your real assets.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-2xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                    <span className="text-white font-bold text-sm">3</span>
                  </div>
                  <div>
                    <h4 className="text-white font-semibold mb-1">Metadata Freshness</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      On every import, our engine triggers a refresh of Yahoo Finance metrics (Beta, Yield, Pricing). 
                      If the classification of an asset changes based on market data, it highlights that asset in the simulation report.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header>
              <h1 className="text-3xl font-bold text-white mb-2">Security & Privacy</h1>
              <p className="text-slate-400">Total institutional-grade encryption for your data.</p>
            </header>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-white font-medium">Bank-level Encryption</h4>
                </div>
                <p className="text-slate-500 text-xs">AES-256 encryption at rest and TLS 1.3 in transit.</p>
              </div>
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-3 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h4 className="text-white font-medium">SOC2 Compliant</h4>
                </div>
                <p className="text-slate-500 text-xs">Our infrastructure maintains industry-standard security certifications.</p>
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="max-w-7xl mx-auto flex gap-12 p-12">
        {/* Sidebar */}
        <nav className="w-64 shrink-0 space-y-1">
          <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-4 mb-4">
            Navigation
          </div>
          {sidebarItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === item.id 
                ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-lg shadow-blue-500/5' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-white border border-transparent'
              }`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
          
          <div className="mt-12 p-4 rounded-2xl bg-slate-900 border border-slate-800">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-white tracking-tight uppercase">Support</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              For manual asset overrides or account linkage issues, please contact your internal technical support.
            </p>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 max-w-3xl">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}
