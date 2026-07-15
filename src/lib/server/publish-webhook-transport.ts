import { request as httpRequest, type RequestOptions } from "node:http";
import { request as httpsRequest } from "node:https";
import net, { type LookupFunction } from "node:net";

import {
  OutboundUrlPolicyError,
  resolveAllowedOutboundUrl,
  type ResolvedOutboundTarget,
} from "@/lib/server/network-policy";

const MAX_RESPONSE_BYTES = 20_000;

export type PublishWebhookResponse = {
  ok: boolean;
  status: number;
  responseText: string;
};

export type PublishWebhookTransportErrorCode =
  | "blocked_url"
  | "dns_failed"
  | "timeout"
  | "response_too_large"
  | "connection_failed";

export class PublishWebhookTransportError extends Error {
  readonly code: PublishWebhookTransportErrorCode;
  readonly retryable: boolean;

  constructor(
    code: PublishWebhookTransportErrorCode,
    retryable: boolean,
    message: string = code,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "PublishWebhookTransportError";
    this.code = code;
    this.retryable = retryable;
  }
}

export type PublishWebhookIncomingResponse = {
  statusCode?: number;
  setEncoding(encoding: BufferEncoding): unknown;
  on(
    event: "data" | "end" | "error",
    listener: (value?: string | Error) => void,
  ): unknown;
  destroy(error?: Error): unknown;
};

export type PublishWebhookRequest = {
  on(event: "error", listener: (error: Error) => void): unknown;
  setTimeout(timeoutMs: number, listener: () => void): unknown;
  write(chunk: string): unknown;
  end(): unknown;
  destroy(error?: Error): unknown;
};

export type PublishWebhookRequestOptions = RequestOptions & {
  lookup: LookupFunction;
  servername?: string;
};

export type PublishWebhookRequestFactory = (
  url: URL,
  options: PublishWebhookRequestOptions,
  onResponse: (response: PublishWebhookIncomingResponse) => void,
) => PublishWebhookRequest;

type ResolveOutboundTarget = (
  input: string,
  options: { allowLoopback?: boolean },
) => Promise<ResolvedOutboundTarget>;

const defaultRequestFactory: PublishWebhookRequestFactory = (url, options, onResponse) => {
  const request = url.protocol === "https:" ? httpsRequest : httpRequest;
  return request(url, options, onResponse);
};

function pinnedLookup(target: ResolvedOutboundTarget): LookupFunction {
  return (_hostname, options, callback) => {
    if (options.all) {
      callback(null, [{ address: target.address, family: target.family }]);
      return;
    }
    callback(null, target.address, target.family);
  };
}

function mapPolicyError(error: OutboundUrlPolicyError) {
  if (error.code === "invalid_url" || error.code === "blocked_url") {
    return new PublishWebhookTransportError("blocked_url", false, error.message, {
      cause: error,
    });
  }
  return new PublishWebhookTransportError("dns_failed", true, error.message, {
    cause: error,
  });
}

function connectionError(error: unknown) {
  if (error instanceof PublishWebhookTransportError) return error;
  const message = error instanceof Error ? error.message : "Webhook connection failed.";
  return new PublishWebhookTransportError("connection_failed", true, message, {
    cause: error,
  });
}

export async function postPublishWebhook({
  url,
  body,
  timeoutMs,
  allowLoopback = false,
  resolveTarget = resolveAllowedOutboundUrl,
  requestFactory = defaultRequestFactory,
}: {
  url: string;
  body: string;
  timeoutMs: number;
  allowLoopback?: boolean;
  resolveTarget?: ResolveOutboundTarget;
  requestFactory?: PublishWebhookRequestFactory;
}): Promise<PublishWebhookResponse> {
  let target: ResolvedOutboundTarget;
  try {
    target = await resolveTarget(url, { allowLoopback });
  } catch (error) {
    if (error instanceof OutboundUrlPolicyError) throw mapPolicyError(error);
    throw connectionError(error);
  }

  return new Promise<PublishWebhookResponse>((resolve, reject) => {
    let settled = false;
    let request: PublishWebhookRequest;

    const resolveOnce = (response: PublishWebhookResponse) => {
      if (settled) return;
      settled = true;
      resolve(response);
    };
    const rejectOnce = (error: PublishWebhookTransportError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const options: PublishWebhookRequestOptions = {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Host: target.url.host,
      },
      lookup: pinnedLookup(target),
      servername:
        target.url.protocol === "https:" && net.isIP(target.hostname) === 0
          ? target.hostname
          : undefined,
    };

    try {
      request = requestFactory(target.url, options, (response) => {
        const chunks: string[] = [];
        let responseBytes = 0;
        response.setEncoding("utf8");
        response.on("data", (value) => {
          if (settled || typeof value !== "string") return;
          responseBytes += Buffer.byteLength(value);
          if (responseBytes > MAX_RESPONSE_BYTES) {
            const error = new PublishWebhookTransportError(
              "response_too_large",
              false,
              `Webhook response exceeded ${MAX_RESPONSE_BYTES} bytes.`,
            );
            rejectOnce(error);
            response.destroy(error);
            request.destroy(error);
            return;
          }
          chunks.push(value);
        });
        response.on("error", (value) => rejectOnce(connectionError(value)));
        response.on("end", () => {
          const status = response.statusCode ?? 0;
          resolveOnce({
            ok: status >= 200 && status < 300,
            status,
            responseText: chunks.join(""),
          });
        });
      });
    } catch (error) {
      rejectOnce(connectionError(error));
      return;
    }

    request.on("error", (error) => rejectOnce(connectionError(error)));
    request.setTimeout(timeoutMs, () => {
      const error = new PublishWebhookTransportError(
        "timeout",
        true,
        `Webhook request timed out after ${timeoutMs}ms.`,
      );
      rejectOnce(error);
      request.destroy(error);
    });
    request.write(body);
    request.end();
  });
}
