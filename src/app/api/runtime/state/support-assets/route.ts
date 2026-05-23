import {
  listSupportAssetStoreSnapshot,
  upsertSupportAssetInStore,
  writeSupportAssetsToStore,
} from "@/lib/server/support-asset-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "supportAsset",
  pluralName: "supportAssets",
  listSnapshot: listSupportAssetStoreSnapshot,
  writeAll: writeSupportAssetsToStore,
  upsertOne: upsertSupportAssetInStore,
});
