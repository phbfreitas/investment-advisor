/**
 * @jest-environment node
 */
import { PUT } from "../route";

jest.mock("next-auth", () => ({
  getServerSession: jest.fn().mockResolvedValue({ user: { householdId: "h1" } }),
}));
jest.mock("@/lib/auth", () => ({ authOptions: {} }));

// Jest 30 hoisting: prefix with `mock` and defer access in the factory.
const mockDbSend = jest.fn();
jest.mock("@/lib/db", () => ({
  db: { send: (...args: unknown[]) => mockDbSend(...args) },
  TABLE_NAME: "T",
}));

jest.mock("@/lib/auditLog", () => ({ insertAuditLog: jest.fn() }));
jest.mock("@/lib/assetSnapshot", () => ({ toSnapshot: (x: unknown) => x }));
jest.mock("@/lib/classification/allowlists", () => ({
  normalizeStrategyType: (x: unknown) => x,
  normalizeSecurityType: (x: unknown) => x,
  normalizeSector: (x: unknown) => x,
  normalizeMarket: (x: unknown) => x,
  normalizeCurrency: (x: unknown) => x,
  normalizeManagementStyle: (x: unknown) => x,
  normalizeCall: (x: unknown) => x,
  applyCompanyAutoDefaults: (x: Record<string, unknown>) => x,
}));

const sendMock = mockDbSend;

function buildPut(body: object, id = "abc") {
  return PUT(
    new Request(`http://test/api/assets/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    }),
    { params: Promise.resolve({ id }) }
  );
}

beforeEach(() => sendMock.mockReset());

describe("PUT /api/assets/[id] — optimistic concurrency", () => {
  it("returns 409 when expectedUpdatedAt does not match the current asset", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "newer-version" } });

    const res = await buildPut({ ticker: "AAPL", expectedUpdatedAt: "stale-version" });
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error).toMatch(/modified|refresh|stale/i);
    expect(sendMock).toHaveBeenCalledTimes(1); // PutCommand should NOT have been called
  });

  it("returns 200 when expectedUpdatedAt matches", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "v1" } });
    sendMock.mockResolvedValueOnce({}); // PutCommand

    const res = await buildPut({ ticker: "AAPL", expectedUpdatedAt: "v1" });
    expect(res.status).toBe(200);
  });

  it("returns 200 when expectedUpdatedAt is omitted (legacy / non-edit-mode callers)", async () => {
    sendMock.mockResolvedValueOnce({ Item: { id: "abc", ticker: "AAPL", updatedAt: "v1" } });
    sendMock.mockResolvedValueOnce({});

    const res = await buildPut({ ticker: "AAPL" });
    expect(res.status).toBe(200);
  });
});
