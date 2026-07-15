import { describe, expect, it, vi } from "vitest";

import { runPublishDispatch } from "@/lib/server/publish-dispatch";
import {
  PublishWebhookTransportError,
  type PublishWebhookResponse,
} from "@/lib/server/publish-webhook-transport";

function dispatchParams() {
  return {
    title: "Launch",
    body: "Ship the update",
    platforms: ["twitter" as const],
    dryRun: false,
    timeoutSeconds: 0,
    connections: {
      twitter: {
        token: "token",
        webhookUrl: "https://hooks.example.test/publish",
      },
    },
  };
}

describe("publish dispatch", () => {
  it("blocks literal private webhook URLs before dispatch", async () => {
    const postWebhook = vi.fn();

    const result = await runPublishDispatch({
      ...dispatchParams(),
      connections: {
        twitter: {
          token: "token",
          webhookUrl: "http://192.168.1.20:8080/internal",
        },
      },
      postWebhook,
    });

    expect(postWebhook).not.toHaveBeenCalled();
    expect(result.ok).toBe(false);
    expect(result.results?.[0]).toMatchObject({
      platform: "twitter",
      ok: false,
      mode: "webhook",
      errorType: "blocked_url",
      retryable: false,
    });
  });

  it("preserves structured connector receipts from the pinned transport", async () => {
    const postWebhook = vi.fn(async (): Promise<PublishWebhookResponse> => ({
      ok: true,
      status: 202,
      responseText: JSON.stringify({
        ok: true,
        id: "receipt-123",
        externalId: "provider-job-1",
        queued: true,
        retryable: true,
        message: "Queued by connector",
      }),
    }));

    const result = await runPublishDispatch({ ...dispatchParams(), postWebhook });

    expect(postWebhook).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://hooks.example.test/publish",
        timeoutMs: 10_000,
        allowLoopback: true,
      }),
    );
    expect(result.results?.[0]).toMatchObject({
      ok: true,
      status: 202,
      queued: true,
      retryable: true,
      receiptId: "receipt-123",
      externalId: "provider-job-1",
      message: "Queued by connector",
    });
  });

  it("records redirect responses as failed receipts without a second request", async () => {
    const postWebhook = vi.fn(async (): Promise<PublishWebhookResponse> => ({
      ok: false,
      status: 302,
      responseText: "redirect blocked",
    }));

    const result = await runPublishDispatch({ ...dispatchParams(), postWebhook });

    expect(postWebhook).toHaveBeenCalledTimes(1);
    expect(result.results?.[0]).toMatchObject({
      ok: false,
      status: 302,
      responseText: "redirect blocked",
      retryable: false,
      errorType: "redirect",
    });
  });

  it.each([
    {
      transportError: new PublishWebhookTransportError("blocked_url", false),
      errorType: "blocked_url",
      retryable: false,
    },
    {
      transportError: new PublishWebhookTransportError("dns_failed", true),
      errorType: "temporary",
      retryable: true,
    },
    {
      transportError: new PublishWebhookTransportError("timeout", true),
      errorType: "temporary",
      retryable: true,
    },
    {
      transportError: new PublishWebhookTransportError("connection_failed", true),
      errorType: "temporary",
      retryable: true,
    },
    {
      transportError: new PublishWebhookTransportError("response_too_large", false),
      errorType: "response_too_large",
      retryable: false,
    },
  ])("maps $transportError.code transport failures", async (expected) => {
    const postWebhook = vi.fn(async () => {
      throw expected.transportError;
    });

    const result = await runPublishDispatch({ ...dispatchParams(), postWebhook });

    expect(result.results?.[0]).toMatchObject({
      ok: false,
      mode: "webhook",
      errorType: expected.errorType,
      retryable: expected.retryable,
    });
  });

  it("does not call webhook transport for dry runs or manual actions", async () => {
    const postWebhook = vi.fn();

    const dryRun = await runPublishDispatch({
      ...dispatchParams(),
      dryRun: true,
      postWebhook,
    });
    const manual = await runPublishDispatch({
      ...dispatchParams(),
      connections: { twitter: { token: "", webhookUrl: "" } },
      postWebhook,
    });

    expect(postWebhook).not.toHaveBeenCalled();
    expect(dryRun.mode).toBe("dry-run");
    expect(manual.results?.[0]).toMatchObject({ mode: "manual", ok: true });
  });
});
