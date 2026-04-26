/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { BreakdownTab } from "../BreakdownTab";
import type { Asset } from "@/types";

const a = (overrides: Partial<Asset>): Asset => ({
  PK: "", SK: "", id: "", profileId: "", type: "ASSET",
  account: "Brokerage", ticker: "AAA", securityType: "Company", strategyType: "",
  call: "Mix", sector: "Mixed", market: "USA", currency: "USD",
  managementStyle: "", externalRating: "", managementFee: 0,
  quantity: 0, liveTickerPrice: 0, bookCost: 0, marketValue: 100,
  profitLoss: 0, yield: 0, oneYearReturn: 0, fiveYearReturn: 0,
  threeYearReturn: 0, exDividendDate: "", analystConsensus: "",
  beta: 0, riskFlag: "", accountNumber: "", accountType: "",
  risk: "", volatility: 0, expectedAnnualDividends: 0, updatedAt: "",
  ...overrides,
});

describe("BreakdownTab", () => {
  it("renders a loading skeleton when isLoading", () => {
    render(<BreakdownTab assets={[]} isLoading={true} onSwitchToHoldings={() => {}} />);
    expect(screen.getByTestId("breakdown-loading")).toBeInTheDocument();
  });

  it("renders the empty state with a switch-to-holdings button when no assets", () => {
    const onSwitch = jest.fn();
    render(<BreakdownTab assets={[]} isLoading={false} onSwitchToHoldings={onSwitch} />);
    expect(screen.getByText(/portfolio is empty/i)).toBeInTheDocument();
    screen.getByRole("button", { name: /import|holdings/i }).click();
    expect(onSwitch).toHaveBeenCalled();
  });

  it("renders all three sections when healthy", () => {
    render(<BreakdownTab assets={[a({})]} isLoading={false} onSwitchToHoldings={() => {}} />);
    expect(screen.getByText(/1 · Composition/i)).toBeInTheDocument();
    expect(screen.getByText(/2 · Concentration/i)).toBeInTheDocument();
    expect(screen.getByText(/3 · Drift Signals/i)).toBeInTheDocument();
  });
});
