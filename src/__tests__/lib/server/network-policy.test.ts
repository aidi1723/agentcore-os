import { describe, expect, it } from "vitest";
import { isAllowedOutboundUrl } from "@/lib/server/network-policy";

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
