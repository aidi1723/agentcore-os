import { NextResponse } from "next/server";

import { rejectUnauthorizedLocalApiRequest } from "@/lib/server/api-security";
import { readJsonBodyWithLimit } from "@/lib/server/request-body";
import { resolveApproval } from "@/lib/executor/approval-store";

const BODY_LIMIT = 10_000;

export async function POST(req: Request) {
  const forbidden = rejectUnauthorizedLocalApiRequest(req);
  if (forbidden) return forbidden;

  const body = (await readJsonBodyWithLimit(req, BODY_LIMIT)) as null | Record<string, unknown>;

  if (
    !body ||
    typeof body.executionId !== "string" ||
    typeof body.stepId !== "string" ||
    typeof body.approved !== "boolean"
  ) {
    return NextResponse.json(
      { ok: false, error: "Missing required fields: executionId, stepId, approved" },
      { status: 400 },
    );
  }

  resolveApproval(
    body.executionId,
    body.stepId,
    body.approved,
    typeof body.feedback === "string" ? body.feedback : undefined,
  );

  return NextResponse.json({ ok: true });
}
