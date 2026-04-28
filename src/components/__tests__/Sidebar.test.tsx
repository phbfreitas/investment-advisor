/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

jest.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
}));

jest.mock("next-auth/react", () => ({
  signOut: jest.fn(),
}));

import { Sidebar } from "../Sidebar";

describe("Sidebar collapse toggle", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders a toggle button labeled 'Collapse sidebar' in the expanded state", () => {
    render(<Sidebar />);
    const toggle = screen.getByRole("button", { name: /collapse sidebar/i });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("collapses the outer container when the toggle is clicked", async () => {
    const user = userEvent.setup();
    const { container } = render(<Sidebar />);

    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain("md:w-64");
    expect(outer.className).not.toContain("md:w-16");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const expandToggle = screen.getByRole("button", { name: /expand sidebar/i });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    expect(outer.className).toContain("md:w-16");
    expect(outer.className).not.toContain("md:w-64");
  });

  it("hides the header logo wrapper and every text label when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    expect(screen.getByText("InvestAI Panel")).toBeVisible();
    expect(screen.getByText("My Investment Portfolio")).toBeVisible();
    expect(screen.getByText("Sign Out")).toBeVisible();

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    // Using className inspection since jsdom doesn't load Tailwind CSS
    const headerLabel = screen.getByText("InvestAI Panel");
    const headerWrapper = headerLabel.parentElement!;
    expect(headerWrapper.className).toContain("md:hidden");

    const portfolioSpan = screen.getByText("My Investment Portfolio");
    expect(portfolioSpan.className).toContain("md:hidden");

    const signoutSpan = screen.getByText("Sign Out");
    expect(signoutSpan.className).toContain("md:hidden");
  });

  it("centers icons and zeros their right margin when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    const portfolioLink = screen.getByRole("link", { name: /my investment portfolio/i });
    expect(portfolioLink.className).toContain("md:justify-center");
    expect(portfolioLink.className).not.toContain("md:justify-start");

    const portfolioIcon = portfolioLink.querySelector("svg");
    expect(portfolioIcon).not.toBeNull();
    expect(portfolioIcon!.getAttribute("class")).toContain("md:mr-0");
    expect(portfolioIcon!.getAttribute("class")).not.toContain("md:mr-3");
  });
});
