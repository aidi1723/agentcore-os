import { NextResponse } from "next/server";

import type { RuntimeBridgeConfig, RuntimeSidecarAction } from "@/lib/desktop-runtime";
import {
  bootRuntimeSidecar,
  getRuntimeSidecarStatus,
  stopRuntimeSidecar,
  syncRuntimeSidecarConfig,
} from "@/lib/server/runtime-sidecar";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";
const SIDECAR_BODY_LIMIT = 1_000_000;

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const status = await getRuntimeSidecarStatus();
    return NextResponse.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to inspect runtime sidecar.";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await readJsonBodyWithLimit(req, SIDECAR_BODY_LIMIT)) as
      | null
      | { action?: RuntimeSidecarAction; config?: Partial<RuntimeBridgeConfig> };

    const action = body?.action;
    const config = body?.config ?? {};

    if (action === "sync") {
      const status = await syncRuntimeSidecarConfig(config);
      return NextResponse.json({ ok: true, status }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "boot") {
      const status = await bootRuntimeSidecar(config);
      return NextResponse.json(
        {
          ok: status.lastAction.ok,
          status,
          error: status.lastAction.ok ? null : status.lastAction.message,
        },
        { status: status.lastAction.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    if (action === "stop") {
      const status = await stopRuntimeSidecar(config);
      return NextResponse.json(
        {
          ok: status.lastAction.ok,
          status,
          error: status.lastAction.ok ? null : status.lastAction.message,
        },
        { status: status.lastAction.ok ? 200 : 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unsupported action. Use sync, boot, or stop." },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to control runtime sidecar.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
