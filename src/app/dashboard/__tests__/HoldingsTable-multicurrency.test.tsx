/**
 * @jest-environment jsdom
 *
 * 5B Task 4 — multi-currency contract.
 *
 * Locks the rule: ONE Total Market Value badge at the top aggregates per-asset
 * marketValue into CAD using the daily FX rate; row-level Book Cost / Market
 * Value cells show the asset's NATIVE currency (US$ for USD, $ for CAD). The
 * legacy duplicate "FX Portfolio Totals" panel is gone.
 */
import { render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

const cadAsset = {
  PK: "HOUSEHOLD#h1", SK: "ASSET#cad", id: "cad", profileId: "h1", type: "ASSET" as const,
  account: "TFSA", ticker: "VFV.TO", securityType: "ETF", strategyType: "Index", call: "",
  sector: "IT", market: "Canada", currency: "CAD",
  managementStyle: "", externalRating: "", managementFee: null,
  quantity: 50, liveTickerPrice: 100, bookCost: 4000, marketValue: 5000, profitLoss: 1000,
  yield: 0, oneYearReturn: 0.10, fiveYearReturn: null, threeYearReturn: null,
  exDividendDate: "", analystConsensus: "", beta: 0, riskFlag: "",
  accountNumber: "", accountType: "TFSA", risk: "", volatility: 0, expectedAnnualDividends: 0,
  updatedAt: "2026-05-04T00:00:00.000Z",
};
const usdAsset = {
  ...cadAsset, SK: "ASSET#usd", id: "usd", account: "RRSP", ticker: "AAPL",
  market: "US", currency: "USD",
  quantity: 100, liveTickerPrice: 200, bookCost: 15000, marketValue: 20000, profitLoss: 5000,
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
          assets: [cadAsset, usdAsset],
          portfolioTotals: {
            cadTotal: 5000,
            usdTotal: 20000,
            grandTotalCad: 32000, // 5000 + 20000 * 1.35
            usdToCadRate: 1.35,
            fxUnavailable: false,
          },
          columnVisibility: {},
        }),
      }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

/** Find the live (non-ghost) Holdings-table row for a given ticker. The ticker
 *  appears multiple places (active-row span, ghost-row td, etc.); we want the
 *  <tr> that is the live data row. */
async function findTickerRow(ticker: string) {
  const elements = await screen.findAllByText(ticker);
  for (const el of elements) {
    const row = el.closest("tr");
    if (row && !row.classList.contains("audit-highlight-delete")) {
      return row;
    }
  }
  return elements[0].closest("tr")!;
}

describe("Holdings — multi-currency contract", () => {
  it("renders ONE Total Market Value badge with CAD grand total", async () => {
    render(<DashboardPage />);
    await findTickerRow("VFV.TO");
    // Single badge headline shows CAD grand total
    expect(screen.getByText("$32,000")).toBeInTheDocument();
    // FX rate footnote present
    expect(screen.getByText(/at 1 USD = 1\.3500 CAD/)).toBeInTheDocument();
  });

  it("does NOT render the legacy duplicate FX Portfolio Totals panel", async () => {
    render(<DashboardPage />);
    await findTickerRow("VFV.TO");
    // The old panel had distinct labels "CAD Portfolio" and "USD Portfolio".
    // After collapse, neither label appears — they're replaced by per-currency subtotals.
    expect(screen.queryByText("CAD Portfolio")).not.toBeInTheDocument();
    expect(screen.queryByText("USD Portfolio")).not.toBeInTheDocument();
  });

  it("renders per-currency subtotals inside the same badge", async () => {
    render(<DashboardPage />);
    await findTickerRow("VFV.TO");
    // Anchor each subtotal to its label inside the badge to disambiguate from
    // the asset-row Market Value cells (which also render "US$20,000").
    const cadSubtotalLabel = screen.getByText("CAD subtotal");
    const cadRow = cadSubtotalLabel.closest("div")!;
    expect(within(cadRow).getByText("$5,000 CAD")).toBeInTheDocument();
    const usdSubtotalLabel = screen.getByText("USD subtotal");
    const usdRow = usdSubtotalLabel.closest("div")!;
    expect(within(usdRow).getByText("US$20,000")).toBeInTheDocument();
  });

  it("renders USD asset row Book Cost and Market Value with US$ symbol", async () => {
    render(<DashboardPage />);
    const aaplRow = await findTickerRow("AAPL");
    expect(within(aaplRow).getByText("US$15,000")).toBeInTheDocument(); // bookCost
    expect(within(aaplRow).getByText("US$20,000")).toBeInTheDocument(); // marketValue
  });

  it("renders CAD asset row Book Cost and Market Value with bare $ symbol", async () => {
    render(<DashboardPage />);
    const vfvRow = await findTickerRow("VFV.TO");
    expect(within(vfvRow).getByText("$4,000")).toBeInTheDocument();
    expect(within(vfvRow).getByText("$5,000")).toBeInTheDocument();
  });

  it("falls back gracefully when FX is unavailable", async () => {
    (global.fetch as jest.Mock).mockImplementation((url: string) => {
      if (url.includes("/api/profile")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            assets: [cadAsset, usdAsset],
            portfolioTotals: { cadTotal: 5000, usdTotal: 20000, grandTotalCad: 5000, usdToCadRate: null, fxUnavailable: true },
            columnVisibility: {},
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<DashboardPage />);
    await findTickerRow("VFV.TO");
    expect(screen.getByText(/FX rate unavailable/)).toBeInTheDocument();
  });
});
