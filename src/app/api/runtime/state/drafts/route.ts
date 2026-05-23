import {
  listDraftStoreSnapshot,
  upsertDraftInStore,
  writeDraftsToStore,
} from "@/lib/server/draft-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "draft",
  pluralName: "drafts",
  listSnapshot: listDraftStoreSnapshot,
  writeAll: writeDraftsToStore,
  upsertOne: upsertDraftInStore,
});
