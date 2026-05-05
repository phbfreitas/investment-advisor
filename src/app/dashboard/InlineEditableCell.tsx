"use client";

import { useState, useRef, useEffect, type KeyboardEvent } from "react";

type CellValue = string | number | null;

interface InlineEditableCellProps {
  value: CellValue;
  kind: "text" | "number" | "select";
  options?: string[];
  display?: (value: CellValue) => React.ReactNode;
  onSave: (next: CellValue) => Promise<void>;
  disabled?: boolean;
  ariaLabel: string;
  inputClassName?: string;
}

export function InlineEditableCell({
  value,
  kind,
  options = [],
  display,
  onSave,
  disabled,
  ariaLabel,
  inputClassName = "",
}: InlineEditableCellProps) {
  const toStr = (v: CellValue) => (v === null || v === undefined ? "" : String(v));

  const [editing, setEditing] = useState(false);
  // `committed` tracks the last successfully saved value for optimistic display.
  // It is seeded from the parent prop and updated on each successful save.
  const [committed, setCommitted] = useState<string>(toStr(value));
  const [draft, setDraft] = useState<string>(toStr(value));
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);
  // Track the last parent value we synced from so we only re-sync on external
  // value changes (e.g. server refetch), not when editing flips to false after
  // a save (which would overwrite the optimistic committed state).
  const prevValueRef = useRef<string>(toStr(value));

  // Re-sync committed (and draft when closed) if the parent's value changes
  // (e.g., after a server refetch). When editing is open, leave draft alone.
  useEffect(() => {
    const s = toStr(value);
    if (s === prevValueRef.current) return;
    prevValueRef.current = s;
    if (!editing) {
      setCommitted(s);
      setDraft(s);
    }
  }, [value, editing]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const enterEdit = () => {
    if (disabled) return;
    setEditing(true);
    setError(false);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(committed);
    setError(false);
  };

  const commit = async () => {
    setSaving(true);
    setError(false);
    try {
      const next: CellValue = kind === "number"
        ? (draft === "" ? null : Number(draft))
        : draft;
      await onSave(next);
      setCommitted(draft);
      setEditing(false);
    } catch {
      setError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key === "Escape") cancel();
    if (e.key === "Enter" && kind !== "select") {
      e.preventDefault();
      if (!saving) void commit();
    }
  };

  if (!editing) {
    // Use committed (optimistic) value for display; fall back to parent value
    // for the custom `display` formatter so callers see the real typed value.
    const displayValue: CellValue = kind === "number"
      ? (committed === "" ? null : Number(committed))
      : committed;
    const rendered = display ? display(displayValue) : (committed === "" ? "—" : committed);
    return (
      <button
        type="button"
        onClick={enterEdit}
        aria-label={ariaLabel}
        className={`text-left ${disabled ? "cursor-not-allowed opacity-70" : "hover:text-teal-600 dark:hover:text-teal-400"} transition-colors`}
        disabled={disabled}
      >
        {rendered}
      </button>
    );
  }

  const errorRing = error ? "border-red-500 dark:border-red-500" : "border-neutral-300 dark:border-neutral-700";
  const baseInput = `text-xs rounded border ${errorRing} px-1 py-0.5 bg-white dark:bg-neutral-900 ${inputClassName}`;

  return (
    <div className="flex flex-col gap-1">
      {kind === "select" ? (
        <select
          ref={el => { inputRef.current = el; }}
          className={baseInput}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
        >
          <option value="" />
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input
          ref={el => { inputRef.current = el; }}
          type={kind === "number" ? "number" : "text"}
          className={baseInput}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKey}
        />
      )}
      <div className="flex gap-1">
        <button type="button" onClick={() => void commit()} disabled={saving} className="text-xs text-teal-600 dark:text-teal-400 font-medium disabled:opacity-50">Save</button>
        <button type="button" onClick={cancel} className="text-xs text-neutral-500">Cancel</button>
      </div>
    </div>
  );
}
