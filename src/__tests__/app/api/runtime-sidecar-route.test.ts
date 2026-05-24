import { afterEach, describe, expect, it } from "vitest";

import { GET, POST } from "@/app/api/runtime/sidecar/route";

function request(url: string, body?: unknown) {
  return new Request(url, {
    method: body ? "POST" : "GET",
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe("/api/runtime/sidecar", () => {
  const previousToken = process.env.AGENTCORE_API_AUTH_TOKEN;

  afterEach(() => {
    if (previousToken === undefined) {
      delete process.env.AGENTCORE_API_AUTH_TOKEN;
    } else {
      process.env.AGENTCORE_API_AUTH_TOKEN = previousToken;
    }
  });

  it("rejects remote status reads when API token protection is enabled", async () => {
    process.env.AGENTCORE_API_AUTH_TOKEN = "secret";

    const res = await GET(request("http://evil.example/api/runtime/sidecar"));

    expect(res.status).toBe(403);
  });

  it("rejects remote control actions when API token protection is enabled", async () => {
    process.env.AGENTCORE_API_AUTH_TOKEN = "secret";

    const res = await POST(
      request("http://evil.example/api/runtime/sidecar", { action: "sync" }),
    );

    expect(res.status).toBe(403);
  });
});
