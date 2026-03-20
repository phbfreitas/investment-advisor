"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2, RefreshCw, Users } from "lucide-react";
import { PanelResponse } from "@/components/PanelResponse";
import { personas, PersonaId } from "@/lib/personas";
import { PROMPT_TEMPLATES } from "@/lib/prompt-templates";
import type { PersonaResponse } from "@/types";

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPersonas, setSelectedPersonas] = useState<PersonaId[]>(allPersonaIds);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const togglePersona = (id: PersonaId) => {
    setSelectedPersonas(prev => {
      if (prev.includes(id)) {
        if (prev.length === 1) return prev; // Keep at least 1
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

  return (
    <div className="flex flex-col min-h-screen md:h-full bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {/* Header */}
      <header className="flex-none border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10 transition-colors duration-300">
        <div className="flex items-center h-14 md:h-16 px-4 md:px-8">
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Investment Advisory Board</h1>
        </div>

        {/* Persona Selector */}
        <div className="flex items-center gap-2 px-4 md:px-8 pb-3 overflow-x-auto custom-scrollbar">
          {allPersonaIds.map(id => {
            const persona = personas[id];
            const isSelected = selectedPersonas.includes(id);
            return (
              <button
                key={id}
                onClick={() => togglePersona(id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap border ${
                  isSelected
                    ? "bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-200 dark:border-teal-500/30"
                    : "bg-neutral-100 dark:bg-neutral-900 text-neutral-400 dark:text-neutral-600 border-neutral-200 dark:border-neutral-800 opacity-60"
                }`}
              >
                <span className="text-base">{persona.avatar}</span>
                <span>{persona.name}</span>
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32">

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center space-y-4 md:space-y-6 animate-in fade-in duration-700">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full glass-panel-accent flex items-center justify-center mb-2 md:mb-4 shadow-inner">
                <Users className="h-8 w-8 md:h-10 md:w-10 text-teal-600 dark:text-teal-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-neutral-900 dark:text-neutral-100">Welcome to your Advisory Board</h2>
              <p className="text-neutral-600 dark:text-neutral-400 max-w-lg text-base md:text-lg">
                Consult your panel of legendary investors for guidance, market analysis, or strategy reviews tailored to your financial context.
              </p>

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
          ) : (
            <div className="space-y-8 md:space-y-12">
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
  );
}
