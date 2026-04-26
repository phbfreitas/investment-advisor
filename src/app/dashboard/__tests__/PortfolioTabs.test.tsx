/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortfolioTabs } from "../PortfolioTabs";

const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(mockSearch.value),
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => "/dashboard",
}));

const mockSearch = { value: "" };

describe("PortfolioTabs", () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearch.value = "";
  });

  it("renders Holdings as default active tab when query param missing", () => {
    render(
      <PortfolioTabs>
        <div data-testid="holdings-pane">HOLDINGS</div>
        <div data-testid="breakdown-pane">BREAKDOWN</div>
      </PortfolioTabs>
    );
    const holdings = screen.getByRole("tab", { name: /holdings/i });
    expect(holdings).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("holdings-pane")).toBeVisible();
  });

  it("activates Breakdown tab when ?tab=breakdown", () => {
    mockSearch.value = "tab=breakdown";
    render(
      <PortfolioTabs>
        <div data-testid="holdings-pane">HOLDINGS</div>
        <div data-testid="breakdown-pane">BREAKDOWN</div>
      </PortfolioTabs>
    );
    const breakdown = screen.getByRole("tab", { name: /breakdown/i });
    expect(breakdown).toHaveAttribute("aria-selected", "true");
    expect(screen.getByTestId("breakdown-pane")).toBeVisible();
  });

  it("calls router.replace with new tab when user clicks", async () => {
    render(
      <PortfolioTabs>
        <div>HOLDINGS</div>
        <div>BREAKDOWN</div>
      </PortfolioTabs>
    );
    await userEvent.click(screen.getByRole("tab", { name: /breakdown/i }));
    expect(mockReplace).toHaveBeenCalledWith("/dashboard?tab=breakdown", { scroll: false });
  });
});
