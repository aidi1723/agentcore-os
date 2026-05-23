import {
  listKnowledgeAssetStoreSnapshot,
  upsertKnowledgeAssetInStore,
  writeKnowledgeAssetsToStore,
} from "@/lib/server/knowledge-asset-store";
import { createStateRouteHandlers } from "@/lib/server/state-route-factory";

export const runtime = "nodejs";

export const { GET, PUT, POST } = createStateRouteHandlers({
  resourceName: "knowledgeAsset",
  pluralName: "knowledgeAssets",
  listSnapshot: listKnowledgeAssetStoreSnapshot,
  writeAll: writeKnowledgeAssetsToStore,
  upsertOne: upsertKnowledgeAssetInStore,
});
