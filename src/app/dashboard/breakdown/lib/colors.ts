const PALETTE = [
  "#3b82f6", "#ef4444", "#10b981", "#6366f1", "#f59e0b",
  "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6",
  "#a855f7", "#fbbf24",
];
const UNCATEGORIZED = "#9ca3af";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function paletteFor(label: string | null | undefined): string {
  if (!label) return UNCATEGORIZED;
  return PALETTE[hash(label) % PALETTE.length];
}

/**
 * Returns the color for a slice at a given position within a chart.
 * Sequential assignment guarantees no two slices in the same chart share a color
 * (as long as N <= palette length). When a chart has more slices than palette
 * colors, wraps via modulo — but combined with the <5% "Others" rollup in
 * computeBreakdowns, this scenario rarely occurs in practice.
 */
export function paletteByIndex(index: number): string {
  if (index < 0) return UNCATEGORIZED;
  return PALETTE[index % PALETTE.length];
}

export const COLORS = {
  uncategorized: UNCATEGORIZED,
  severityRed: "#ef4444",
  severityWarn: "#f59e0b",
  severityInfo: "#9ca3af",
} as const;
