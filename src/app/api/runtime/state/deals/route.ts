import {
  listDealStoreSnapshot,
  upsertDealInStore,
  writeDealsToStore,
} from "@/lib/server/deal-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "deal",
  pluralName: "deals",
  listSnapshot: listDealStoreSnapshot,
  writeAll: writeDealsToStore,
  upsertOne: upsertDealInStore,
});
