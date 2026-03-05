"use client";

import { useEffect, useState } from "react";
import DashboardClient from "../dashboard/DashboardClient";
import FinanceSummaryClient from "../finance-summary/FinanceSummaryClient";
import ProfileClient from "../profile/ProfileClient";
import GuidanceClient from "../profile/guidance/GuidanceClient";

const mockAssets = [
    { id: "1", ticker: "VFV.TO", name: "Vanguard S&P 500 Index ETF", quantity: 150, bookCost: 15000, marketValue: 18500, yield: 1.2, category: "Equity", sector: "Index" },
    { id: "2", ticker: "HYLD.TO", name: "Hamilton Enhanced Multi-Sector Covered Call ETF", quantity: 500, bookCost: 6000, marketValue: 5800, yield: 12.5, category: "Income", sector: "Mixed" },
    { id: "3", ticker: "JEPQ", name: "JPMorgan Nasdaq Equity Premium Income ETF", quantity: 100, bookCost: 5000, marketValue: 5200, yield: 9.8, category: "Income", sector: "Tech" },
];

const mockProfile = {
    strategy: "I am building a high-conviction dividend growth portfolio aimed at reaching $4,000/month in passive income by 2027. My focus is on a mix of high-yield covered call ETFs (Bucket B) for immediate cash flow and strong dividend-raising companies (Bucket A) for long-term growth.",
    goals: "$4,000 monthly income by 2027. Mortgage-free by 2035.",
    riskTolerance: 80
};

export default function ScreenshotCapturePage() {
    const [view, setView] = useState("dashboard");

    return (
        <div className="p-8 bg-neutral-50 dark:bg-neutral-950 min-h-screen">
            <div className="fixed top-4 right-4 z-[9999] flex space-x-2 bg-white/80 dark:bg-black/80 p-2 rounded-lg border border-neutral-200 dark:border-neutral-800 backdrop-blur-md">
                <button onClick={() => setView("dashboard")} className="px-3 py-1 rounded hover:bg-teal-500 hover:text-white transition-colors">Dashboard</button>
                <button onClick={() => setView("finance")} className="px-3 py-1 rounded hover:bg-teal-500 hover:text-white transition-colors">Finance</button>
                <button onClick={() => setView("profile")} className="px-3 py-1 rounded hover:bg-teal-500 hover:text-white transition-colors">Profile</button>
                <button onClick={() => setView("guidance")} className="px-3 py-1 rounded hover:bg-teal-500 hover:text-white transition-colors">Guidance</button>
            </div>

            <div className="max-w-7xl mx-auto shadow-2xl rounded-2xl overflow-hidden border border-neutral-200 dark:border-neutral-800">
                {view === "dashboard" && (
                    <div className="bg-white dark:bg-[#0a0a0a]">
                        {/* Mocking the Dashboard Layout */}
                        <div className="p-8">
                            <h1 className="text-2xl font-semibold mb-6">Investment Portfolio</h1>
                            <div className="glass-panel p-6 mb-8 flex justify-between">
                                <div>
                                    <p className="text-sm text-neutral-500">Total Portfolio Value</p>
                                    <p className="text-3xl font-bold text-teal-600">$29,500.00</p>
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-500">Total Monthly Yield</p>
                                    <p className="text-3xl font-bold text-teal-600">$185.20</p>
                                </div>
                                <div>
                                    <p className="text-sm text-neutral-500">Overall Yield %</p>
                                    <p className="text-3xl font-bold text-teal-600">7.5%</p>
                                </div>
                            </div>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-neutral-200 dark:border-neutral-800">
                                        <th className="py-4 font-medium">Ticker</th>
                                        <th className="py-4 font-medium">Quantity</th>
                                        <th className="py-4 font-medium">Market Value</th>
                                        <th className="py-4 font-medium">Yield %</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {mockAssets.map(asset => (
                                        <tr key={asset.id} className="border-b border-neutral-100 dark:border-neutral-900/50">
                                            <td className="py-4 font-bold text-teal-600">{asset.ticker}</td>
                                            <td className="py-4">{asset.quantity}</td>
                                            <td className="py-4 font-medium">${asset.marketValue.toLocaleString()}</td>
                                            <td className="py-4 text-teal-500">{asset.yield}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {view === "finance" && (
                    <div className="bg-white dark:bg-[#0a0a0a] p-8">
                        <h1 className="text-2xl font-semibold mb-6">Finance Summary</h1>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-medium mb-4">Budget Monthly Cashflow</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between"><span>Monthly Gross Income</span><span className="font-medium">$8,500.00</span></div>
                                    <div className="flex justify-between"><span>Total Expenses</span><span className="font-medium text-red-500">$5,200.00</span></div>
                                    <div className="border-t pt-2 flex justify-between font-bold text-teal-600"><span>Net Savings</span><span>$3,300.00</span></div>
                                </div>
                            </div>
                            <div className="glass-panel p-6">
                                <h3 className="text-lg font-medium mb-4">Personal Wealth</h3>
                                <div className="space-y-4">
                                    <div className="flex justify-between"><span>Real Estate Equity</span><span className="font-medium">$450,000.00</span></div>
                                    <div className="flex justify-between"><span>Cash Reserves</span><span className="font-medium">$25,000.00</span></div>
                                    <div className="border-t pt-2 flex justify-between font-bold text-teal-600"><span>Estimated Net Worth</span><span>$1,250,000.00</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === "profile" && (
                    <div className="bg-white dark:bg-[#0a0a0a] p-8">
                        <h1 className="text-2xl font-semibold mb-6">Investment Strategy</h1>
                        <div className="space-y-8">
                            <div>
                                <label className="block text-sm font-medium text-neutral-500 mb-2">Overall Investment Strategy</label>
                                <div className="glass-panel p-4 text-neutral-800 dark:text-neutral-200 leading-relaxed italic">
                                    {mockProfile.strategy}
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-500 mb-2">Risk Tolerance (0-100)</label>
                                    <div className="text-4xl font-bold text-teal-600">80%</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-500 mb-2">Financial Goals</label>
                                    <div className="glass-panel p-4 text-sm font-light">
                                        {mockProfile.goals}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {view === "guidance" && (
                    <div className="bg-white dark:bg-[#0a0a0a] p-8">
                        <div className="flex items-center space-x-3 mb-8">
                            <div className="p-2 bg-teal-500 rounded-lg text-white font-bold">AI</div>
                            <h1 className="text-2xl font-semibold">AI Assistant Evaluation</h1>
                        </div>
                        <div className="prose dark:prose-invert max-w-none">
                            <h2 className="text-teal-600 font-bold border-b pb-2">## Executive Summary: Opportunity for VFV.TO Deployment</h2>
                            <p>Based on your current cash position of **$3,300/month** and your growth target, deploying half of this into **VFV.TO** during pullbacks align perfectly with your 50/50 Growth-to-Income strategy.</p>
                            <div className="bg-teal-500/5 border-l-4 border-teal-500 p-4 my-6">
                                <p className="font-medium italic text-neutral-800 dark:text-neutral-200">"The Household Net Savings profile indicates a readiness for tactical expansion. Prioritize Bucket A expansion for long-term compounding."</p>
                            </div>
                            <h3 className="font-bold">### Strategic Action Plan</h3>
                            <ul>
                                <li>**Halt DRIP** on high-yield assets temporarily.</li>
                                <li>**Accumulate Cash** for VFV pullbacks &gt; 3.5%.</li>
                                <li>**Maintain** mortgage paydown schedule.</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
