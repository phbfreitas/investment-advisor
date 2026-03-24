// src/components/AuditToast.tsx
"use client";

import { useEffect, useState } from "react";
import { Shield, X } from "lucide-react";
import Link from "next/link";

export interface AuditToastData {
  id: string;
  message: string;
  ticker?: string;
}

interface AuditToastProps {
  toasts: AuditToastData[];
  onDismiss: (id: string) => void;
}

export function AuditToast({ toasts, onDismiss }: AuditToastProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <AuditToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function AuditToastItem({ toast, onDismiss }: { toast: AuditToastData; onDismiss: (id: string) => void }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));

    const timer = setTimeout(() => {
      setIsLeaving(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, 5000);

    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`
        pointer-events-auto max-w-sm w-full
        bg-white/10 dark:bg-white/5 backdrop-blur-xl
        border border-white/20 dark:border-white/10
        rounded-xl shadow-2xl shadow-black/20
        p-4 flex items-start gap-3
        transition-all duration-300 ease-out
        ${isVisible && !isLeaving ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
        <Shield className="h-4 w-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
          {toast.message}
        </p>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
          Exact snapshot secured in Audit Trail.
        </p>
        <Link
          href="/audit"
          className="inline-block mt-2 text-xs font-medium text-teal-600 dark:text-teal-400 hover:text-teal-500 dark:hover:text-teal-300 transition-colors"
        >
          View in Time Machine →
        </Link>
      </div>
      <button
        onClick={() => {
          setIsLeaving(true);
          setTimeout(() => onDismiss(toast.id), 300);
        }}
        className="flex-shrink-0 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
