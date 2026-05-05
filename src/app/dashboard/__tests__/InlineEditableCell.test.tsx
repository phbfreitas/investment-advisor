/**
 * @jest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { InlineEditableCell } from "../InlineEditableCell";

describe("InlineEditableCell", () => {
  it("renders display value initially", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("clicks display to enter edit mode and shows the input", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    expect(screen.getByDisplayValue("hello")).toBeInTheDocument();
  });

  it("calls onSave with the new value when Save is clicked", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("world");
  });

  it("returns to display mode after a successful save", async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    // After resolution, display mode shows the new value.
    expect(await screen.findByText("world")).toBeInTheDocument();
  });

  it("does NOT call onSave when Cancel is clicked", () => {
    const onSave = jest.fn();
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Cancel"));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Esc key cancels edit mode", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.keyDown(screen.getByDisplayValue("hello"), { key: "Escape" });
    expect(screen.queryByDisplayValue("hello")).not.toBeInTheDocument();
    expect(screen.getByText("hello")).toBeInTheDocument();
  });

  it("Enter key saves in text mode", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.keyDown(screen.getByDisplayValue("world"), { key: "Enter" });
    expect(onSave).toHaveBeenCalledWith("world");
  });

  it("number kind parses input to number on save", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="number" value={100} onSave={onSave} ariaLabel="edit-qty" />);
    fireEvent.click(screen.getByText("100"));
    fireEvent.change(screen.getByDisplayValue("100"), { target: { value: "150" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith(150);
  });

  it("select kind renders an option list and saves the selected value", () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(<InlineEditableCell kind="select" value="A" options={["A", "B", "C"]} onSave={onSave} ariaLabel="edit-class" />);
    fireEvent.click(screen.getByText("A"));
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "B" } });
    fireEvent.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledWith("B");
  });

  it("disabled cell does not enter edit mode on click", () => {
    render(<InlineEditableCell kind="text" value="hello" onSave={jest.fn()} disabled ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    expect(screen.queryByDisplayValue("hello")).not.toBeInTheDocument();
  });

  it("stays in edit mode if onSave rejects", async () => {
    const onSave = jest.fn().mockRejectedValue(new Error("nope"));
    render(<InlineEditableCell kind="text" value="hello" onSave={onSave} ariaLabel="edit-label" />);
    fireEvent.click(screen.getByText("hello"));
    fireEvent.change(screen.getByDisplayValue("hello"), { target: { value: "world" } });
    fireEvent.click(screen.getByText("Save"));
    // Wait one tick for the rejection to settle.
    await new Promise(r => setTimeout(r, 0));
    expect(screen.getByDisplayValue("world")).toBeInTheDocument();
  });
});
