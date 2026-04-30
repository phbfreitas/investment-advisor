import { parseHoldings } from "../parseHoldings";

describe("parseHoldings — currency", () => {
    it("tags every row with the document-level currency when no per-row markers exist", () => {
        const text = `
Account No. ABC123 TFSA
Some preamble.

VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(2);
        expect(holdings.every(h => h.currency === "USD")).toBe(true);
    });

    it("tags every row CAD when 'Canadian' appears at document level and no per-row markers exist", () => {
        const text = `
Canadian portfolio summary.

VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(2);
        expect(holdings.every(h => h.currency === "CAD")).toBe(true);
    });

    it("tags rows with the most recent section-header currency", () => {
        const text = `
Account No. ABC123 TFSA

Canadian Dollar Holdings
VFV.TO 100 50.00 5500.00

U.S. Dollar Holdings
SPY 25 400.00 10500.00
QQQ 10 350.00 3700.00
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(3);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
        expect(byTicker["VFV.TO"].currency).toBe("CAD");
        expect(byTicker["SPY"].currency).toBe("USD");
        expect(byTicker["QQQ"].currency).toBe("USD");
    });

    it("does NOT switch section currency from a narrative/footer line", () => {
        const text = `
Account No. ABC123 TFSA

U.S. Dollar Holdings
SPY 25 400.00 10500.00

Total Canadian Dollar Holdings: $0.00
QQQ 10 350.00 3700.00
        `.trim();

        const holdings = parseHoldings(text);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));

        // SPY clearly under USD section.
        expect(byTicker["SPY"]?.currency).toBe("USD");
        // QQQ comes AFTER "Total Canadian Dollar Holdings: $0.00" — that line
        // is a totals footer, not a real section header. Under the unanchored
        // regex (pre-fix), QQQ would be tagged CAD. Anchored regex keeps it USD.
        expect(byTicker["QQQ"]?.currency).toBe("USD");
    });

    it("uses an inline USD/CAD token in a row to override the section/document default", () => {
        const text = `
Canadian portfolio summary.

VFV.TO 100 50.00 5500.00 CAD
SPY 25 400.00 10500.00 USD
        `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(2);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
        expect(byTicker["VFV.TO"].currency).toBe("CAD");
        expect(byTicker["SPY"].currency).toBe("USD");
    });

    it("falls through to section/default when a row contains both USD and CAD tokens (ambiguous)", () => {
        const text = `
U.S. Dollar Holdings
VFV.TO 100 50.00 5500.00 CAD/USD
        `.trim();

        const holdings = parseHoldings(text);

        // Both inline tokens present → detectInlineCurrency returns null → falls
        // through to sectionCurrency (USD), NOT the first-matched config.
        expect(holdings).toHaveLength(1);
        expect(holdings[0].currency).toBe("USD");
    });
});
