import { paletteFor } from "../colors";

describe("paletteFor", () => {
  it("returns the same color for the same input", () => {
    expect(paletteFor("USA")).toBe(paletteFor("USA"));
  });

  it("returns different colors for different inputs (low collision)", () => {
    const a = paletteFor("USA");
    const b = paletteFor("Canada");
    expect(a).not.toBe(b);
  });

  it("treats null/undefined/empty as Uncategorized gray", () => {
    expect(paletteFor("")).toBe(paletteFor(undefined));
    expect(paletteFor(null as unknown as string)).toBe(paletteFor(undefined));
  });

  it("returns a hex string", () => {
    expect(paletteFor("USA")).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
