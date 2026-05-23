import { NextResponse } from "next/server";
import { runPublishDispatch, uniqDispatchPlatforms } from "@/lib/server/publish-dispatch";
import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import type { ServerLlmConfigInput } from "@/lib/server/direct-llm";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
const DISPATCH_BODY_LIMIT = 1_000_000;

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  try {
    const body = (await readJsonBodyWithLimit(req, DISPATCH_BODY_LIMIT)) as
      | null
      | {
          title?: string;
          body?: string;
          platforms?: unknown;
          dryRun?: boolean;
          connections?: Record<string, { token?: string; webhookUrl?: string }>;
          timeoutSeconds?: number;
          llm?: ServerLlmConfigInput;
        };

    const title = String(body?.title ?? "").trim();
    const content = String(body?.body ?? "").trim();
    const platforms = uniqDispatchPlatforms(body?.platforms);
    if (!title || !content) {
      return NextResponse.json({ ok: false, error: "缺少 title/body" }, { status: 400 });
    }
    if (platforms.length === 0) {
      return NextResponse.json({ ok: false, error: "请选择至少一个平台" }, { status: 400 });
    }

    const result = await runPublishDispatch({
      title,
      body: content,
      platforms,
      dryRun: body?.dryRun !== false,
      connections: body?.connections && typeof body.connections === "object" ? body.connections : {},
      timeoutSeconds: body?.timeoutSeconds,
      llm: body?.llm,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : 502,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "请求异常";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(err, 500) },
    );
  }
}
