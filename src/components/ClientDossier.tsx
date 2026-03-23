"use client";

import { useState } from "react";
import { BrainCircuit, Target, TrendingUp, AlertTriangle, CheckCircle2, FileText, Trash2, X, RotateCcw } from "lucide-react";
import { personas, PersonaId } from "@/lib/personas";
import type { PersonaSummaryInfo } from "@/types";

const PERSONA_IDS: PersonaId[] = ["buffett", "barsi", "gunther", "housel", "ramsey"];

const SECTION_CONFIG = [
    { key: "Investment Thesis", icon: BrainCircuit, color: "text-indigo-500" },
    { key: "Current Asset Focus", icon: TrendingUp, color: "text-teal-500" },
    { key: "Risk Parameters", icon: Target, color: "text-amber-500" },
    { key: "Active Dilemmas", icon: AlertTriangle, color: "text-rose-500" },
    { key: "Key Decisions", icon: CheckCircle2, color: "text-emerald-500" },
];

interface ClientDossierProps {
    summaries: Record<string, PersonaSummaryInfo>;
    onOpenArchive: () => void;
    onResetMemory: (personaId?: string) => void;
    isMobileDrawer?: boolean;
    onClose?: () => void;
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

export function ClientDossier({ summaries, onOpenArchive, onResetMemory, isMobileDrawer, onClose }: ClientDossierProps) {
    const [activePersona, setActivePersona] = useState<PersonaId>(PERSONA_IDS[0]);
    const [confirmReset, setConfirmReset] = useState<string | null>(null);

    const activeSummary = summaries[activePersona];
    const parsedSections = activeSummary?.text ? parseSections(activeSummary.text) : null;
    const persona = personas[activePersona];

    const hasAnyMemory = Object.values(summaries).some((s) => s !== null);

    return (
        <div className={`flex flex-col h-full bg-neutral-50/50 dark:bg-[#080808] ${isMobileDrawer ? "" : "border-r border-neutral-200 dark:border-neutral-800"}`}>
            {/* Header */}
            <div className="p-4 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Client Dossier</h2>
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

            {/* Advisor Tabs */}
            <div className="flex gap-1.5 p-3 border-b border-neutral-200 dark:border-neutral-800 overflow-x-auto custom-scrollbar">
                {PERSONA_IDS.map((pid) => {
                    const p = personas[pid];
                    const hasSummary = summaries[pid] !== null;
                    return (
                        <button
                            key={pid}
                            onClick={() => { setActivePersona(pid); setConfirmReset(null); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap flex-shrink-0 ${activePersona === pid
                                ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 ring-1 ring-teal-500/30"
                                : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                }`}
                        >
                            <span className="text-sm">{p.avatar}</span>
                            <span className="hidden sm:inline">{p.name.split(" ")[0]}</span>
                            {hasSummary && (
                                <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Dossier Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
                {!parsedSections ? (
                    /* Empty state */
                    <div className="flex flex-col items-center justify-center h-full text-center px-4 py-12">
                        <div className="h-12 w-12 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-2xl mb-4">
                            {persona.avatar}
                        </div>
                        <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium mb-1">
                            No memory yet
                        </p>
                        <p className="text-xs text-neutral-400 dark:text-neutral-500 max-w-[200px]">
                            Chat with {persona.name} to build their understanding of your investment profile.
                        </p>
                    </div>
                ) : (
                    /* Structured section cards */
                    SECTION_CONFIG.map(({ key, icon: Icon, color }) => {
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
                                    {isEmpty ? `Not yet discussed with ${persona.name.split(" ")[0]}` : content}
                                </p>
                            </div>
                        );
                    })
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
                                Reset {persona.name.split(" ")[0]}
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
                                : `${persona.name} will forget all prior conversations with you.`}
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
