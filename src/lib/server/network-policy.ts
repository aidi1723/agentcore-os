import { lookup as dnsLookup } from "node:dns/promises";
import net from "node:net";
import type { LookupAddress } from "node:dns";

const LOCAL_NAMES = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "tauri.localhost"]);

function normalizedHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function isPrivateIpv4(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a, b] = parts;
  return (
    a === 10 ||
    a === 127 ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 169 && b === 254) ||
    a === 0
  );
}

function isLoopbackIpv4(host: string) {
  const parts = host.split(".").map((part) => Number(part));
  return parts.length === 4 && parts.every(Number.isInteger) && parts[0] === 127;
}

function mappedIpv4Address(host: string) {
  const normalized = normalizedHost(host);
  if (!normalized.startsWith("::ffff:")) return null;
  const suffix = normalized.slice("::ffff:".length);
  if (net.isIP(suffix) === 4) return suffix;

  const match = suffix.match(/^([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return `${high >> 8}.${high & 0xff}.${low >> 8}.${low & 0xff}`;
}

function isPrivateIpv6(host: string) {
  const normalized = normalizedHost(host);
  const mappedIpv4 = mappedIpv4Address(normalized);
  if (mappedIpv4) return isPrivateIpv4(mappedIpv4);

  const firstHextet = Number.parseInt(normalized.split(":")[0] || "0", 16);
  return (
    normalized === "::" ||
    normalized === "::1" ||
    (firstHextet & 0xfe00) === 0xfc00 ||
    (firstHextet & 0xffc0) === 0xfe80 ||
    (firstHextet & 0xffc0) === 0xfec0 ||
    (firstHextet & 0xff00) === 0xff00
  );
}

function isLoopbackIpv6(host: string) {
  const normalized = normalizedHost(host);
  const mappedIpv4 = mappedIpv4Address(normalized);
  return normalized === "::1" || Boolean(mappedIpv4 && isLoopbackIpv4(mappedIpv4));
}

export function parseHttpUrl(input: string) {
  try {
    const url = new URL(input);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url;
  } catch {
    return null;
  }
}

export function isAllowedOutboundUrl(
  input: string,
  options: { allowLocal?: boolean; allowLoopback?: boolean } = {},
) {
  const url = parseHttpUrl(input);
  if (!url) return false;

  const host = normalizedHost(url.hostname);
  if (LOCAL_NAMES.has(host)) return Boolean(options.allowLocal || options.allowLoopback);

  const ipKind = net.isIP(host);
  if (ipKind === 4) {
    if (isLoopbackIpv4(host)) return Boolean(options.allowLocal || options.allowLoopback);
    return options.allowLocal ? true : !isPrivateIpv4(host);
  }
  if (ipKind === 6) {
    if (isLoopbackIpv6(host)) return Boolean(options.allowLocal || options.allowLoopback);
    return options.allowLocal ? true : !isPrivateIpv6(host);
  }

  return true;
}

export type OutboundUrlPolicyErrorCode =
  | "invalid_url"
  | "blocked_url"
  | "dns_empty"
  | "dns_failed";

export class OutboundUrlPolicyError extends Error {
  readonly code: OutboundUrlPolicyErrorCode;

  constructor(
    code: OutboundUrlPolicyErrorCode,
    message: string = code,
    options?: { cause?: unknown },
  ) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "OutboundUrlPolicyError";
    this.code = code;
  }
}

export type ResolvedOutboundTarget = {
  url: URL;
  hostname: string;
  address: string;
  family: 4 | 6;
};

export type OutboundDnsLookup = (
  hostname: string,
  options: { all: true; verbatim: true },
) => Promise<readonly LookupAddress[]>;

const defaultOutboundLookup: OutboundDnsLookup = (hostname, options) =>
  dnsLookup(hostname, options);

function normalizedFamily(address: string, family: number): 4 | 6 | null {
  const detectedFamily = net.isIP(normalizedHost(address));
  if (family === 4 && detectedFamily === 4) return 4;
  if (family === 6 && detectedFamily === 6) return 6;
  return null;
}

function isAllowedResolvedAddress(address: string, family: 4 | 6, allowLoopback: boolean) {
  const host = family === 6 ? `[${normalizedHost(address)}]` : address;
  return isAllowedOutboundUrl(`http://${host}`, { allowLoopback });
}

export async function resolveAllowedOutboundUrl(
  input: string,
  options: {
    allowLoopback?: boolean;
    lookup?: OutboundDnsLookup;
  } = {},
): Promise<ResolvedOutboundTarget> {
  const url = parseHttpUrl(input);
  if (!url) {
    throw new OutboundUrlPolicyError("invalid_url", "Webhook URL must use HTTP or HTTPS.");
  }

  const hostname = normalizedHost(url.hostname);
  if (!isAllowedOutboundUrl(url.href, { allowLoopback: options.allowLoopback })) {
    throw new OutboundUrlPolicyError("blocked_url", "Webhook URL is not allowed.");
  }

  const literalFamily = net.isIP(hostname);
  if (literalFamily === 4 || literalFamily === 6) {
    return {
      url,
      hostname,
      address: hostname,
      family: literalFamily,
    };
  }

  let answers: readonly LookupAddress[];
  try {
    answers = await (options.lookup ?? defaultOutboundLookup)(hostname, {
      all: true,
      verbatim: true,
    });
  } catch (error) {
    if (error instanceof OutboundUrlPolicyError) throw error;
    throw new OutboundUrlPolicyError("dns_failed", "Webhook hostname resolution failed.", {
      cause: error,
    });
  }

  if (answers.length === 0) {
    throw new OutboundUrlPolicyError("dns_empty", "Webhook hostname returned no addresses.");
  }

  const allowResolvedLoopback = Boolean(
    options.allowLoopback && LOCAL_NAMES.has(hostname),
  );
  const validated = answers.map((answer) => {
    const family = normalizedFamily(answer.address, answer.family);
    if (!family) {
      throw new OutboundUrlPolicyError("dns_failed", "Webhook hostname returned an invalid address.");
    }
    if (!isAllowedResolvedAddress(answer.address, family, allowResolvedLoopback)) {
      throw new OutboundUrlPolicyError("blocked_url", "Webhook hostname resolved to a blocked address.");
    }
    return { address: normalizedHost(answer.address), family };
  });

  return {
    url,
    hostname,
    address: validated[0].address,
    family: validated[0].family,
  };
}
