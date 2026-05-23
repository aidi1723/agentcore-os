import { createHash, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
  "tauri.localhost",
]);

function splitHost(value: string) {
  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return "";
  if (trimmed.startsWith("[")) {
    const end = trimmed.indexOf("]");
    return end >= 0 ? trimmed.slice(0, end + 1) : trimmed;
  }
  return trimmed.split(":")[0] ?? trimmed;
}

export function isLocalRequest(req: Request) {
  const url = new URL(req.url);
  const hostHeader = req.headers.get("host");
  const requestHost = splitHost(hostHeader || url.host || url.hostname);
  const urlHost = splitHost(url.hostname);
  return LOCAL_HOSTS.has(requestHost) || LOCAL_HOSTS.has(urlHost);
}

function readApiToken() {
  return (process.env.AGENTCORE_API_AUTH_TOKEN ?? "").trim();
}

function tokenDigest(value: string) {
  return createHash("sha256").update(value).digest();
}

function tokenMatches(candidate: string, expected: string) {
  return timingSafeEqual(tokenDigest(candidate), tokenDigest(expected));
}

export function isAuthorizedLocalApiRequest(req: Request) {
  if (!isLocalRequest(req)) return false;

  const expected = readApiToken();
  if (!expected) return true;

  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  const direct = (req.headers.get("x-agentcore-token") ?? "").trim();
  return tokenMatches(bearer, expected) || tokenMatches(direct, expected);
}

export function rejectUnauthorizedLocalApiRequest(req: Request) {
  if (isAuthorizedLocalApiRequest(req)) return null;
  return NextResponse.json(
    { ok: false, error: "Forbidden" },
    { status: 403, headers: { "Cache-Control": "no-store" } },
  );
}
