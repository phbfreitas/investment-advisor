"use client";

interface Props {
  /** The text to render when value is missing. Defaults to "Not Found". */
  label?: string;
  /** Optional tooltip text on hover. */
  title?: string;
}

export function NotFoundCell({ label = "Not Found", title = "Value not found in market data — please review" }: Props) {
  return (
    <span
      className="px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 italic border border-yellow-200 dark:border-yellow-800/50 cursor-help"
      title={title}
    >
      {label}
    </span>
  );
}
