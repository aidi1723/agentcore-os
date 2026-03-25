import { NextResponse } from "next/server";
import { execText } from "@/lib/safeExec";
import { parseOpenclawStatus, type OpenClawStatus } from "@/lib/openclawStatus";

export const runtime = "nodejs";

let cache: { ts: number; data: OpenClawStatus } | null = null;
const CACHE_MS = 9_500; // slightly under 10s to keep UI fresh without hammering openclaw

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.ts < CACHE_MS) {
    return NextResponse.json({ ...cache.data, cached: true });
  }

  try {
    // Lightweight probe: do not run deep status in a polling endpoint.
    // This keeps the UI responsive and avoids putting load on OpenClaw.
    const rawGateway = await execText("openclaw", ["gateway", "status"], 2_500);
    let rawNodes = "";
    try {
      rawNodes = await execText("openclaw", ["nodes", "status"], 2_500);
    } catch {
      rawNodes = "";
    }

    const parsedGw = parseOpenclawStatus(rawGateway);
    const parsedNodes = parseOpenclawStatus(rawNodes);

    const data: OpenClawStatus = {
      ok: true,
      ts: now,
      raw: [
        "# openclaw gateway status",
        rawGateway.trim(),
        "",
        "# openclaw nodes status",
        rawNodes.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
      gatewayOnline: parsedGw.gatewayOnline,
      nodesCount: parsedNodes.nodesCount,
      channelsHint: undefined,
    };
    cache = { ts: now, data };
    return NextResponse.json({ ...data, cached: false });
  } catch (e) {
    const data: OpenClawStatus = {
      ok: false,
      ts: now,
      raw: "",
      gatewayOnline: false,
      nodesCount: null,
      error: (e as Error).message,
    };
    cache = { ts: now, data };
    return NextResponse.json({ ...data, cached: false }, { status: 500 });
  }
}
