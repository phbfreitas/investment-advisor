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
});
