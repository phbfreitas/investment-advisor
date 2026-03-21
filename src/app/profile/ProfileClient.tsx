"use client";

import { useState, useEffect, useMemo } from "react";
import { BrainCircuit, Save, Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import type { Asset, StrategyConfig } from "@/types";
import {
    PHILOSOPHY_OPTIONS,
    CORE_PRINCIPLE_OPTIONS,
    ACCOUNT_TYPE_OPTIONS,
    TRADING_METHODOLOGY_OPTIONS,
    SECTOR_KEYS,
    SECTOR_LABELS,
    GEO_KEYS,
    GEO_LABELS,
    STRATEGY_CONFIG_DEFAULTS,
    RISK_TOLERANCE_LABELS,
    RISK_TOLERANCE_MIGRATION,
} from "@/types";
import {
    calculatePortfolioDrift,
    calculatePerformanceEstimates,
    type DriftEntry,
} from "@/lib/portfolio-analytics";

// --- Collapsible Section ---

function CollapsibleSection({ title, defaultOpen = false, children }: {
    title: string;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-4 py-3 bg-neutral-100/50 dark:bg-neutral-900/50 hover:bg-neutral-100 dark:hover:bg-neutral-800/50 transition-colors"
            >
                <span className="text-sm font-semibold text-neutral-800 dark:text-neutral-200">{title}</span>
                {open ? <ChevronDown className="h-4 w-4 text-neutral-500" /> : <ChevronRight className="h-4 w-4 text-neutral-500" />}
            </button>
            {open && <div className="p-4 space-y-4">{children}</div>}
        </div>
    );
}

// --- Drift Table ---

function DriftTable({ entries, hasAssets }: { entries: DriftEntry[]; hasAssets: boolean }) {
    if (!entries.length) return <p className="text-sm text-neutral-500">Set your targets to enable drift tracking.</p>;

    return (
        <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="text-neutral-500 text-xs uppercase">
                        <th className="text-left pb-2">Sector</th>
                        <th className="text-center pb-2">Target</th>
                        <th className="text-center pb-2">Actual</th>
                        <th className="text-center pb-2">Drift</th>
                    </tr>
                </thead>
                <tbody>
                    {entries.map((e) => (
                        <tr key={e.key} className="border-t border-neutral-200/50 dark:border-neutral-800/50">
                            <td className="py-1.5 text-neutral-800 dark:text-neutral-200">{e.label}</td>
                            <td className="py-1.5 text-center text-neutral-600 dark:text-neutral-400">{e.target}%</td>
                            <td className="py-1.5 text-center text-neutral-500">
                                {hasAssets ? `${e.actual}%` : "N/A"}
                            </td>
                            <td className={`py-1.5 text-center font-medium ${
                                !hasAssets ? "text-neutral-500" :
                                e.warning ? "text-red-500" :
                                e.drift >= 0 ? "text-green-500" : "text-amber-500"
                            }`}>
                                {hasAssets ? (
                                    <>
                                        {e.drift > 0 ? "+" : ""}{e.drift}%
                                        {e.warning && " \u26A0"}
                                    </>
                                ) : "N/A"}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// --- Main Component ---

interface FormData {
    strategy: string;
    riskTolerance: number;
    goals: string;
    // Strategy config
    assetMixGrowth: number;
    assetMixIncome: number;
    assetMixMixed: number;
    philosophies: string[];
    corePrinciples: string[];
    accountTypes: string[];
    tradingMethodologies: string[];
    sectorAllocation: Record<string, number>;
    geographicExposure: Record<string, number>;
    targetAnnualReturn: number;
    targetMonthlyDividend: number;
}

const DEFAULT_FORM: FormData = {
    strategy: "",
    goals: "",
    ...STRATEGY_CONFIG_DEFAULTS,
};

export default function ProfilePage() {
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });
    const [formData, setFormData] = useState<FormData>({ ...DEFAULT_FORM });
    const [initialData, setInitialData] = useState<FormData>({ ...DEFAULT_FORM });
    const [assets, setAssets] = useState<Asset[]>([]);

    useEffect(() => {
        async function loadProfile() {
            try {
                const res = await fetch("/api/profile");
                const data = await res.json();
                const payload = data.Item || data;

                if (payload && (payload.PK || payload.id)) {
                    const rawRisk = payload.riskTolerance;
                    const riskValue = typeof rawRisk === 'string'
                        ? (RISK_TOLERANCE_MIGRATION[rawRisk] ?? 5)
                        : (typeof rawRisk === 'number' ? rawRisk : 5);

                    const loadedData: FormData = {
                        strategy: payload.strategy || "",
                        riskTolerance: riskValue,
                        goals: payload.goals || "",
                        assetMixGrowth: payload.assetMixGrowth || 0,
                        assetMixIncome: payload.assetMixIncome || 0,
                        assetMixMixed: payload.assetMixMixed || 0,
                        philosophies: payload.philosophies || [],
                        corePrinciples: payload.corePrinciples || [],
                        accountTypes: payload.accountTypes || [],
                        tradingMethodologies: payload.tradingMethodologies || [],
                        sectorAllocation: payload.sectorAllocation || {},
                        geographicExposure: payload.geographicExposure || {},
                        targetAnnualReturn: payload.targetAnnualReturn || 0,
                        targetMonthlyDividend: payload.targetMonthlyDividend || 0,
                    };
                    setFormData(loadedData);
                    setInitialData(loadedData);
                    setAssets(payload.assets || []);
                }
            } catch (error) {
                console.error("Failed to load profile", error);
            } finally {
                setIsLoading(false);
            }
        }
        loadProfile();
    }, []);

    // --- Derived state ---

    const assetMixRemaining = 100 - formData.assetMixGrowth - formData.assetMixIncome - formData.assetMixMixed;
    const sectorSum = Object.values(formData.sectorAllocation).reduce((a, b) => a + b, 0);
    const sectorRemaining = 100 - sectorSum;
    const geoSum = Object.values(formData.geographicExposure).reduce((a, b) => a + b, 0);
    const geoRemaining = 100 - geoSum;

    const driftData = useMemo(
        () => calculatePortfolioDrift(formData.sectorAllocation, formData.geographicExposure, assets),
        [formData.sectorAllocation, formData.geographicExposure, assets]
    );

    const perfEstimates = useMemo(
        () => calculatePerformanceEstimates(assets),
        [assets]
    );

    const hasAssets = assets.length > 0;


    const sectorWarnings = driftData.sectorDrift.filter((d) => d.warning);
    const geoWarnings = driftData.geoDrift.filter((d) => d.warning);

    // --- Validation ---

    const validationError = useMemo(() => {
        const mixTotal = formData.assetMixGrowth + formData.assetMixIncome + formData.assetMixMixed;
        if (mixTotal > 0 && Math.abs(mixTotal - 100) > 0.01) return "Asset mix must sum to 100%";
        if (sectorSum > 0 && Math.abs(sectorSum - 100) > 0.01) return "Sector allocation must sum to 100%";
        if (geoSum > 0 && Math.abs(geoSum - 100) > 0.01) return "Geographic exposure must sum to 100%";
        return null;
    }, [formData.assetMixGrowth, formData.assetMixIncome, formData.assetMixMixed, sectorSum, geoSum]);

    const isDirty = JSON.stringify(formData) !== JSON.stringify(initialData);

    // --- Handlers ---

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNumberChange = (name: keyof FormData, value: number) => {
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleToggleArray = (field: "philosophies" | "corePrinciples" | "accountTypes" | "tradingMethodologies", value: string) => {
        setFormData(prev => {
            const arr = prev[field] as string[];
            return { ...prev, [field]: arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value] };
        });
    };

    const handleAllocationChange = (field: "sectorAllocation" | "geographicExposure", key: string, value: number) => {
        setFormData(prev => ({
            ...prev,
            [field]: { ...prev[field], [key]: value },
        }));
    };

    const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        e.target.style.height = "inherit";
        e.target.style.height = `${e.target.scrollHeight}px`;
        handleChange(e);
    };

    const handleFocusSelect = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (validationError) {
            setMessage({ text: validationError, type: "error" });
            return;
        }

        setIsSaving(true);
        setMessage({ text: "", type: "" });

        try {
            const res = await fetch("/api/profile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => null);
                throw new Error(body?.error || "Failed to save");
            }

            setMessage({ text: "Profile saved successfully.", type: "success" });
            setInitialData({ ...formData });
        } catch (error) {
            setMessage({ text: error instanceof Error ? error.message : "Error saving profile.", type: "error" });
        } finally {
            setIsSaving(false);
        }
    };

    // --- Render ---

    if (isLoading) {
        return (
            <div className="flex h-full items-center justify-center bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600 dark:text-teal-400" />
            </div>
        );
    }

    const pillGroupColors: Record<string, { active: string; inactive: string }> = {
        value: { active: "bg-purple-500/30 border-purple-500/60 text-white", inactive: "bg-purple-500/10 border-purple-500/30 text-purple-300" },
        strategy: { active: "bg-teal-500/30 border-teal-500/60 text-white", inactive: "bg-teal-500/10 border-teal-500/30 text-teal-300" },
        style: { active: "bg-amber-500/30 border-amber-500/60 text-white", inactive: "bg-amber-500/10 border-amber-500/30 text-amber-300" },
    };

    const groupLabels: Record<string, { label: string; color: string }> = {
        value: { label: "Value-Based", color: "text-purple-400" },
        strategy: { label: "Strategy-Based", color: "text-teal-400" },
        style: { label: "Style-Based", color: "text-amber-400" },
    };

    const inputClass = "w-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl px-4 py-3 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-600 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors";
    const numberInputClass = "w-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg px-3 py-2 text-center text-neutral-900 dark:text-neutral-100 focus:outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/50 transition-colors text-sm";

    return (
        <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
            <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
                <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">My Investment Strategy</h1>
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
                                Your advisors will use this persistent context to tailor their advice to your specific situation.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6 glass-panel p-4 md:p-8">

                        {message.text && (
                            <div className={`p-4 rounded-lg flex items-center space-x-3 ${message.type === "success" ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
                                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                                <span>{message.text}</span>
                            </div>
                        )}

                        {/* --- Existing: Narrative fields --- */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Overall Investment Strategy</label>
                                <textarea
                                    name="strategy"
                                    value={formData.strategy}
                                    onChange={handleTextareaInput}
                                    ref={(e) => { if (e) { e.style.height = "inherit"; e.style.height = `${e.scrollHeight}px`; } }}
                                    placeholder="e.g., I focus on dividend growth for passive income, while keeping 20% in speculative tech..."
                                    className={`${inputClass} min-h-[128px] overflow-hidden resize-none`}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Financial Goals (Short & Long Term)</label>
                                <textarea
                                    name="goals"
                                    value={formData.goals}
                                    onChange={handleTextareaInput}
                                    ref={(e) => { if (e) { e.style.height = "inherit"; e.style.height = `${e.scrollHeight}px`; } }}
                                    placeholder="e.g., Retire by 55 with absolute financial independence. Save $50k for a house downpayment in 3 years."
                                    className={`${inputClass} min-h-[96px] overflow-hidden resize-none`}
                                />
                            </div>
                        </div>

                        <CollapsibleSection title="Risk Tolerance">
                            <div className="space-y-3">
                                <input
                                    type="range"
                                    min={1}
                                    max={10}
                                    step={1}
                                    value={formData.riskTolerance}
                                    onChange={(e) =>
                                        setFormData((prev) => ({ ...prev, riskTolerance: parseInt(e.target.value) }))
                                    }
                                    className="w-full h-2 rounded-lg appearance-none cursor-pointer"
                                    style={{
                                        background: 'linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)',
                                    }}
                                />
                                <div className="flex justify-between text-xs text-neutral-500">
                                    <span>1 — Conservative</span>
                                    <span>4 — Moderate</span>
                                    <span>7 — Aggressive</span>
                                    <span>10 — Very Aggressive</span>
                                </div>
                                <p className="text-center text-sm font-semibold text-teal-500">
                                    Current: {formData.riskTolerance} — {RISK_TOLERANCE_LABELS[formData.riskTolerance] || 'Not set'}
                                </p>
                            </div>
                        </CollapsibleSection>

                        {/* --- NEW: Strategy Configuration --- */}

                        {/* Section 4: Asset Mix */}
                        <CollapsibleSection title="Asset Mix">
                            <div className="flex flex-wrap gap-4">
                                {(["Growth", "Income", "Mixed"] as const).map((label) => {
                                    const key = `assetMix${label}` as keyof FormData;
                                    return (
                                        <div key={label} className="flex-1 min-w-[100px] text-center">
                                            <label className="block text-xs text-neutral-500 mb-1">{label}</label>
                                            <input
                                                type="number" min={0} max={100} step={1}
                                                value={formData[key] as number}
                                                onChange={(e) => handleNumberChange(key, Number(e.target.value) || 0)}
                                                className={numberInputClass}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                            <div className={`text-xs text-right ${Math.abs(assetMixRemaining) < 0.01 ? "text-green-500" : "text-red-400"}`}>
                                Remaining: {Math.round(assetMixRemaining * 10) / 10}%
                            </div>
                            {/* Visual bar */}
                            {(formData.assetMixGrowth + formData.assetMixIncome + formData.assetMixMixed > 0) && (
                                <div className="flex h-6 rounded-lg overflow-hidden">
                                    {formData.assetMixGrowth > 0 && (
                                        <div style={{ width: `${formData.assetMixGrowth}%` }} className="bg-teal-500 flex items-center justify-center text-[10px] font-semibold text-black">
                                            {formData.assetMixGrowth > 10 && `Growth ${formData.assetMixGrowth}%`}
                                        </div>
                                    )}
                                    {formData.assetMixIncome > 0 && (
                                        <div style={{ width: `${formData.assetMixIncome}%` }} className="bg-purple-500 flex items-center justify-center text-[10px] font-semibold text-white">
                                            {formData.assetMixIncome > 10 && `Income ${formData.assetMixIncome}%`}
                                        </div>
                                    )}
                                    {formData.assetMixMixed > 0 && (
                                        <div style={{ width: `${formData.assetMixMixed}%` }} className="bg-amber-500 flex items-center justify-center text-[10px] font-semibold text-black">
                                            {formData.assetMixMixed > 10 && `Mixed ${formData.assetMixMixed}%`}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CollapsibleSection>

                        {/* Section 5: Investment Philosophies */}
                        <CollapsibleSection title="Investment Philosophies">
                            {(["value", "strategy", "style"] as const).map((group) => {
                                const opts = PHILOSOPHY_OPTIONS.filter((o) => o.group === group);
                                const meta = groupLabels[group];
                                const colors = pillGroupColors[group];
                                return (
                                    <div key={group}>
                                        <div className={`text-xs font-semibold uppercase tracking-wider mb-2 ${meta.color}`}>{meta.label}</div>
                                        <div className="flex flex-wrap gap-2">
                                            {opts.map((opt) => {
                                                const selected = formData.philosophies.includes(opt.value);
                                                return (
                                                    <button
                                                        key={opt.value}
                                                        type="button"
                                                        onClick={() => handleToggleArray("philosophies", opt.value)}
                                                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${selected ? colors.active : colors.inactive}`}
                                                    >
                                                        {opt.label}{selected && " \u2713"}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </CollapsibleSection>

                        {/* Section 6: Core Principles */}
                        <CollapsibleSection title="Core Principles">
                            {CORE_PRINCIPLE_OPTIONS.map((opt) => (
                                <label key={opt.value} className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.corePrinciples.includes(opt.value)}
                                        onChange={() => handleToggleArray("corePrinciples", opt.value)}
                                        className="mt-1 accent-teal-500"
                                    />
                                    <div>
                                        <div className="text-sm font-medium text-neutral-800 dark:text-neutral-200">{opt.label}</div>
                                        <div className="text-xs text-neutral-500">{opt.description}</div>
                                    </div>
                                </label>
                            ))}
                        </CollapsibleSection>

                        {/* Section 7: Account Types */}
                        <CollapsibleSection title="Account Types">
                            <div className="flex flex-wrap gap-4">
                                {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.accountTypes.includes(opt.value)}
                                            onChange={() => handleToggleArray("accountTypes", opt.value)}
                                            className="accent-teal-500"
                                        />
                                        <span className="text-sm text-neutral-800 dark:text-neutral-200">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* Section 8: Trading Methodology */}
                        <CollapsibleSection title="Trading Methodology">
                            <div className="flex flex-wrap gap-4">
                                {TRADING_METHODOLOGY_OPTIONS.map((opt) => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.tradingMethodologies.includes(opt.value)}
                                            onChange={() => handleToggleArray("tradingMethodologies", opt.value)}
                                            className="accent-teal-500"
                                        />
                                        <span className="text-sm text-neutral-800 dark:text-neutral-200">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </CollapsibleSection>

                        {/* Section 9: Sector Allocation */}
                        <CollapsibleSection title="Sector Allocation">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {SECTOR_KEYS.map((key) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <label className="text-xs text-neutral-600 dark:text-neutral-400 flex-1 min-w-0 truncate">{SECTOR_LABELS[key]}</label>
                                        <input
                                            type="number" min={0} max={100} step={1}
                                            value={formData.sectorAllocation[key] || 0}
                                            onChange={(e) => handleAllocationChange("sectorAllocation", key, Number(e.target.value) || 0)}
                                            onFocus={handleFocusSelect}
                                            className={`${numberInputClass} w-16`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className={`text-xs text-right ${Math.abs(sectorRemaining) < 0.01 ? "text-green-500" : "text-red-400"}`}>
                                Remaining: {Math.round(sectorRemaining * 10) / 10}%
                            </div>
                            {sectorWarnings.length > 0 && hasAssets && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                                    {"\u26A0"} {sectorWarnings.length} sector(s) exceed 5% drift: {sectorWarnings.map((w) => `${w.label} (${w.drift > 0 ? "+" : ""}${w.drift}%)`).join(", ")}
                                </div>
                            )}
                            <DriftTable entries={driftData.sectorDrift} hasAssets={hasAssets} />
                            {driftData.unclassifiedCount > 0 && (
                                <p className="text-xs text-amber-400">{driftData.unclassifiedCount} holding(s) unclassified</p>
                            )}
                        </CollapsibleSection>

                        {/* Section 10: Geographic Exposure */}
                        <CollapsibleSection title="Geographic Exposure">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {GEO_KEYS.map((key) => (
                                    <div key={key} className="flex items-center gap-2">
                                        <label className="text-xs text-neutral-600 dark:text-neutral-400 flex-1 min-w-0 truncate">{GEO_LABELS[key]}</label>
                                        <input
                                            type="number" min={0} max={100} step={1}
                                            value={formData.geographicExposure[key] || 0}
                                            onChange={(e) => handleAllocationChange("geographicExposure", key, Number(e.target.value) || 0)}
                                            onFocus={handleFocusSelect}
                                            className={`${numberInputClass} w-16`}
                                        />
                                    </div>
                                ))}
                            </div>
                            <div className={`text-xs text-right ${Math.abs(geoRemaining) < 0.01 ? "text-green-500" : "text-red-400"}`}>
                                Remaining: {Math.round(geoRemaining * 10) / 10}%
                            </div>
                            {geoWarnings.length > 0 && hasAssets && (
                                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-xs text-red-400">
                                    {"\u26A0"} {geoWarnings.length} region(s) exceed 5% drift: {geoWarnings.map((w) => `${w.label} (${w.drift > 0 ? "+" : ""}${w.drift}%)`).join(", ")}
                                </div>
                            )}
                            <DriftTable entries={driftData.geoDrift} hasAssets={hasAssets} />
                        </CollapsibleSection>

                        {/* Section 11: Performance Targets */}
                        <CollapsibleSection title="Performance Targets">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs text-neutral-500 mb-1">Expected Annual Return (%)</label>
                                    <input
                                        type="number" min={0} step={0.1}
                                        value={formData.targetAnnualReturn || ""}
                                        onChange={(e) => handleNumberChange("targetAnnualReturn", Number(e.target.value) || 0)}
                                        placeholder="e.g., 8.5"
                                        className={numberInputClass + " w-full"}
                                    />
                                    {hasAssets ? (
                                        <div className={`mt-2 rounded-lg p-2 text-xs border ${
                                            formData.targetAnnualReturn > perfEstimates.estimatedAnnualReturn
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                : "bg-green-500/10 border-green-500/30 text-green-400"
                                        }`}>
                                            Portfolio estimate: {perfEstimates.estimatedAnnualReturn}% based on weighted 1-year returns
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-xs text-neutral-500">Add holdings to see projections</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs text-neutral-500 mb-1">Target Monthly Dividend ($)</label>
                                    <input
                                        type="number" min={0} step={1}
                                        value={formData.targetMonthlyDividend || ""}
                                        onChange={(e) => handleNumberChange("targetMonthlyDividend", Number(e.target.value) || 0)}
                                        placeholder="e.g., 500"
                                        className={numberInputClass + " w-full"}
                                    />
                                    {hasAssets ? (
                                        <div className={`mt-2 rounded-lg p-2 text-xs border ${
                                            formData.targetMonthlyDividend > perfEstimates.estimatedMonthlyDividend
                                                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                                : "bg-green-500/10 border-green-500/30 text-green-400"
                                        }`}>
                                            Portfolio estimate: ${perfEstimates.estimatedMonthlyDividend}/mo from expected annual dividends
                                        </div>
                                    ) : (
                                        <p className="mt-2 text-xs text-neutral-500">Add holdings to see projections</p>
                                    )}
                                </div>
                            </div>
                        </CollapsibleSection>


                        {/* Save button */}
                        <div className="pt-6 flex justify-end">
                            <button
                                type="submit"
                                disabled={isSaving || !isDirty || !!validationError}
                                className="flex items-center space-x-2 bg-teal-600 hover:bg-teal-500 text-white px-6 py-3 rounded-xl font-medium transition-all disabled:opacity-50"
                            >
                                {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                                <span>{isSaving ? "Saving..." : "Save Profile"}</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
