"use client";

import { useState, useRef, useEffect } from "react";
import { BrainCircuit, Send, BarChart2, Loader2, RefreshCw } from "lucide-react";
import { PanelResponse } from "@/components/PanelResponse";
import { personas, PersonaId } from "@/lib/personas";

interface Message {
  id: string;
  role: "user" | "board";
  content: string; // The user's query
  responses?: any[]; // The panel's responses
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [selectedPersonas] = useState<PersonaId[]>(["buffett"]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

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

      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "board",
          content: "Warren has responded.",
          responses: data.responses
        }
      ]);

    } catch (error) {
      console.error("Chat error:", error);
      // Basic error handling for MVP
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
    <div className="flex flex-col h-full bg-[#050505]">
      {/* Header */}
      <header className="flex-none h-14 md:h-16 border-b border-neutral-800 flex items-center px-4 md:px-8 bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <h1 className="text-lg md:text-xl font-medium text-neutral-200">Value Investing Advisor</h1>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
        <div className="max-w-5xl mx-auto space-y-8 md:space-y-12 pb-32">

          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 text-center space-y-4 md:space-y-6 animate-in fade-in duration-700">
              <div className="h-16 w-16 md:h-20 md:w-20 rounded-full glass-panel-accent flex items-center justify-center mb-2 md:mb-4 text-3xl md:text-4xl shadow-inner">
                👴
              </div>
              <h2 className="text-2xl md:text-3xl font-semibold text-neutral-100">Welcome to your Buffett Advisor</h2>
              <p className="text-neutral-400 max-w-lg text-base md:text-lg">
                Ask the Oracle of Omaha for guidance, market analysis, or strategy reviews tailored to your context, grounded in his original letters.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 md:mt-8 w-full max-w-xl">
                <button
                  onClick={() => setInputValue("Analyze my current portfolio and tell me if I am diversified enough.")}
                  className="flex items-center space-x-3 p-4 glass-panel hover:bg-neutral-800 transition-colors text-left group"
                >
                  <BarChart2 className="h-5 w-5 text-teal-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="text-sm font-medium text-neutral-300">Analyze my current portfolio</span>
                </button>
                <button
                  onClick={() => setInputValue("Given my risk tolerance and goals, critique my investment strategy.")}
                  className="flex items-center space-x-3 p-4 glass-panel hover:bg-neutral-800 transition-colors text-left group"
                >
                  <BrainCircuit className="h-5 w-5 text-indigo-400 group-hover:scale-110 transition-transform flex-shrink-0" />
                  <span className="text-sm font-medium text-neutral-300">Critique my investment strategy</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-8 md:space-y-12">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.role === 'user' ? (
                    <div className="bg-neutral-800 text-neutral-100 px-4 py-3 md:px-6 md:py-4 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-2xl text-base md:text-lg shadow-md break-words">
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
                <div className="flex items-center space-x-3 md:space-x-4 text-teal-500 bg-teal-500/5 px-4 py-3 md:px-6 md:py-4 rounded-2xl w-[90%] md:w-fit border border-teal-500/10 animate-pulse">
                  <RefreshCw className="h-4 w-4 md:h-5 md:w-5 animate-spin flex-shrink-0" />
                  <span className="font-medium tracking-wide text-sm md:text-base">Warren is reviewing his letters and analyzing your portfolio...</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}

        </div>
      </div>

      {/* Input Area */}
      <div className="flex-none p-4 md:p-6 bg-gradient-to-t from-[#050505] via-[#050505] to-transparent">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto">
          <div className="glass-panel p-2 flex items-end relative shadow-2xl shadow-teal-900/10 focus-within:ring-1 focus-within:ring-teal-500/50 transition-all">
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 max-h-48 min-h-[56px] w-full resize-none bg-transparent px-3 py-3 md:px-4 md:py-4 text-sm md:text-base text-neutral-100 placeholder:text-neutral-500 focus:outline-none focus:ring-0 custom-scrollbar mb-1"
              placeholder="Ask Warren..."
              rows={1}
              disabled={isLoading}
            />
            <div className="absolute right-2 bottom-2 md:right-4 md:bottom-3 flex items-center space-x-2">
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="h-10 w-10 md:h-12 md:w-12 rounded-xl bg-teal-500/10 text-teal-400 flex items-center justify-center hover:bg-teal-500 hover:text-white transition-all disabled:opacity-50 disabled:hover:bg-teal-500/10 disabled:hover:text-teal-400"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] md:text-xs text-neutral-600 mt-2 md:mt-4">
            AI can make mistakes. Verify important financial data.
          </p>
        </form>
      </div>
    </div>
  );
}
