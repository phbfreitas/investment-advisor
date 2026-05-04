/**
 * @jest-environment node
 *
 * 5A Task 4 — static-source audit.
 *
 * The runtime-rendered DashboardClient is huge and side-effect heavy, so this
 * test asserts the source contains the optimistic-concurrency wiring instead
 * of mounting the component. It catches regressions where someone removes
 * `expectedUpdatedAt` from the PUT body or drops the 409 refresh handler.
 */
import * as fs from "fs";
import * as path from "path";

describe("DashboardClient — PUT 409 handling (5A Task 4 audit)", () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, "../DashboardClient.tsx"),
    "utf-8"
  );

  it("includes expectedUpdatedAt in the PUT body of saveEdit", () => {
    expect(source).toMatch(/expectedUpdatedAt:\s*editForm\.updatedAt/);
  });

  it("checks for status === 409 to detect stale-edit conflict", () => {
    expect(source).toMatch(/res\.status\s*===\s*409/);
  });

  it("closes the editor on 409 (setEditingId(null))", () => {
    expect(source).toMatch(/setEditingId\(null\)/);
  });
});
