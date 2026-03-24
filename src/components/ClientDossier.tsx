"use client";

import { useState } from "react";
import { BrainCircuit, Target, TrendingUp, AlertTriangle, CheckCircle2, FileText, Trash2, X, RotateCcw, BookOpen } from "lucide-react";
import { personas, PersonaId } from "@/lib/personas";
import type { PersonaSummaryInfo } from "@/types";

const PERSONA_IDS: PersonaId[] = ["barsi", "bogle", "buffett", "graham", "gunther", "housel", "kiyosaki"];

const SECTION_CONFIG = [
    { key: "Investment Thesis", icon: BrainCircuit, color: "text-indigo-500" },
    { key: "Current Asset Focus", icon: TrendingUp, color: "text-teal-500" },
    { key: "Risk Parameters", icon: Target, color: "text-amber-500" },
    { key: "Active Dilemmas", icon: AlertTriangle, color: "text-rose-500" },
    { key: "Key Decisions", icon: CheckCircle2, color: "text-emerald-500" },
];

const SUMMARY_THRESHOLD = 3;

interface ClientDossierProps {
    summaries: Record<string, PersonaSummaryInfo>;
    personaExchangeCounts: Record<string, number>;
    onOpenArchive: () => void;
    onResetMemory: (personaId?: string) => void;
    isMobileDrawer?: boolean;
    onClose?: () => void;
    loading?: boolean;
}

function parseSections(text: string): Record<string, string> {
    const sections: Record<string, string> = {};
    // Split on lines starting with ### (using multiline regex)
    const parts = text.split(/^### /m).filter(Boolean);

    for (const part of parts) {
        const newlineIdx = part.indexOf("\n");
        if (newlineIdx === -1) continue;
        const title = part.slice(0, newlineIdx).trim();
        const content = part.slice(newlineIdx + 1).trim();
        sections[title] = content;
    }

    return sections;
}

export function ClientDossier({ summaries, personaExchangeCounts, onOpenArchive, onResetMemory, isMobileDrawer, onClose, loading }: ClientDossierProps) {
    const [activePersona, setActivePersona] = useState<PersonaId | null>(null);
    const [confirmReset, setConfirmReset] = useState<string | null>(null);

    const activeSummary = activePersona ? summaries[activePersona] : null;
    const parsedSections = activeSummary?.text ? parseSections(activeSummary.text) : null;
    const persona = activePersona ? personas[activePersona] : null;

    const hasAnyMemory = Object.values(summaries).some((s) => s !== null);

    return (
        <div className={`flex flex-col h-full bg-neutral-50/50 dark:bg-[#080808] ${isMobileDrawer ? "" : "border-r border-neutral-200 dark:border-neutral-800"}`}>
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Advisor Notebook</h2>
                    {activeSummary && (
                        <p className="text-[10px] text-neutral-400 dark:text-neutral-500 mt-0.5">
                            {activeSummary.exchangeCount} exchanges &bull; Updated {new Date(activeSummary.lastUpdated).toLocaleDateString()}
                        </p>
                    )}
                </div>
                {isMobileDrawer && onClose && (
                    <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors">
                        <X className="h-5 w-5 text-neutral-500" />
                    </button>
                )}
            </div>

            {/* Advisor Selector */}
            <div className="p-3 border-b border-neutral-200 dark:border-neutral-800">
                <div className="relative">
                    <select
                        value={activePersona ?? ""}
                        onChange={(e) => { setActivePersona((e.target.value || null) as PersonaId | null); setConfirmReset(null); }}
                        className="w-full appearance-none bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-neutral-700 dark:text-neutral-300 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500 transition-colors cursor-pointer"
                    >
                        <option value="">Select an Advisor</option>
                        {PERSONA_IDS.map((pid) => {
                            const p = personas[pid];
                            const hasSummary = summaries[pid] !== null;
                            return (
                                <option key={pid} value={pid}>
                                    {p.avatar} {p.name}{hasSummary ? " \u2022" : ""}
                                </option>
                            );
                        })}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5">
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                </div>
            </div>

            {/* Notebook Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {loading ? (
                    /* Loading skeleton */
                    <div className="space-y-4 animate-pulse py-4">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-800" />
                            <div className="space-y-2 flex-1">
                                <div className="h-3 w-32 bg-neutral-200 dark:bg-neutral-800 rounded" />
                                <div className="h-2 w-20 bg-neutral-200 dark:bg-neutral-800 rounded" />
                            </div>
                        </div>
                        <div className="space-y-3">
                            <div className="h-3 w-3/4 bg-neutral-200 dark:bg-neutral-800 rounded" />
                            <div className="h-3 w-full bg-neutral-200 dark:bg-neutral-800 rounded" />
                            <div className="h-3 w-5/6 bg-neutral-200 dark:bg-neutral-800 rounded" />
                            <div className="h-3 w-2/3 bg-neutral-200 dark:bg-neutral-800 rounded" />
                        </div>
                        <div className="pt-4 space-y-3">
                            <div className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                            <div className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                            <div className="h-16 bg-neutral-200 dark:bg-neutral-800 rounded-xl" />
                        </div>
                        <p className="text-xs text-center text-neutral-400 dark:text-neutral-500 pt-2">Loading advisor notebook...</p>
                    </div>
                ) : !activePersona ? (
                    /* No advisor selected */
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center mb-4">
                            <BrainCircuit className="h-6 w-6 text-neutral-400" />
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mb-1">
                            Select an advisor
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px]">
                            Choose an advisor above to view their notebook about your investment profile.
                        </p>
                    </div>
                ) : !parsedSections ? (
                    /* Advisor selected but no memory */
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl mb-4">
                            {persona!.avatar}
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mb-1">
                            No memory yet
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px]">
                            Chat with {persona!.name} to build their understanding of your investment profile.
                        </p>
                        {/* Progress indicator toward first summary */}
                        {(() => {
                            const count = personaExchangeCounts[activePersona] || 0;
                            if (count === 0) return null;
                            return (
                                <div className="mt-4 w-full max-w-[220px]">
                                    <div className="flex items-center justify-between text-[10px] text-neutral-400 dark:text-neutral-500 mb-1.5">
                                        <span>{count} of {SUMMARY_THRESHOLD} exchanges</span>
                                        <span>until first notebook entry</span>
                                    </div>
                                    <div className="h-1.5 bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-teal-500 rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, (count / SUMMARY_THRESHOLD) * 100)}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <>
                        {/* Our Journey So Far — narrative centerpiece */}
                        {parsedSections["Our Journey So Far"] && parsedSections["Our Journey So Far"] !== "None discussed yet." && (
                            <div className="glass-panel p-4 space-y-2 bg-gradient-to-br from-indigo-50/30 via-white to-teal-50/30 dark:from-indigo-950/10 dark:via-neutral-900/50 dark:to-teal-900/10 border-indigo-200/50 dark:border-indigo-800/30">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                                    <h4 className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">Our Journey So Far</h4>
                                </div>
                                <p className="text-sm leading-relaxed text-neutral-700 dark:text-neutral-300 whitespace-pre-line">
                                    {parsedSections["Our Journey So Far"]}
                                </p>
                            </div>
                        )}

                        {/* Structured section cards */}
                        {SECTION_CONFIG.map(({ key, icon: Icon, color }) => {
                            const content = parsedSections[key];
                            const isEmpty = !content || content === "None discussed yet.";
                            return (
                                <div key={key} className="glass-panel p-3.5 space-y-1.5">
                                    <div className="flex items-center gap-2">
                                        <Icon className={`h-3.5 w-3.5 ${color}`} />
                                        <h4 className="text-xs font-semibold uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{key}</h4>
                                    </div>
                                    <p className={`text-sm leading-relaxed ${isEmpty
                                        ? "text-neutral-400 dark:text-neutral-600 italic"
                                        : "text-neutral-700 dark:text-neutral-300"
                                        }`}>
                                        {isEmpty ? `Not yet discussed with ${persona!.name.split(" ")[0]}` : content}
                                    </p>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Footer Actions */}
            <div className="border-t border-neutral-200 dark:border-neutral-800 p-4 space-y-2">
                <button
                    onClick={onOpenArchive}
                    className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                    <FileText className="h-3.5 w-3.5" />
                    View Transcript Archive
                </button>

                {confirmReset === null ? (
                    <div className="flex gap-2">
                        {activeSummary && (
                            <button
                                onClick={() => setConfirmReset(activePersona)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <Trash2 className="h-3 w-3" />
                                Reset {persona!.name.split(" ")[0]}
                            </button>
                        )}
                        {hasAnyMemory && (
                            <button
                                onClick={() => setConfirmReset("all")}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium text-neutral-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                            >
                                <RotateCcw className="h-3 w-3" />
                                Reset All
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3 space-y-2">
                        <p className="text-xs text-red-700 dark:text-red-400">
                            {confirmReset === "all"
                                ? "All advisors will forget everything about you."
                                : `${persona!.name} will forget all prior conversations with you.`}
                        </p>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmReset(null)}
                                className="px-3 py-1 rounded text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onResetMemory(confirmReset === "all" ? undefined : confirmReset);
                                    setConfirmReset(null);
                                }}
                                className="px-3 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                            >
                                Confirm Reset
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
