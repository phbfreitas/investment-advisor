"use client";

import { useState, useEffect } from "react";
import { Wallet, Save, Loader2, AlertCircle, Plus, Trash2, LineChart, Home, Landmark } from "lucide-react";
import type { BudgetData, RentalData, WealthData } from "@/types";

type CashFlowRow = {
    id: string;
    year: string;
    month: string;
    income: string | number;
    expenses: string | number;
    cashReserves: string | number;
}

const formatCurrencyInput = (value: string | number) => {
    if (value === null || value === undefined) return '';
    const stringValue = value.toString();
    const cleanValue = stringValue.replace(/[^\d.-]/g, '');
    if (cleanValue === '' || cleanValue === '-' || cleanValue === '.') return cleanValue;

    const parts = cleanValue.split('.');
    let wholePart = parts[0];
    const decimalPart = parts.length > 1 ? '.' + parts[1] : '';

    const isNegative = wholePart.startsWith('-');
    if (isNegative) wholePart = wholePart.substring(1);

    wholePart = wholePart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (isNegative ? '-' : '') + wholePart + decimalPart;
};

type InputChangeEvent = { target: { name: string; value: string } };

const InputField = ({ label, name, value, onChange }: { label: string; name: string; value: string | number; onChange: (e: InputChangeEvent) => void }) => {
    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const unformatted = e.target.value.replace(/,/g, '');
        onChange({ target: { name, value: unformatted } });
    };

    return (
        <div>
            <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1">{label}</label>
            <div className="relative">
                <span className="absolute left-3 top-2.5 text-neutral-400 dark:text-neutral-500 text-sm">$</span>
                <input
                    type="text"
                    inputMode="decimal"
                    name={name}
                    value={formatCurrencyInput(value)}
                    onChange={handleLocalChange}
                    placeholder="0.00"
                    className="w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 transition-colors"
                />
            </div>
        </div>
    );
};

export default function FinanceSummaryClient() {
    const [isLoading, setIsLoading] = useState(true);
    const [lastSavedDates, setLastSavedDates] = useState({ budget: "", rental: "", wealth: "" });

    // Budget State
    const [isSavingBudget, setIsSavingBudget] = useState(false);
    const [budgetMessage, setBudgetMessage] = useState({ text: "", type: "" });
    const [budgetData, setBudgetData] = useState({
        budgetPaycheck: "",
        budgetDividends: "",
        budgetBonus: "",
        budgetOtherIncome: "",
        budgetFixedHome: "",
        budgetFixedUtilities: "",
        budgetFixedCar: "",
        budgetFixedFood: "",
        budgetDiscretionary: "",
    });

    // Rental State
    const [isSavingRental, setIsSavingRental] = useState(false);
    const [rentalMessage, setRentalMessage] = useState({ text: "", type: "" });
    const [rentalData, setRentalData] = useState({
        budgetRentalIncome: "",
        budgetRentalExpenses: "",
    });

    // Actuals State
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [rows, setRows] = useState<CashFlowRow[]>([]);

    // Initial States for Dirty Checking
    const [initialBudgetData, setInitialBudgetData] = useState<BudgetData | null>(null);
    const [initialRentalData, setInitialRentalData] = useState<RentalData | null>(null);
    const [initialWealthData, setInitialWealthData] = useState<WealthData | null>(null);
    const [initialRows, setInitialRows] = useState<CashFlowRow[]>([]);

    // Wealth State
    const [isSavingWealth, setIsSavingWealth] = useState(false);
    const [wealthMessage, setWealthMessage] = useState({ text: "", type: "" });
    const [wealthData, setWealthData] = useState({
        wealthAssetCash: "",
        wealthAssetCar: "",
        wealthAssetPrimaryResidence: "",
        wealthAssetRentalProperties: "",
        wealthLiabilityMortgage: "",
        wealthLiabilityHeloc: "",
        wealthLiabilityRentalMortgage: "",
        wealthLiabilityRentalHeloc: "",
        wealthLiabilityCreditCards: "",
        wealthLiabilityCarLease: "",
    });
    const [totalInvestmentValue, setTotalInvestmentValue] = useState(0);
    const [isInvestmentLoading, setIsInvestmentLoading] = useState(true);

    useEffect(() => {
        async function loadData() {
            try {
                // Load Profile Budget Data
                const profileRes = await fetch("/api/profile");
                const profileData = await profileRes.json();
                const payload = profileData.Item || profileData;
                if (payload && (payload.PK || payload.id)) {
                    const newBudgetData = {
                        budgetPaycheck: payload.budgetPaycheck?.toString() || "",
                        budgetDividends: payload.budgetDividends?.toString() || "",
                        budgetBonus: payload.budgetBonus?.toString() || "",
                        budgetOtherIncome: payload.budgetOtherIncome?.toString() || "",
                        budgetFixedHome: payload.budgetFixedHome?.toString() || "",
                        budgetFixedUtilities: payload.budgetFixedUtilities?.toString() || "",
                        budgetFixedCar: payload.budgetFixedCar?.toString() || "",
                        budgetFixedFood: payload.budgetFixedFood?.toString() || "",
                        budgetDiscretionary: payload.budgetDiscretionary?.toString() || "",
                    };
                    const newRentalData = {
                        budgetRentalIncome: payload.budgetRentalIncome?.toString() || "",
                        budgetRentalExpenses: payload.budgetRentalExpenses?.toString() || "",
                    };
                    const newWealthData = {
                        wealthAssetCash: payload.wealthAssetCash?.toString() || "",
                        wealthAssetCar: payload.wealthAssetCar?.toString() || "",
                        wealthAssetPrimaryResidence: payload.wealthAssetPrimaryResidence?.toString() || "",
                        wealthAssetRentalProperties: payload.wealthAssetRentalProperties?.toString() || "",
                        wealthLiabilityMortgage: payload.wealthLiabilityMortgage?.toString() || "",
                        wealthLiabilityHeloc: payload.wealthLiabilityHeloc?.toString() || "",
                        wealthLiabilityRentalMortgage: payload.wealthLiabilityRentalMortgage?.toString() || "",
                        wealthLiabilityRentalHeloc: payload.wealthLiabilityRentalHeloc?.toString() || "",
                        wealthLiabilityCreditCards: payload.wealthLiabilityCreditCards?.toString() || "",
                        wealthLiabilityCarLease: payload.wealthLiabilityCarLease?.toString() || "",
                    };

                    setBudgetData(newBudgetData);
                    setInitialBudgetData(newBudgetData);
                    setRentalData(newRentalData);
                    setInitialRentalData(newRentalData);
                    setWealthData(newWealthData);
                    setInitialWealthData(newWealthData);

                    if (payload.updatedAt) {
                        const formattedDate = new Date(payload.updatedAt).toLocaleString();
                        setLastSavedDates({ budget: formattedDate, rental: formattedDate, wealth: formattedDate });
                    }
                }

                // Fetch Investment Values
                if (profileData.assets && profileData.assets.length > 0) {
                    const totalVal = profileData.assets.reduce((acc: number, curr: { marketValue?: unknown }) => {
                        return acc + (Number(curr.marketValue) || 0);
                    }, 0);
                    setTotalInvestmentValue(totalVal);
                    setIsInvestmentLoading(false);
                } else {
                    setIsInvestmentLoading(false);
                }

                // Load Historical Cash Flows
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
                    formattedRows.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
                    setRows(formattedRows);
                    setInitialRows(formattedRows);
                } else {
                    const now = new Date();
                    const emptyRow = [{
                        id: crypto.randomUUID(),
                        year: now.getFullYear().toString(),
                        month: String(now.getMonth() + 1).padStart(2, '0'),
                        income: "",
                        expenses: "",
                        cashReserves: ""
                    }];
                    setRows(emptyRow);
                    setInitialRows(emptyRow);
                }
            } catch (error) {
                console.error("Failed to load data", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadData();
    }, []);

    // Handlers
    const handleBudgetChange = (e: InputChangeEvent) => {
        setBudgetData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleRentalChange = (e: InputChangeEvent) => {
        setRentalData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const saveProfilePartial = async (
        payload: Record<string, number | null>,
        setStatusMessage: (msg: { text: string; type: string }) => void,
        setSavingState: (saving: boolean) => void,
        section: 'budget' | 'rental' | 'wealth'
    ) => {
        setSavingState(true);
        setStatusMessage({ text: "", type: "" });
        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Failed to save");
            const savedData = await res.json();

            setStatusMessage({ text: "Saved successfully.", type: "success" });
            if (savedData.updatedAt) {
                const newDate = new Date(savedData.updatedAt).toLocaleString();
                setLastSavedDates(prev => ({ ...prev, [section]: newDate }));
            }
        } catch (error) {
            setStatusMessage({ text: "Error saving.", type: "error" });
        } finally {
            setSavingState(false);
        }
    };

    const handleBudgetSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            budgetPaycheck: budgetData.budgetPaycheck ? parseFloat(budgetData.budgetPaycheck) : null,
            budgetDividends: budgetData.budgetDividends ? parseFloat(budgetData.budgetDividends) : null,
            budgetBonus: budgetData.budgetBonus ? parseFloat(budgetData.budgetBonus) : null,
            budgetOtherIncome: budgetData.budgetOtherIncome ? parseFloat(budgetData.budgetOtherIncome) : null,
            budgetFixedHome: budgetData.budgetFixedHome ? parseFloat(budgetData.budgetFixedHome) : null,
            budgetFixedUtilities: budgetData.budgetFixedUtilities ? parseFloat(budgetData.budgetFixedUtilities) : null,
            budgetFixedCar: budgetData.budgetFixedCar ? parseFloat(budgetData.budgetFixedCar) : null,
            budgetFixedFood: budgetData.budgetFixedFood ? parseFloat(budgetData.budgetFixedFood.replace(/,/g, '')) : null,
            budgetDiscretionary: budgetData.budgetDiscretionary ? parseFloat(budgetData.budgetDiscretionary.replace(/,/g, '')) : null,
        };
        saveProfilePartial(payload, setBudgetMessage, setIsSavingBudget, 'budget');
        setInitialBudgetData(budgetData);
    };

    const handleRentalSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            budgetRentalIncome: rentalData.budgetRentalIncome ? parseFloat(rentalData.budgetRentalIncome.replace(/,/g, '')) : null,
            budgetRentalExpenses: rentalData.budgetRentalExpenses ? parseFloat(rentalData.budgetRentalExpenses.replace(/,/g, '')) : null,
        };
        saveProfilePartial(payload, setRentalMessage, setIsSavingRental, 'rental');
        setInitialRentalData(rentalData);
    };

    const handleWealthChange = (e: InputChangeEvent) => {
        setWealthData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleWealthSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const payload = {
            wealthAssetCash: wealthData.wealthAssetCash ? parseFloat(wealthData.wealthAssetCash) : null,
            wealthAssetCar: wealthData.wealthAssetCar ? parseFloat(wealthData.wealthAssetCar) : null,
            wealthAssetPrimaryResidence: wealthData.wealthAssetPrimaryResidence ? parseFloat(wealthData.wealthAssetPrimaryResidence) : null,
            wealthAssetRentalProperties: wealthData.wealthAssetRentalProperties ? parseFloat(wealthData.wealthAssetRentalProperties) : null,
            wealthLiabilityMortgage: wealthData.wealthLiabilityMortgage ? parseFloat(wealthData.wealthLiabilityMortgage) : null,
            wealthLiabilityHeloc: wealthData.wealthLiabilityHeloc ? parseFloat(wealthData.wealthLiabilityHeloc) : null,
            wealthLiabilityRentalMortgage: wealthData.wealthLiabilityRentalMortgage ? parseFloat(wealthData.wealthLiabilityRentalMortgage.replace(/,/g, '')) : null,
            wealthLiabilityRentalHeloc: wealthData.wealthLiabilityRentalHeloc ? parseFloat(wealthData.wealthLiabilityRentalHeloc.replace(/,/g, '')) : null,
            wealthLiabilityCreditCards: wealthData.wealthLiabilityCreditCards ? parseFloat(wealthData.wealthLiabilityCreditCards.replace(/,/g, '')) : null,
            wealthLiabilityCarLease: wealthData.wealthLiabilityCarLease ? parseFloat(wealthData.wealthLiabilityCarLease.replace(/,/g, '')) : null,
        };
        saveProfilePartial(payload, setWealthMessage, setIsSavingWealth, 'wealth');
        setInitialWealthData(wealthData);
    };

    const handleAddRow = () => {
        setRows([...rows, { id: crypto.randomUUID(), year: "", month: "", income: "", expenses: "", cashReserves: "" }]);
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

            const savedRows = [...rows];
            savedRows.sort((a, b) => `${b.year}-${b.month}`.localeCompare(`${a.year}-${a.month}`));
            setRows(savedRows);
            setInitialRows(savedRows);

            setMessage({ text: "Finance Summary saved successfully.", type: "success" });
        } catch (error) {
            setMessage({ text: "Error saving. Please try again.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // Dynamic Logic
    const totalIncome = (parseFloat(budgetData.budgetPaycheck?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetDividends?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetBonus?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetOtherIncome?.replace(/,/g, '') || '0'));

    const totalExpenses = (parseFloat(budgetData.budgetFixedHome?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetFixedUtilities?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetFixedCar?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetFixedFood?.replace(/,/g, '') || '0')) +
        (parseFloat(budgetData.budgetDiscretionary?.replace(/,/g, '') || '0'));

    const totalBudgetSavings = totalIncome - totalExpenses;

    const rentalIncome = parseFloat(rentalData.budgetRentalIncome?.replace(/,/g, '') || '0');
    const rentalExpenses = parseFloat(rentalData.budgetRentalExpenses?.replace(/,/g, '') || '0');
    const rentalNetProfit = rentalIncome - rentalExpenses;

    // Wealth Calculations
    const totalAssets = (
        (parseFloat(wealthData.wealthAssetCash?.replace(/,/g, '') || '0')) +
        totalInvestmentValue +
        (parseFloat(wealthData.wealthAssetCar?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthAssetPrimaryResidence?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthAssetRentalProperties?.replace(/,/g, '') || '0'))
    );

    const totalLiabilities = (
        (parseFloat(wealthData.wealthLiabilityMortgage?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthLiabilityHeloc?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthLiabilityRentalMortgage?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthLiabilityRentalHeloc?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthLiabilityCreditCards?.replace(/,/g, '') || '0')) +
        (parseFloat(wealthData.wealthLiabilityCarLease?.replace(/,/g, '') || '0'))
    );

    const netWorth = totalAssets - totalLiabilities;

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

                    {/* BUDGET SECTION */}
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Wallet className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Budget Monthly Cashflow</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Set your baseline income and expense goals to automatically calculate your target savings.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleBudgetSubmit} className="space-y-6 mb-16">
                        {budgetMessage.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${budgetMessage.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <AlertCircle className="h-5 w-5" />
                                <span>{budgetMessage.text}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Income Group */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Income</h3>
                                    <span className="text-teal-600 dark:text-teal-500 font-semibold text-lg">${totalIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Paycheck" name="budgetPaycheck" value={budgetData.budgetPaycheck} onChange={handleBudgetChange} />
                                    <InputField label="Dividends" name="budgetDividends" value={budgetData.budgetDividends} onChange={handleBudgetChange} />
                                    <InputField label="Bonus" name="budgetBonus" value={budgetData.budgetBonus} onChange={handleBudgetChange} />
                                    <InputField label="Other" name="budgetOtherIncome" value={budgetData.budgetOtherIncome} onChange={handleBudgetChange} />
                                </div>
                            </div>

                            {/* Expenses Group */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Expenses</h3>
                                    <span className="text-red-500 dark:text-red-400 font-semibold text-lg">${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Fixed: Home" name="budgetFixedHome" value={budgetData.budgetFixedHome} onChange={handleBudgetChange} />
                                    <InputField label="Fixed: Utilities" name="budgetFixedUtilities" value={budgetData.budgetFixedUtilities} onChange={handleBudgetChange} />
                                    <InputField label="Fixed: Car" name="budgetFixedCar" value={budgetData.budgetFixedCar} onChange={handleBudgetChange} />
                                    <InputField label="Fixed: Food" name="budgetFixedFood" value={budgetData.budgetFixedFood} onChange={handleBudgetChange} />
                                    <InputField label="Discretionary" name="budgetDiscretionary" value={budgetData.budgetDiscretionary} onChange={handleBudgetChange} />
                                </div>
                            </div>

                            {/* Savings Group */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col items-center justify-center bg-teal-50/50 dark:bg-teal-900/10">
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800 pb-2 w-full text-center">Savings</h3>
                                <div className="text-4xl font-bold text-teal-600 dark:text-teal-400 mt-4 tracking-tight">
                                    ${totalBudgetSavings.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                    Total Income - Total Expenses
                                </p>
                                {lastSavedDates.budget && (
                                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-auto pt-2">
                                        Last saved: {lastSavedDates.budget}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingBudget || JSON.stringify(budgetData) === JSON.stringify(initialBudgetData)}
                                className="flex items-center space-x-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-white dark:text-neutral-900 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSavingBudget ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                <span>{isSavingBudget ? "Saving Budget..." : "Save Budget"}</span>
                            </button>
                        </div>
                    </form>

                    <hr className="border-t border-neutral-200 dark:border-neutral-800 mb-12" />

                    {/* ACTUALS SECTION */}
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <LineChart className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Actual Monthly Cash Flow</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Track your observed income, expenses, and total available cash reserves over time.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 mb-16">
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
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={formatCurrencyInput(row.income)}
                                                        onChange={(e) => handleChange(row.id, 'income', e.target.value.replace(/,/g, ''))}
                                                        className="w-full min-w-[120px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <span className="absolute left-7 top-5 text-sm text-neutral-400 dark:text-neutral-500">$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={formatCurrencyInput(row.expenses)}
                                                        onChange={(e) => handleChange(row.id, 'expenses', e.target.value.replace(/,/g, ''))}
                                                        className="w-full min-w-[120px] bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50"
                                                    />
                                                </td>
                                                <td className="px-4 py-3 relative">
                                                    <span className="absolute left-7 top-5 text-sm text-neutral-400 dark:text-neutral-500">$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        placeholder="0.00"
                                                        value={formatCurrencyInput(row.cashReserves)}
                                                        onChange={(e) => handleChange(row.id, 'cashReserves', e.target.value.replace(/,/g, ''))}
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
                                disabled={isSaving || JSON.stringify(rows) === JSON.stringify(initialRows)}
                                className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                    <Save className="h-5 w-5" />
                                )}
                                <span>{isSaving ? "Saving..." : "Save Actuals"}</span>
                            </button>
                        </div>
                    </form>

                    <hr className="border-t border-neutral-200 dark:border-neutral-800 mb-12" />

                    {/* RENTAL CASHFLOW SECTION */}
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Home className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Rental Cashflow</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Monitor the dedicated income and expenses specifically related to your rental properties.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleRentalSubmit} className="space-y-6">
                        {rentalMessage.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${rentalMessage.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <AlertCircle className="h-5 w-5" />
                                <span>{rentalMessage.text}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Rental Income */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Income</h3>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Rental Income" name="budgetRentalIncome" value={rentalData.budgetRentalIncome} onChange={handleRentalChange} />
                                </div>
                            </div>

                            {/* Rental Expenses */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Expenses</h3>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Rental Expenses" name="budgetRentalExpenses" value={rentalData.budgetRentalExpenses} onChange={handleRentalChange} />
                                </div>
                            </div>

                            {/* Rental Net Profit/Loss */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col items-center justify-center bg-teal-50/50 dark:bg-teal-900/10">
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800 pb-2 w-full text-center">Net Profit / Loss</h3>
                                <div className={`text-4xl font-bold mt-4 tracking-tight ${rentalNetProfit >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'}`}>
                                    ${rentalNetProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                    Rental Income - Rental Expenses
                                </p>
                                {lastSavedDates.rental && (
                                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-auto pt-2">
                                        Last saved: {lastSavedDates.rental}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingRental || JSON.stringify(rentalData) === JSON.stringify(initialRentalData)}
                                className="flex items-center space-x-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-white dark:text-neutral-900 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSavingRental ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                <span>{isSavingRental ? "Saving Rental Cashflow..." : "Save Rental Cashflow"}</span>
                            </button>
                        </div>
                    </form>

                    <hr className="border-t border-neutral-200 dark:border-neutral-800 mb-12 mt-12" />

                    {/* PERSONAL WEALTH SECTION */}
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Landmark className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Personal Wealth</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Track your overall Net Worth by keeping your assets and liabilities up to date over time.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleWealthSubmit} className="space-y-6">
                        {wealthMessage.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${wealthMessage.type === 'success' ? 'bg-teal-500/10 text-teal-400 border border-teal-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                <AlertCircle className="h-5 w-5" />
                                <span>{wealthMessage.text}</span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Assets */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Assets</h3>
                                    <span className="text-sm font-semibold text-teal-600 dark:text-teal-400">
                                        Total: ${totalAssets.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Cash" name="wealthAssetCash" value={wealthData.wealthAssetCash} onChange={handleWealthChange} />

                                    {/* Auto-synced Investment Field */}
                                    <div>
                                        <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-1 flex items-center justify-between">
                                            Investment (Synced from Portfolio)
                                            {isInvestmentLoading && <Loader2 className="h-3 w-3 animate-spin text-teal-500 ml-2" />}
                                        </label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-neutral-500 dark:text-neutral-400 text-sm">$</span>
                                            <input
                                                type="text"
                                                disabled
                                                value={totalInvestmentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                className="w-full bg-neutral-100/50 dark:bg-neutral-800/50 border border-neutral-200 dark:border-neutral-700 rounded-lg pl-7 pr-3 py-2 text-sm text-neutral-500 dark:text-neutral-400 cursor-not-allowed"
                                            />
                                        </div>
                                    </div>

                                    <InputField label="Car" name="wealthAssetCar" value={wealthData.wealthAssetCar} onChange={handleWealthChange} />
                                    <InputField label="Primary Residence" name="wealthAssetPrimaryResidence" value={wealthData.wealthAssetPrimaryResidence} onChange={handleWealthChange} />
                                    <InputField label="Rental Properties" name="wealthAssetRentalProperties" value={wealthData.wealthAssetRentalProperties} onChange={handleWealthChange} />
                                </div>
                            </div>

                            {/* Liabilities */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4">
                                <div className="flex justify-between items-end border-b border-neutral-200 dark:border-neutral-800 pb-2">
                                    <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Liabilities</h3>
                                    <span className="text-sm font-semibold text-red-500 dark:text-red-400">
                                        Total: ${totalLiabilities.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <InputField label="Primary Residence Mortgage" name="wealthLiabilityMortgage" value={wealthData.wealthLiabilityMortgage} onChange={handleWealthChange} />
                                    <InputField label="Personal HELOCs" name="wealthLiabilityHeloc" value={wealthData.wealthLiabilityHeloc} onChange={handleWealthChange} />
                                    <InputField label="Rental Property Mortgages" name="wealthLiabilityRentalMortgage" value={wealthData.wealthLiabilityRentalMortgage} onChange={handleWealthChange} />
                                    <InputField label="Rental Property HELOCs" name="wealthLiabilityRentalHeloc" value={wealthData.wealthLiabilityRentalHeloc} onChange={handleWealthChange} />
                                    <InputField label="Credit Cards" name="wealthLiabilityCreditCards" value={wealthData.wealthLiabilityCreditCards} onChange={handleWealthChange} />
                                    <InputField label="Car Lease" name="wealthLiabilityCarLease" value={wealthData.wealthLiabilityCarLease} onChange={handleWealthChange} />
                                </div>
                            </div>

                            {/* Net Worth Calculation */}
                            <div className="glass-panel p-6 rounded-2xl space-y-4 flex flex-col items-center justify-center bg-teal-50/50 dark:bg-teal-900/10">
                                <h3 className="text-lg font-medium text-neutral-900 dark:text-neutral-200 border-b border-neutral-200 dark:border-neutral-800 pb-2 w-full text-center">Net Worth</h3>
                                <div className={`text-4xl font-bold mt-4 tracking-tight ${netWorth >= 0 ? 'text-teal-600 dark:text-teal-400' : 'text-red-500 dark:text-red-400'}`}>
                                    ${netWorth.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-2">
                                    Total Assets - Total Liabilities
                                </p>
                                {lastSavedDates.wealth && (
                                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-auto pt-2">
                                        Last saved: {lastSavedDates.wealth}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={isSavingWealth || JSON.stringify(wealthData) === JSON.stringify(initialWealthData)}
                                className="flex items-center space-x-2 bg-neutral-900 dark:bg-neutral-100 hover:bg-neutral-800 dark:hover:bg-white text-white dark:text-neutral-900 px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSavingWealth ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                <span>{isSavingWealth ? "Saving Personal Wealth..." : "Save Personal Wealth"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
