/**
 * @jest-environment node
 */
import { PATCH } from "../lock/route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { householdId: "h1" } }),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));
// Both `db` (encrypted wrapper, used for Gets) and `rawDb_unclassifiedOnly`
// (used for the UpdateCommand after Task 1) share the same underlying mock —
// the route uses one for reads and the other for the lock write.
// Note: the variable is `mock`-prefixed so Jest's `jest.mock` factory hoisting allows the closure.
const mockRawSend = jest.fn();
jest.mock("@/lib/db", () => ({
  db: { send: (...args: unknown[]) => mockRawSend(...args) },
  rawDb_unclassifiedOnly: { send: (...args: unknown[]) => mockRawSend(...args) },
  TABLE_NAME: "T",
}));
jest.mock("@/lib/auditLog", () => ({ insertAuditLog: jest.fn() }));
jest.mock("@/lib/assetSnapshot", () => ({ toSnapshot: (x: unknown) => x }));

import { insertAuditLog } from "@/lib/auditLog";

const sendMock = mockRawSend;
const auditMock = insertAuditLog as unknown as jest.Mock;

function buildRequest(body: object) {
  return new Request("http://test/api/assets/abc/lock", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

beforeEach(() => {
  sendMock.mockReset();
  auditMock.mockReset();
});

describe("PATCH /api/assets/[id]/lock — decouple audit from commit", () => {
  it("returns 200 even if the post-commit refetch fails", async () => {
    // (1) Get existing asset → ok (db.send)
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    // (2) UpdateCommand → ok (rawDb_unclassifiedOnly.send — same underlying mock)
    sendMock.mockResolvedValueOnce({});
    // (3) Refetch GetCommand → fails
    sendMock.mockRejectedValueOnce(new Error("DDB outage"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toMatch(/Lock state updated/);
  });

  it("returns 200 even if the audit-log write fails", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    sendMock.mockResolvedValueOnce({});
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "new" } });
    auditMock.mockRejectedValueOnce(new Error("audit table throttled"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(200);
  });

  it("still returns 5xx if the UpdateCommand itself throws (non-conditional)", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL" } });
    sendMock.mockRejectedValueOnce(new Error("DDB write rejected"));

    const res = await PATCH(buildRequest({ field: "sector", locked: true }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(500);
  });

  it("still returns 409 on ConditionalCheckFailedException", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "old" } });
    const condErr = Object.assign(new Error("conditional"), { name: "ConditionalCheckFailedException" });
    sendMock.mockRejectedValueOnce(condErr);

    const res = await PATCH(buildRequest({ field: "sector", locked: true, expectedUpdatedAt: "stale" }), { params: Promise.resolve({ id: "abc" }) });
    expect(res.status).toBe(409);
  });
});
