/**
 * @jest-environment jsdom
 */
import { render, screen, within } from "@testing-library/react";
import { ConcentrationSection } from "../ConcentrationSection";
import type { TopHoldings } from "../lib/types";

const makeTopHoldings = (rows: Array<{ ticker: string; percent: number }>): TopHoldings => ({
    top: rows.map(r => ({
        ticker: r.ticker,
        marketValue: 1000,
        percent: r.percent,
        call: "No",
        account: "Brokerage",
        sector: "IT",
        currency: "USD",
    })),
    others: null,
    totalValue: rows.reduce((sum, r) => sum + 1000, 0),
});

describe("ConcentrationSection title", () => {
    it("shows sum of percents in title with 10 holdings", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 10 },
            { ticker: "B", percent: 9 },
            { ticker: "C", percent: 8 },
            { ticker: "D", percent: 7 },
            { ticker: "E", percent: 6 },
            { ticker: "F", percent: 5 },
            { ticker: "G", percent: 4 },
            { ticker: "H", percent: 3 },
            { ticker: "I", percent: 2 },
            { ticker: "J", percent: 1 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        const title = screen.getByRole("heading", { level: 3 });
        expect(within(title).getByText(/Top 10 Holdings/i)).toBeInTheDocument();
        expect(within(title).getByText(/55\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("adapts the count when fewer than 10 holdings are present", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 50 },
            { ticker: "B", percent: 25 },
            { ticker: "C", percent: 15 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        const title = screen.getByRole("heading", { level: 3 });
        expect(within(title).getByText(/Top 3 Holdings/i)).toBeInTheDocument();
        expect(within(title).getByText(/90\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("renders 0.0% when there are no holdings", () => {
        render(<ConcentrationSection topHoldings={{ top: [], others: null, totalValue: 0 }} />);
        const title = screen.getByRole("heading", { level: 3 });
        expect(within(title).getByText(/Top 0 Holdings/i)).toBeInTheDocument();
        expect(within(title).getByText(/0\.0% of portfolio/i)).toBeInTheDocument();
    });

    it("rounds to one decimal", () => {
        const data = makeTopHoldings([
            { ticker: "A", percent: 33.33 },
            { ticker: "B", percent: 33.33 },
            { ticker: "C", percent: 33.34 },
        ]);
        render(<ConcentrationSection topHoldings={data} />);
        // 33.33 + 33.33 + 33.34 = 100.00
        const title = screen.getByRole("heading", { level: 3 });
        expect(within(title).getByText(/100\.0% of portfolio/i)).toBeInTheDocument();
    });
});
