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

        // With the stricter regex: CAD/USD ends with "USD" at the trailing position.
        // detectInlineCurrency now correctly identifies USD (not returning null for ambiguity).
        // The section header also says USD, so the result is USD either way.
        // If this line were under a CAD section, the inline-detected USD would correctly override it.
        expect(holdings).toHaveLength(1);
        expect(holdings[0].currency).toBe("USD");
    });

    it("applies full precedence inline > section > document default in a TFSA-style mixed statement", () => {
        const text = `
Account No. TFSA12345

Canadian Dollar Holdings
VFV.TO 100 50.00 5500.00
XEQT.TO 50 30.00 1600.00

U.S. Dollar Holdings
SPY 25 400.00 10500.00
QQQ 10 350.00 3700.00

VEA.TO 5 10.00 55.00 USD
        `.trim();

        const holdings = parseHoldings(text);

        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
        expect(byTicker["VFV.TO"].currency).toBe("CAD");
        expect(byTicker["XEQT.TO"].currency).toBe("CAD");
        expect(byTicker["SPY"].currency).toBe("USD");
        expect(byTicker["QQQ"].currency).toBe("USD");
        expect(byTicker["VEA.TO"]?.currency).toBe("USD");
    });

    it("rejects mid-line narrative USD tokens (spoof guard) — token must be at trailing position", () => {
        // Document defaults to USD (no Canadian markers). The holding line has a "USD" token
        // mid-line in the asset description ("USD-priced"), followed by non-currency text.
        // The currency token is NOT at the trailing position. With the stricter parser,
        // mid-line tokens are ignored.
        const text = `
Account No. ABC123 TFSA

AAPL 100 150.00 15000.00 USD-priced Class A
    `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(1);
        expect(holdings[0].ticker).toBe("AAPL");
        // "USD" appears mid-line followed by "-priced Class A", so it's not at trailing position.
        // OLD permissive regex: \bUSD\b would match anywhere, tag as USD via inline.
        // NEW stricter regex: requires USD at trailing position (end of line, after numerics).
        // This line ends with "A" (word chars), not the currency token. Regex fails,
        // falls through to document default: USD.
        expect(holdings[0].currency).toBe("USD");
    });

    it("does not let a mid-line USD token in a CAD-default document spoof the row to USD", () => {
        const text = `
Account No. ABC123 TFSA
Canadian Dollar Holdings

AAPL 100 150.00 15000.00 USD-denominated share class
    `.trim();

        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(1);
        expect(holdings[0].ticker).toBe("AAPL");
        // "USD" appears mid-line in "USD-denominated share class", followed by a hyphen and text.
        // Document context: "Canadian Dollar Holdings" sets section currency to CAD.
        // OLD permissive regex: \bUSD\b would match anywhere, tag as USD via inline.
        // NEW stricter regex: requires USD at trailing position. This line ends with "class"
        // (word chars after "USD-"), so regex fails. Falls through to section default: CAD.
        expect(holdings[0].currency).toBe("CAD");
    });

    it("matches Wealthsimple 'Canadian Equities and Alternatives' as a CAD section header", () => {
        const text = `
Account No. H16429542CAD
Self-directed RRSP Account

Portfolio Assets

Canadian Equities and Alternatives
ZWK 1770.0000 1770.0000 0.0000 $25.62
CAD
$45,347.40
CAD
$31,996.08
CAD
QMAX 1615.1800 1615.1800 0.0000 $18.96
CAD
$30,623.81
CAD
$31,302.19
CAD

US Equities and Alternatives
COST 9.2322 9.2322 0.0000 $996.43
USD
$9,199.24
USD
$8,003.19
USD
VGT 106.0000 101.0000 0.0000 $697.72
USD
$73,958.32
USD
$25,187.20
USD
        `.trim();

        const holdings = parseHoldings(text);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));

        // CAD-section holdings
        expect(byTicker["ZWK"]?.currency).toBe("CAD");
        expect(byTicker["QMAX"]?.currency).toBe("CAD");

        // USD-section holdings — these were the bug. Pre-patch, they would
        // tag CAD because the section regex didn't match Wealthsimple's wording
        // and the document default fell through to CAD.
        expect(byTicker["COST"]?.currency).toBe("USD");
        expect(byTicker["VGT"]?.currency).toBe("USD");
    });

    it("matches a bare 'Canadian Equities' header (no 'and Alternatives' trailing clause)", () => {
        const text = `
Canadian Equities
VFV.TO 100 50.00 5500.00

US Equities
SPY 25 400.00 10500.00
        `.trim();

        const holdings = parseHoldings(text);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
        expect(byTicker["VFV.TO"]?.currency).toBe("CAD");
        expect(byTicker["SPY"]?.currency).toBe("USD");
    });

    it("does not let runaway text after a country word spoof a section header", () => {
        // The new regex still requires a known noun ('Equities', 'Holdings', etc.)
        // immediately after the optional 'Dollar'. Free-form text like
        // 'Canadian banks index' does NOT trigger a section-currency switch.
        const text = `
U.S. Dollar Holdings
SPY 25 400.00 10500.00

Canadian banks underperformed today
QQQ 10 350.00 3700.00
        `.trim();

        const holdings = parseHoldings(text);
        const byTicker = Object.fromEntries(holdings.map(h => [h.ticker, h]));
        // SPY explicitly under USD section.
        expect(byTicker["SPY"]?.currency).toBe("USD");
        // QQQ comes after a narrative line that mentions "Canadian" but isn't
        // a section header. Section currency should remain USD.
        expect(byTicker["QQQ"]?.currency).toBe("USD");
    });
});
