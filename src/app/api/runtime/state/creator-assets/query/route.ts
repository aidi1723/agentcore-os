import { NextResponse } from "next/server";
import {
  queryCreatorAssets,
  type CreatorAssetQuery,
  type CreatorAssetFilterId,
  type CreatorAssetSortId,
} from "@/lib/creator-asset-query";
import type { PublishPlatformId } from "@/lib/publish";
import { listCreatorAssetStoreSnapshot } from "@/lib/server/creator-asset-store";
import {
  getRequestBodyErrorStatus,
  readJsonBodyWithLimit,
} from "@/lib/server/request-body";

export const runtime = "nodejs";

const QUERY_BODY_LIMIT = 32_000;

type CreatorAssetQueryBody = {
  q?: string;
  filter?: CreatorAssetFilterId;
  sort?: CreatorAssetSortId;
  platform?: PublishPlatformId | "all";
  limit?: number;
};

function normalizeQuery(body: CreatorAssetQueryBody | null): CreatorAssetQuery {
  return {
    q: typeof body?.q === "string" ? body.q : "",
    filter:
      body?.filter === "in_flight" ||
      body?.filter === "successful" ||
      body?.filter === "retryable"
        ? body.filter
        : "all",
    sort:
      body?.sort === "reviewed" ||
      body?.sort === "success_signal" ||
      body?.sort === "retry_priority"
        ? body.sort
        : "updated",
    platform:
      typeof body?.platform === "string" && body.platform.trim()
        ? body.platform
        : "all",
    limit:
      typeof body?.limit === "number" && Number.isFinite(body.limit)
        ? Math.min(24, Math.max(1, Math.trunc(body.limit)))
        : 8,
  };
}

export async function POST(req: Request) {
  try {
    const body = await readJsonBodyWithLimit<CreatorAssetQueryBody>(req, QUERY_BODY_LIMIT);
    const query = normalizeQuery(body);
    const { creatorAssets } = await listCreatorAssetStoreSnapshot();
    const matches = queryCreatorAssets(creatorAssets, query);
    return NextResponse.json(
      {
        ok: true,
        data: {
          creatorAssets: matches,
          query,
          total: matches.length,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to query creator assets.";
    return NextResponse.json(
      { ok: false, error: message },
      { status: getRequestBodyErrorStatus(error, 500) },
    );
  }
}
