export type OpenClawStatus = {
  ok: boolean;
  ts: number;
  gatewayOnline: boolean;
  nodesCount: number | null;
  channelsHint?: string;
  raw: string;
  error?: string;
};

// Heuristic parsing: robust against formatting changes; we only extract a couple of key bits.
export function parseOpenclawStatus(
  raw: string,
): Omit<OpenClawStatus, "ok" | "ts" | "raw"> {
  const s = raw;
  const lower = s.toLowerCase();

  const gatewayOnline =
    /(gateway|daemon).*\b(running|online|ok)\b/i.test(s) ||
    /gateway\s*:\s*(running|online|ok)/i.test(s) ||
    (lower.includes("gateway") && lower.includes("running"));

  let nodesCount: number | null = null;
  const m =
    s.match(/\bnodes?\b\s*[:=]\s*(\d+)/i) ||
    s.match(/\bpaired\s+nodes?\b\s*[:=]\s*(\d+)/i) ||
    s.match(/\bdevices?\b\s*[:=]\s*(\d+)/i);
  if (m && m[1]) nodesCount = Number(m[1]);

  const channelsHint =
    (s.match(/\bchannels?\b.*$/im)?.[0] ||
      s.match(/\bmessaging\b.*$/im)?.[0] ||
      undefined)?.trim();

  return { gatewayOnline, nodesCount, channelsHint };
}
