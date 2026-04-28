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

  it("stacks the pillar toggle vertically when collapsed", async () => {
    const user = userEvent.setup();
    render(<Sidebar />);

    // Get the desktop pillar button (the one with flex-1 class, inside the desktop toggle)
    const blueprintButtons = screen.getAllByRole("button", { name: /my blueprint/i });
    const blueprintButton = blueprintButtons.find(btn => btn.className.includes("flex-1"))!;
    const pillarContainer = blueprintButton.parentElement!;

    expect(pillarContainer.className).not.toContain("flex-col");

    await user.click(screen.getByRole("button", { name: /collapse sidebar/i }));

    expect(pillarContainer.className).toContain("flex-col");
  });

  it("sets a title attribute on every interactive sidebar element", () => {
    render(<Sidebar />);

    // Check all nav links have title attributes
    const portfolioLink = screen.getByRole("link", { name: /my investment portfolio/i });
    expect(portfolioLink).toHaveAttribute("title", "My Investment Portfolio");

    // Check utilities links have title attributes (getAllByRole since they appear twice)
    const userGuideLinks = screen.getAllByRole("link", { name: /user guide/i });
    userGuideLinks.forEach(link => {
      expect(link).toHaveAttribute("title", "User Guide");
    });

    // Check sign out button has title
    expect(
        screen.getByRole("button", { name: /sign out/i })
    ).toHaveAttribute("title", "Sign Out");

    // Check pillar buttons have title (getAllByRole since they appear twice: desktop + mobile)
    const blueprintButtons = screen.getAllByRole("button", { name: /my blueprint/i });
    blueprintButtons.forEach(button => {
      expect(button).toHaveAttribute("title", "My Blueprint");
    });

    const marketIntelligenceButtons = screen.getAllByRole("button", { name: /market intelligence/i });
    marketIntelligenceButtons.forEach(button => {
      expect(button).toHaveAttribute("title", "Market Intelligence");
    });
  });
});
