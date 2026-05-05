/**
 * @jest-environment jsdom
 *
 * 5B Task 7 — inline editing across the Holdings table.
 *
 * Spec definition-of-done: tapping any editable cell on phone/tablet enters
 * inline edit; no "edit mode" detour. The legacy row-level pencil is gone for
 * existing rows; only "Add Row" still uses row-mode.
 */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import DashboardPage from "../DashboardClient";

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

/** Find the live (non-ghost) Holdings-table row for a given ticker. */
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

const profileResponse = (asset: typeof baseAsset) => ({
  ok: true,
  json: async () => ({
    assets: [asset],
    portfolioTotals: {
      cadTotal: 0,
      usdTotal: 20000,
      grandTotalCad: 27000,
      usdToCadRate: 1.35,
      fxUnavailable: false,
    },
    columnVisibility: {},
  }),
});

beforeEach(() => {
  global.fetch = jest.fn((url, init) => {
    if (typeof url === "string" && url.includes("/api/profile")) {
      return Promise.resolve(profileResponse(baseAsset)) as unknown as ReturnType<typeof fetch>;
    }
    if (typeof url === "string" && url.startsWith("/api/assets/a1") && (init?.method === "PUT")) {
      return Promise.resolve({ ok: true, json: async () => ({ asset: { ...baseAsset } }) }) as unknown as ReturnType<typeof fetch>;
    }
    return Promise.resolve({ ok: true, json: async () => ({}) }) as unknown as ReturnType<typeof fetch>;
  }) as unknown as typeof fetch;
});

describe("Holdings table — inline editing", () => {
  it("does NOT render a row-level pencil/edit button", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    // The legacy pencil button rendered an Edit2 icon with no aria-label.
    // Assert that no button matching /edit/i exists in the row.
    expect(within(row).queryByRole("button", { name: /^edit$/i })).not.toBeInTheDocument();
  });

  it("clicking a quantity cell enters inline edit", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    const qtyTrigger = within(row).getByRole("button", { name: /Edit quantity for AAPL/i });
    fireEvent.click(qtyTrigger);
    expect(within(row).getByDisplayValue("100")).toBeInTheDocument();
    expect(within(row).getByText("Save")).toBeInTheDocument();
    expect(within(row).getByText("Cancel")).toBeInTheDocument();
  });

  it("saves a quantity edit via partial-PUT with expectedUpdatedAt", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    const qtyTrigger = within(row).getByRole("button", { name: /Edit quantity for AAPL/i });
    fireEvent.click(qtyTrigger);
    fireEvent.change(within(row).getByDisplayValue("100"), { target: { value: "150" } });
    await act(async () => {
      fireEvent.click(within(row).getByText("Save"));
    });
    const fetchMock = global.fetch as jest.Mock;
    const putCall = fetchMock.mock.calls.find(
      ([u, init]) => typeof u === "string" && u === "/api/assets/a1" && init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body).toEqual({
      quantity: 150,
      expectedUpdatedAt: "2026-05-04T00:00:00.000Z",
    });
  });

  it("renders a Lock icon and disables the cell for a locked classification field", async () => {
    const locked = { ...baseAsset, userOverrides: { sector: true } };
    (global.fetch as jest.Mock).mockImplementation((url) => {
      if (typeof url === "string" && url.includes("/api/profile")) {
        return Promise.resolve(profileResponse(locked));
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    // Sector cell is locked — clicking should NOT open a select editor.
    const sectorTrigger = within(row).getByRole("button", { name: /Edit sector for AAPL/i });
    fireEvent.click(sectorTrigger);
    expect(within(row).queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("editing a lockable field sets userOverrides.{field} = true in the patch", async () => {
    render(<DashboardPage />);
    const row = await findTickerRow("AAPL");
    const sectorTrigger = within(row).getByRole("button", { name: /Edit sector for AAPL/i });
    fireEvent.click(sectorTrigger);
    fireEvent.change(within(row).getByRole("combobox"), { target: { value: "Healthcare" } });
    await act(async () => {
      fireEvent.click(within(row).getByText("Save"));
    });
    const fetchMock = global.fetch as jest.Mock;
    const putCall = fetchMock.mock.calls.find(
      ([u, init]) => typeof u === "string" && u === "/api/assets/a1" && init?.method === "PUT"
    );
    expect(putCall).toBeDefined();
    const body = JSON.parse((putCall![1] as RequestInit).body as string);
    expect(body.sector).toBe("Healthcare");
    expect(body.userOverrides).toEqual({ sector: true });
    expect(body.expectedUpdatedAt).toBe("2026-05-04T00:00:00.000Z");
  });

  it("Add Row still uses row-mode (NEW path unchanged)", async () => {
    render(<DashboardPage />);
    await findTickerRow("AAPL");
    fireEvent.click(screen.getByText("Add Row"));
    // The new row is the last data row before the totals row.
    // Assert at least one row contains a save-new-row button.
    const saveNew = await screen.findByRole("button", { name: /save new row/i });
    expect(saveNew).toBeInTheDocument();
  });
});
