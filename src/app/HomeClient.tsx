"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, RefreshCw, Users, Brain } from "lucide-react";
import { PanelResponse } from "@/components/PanelResponse";
import { CollapsedExchange } from "@/components/CollapsedExchange";
import { MemoryPanel } from "@/components/MemoryPanel";
import { personas, PersonaId } from "@/lib/personas";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import type { PersonaResponse } from "@/types";

interface Message {
  id: string;
  role: "user" | "board";
  content: string;
  responses?: PersonaResponse[];
  isHistory?: boolean;
  timestamp?: string;
  selectedPersonas?: string[];
}

interface MemoryInfo {
  text: string;
  exchangeCount: number;
  lastUpdated: string;
}

interface HistoryExchange {
  SK: string;
  userMessage: string;
  selectedPersonas: string[];
  responses: PersonaResponse[];
}

const allPersonaIds = Object.keys(personas) as PersonaId[];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>(allPersonaIds);
  const [memoryInfo, setMemoryInfo] = useState<MemoryInfo | null>(null);
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [personaHistoryCounts, setPersonaHistoryCounts] = useState<Record<string, number>>({});
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);

  // Load chat history on mount
  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await fetch("/api/chat/history?limit=10");
        if (!res.ok) throw new Error("Failed to fetch history");

        const data = await res.json();
        const exchanges: HistoryExchange[] = data.exchanges || [];

        if (data.summary) {
          setMemoryInfo(data.summary);
        }

        // Count persona appearances for badges
        const counts: Record<string, number> = {};
        exchanges.forEach((ex) => {
          ex.selectedPersonas?.forEach((pid: string) => {
            counts[pid] = (counts[pid] || 0) + 1;
          });
        });
        setPersonaHistoryCounts(counts);

        if (exchanges.length > 0) {
          // Convert exchanges to Message[] format (oldest first for display)
          const historyMessages: Message[] = [];
          const sortedExchanges = [...exchanges].reverse(); // API returns newest-first

          sortedExchanges.forEach((ex) => {
            const timestamp = ex.SK?.replace("CHAT#", "") || "";
            historyMessages.push({
              id: `hist-user-${timestamp}`,
              role: "user",
              content: ex.userMessage,
              isHistory: true,
              timestamp,
            });
            historyMessages.push({
              id: `hist-board-${timestamp}`,
              role: "board",
              content: `${ex.responses?.length || 0} advisor${(ex.responses?.length || 0) !== 1 ? "s" : ""} responded.`,
              responses: ex.responses,
              isHistory: true,
              timestamp,
              selectedPersonas: ex.selectedPersonas,
            });
          });

          setMessages(historyMessages);
          setHasLoadedHistory(true);
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

  const handleClearChat = useCallback(async () => {
    try {
      await fetch("/api/chat/history?mode=chat", { method: "DELETE" });
      setMessages([]);
      setPersonaHistoryCounts({});
      setHasLoadedHistory(false);
      setShowMemoryPanel(false);
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  }, []);

  const handleResetAll = useCallback(async () => {
    try {
      await fetch("/api/chat/history?mode=all", { method: "DELETE" });
      setMessages([]);
      setMemoryInfo(null);
      setPersonaHistoryCounts({});
      setHasLoadedHistory(false);
      setShowMemoryPanel(false);
    } catch (err) {
      console.error("Failed to reset memory:", err);
    }
  }, []);

  // Find the boundary between history and new messages
  const historyEndIndex = messages.findLastIndex((m) => m.isHistory);
  const hasHistory = historyEndIndex >= 0;
  const hasNewMessages = messages.some((m) => !m.isHistory);

  // Determine empty state type
  const showEmptyState = messages.length === 0 && !isLoadingHistory;

  // Get last exchange info for returning user welcome
  const lastExchange = hasLoadedHistory && messages.length > 0
    ? messages.filter((m) => m.role === "board" && m.isHistory).pop()
    : null;
  const lastUserMsg = hasLoadedHistory && messages.length > 0
    ? messages.filter((m) => m.role === "user" && m.isHistory).pop()
    : null;

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Header */}
      <header className="flex-none border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center justify-between h-14 md:h-16 px-4 md:px-8">
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Expert Guidance</h1>

          {/* Memory Status Indicator */}
          {memoryInfo && (
            <button
              onClick={() => setShowMemoryPanel(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-500/30 hover:bg-teal-100 dark:hover:bg-teal-500/20 transition-colors"
            >
              <Brain className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Memory active</span>
              <span className="text-teal-500 dark:text-teal-500">&middot; {memoryInfo.exchangeCount}</span>
            </button>
          )}
        </div>

        {/* Persona Selector with History Badges */}
        <div className="flex items-center gap-2 px-4 md:px-8 pb-3 overflow-x-auto custom-scrollbar">
          {allPersonaIds.map(id => {
            const persona = personas[id];
            const isSelected = selectedPersonas.includes(id);
            const historyCount = personaHistoryCounts[id] || 0;
            return (
              <button
                key={id}
                onClick={() => togglePersona(id)}
                className={`relative flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                  isSelected
                    ? "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 border-neutral-200 dark:border-neutral-800 opacity-60"
                }`}
              >
                <span className="text-base">{persona.avatar}</span>
                <span>{persona.name}</span>
                {historyCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-teal-500 text-[9px] font-bold text-white flex items-center justify-center">
                    {historyCount > 9 ? "9+" : historyCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32">

          {/* Loading History Skeleton */}
          {isLoadingHistory && (
            <div className="flex items-center justify-center py-10">
              <RefreshCw className="h-5 w-5 animate-spin text-neutral-400" />
              <span className="ml-2 text-sm text-neutral-400">Loading conversation history...</span>
            </div>
          )}

          {/* Empty State */}
          {showEmptyState && (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center space-y-4 md:space-y-6 animate-in fade-in duration-700">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full glass-panel-accent flex items-center justify-center mb-2 md:mb-4 shadow-inner">
                <Users className="h-8 w-8 md:h-10 md:w-10 text-teal-600 dark:text-teal-400" />
              </div>

              {memoryInfo ? (
                <>
                  <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome back</h2>
                  <p className="text-neutral-600 dark:text-neutral-400 max-w-lg text-base md:text-lg">
                    Your advisors remember your previous conversations. Pick up where you left off or start fresh.
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

          {/* Messages */}
          {!isLoadingHistory && messages.length > 0 && (
            <div className="space-y-6 md:space-y-8">

              {/* Previous Session Divider */}
              {hasHistory && (
                <div className="flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-600">
                  <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
                  <span className="uppercase tracking-widest font-medium">Previous Session</span>
                  <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
                </div>
              )}

              {messages.map((msg, index) => {
                // History messages: render collapsed exchanges
                if (msg.isHistory && msg.role === "board") {
                  const prevMsg = messages[index - 1];
                  const userContent = prevMsg?.role === "user" ? prevMsg.content : "";
                  return (
                    <CollapsedExchange
                      key={msg.id}
                      userMessage={userContent}
                      responses={msg.responses || []}
                      timestamp={msg.timestamp}
                    />
                  );
                }

                // Skip history user messages (they're rendered inside CollapsedExchange)
                if (msg.isHistory && msg.role === "user") {
                  return null;
                }

                // Today divider before first new message
                if (!msg.isHistory && index > 0 && messages[index - 1]?.isHistory) {
                  return (
                    <div key={`divider-${msg.id}`}>
                      <div className="flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-600 mb-6">
                        <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
                        <span className="uppercase tracking-widest font-medium">Today</span>
                        <div className="h-px bg-neutral-200 dark:bg-neutral-800 flex-1" />
                      </div>
                      <div className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
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
                    </div>
                  );
                }

                // Current session messages — full rendering
                return (
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
                );
              })}

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
          {!isLoadingHistory && !isLoading && (
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

      {/* Memory Panel Modal */}
      {showMemoryPanel && memoryInfo && (
        <MemoryPanel
          summaryText={memoryInfo.text}
          exchangeCount={memoryInfo.exchangeCount}
          lastUpdated={memoryInfo.lastUpdated}
          onClose={() => setShowMemoryPanel(false)}
          onClearChat={handleClearChat}
          onResetAll={handleResetAll}
        />
      )}
    </div>
  );
}
