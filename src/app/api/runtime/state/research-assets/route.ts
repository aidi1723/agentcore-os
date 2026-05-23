import {
  listResearchAssetStoreSnapshot,
  upsertResearchAssetInStore,
  writeResearchAssetsToStore,
} from "@/lib/server/research-asset-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "researchAsset",
  pluralName: "researchAssets",
  listSnapshot: listResearchAssetStoreSnapshot,
  writeAll: writeResearchAssetsToStore,
  upsertOne: upsertResearchAssetInStore,
});
