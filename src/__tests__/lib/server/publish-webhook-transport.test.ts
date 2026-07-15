import type { LookupFunction } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { OutboundUrlPolicyError } from "@/lib/server/network-policy";
import {
  PublishWebhookTransportError,
  postPublishWebhook,
  type PublishWebhookIncomingResponse,
  type PublishWebhookRequest,
  type PublishWebhookRequestFactory,
} from "@/lib/server/publish-webhook-transport";

type ResponseScenario = {
  status?: number;
  chunks?: string[];
  responseError?: Error;
  requestError?: Error;
  timeout?: boolean;
};

function requestHarness(scenario: ResponseScenario = {}) {
  let capturedUrl: URL | undefined;
  let capturedOptions: Parameters<PublishWebhookRequestFactory>[1] | undefined;
  let writtenBody = "";
  const responseDestroy = vi.fn();
  const requestDestroy = vi.fn();

  const requestFactory: PublishWebhookRequestFactory = (url, options, onResponse) => {
    capturedUrl = url;
    capturedOptions = options;
    const responseListeners = new Map<string, (...args: never[]) => void>();
    const requestListeners = new Map<string, (...args: never[]) => void>();
    let timeoutListener: (() => void) | undefined;

    const response: PublishWebhookIncomingResponse = {
      statusCode: scenario.status ?? 200,
      setEncoding: () => response,
      on: (event: string, listener: (...args: never[]) => void) => {
        responseListeners.set(event, listener);
        return response;
      },
      destroy: responseDestroy,
    };

    const request: PublishWebhookRequest = {
      on: (event: string, listener: (...args: never[]) => void) => {
        requestListeners.set(event, listener);
        return request;
      },
      setTimeout: (_timeoutMs, listener) => {
        timeoutListener = listener;
        return request;
      },
      write: (chunk) => {
        writtenBody += chunk;
        return true;
      },
      end: () => {
        if (scenario.timeout) {
          queueMicrotask(() => timeoutListener?.());
          return request;
        }
        if (scenario.requestError) {
          queueMicrotask(() => requestListeners.get("error")?.(scenario.requestError as never));
          return request;
        }
        queueMicrotask(() => {
          onResponse(response);
          if (scenario.responseError) {
            responseListeners.get("error")?.(scenario.responseError as never);
            return;
          }
          for (const chunk of scenario.chunks ?? ["{}"] ) {
            responseListeners.get("data")?.(chunk as never);
          }
          responseListeners.get("end")?.();
        });
        return request;
      },
      destroy: requestDestroy,
    };

    return request;
  };

  return {
    requestFactory,
    requestDestroy,
    responseDestroy,
    getCapturedUrl: () => capturedUrl,
    getCapturedOptions: () => capturedOptions,
    getWrittenBody: () => writtenBody,
  };
}

const resolveTarget = vi.fn(async (url: string) => ({
  url: new URL(url),
  hostname: "hooks.example.test",
  address: "203.0.113.10",
  family: 4 as const,
}));

describe("postPublishWebhook", () => {
  beforeEach(() => {
    resolveTarget.mockClear();
  });

  it("pins socket lookup while preserving the original Host and TLS server name", async () => {
    const harness = requestHarness({ status: 202, chunks: ['{"ok":true}'] });

    const result = await postPublishWebhook({
      url: "https://hooks.example.test/publish",
      body: '{"event":"publish"}',
      timeoutMs: 10_000,
      resolveTarget,
      requestFactory: harness.requestFactory,
    });

    const options = harness.getCapturedOptions();
    expect(options).toBeDefined();
    if (!options?.lookup) throw new Error("Expected pinned lookup");
    const lookupResult = await new Promise<{ address: string; family: number }>((resolve, reject) => {
      (options.lookup as LookupFunction)(
        "hooks.example.test",
        {},
        (error, address, family) =>
          error ? reject(error) : resolve({ address: String(address), family: Number(family) }),
      );
    });

    expect(lookupResult).toEqual({ address: "203.0.113.10", family: 4 });
    expect(harness.getCapturedUrl()?.hostname).toBe("hooks.example.test");
    expect(options.headers).toMatchObject({ Host: "hooks.example.test" });
    expect(options.servername).toBe("hooks.example.test");
    expect(harness.getWrittenBody()).toBe('{"event":"publish"}');
    expect(result).toEqual({ ok: true, status: 202, responseText: '{"ok":true}' });
  });

  it("returns redirects as unsuccessful responses without following them", async () => {
    const harness = requestHarness({ status: 302, chunks: ["redirect"] });

    await expect(
      postPublishWebhook({
        url: "https://hooks.example.test/publish",
        body: "{}",
        timeoutMs: 10_000,
        resolveTarget,
        requestFactory: harness.requestFactory,
      }),
    ).resolves.toEqual({ ok: false, status: 302, responseText: "redirect" });
    expect(resolveTarget).toHaveBeenCalledTimes(1);
  });

  it("rejects and destroys responses larger than 20,000 bytes", async () => {
    const harness = requestHarness({ chunks: ["x".repeat(20_001)] });

    await expect(
      postPublishWebhook({
        url: "https://hooks.example.test/publish",
        body: "{}",
        timeoutMs: 10_000,
        resolveTarget,
        requestFactory: harness.requestFactory,
      }),
    ).rejects.toMatchObject({
      code: "response_too_large",
      retryable: false,
    });
    expect(harness.responseDestroy).toHaveBeenCalled();
  });

  it("destroys timed-out requests with a retryable timeout error", async () => {
    const harness = requestHarness({ timeout: true });

    await expect(
      postPublishWebhook({
        url: "https://hooks.example.test/publish",
        body: "{}",
        timeoutMs: 25,
        resolveTarget,
        requestFactory: harness.requestFactory,
      }),
    ).rejects.toMatchObject({
      code: "timeout",
      retryable: true,
    });
    expect(harness.requestDestroy).toHaveBeenCalled();
  });

  it("maps connection errors to a retryable transport error", async () => {
    const harness = requestHarness({ requestError: new Error("connection refused") });

    await expect(
      postPublishWebhook({
        url: "https://hooks.example.test/publish",
        body: "{}",
        timeoutMs: 10_000,
        resolveTarget,
        requestFactory: harness.requestFactory,
      }),
    ).rejects.toMatchObject({
      code: "connection_failed",
      retryable: true,
    });
  });

  it("maps outbound policy failures without creating a request", async () => {
    const harness = requestHarness();

    const request = postPublishWebhook({
      url: "https://hooks.example.test/publish",
      body: "{}",
      timeoutMs: 10_000,
      resolveTarget: async () => {
        throw new OutboundUrlPolicyError("blocked_url");
      },
      requestFactory: harness.requestFactory,
    });

    await expect(request).rejects.toBeInstanceOf(PublishWebhookTransportError);
    await expect(request).rejects.toMatchObject({
      code: "blocked_url",
      retryable: false,
    });
    expect(harness.getCapturedUrl()).toBeUndefined();
  });
});
