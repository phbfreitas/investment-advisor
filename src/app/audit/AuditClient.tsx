"use client";

import { useState, useEffect, useCallback } from "react";
import { FileText, Pencil, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Loader2, Clock } from "lucide-react";
import type { AuditLog, AuditMutation } from "@/types/audit";

function RewindOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        <RotateCcw className="h-16 w-16 text-amber-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
        <p className="text-lg font-medium text-white">Reverting changes...</p>
      </div>
    </div>
  );
}

export default function AuditClient() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastKey, setLastKey] = useState<string | null>(null);
  const [expandedSK, setExpandedSK] = useState<string | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  const fetchLogs = useCallback(async (cursorKey?: string | null) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (cursorKey) params.set("lastKey", cursorKey);

      const res = await fetch(`/api/audit-logs?${params}`);
      const data = await res.json();

      if (data.logs) {
        setLogs(prev => cursorKey ? [...prev, ...data.logs] : data.logs);
        setLastKey(data.lastKey || null);
      }
    } catch (error) {
      console.error("Failed to fetch audit logs:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRollback = async (auditLogSK: string) => {
    const targetIndex = logs.findIndex(l => l.SK === auditLogSK);
    const count = targetIndex + 1;

    const confirmed = confirm(
      `This will undo this change and ${count > 1 ? `all ${count - 1} change(s) after it` : "no other changes"}. Continue?`
    );
    if (!confirmed) return;

    setIsRollingBack(true);
    setRollbackTarget(auditLogSK);

    try {
      const res = await fetch("/api/portfolio-rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auditLogSK }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ text: data.message, type: "success" });
        await fetchLogs();
      } else {
        setMessage({ text: data.error || "Rollback failed", type: "error" });
      }
    } catch {
      setMessage({ text: "Rollback failed. Please try again.", type: "error" });
    } finally {
      setIsRollingBack(false);
      setRollbackTarget(null);
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return <FileText className="h-4 w-4" />;
      case "MANUAL_EDIT": return <Pencil className="h-4 w-4" />;
      case "ROLLBACK": return <RotateCcw className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return "text-blue-400 bg-blue-500/20 border-blue-500/30";
      case "MANUAL_EDIT": return "text-emerald-400 bg-emerald-500/20 border-emerald-500/30";
      case "ROLLBACK": return "text-amber-400 bg-amber-500/20 border-amber-500/30";
      default: return "text-neutral-400 bg-neutral-500/20 border-neutral-500/30";
    }
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case "PDF_IMPORT": return "PDF Import";
      case "MANUAL_EDIT": return "Manual Edit";
      case "ROLLBACK": return "Rollback";
      default: return source;
    }
  };

  const formatRelativeTime = (isoDate: string) => {
    const date = new Date(isoDate);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const summarizeMutations = (mutations: AuditMutation[]) => {
    const creates = mutations.filter(m => m.action === "CREATE").length;
    const updates = mutations.filter(m => m.action === "UPDATE").length;
    const deletes = mutations.filter(m => m.action === "DELETE").length;

    const parts: string[] = [];
    if (creates) parts.push(`${creates} created`);
    if (updates) parts.push(`${updates} updated`);
    if (deletes) parts.push(`${deletes} deleted`);
    return parts.join(", ") || "No changes";
  };

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50 dark:bg-[#050505] transition-colors duration-300">
      {isRollingBack && <RewindOverlay />}

      <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-4 md:px-8 bg-white/80 dark:bg-[#0a0a0a]/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-teal-500" />
          <h1 className="text-lg md:text-xl font-medium text-neutral-900 dark:text-neutral-200">Time Machine</h1>
        </div>
        <button
          onClick={() => fetchLogs()}
          disabled={isLoading}
          className="text-sm text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
        >
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
        </button>
      </header>

      <div className="flex-1 p-4 md:p-8 max-w-6xl mx-auto w-full">
        {message && (
          <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${
            message.type === "success"
              ? "bg-teal-500/10 text-teal-400 border border-teal-500/20"
              : "bg-red-500/10 text-red-400 border border-red-500/20"
          }`}>
            {message.type === "error" ? <AlertTriangle className="h-5 w-5 flex-shrink-0" /> : <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
            <span className="text-sm">{message.text}</span>
            <button onClick={() => setMessage(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">Dismiss</button>
          </div>
        )}

        {!isLoading && logs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <RotateCcw className="h-12 w-12 text-neutral-300 dark:text-neutral-700 mb-4" />
            <h2 className="text-lg font-medium text-neutral-600 dark:text-neutral-400 mb-2">No changes recorded yet</h2>
            <p className="text-sm text-neutral-400 dark:text-neutral-500">Import a PDF or edit an asset to start building your audit trail.</p>
          </div>
        )}

        {logs.length > 0 && (
          <div className="relative md:flex md:gap-6">
            {/* Timeline column */}
            <div className="relative md:w-[380px] md:flex-shrink-0">
              <div className="absolute left-[19px] md:left-[23px] top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/40 via-neutral-500/20 to-transparent" />

              <div className="space-y-1">
                {logs.map((log) => {
                  const isExpanded = expandedSK === log.SK;
                  const isTarget = rollbackTarget === log.SK;

                  return (
                    <div key={log.SK} className="relative">
                      <button
                        onClick={() => setExpandedSK(isExpanded ? null : log.SK)}
                        className={`w-full text-left group ${isExpanded ? "md:bg-white/50 md:dark:bg-white/5 rounded-xl" : ""}`}
                      >
                        <div className="flex items-start gap-3 md:gap-4 py-3 px-2 rounded-xl hover:bg-white/50 dark:hover:bg-white/5 transition-colors">
                          <div className={`relative z-10 flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-full border-2 flex items-center justify-center ${getSourceColor(log.source)} ${isTarget ? "animate-pulse" : ""}`}>
                            {getSourceIcon(log.source)}
                          </div>

                          <div className="flex-1 min-w-0 pt-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                                {getSourceLabel(log.source)}
                              </span>
                              {log.metadata && (log.source === "PDF_IMPORT" || log.source === "MANUAL_EDIT") && (
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                                  — {log.metadata}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-neutral-400 dark:text-neutral-500" title={new Date(log.createdAt).toLocaleString()}>
                                {formatRelativeTime(log.createdAt)}
                              </span>
                              <span className="text-xs text-neutral-400 dark:text-neutral-500">
                                · {summarizeMutations(log.mutations)}
                              </span>
                            </div>
                          </div>

                          <div className="flex-shrink-0 pt-2">
                            {isExpanded
                              ? <ChevronDown className="h-4 w-4 text-neutral-400" />
                              : <ChevronRight className="h-4 w-4 text-neutral-400" />
                            }
                          </div>
                        </div>
                      </button>

                      {/* Mobile: inline diff card */}
                      {isExpanded && (
                        <div className="md:hidden ml-12 mb-4 mt-1 animate-[audit-slide-in_0.2s_ease-out]">
                          <DiffCard log={log} isRollingBack={isRollingBack} onRollback={handleRollback} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {lastKey && (
                <div className="text-center py-8">
                  <button
                    onClick={() => fetchLogs(lastKey)}
                    disabled={isLoading}
                    className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors disabled:opacity-50"
                  >
                    {isLoading ? "Loading..." : "Load more"}
                  </button>
                </div>
              )}
            </div>

            {/* Desktop: side diff card */}
            <div className="hidden md:block flex-1 min-w-0">
              <div className="sticky top-20">
                {expandedSK ? (
                  <div className="animate-[audit-slide-in_0.2s_ease-out]" key={expandedSK}>
                    <DiffCard
                      log={logs.find(l => l.SK === expandedSK)!}
                      isRollingBack={isRollingBack}
                      onRollback={handleRollback}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Clock className="h-8 w-8 text-neutral-300 dark:text-neutral-700 mb-3" />
                    <p className="text-sm text-neutral-400 dark:text-neutral-500">Select an entry to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {isLoading && logs.length === 0 && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          </div>
        )}
      </div>
    </div>
  );
}

function DiffCard({ log, isRollingBack, onRollback }: { log: AuditLog; isRollingBack: boolean; onRollback: (sk: string) => void }) {
  return (
    <div className="bg-white/60 dark:bg-white/5 backdrop-blur-xl border border-neutral-200 dark:border-white/10 rounded-xl p-4 space-y-3">
      {log.mutations.map((m, mIndex) => (
        <MutationCard key={mIndex} mutation={m} />
      ))}

      {log.source !== "ROLLBACK" && (
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRollback(log.SK);
            }}
            disabled={isRollingBack}
            className="w-full md:w-auto px-4 py-2.5 rounded-lg text-sm font-medium
              bg-amber-500/10 text-amber-600 dark:text-amber-400
              border border-amber-500/20
              hover:bg-amber-500/20 hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/10
              hover:animate-pulse
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-4 w-4" />
            Revert to before this change
          </button>
        </div>
      )}
    </div>
  );
}

function MutationCard({ mutation }: { mutation: AuditMutation }) {
  const actionColors = {
    CREATE: { badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30", prefix: "+" },
    UPDATE: { badge: "bg-blue-500/20 text-blue-400 border-blue-500/30", prefix: "~" },
    DELETE: { badge: "bg-red-500/20 text-red-400 border-red-500/30", prefix: "-" },
  };

  const { badge, prefix } = actionColors[mutation.action];

  const diffFields = () => {
    if (mutation.action === "CREATE" && mutation.after) {
      return (
        <div className="space-y-1">
          <DiffLine label="Quantity" value={mutation.after.quantity} color="text-emerald-400" />
          <DiffLine label="Market Value" value={`$${mutation.after.marketValue.toLocaleString()}`} color="text-emerald-400" />
          <DiffLine label="Book Cost" value={`$${mutation.after.bookCost.toLocaleString()}`} color="text-emerald-400" />
        </div>
      );
    }

    if (mutation.action === "DELETE" && mutation.before) {
      return (
        <div className="space-y-1">
          <DiffLine label="Quantity" value={mutation.before.quantity} color="text-red-400" strikethrough />
          <DiffLine label="Market Value" value={`$${mutation.before.marketValue.toLocaleString()}`} color="text-red-400" strikethrough />
          <DiffLine label="Book Cost" value={`$${mutation.before.bookCost.toLocaleString()}`} color="text-red-400" strikethrough />
        </div>
      );
    }

    if (mutation.action === "UPDATE" && mutation.before && mutation.after) {
      const fields: { label: string; before: string | number; after: string | number }[] = [];

      const keys: (keyof typeof mutation.before)[] = [
        "quantity", "marketValue", "bookCost", "profitLoss", "liveTickerPrice",
        "currency", "account", "accountNumber", "accountType", "sector", "market",
        "securityType", "strategyType", "managementFee", "yield",
        "oneYearReturn", "threeYearReturn", "fiveYearReturn",
      ];

      for (const key of keys) {
        const bVal = mutation.before[key];
        const aVal = mutation.after[key];
        if (bVal !== aVal) {
          const label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
          const formatVal = (v: string | number) => typeof v === "number" && (key.includes("Value") || key.includes("Cost") || key.includes("Loss"))
            ? `$${v.toLocaleString()}`
            : String(v);
          fields.push({ label, before: formatVal(bVal), after: formatVal(aVal) });
        }
      }

      if (fields.length === 0) {
        return <p className="text-xs text-neutral-500">No visible field changes</p>;
      }

      return (
        <div className="space-y-1.5">
          {fields.map(f => (
            <div key={f.label} className="flex flex-col md:flex-row md:items-center gap-0.5 md:gap-2 text-xs">
              <span className="text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{f.label}</span>
              <span className="text-red-400 line-through">{String(f.before)}</span>
              <span className="text-neutral-500 hidden md:inline">→</span>
              <span className="text-emerald-400">{String(f.after)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex items-start gap-3">
      <div className={`flex-shrink-0 px-2 py-0.5 rounded text-xs font-mono border ${badge}`}>
        {prefix} {mutation.action}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1">{mutation.ticker}</p>
        {diffFields()}
      </div>
    </div>
  );
}

function DiffLine({ label, value, color, strikethrough }: { label: string; value: string | number; color: string; strikethrough?: boolean }) {
  return (
    <div className={`text-xs flex gap-2 ${color}`}>
      <span className="text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{label}</span>
      <span className={strikethrough ? "line-through" : ""}>{String(value)}</span>
    </div>
  );
}
