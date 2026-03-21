"use client";

import { useState } from "react";
import { X, Trash2, AlertTriangle } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface MemoryPanelProps {
  summaryText: string;
  exchangeCount: number;
  lastUpdated: string;
  onClose: () => void;
  onClearChat: () => void;
  onResetAll: () => void;
}

export function MemoryPanel({
  summaryText,
  exchangeCount,
  lastUpdated,
  onClose,
  onClearChat,
  onResetAll,
}: MemoryPanelProps) {
  const [confirmReset, setConfirmReset] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-200 dark:border-neutral-800 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 dark:border-neutral-800">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Advisor Memory
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              {exchangeCount} exchanges &middot; Last updated{" "}
              {new Date(lastUpdated).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="h-5 w-5 text-neutral-500" />
          </button>
        </div>

        {/* Memory Content */}
        <div className="px-6 py-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
          <p className="text-xs uppercase tracking-widest text-neutral-400 mb-3 font-medium">
            What your advisors remember
          </p>
          <div className="prose prose-sm dark:prose-invert prose-p:text-neutral-600 dark:prose-p:text-neutral-300 max-w-none">
            <ReactMarkdown>{summaryText}</ReactMarkdown>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
          {!confirmReset ? (
            <div className="flex gap-3">
              <button
                onClick={onClearChat}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                Clear Chat History
              </button>
              <button
                onClick={() => setConfirmReset(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors"
              >
                <AlertTriangle className="h-4 w-4" />
                Reset All Memory
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-red-600 dark:text-red-400 text-center">
                Your advisors will forget all prior conversations. This cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onResetAll();
                    setConfirmReset(false);
                  }}
                  className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors"
                >
                  Confirm Reset
                </button>
              </div>
            </div>
          )}

          <p className="text-[10px] text-neutral-400 text-center">
            "Clear Chat" removes visible history but keeps the summary. "Reset All" erases everything.
          </p>
        </div>
      </div>
    </div>
  );
}
