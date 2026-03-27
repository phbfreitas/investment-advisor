"use client";

import { useState, useEffect, useCallback } from "react";
import { X, FileText, Pencil, RotateCcw, ChevronDown, ChevronRight, AlertTriangle, CheckCircle2, Loader2, Clock } from "lucide-react";
import type { AuditLog, AuditMutation } from "@/types/audit";
import { cn } from "@/lib/utils";

function RewindOverlay() {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="flex flex-col items-center gap-4">
        <RotateCcw className="h-16 w-16 text-amber-400 animate-spin" style={{ animationDirection: "reverse", animationDuration: "0.8s" }} />
        <p className="text-lg font-medium text-white">Reverting changes...</p>
      </div>
    </div>
  );
}

interface TimeMachineDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onRollbackComplete?: () => void;
}

export function TimeMachineDrawer({ isOpen, onClose, onRollbackComplete }: TimeMachineDrawerProps) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen, fetchLogs]);

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
        if (onRollbackComplete) onRollbackComplete();
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
    <>
      {isRollingBack && <RewindOverlay />}
      
      {/* Backdrop */}
      <div 
        className={cn(
          "fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Drawer */}
      <div 
        className={cn(
          "fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-[#0a0a0a] shadow-2xl border-l border-neutral-200 dark:border-neutral-800 transition-transform duration-300 ease-in-out transform flex flex-col",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <header className="flex-none h-16 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between px-6 bg-white dark:bg-[#0a0a0a] sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <RotateCcw className="h-5 w-5 text-teal-500" />
            <h2 className="text-lg font-medium text-neutral-900 dark:text-neutral-200">Time Machine</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 -mr-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-all"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
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
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <RotateCcw className="h-10 w-10 text-neutral-300 dark:text-neutral-700 mb-4" />
              <h3 className="text-md font-medium text-neutral-600 dark:text-neutral-400 mb-2">No changes recorded</h3>
              <p className="text-xs text-neutral-400 dark:text-neutral-500">Your audit trail will appear here as you make changes to your portfolio.</p>
            </div>
          )}

          <div className="relative">
            {logs.length > 0 && (
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-gradient-to-b from-teal-500/40 via-neutral-500/20 to-transparent" />
            )}

            <div className="space-y-4">
              {logs.map((log) => {
                const isExpanded = expandedSK === log.SK;
                const isTarget = rollbackTarget === log.SK;

                return (
                  <div key={log.SK} className="relative">
                    <button
                      onClick={() => setExpandedSK(isExpanded ? null : log.SK)}
                      className={cn(
                        "w-full text-left group transition-all rounded-xl",
                        isExpanded && "bg-neutral-50 dark:bg-neutral-900/50 p-2 -m-2 mb-2"
                      )}
                    >
                      <div className="flex items-start gap-3 py-2">
                        <div className={cn(
                          "relative z-10 flex-shrink-0 w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all",
                          getSourceColor(log.source),
                          isTarget && "animate-pulse scale-110 shadow-lg shadow-amber-500/20"
                        )}>
                          {getSourceIcon(log.source)}
                        </div>

                        <div className="flex-1 min-w-0 pt-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                              {getSourceLabel(log.source)}
                            </span>
                            <span className="text-[10px] text-neutral-400 dark:text-neutral-500 whitespace-nowrap">
                              {formatRelativeTime(log.createdAt)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                              {log.metadata || summarizeMutations(log.mutations)}
                            </span>
                            <div className="flex-shrink-0">
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 text-neutral-400" />
                                : <ChevronRight className="h-3.5 w-3.5 text-neutral-400" />
                              }
                            </div>
                          </div>
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="ml-12 mb-2 mt-1 animate-in slide-in-from-top-2 duration-200">
                        <DiffCard log={log} isRollingBack={isRollingBack} onRollback={handleRollback} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {lastKey && (
              <div className="text-center py-6">
                <button
                  onClick={() => fetchLogs(lastKey)}
                  disabled={isLoading}
                  className="text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-500 transition-colors disabled:opacity-50"
                >
                  {isLoading ? "Loading..." : "Load more entries"}
                </button>
              </div>
            )}
          </div>

          {isLoading && logs.length === 0 && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-teal-500" />
            </div>
          )}
        </div>

        <footer className="flex-none p-4 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900/50">
          <p className="text-[10px] text-center text-neutral-400 dark:text-neutral-500 uppercase tracking-widest font-semibold">
            SECURE AUDIT TRAIL ENABLED
          </p>
        </footer>
      </div>
    </>
  );
}

function DiffCard({ log, isRollingBack, onRollback }: { log: AuditLog; isRollingBack: boolean; onRollback: (sk: string) => void }) {
  return (
    <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl p-3 space-y-3 shadow-sm">
      {log.mutations.map((m, mIndex) => (
        <MutationCard key={mIndex} mutation={m} />
      ))}

      {log.source !== "ROLLBACK" && (
        <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRollback(log.SK);
            }}
            disabled={isRollingBack}
            className="w-full px-3 py-2 rounded-lg text-xs font-semibold
              bg-amber-500/10 text-amber-600 dark:text-amber-400
              border border-amber-500/20
              hover:bg-amber-500/20 hover:border-amber-500/40
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Revert to this point
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
          <DiffLine label="Qty" value={mutation.after.quantity} color="text-emerald-400" />
          <DiffLine label="Value" value={`$${mutation.after.marketValue.toLocaleString()}`} color="text-emerald-400" />
          {mutation.after.account && (
            <DiffLine label="Account" value={mutation.after.account} color="text-emerald-400" />
          )}
          {mutation.after.accountNumber && (
            <DiffLine label="Acct #" value={mutation.after.accountNumber} color="text-emerald-400" />
          )}
        </div>
      );
    }

    if (mutation.action === "DELETE" && mutation.before) {
      return (
        <div className="space-y-1">
          <DiffLine label="Qty" value={mutation.before.quantity} color="text-red-400" strikethrough />
          <DiffLine label="Value" value={`$${mutation.before.marketValue.toLocaleString()}`} color="text-red-400" strikethrough />
          {mutation.before.account && (
            <DiffLine label="Account" value={mutation.before.account} color="text-red-400" strikethrough />
          )}
          {mutation.before.accountNumber && (
            <DiffLine label="Acct #" value={mutation.before.accountNumber} color="text-red-400" strikethrough />
          )}
        </div>
      );
    }

    if (mutation.action === "UPDATE" && mutation.before && mutation.after) {
      const fields: { label: string; before: string | number; after: string | number }[] = [];

      const keys: (keyof typeof mutation.before)[] = [
        "quantity", 
        "marketValue", 
        "bookCost", 
        "yield", 
        "accountNumber", 
        "account", 
        "strategyType"
      ];

      for (const key of keys) {
        const bVal = mutation.before[key];
        const aVal = mutation.after[key];
        if (bVal !== aVal) {
          let label = key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase());
          if (key === "accountNumber") label = "Acct #";
          
          const formatVal = (v: any) => {
            if (v === null || v === undefined || v === "") return "None";
            return typeof v === "number" && (key.includes("Value") || key.includes("Cost"))
              ? `$${v.toLocaleString()}`
              : String(v);
          };
          fields.push({ label, before: formatVal(bVal), after: formatVal(aVal) });
        }
      }

      if (fields.length === 0) return <p className="text-[10px] text-neutral-500 italic">No major field changes</p>;

      return (
        <div className="space-y-1">
          {fields.map(f => (
            <div key={f.label} className="flex items-center gap-1.5 text-[10px]">
              <span className="text-neutral-500 min-w-[50px]">{f.label}</span>
              <span className="text-red-400 line-through truncate max-w-[50px]">{String(f.before)}</span>
              <span className="text-neutral-400">→</span>
              <span className="text-emerald-400 font-medium">{String(f.after)}</span>
            </div>
          ))}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="flex items-start gap-2">
      <div className={`flex-shrink-0 px-1 py-0.5 rounded text-[10px] font-mono border ${badge}`}>
        {prefix}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-neutral-900 dark:text-neutral-100">{mutation.ticker}</p>
        <div className="mt-1">{diffFields()}</div>
      </div>
    </div>
  );
}

function DiffLine({ label, value, color, strikethrough }: { label: string; value: string | number; color: string; strikethrough?: boolean }) {
  return (
    <div className={`text-[10px] flex gap-1.5 ${color}`}>
      <span className="text-neutral-500 min-w-[50px]">{label}</span>
      <span className={cn(strikethrough ? "line-through" : "font-medium")}>{String(value)}</span>
    </div>
  );
}
