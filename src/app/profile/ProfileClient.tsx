"use client";

import { useState, useEffect } from "react";
import { BrainCircuit, Save, Loader2, AlertCircle } from "lucide-react";

export default function ProfilePage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    const [formData, setFormData] = useState({
        strategy: "",
        riskTolerance: "",
        goals: "",
        monthlyIncome: "",
        monthlyExpenses: "",
        cashReserves: "",
    });

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch("/api/profile");
                const data = await res.json();

                const payload = data.Item || data; // Handle both raw DynamoDB and flattened objects

                if (payload && (payload.PK || payload.id)) {
                    setFormData({
                        strategy: payload.strategy || "",
                        riskTolerance: payload.riskTolerance || "",
                        goals: payload.goals || "",
                        monthlyIncome: payload.monthlyIncome?.toString() || "",
                        monthlyExpenses: payload.monthlyExpenses?.toString() || "",
                        cashReserves: payload.cashReserves?.toString() || "",
                    });
                }
            } catch (error) {
                console.error("Failed to load profile", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadProfile();
    }, []);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setMessage({ text: "", type: "" });

        // Convert strings to floats for numeric fields
        const payload = {
            ...formData,
            monthlyIncome: formData.monthlyIncome ? parseFloat(formData.monthlyIncome) : null,
            monthlyExpenses: formData.monthlyExpenses ? parseFloat(formData.monthlyExpenses) : null,
            cashReserves: formData.cashReserves ? parseFloat(formData.cashReserves) : null,
        };

        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) throw new Error("Failed to save");

            setMessage({ text: "Profile saved successfully.", type: "success" });
        } catch (error) {
            setMessage({ text: "Error saving profile. Please try again.", type: "error" });
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
                <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">My Financial Brain</h1>
            </header>

            <div className="w-full p-4 md:p-8">
                <div className="max-w-3xl mx-auto pb-20">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <BrainCircuit className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Personal Context</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Warren will use this persistent context to tailor his advice to your specific situation.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-8 glass-panel p-4 md:p-8">

                        {message.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <AlertCircle className="h-5 w-5" />
                                <span>{message.text}</span>
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Overall Investment Strategy</label>
                                <textarea
                                    name="strategy"
                                    value={formData.strategy}
                                    onChange={handleChange}
                                    placeholder="e.g., I focus on dividend growth for passive income, while keeping 20% in speculative tech..."
                                    className="w-full h-32 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors custom-scrollbar"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Financial Goals (Short & Long Term)</label>
                                <textarea
                                    name="goals"
                                    value={formData.goals}
                                    onChange={handleChange}
                                    placeholder="e.g., Retire by 55 with absolute financial independence. Save $50k for a house downpayment in 3 years."
                                    className="w-full h-24 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors custom-scrollbar"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Risk Tolerance</label>
                                <select
                                    name="riskTolerance"
                                    value={formData.riskTolerance}
                                    onChange={handleChange}
                                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors appearance-none"
                                >
                                    <option value="">Select your risk tolerance...</option>
                                    <option value="Conservative">Conservative (Capital preservation is priority)</option>
                                    <option value="Moderate">Moderate (Balance of growth and safety)</option>
                                    <option value="Aggressive">Aggressive (Maximum growth, high volatility tolerance)</option>
                                    <option value="Speculative">Speculative (Willing to risk principal for huge rewards)</option>
                                </select>
                            </div>
                        </div>

                        <div className="pt-6 border-t border-neutral-200 dark:border-neutral-800">
                            <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 mb-4">Cash Flow (Optional)</h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Monthly Income</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-neutral-400 dark:text-neutral-500">$</span>
                                        <input
                                            type="number"
                                            name="monthlyIncome"
                                            value={formData.monthlyIncome}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-8 pr-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Monthly Expenses</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-neutral-400 dark:text-neutral-500">$</span>
                                        <input
                                            type="number"
                                            name="monthlyExpenses"
                                            value={formData.monthlyExpenses}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-8 pr-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Cash Reserves</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-3 text-neutral-400 dark:text-neutral-500">$</span>
                                        <input
                                            type="number"
                                            name="cashReserves"
                                            value={formData.cashReserves}
                                            onChange={handleChange}
                                            placeholder="0.00"
                                            className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl pl-8 pr-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-6 flex justify-end">
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
                                <span>{isSaving ? "Saving..." : "Save Profile"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div >
        </div >
    );
}
