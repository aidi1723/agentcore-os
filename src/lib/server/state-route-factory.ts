import { NextResponse } from "next/server";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

const DEFAULT_BODY_LIMIT = 1_000_000;
const DELETE_BODY_LIMIT = 8_192;
const FULL_REPLACE_HEADER = "x-agentcore-allow-full-replace";

export type StateRouteConfig = {
  resourceName: string;
  pluralName: string;
  listSnapshot: () => Promise<Record<string, unknown>>;
  writeAll: (input: unknown) => Promise<unknown>;
  upsertOne: (input: unknown) => Promise<Record<string, unknown> & { accepted: boolean }>;
  bodyLimit?: number;
};

export type DeleteRouteConfig = {
  resourceName: string;
  paramName: string;
  removeOne: (id: string, updatedAt?: number | null) => Promise<{ conflict: boolean; [key: string]: unknown }>;
};

export function createStateRouteHandlers(config: StateRouteConfig) {
  const bodyLimit = config.bodyLimit ?? DEFAULT_BODY_LIMIT;

  async function GET() {
    try {
      const snapshot = await config.listSnapshot();
      return NextResponse.json(
        { ok: true, data: snapshot },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to load ${config.pluralName}.`;
      return NextResponse.json({ ok: false, error: message }, { status: 500 });
    }
  }

  async function PUT(req: Request) {
    if (req.headers.get(FULL_REPLACE_HEADER) !== "1") {
      return NextResponse.json(
        {
          ok: false,
          error: `Full snapshot overwrite is disabled for ${config.pluralName}. Use item-level POST/DELETE sync instead.`,
        },
        { status: 409, headers: { "Cache-Control": "no-store" } },
      );
    }

    try {
      const body = await readJsonBodyWithLimit<Record<string, unknown>>(req, bodyLimit);
      const result = await config.writeAll(body?.[config.pluralName] ?? []);
      return NextResponse.json(
        { ok: true, data: { [config.pluralName]: result } },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to persist ${config.pluralName}.`;
      return NextResponse.json(
        { ok: false, error: message },
        { status: getRequestBodyErrorStatus(error, 500) },
      );
    }
  }

  async function POST(req: Request) {
    try {
      const body = await readJsonBodyWithLimit<Record<string, unknown>>(req, bodyLimit);
      const result = await config.upsertOne(body?.[config.resourceName] ?? null);
      const { accepted, ...data } = result;
      const hasItem = Object.values(data).some((v) => v !== null && v !== undefined);
      if (!hasItem) {
        return NextResponse.json(
          { ok: false, error: `Invalid ${config.resourceName} payload.` },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { ok: true, data: result },
        {
          status: accepted ? 200 : 409,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to persist ${config.resourceName}.`;
      return NextResponse.json(
        { ok: false, error: message },
        { status: getRequestBodyErrorStatus(error, 500) },
      );
    }
  }

  return { GET, PUT, POST };
}

export function createDeleteHandler(config: DeleteRouteConfig) {
  return async function DELETE(
    req: Request,
    { params }: { params: Promise<Record<string, string>> },
  ) {
    try {
      const resolvedParams = await params;
      const id = resolvedParams[config.paramName] ?? "";
      const body = await readJsonBodyWithLimit<{ updatedAt?: number }>(req, DELETE_BODY_LIMIT);
      const result = await config.removeOne(id, body?.updatedAt);
      return NextResponse.json(
        { ok: !result.conflict, data: result, error: result.conflict ? "conflict" : undefined },
        {
          status: result.conflict ? 409 : 200,
          headers: { "Cache-Control": "no-store" },
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to delete ${config.resourceName}.`;
      return NextResponse.json(
        { ok: false, error: message },
        { status: getRequestBodyErrorStatus(error, 500) },
      );
    }
  };
}