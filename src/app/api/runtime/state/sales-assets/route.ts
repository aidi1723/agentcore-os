import {
  listSalesAssetStoreSnapshot,
  upsertSalesAssetInStore,
  writeSalesAssetsToStore,
} from "@/lib/server/sales-asset-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "salesAsset",
  pluralName: "salesAssets",
  listSnapshot: listSalesAssetStoreSnapshot,
  writeAll: writeSalesAssetsToStore,
  upsertOne: upsertSalesAssetInStore,
});
