import net from "node:net";

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

function isPrivateIpv6(host: string) {
  const normalized = normalizedHost(host);
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd")
  );
}

function isLoopbackIpv6(host: string) {
  return normalizedHost(host) === "::1";
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
