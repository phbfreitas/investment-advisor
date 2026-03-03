"use client";

import { useState, useEffect } from "react";
import { Wallet, Save, Loader2, AlertCircle, Plus, Trash2 } from "lucide-react";

type CashFlowRow = {
    id: string; // for React key
    year: string;
    month: string;
    income: string | number;
    expenses: string | number;
    cashReserves: string | number;
}

export default function FinanceSummaryClient() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [rows, setRows] = useState<CashFlowRow[]>([]);

    useEffect(() => {
        async function loadCashFlows() {
            try {
                const res = await fetch("/api/cashflow");
                const data = await res.json();

                if (data && Array.isArray(data) && data.length > 0) {
                    const formattedRows = data.map(item => ({
                        id: crypto.randomUUID(),
                        year: item.year || "",
                        month: item.month || "",
                        income: item.income || "",
                        expenses: item.expenses || "",
                        cashReserves: item.cashReserves || ""
                    }));
                    // Sort by year-month descending
                    formattedRows.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
                    setRows(formattedRows);
                } else {
                    // Default empty row
                    const now = new Date();
                    setRows([{
                        id: crypto.randomUUID(),
                        year: now.getFullYear().toString(),
                        month: String(now.getMonth() + 1).padStart(2, '0'),
                        income: "",
                        expenses: "",
                        cashReserves: ""
                    }]);
                }
            } catch (error) {
                console.error("Failed to load cash flows", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadCashFlows();
    }, []);

    const handleAddRow = () => {
        setRows([
            ...rows,
            { id: crypto.randomUUID(), year: "", month: "", income: "", expenses: "", cashReserves: "" }
        ]);
    };

    const handleRemoveRow = (id: string) => {
        setRows(rows.filter(r => r.id !== id));
    };

    const handleChange = (id: string, field: keyof CashFlowRow, value: string) => {
        setRows(rows.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ text: "", type: "" });

        // Basic validation
        for (const row of rows) {
            if (!row.year || !row.month) {
                setMessage({ text: "Year and Month are required for all rows.", type: "error" });
                setIsSaving(false);
                return;
            }
        }

        const payload = rows.map(r => ({
            year: r.year.padStart(4, '0'),
            month: r.month.padStart(2, '0'),
            income: r.income ? parseFloat(r.income.toString()) : 0,
            expenses: r.expenses ? parseFloat(r.expenses.toString()) : 0,
            cashReserves: r.cashReserves ? parseFloat(r.cashReserves.toString()) : 0,
        }));

        try {
            const res = await fetch("/api/cashflow", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to save");

            // Sort state logically so if users added old dates at the top it auto corrects
            const savedRows = [...rows];
            savedRows.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
            setRows(savedRows);

            setMessage({ text: "Finance Summary saved successfully.", type: "success" });
        } catch (error) {
            setMessage({ text: "Error saving. Please try again.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
            </div>
        );
    }

    return (
        <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
            <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
                <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">My Finance Summary</h1>
            </header>

            <div className="w-full p-4 md:p-8">
                <div className="max-w-5xl mx-auto pb-20">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Wallet className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Actual Monthly Cash Flow</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Track your income, expenses, and total available cash reserves over time.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {message.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <AlertCircle className="h-5 w-5" />
                                <span>{message.text}</span>
                            </div>
                        )}

                        <div className="glass-panel overflow-hidden rounded-2xl">
                            <div className="overflow-x-auto custom-scrollbar">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-neutral-100/50 dark:bg-[#111] border-b border-neutral-200 dark:border-neutral-800">
                                            <th className="px-4 py-4 font-medium text-sm text-neutral-500 dark:text-neutral-400">Year</th>
                                            <th className="px-4 py-4 font-medium text-sm text-neutral-500 dark:text-neutral-400">Month</th>
                                            <th className="px-4 py-4 font-medium text-sm text-neutral-500 dark:text-neutral-400">Income</th>
                                            <th className="px-4 py-4 font-medium text-sm text-neutral-500 dark:text-neutral-400">Expenses</th>
                                            <th className="px-4 py-4 font-medium text-sm text-neutral-500 dark:text-neutral-400">Cash Reserves</th>
                                            <th className="px-4 py-4 w-12"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                                        {rows.map((row) => (
                                            <tr key={row.id} className="hover:bg-neutral-50/50 dark:hover:bg-neutral-900/50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        placeholder="YYYY"
                                                        value={row.year}
                                                        onChange={(e) => handleChange(row.id, 'year', e.target.value)}
                                                        className="w-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3">
                                                    <input
                                                        type="text"
                                                        placeholder="MM"
                                                        value={row.month}
                                                        onChange={(e) => handleChange(row.id, 'month', e.target.value)}
                                                        className="w-16 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50 text-center"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <span className="absolute left-7 top-5 text-sm text-neutral-400 dark:text-neutral-500">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={row.income}
                                                        onChange={(e) => handleChange(row.id, 'income', e.target.value)}
                                                        className="w-full min-w-[120px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <span className="absolute left-7 top-5 text-sm text-neutral-400 dark:text-neutral-500">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={row.expenses}
                                                        onChange={(e) => handleChange(row.id, 'expenses', e.target.value)}
                                                        className="w-full min-w-[120px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <span className="absolute left-7 top-5 text-sm text-neutral-400 dark:text-neutral-500">$</span>
                                                    <input
                                                        type="number"
                                                        placeholder="0.00"
                                                        value={row.cashReserves}
                                                        onChange={(e) => handleChange(row.id, 'cashReserves', e.target.value)}
                                                        className="w-full min-w-[120px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveRow(row.id)}
                                                        className="text-neutral-400 hover:text-red-500 transition-colors p-2"
                                                        title="Remove Row"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-neutral-50/30 dark:bg-neutral-900/10 border-t border-neutral-200 dark:border-neutral-800 p-4">
                                <button
                                    type="button"
                                    onClick={handleAddRow}
                                    className="flex items-center space-x-2 text-sm font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span>Add Row</span>
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-end pt-4">
                            <button
                                type="submit"
                                disabled={isSaving}
                                className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Save className="h-5 w-5" />
                                )}
                                <span>{isSaving ? "Saving..." : "Save Finance Summary"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
