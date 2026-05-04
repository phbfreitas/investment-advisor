import { parseHoldings } from "../parseHoldings";

describe("parseHoldings — totals/footer rows must not become tickers", () => {
    it("ignores 'TOTAL ...' footer rows even with 3+ trailing numerics", () => {
        const text = `
Account No. 12345 TFSA
U.S. Dollar Holdings

VGT 50 580.00 29000.00
TOTAL 50 29000 29000
        `.trim();
        const holdings = parseHoldings(text);

        expect(holdings).toHaveLength(1);
        expect(holdings[0].ticker).toBe("VGT");
        expect(holdings[0].quantity).toBe(50);
    });

    it("ignores 'GRAND TOTAL' / 'SUBTOTAL' / 'BALANCE' footer rows", () => {
        const text = `
U.S. Dollar Holdings

VGT 50 580.00 29000.00
SUBTOTAL 50 29000 29000
GRAND TOTAL 50 29000 29000
BALANCE 50 0 0
        `.trim();
        const holdings = parseHoldings(text);

        expect(holdings.map(h => h.ticker)).toEqual(["VGT"]);
    });

    it("does NOT pick up the WS pattern from a totals row mid-line", () => {
        const text = `
TOTAL FOR ACCOUNT 50 29000 29000
        `.trim();
        const holdings = parseHoldings(text);
        expect(holdings).toHaveLength(0);
    });

    it("rejects rows where quantity looks like a year or page number", () => {
        // Real-world failure: a "Page 2 of 5" line with a stray ticker-like preceding word
        const text = `
EOD 2026 50 580
        `.trim();
        const holdings = parseHoldings(text);
        // EOD is uppercase + 3 letters; without context it would have matched. Reject.
        expect(holdings).toHaveLength(0);
    });

    it("still parses normal holding rows correctly (regression check)", () => {
        const text = `
U.S. Dollar Holdings

VGT 50 580.00 29000.00
QQQ 100 400.00 40000.00
        `.trim();
        const holdings = parseHoldings(text);
        expect(holdings).toHaveLength(2);
        expect(holdings.find(h => h.ticker === "VGT")?.quantity).toBe(50);
        expect(holdings.find(h => h.ticker === "QQQ")?.quantity).toBe(100);
    });
});
