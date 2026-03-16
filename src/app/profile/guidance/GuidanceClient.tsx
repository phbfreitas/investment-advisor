"use client";

import { useState } from "react";
import { BrainCircuit, Loader2, TrendingUp, PieChart, Target, Lightbulb, FileText, LineChart, X, ChevronRight, Play, RefreshCw, Clock, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function GuidanceClient() {
    // AI Guidance State
    const [activeDirective, setActiveDirective] = useState<number | null>(null);
    const [guidanceResponse, setGuidanceResponse] = useState<string>("");
    const [isGuidanceLoading, setIsGuidanceLoading] = useState(false);
    const [guidanceTicker, setGuidanceTicker] = useState("");
    const [guidanceError, setGuidanceError] = useState("");
    const [guidanceLastUpdated, setGuidanceLastUpdated] = useState<string | null>(null);
    const [changedFields, setChangedFields] = useState<string[]>([]);
    const [isWarningDismissed, setIsWarningDismissed] = useState(false);

    const handleGuidanceClick = (directiveId: number) => {
        setActiveDirective(directiveId);
        setGuidanceResponse("");
        setGuidanceError("");
        setGuidanceTicker("");
        setGuidanceLastUpdated(null);
        setChangedFields([]);
        setIsWarningDismissed(false);

        // If it's NOT directive 4, immediately fetch
        if (directiveId !== 4) {
            fetchGuidance(directiveId);
        }
    };

    const fetchGuidance = async (directiveId: number, ticker?: string, forceRefresh = false) => {
        setIsGuidanceLoading(true);
        setGuidanceResponse("");
        setGuidanceError("");
        setGuidanceLastUpdated(null);
        setChangedFields([]);
        setIsWarningDismissed(false);

        try {
            const res = await fetch("/api/guidance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ directiveId, ticker, forceRefresh }),
            });

            const lastUpdated = res.headers.get("X-Guidance-Last-Updated");
            if (lastUpdated) {
                setGuidanceLastUpdated(lastUpdated);
            } else if (forceRefresh || res.ok) {
                // If it generated fresh, tag it as just now
                setGuidanceLastUpdated(new Date().toISOString());
            }

            const changedFieldsHeader = res.headers.get("X-Guidance-Changed-Fields");
            if (changedFieldsHeader) {
                try {
                    setChangedFields(JSON.parse(changedFieldsHeader));
                } catch (e) {
                    console.error("Failed to parse changed fields header");
                }
            }

            if (!res.ok) {
                let errorMessage = `Failed to generate guidance (Status: ${res.status})`;
                const contentType = res.headers.get("content-type");

                if (contentType && contentType.includes("application/json")) {
                    try {
                        const errData = await res.json();
                        if (errData.error) errorMessage = errData.error;
                    } catch (e) {
                        console.error("Failed to parse JSON error response");
                    }
                } else {
                    // CloudFront 504 Timeout or 500 Server Error HTML pages
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
                // Filter out the zero-width space heartbeats used for AWS timeout bypass
                const cleanChunk = chunk.replace(/\u200B/g, "");
                setGuidanceResponse((prev) => prev + cleanChunk);
            }
        } catch (error) {
            console.error("Guidance Error:", error);
            const message = error instanceof Error ? error.message : "An error occurred fetching guidance.";
            setGuidanceError(message);
        } finally {
            setIsGuidanceLoading(false);
        }
    };

    const closeGuidanceModal = () => {
        // Prevent closing if we are still streaming, unless user explicitly wants to cancel.
        if (isGuidanceLoading) return;
        setActiveDirective(null);
    };

    return (
        <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
            <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
                <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">AI Guidance</h1>
            </header>

            <div className="w-full p-4 md:p-8">
                <div className="max-w-3xl mx-auto pb-20">
                    <div className="flex items-center space-x-4 mb-8">
                        <div className="p-3 glass-panel-accent rounded-xl">
                            <Target className="h-8 w-8 text-teal-600 dark:text-teal-400" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">AI Actionable Guidance</h2>
                            <p className="text-neutral-600 dark:text-neutral-400">
                                Actionable intelligence tailored to your strategy and portfolio.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {[
                            { id: 1, title: "Rebalance with Precision", desc: "Identify drifts from your growth-to-income target.", icon: PieChart },
                            { id: 2, title: "Optimize Dividend Growth", desc: "Suggest high-conviction moves to increase dividends.", icon: TrendingUp },
                            { id: 3, title: "Maintain Tactical Aggression", desc: "Highlight 'Buy the Dip' opportunities aligned with your >10% benchmark.", icon: Target },
                            { id: 4, title: "Investment Idea Evaluation", desc: "A rigorous 4-pillar analysis for a specific new asset or idea.", icon: Lightbulb },
                            { id: 5, title: "Portfolio Report", desc: "Multi-factor analysis highlighting strengths, weaknesses, and rebalancing.", icon: FileText },
                            { id: 6, title: "Stock Recommendations", desc: "Agent recommendations based on expert opinions and your strategy.", icon: LineChart },
                        ].map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleGuidanceClick(item.id)}
                                className="text-left glass-panel p-5 hover:border-teal-500/30 transition-all flex items-start space-x-4 group"
                            >
                                <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-900/20 text-teal-600 dark:text-teal-400 group-hover:scale-110 transition-transform">
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
            </div >

            {/* AI Guidance Modal */}
            {activeDirective !== null && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900">
                            <div className="flex items-center">
                                <h3 className="font-semibold text-lg text-neutral-900 dark:text-neutral-100 flex items-center mr-4">
                                    <BrainCircuit className="h-5 w-5 mr-2 text-teal-600" />
                                    AI Guidance Report
                                </h3>

                                {guidanceResponse && !isGuidanceLoading && (
                                    <div className="hidden sm:flex items-center space-x-4 ml-2 pl-4 border-l border-neutral-300 dark:border-neutral-700 text-sm text-neutral-500">
                                        <div className="flex items-center">
                                            <Clock className="h-4 w-4 mr-1.5" />
                                            {guidanceLastUpdated ? (
                                                <span>Updated {new Date(guidanceLastUpdated).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}</span>
                                            ) : (
                                                <span>Generated just now</span>
                                            )}
                                        </div>
                                        {(changedFields.length === 0 || isWarningDismissed) && (
                                            <button
                                                onClick={() => fetchGuidance(activeDirective, guidanceTicker, true)}
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
                                {guidanceResponse && !isGuidanceLoading && (changedFields.length === 0 || isWarningDismissed) && (
                                    <button
                                        onClick={() => fetchGuidance(activeDirective, guidanceTicker, true)}
                                        className="sm:hidden p-2 text-neutral-500 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
                                        title="Refresh Analysis"
                                    >
                                        <RefreshCw className="h-5 w-5" />
                                    </button>
                                )}
                                <button
                                    onClick={closeGuidanceModal}
                                    disabled={isGuidanceLoading}
                                    className="p-2 text-neutral-400 hover:text-neutral-900 dark:hover:text-white rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50"
                                >
                                    <X className="h-5 w-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

                            {/* Stale Data Warning Banner */}
                            {changedFields.length > 0 && !isGuidanceLoading && !isWarningDismissed && (
                                <div className="mb-6 p-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 flex flex-col sm:flex-row sm:items-start justify-between gap-4 animate-in fade-in slide-in-from-top-2 relative z-10">
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
                                            onClick={() => fetchGuidance(activeDirective, guidanceTicker, true)}
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

                            {/* Special Input for Directive 4 */}
                            {activeDirective === 4 && !guidanceResponse && !isGuidanceLoading && (
                                <div className="max-w-md mx-auto mt-8">
                                    <div className="text-center mb-6">
                                        <Lightbulb className="h-12 w-12 text-teal-500 mx-auto mb-4 opacity-80" />
                                        <h4 className="text-xl font-medium text-neutral-900 dark:text-neutral-100 mb-2">Analyze a New Opportunity</h4>
                                        <p className="text-sm text-neutral-500">Enter a ticker symbol below to generate a comprehensive 4-pillar analysis report.</p>
                                    </div>
                                    <div className="flex space-x-3">
                                        <input
                                            type="text"
                                            placeholder="e.g., AAPL"
                                            value={guidanceTicker}
                                            onChange={(e) => setGuidanceTicker(e.target.value.toUpperCase())}
                                            className="flex-1 bg-neutral-100 dark:bg-neutral-800 px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 uppercase focus:outline-none focus:ring-1 focus:ring-teal-500"
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && guidanceTicker) fetchGuidance(4, guidanceTicker);
                                            }}
                                        />
                                        <button
                                            onClick={() => fetchGuidance(4, guidanceTicker)}
                                            disabled={!guidanceTicker}
                                            className="bg-teal-600 hover:bg-teal-500 disabled:bg-neutral-400 disabled:cursor-not-allowed text-white px-6 rounded-xl font-medium flex items-center transition-colors"
                                        >
                                            <Play className="h-4 w-4 mr-2" />
                                            Analyze
                                        </button>
                                    </div>
                                </div>
                            )}

                            {guidanceError && (
                                <div className="p-4 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl mb-4">
                                    {guidanceError}
                                </div>
                            )}

                            {guidanceResponse && (
                                <div className={`prose prose-sm md:prose-base dark:prose-invert max-w-none text-neutral-700 dark:text-neutral-300 transition-all duration-500 ${changedFields.length > 0 && !isWarningDismissed && !isGuidanceLoading ? 'blur-md pointer-events-none select-none opacity-60' : ''}`}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {guidanceResponse}
                                    </ReactMarkdown>
                                </div>
                            )}

                            {isGuidanceLoading && (
                                <div className="flex flex-col items-center justify-center py-12 text-neutral-500">
                                    <Loader2 className="h-8 w-8 animate-spin text-teal-600 mb-4" />
                                    <p className="animate-pulse">Synthesizing portfolio data and expert opinions...</p>
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
