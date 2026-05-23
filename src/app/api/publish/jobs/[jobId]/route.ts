import { NextResponse } from "next/server";

import { removePublishJobRecord, updatePublishJobRecord } from "@/lib/server/publish-job-store";
import type { PublishJobRecord } from "@/lib/publish";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";
export const dynamicParams = false;
const JOB_PATCH_BODY_LIMIT = 1_000_000;

export function generateStaticParams() {
  return [];
}

export async function PATCH(req: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    const patch = (await readJsonBodyWithLimit(
      req,
      JOB_PATCH_BODY_LIMIT,
    )) as Partial<Omit<PublishJobRecord, "id" | "createdAt">> | null;
    const job = await updatePublishJobRecord(jobId, patch ?? {});
    if (!job) {
      return NextResponse.json({ ok: false, error: "任务不存在" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, data: { job } }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "更新失败";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(err, 500) },
    );
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await params;
    await removePublishJobRecord(jobId);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "删除失败";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
