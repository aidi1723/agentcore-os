import { afterEach, describe, expect, it, vi } from "vitest";

import { runPublishDispatch } from "@/lib/server/publish-dispatch";

describe("publish dispatch", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("blocks private webhook URLs before dispatch", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const result = await runPublishDispatch({
      title: "Launch",
      body: "Ship the update",
      platforms: ["twitter"],
      dryRun: false,
      timeoutSeconds: 0,
      connections: {
        twitter: {
          token: "token",
          webhookUrl: "http://127.0.0.1:8080/internal",
        },
      },
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.results?.[0]).toMatchObject({
      platform: "twitter",
      ok: false,
      mode: "webhook",
      errorType: "blocked_url",
    });
  });
});
