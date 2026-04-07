"use client";

import { useState, useEffect } from "react";
import { X, ChevronRight, MessageSquare, Loader2 } from "lucide-react";
import { personas, PersonaId } from "@/lib/personas-data";
import { PanelResponse } from "@/components/PanelResponse";
import type { ChatExchange } from "@/types";

interface TranscriptArchiveProps {
    onClose: () => void;
}

interface DayGroup {
    label: string;
    exchanges: ChatExchange[];
}

function groupByDate(exchanges: ChatExchange[]): DayGroup[] {
    const groups: Map<string, ChatExchange[]> = new Map();
    const formatter = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    for (const ex of exchanges) {
        const timestamp = ex.SK.replace("CHAT#", "");
        const dateKey = new Date(timestamp).toDateString();
        if (!groups.has(dateKey)) groups.set(dateKey, []);
        groups.get(dateKey)!.push(ex);
    }

    return Array.from(groups.entries()).map(([dateKey, exs]) => ({
        label: formatter.format(new Date(dateKey)),
        exchanges: exs,
    }));
}

export function TranscriptArchive({ onClose }: TranscriptArchiveProps) {
    const [exchanges, setExchanges] = useState<ChatExchange[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedExchange, setExpandedExchange] = useState<string | null>(null);
    const [collapsedDays, setCollapsedDays] = useState<Set<string>>(new Set());

    useEffect(() => {
        async function fetchArchive() {
            try {
                const res = await fetch("/api/chat/history?limit=50");
                if (res.ok) {
                    const data = await res.json();
                    setExchanges(data.exchanges || []);
                }
            } catch (err) {
                console.error("Failed to fetch transcript archive:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchArchive();
    }, []);

    const dayGroups = groupByDate(exchanges);

    const toggleDay = (label: string) => {
        setCollapsedDays((prev) => {
            const next = new Set(prev);
            if (next.has(label)) next.delete(label);
            else next.add(label);
            return next;
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-[#0a0a0a] border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-5 border-b border-neutral-200 dark:border-neutral-800">
                    <div>
                        <h2 className="text-lg font-bold text-neutral-900 dark:text-white">Transcript Archive</h2>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                            {exchanges.length} exchange{exchanges.length !== 1 ? "s" : ""} on record
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    >
                        <X className="h-5 w-5 text-neutral-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-20">
                            <Loader2 className="h-6 w-6 text-teal-500 animate-spin" />
                        </div>
                    ) : exchanges.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 text-center">
                            <MessageSquare className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mb-3" />
                            <p className="text-sm text-neutral-500 dark:text-neutral-400">No conversations yet.</p>
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">Chat with your advisors to build your transcript history.</p>
                        </div>
                    ) : (
                        dayGroups.map((group) => (
                            <div key={group.label}>
                                {/* Day Header */}
                                <button
                                    onClick={() => toggleDay(group.label)}
                                    className="flex items-center gap-2 w-full mb-3 group"
                                >
                                    <ChevronRight className={`h-4 w-4 text-neutral-400 transition-transform ${collapsedDays.has(group.label) ? "" : "rotate-90"}`} />
                                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{group.label}</h3>
                                    <span className="text-[10px] font-medium text-neutral-400 dark:text-neutral-500 bg-neutral-100 dark:bg-neutral-800 px-2 py-0.5 rounded-full">
                                        {group.exchanges.length}
                                    </span>
                                    <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
                                </button>

                                {!collapsedDays.has(group.label) && (
                                    <div className="space-y-2 ml-6">
                                        {group.exchanges.map((ex) => {
                                            const isExpanded = expandedExchange === ex.SK;
                                            const timestamp = ex.SK.replace("CHAT#", "");
                                            const time = new Date(timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
                                            const successResponses = ex.responses.filter((r) => r.status === "success");

                                            return (
                                                <div key={ex.SK} className="border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                                                    <button
                                                        onClick={() => setExpandedExchange(isExpanded ? null : ex.SK)}
                                                        className="flex items-start gap-3 w-full p-3 text-left hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-colors"
                                                    >
                                                        <ChevronRight className={`h-4 w-4 text-neutral-400 mt-0.5 flex-shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-neutral-800 dark:text-neutral-200 line-clamp-2">{ex.userMessage}</p>
                                                            <div className="flex items-center gap-2 mt-1.5">
                                                                <div className="flex -space-x-1">
                                                                    {successResponses.map((r) => {
                                                                        const p = personas[r.personaId as PersonaId];
                                                                        return p ? (
                                                                            <span key={r.personaId} className="h-5 w-5 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-[10px] ring-1 ring-white dark:ring-[#0a0a0a]">
                                                                                {p.avatar}
                                                                            </span>
                                                                        ) : null;
                                                                    })}
                                                                </div>
                                                                <span className="text-[10px] text-neutral-400">{time}</span>
                                                            </div>
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="px-4 pb-4 border-t border-neutral-200 dark:border-neutral-800 pt-3">
                                                            <PanelResponse responses={successResponses} />
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
