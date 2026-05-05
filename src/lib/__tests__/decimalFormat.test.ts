import {
  formatPrice,
  formatQuantity,
  formatTotal,
  formatRowPercent,
  formatTopPercent,
  formatCurrencyAmount,
} from "../decimalFormat";

describe("decimalFormat — global 0-decimal rule", () => {
  it("formatPrice renders prices as whole dollars", () => {
    expect(formatPrice(123.456)).toBe("123");
    expect(formatPrice(0)).toBe("0");
    expect(formatPrice(1234567.89)).toBe("1,234,568");
  });

  it("formatQuantity renders quantities as whole numbers", () => {
    expect(formatQuantity(42.7)).toBe("43");
    expect(formatQuantity(0)).toBe("0");
    expect(formatQuantity(1500)).toBe("1,500");
  });

  it("formatTotal renders totals with locale separators and 0 decimals", () => {
    expect(formatTotal(1234567)).toBe("1,234,567");
    expect(formatTotal(99.5)).toBe("100");
  });

  it("renders Not Found for null/undefined/non-finite inputs", () => {
    expect(formatPrice(null)).toBe("Not Found");
    expect(formatPrice(undefined)).toBe("Not Found");
    expect(formatPrice(Number.NaN)).toBe("Not Found");
    expect(formatQuantity(null)).toBe("Not Found");
    expect(formatTotal(null)).toBe("Not Found");
  });
});

describe("decimalFormat — row-level percent (1 dp)", () => {
  it("formatRowPercent renders ratios as 1-decimal percents", () => {
    // Yield, oneYearReturn, threeYearReturn are stored as decimals (0.045 = 4.5%)
    expect(formatRowPercent(0.045)).toBe("4.5%");
    expect(formatRowPercent(0.12)).toBe("12.0%");
    expect(formatRowPercent(-0.0123)).toBe("-1.2%");
    expect(formatRowPercent(0)).toBe("0.0%");
  });

  it("renders Not Found for null/undefined/non-finite", () => {
    expect(formatRowPercent(null)).toBe("Not Found");
    expect(formatRowPercent(undefined)).toBe("Not Found");
    expect(formatRowPercent(Number.NaN)).toBe("Not Found");
  });
});

describe("decimalFormat — top-of-page percent (2 dp)", () => {
  it("formatTopPercent renders ratios as 2-decimal percents with sign on positive", () => {
    expect(formatTopPercent(0.0456)).toBe("+4.56%");
    expect(formatTopPercent(-0.0456)).toBe("-4.56%");
    expect(formatTopPercent(0)).toBe("0.00%");
  });

  it("formatTopPercent omits sign when withSign=false", () => {
    expect(formatTopPercent(0.0456, { withSign: false })).toBe("4.56%");
    expect(formatTopPercent(-0.0456, { withSign: false })).toBe("-4.56%");
  });

  it("renders Not Found for null/undefined/non-finite", () => {
    expect(formatTopPercent(null)).toBe("Not Found");
    expect(formatTopPercent(undefined)).toBe("Not Found");
  });
});

describe("decimalFormat — currency amount with symbol", () => {
  it("formatCurrencyAmount prefixes the symbol per ISO code (whole dollars)", () => {
    expect(formatCurrencyAmount(1234, "CAD")).toBe("$1,234");
    expect(formatCurrencyAmount(1234, "USD")).toBe("US$1,234");
  });

  it("falls back to bare dollar sign for unknown currency codes", () => {
    expect(formatCurrencyAmount(1234, "EUR")).toBe("$1,234");
    expect(formatCurrencyAmount(1234, undefined)).toBe("$1,234");
  });

  it("renders Not Found for null/undefined/non-finite amounts", () => {
    expect(formatCurrencyAmount(null, "CAD")).toBe("Not Found");
    expect(formatCurrencyAmount(undefined, "USD")).toBe("Not Found");
    expect(formatCurrencyAmount(Number.NaN, "CAD")).toBe("Not Found");
  });
});
