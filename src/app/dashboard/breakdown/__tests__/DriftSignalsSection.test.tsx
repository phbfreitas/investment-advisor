/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { DriftSignalsSection } from "../DriftSignalsSection";
import type { DriftSignal } from "../lib/types";

const sig = (over: Partial<DriftSignal>): DriftSignal => ({
  id: "x", severity: "warning", title: "warn", thresholdLabel: "th", contributors: [],
  ...over,
});

const THRESHOLDS_LIST = "Active thresholds";

describe("DriftSignalsSection", () => {
  it("shows the empty-state message when no signals fire", () => {
    render(<DriftSignalsSection signals={[]} />);
    expect(screen.getByText(/no concentration risks detected/i)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(THRESHOLDS_LIST, "i"))).toBeInTheDocument();
  });

  it("renders signals in given order with severity icons", () => {
    const signals: DriftSignal[] = [
      sig({ id: "1", severity: "red", title: "AAPL is 14%" }),
      sig({ id: "2", severity: "warning", title: "Banking 35%" }),
      sig({ id: "3", severity: "info", title: "TFSA 85%" }),
    ];
    render(<DriftSignalsSection signals={signals} />);
    expect(screen.getByText(/AAPL is 14%/)).toBeInTheDocument();
    expect(screen.getByText(/Banking 35%/)).toBeInTheDocument();
    expect(screen.getByText(/TFSA 85%/)).toBeInTheDocument();
  });

  it("expands and collapses contributors on tap", () => {
    const signals: DriftSignal[] = [
      sig({ id: "1", severity: "red", title: "AAPL is 14%", contributors: [
        { label: "AAPL", value: 1400, percent: 14 },
      ] }),
    ];
    render(<DriftSignalsSection signals={signals} />);
    const row = screen.getByRole("button", { name: /AAPL is 14%/i });
    expect(row).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("AAPL")).toBeInTheDocument();
    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-expanded", "false");
  });
});
