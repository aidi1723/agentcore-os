import { afterEach, describe, it, expect, vi } from "vitest";
import { createStateRouteHandlers, createDeleteHandler } from "@/lib/server/state-route-factory";

function makeRequest(options: {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) {
  const headers = new Headers(options.headers ?? {});
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  return new Request(options.url ?? "http://localhost:3000/api/test", {
    method: options.method ?? "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
}

describe("state-route-factory", () => {
  const previousToken = process.env.AGENTCORE_API_AUTH_TOKEN;

  afterEach(() => {
    if (previousToken === undefined) {
      delete process.env.AGENTCORE_API_AUTH_TOKEN;
    } else {
      process.env.AGENTCORE_API_AUTH_TOKEN = previousToken;
    }
  });

  describe("createStateRouteHandlers", () => {
    const mockConfig = {
      resourceName: "item",
      pluralName: "items",
      listSnapshot: vi.fn().mockResolvedValue({ items: [{ id: "1" }], tombstones: [] }),
      writeAll: vi.fn().mockResolvedValue([{ id: "1" }]),
      upsertOne: vi.fn().mockResolvedValue({ item: { id: "1" }, accepted: true }),
    };

    it("GET returns snapshot", async () => {
      const { GET } = createStateRouteHandlers(mockConfig);
      const res = await GET(makeRequest());
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.items).toHaveLength(1);
    });

    it("rejects remote requests when API token protection is enabled", async () => {
      process.env.AGENTCORE_API_AUTH_TOKEN = "secret";
      const { GET, POST } = createStateRouteHandlers(mockConfig);

      const getRes = await GET(makeRequest({ url: "http://evil.example/api/test" }));
      const postRes = await POST(
        makeRequest({
          method: "POST",
          url: "http://evil.example/api/test",
          body: { item: { id: "1" } },
        }),
      );

      expect(getRes.status).toBe(403);
      expect(postRes.status).toBe(403);
    });

    it("PUT rejects without full-replace header", async () => {
      const { PUT } = createStateRouteHandlers(mockConfig);
      const req = makeRequest({ method: "PUT", body: { items: [] } });
      const res = await PUT(req);
      expect(res.status).toBe(409);
    });

    it("PUT accepts with full-replace header", async () => {
      const { PUT } = createStateRouteHandlers(mockConfig);
      const req = makeRequest({
        method: "PUT",
        headers: { "x-agentcore-allow-full-replace": "1", "content-type": "application/json" },
        body: { items: [{ id: "2" }] },
      });
      const res = await PUT(req);
      const json = await res.json();
      expect(json.ok).toBe(true);
    });

    it("POST upserts an item", async () => {
      const { POST } = createStateRouteHandlers(mockConfig);
      const req = makeRequest({ method: "POST", body: { item: { id: "1" } } });
      const res = await POST(req);
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(json.data.accepted).toBe(true);
    });

    it("POST returns 400 for invalid payload", async () => {
      const invalidConfig = {
        ...mockConfig,
        upsertOne: vi.fn().mockResolvedValue({ item: null, accepted: false }),
      };
      const { POST } = createStateRouteHandlers(invalidConfig);
      const req = makeRequest({ method: "POST", body: { item: null } });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("createDeleteHandler", () => {
    it("deletes an item by param", async () => {
      const removeOne = vi.fn().mockResolvedValue({ removed: true, conflict: false });
      const DELETE = createDeleteHandler({
        resourceName: "item",
        paramName: "itemId",
        removeOne,
      });
      const req = makeRequest({ method: "DELETE", body: { updatedAt: 123 } });
      const res = await DELETE(req, { params: Promise.resolve({ itemId: "abc" }) });
      const json = await res.json();
      expect(json.ok).toBe(true);
      expect(removeOne).toHaveBeenCalledWith("abc", 123);
    });

    it("returns 409 on conflict", async () => {
      const removeOne = vi.fn().mockResolvedValue({ removed: false, conflict: true });
      const DELETE = createDeleteHandler({
        resourceName: "item",
        paramName: "itemId",
        removeOne,
      });
      const req = makeRequest({ method: "DELETE", body: { updatedAt: 100 } });
      const res = await DELETE(req, { params: Promise.resolve({ itemId: "abc" }) });
      expect(res.status).toBe(409);
    });

    it("rejects remote deletes when API token protection is enabled", async () => {
      process.env.AGENTCORE_API_AUTH_TOKEN = "secret";
      const removeOne = vi.fn().mockResolvedValue({ removed: true, conflict: false });
      const DELETE = createDeleteHandler({
        resourceName: "item",
        paramName: "itemId",
        removeOne,
      });
      const req = makeRequest({
        method: "DELETE",
        url: "http://evil.example/api/test/abc",
        body: { updatedAt: 123 },
      });

      const res = await DELETE(req, { params: Promise.resolve({ itemId: "abc" }) });

      expect(res.status).toBe(403);
      expect(removeOne).not.toHaveBeenCalled();
    });
  });
});
