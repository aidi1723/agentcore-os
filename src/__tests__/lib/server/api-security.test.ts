import { afterEach, describe, expect, it } from "vitest";
import {
  isAuthorizedLocalApiRequest,
  isLocalRequest,
  rejectUnauthorizedLocalApiRequest,
} from "@/lib/server/api-security";

const originalToken = process.env.AGENTCORE_API_AUTH_TOKEN;

afterEach(() => {
  if (originalToken === undefined) {
    delete process.env.AGENTCORE_API_AUTH_TOKEN;
  } else {
    process.env.AGENTCORE_API_AUTH_TOKEN = originalToken;
  }
});

describe("isLocalRequest", () => {
  it("accepts loopback and tauri hosts", () => {
    expect(isLocalRequest(new Request("http://127.0.0.1/api/health"))).toBe(true);
    expect(isLocalRequest(new Request("http://localhost/api/health"))).toBe(true);
    expect(isLocalRequest(new Request("http://tauri.localhost/api/health"))).toBe(true);
  });

  it("rejects a non-local URL even when the Host header says localhost", () => {
    const request = new Request("http://10.1.2.3/api/health", {
      headers: { host: "localhost:3000" },
    });
    expect(isLocalRequest(request)).toBe(false);
  });

  it("rejects a local URL when the Host header is a LAN address", () => {
    const request = new Request("http://127.0.0.1/api/health", {
      headers: { host: "192.168.1.20:3000" },
    });
    expect(isLocalRequest(request)).toBe(false);
  });
});

describe("rejectUnauthorizedLocalApiRequest", () => {
  it("allows a local request when no token is configured", () => {
    delete process.env.AGENTCORE_API_AUTH_TOKEN;
    expect(rejectUnauthorizedLocalApiRequest(new Request("http://127.0.0.1/api/health"))).toBeNull();
  });

  it("requires the configured token on local requests", () => {
    process.env.AGENTCORE_API_AUTH_TOKEN = "desk-token";
    const denied = rejectUnauthorizedLocalApiRequest(new Request("http://127.0.0.1/api/health"));
    expect(denied?.status).toBe(403);

    const allowed = isAuthorizedLocalApiRequest(
      new Request("http://127.0.0.1/api/health", {
        headers: { authorization: "Bearer desk-token" },
      }),
    );
    expect(allowed).toBe(true);
  });
});
