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
});
