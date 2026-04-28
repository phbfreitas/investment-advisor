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
});
