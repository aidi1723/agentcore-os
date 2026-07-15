import { describe, expect, it } from "vitest";
import {
  isAllowedOutboundUrl,
  resolveAllowedOutboundUrl,
} from "@/lib/server/network-policy";

describe("isAllowedOutboundUrl", () => {
  it("allows explicit loopback access without allowing the private network", () => {
    const loopbackUrl = "http://127.0.0.1:8787/webhook/publish";

    expect(isAllowedOutboundUrl(loopbackUrl)).toBe(false);
    expect(isAllowedOutboundUrl(loopbackUrl, { allowLoopback: true })).toBe(true);
    expect(
      isAllowedOutboundUrl("http://192.168.1.20/webhook/publish", { allowLoopback: true }),
    ).toBe(false);
  });
});

describe("resolveAllowedOutboundUrl", () => {
  it("accepts a hostname only after every DNS answer is public", async () => {
    const target = await resolveAllowedOutboundUrl(
      "https://hooks.example.test/publish",
      {
        lookup: async () => [
          { address: "203.0.113.10", family: 4 },
          { address: "2606:4700:4700::1111", family: 6 },
        ],
      },
    );

    expect(target).toMatchObject({
      hostname: "hooks.example.test",
      address: "203.0.113.10",
      family: 4,
    });
    expect(target.url.href).toBe("https://hooks.example.test/publish");
  });

  it("rejects private-only DNS answers", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => [{ address: "10.0.0.8", family: 4 }],
      }),
    ).rejects.toMatchObject({
      name: "OutboundUrlPolicyError",
      code: "blocked_url",
    });
  });

  it("rejects mixed public and private DNS answers", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => [
          { address: "203.0.113.10", family: 4 },
          { address: "192.168.1.20", family: 4 },
        ],
      }),
    ).rejects.toMatchObject({ code: "blocked_url" });
  });

  it("rejects IPv4-mapped IPv6 loopback answers", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => [{ address: "::ffff:127.0.0.1", family: 6 }],
      }),
    ).rejects.toMatchObject({ code: "blocked_url" });
  });

  it("allows loopback DNS answers only when explicitly enabled", async () => {
    const lookup = async () => [{ address: "127.0.0.1", family: 4 as const }];

    await expect(
      resolveAllowedOutboundUrl("http://localhost:8787/publish", { lookup }),
    ).rejects.toMatchObject({ code: "blocked_url" });

    await expect(
      resolveAllowedOutboundUrl("http://localhost:8787/publish", {
        lookup,
        allowLoopback: true,
      }),
    ).resolves.toMatchObject({
      hostname: "localhost",
      address: "127.0.0.1",
      family: 4,
    });
  });

  it("does not let loopback permission authorize an arbitrary hostname", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
        allowLoopback: true,
      }),
    ).rejects.toMatchObject({ code: "blocked_url" });
  });

  it("rejects empty DNS answers with a typed code", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => [],
      }),
    ).rejects.toMatchObject({ code: "dns_empty" });
  });

  it("maps resolver failures to a typed DNS error", async () => {
    await expect(
      resolveAllowedOutboundUrl("https://hooks.example.test/publish", {
        lookup: async () => {
          throw new Error("resolver unavailable");
        },
      }),
    ).rejects.toMatchObject({
      code: "dns_failed",
      cause: expect.any(Error),
    });
  });

  it("rejects invalid URLs before DNS resolution", async () => {
    await expect(
      resolveAllowedOutboundUrl("file:///etc/passwd", {
        lookup: async () => [{ address: "203.0.113.10", family: 4 }],
      }),
    ).rejects.toMatchObject({ code: "invalid_url" });
  });
});
