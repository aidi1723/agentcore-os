import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { writePublishConfig, readPublishConfig } from "@/lib/server/publish-config-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const CONFIG_BODY_LIMIT = 1_000_000;

export async function GET() {
  const matrixAccounts = await readPublishConfig();
  return NextResponse.json(
    { ok: true, data: { matrixAccounts } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await readJsonBodyWithLimit(req, CONFIG_BODY_LIMIT)) as
      | null
      | { matrixAccounts?: unknown };
    const matrixAccounts = await writePublishConfig((body?.matrixAccounts ?? {}) as any);
    return NextResponse.json(
      { ok: true, data: { matrixAccounts } },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "保存失败";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(err, 500) },
    );
  }
}
