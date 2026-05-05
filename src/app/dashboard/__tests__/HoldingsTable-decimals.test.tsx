/**
 * @jest-environment jsdom
 *
 * 5B Task 2 — decimal rule smoke tests.
 *
 * Verifies the Holdings table renders quantities, percents, and KPIs at the
 * correct decimal precision per the 5B spec (0 dp prices/quantities/totals;
 * 1 dp row-level Yield %/1YR Return; 2 dp top-level Total Return/Avg Div Yield).
 */
import { render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

// Minimal asset fixture sufficient to render the Holdings table.
const baseAsset = {
  PK: "HOUSEHOLD#h1",
  SK: "ASSET#a1",
  id: "a1",
  profileId: "h1",
  type: "ASSET" as const,
  account: "RRSP",
  ticker: "AAPL",
  securityType: "Stock",
  strategyType: "Growth",
  call: "",
  sector: "IT",
  market: "US",
  currency: "USD",
  managementStyle: "",
  externalRating: "",
  managementFee: null,
  quantity: 100,
  liveTickerPrice: 200,
  bookCost: 15000,
  marketValue: 20000,
  profitLoss: 5000,
  yield: 0.012,
  oneYearReturn: 0.187,
  fiveYearReturn: null,
  threeYearReturn: 0.092,
  exDividendDate: "",
  analystConsensus: "",
  beta: 1.1,
  riskFlag: "",
  accountNumber: "",
  accountType: "RRSP",
  risk: "",
  volatility: 0,
  expectedAnnualDividends: 240,
  updatedAt: "2026-05-04T00:00:00.000Z",
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: jest.fn(), push: jest.fn() }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    if (typeof url === "string" && url.includes("/api/profile")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({
          assets: [baseAsset],
          portfolioTotals: {
            cadTotal: 0,
            usdTotal: 20000,
            grandTotalCad: 27000,
            usdToCadRate: 1.35,
            fxUnavailable: false,
          },
          columnVisibility: {},
        }),
      }) as unknown as ReturnType<typeof fetch>;
    }
    if (typeof url === "string" && url.includes("/api/market-data")) {
      return Promise.resolve({ ok: true, json: async () => ({ currentPrice: 210 }) }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

/** Find the Holdings table data row for a given ticker. There may be multiple
 *  elements that contain the ticker text (e.g., the active row span and a ghost
 *  row td); we want the one inside a <tr> that is NOT struck-through (i.e., the
 *  live data row rather than a ghost row). */
async function findTickerRow(ticker: string) {
  // Wait for the ticker to appear in the DOM, then pick the element inside
  // a non-ghost tr (the live row's ticker cell wraps the ticker in a <span>).
  const elements = await screen.findAllByText(ticker);
  // Prefer the element whose ancestor tr lacks the audit-highlight-delete class.
  for (const el of elements) {
    const row = el.closest("tr");
    if (row && !row.classList.contains("audit-highlight-delete")) {
      return row;
    }
  }
  return elements[0].closest("tr")!;
}

describe("Holdings table — decimal rules", () => {
  it("renders quantity as a whole number", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    // quantity 100 → "100" (no decimals)
    expect(within(row).getByText("100")).toBeInTheDocument();
  });

  it("renders row-level Yield % at 1 decimal", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    // yield 0.012 → "1.2%"
    expect(within(row).getByText("1.2%")).toBeInTheDocument();
  });

  it("renders row-level 1YR Return % at 1 decimal", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    // oneYearReturn 0.187 → "18.7%"
    expect(within(row).getByText("18.7%")).toBeInTheDocument();
  });

  it("renders top-of-page Total Return at 2 decimals with sign", async () => {
    render(<DashboardPage />);
    await findTickerRow("AAPL");
    // totalCostBasis 15000, totalMV 21000 (live merged: 100 × 210)
    // totalReturn = (21000 - 15000) / 15000 = 0.40 → "+40.00%"
    expect(screen.getByText("+40.00%")).toBeInTheDocument();
  });

  it("renders Avg Dividend Yield at 2 decimals", async () => {
    render(<DashboardPage />);
    await findTickerRow("AAPL");
    // weighted yield = 0.012 (only one holding) → "1.20%"
    expect(screen.getByText("1.20%")).toBeInTheDocument();
  });
});
