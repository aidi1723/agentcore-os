import { NextResponse } from "next/server";

import { isAuthorizedQueueRequest, isQueueSecretEnabled } from "@/lib/server/publish-queue-auth";
import { runOneQueuedPublishJob } from "@/lib/server/publish-queue-runner";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  return NextResponse.json(
    {
      ok: true,
      data: {
        route: "/api/publish/queue/run",
        authRequired: isQueueSecretEnabled(),
      },
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;


  try {
    if (!isAuthorizedQueueRequest(req)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const result = await runOneQueuedPublishJob();
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "队列执行失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
