"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, RefreshCw, Users, Brain, ChevronDown, Check } from "lucide-react";
import { PanelResponse } from "@/components/PanelResponse";
import { ClientDossier } from "@/components/ClientDossier";
import { TranscriptArchive } from "@/components/TranscriptArchive";
import { personas, PersonaId } from "@/lib/personas";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import type { PersonaResponse, PersonaSummaryMap } from "@/types";

interface Message {
  id: string;
  role: "user" | "board";
  content: string;
  responses?: PersonaResponse[];
}

const allPersonaIds = Object.keys(personas) as PersonaId[];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>(allPersonaIds);
  const [summaries, setSummaries] = useState<PersonaSummaryMap>({});
  const [personaHistoryCounts, setPersonaHistoryCounts] = useState<Record<string, number>>({});
  const [showMobileDossier, setShowMobileDossier] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showAdvisorPicker, setShowAdvisorPicker] = useState(false);
  const advisorPickerRef = useRef<HTMLDivElement>(null);

  const hasAnyMemory = Object.values(summaries).some((s) => s !== null);

  // Load summaries and persona counts on mount (no history messages in main feed)
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch("/api/chat/history?limit=50");
        if (!res.ok) throw new Error("Failed to fetch history");

        const data = await res.json();

        if (data.summaries) {
          setSummaries(data.summaries);
        }

        // Count persona appearances for badges
        const counts: Record<string, number> = {};
        (data.exchanges || []).forEach((ex: { selectedPersonas?: string[] }) => {
          ex.selectedPersonas?.forEach((pid: string) => {
            counts[pid] = (counts[pid] || 0) + 1;
          });
        });
        setPersonaHistoryCounts(counts);
      } catch (err) {
        console.error("Failed to load chat data:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadData();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Close advisor picker on click outside
  useEffect(() => {
    if (!showAdvisorPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (advisorPickerRef.current && !advisorPickerRef.current.contains(e.target as Node)) {
        setShowAdvisorPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showAdvisorPicker]);

  const togglePersona = (id: PersonaId) => {
    setSelectedPersonas(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== id);
      }
      return [...prev, id];
    });
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    const newMsgId = Date.now().toString();
    setMessages(prev => [...prev, { id: newMsgId, role: "user", content: userMessage }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          selectedPersonas,
        }),
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to get response");

      const responseCount = data.responses?.length || 0;
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "board",
          content: `${responseCount} advisor${responseCount !== 1 ? "s" : ""} responded.`,
          responses: data.responses
        }
      ]);

    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleResetMemory = useCallback(async (personaId?: string) => {
    try {
      if (personaId) {
        await fetch(`/api/chat/history?mode=summary&persona=${personaId}`, { method: "DELETE" });
        setSummaries(prev => ({ ...prev, [personaId]: null }));
      } else {
        await fetch("/api/chat/history?mode=all", { method: "DELETE" });
        setMessages([]);
        setSummaries({});
        setPersonaHistoryCounts({});
      }
    } catch (err) {
      console.error("Failed to reset memory:", err);
    }
  }, []);

  const showEmptyState = messages.length === 0 && !isLoadingHistory;

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Header */}
      <header className="flex-none border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-8">
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Expert Guidance</h1>

          <div className="flex items-center gap-2">
            {/* Mobile Dossier Toggle */}
            <button
              onClick={() => setShowMobileDossier(true)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
            >
              <Brain className="h-3.5 w-3.5" />
              <span>Notebook</span>
              {hasAnyMemory && <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
            </button>
          </div>
        </div>

        {/* Advisor Selector — Single Trigger Button */}
        <div className="relative px-4 md:px-8 pb-3" ref={advisorPickerRef}>
          <button
            onClick={() => setShowAdvisorPicker(prev => !prev)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors shadow-sm"
          >
            <Users className="h-4 w-4 text-teal-600 dark:text-teal-400" />
            <span className="text-neutral-700 dark:text-neutral-300">
              {selectedPersonas.length === allPersonaIds.length
                ? "All Advisors"
                : `${selectedPersonas.length} Advisor${selectedPersonas.length !== 1 ? "s" : ""} Selected`}
            </span>
            <ChevronDown className={`h-4 w-4 text-neutral-400 transition-transform ${showAdvisorPicker ? "rotate-180" : ""}`} />
          </button>

          {/* Advisor picker dropdown */}
          {showAdvisorPicker && (
            <div className="absolute left-4 right-4 md:left-8 md:right-auto md:w-[500px] lg:w-[600px] mt-2 z-20 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-neutral-100 dark:border-neutral-800">
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{selectedPersonas.length} of {allPersonaIds.length} selected</span>
                <button
                  onClick={() => {
                    setSelectedPersonas(selectedPersonas.length === allPersonaIds.length ? [allPersonaIds[0]] : allPersonaIds);
                  }}
                  className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-700 dark:hover:text-teal-300 transition-colors"
                >
                  {selectedPersonas.length === allPersonaIds.length ? "Deselect All" : "Select All"}
                </button>
              </div>
              <div className="p-3 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-1.5 max-h-[320px] overflow-y-auto custom-scrollbar">
              {allPersonaIds.map(id => {
                const persona = personas[id];
                const isSelected = selectedPersonas.includes(id);
                const historyCount = personaHistoryCounts[id] || 0;
                return (
                  <button
                    key={id}
                    onClick={() => togglePersona(id)}
                    className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400"
                        : "text-neutral-500 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <span className="text-lg">{persona.avatar}</span>
                    <div className="flex flex-col items-start min-w-0">
                      <span className="truncate">{persona.name}</span>
                      <span className="text-[10px] text-neutral-400 dark:text-neutral-500 font-normal">{persona.tagline}</span>
                    </div>
                    {isSelected && (
                      <Check className="h-4 w-4 ml-auto flex-shrink-0 text-teal-600 dark:text-teal-400" />
                    )}
                    {historyCount > 0 && (
                      <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-teal-500 text-[9px] font-bold text-white flex items-center justify-center">
                        {historyCount > 9 ? "9+" : historyCount}
                      </span>
                    )}
                  </button>
                );
              })}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Two-Column Layout */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[300px_1fr] overflow-hidden">
        {/* Client Dossier — Desktop (persistent sidebar) */}
        <div className="hidden md:block overflow-y-auto">
          <ClientDossier
            summaries={summaries}
            personaExchangeCounts={personaHistoryCounts}
            onOpenArchive={() => setShowArchive(true)}
            onResetMemory={handleResetMemory}
          />
        </div>

        {/* Active Session (Right Column) */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
            <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32">

              {/* Loading Skeleton */}
              {isLoadingHistory && (
                <div className="flex items-center justify-center py-10">
                  <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
                  <span className="ml-2 text-sm text-neutral-400">Loading...</span>
                </div>
              )}

              {/* Empty State */}
              {showEmptyState && (
                <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center space-y-4 md:space-y-6 animate-in fade-in duration-700">
                  <div className="h-16 w-16 md:h-20 md:w-20 rounded-full glass-panel-accent flex items-center justify-center mb-2 md:mb-4 shadow-inner">
                    <Users className="h-8 w-8 md:h-10 md:w-10 text-teal-600 dark:text-teal-400" />
                  </div>

                  {hasAnyMemory ? (
                    <>
                      <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome back</h2>
                      <p className="text-neutral-600 dark:text-neutral-400 max-w-lg text-base md:text-lg">
                        Your advisors remember your previous conversations. Check the Advisor Notebook to see what they know, or start a new conversation.
                      </p>
                    </>
                  ) : (
                    <>
                      <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome to Expert Guidance</h2>
                      <p className="text-neutral-600 dark:text-neutral-400 max-w-lg text-base md:text-lg">
                        Consult your panel of legendary investors for guidance, market analysis, or strategy reviews tailored to your financial context.
                      </p>
                    </>
                  )}

                  {/* Quick Prompts */}
                  <div className="flex flex-wrap gap-2 justify-center">
                    {PROMPT_TEMPLATES.map((tmpl) => (
                      <button
                        key={tmpl.id}
                        onClick={() => setInputValue(tmpl.prompt)}
                        className="px-4 py-2 rounded-full text-sm bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition-colors"
                      >
                        {tmpl.emoji} {tmpl.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Current Session Messages */}
              {!isLoadingHistory && messages.length > 0 && (
                <div className="space-y-6 md:space-y-8">
                  {messages.map((msg) => (
                    <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                      {msg.role === 'user' ? (
                        <div className="bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-4 py-3 md:px-6 md:py-4 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-2xl text-base md:text-lg border border-neutral-200 dark:border-transparent shadow-sm dark:shadow-md break-words transition-colors duration-300">
                          {msg.content}
                        </div>
                      ) : (
                        <div className="w-full mt-4">
                          <PanelResponse responses={msg.responses || []} />
                        </div>
                      )}
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex items-center space-x-3 md:space-x-4 text-teal-700 dark:text-teal-500 bg-teal-50 dark:bg-teal-500/5 px-4 py-3 md:px-6 md:py-4 rounded-2xl w-[90%] md:w-fit border border-teal-200 dark:border-teal-500/10 animate-pulse transition-colors duration-300">
                      <RefreshCw className="h-4 w-4 md:h-5 md:w-5 animate-spin flex-shrink-0" />
                      <span className="font-medium tracking-wide text-sm md:text-base">Your advisors are analyzing your portfolio...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}

            </div>
          </div>

          {/* Input Area */}
          <div className="flex-none p-4 md:p-6 bg-gradient-to-t from-neutral-50 via-neutral-50 dark:from-[#050505] dark:via-[#050505] to-transparent transition-colors duration-300">
            <div className="max-w-4xl mx-auto">
              {/* Quick Prompts above input */}
              {!isLoadingHistory && !isLoading && messages.length > 0 && (
                <div className="flex flex-wrap gap-2 justify-center mb-3">
                  {PROMPT_TEMPLATES.map((tmpl) => (
                    <button
                      key={tmpl.id}
                      onClick={() => setInputValue(tmpl.prompt)}
                      className="px-3 py-1.5 rounded-full text-xs bg-white/5 border border-white/10 hover:bg-white/10 hover:border-teal-500/30 transition-colors"
                    >
                      {tmpl.emoji} {tmpl.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
              <div className="glass-panel p-2 flex items-end relative shadow-xl dark:shadow-2xl shadow-teal-900/5 dark:shadow-teal-900/10 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 max-h-48 min-h-[56px] w-full resize-none bg-transparent px-3 py-3 md:px-4 md:py-4 pr-14 md:pr-16 text-sm md:text-base text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus:outline-none focus:ring-0 custom-scrollbar mb-1"
                  placeholder="Ask your advisors..."
                  rows={1}
                  disabled={isLoading}
                />
                <div className="absolute right-2 bottom-2 md:right-4 md:bottom-3 flex items-center space-x-2">
                  <button
                    type="submit"
                    disabled={!inputValue.trim() || isLoading}
                    className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-teal-50 dark:bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center hover:bg-teal-100 dark:hover:bg-teal-500 hover:text-teal-800 dark:hover:text-white transition-all disabled:opacity-50 disabled:bg-transparent dark:disabled:bg-transparent disabled:text-neutral-400 dark:disabled:text-neutral-600 border border-transparent disabled:border-transparent"
                  >
                    {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <p className="text-center text-[10px] md:text-xs text-neutral-500 dark:text-neutral-600 mt-2 md:mt-4">
                AI can make mistakes. Verify important financial data.
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Mobile Dossier Drawer */}
      {showMobileDossier && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setShowMobileDossier(false)}
          />
          {/* Drawer */}
          <div className="absolute inset-y-0 left-0 w-[85%] max-w-[340px] animate-in slide-in-from-left duration-300">
            <ClientDossier
              summaries={summaries}
              personaExchangeCounts={personaHistoryCounts}
              onOpenArchive={() => { setShowMobileDossier(false); setShowArchive(true); }}
              onResetMemory={handleResetMemory}
              isMobileDrawer
              onClose={() => setShowMobileDossier(false)}
            />
          </div>
        </div>
      )}

      {/* Transcript Archive Modal */}
      {showArchive && (
        <TranscriptArchive onClose={() => setShowArchive(false)} />
      )}
    </div>
  );
}
