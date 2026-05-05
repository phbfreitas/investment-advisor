const NOT_FOUND = "Not Found";

const isMissing = (v: number | null | undefined): v is null | undefined =>
  v == null || !Number.isFinite(v);

export function formatPrice(value: number | null | undefined): string {
  if (isMissing(value)) return NOT_FOUND;
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const formatQuantity = formatPrice;
export const formatTotal = formatPrice;

export function formatRowPercent(value: number | null | undefined): string {
  if (isMissing(value)) return NOT_FOUND;
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function formatTopPercent(
  value: number | null | undefined,
  opts: { withSign?: boolean } = {},
): string {
  if (isMissing(value)) return NOT_FOUND;
  const { withSign = true } = opts;
  const n = Number(value) * 100;
  const body = `${n.toFixed(2)}%`;
  if (!withSign) return body;
  return n > 0 ? `+${body}` : body;
}

const CURRENCY_PREFIX: Record<string, string> = {
  CAD: "$",
  USD: "US$",
};

export function formatCurrencyAmount(
  value: number | null | undefined,
  currency: string | undefined,
): string {
  if (isMissing(value)) return NOT_FOUND;
  const prefix = currency ? (CURRENCY_PREFIX[currency] ?? "$") : "$";
  return `${prefix}${formatTotal(value)}`;
}
