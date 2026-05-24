import { describe, it, expect, vi, afterEach } from "vitest";

import { codeExecuteTool } from "@/lib/executor/tools/code-execute";

describe("code_execute tool", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("requires explicit code", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await codeExecuteTool.execute(
      { prompt: "write python that prints hello" },
      { sessionId: "s1", requestId: "r1" },
    );

    expect(result.success).toBe(false);
    expect(result.sideEffects?.[0]).toContain("Missing code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts explicit code to the runtime execution endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, output: { stdout: "1\n" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await codeExecuteTool.execute(
      { code: "print(1)", language: "python", timeout: 5 },
      { sessionId: "s1", requestId: "r1", baseUrl: "http://localhost:3000" },
    );

    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:3000/api/runtime/execute",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          code: "print(1)",
          language: "python",
          timeout: 5,
        }),
      }),
    );
  });
});
