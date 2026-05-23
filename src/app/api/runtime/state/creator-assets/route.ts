import {
  listCreatorAssetStoreSnapshot,
  upsertCreatorAssetInStore,
  writeCreatorAssetsToStore,
} from "@/lib/server/creator-asset-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "creatorAsset",
  pluralName: "creatorAssets",
  listSnapshot: listCreatorAssetStoreSnapshot,
  writeAll: writeCreatorAssetsToStore,
  upsertOne: upsertCreatorAssetInStore,
});
