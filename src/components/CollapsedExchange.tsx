"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { personas, PersonaId } from "@/lib/personas";
import { PanelResponse } from "@/components/PanelResponse";
import type { PersonaResponse } from "@/types";

interface CollapsedExchangeProps {
  userMessage: string;
  responses: PersonaResponse[];
  timestamp?: string;
}

function truncate(text: string, maxLen: number = 80): string {
  const firstLine = text.split("\n")[0].replace(/[#*_`]/g, "").trim();
  return firstLine.length > maxLen ? firstLine.slice(0, maxLen) + "..." : firstLine;
}

export function CollapsedExchange({ userMessage, responses, timestamp }: CollapsedExchangeProps) {
  const [expanded, setExpanded] = useState(false);

  const successResponses = responses.filter((r) => r.status === "success");

  return (
    <div className="group">
      {/* Collapsed view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-3 md:p-4 rounded-xl bg-white/5 dark:bg-neutral-900/50 border border-neutral-200 dark:border-neutral-800 hover:border-teal-500/30 dark:hover:border-teal-500/30 transition-all"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 text-neutral-400 flex-shrink-0">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            {/* User question */}
            <p className="text-sm font-medium text-neutral-900 dark:text-neutral-200 truncate">
              {userMessage}
            </p>

            {/* Persona response previews (collapsed only) */}
            {!expanded && (
              <div className="mt-2 space-y-1">
                {successResponses.map((r) => {
                  const persona = personas[r.personaId as PersonaId];
                  if (!persona) return null;
                  return (
                    <div key={r.personaId} className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500">
                      <span className="flex-shrink-0">{persona.avatar}</span>
                      <span className="font-medium text-neutral-600 dark:text-neutral-400">{persona.name}:</span>
                      <span className="truncate">{truncate(r.content)}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timestamp */}
          {timestamp && (
            <span className="text-[10px] text-neutral-400 dark:text-neutral-600 flex-shrink-0 whitespace-nowrap">
              {new Date(timestamp).toLocaleDateString()}
            </span>
          )}
        </div>
      </button>

      {/* Expanded view — full PanelResponse */}
      {expanded && (
        <div className="mt-3 pl-7">
          <PanelResponse responses={responses} />
        </div>
      )}
    </div>
  );
}
