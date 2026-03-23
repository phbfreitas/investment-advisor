"use client";

import { useState } from "react";
import {
    Globe, Loader2, Shield, Search, ArrowLeftRight, Newspaper,
    Scale, Zap, X, ChevronRight, RefreshCw, Clock, AlertTriangle, CheckCircle2, Circle, Layers
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const DIRECTIVE_NAMES: Record<number, string> = {
    1: "Net Worth Stress Test",
    2: "Deep Buy Scanner",
    3: "Opportunity Cost Evaluator",
    4: "Cross-Sectional Impact Report",
    5: "Full Strategy Critic",
};

const DIRECTIVES = [
    { id: 1, title: "Net Worth Stress Test", desc: "Assess total financial health against this week's macro events.", icon: Shield },
    { id: 2, title: "Deep Buy Scanner", desc: "Find panic-driven value opportunities with low risk correlation.", icon: Search },
    { id: 3, title: "Opportunity Cost Evaluator", desc: "Identify dead money sectors and optimal rotations.", icon: ArrowLeftRight },
    { id: 4, title: "Cross-Sectional Impact Report", desc: "Map weekly news to your 40/40/20 allocation.", icon: Newspaper },
    { id: 5, title: "Full Strategy Critic", desc: "Compare your portfolio against global asset classes.", icon: Scale },
    { id: 6, title: "Deep Critique", desc: "Run all 5 analyses and get a unified executive report.", icon: Zap },
    { id: 7, title: "Total Integration", desc: "News + Strategy + Portfolio: full impact analysis with rebalancing signals.", icon: Layers },
];

export default function GlobalRadarClient() {
    const [activeDirective, setActiveDirective] = useState<number | null>(null);
    const [radarResponse, setRadarResponse] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [radarError, setRadarError] = useState("");
    const [lastUpdated, setLastUpdated] = useState<string | null>(null);
    const [changedFields, setChangedFields] = useState<string[]>([]);
    const [isWarningDismissed, setIsWarningDismissed] = useState(false);
    const [completedAnalyses, setCompletedAnalyses] = useState<Record<number, "complete" | "failed">>({});

    const handleCardClick = (directiveId: number) => {
        setActiveDirective(directiveId);
        setRadarResponse("");
        setRadarError("");
        setLastUpdated(null);
        setChangedFields([]);
        setIsWarningDismissed(false);
        setCompletedAnalyses({});
        fetchRadar(directiveId);
    };

    const fetchRadar = async (directiveId: number, forceRefresh = false) => {
        setIsLoading(true);
        setRadarResponse("");
        setRadarError("");
        setLastUpdated(null);
        setChangedFields([]);
        setIsWarningDismissed(false);
        setCompletedAnalyses({});

        try {
            const res = await fetch("/api/global-radar", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ directiveId, forceRefresh }),
            });

            const updatedHeader = res.headers.get("X-Radar-Last-Updated");
            if (updatedHeader) {
                setLastUpdated(updatedHeader);
            } else if (forceRefresh || res.ok) {
                setLastUpdated(new Date().toISOString());
            }

            const changedFieldsHeader = res.headers.get("X-Radar-Changed-Fields");
            if (changedFieldsHeader) {
                try {
                    setChangedFields(JSON.parse(changedFieldsHeader));
                } catch {
                    console.error("Failed to parse changed fields header");
                }
            }

            if (!res.ok) {
                let errorMessage = `Failed to generate analysis (Status: ${res.status})`;
                const contentType = res.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                    try {
                        const errData = await res.json();
                        if (errData.error) errorMessage = errData.error;
                    } catch {
                        console.error("Failed to parse JSON error response");
                    }
                } else {
                    if (res.status === 504) {
                        errorMessage = "The AI request timed out. The model may be taking too long to respond.";
                    } else if (res.status === 500) {
                        errorMessage = "A server error occurred, and CloudFront blocked the response.";
                    }
                    const textContent = await res.text();
                    console.error("Non-JSON API Error Response:", textContent.substring(0, 200));
                }

                throw new Error(errorMessage);
            }

            // Read the stream
            const reader = res.body?.getReader();
            const decoder = new TextDecoder();
            if (!reader) throw new Error("No reader stream");

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value, { stream: true });
                // Filter out heartbeats
                const cleanChunk = chunk.replace(/\u200B/g, "");

                // Parse progress markers for Deep Critique
                if (directiveId === 6) {
                    const progressRegex = /<!-- PROGRESS: (\d)\/5 .+? (complete|failed) -->\n?/g;
                    let match;
                    let displayChunk = cleanChunk;

                    while ((match = progressRegex.exec(cleanChunk)) !== null) {
                        const id = parseInt(match[1]);
                        const status = match[2] as "complete" | "failed";
                        setCompletedAnalyses(prev => ({ ...prev, [id]: status }));
                    }

                    // Strip progress markers from display
                    displayChunk = displayChunk.replace(/<!-- PROGRESS: \d\/5 .+? (?:complete|failed) -->\n?/g, "");
                    if (displayChunk) {
                        setRadarResponse(prev => prev + displayChunk);
                    }
                } else {
                    if (cleanChunk) {
                        setRadarResponse(prev => prev + cleanChunk);
                    }
                }
            }
        } catch (error) {
            console.error("Radar Error:", error);
            const message = error instanceof Error ? error.message : "An error occurred fetching analysis.";
            setRadarError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const closeModal = () => {
        if (isLoading) return;
        setActiveDirective(null);
    };

    const isDeepCritique = activeDirective === 6;
    const deepCritiqueInProgress = isDeepCritique && isLoading && Object.keys(completedAnalyses).length < 5;

    return (
        <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
            <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
                <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Global News Guidance</h1>
            </header>

            <div className="w-full p-4 md:p-8">
                <div className="max-w-3xl mx-auto pb-20">
                    {/* Hero */}
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Globe className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">Global News Guidance</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Geopolitical intelligence mapped to your portfolio.
                            </p>
                        </div>
                    </div>

                    {/* Card Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {DIRECTIVES.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleCardClick(item.id)}
                                className={`text-left glass-panel p-5 hover:border-teal-500/30 transition-all flex items-start space-x-4 group ${item.id >= 6 ? "md:col-span-2 border-teal-500/20 bg-gradient-to-r from-teal-50/50 to-cyan-50/50 dark:from-teal-900/10 dark:to-cyan-900/10" : ""}`}
                            >
                                <div className={`p-2.5 rounded-lg group-hover:scale-110 transition-transform ${item.id >= 6 ? "bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300" : "bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400"}`}>
                                    <item.icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mb-1 flex items-center justify-between">
                                        {item.title}
                                        <ChevronRight className="h-4 w-4 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity translate-x-[-10px] group-hover:translate-x-0" />
                                    </h3>
                                    <p className="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed">
                                        {item.desc}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Analysis Modal */}
            {activeDirective !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                            <div className="flex items-center">
                                <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 flex items-center mr-4">
                                    <Globe className="h-5 w-5 mr-2 text-teal-600" />
                                    {DIRECTIVES.find(d => d.id === activeDirective)?.title || "Analysis"}
                                </h3>

                                {radarResponse && !isLoading && (
                                    <div className="hidden sm:flex items-center space-x-4 ml-2 pl-4 border-l border-neutral-300 dark:border-neutral-700 text-sm text-neutral-500">
                                        <div className="flex items-center">
                                            <Clock className="h-4 w-4 mr-1.5" />
                                            {lastUpdated ? (
                                                <span>Updated {new Date(lastUpdated).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                                            ) : (
                                                <span>Generated just now</span>
                                            )}
                                        </div>
                                        {(changedFields.length === 0 || isWarningDismissed) && (
                                            <button
                                                onClick={() => fetchRadar(activeDirective, true)}
                                                className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-neutral-200/60 hover:bg-neutral-300 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors text-neutral-700 dark:text-neutral-300 font-medium"
                                            >
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                <span>Refresh</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="flex items-center space-x-2">
                                {radarResponse && !isLoading && (changedFields.length === 0 || isWarningDismissed) && (
                                    <button
                                        onClick={() => fetchRadar(activeDirective, true)}
                                        className="sm:hidden p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                                        title="Refresh Analysis"
                                    >
                                        <RefreshCw className="h-5 w-5" />
                                    </button>
                                )}
                                <button
                                    onClick={closeModal}
                                    disabled={isLoading}
                                    className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                            {/* Stale Data Warning Banner */}
                            {changedFields.length > 0 && !isLoading && !isWarningDismissed && (
                                <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 relative z-10">
                                    <div className="flex items-start flex-1 text-sm">
                                        <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mr-3 flex-shrink-0 mt-0.5" />
                                        <div>
                                            <strong className="text-amber-900 dark:text-amber-400 block mb-1">Stale Data Warning</strong>
                                            <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
                                                Your underlying data has changed since this analysis was generated: <span className="font-semibold">{changedFields.join(", ")}</span>.
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2 sm:self-start flex-shrink-0">
                                        <button
                                            onClick={() => fetchRadar(activeDirective, true)}
                                            className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white shadow-sm transition-colors font-medium text-sm"
                                        >
                                            <RefreshCw className="h-4 w-4" />
                                            <span>Refresh Analysis</span>
                                        </button>
                                        <button
                                            onClick={() => setIsWarningDismissed(true)}
                                            className="p-1.5 text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-200/50 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
                                            title="Dismiss Warning"
                                        >
                                            <X className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Deep Critique Progress Checklist */}
                            {isDeepCritique && isLoading && (
                                <div className="mb-6 p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/30">
                                    <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-3 flex items-center">
                                        <Zap className="h-4 w-4 mr-2 text-teal-500" />
                                        Running 5 Parallel Analyses...
                                    </h4>
                                    <div className="space-y-2">
                                        {[1, 2, 3, 4, 5].map(id => {
                                            const status = completedAnalyses[id];
                                            return (
                                                <div key={id} className="flex items-center space-x-3 text-sm">
                                                    {status === "complete" ? (
                                                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                                                    ) : status === "failed" ? (
                                                        <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
                                                    ) : (
                                                        <Circle className="h-4 w-4 text-neutral-300 dark:text-neutral-600 flex-shrink-0 animate-pulse" />
                                                    )}
                                                    <span className={status === "complete" ? "text-neutral-700 dark:text-neutral-300" : status === "failed" ? "text-red-400" : "text-neutral-400 dark:text-neutral-500"}>
                                                        {DIRECTIVE_NAMES[id]}
                                                    </span>
                                                    {status === "failed" && <span className="text-xs text-red-400">(failed)</span>}
                                                </div>
                                            );
                                        })}
                                    </div>
                                    {Object.keys(completedAnalyses).length === 5 && !radarResponse && (
                                        <p className="mt-3 text-xs text-teal-600 dark:text-teal-400 animate-pulse">Synthesizing executive report...</p>
                                    )}
                                </div>
                            )}

                            {radarError && (
                                <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl mb-4">
                                    {radarError}
                                </div>
                            )}

                            {radarResponse && (
                                <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300 transition-all duration-500 ${changedFields.length > 0 && !isWarningDismissed && !isLoading ? "blur-md pointer-events-none select-none opacity-60" : ""}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {radarResponse}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {isLoading && !radarResponse && !deepCritiqueInProgress && (
                                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                                    <p className="animate-pulse">Scanning global macro events and mapping to your portfolio...</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
