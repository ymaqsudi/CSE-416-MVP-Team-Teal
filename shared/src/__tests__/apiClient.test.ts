import { describe, it, expect, beforeEach, vi } from "vitest";
import { ApiClient } from "../apiClient";

function mockFetchOnce(opts: {
  ok: boolean;
  status: number;
  body: any;
  statusText?: string;
}) {
  global.fetch = vi.fn(async () => {
    return {
      ok: opts.ok,
      status: opts.status,
      statusText: opts.statusText ?? "",
      text: async () => JSON.stringify(opts.body),
    } as any;
  }) as any;
}

describe("ApiClient", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("builds query params for getPlayers()", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { players: [] },
    });

    const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "k" });
    await client.getPlayers({ q: "judge", position: "OF", limit: 10 });

    const calledUrl = (global.fetch as any).mock.calls[0][0] as string;
    expect(calledUrl).toContain("https://example.com/players?");
    expect(calledUrl).toContain("q=judge");
    expect(calledUrl).toContain("position=OF");
    expect(calledUrl).toContain("limit=10");
  });

  it("injects x-api-key header when apiKey is set", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { players: [] },
    });

    const client = new ApiClient({ baseUrl: "https://example.com", apiKey: "secret" });
    await client.getPlayers();

    const fetchOpts = (global.fetch as any).mock.calls[0][1];
    expect(fetchOpts.headers["x-api-key"]).toBe("secret");
  });

  it("throws ApiError with status/message on 401", async () => {
    mockFetchOnce({
      ok: false,
      status: 401,
      body: { message: "Unauthorized: missing or invalid x-api-key header" },
      statusText: "Unauthorized",
    });

    const client = new ApiClient({ baseUrl: "https://example.com" });

    await expect(client.getPlayers()).rejects.toMatchObject({
      status: 401,
      message: expect.stringContaining("Unauthorized"),
    });
  });

  it("parses getPlayer() response shape", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { player: { id: "1", name: "Test", positions: ["OF"] } },
    });

    const client = new ApiClient({ baseUrl: "https://example.com" });
    const res = await client.getPlayer("1");

    expect(res.player.id).toBe("1");
    expect(res.player.name).toBe("Test");
    expect(res.player.positions).toContain("OF");
  });

  it("parses getValuation() response shape", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      body: { valuation: { playerId: "1", dollarValue: 42, updatedAt: new Date().toISOString() } },
    });

    const client = new ApiClient({ baseUrl: "https://example.com" });
    const res = await client.getValuation("1");

    expect(res.valuation.playerId).toBe("1");
    expect(res.valuation.dollarValue).toBe(42);
    expect(typeof res.valuation.updatedAt).toBe("string");
  });
});

