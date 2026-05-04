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

  it("wires saveEdit's PUT path to optimistic-concurrency + in-app 409 banner", () => {
    // 1. PUT body still carries the optimistic-concurrency token.
    expect(source).toMatch(/expectedUpdatedAt:\s*editForm\.updatedAt/);

    // 2. Proximity assertion: the 409 branch must close the editor (or
    // refresh state) within ~400 chars of the status check. A future
    // refactor that deletes the 409 branch entirely would fail this test,
    // even though the file would still contain `setEditingId(null)`
    // elsewhere (success path, cancel handler).
    expect(source).toMatch(
      /res\.status\s*===\s*409[\s\S]{0,400}setEditingId\(null\)/
    );

    // 3. Proximity assertion: the 409 branch must surface a user-visible
    // banner via setMessage (mirrors handleUnlockField's pattern), not a
    // blocking native alert(). Mobile-first per Simone's PO usage.
    expect(source).toMatch(
      /res\.status\s*===\s*409[\s\S]{0,400}setMessage\(/
    );
  });
});
